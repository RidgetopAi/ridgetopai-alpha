import { create } from 'zustand';
import type { ActivityRecord, ActivityMessage, SirkSession } from '../lib/types/activity';

const MAX_ACTIVITIES = 500; // Keep last 500 activities to prevent memory bloat

interface ActivityStore {
  // State
  activities: ActivityRecord[];
  currentSession: SirkSession | null;
  isConnected: boolean;
  connectionError: string | null;

  // Actions
  addActivity: (activity: ActivityMessage) => void;
  setSession: (session: SirkSession | null) => void;
  setConnected: (connected: boolean) => void;
  setConnectionError: (error: string | null) => void;
  clearActivities: () => void;
  getActivitiesByInstance: (instanceNumber: number) => ActivityRecord[];
}

const generateId = () => Math.random().toString(36).substring(2, 11);

export const useActivityStore = create<ActivityStore>((set, get) => ({
  activities: [],
  currentSession: null,
  isConnected: false,
  connectionError: null,

  addActivity: (activity) => {
    const record: ActivityRecord = {
      id: generateId(),
      activity,
      receivedAt: new Date(),
    };

    // Update session from activity if present
    if (activity.session) {
      set({ currentSession: activity.session });
    }

    set((state) => ({
      activities: [...state.activities, record].slice(-MAX_ACTIVITIES),
    }));
  },

  setSession: (session) => set({ currentSession: session }),

  setConnected: (connected) => set({ isConnected: connected }),

  setConnectionError: (error) => set({ connectionError: error }),

  clearActivities: () => set({ activities: [], currentSession: null }),

  getActivitiesByInstance: (instanceNumber) => {
    return get().activities.filter(
      (record) => record.activity.session?.instanceNumber === instanceNumber
    );
  },
}));
