/**
 * Workflow View Store - State Management for Workflow History View
 *
 * Manages the view state for browsing and filtering orchestration session history.
 */

import { create } from 'zustand';
import type { SessionState } from '../lib/types/orchestration';

// Filter options for workflow list
export type WorkflowFilter = 'all' | SessionState;
export type WorkflowSortBy = 'date' | 'tasks' | 'status';

interface WorkflowViewStore {
  // View state
  selectedSessionId: string | null;
  filter: WorkflowFilter;
  sortBy: WorkflowSortBy;
  sortOrder: 'asc' | 'desc';
  searchQuery: string;
  showCompletedOnly: boolean;
  expandedSessions: Set<string>;

  // Actions - Selection
  selectSession: (sessionId: string | null) => void;

  // Actions - Filtering
  setFilter: (filter: WorkflowFilter) => void;
  setSortBy: (sortBy: WorkflowSortBy) => void;
  toggleSortOrder: () => void;
  setSearchQuery: (query: string) => void;
  setShowCompletedOnly: (show: boolean) => void;
  clearFilters: () => void;

  // Actions - Expansion
  toggleSessionExpanded: (sessionId: string) => void;
  expandAll: () => void;
  collapseAll: () => void;
}

export const useWorkflowViewStore = create<WorkflowViewStore>((set) => ({
  selectedSessionId: null,
  filter: 'all',
  sortBy: 'date',
  sortOrder: 'desc',
  searchQuery: '',
  showCompletedOnly: false,
  expandedSessions: new Set(),

  selectSession: (sessionId) => set({ selectedSessionId: sessionId }),

  setFilter: (filter) => set({ filter }),

  setSortBy: (sortBy) => set({ sortBy }),

  toggleSortOrder: () =>
    set((state) => ({ sortOrder: state.sortOrder === 'asc' ? 'desc' : 'asc' })),

  setSearchQuery: (searchQuery) => set({ searchQuery }),

  setShowCompletedOnly: (showCompletedOnly) => set({ showCompletedOnly }),

  clearFilters: () =>
    set({
      filter: 'all',
      searchQuery: '',
      showCompletedOnly: false,
    }),

  toggleSessionExpanded: (sessionId) =>
    set((state) => {
      const newExpanded = new Set(state.expandedSessions);
      if (newExpanded.has(sessionId)) {
        newExpanded.delete(sessionId);
      } else {
        newExpanded.add(sessionId);
      }
      return { expandedSessions: newExpanded };
    }),

  expandAll: () =>
    set((state) => {
      // This would need session IDs passed in - handled by component
      return state;
    }),

  collapseAll: () => set({ expandedSessions: new Set() }),
}));
