/**
 * Event Triggers Store - State Management for Event-Driven Automation
 *
 * Manages CRUD operations for event triggers that respond to
 * webhooks and system events to trigger orchestration sessions.
 */

import { create } from 'zustand';
import type {
  EventTrigger,
  CreateEventTriggerRequest,
  UpdateEventTriggerRequest,
  EventTriggerStats,
  TriggerExecution,
} from '../lib/types/event-triggers';
import {
  listEventTriggers,
  getEventTriggerStats,
  getRecentExecutions,
  createEventTrigger,
  updateEventTrigger,
  deleteEventTrigger,
} from '../lib/api/event-triggers';

interface EventTriggersStore {
  // State
  triggers: EventTrigger[];
  stats: EventTriggerStats;
  executions: TriggerExecution[];
  selectedTrigger: EventTrigger | null;
  isLoading: boolean;
  error: string | null;

  // Actions - Data Loading
  loadTriggers: () => Promise<void>;
  loadExecutions: (limit?: number) => Promise<void>;
  refreshStats: () => Promise<void>;

  // Actions - CRUD
  createTrigger: (request: CreateEventTriggerRequest) => Promise<boolean>;
  updateTrigger: (id: string, updates: UpdateEventTriggerRequest) => Promise<boolean>;
  deleteTrigger: (id: string) => Promise<boolean>;

  // Actions - Selection
  selectTrigger: (id: string | null) => void;
  clearError: () => void;
}

const defaultStats: EventTriggerStats = {
  totalTriggers: 0,
  activeTriggers: 0,
  pausedTriggers: 0,
  disabledTriggers: 0,
  bySource: {},
};

export const useEventTriggersStore = create<EventTriggersStore>((set, get) => ({
  triggers: [],
  stats: defaultStats,
  executions: [],
  selectedTrigger: null,
  isLoading: false,
  error: null,

  loadTriggers: async () => {
    set({ isLoading: true, error: null });

    try {
      const response = await listEventTriggers();
      set({
        triggers: response.triggers,
        stats: response.stats,
        isLoading: false,
      });
      console.log('[EventTriggersStore] Loaded', response.triggers.length, 'triggers');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to load triggers';
      set({ error: errorMessage, isLoading: false });
      console.error('[EventTriggersStore] Load error:', errorMessage);
    }
  },

  loadExecutions: async (limit = 50) => {
    try {
      const executions = await getRecentExecutions(limit);
      set({ executions });
      console.log('[EventTriggersStore] Loaded', executions.length, 'executions');
    } catch (error) {
      console.error('[EventTriggersStore] Executions load error:', error);
    }
  },

  refreshStats: async () => {
    try {
      const stats = await getEventTriggerStats();
      set({ stats });
    } catch (error) {
      console.error('[EventTriggersStore] Stats refresh error:', error);
    }
  },

  createTrigger: async (request) => {
    set({ isLoading: true, error: null });

    try {
      const response = await createEventTrigger(request);

      if (response.success && response.trigger) {
        set((state) => ({
          triggers: [response.trigger!, ...state.triggers],
          isLoading: false,
        }));
        await get().refreshStats();
        console.log('[EventTriggersStore] Created trigger:', response.trigger.name);
        return true;
      } else {
        set({ error: response.error || 'Failed to create trigger', isLoading: false });
        return false;
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to create trigger';
      set({ error: errorMessage, isLoading: false });
      return false;
    }
  },

  updateTrigger: async (id, updates) => {
    set({ isLoading: true, error: null });

    try {
      const response = await updateEventTrigger(id, updates);

      if (response.success && response.trigger) {
        set((state) => ({
          triggers: state.triggers.map((t) =>
            t.id === id ? response.trigger! : t
          ),
          selectedTrigger:
            state.selectedTrigger?.id === id
              ? response.trigger!
              : state.selectedTrigger,
          isLoading: false,
        }));
        await get().refreshStats();
        console.log('[EventTriggersStore] Updated trigger:', id);
        return true;
      } else {
        set({ error: response.error || 'Failed to update trigger', isLoading: false });
        return false;
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to update trigger';
      set({ error: errorMessage, isLoading: false });
      return false;
    }
  },

  deleteTrigger: async (id) => {
    set({ isLoading: true, error: null });

    try {
      const response = await deleteEventTrigger(id);

      if (response.success) {
        set((state) => ({
          triggers: state.triggers.filter((t) => t.id !== id),
          selectedTrigger:
            state.selectedTrigger?.id === id ? null : state.selectedTrigger,
          isLoading: false,
        }));
        await get().refreshStats();
        console.log('[EventTriggersStore] Deleted trigger:', id);
        return true;
      } else {
        set({ error: response.error || 'Failed to delete trigger', isLoading: false });
        return false;
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to delete trigger';
      set({ error: errorMessage, isLoading: false });
      return false;
    }
  },

  selectTrigger: (id) => {
    if (!id) {
      set({ selectedTrigger: null });
      return;
    }

    const trigger = get().triggers.find((t) => t.id === id);
    set({ selectedTrigger: trigger || null });
  },

  clearError: () => {
    set({ error: null });
  },
}));
