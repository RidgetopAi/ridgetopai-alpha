/**
 * History Store - State Management for Completed Workflows Timeline
 *
 * Manages the view state for browsing completed workflows with time-based grouping.
 * Focuses on historical analysis rather than operational management.
 */

import { create } from 'zustand';

// Time range filter options
export type TimeRange = 'all' | 'today' | 'week' | 'month';

// Group by options for timeline
export type GroupBy = 'day' | 'week' | 'month';

interface HistoryStore {
  // View state
  selectedSessionId: string | null;
  timeRange: TimeRange;
  groupBy: GroupBy;
  searchQuery: string;
  includeFailedOnly: boolean;

  // Actions - Selection
  selectSession: (sessionId: string | null) => void;

  // Actions - Filtering
  setTimeRange: (range: TimeRange) => void;
  setGroupBy: (groupBy: GroupBy) => void;
  setSearchQuery: (query: string) => void;
  setIncludeFailedOnly: (include: boolean) => void;
  clearFilters: () => void;
}

export const useHistoryStore = create<HistoryStore>((set) => ({
  selectedSessionId: null,
  timeRange: 'all',
  groupBy: 'day',
  searchQuery: '',
  includeFailedOnly: false,

  selectSession: (sessionId) => set({ selectedSessionId: sessionId }),

  setTimeRange: (timeRange) => set({ timeRange }),

  setGroupBy: (groupBy) => set({ groupBy }),

  setSearchQuery: (searchQuery) => set({ searchQuery }),

  setIncludeFailedOnly: (includeFailedOnly) => set({ includeFailedOnly }),

  clearFilters: () =>
    set({
      timeRange: 'all',
      searchQuery: '',
      includeFailedOnly: false,
    }),
}));
