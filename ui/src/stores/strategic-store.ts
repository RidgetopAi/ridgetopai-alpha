/**
 * Strategic Store - State Management for Strategic Layer
 * Phase 4: Recommendation Engine UI State
 */

import { create } from 'zustand';
import type {
  Recommendation,
  RecommendationStats,
  RecommendationType,
  RecommendationPriority,
  RecommendationStatus,
} from '../lib/types/strategic';
import {
  listRecommendations,
  getPendingRecommendations,
  getExpiringRecommendations,
  getRecommendation,
  getRecommendationStats,
  generateRecommendations,
  acceptRecommendation as acceptRecommendationApi,
  rejectRecommendation as rejectRecommendationApi,
  deferRecommendation as deferRecommendationApi,
} from '../lib/api/strategic';

// ============================================
// Filter State
// ============================================

export interface RecommendationFilters {
  status?: RecommendationStatus;
  priority?: RecommendationPriority;
  type?: RecommendationType;
  minConfidence?: number;
}

// ============================================
// Store Interface
// ============================================

interface StrategicStore {
  // Recommendations State
  recommendations: Recommendation[];
  selectedRecommendation: Recommendation | null;
  stats: RecommendationStats | null;
  filters: RecommendationFilters;

  // UI State
  isLoading: boolean;
  isGenerating: boolean;
  error: string | null;

  // Modal State
  showAcceptModal: boolean;
  showRejectModal: boolean;
  showDeferModal: boolean;
  showDetailModal: boolean;
  modalRecommendationId: string | null;

  // Last Generation Result
  lastGenerationResult: {
    recommendationsCreated: number;
    patternsAnalyzed: number;
    goalsConsidered: number;
    insights: string[];
    warnings: string[];
  } | null;

  // Actions - Data Loading
  loadRecommendations: () => Promise<void>;
  loadPendingRecommendations: () => Promise<void>;
  loadExpiringRecommendations: (hours?: number) => Promise<void>;
  loadStats: () => Promise<void>;
  loadRecommendation: (id: string) => Promise<void>;

  // Actions - Filtering
  setFilters: (filters: Partial<RecommendationFilters>) => void;
  clearFilters: () => void;

  // Actions - Generation
  triggerGeneration: () => Promise<void>;

  // Actions - Recommendation Actions
  acceptRecommendation: (id: string, feedbackText?: string, feedbackRating?: number, triggerOrchestration?: boolean) => Promise<string | undefined>;
  rejectRecommendation: (id: string, feedbackText?: string, feedbackRating?: number) => Promise<void>;
  deferRecommendation: (id: string, deferUntil: Date, feedbackText?: string) => Promise<void>;

  // Actions - Selection
  selectRecommendation: (id: string | null) => void;

  // Actions - Modals
  openAcceptModal: (id: string) => void;
  openRejectModal: (id: string) => void;
  openDeferModal: (id: string) => void;
  openDetailModal: (id: string) => void;
  closeModals: () => void;

  // Actions - Error Handling
  clearError: () => void;
}

// ============================================
// Store Implementation
// ============================================

