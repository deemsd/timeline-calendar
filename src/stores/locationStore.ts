import {create} from 'zustand';

// Define the state interface
export interface LocationState extends AppLocation {
  setQuery: (query: Query) => void;
  setQueryFilter: (filter: string) => void;
  setTagQuery: (tag: string) => void;
  setDurationQuery: (duration: TDuration | null) => void;
  setEventType: (eventType: EventSpecType | '') => void;
  setText: (text: string) => void;
  setHash: (hash: string) => void;
}

// Create the store using Zustand
const useLocationStore = create<LocationState>((set, get) => ({
  hash: '',
  query: {
    tag: '',
    duration: null,
    text: '',
    eventType: '',
    filter: '',
  },

  setQuery: (query) => {
    // Only update if query has changed
    const currentQuery = get().query;
    if (JSON.stringify(query) !== JSON.stringify(currentQuery)) {
      set((state) => ({
        ...state,
        query,
      }));
    }
  },

  setQueryFilter: (filter) => {
    // Only update if filter has changed
    const currentFilter = get().query.filter;
    if (filter !== currentFilter) {
      set((state) => ({
        ...state,
        query: {
          ...state.query,
          filter,
        },
      }));
    }
  },

  setTagQuery: (tag) => {
    // Only update if tag has changed
    const currentTag = get().query.tag;
    if (tag !== currentTag) {
      set((state) => ({
        ...state,
        query: {
          ...state.query,
          tag,
        },
      }));
    }
  },

  setDurationQuery: (duration) => {
    // Only update if duration has changed
    const currentDuration = get().query.duration;
    const durationJson = JSON.stringify(duration);
    const currentDurationJson = JSON.stringify(currentDuration);

    if (durationJson !== currentDurationJson) {
      set((state) => ({
        ...state,
        query: {
          ...state.query,
          duration,
        },
      }));
    }
  },

  setEventType: (eventType) => {
    // Only update if type has changed
    const currentEventType = get().query.eventType;
    if (eventType !== currentEventType) {
      set((state) => ({
        ...state,
        query: {
          ...state.query,
          eventType,
        },
      }));
    }
  },

  setText: (text) => {
    // Only update if text has changed
    const currentText = get().query.text;
    if (text !== currentText) {
      set((state) => ({
        ...state,
        query: {
          ...state.query,
          text,
        },
      }));
    }
  },

  setHash: (hash) => {
    // Only update if hash has changed
    const currentHash = get().hash;
    if (hash !== currentHash) {
      set((state) => ({
        ...state,
        hash,
      }));
    }
  },

}));

export default useLocationStore;
