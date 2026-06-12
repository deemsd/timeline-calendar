import React, {forwardRef, useCallback, useEffect, useMemo, memo, useRef} from 'react';
import '@/less/Calendar.less';
import '@/less/time-select.less';
import '@/less/event-styles.less';
import '@/less/modal.less';
import '@/less/codex-overrides.less';
import {Calendar, momentLocalizer} from 'react-big-calendar';
import type {CalendarProps as RBCalendarProps, Event, SlotInfo, View, ViewsProps} from 'react-big-calendar';
import {moment} from 'obsidian';
import withDragAndDrop, {withDragAndDropProps} from 'react-big-calendar/lib/addons/dragAndDrop';
import MonthView from 'react-big-calendar/lib/Month';
import dailyNotesService from '@/services/fileService';
import eventService from '@/services/eventService';
import useEventStore from '@/stores/eventStore';
import useFileStore from '@/stores/fileStore';
import useCalendarStore from '@/stores/calendarStore';
import {useShallow} from 'zustand/react/shallow';
import EventCreatePrompt, {EventCreateResult} from '@/obComponents/EventCreatePrompt';
import {useEvents} from '@/hooks/useStore';
import CustomToolbar from './CustomToolbar';
// Import our custom event component
import EventComponent from './EventComponent';
import noOverlapNoHorizontalGap from '@/utils/dayLayoutAlgorithm';




export interface EventRefActions {
  updateEvents: (events: Model.Event[]) => void;
}

interface CalendarProps {
  selectable: boolean;
  resizeable: boolean;
  defaultView: View;
  StartDate: string;
  VisibleStartTime: string;
  VisibleEndTime: string;
  popup: boolean;
  onEventDoubleClick: (event: Event) => void;
  onEventSelect: (event: EventCreateResult, slotInfo: SlotInfo) => void;
}

// Create a memoized DragAndDropCalendar component
const DragAndDropCalendar = memo(
  withDragAndDrop<Model.Event>(Calendar as React.ComponentType<RBCalendarProps<Model.Event>>),
);

const MONTH_ROW_LIMIT = 5;
const DEFAULT_TIMED_EVENT_DURATION_MS = 30 * 60 * 1000;
const DEFAULT_VISIBLE_START_TIME = '08:00';
const DEFAULT_VISIBLE_END_TIME = '21:00';
const WEEKDAY_LABELS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

class StableMonthView extends MonthView {
  constructor(props: Record<string, unknown>) {
    super(props);
    this.state = {
      ...this.state,
      rowLimit: MONTH_ROW_LIMIT,
      needLimitMeasure: false,
    };
  }

  measureRowLimit() {
    this.setState({
      rowLimit: MONTH_ROW_LIMIT,
      needLimitMeasure: false,
    });
  }
}

const calendarViews = {
  month: StableMonthView,
  week: true,
  day: true,
  agenda: true,
} as unknown as ViewsProps<Model.Event>;

const parseClockTime = (value: string, fallback: string) => {
  const normalizedValue = /^\d{2}:\d{2}$/.test(value) ? value : fallback;
  const [hour, minute] = normalizedValue.split(':').map(Number);

  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) {
    const [fallbackHour, fallbackMinute] = fallback.split(':').map(Number);
    return {hour: fallbackHour, minute: fallbackMinute};
  }

  return {hour, minute};
};

const createVisibleTime = (time: {hour: number; minute: number}) => {
  const date = new Date();
  date.setHours(time.hour, time.minute, 0, 0);
  return date;
};

const toDate = (value: Date | string): Date => (value instanceof Date ? value : new Date(value));

const shouldTreatAsTimedEvent = (start: Date, end: Date, allDay?: boolean) => {
  // allDay 参数表示拖拽目标区域（来自 react-big-calendar 的 WeekWrapper props），优先级最高
  // - allDay = true → 目标是全天区域 → 应为全天事件
  // - allDay = false → 目标是时间格区域 → 应为定时事件
  if (allDay === false) return true;
  if (allDay === true) return false;

  // allDay 未定义时，根据时间信息判断
  const hasExplicitTime =
    start.getHours() !== 0 ||
    start.getMinutes() !== 0 ||
    start.getSeconds() !== 0 ||
    end.getHours() !== 0 ||
    end.getMinutes() !== 0 ||
    end.getSeconds() !== 0;

  if (hasExplicitTime) return true;

  // 兜底：基于时长判断
  const duration = end.getTime() - start.getTime();
  return duration > 0 && duration < 24 * 60 * 60 * 1000;
};

