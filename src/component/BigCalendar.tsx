import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {fileService, eventService} from '@/services';
import {Notice} from 'obsidian';
import CalendarComponent, {EventRefActions} from '@/component/Calendar/Calendar';
import {SlotInfo} from 'react-big-calendar';
import {showEventInDailyNotes} from '@/obComponents/showEvent';
import {useApp} from '@/hooks/useStore';
import useCalendarStore from '@/stores/calendarStore';
import useGlobalStateStore from '@/stores/globalStateStore';
import {EventCreateResult} from '@/obComponents/EventCreatePrompt';
import {DEFAULT_SETTINGS} from '@/setting';

type Props = Record<string, never>;

const BigCalendar: React.FC<Props> = () => {
  const app = useApp();
  const [isLoading, setIsLoading] = useState(true);
  const eventRef = useRef<EventRefActions>(null);

  // Fine-grained selectors: BigCalendar 仅依赖 calendarView 与 startDay，
  // 拆分订阅可避免 calendarDate / isLoading 等无关字段变化导致重渲染。
  const calendarView = useCalendarStore((state) => state.calendarView);
  const startDay = useCalendarStore((state) => state.startDay);
  const setStartDay = useCalendarStore((state) => state.setStartDay);
  const pluginSetting = useGlobalStateStore((state) => state.pluginSetting);

  useEffect(() => {
    const settingsStartDay = pluginSetting?.StartDate === 'monday' ? 'monday' : 'sunday';
    setStartDay(settingsStartDay);
  }, [pluginSetting?.StartDate, setStartDay]);

  // Fetch data only once when component mounts
  useEffect(() => {
    let isMounted = true;
    const fetchData = async () => {
      try {
        await Promise.all([eventService.fetchAllEvents(app), fileService.getMyAllDailyNotes()]);

        if (isMounted) {
          setIsLoading(false);
        }
      } catch (err) {
        console.error(err);
        if (isMounted) {
          new Notice('Failed to fetch data');
          setIsLoading(false);
        }
      }
    };

    void fetchData();

    // Cleanup function to prevent state updates if component unmounts
    return () => {
      isMounted = false;
    };
  }, []);

  // Handle event double click
  const handleEventDoubleClick = useCallback(async (event: Model.Event) => {
    await showEventInDailyNotes(event.id);
  }, []);

  // Handle event creation
  const handleEventSelect = useCallback(async (event: EventCreateResult, slotInfo: SlotInfo) => {
    try {
      const newEvent = await eventService.createEvent(event.content, event.startDate, event.endDate);
      eventService.pushEvent(newEvent);
    } catch (err) {
      console.error(err);
    }
  }, []);

  // Memoize calendar config
  const calendarConfig = useMemo(
    () => ({
      selectable: true,
      resizeable: true,
      StartDate: startDay,
      VisibleStartTime: pluginSetting?.VisibleStartTime ?? DEFAULT_SETTINGS.VisibleStartTime,
      VisibleEndTime: pluginSetting?.VisibleEndTime ?? DEFAULT_SETTINGS.VisibleEndTime,
      defaultView: calendarView,
      popup: true,
      onEventDoubleClick: handleEventDoubleClick,
      onEventSelect: handleEventSelect,
    }),
    [
      handleEventDoubleClick,
      handleEventSelect,
      calendarView,
      startDay,
      pluginSetting?.VisibleStartTime,
      pluginSetting?.VisibleEndTime,
    ],
  );

  return (
    <div className="timeline-calendar-wrapper">
      {isLoading ? <div>Loading...</div> : <CalendarComponent ref={eventRef} {...calendarConfig} />}
    </div>
  );
};

export default BigCalendar;
