/**
 * Queue Store - Unified Task Queue State Management
 *
 * Provides a filtered, aggregated view of all tasks across orchestration sessions.
 * Enables filtering by status, type, priority, and capability.
 */

import { create } from 'zustand';
import type {
  GeneratedTask,
  OrchTaskStatus,
  TaskType,
  Priority,
} from '../lib/types/orchestration';
import { TASK_TYPE_CAPABILITY } from '../lib/types/orchestration';

// Capability type for filtering
export type Capability = 'PRODUCE' | 'GROW' | 'OPERATE' | 'INTERNAL' | 'all';

// Sort options
export type SortBy = 'priority' | 'status' | 'type' | 'created';
export type SortOrder = 'asc' | 'desc';

// Extended task with session context
export interface QueueTask extends GeneratedTask {
  sessionId: string;
  sessionIntent: string;
}

interface QueueFilters {
  status: OrchTaskStatus | 'all';
  type: TaskType | 'all';
  priority: Priority | 'all';
  capability: Capability;
  search: string;
}

interface QueueStore {
  // Filters
  filters: QueueFilters;
  sortBy: SortBy;
  sortOrder: SortOrder;

  // Derived state (computed from orchestration store)
  selectedTaskId: string | null;

  // Actions - Filters
  setStatusFilter: (status: OrchTaskStatus | 'all') => void;
  setTypeFilter: (type: TaskType | 'all') => void;
  setPriorityFilter: (priority: Priority | 'all') => void;
  setCapabilityFilter: (capability: Capability) => void;
  setSearch: (search: string) => void;
  clearFilters: () => void;

  // Actions - Sorting
  setSortBy: (sortBy: SortBy) => void;
  toggleSortOrder: () => void;

  // Actions - Selection
  selectTask: (taskId: string | null) => void;

  // Utility - Filter tasks
  filterTasks: (tasks: QueueTask[]) => QueueTask[];
  sortTasks: (tasks: QueueTask[]) => QueueTask[];
}

const defaultFilters: QueueFilters = {
  status: 'all',
  type: 'all',
  priority: 'all',
  capability: 'all',
  search: '',
};

export const useQueueStore = create<QueueStore>((set, get) => ({
  filters: defaultFilters,
  sortBy: 'priority',
  sortOrder: 'desc',
  selectedTaskId: null,

  setStatusFilter: (status) =>
    set((state) => ({ filters: { ...state.filters, status } })),

  setTypeFilter: (type) =>
    set((state) => ({ filters: { ...state.filters, type } })),

  setPriorityFilter: (priority) =>
    set((state) => ({ filters: { ...state.filters, priority } })),

  setCapabilityFilter: (capability) =>
    set((state) => ({ filters: { ...state.filters, capability } })),

  setSearch: (search) =>
    set((state) => ({ filters: { ...state.filters, search } })),

  clearFilters: () => set({ filters: defaultFilters }),

  setSortBy: (sortBy) => set({ sortBy }),

  toggleSortOrder: () =>
    set((state) => ({ sortOrder: state.sortOrder === 'asc' ? 'desc' : 'asc' })),

  selectTask: (taskId) => set({ selectedTaskId: taskId }),

  filterTasks: (tasks) => {
    const { filters } = get();

    return tasks.filter((task) => {
      // Status filter
      if (filters.status !== 'all' && task.status !== filters.status) {
        return false;
      }

      // Type filter
      if (filters.type !== 'all' && task.type !== filters.type) {
        return false;
      }

      // Priority filter
      if (filters.priority !== 'all' && task.priority !== filters.priority) {
        return false;
      }

      // Capability filter
      if (filters.capability !== 'all') {
        const taskCapability = TASK_TYPE_CAPABILITY[task.type] ?? 'INTERNAL';
        if (taskCapability !== filters.capability) {
          return false;
        }
      }

      // Search filter
      if (filters.search) {
        const searchLower = filters.search.toLowerCase();
        const matchesTitle = task.title.toLowerCase().includes(searchLower);
        const matchesDescription = task.description.toLowerCase().includes(searchLower);
        const matchesIntent = task.sessionIntent.toLowerCase().includes(searchLower);
        if (!matchesTitle && !matchesDescription && !matchesIntent) {
          return false;
        }
      }

      return true;
    });
  },

  sortTasks: (tasks) => {
    const { sortBy, sortOrder } = get();

    const priorityOrder: Record<Priority, number> = { high: 3, medium: 2, low: 1 };
    const statusOrder: Record<OrchTaskStatus, number> = {
      running: 5,
      dispatched: 4,
      pending: 3,
      completed: 2,
      failed: 1,
    };

    const sorted = [...tasks].sort((a, b) => {
      let comparison = 0;

      switch (sortBy) {
        case 'priority':
          comparison = priorityOrder[a.priority] - priorityOrder[b.priority];
          break;
        case 'status':
          comparison = statusOrder[a.status] - statusOrder[b.status];
          break;
        case 'type':
          comparison = a.type.localeCompare(b.type);
          break;
        case 'created':
          // Use startedAt if available, otherwise compare by ID
          const aTime = a.startedAt ? new Date(a.startedAt).getTime() : 0;
          const bTime = b.startedAt ? new Date(b.startedAt).getTime() : 0;
          comparison = aTime - bTime;
          break;
      }

      return sortOrder === 'desc' ? -comparison : comparison;
    });

    return sorted;
  },
}));