const normalizeEventTiming = (
  event: Model.Event,
  startValue: Date | string,
  endValue: Date | string,
  allDay?: boolean,
) => {
  const start = toDate(startValue);
  let end = toDate(endValue);
  const isTimedEvent = shouldTreatAsTimedEvent(start, end, allDay);

  if (isTimedEvent) {
    if (event.allDay || end.getTime() <= start.getTime()) {
      end = new Date(start.getTime() + DEFAULT_TIMED_EVENT_DURATION_MS);
    }
  } else if (
    end.getTime() > start.getTime() &&
    end.getHours() === 0 &&
    end.getMinutes() === 0 &&
    end.getSeconds() === 0
  ) {
    end = new Date(end.getTime() - 24 * 60 * 60 * 1000);
  }

  return {start, end, allDay: !isTimedEvent};
};

const weekdayLabel = (date: Date) => WEEKDAY_LABELS[moment(date).day()];

const formatDateRange = (start: Date, end: Date) => {
  const startMoment = moment(start);
  const endMoment = moment(end);

  if (startMoment.isSame(endMoment, 'month')) {
    return `${startMoment.format('M月D日')}-${endMoment.format('D日')}`;
  }

  return `${startMoment.format('M月D日')}-${endMoment.format('M月D日')}`;
};

