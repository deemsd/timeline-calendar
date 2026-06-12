import {create} from 'zustand';
import {View} from 'react-big-calendar';
import {App, moment} from 'obsidian';
import globalService from '@/services/globalService';

const VIEW_CACHE_KEY = 'viewCache';
const DATE_CACHE_KEY = 'currentDate';

// Define the Calendar state interface
export interface CalendarState {
  // State properties
  calendarView: View;
  calendarDate: Date;
  selectable: boolean;
  resizable: boolean;
  calendarPopup: boolean;
  startDay: 'sunday' | 'monday';
  isLoading: boolean;

  // Actions
  setCalendarView: (view: View) => void;
  setCalendarDate: (date: Date) => void;
  setSelectable: (selectable: boolean) => void;
  setResizable: (resizable: boolean) => void;
  setCalendarPopup: (popup: boolean) => void;
  setStartDay: (startDay: 'sunday' | 'monday') => void;
  setLoading: (isLoading: boolean) => void;

  // Storage-related actions (now backed by the Obsidian plugin data API)
  saveCalendarView: (app: App, view?: View) => Promise<void>;
  saveCalendarDate: (app: App, date?: Date) => Promise<void>;
  loadStoredPreferences: (app: App) => Promise<void>;
}

// Create the store
const useCalendarStore = create<CalendarState>((set, get) => ({
  // Initial state
  calendarView: 'month',
  calendarDate: new Date(),
  selectable: true,
  resizable: true,
  calendarPopup: true,
  startDay: 'monday',
  isLoading: true,

  setCalendarView: (view) => {
    // Only update if the view has changed
    if (get().calendarView !== view) {
      set({calendarView: view});
    }
  },

  setCalendarDate: (date) => {
    // Only update if the date has changed
    const currentDate = get().calendarDate;
    if (!currentDate || !date || currentDate.getTime() !== date.getTime()) {
      set({calendarDate: date});
    }
  },

  setSelectable: (selectable) => {
    if (get().selectable !== selectable) {
      set({selectable});
    }
  },

  setResizable: (resizable) => {
    if (get().resizable !== resizable) {
      set({resizable});
    }
  },

  setCalendarPopup: (popup) => {
    if (get().calendarPopup !== popup) {
      set({calendarPopup: popup});
    }
  },

  setStartDay: (startDay) => {
    const dow = startDay === 'sunday' ? 0 : 1;
    const currentLocale = moment.locale();

    // React Big Calendar reads week starts through moment's locale data.
    // Obsidian commonly runs under zh-cn, so updating only "en" is not enough.
    [currentLocale, 'en', 'zh-cn', 'zh'].forEach((locale) => {
      moment.updateLocale(locale, {week: {dow}});
    });

    if (get().startDay !== startDay) {
      set({startDay});
    }
  },

  setLoading: (isLoading) => {
    if (get().isLoading !== isLoading) {
      set({isLoading});
    }
  },

  // Storage-related actions: persist via Obsidian plugin data API.
  saveCalendarView: async (_app, view) => {
    const plugin = globalService.getPlugin();
    if (!plugin) return;
    try {
      const cache = await plugin.loadCache();
      cache[VIEW_CACHE_KEY] = view ?? get().calendarView;
      await plugin.saveCache(cache);
    } catch (error) {
      console.error('Failed to save calendar view', error);
    }
  },

  saveCalendarDate: async (_app, date) => {
    const plugin = globalService.getPlugin();
    if (!plugin) return;
    try {
      const cache = await plugin.loadCache();
      cache[DATE_CACHE_KEY] = (date ?? get().calendarDate).toISOString();
      await plugin.saveCache(cache);
    } catch (error) {
      console.error('Failed to save calendar date', error);
    }
  },

  loadStoredPreferences: async (_app) => {
    const plugin = globalService.getPlugin();
    if (!plugin) return;
    try {
      const cache = await plugin.loadCache();

      const cachedView = cache[VIEW_CACHE_KEY];
      if (typeof cachedView === 'string') {
        const view = cachedView as View;
        if (view !== get().calendarView) {
          set({calendarView: view});
        }
      }

      const cachedDate = cache[DATE_CACHE_KEY];
      if (typeof cachedDate === 'string' || typeof cachedDate === 'number') {
        const date = new Date(cachedDate);
        if (!isNaN(date.getTime())) {
          const currentDate = get().calendarDate;
          if (!currentDate || currentDate.getTime() !== date.getTime()) {
            set({calendarDate: date});
          }
        }
      }
    } catch (error) {
      console.error('Failed to load stored preferences', error);
    }
  },
}));

export default useCalendarStore;
