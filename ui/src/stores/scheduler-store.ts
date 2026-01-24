/**
 * Scheduler Store - State Management for Scheduled Tasks
 *
 * Manages CRUD operations for scheduled tasks that trigger
 * orchestration sessions on cron patterns.
 */

import { create } from 'zustand';
import type {
  ScheduledTask,
  CreateScheduleRequest,
  UpdateScheduleRequest,
  SchedulerStats,
} from '../lib/types/scheduler';
import {
  listSchedules,
  getSchedulerStats,
  createSchedule,
  updateSchedule,
  deleteSchedule,
  triggerSchedule,
} from '../lib/api/scheduler';

interface SchedulerStore {
  // State
  schedules: ScheduledTask[];
  stats: SchedulerStats;
  selectedSchedule: ScheduledTask | null;
  isLoading: boolean;
  error: string | null;

  // Actions - Data Loading
  loadSchedules: () => Promise<void>;
  refreshStats: () => Promise<void>;

  // Actions - CRUD
  createSchedule: (request: CreateScheduleRequest) => Promise<boolean>;
  updateSchedule: (id: string, updates: UpdateScheduleRequest) => Promise<boolean>;
  deleteSchedule: (id: string) => Promise<boolean>;

  // Actions - Execution
  triggerSchedule: (id: string) => Promise<string | null>;

  // Actions - Selection
  selectSchedule: (id: string | null) => void;
  clearError: () => void;
}

const defaultStats: SchedulerStats = {
  totalTasks: 0,
  activeTasks: 0,
  pausedTasks: 0,
  disabledTasks: 0,
  runningJobs: 0,
};

export const useSchedulerStore = create<SchedulerStore>((set, get) => ({
  schedules: [],
  stats: defaultStats,
  selectedSchedule: null,
  isLoading: false,
  error: null,

  loadSchedules: async () => {
    set({ isLoading: true, error: null });

    try {
      const response = await listSchedules();
      set({
        schedules: response.schedules,
        stats: response.stats,
        isLoading: false,
      });
      console.log('[SchedulerStore] Loaded', response.schedules.length, 'schedules');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to load schedules';
      set({ error: errorMessage, isLoading: false });
      console.error('[SchedulerStore] Load error:', errorMessage);
    }
  },

  refreshStats: async () => {
    try {
      const stats = await getSchedulerStats();
      set({ stats });
    } catch (error) {
      console.error('[SchedulerStore] Stats refresh error:', error);
    }
  },

  createSchedule: async (request) => {
    set({ isLoading: true, error: null });

    try {
      const response = await createSchedule(request);

      if (response.success && response.schedule) {
        set((state) => ({
          schedules: [response.schedule!, ...state.schedules],
          isLoading: false,
        }));
        await get().refreshStats();
        console.log('[SchedulerStore] Created schedule:', response.schedule.name);
        return true;
      } else {
        set({ error: response.error || 'Failed to create schedule', isLoading: false });
        return false;
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to create schedule';
      set({ error: errorMessage, isLoading: false });
      return false;
    }
  },

  updateSchedule: async (id, updates) => {
    set({ isLoading: true, error: null });

    try {
      const response = await updateSchedule(id, updates);

      if (response.success && response.schedule) {
        set((state) => ({
          schedules: state.schedules.map((s) =>
            s.id === id ? response.schedule! : s
          ),
          selectedSchedule:
            state.selectedSchedule?.id === id
              ? response.schedule!
              : state.selectedSchedule,
          isLoading: false,
        }));
        await get().refreshStats();
        console.log('[SchedulerStore] Updated schedule:', id);
        return true;
      } else {
        set({ error: response.error || 'Failed to update schedule', isLoading: false });
        return false;
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to update schedule';
      set({ error: errorMessage, isLoading: false });
      return false;
    }
  },

  deleteSchedule: async (id) => {
    set({ isLoading: true, error: null });

    try {
      const response = await deleteSchedule(id);

      if (response.success) {
        set((state) => ({
          schedules: state.schedules.filter((s) => s.id !== id),
          selectedSchedule:
            state.selectedSchedule?.id === id ? null : state.selectedSchedule,
          isLoading: false,
        }));
        await get().refreshStats();
        console.log('[SchedulerStore] Deleted schedule:', id);
        return true;
      } else {
        set({ error: response.error || 'Failed to delete schedule', isLoading: false });
        return false;
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to delete schedule';
      set({ error: errorMessage, isLoading: false });
      return false;
    }
  },

  triggerSchedule: async (id) => {
    set({ error: null });

    try {
      const response = await triggerSchedule(id);

      if (response.success && response.sessionId) {
        // Refresh to update lastRunAt
        await get().loadSchedules();
        console.log('[SchedulerStore] Triggered schedule:', id, '-> session:', response.sessionId);
        return response.sessionId;
      } else {
        set({ error: response.error || 'Failed to trigger schedule' });
        return null;
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to trigger schedule';
      set({ error: errorMessage });
      return null;
    }
  },

  selectSchedule: (id) => {
    if (!id) {
      set({ selectedSchedule: null });
      return;
    }

    const schedule = get().schedules.find((s) => s.id === id);
    set({ selectedSchedule: schedule || null });
  },

  clearError: () => {
    set({ error: null });
  },
}));