const CalendarComponent = forwardRef((props: CalendarProps, ref: React.ForwardedRef<EventRefActions>) => {
  const {
    selectable,
    resizeable,
    StartDate,
    VisibleStartTime,
    VisibleEndTime,
    popup,
    onEventDoubleClick: handleDoubleClickEventCallback,
    onEventSelect: handleEventSelectCallback,
  } = props;

  // Get app from fileStore
  const app = useFileStore((state) => state.app);

  const events = useEvents();
  // Get state and actions from the calendar store with fine-grained subscription.
  // Zustand v5 不再支持 useStore(selector, equalityFn) 第二参数，需配合 useShallow 做对象浅比较，
  // 避免 store 中无关字段（如 isLoading）变化触发本组件全量重渲染。
  const {
    calendarView,
    calendarDate,
    selectable: select,
    resizable: resize,
    calendarPopup,
    setCalendarView,
    setCalendarDate,
    setSelectable,
    setResizable,
    setCalendarPopup,
    setStartDay,
    setLoading,
    loadStoredPreferences,
    saveCalendarView,
    saveCalendarDate,
  } = useCalendarStore(
    useShallow((state) => ({
      calendarView: state.calendarView,
      calendarDate: state.calendarDate,
      selectable: state.selectable,
      resizable: state.resizable,
      calendarPopup: state.calendarPopup,
      setCalendarView: state.setCalendarView,
      setCalendarDate: state.setCalendarDate,
      setSelectable: state.setSelectable,
      setResizable: state.setResizable,
      setCalendarPopup: state.setCalendarPopup,
      setStartDay: state.setStartDay,
      setLoading: state.setLoading,
      loadStoredPreferences: state.loadStoredPreferences,
      saveCalendarView: state.saveCalendarView,
      saveCalendarDate: state.saveCalendarDate,
    })),
  );

  // Create a memoized localizer
  const localizer = useMemo(() => {
    const dow = StartDate === 'sunday' ? 0 : 1;
    const currentLocale = moment.locale();
    [currentLocale, 'en', 'zh-cn', 'zh'].forEach((locale) => {
      moment.updateLocale(locale, {week: {dow}});
    });
    return momentLocalizer(moment);
  }, [StartDate]);

  const visibleTimeRange = useMemo(() => {
    const startTime = parseClockTime(VisibleStartTime, DEFAULT_VISIBLE_START_TIME);
    const endTime = parseClockTime(VisibleEndTime, DEFAULT_VISIBLE_END_TIME);
    let min = createVisibleTime(startTime);
    let max = createVisibleTime(endTime);

    if (max.getTime() <= min.getTime()) {
      min = createVisibleTime(parseClockTime(DEFAULT_VISIBLE_START_TIME, DEFAULT_VISIBLE_START_TIME));
      max = createVisibleTime(parseClockTime(DEFAULT_VISIBLE_END_TIME, DEFAULT_VISIBLE_END_TIME));
    }

    return {min, max, scrollToTime: min};
  }, [VisibleStartTime, VisibleEndTime]);

  const calendarFormats = useMemo(
    () => ({
      timeGutterFormat: (date: Date) => moment(date).format('HH:mm'),
      dayFormat: (date: Date) => `${moment(date).format('DD')} ${weekdayLabel(date)}`,
      weekdayFormat: (date: Date) => weekdayLabel(date),
      dayHeaderFormat: (date: Date) => `${weekdayLabel(date)} ${moment(date).format('M月D日')}`,
      dayRangeHeaderFormat: ({start, end}: {start: Date; end: Date}) => formatDateRange(start, end),
      monthHeaderFormat: (date: Date) => moment(date).format('YYYY年M月'),
      agendaHeaderFormat: ({start, end}: {start: Date; end: Date}) => formatDateRange(start, end),
      agendaDateFormat: (date: Date) => moment(date).format('M月D日'),
      eventTimeRangeFormat: ({start, end}: {start: Date; end: Date}) =>
        `${moment(start).format('HH:mm')} - ${moment(end).format('HH:mm')}`,
      selectRangeFormat: ({start, end}: {start: Date; end: Date}) =>
        `${moment(start).format('HH:mm')} - ${moment(end).format('HH:mm')}`,
    }),
    [],
  );

  const calendarMessages = useMemo(
    () => ({
      today: 'Today',
      previous: 'Back',
      next: 'Next',
      month: '月',
      week: '周',
      day: '日',
      agenda: '日程',
      date: '日期',
      time: '时间',
      event: '事件',
      noEventsInRange: '当前范围没有事件',
      showMore: (total: number) => `+${total} 更多`,
    }),
    [],
  );

  // Load events when the component mounts or when the app changes
  useEffect(() => {
    const fetchEvents = async () => {
      if (app) {
        try {
          await eventService.fetchAllEvents(app);
        } catch (error) {
          console.error('Error loading events:', error);
        }
      }
    };

    void fetchEvents();
  }, [app]);

  const didInitializeRef = useRef(false);

  // Initialize the component - Only run once when app is available.
  // Re-loading cached view after every view change can overwrite the user's
  // first click with the old saved value, making view switching need two clicks.
  useEffect(() => {
    if (!app || didInitializeRef.current) return;

    // Use a timeout to defer these operations, breaking potential circular dependencies
    const timeoutId = window.setTimeout(() => {
      didInitializeRef.current = true;
      void (async () => {
        await loadStoredPreferences(app);

        if (selectable !== select) {
          setSelectable(selectable);
        }

        if (resizeable !== resize) {
          setResizable(resizeable);
        }

        if (popup !== calendarPopup) {
          setCalendarPopup(popup);
        }

        // Mark loading as complete
        setLoading(false);
      })();
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [
    app,
    selectable,
    select,
    resizeable,
    resize,
    popup,
    calendarPopup,
    loadStoredPreferences,
    setSelectable,
    setResizable,
    setCalendarPopup,
    setLoading,
  ]);

  useEffect(() => {
    setStartDay(StartDate === 'sunday' ? 'sunday' : 'monday');
  }, [StartDate, setStartDay]);

  // Style events based on their type
  const styleEvents = useCallback((event: Model.Event) => {
    const eventType = event.eventType || 'TASK-TODO';
    const timingClass = event.allDay ? 'bc-all-day-task' : 'bc-timed-task';
    return {className: `${eventType} bc-task-event ${timingClass}`};
  }, []);

  // Handle double click on events
  const handleDoubleClickEvent = useCallback(
    (event: Event) => {
      handleDoubleClickEventCallback(event);
    },
    [handleDoubleClickEventCallback],
  );

  // Handle event selection
  const handleEventSelect = useCallback(
    async (slotInfo: SlotInfo) => {
      const {app} = dailyNotesService.getState();

      // Pass the start and end times from slotInfo to EventCreatePrompt
      const addEvent = await EventCreatePrompt.Prompt(
        app,
        'Input Event',
        '',
        '',
        slotInfo.start,
        slotInfo.end,
      );

      handleEventSelectCallback(addEvent, slotInfo);
    },
    [handleEventSelectCallback],
  );

  // Handle view changes
  const handleViewChange = useCallback(
    (view: View) => {
      if (calendarView !== view) {
        setCalendarView(view);
        // Save the view change to storage
        if (app) {
          void saveCalendarView(app, view);
        }
      }
    },
    [calendarView, setCalendarView, app, saveCalendarView],
  );

  // Handle navigation (date changes)
  const handleNavigate = useCallback(
    (date: Date) => {
      if (calendarDate !== date) {
        setCalendarDate(date);

        // Save the date change to storage
        if (app) {
          void saveCalendarDate(app, date);
        }
      }
    },
    [calendarDate, setCalendarDate, app, saveCalendarDate],
  );

  // Handle event resize - Memoize the implementation
  const onEventResize = useCallback<NonNullable<withDragAndDropProps<Model.Event>['onEventResize']>>((data) => {
    const {event, start, end} = data;
    const timing = normalizeEventTiming(
      event,
      start,
      end,
      data.isAllDay,
    );

    eventService
      .editEvent({...event, allDay: timing.allDay}, timing.start, timing.end)
      .then((updatedEvent) => {
        if (!updatedEvent) {
          console.error('Failed to resize event');
        }
      })
      .catch((error) => {
        console.error('Error resizing event:', error);
      });
  }, []);

  // Track dragging event for cross-area drops (all-day -> timed)
  const dragEventRef = useRef<Model.Event | null>(null);

  // 全局兜底：拖拽结束（包括取消、释放在画布外）时清理引用，避免 endAccessor 残留作用
  const clearDragRef = useCallback(() => {
    if (dragEventRef.current) {
      dragEventRef.current = null;
    }
    activeDocument.removeEventListener('mouseup', clearDragRef, true);
    activeDocument.removeEventListener('touchend', clearDragRef, true);
    activeDocument.removeEventListener('dragend', clearDragRef, true);
  }, []);

  const onDragStart = useCallback(
    (data: {event: Model.Event; action: string; direction: string}) => {
      dragEventRef.current = data.event;
      // 注册一次性兜底监听：拖拽未触发 onEventDrop（如点选未拖动、拖出区域）时也能复位
      activeDocument.addEventListener('mouseup', clearDragRef, true);
      activeDocument.addEventListener('touchend', clearDragRef, true);
      activeDocument.addEventListener('dragend', clearDragRef, true);
    },
    [clearDragRef],
  );

  const onDropFromOutside = useCallback(
    (data: {start: Date; end: Date; allDay: boolean}) => {
      const event = dragEventRef.current;
      if (!event) return;
      dragEventRef.current = null;
      const originalEvent = {...event} as Model.Event;
      // Use normalizeEventTiming to correctly handle allDay and time adjustments
      const timing = normalizeEventTiming(
        originalEvent,
        data.start,
        data.end,
        data.allDay,
      );

      // 乐观更新：跨区域拖拽（如全天 → 时间格）时立即反映新位置，避免持久化期间 UI 抖动
      useEventStore.getState().editEvent({
        ...originalEvent,
        start: timing.start,
        end: timing.end,
        allDay: timing.allDay,
      } as Model.Event);

      eventService
        .editEvent({...originalEvent, allDay: timing.allDay} as Model.Event, timing.start, timing.end)
        .then((updatedEvent) => {
          if (!updatedEvent) {
            console.error('Failed to drop event');
            // 持久化失败，回滚乐观更新
            useEventStore.getState().editEvent(originalEvent);
          }
        })
        .catch((error) => {
          console.error('Error dropping event:', error);
          // 持久化异常，回滚乐观更新
          useEventStore.getState().editEvent(originalEvent);
        });
    },
    [],
  );

  const dragFromOutsideItem = useCallback(() => {
    const event = dragEventRef.current;
    if (!event) return null;

    // 全天事件被拖入时间格时，返回临时副本将时长改为30分钟，
    // 避免 react-big-calendar 内部用 24h 时长计算 end 导致色块超长。
    if (event.allDay) {
      const startTime = new Date(event.start);
      return {
        ...event,
        end: new Date(startTime.getTime() + DEFAULT_TIMED_EVENT_DURATION_MS),
      };
    }

    return event;
  }, []);

  // 自定义 endAccessor：在拖拽「全天事件」期间，强制让其 end 仅比 start 多 30 分钟。
  // 这样 react-big-calendar 内部 EventContainerWrapper.handleMove 通过
  // eventTimes(event, accessors, localizer) 计算出的 duration 就是 30 分钟，
  // 拖拽预览块自然只占一个 slot，而不是 24 小时全屏。
  // 注意：仅对正在拖拽的那个事件实例生效，不影响其他事件的渲染。
  const endAccessor = useCallback((event: Model.Event) => {
    if (dragEventRef.current === event && event && event.allDay) {
      const start = event.start instanceof Date ? event.start : new Date(event.start);
      return new Date(start.getTime() + DEFAULT_TIMED_EVENT_DURATION_MS);
    }
    return event.end;
  }, []);

  // Handle event drop - Memoize the implementation
  const onEventDrop = useCallback<NonNullable<withDragAndDropProps<Model.Event>['onEventDrop']>>((data) => {
    // 拖拽结束后立即清理 ref，避免 endAccessor 在后续渲染继续返回 30 分钟 end
    dragEventRef.current = null;
    const {event, start, end} = data;
    const originalEvent = event;
    const timing = normalizeEventTiming(
      originalEvent,
      start,
      end,
      data.isAllDay,
    );

    // 乐观更新：先在 store 中立即反映新位置，避免拖拽后等待文件读写完成期间 UI 抖动
    useEventStore.getState().editEvent({
      ...originalEvent,
      start: timing.start,
      end: timing.end,
      allDay: timing.allDay,
    });

    eventService
      .editEvent({...originalEvent, allDay: timing.allDay}, timing.start, timing.end)
      .then((updatedEvent) => {
        if (!updatedEvent) {
          console.error('Failed to update event');
          // 持久化失败，回滚乐观更新
          useEventStore.getState().editEvent(originalEvent);
        }
      })
      .catch((error) => {
        console.error('Error updating event:', error);
        // 持久化异常，回滚乐观更新
        useEventStore.getState().editEvent(originalEvent);
      });
  }, []);

  // Memoize calendar props to prevent unnecessary re-renders
  const calendarProps = useMemo(() => {
    return {
      selectable: select,
      localizer: localizer,
      formats: calendarFormats,
      messages: calendarMessages,
      events: events,
      resizable: resize,
      defaultView: calendarView,
      defaultDate: calendarDate,
      date: calendarDate,
      view: calendarView,
      views: calendarViews,
      min: visibleTimeRange.min,
      max: visibleTimeRange.max,
      scrollToTime: visibleTimeRange.scrollToTime,
      step: 30,
      timeslots: 1,
      draggableAccessor: () => true,
      resizableAccessor: (event: Model.Event) => !event.allDay,
      enableAutoScroll: false,
      dayLayoutAlgorithm: noOverlapNoHorizontalGap,
      eventPropGetter: styleEvents,
      popup: calendarPopup,
      onEventDrop: onEventDrop,
      onEventResize: onEventResize,
      onDragStart: onDragStart,
      onDropFromOutside: onDropFromOutside,
      dragFromOutsideItem: dragFromOutsideItem,
      endAccessor: endAccessor,
      titleAccessor: (event: Model.Event) => {
        // Remove time patterns from the title for display
        const title = event.title;
        const cleanedTitle = title
          .replace(/\d{1,2}:\d{2}(-\d{1,2}:\d{2})?/g, '') // Remove time ranges like 10:00-11:00
          .replace(/⏲\s?\d{1,2}:\d{2}/g, '') // Remove end time emoji patterns
          .replace(/📅\s?\d{4}-\d{2}-\d{2}/g, '') // Remove date patterns
          .trim();

        // Return original title if cleaned version is empty
        return cleanedTitle || title;
      },
      tooltipAccessor: (event: Model.Event) => event.title,
      onView: handleViewChange,
      onNavigate: handleNavigate,
      onDoubleClickEvent: handleDoubleClickEvent,
      onSelectSlot: handleEventSelect,
      // Add custom components configuration
      components: {
        toolbar: CustomToolbar,
        event: EventComponent,
        agenda: {
          event: EventComponent,
          date: ({day}: {day: Date}) => moment(day).format('M月D日'),
        },
      },
    };
  }, [
    select,
    localizer,
    calendarFormats,
    calendarMessages,
    events,
    calendarDate,
    resize,
    calendarView,
    visibleTimeRange,
    styleEvents,
    calendarPopup,
    onEventDrop,
    onEventResize,
    onDragStart,
    onDropFromOutside,
    dragFromOutsideItem,
    endAccessor,
    handleViewChange,
    handleNavigate,
    handleDoubleClickEvent,
    handleEventSelect,
  ]);

  return (
    <div className={`calendar-container calendar-view-${calendarView}`}>
      <DragAndDropCalendar key={`${StartDate}-${VisibleStartTime}-${VisibleEndTime}`} {...calendarProps} />
    </div>
  );
});

export default memo(CalendarComponent);