export const useStrategicStore = create<StrategicStore>((set, get) => ({
  // Initial State
  recommendations: [],
  selectedRecommendation: null,
  stats: null,
  filters: {},
  isLoading: false,
  isGenerating: false,
  error: null,
  showAcceptModal: false,
  showRejectModal: false,
  showDeferModal: false,
  showDetailModal: false,
  modalRecommendationId: null,
  lastGenerationResult: null,

  // Load all recommendations with current filters
  loadRecommendations: async () => {
    set({ isLoading: true, error: null });

    try {
      const { filters } = get();
      const response = await listRecommendations({
        status: filters.status,
        priority: filters.priority,
        type: filters.type,
        minConfidence: filters.minConfidence,
        limit: 100,
        orderBy: 'priority',
        orderDir: 'ASC',
      });

      if (!response.success) {
        throw new Error(response.error || 'Failed to load recommendations');
      }

      set({ recommendations: response.recommendations, isLoading: false });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to load recommendations',
        isLoading: false,
      });
    }
  },

  // Load only pending recommendations (for dashboard widget)
  loadPendingRecommendations: async () => {
    set({ isLoading: true, error: null });

    try {
      const response = await getPendingRecommendations(20);

      if (!response.success) {
        throw new Error(response.error || 'Failed to load pending recommendations');
      }

      set({ recommendations: response.recommendations, isLoading: false });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to load pending recommendations',
        isLoading: false,
      });
    }
  },

  // Load recommendations expiring soon
  loadExpiringRecommendations: async (hours = 24) => {
    set({ isLoading: true, error: null });

    try {
      const response = await getExpiringRecommendations(hours);

      if (!response.success) {
        throw new Error(response.error || 'Failed to load expiring recommendations');
      }

      set({ recommendations: response.recommendations, isLoading: false });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to load expiring recommendations',
        isLoading: false,
      });
    }
  },

  // Load statistics
  loadStats: async () => {
    try {
      const response = await getRecommendationStats();

      if (!response.success) {
        throw new Error(response.error || 'Failed to load stats');
      }

      set({ stats: response.stats || null });
    } catch (error) {
      console.error('Failed to load recommendation stats:', error);
    }
  },

  // Load single recommendation by ID
  loadRecommendation: async (id: string) => {
    try {
      const response = await getRecommendation(id);

      if (!response.success || !response.recommendation) {
        throw new Error(response.error || 'Recommendation not found');
      }

      set({ selectedRecommendation: response.recommendation });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to load recommendation',
      });
    }
  },

  // Set filters
  setFilters: (newFilters) => {
    set((state) => ({
      filters: { ...state.filters, ...newFilters },
    }));
    // Reload with new filters
    get().loadRecommendations();
  },

  // Clear filters
  clearFilters: () => {
    set({ filters: {} });
    get().loadRecommendations();
  },

  // Trigger recommendation generation
  triggerGeneration: async () => {
    set({ isGenerating: true, error: null });

    try {
      const response = await generateRecommendations();

      if (!response.success || !response.result) {
        throw new Error(response.error || 'Generation failed');
      }

      set({
        lastGenerationResult: {
          recommendationsCreated: response.result.recommendationsCreated,
          patternsAnalyzed: response.result.patternsAnalyzed,
          goalsConsidered: response.result.goalsConsidered,
          insights: response.result.insights,
          warnings: response.result.warnings,
        },
        isGenerating: false,
      });

      // Reload recommendations if new ones were created
      if (response.result.recommendationsCreated > 0) {
        await get().loadRecommendations();
        await get().loadStats();
      }
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Generation failed',
        isGenerating: false,
      });
    }
  },

  // Accept a recommendation
  acceptRecommendation: async (id, feedbackText, feedbackRating, triggerOrchestration) => {
    try {
      const response = await acceptRecommendationApi(id, {
        feedbackText,
        feedbackRating,
        triggerOrchestration,
      });

      if (!response.success) {
        throw new Error(response.error || 'Failed to accept recommendation');
      }

      // Update local state
      set((state) => ({
        recommendations: state.recommendations.map((r) =>
          r.id === id && response.recommendation ? response.recommendation : r
        ),
        selectedRecommendation:
          state.selectedRecommendation?.id === id
            ? response.recommendation || state.selectedRecommendation
            : state.selectedRecommendation,
      }));

      // Reload stats
      get().loadStats();

      return response.sessionId;
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to accept recommendation',
      });
      return undefined;
    }
  },

  // Reject a recommendation
  rejectRecommendation: async (id, feedbackText, feedbackRating) => {
    try {
      const response = await rejectRecommendationApi(id, {
        feedbackText,
        feedbackRating,
      });

      if (!response.success) {
        throw new Error(response.error || 'Failed to reject recommendation');
      }

      // Update local state
      set((state) => ({
        recommendations: state.recommendations.map((r) =>
          r.id === id && response.recommendation ? response.recommendation : r
        ),
        selectedRecommendation:
          state.selectedRecommendation?.id === id
            ? response.recommendation || state.selectedRecommendation
            : state.selectedRecommendation,
      }));

      // Reload stats
      get().loadStats();
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to reject recommendation',
      });
    }
  },

  // Defer a recommendation
  deferRecommendation: async (id, deferUntil, feedbackText) => {
    try {
      const response = await deferRecommendationApi(id, {
        deferUntil: deferUntil.toISOString(),
        feedbackText,
      });

      if (!response.success) {
        throw new Error(response.error || 'Failed to defer recommendation');
      }

      // Update local state
      set((state) => ({
        recommendations: state.recommendations.map((r) =>
          r.id === id && response.recommendation ? response.recommendation : r
        ),
        selectedRecommendation:
          state.selectedRecommendation?.id === id
            ? response.recommendation || state.selectedRecommendation
            : state.selectedRecommendation,
      }));

      // Reload stats
      get().loadStats();
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to defer recommendation',
      });
    }
  },

  // Select a recommendation
  selectRecommendation: (id) => {
    if (id === null) {
      set({ selectedRecommendation: null });
      return;
    }

    const recommendation = get().recommendations.find((r) => r.id === id);
    set({ selectedRecommendation: recommendation || null });
  },

  // Modal controls
  openAcceptModal: (id) => {
    set({ showAcceptModal: true, modalRecommendationId: id });
  },

  openRejectModal: (id) => {
    set({ showRejectModal: true, modalRecommendationId: id });
  },

  openDeferModal: (id) => {
    set({ showDeferModal: true, modalRecommendationId: id });
  },

  openDetailModal: (id) => {
    set({ showDetailModal: true, modalRecommendationId: id });
    get().loadRecommendation(id);
  },

  closeModals: () => {
    set({
      showAcceptModal: false,
      showRejectModal: false,
      showDeferModal: false,
      showDetailModal: false,
      modalRecommendationId: null,
    });
  },

  // Clear error
  clearError: () => {
    set({ error: null });
  },
}));
