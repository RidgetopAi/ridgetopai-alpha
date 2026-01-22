/**
 * Context Store - State Management for Mandrel Context Browser
 *
 * Manages browsing, searching, and viewing institutional memory contexts.
 */

import { create } from 'zustand';
import type {
  MandrelContext,
  MandrelContextType,
  ContextStats,
} from '../lib/types/context';
import {
  searchContexts,
  getRecentContexts,
  getContextStats,
  getContextById,
  checkMandrelConnection,
} from '../lib/api/contextApi';

interface ContextStore {
  // State
  contexts: MandrelContext[];
  selectedContext: MandrelContext | null;
  stats: ContextStats | null;
  isLoading: boolean;
  isConnected: boolean;
  error: string | null;

  // Filters
  searchQuery: string;
  typeFilter: MandrelContextType | 'all';
  tagFilter: string | null;

  // View mode
  viewMode: 'recent' | 'search';

  // Actions - Data Loading
  loadRecentContexts: (limit?: number) => Promise<void>;
  searchContexts: (query: string, type?: MandrelContextType) => Promise<void>;
  loadStats: () => Promise<void>;
  checkConnection: () => Promise<void>;
  refreshData: () => Promise<void>;

  // Actions - Selection
  selectContext: (context: MandrelContext | null) => void;
  loadContextById: (id: string) => Promise<void>;

  // Actions - Filters
  setSearchQuery: (query: string) => void;
  setTypeFilter: (type: MandrelContextType | 'all') => void;
  setTagFilter: (tag: string | null) => void;
  clearFilters: () => void;

  // Actions - View
  setViewMode: (mode: 'recent' | 'search') => void;
  clearError: () => void;
}

export const useContextStore = create<ContextStore>((set, get) => ({
  contexts: [],
  selectedContext: null,
  stats: null,
  isLoading: false,
  isConnected: false,
  error: null,
  searchQuery: '',
  typeFilter: 'all',
  tagFilter: null,
  viewMode: 'recent',

  loadRecentContexts: async (limit = 30) => {
    set({ isLoading: true, error: null, viewMode: 'recent' });

    try {
      const response = await getRecentContexts(limit);

      if (response.success) {
        set({
          contexts: response.contexts,
          isLoading: false,
          isConnected: true,
        });
      } else {
        set({
          error: response.error || 'Failed to load contexts',
          isLoading: false,
        });
      }
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Unknown error',
        isLoading: false,
      });
    }
  },

  searchContexts: async (query, type) => {
    if (!query.trim()) {
      get().loadRecentContexts();
      return;
    }

    set({ isLoading: true, error: null, viewMode: 'search', searchQuery: query });

    try {
      const response = await searchContexts(query, {
        type,
        limit: 30,
      });

      if (response.success) {
        set({
          contexts: response.contexts,
          isLoading: false,
          isConnected: true,
        });
      } else {
        set({
          error: response.error || 'Search failed',
          isLoading: false,
        });
      }
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Unknown error',
        isLoading: false,
      });
    }
  },

  loadStats: async () => {
    try {
      const response = await getContextStats();

      if (response.success && response.stats) {
        set({ stats: response.stats });
      }
    } catch (error) {
      console.error('Failed to load stats:', error);
    }
  },

  checkConnection: async () => {
    const connected = await checkMandrelConnection();
    set({ isConnected: connected });
  },

  refreshData: async () => {
    const { viewMode, searchQuery, typeFilter } = get();

    if (viewMode === 'search' && searchQuery) {
      await get().searchContexts(
        searchQuery,
        typeFilter !== 'all' ? typeFilter : undefined
      );
    } else {
      await get().loadRecentContexts();
    }

    await get().loadStats();
  },

  selectContext: (context) => {
    set({ selectedContext: context });
  },

  loadContextById: async (id) => {
    set({ isLoading: true });

    try {
      const response = await getContextById(id);

      if (response.success && response.context) {
        set({
          selectedContext: response.context,
          isLoading: false,
        });
      } else {
        set({
          error: response.error || 'Context not found',
          isLoading: false,
        });
      }
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Unknown error',
        isLoading: false,
      });
    }
  },

  setSearchQuery: (searchQuery) => set({ searchQuery }),

  setTypeFilter: (typeFilter) => set({ typeFilter }),

  setTagFilter: (tagFilter) => set({ tagFilter }),

  clearFilters: () =>
    set({
      searchQuery: '',
      typeFilter: 'all',
      tagFilter: null,
    }),

  setViewMode: (viewMode) => set({ viewMode }),

  clearError: () => set({ error: null }),
}));
