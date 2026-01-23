/**
 * Goals Store - State Management for Strategic Layer Goals
 * Phase 3: Goal Management UI State
 */

import { create } from 'zustand';
import type {
  Goal,
  GoalStats,
  GoalProgress,
  GoalCategory,
  GoalPriority,
  GoalStatus,
  GoalHierarchyNode,
  CreateGoalInput,
  UpdateGoalInput,
} from '../lib/types/strategic';
import {
  listGoals,
  getGoal,
  getGoalStats,
  getGoalHierarchy,
  createGoal as createGoalApi,
  updateGoal as updateGoalApi,
  updateGoalProgress as updateProgressApi,
  deleteGoal as deleteGoalApi,
  linkPatternToGoal as linkPatternApi,
  unlinkPatternFromGoal as unlinkPatternApi,
} from '../lib/api/strategic';

// ============================================
// Filter State
// ============================================

export interface GoalFilters {
  status?: GoalStatus | GoalStatus[];
  category?: GoalCategory | GoalCategory[];
  priority?: GoalPriority | GoalPriority[];
  hasParent?: boolean;
}

// ============================================
// Store Interface
// ============================================

interface GoalsStore {
  // Goals State
  goals: Goal[];
  selectedGoal: Goal | null;
  stats: GoalStats | null;
  progress: GoalProgress | null;
  hierarchy: GoalHierarchyNode[];
  filters: GoalFilters;

  // UI State
  isLoading: boolean;
  error: string | null;

  // Modal State
  showCreateModal: boolean;
  showEditModal: boolean;
  showDeleteModal: boolean;
  showDetailsModal: boolean;
  modalGoalId: string | null;

  // Actions - Data Loading
  loadGoals: () => Promise<void>;
  loadActiveGoals: () => Promise<void>;
  loadStats: () => Promise<void>;
  loadHierarchy: () => Promise<void>;
  loadGoal: (id: string) => Promise<void>;

  // Actions - Filtering
  setFilters: (filters: Partial<GoalFilters>) => void;
  clearFilters: () => void;

  // Actions - CRUD
  createGoal: (input: CreateGoalInput) => Promise<Goal | undefined>;
  updateGoal: (id: string, input: UpdateGoalInput) => Promise<Goal | undefined>;
  updateProgress: (id: string, currentValue: number) => Promise<Goal | undefined>;
  deleteGoal: (id: string, reason?: string) => Promise<void>;

  // Actions - Pattern Linking
  linkPattern: (goalId: string, patternId: string) => Promise<void>;
  unlinkPattern: (goalId: string, patternId: string) => Promise<void>;

  // Actions - Selection
  selectGoal: (id: string | null) => void;

  // Actions - Modals
  openCreateModal: () => void;
  openEditModal: (id: string) => void;
  openDeleteModal: (id: string) => void;
  openDetailsModal: (id: string) => void;
  closeModals: () => void;

  // Actions - Error Handling
  clearError: () => void;
}

// ============================================
// Store Implementation
// ============================================

export const useGoalsStore = create<GoalsStore>((set, get) => ({
  // Initial State
  goals: [],
  selectedGoal: null,
  stats: null,
  progress: null,
  hierarchy: [],
  filters: {},
  isLoading: false,
  error: null,
  showCreateModal: false,
  showEditModal: false,
  showDeleteModal: false,
  showDetailsModal: false,
  modalGoalId: null,

  // Load all goals with current filters
  loadGoals: async () => {
    set({ isLoading: true, error: null });

    try {
      const { filters } = get();
      const response = await listGoals({
        status: filters.status,
        category: filters.category,
        priority: filters.priority,
        hasParent: filters.hasParent,
        limit: 100,
        orderBy: 'priority',
        orderDir: 'ASC',
      });

      if (!response.success) {
        throw new Error(response.error || 'Failed to load goals');
      }

      set({ goals: response.goals, isLoading: false });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to load goals',
        isLoading: false,
      });
    }
  },

  // Load only active goals (for dashboard widget)
  loadActiveGoals: async () => {
    set({ isLoading: true, error: null });

    try {
      const response = await listGoals({
        status: 'active',
        limit: 20,
        orderBy: 'priority',
        orderDir: 'ASC',
      });

      if (!response.success) {
        throw new Error(response.error || 'Failed to load active goals');
      }

      set({ goals: response.goals, isLoading: false });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to load active goals',
        isLoading: false,
      });
    }
  },

  // Load statistics
  loadStats: async () => {
    try {
      const response = await getGoalStats();

      if (!response.success) {
        throw new Error(response.error || 'Failed to load stats');
      }

      set({
        stats: response.stats || null,
        progress: response.progress || null,
      });
    } catch (error) {
      console.error('Failed to load goal stats:', error);
    }
  },

  // Load goal hierarchy
  loadHierarchy: async () => {
    try {
      const response = await getGoalHierarchy();

      if (!response.success) {
        throw new Error(response.error || 'Failed to load hierarchy');
      }

      set({ hierarchy: response.hierarchy });
    } catch (error) {
      console.error('Failed to load goal hierarchy:', error);
    }
  },

  // Load single goal by ID
  loadGoal: async (id: string) => {
    try {
      const response = await getGoal(id);

      if (!response.success || !response.goal) {
        throw new Error(response.error || 'Goal not found');
      }

      set({ selectedGoal: response.goal });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to load goal',
      });
    }
  },

  // Set filters
  setFilters: (newFilters) => {
    set((state) => ({
      filters: { ...state.filters, ...newFilters },
    }));
    // Reload with new filters
    get().loadGoals();
  },

  // Clear filters
  clearFilters: () => {
    set({ filters: {} });
    get().loadGoals();
  },

  // Create a new goal
  createGoal: async (input: CreateGoalInput) => {
    try {
      const response = await createGoalApi(input);

      if (!response.success || !response.goal) {
        throw new Error(response.error || 'Failed to create goal');
      }

      // Add to local state
      set((state) => ({
        goals: [response.goal!, ...state.goals],
      }));

      // Reload stats
      get().loadStats();

      return response.goal;
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to create goal',
      });
      return undefined;
    }
  },

  // Update a goal
  updateGoal: async (id: string, input: UpdateGoalInput) => {
    try {
      const response = await updateGoalApi(id, input);

      if (!response.success || !response.goal) {
        throw new Error(response.error || 'Failed to update goal');
      }

      // Update local state
      set((state) => ({
        goals: state.goals.map((g) =>
          g.id === id ? response.goal! : g
        ),
        selectedGoal:
          state.selectedGoal?.id === id
            ? response.goal
            : state.selectedGoal,
      }));

      // Reload stats
      get().loadStats();

      return response.goal;
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to update goal',
      });
      return undefined;
    }
  },

  // Update goal progress
  updateProgress: async (id: string, currentValue: number) => {
    try {
      const response = await updateProgressApi(id, currentValue);

      if (!response.success || !response.goal) {
        throw new Error(response.error || 'Failed to update progress');
      }

      // Update local state
      set((state) => ({
        goals: state.goals.map((g) =>
          g.id === id ? response.goal! : g
        ),
        selectedGoal:
          state.selectedGoal?.id === id
            ? response.goal
            : state.selectedGoal,
      }));

      // Reload stats
      get().loadStats();

      return response.goal;
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to update progress',
      });
      return undefined;
    }
  },

  // Delete (abandon) a goal
  deleteGoal: async (id: string, reason?: string) => {
    try {
      const response = await deleteGoalApi(id, reason);

      if (!response.success) {
        throw new Error(response.error || 'Failed to delete goal');
      }

      // Update local state - update the goal status to abandoned
      set((state) => ({
        goals: state.goals.map((g) =>
          g.id === id && response.goal ? response.goal : g
        ),
        selectedGoal:
          state.selectedGoal?.id === id
            ? response.goal || state.selectedGoal
            : state.selectedGoal,
      }));

      // Reload stats
      get().loadStats();
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to delete goal',
      });
    }
  },

  // Link a pattern to a goal
  linkPattern: async (goalId: string, patternId: string) => {
    try {
      const response = await linkPatternApi(goalId, patternId);

      if (!response.success || !response.goal) {
        throw new Error(response.error || 'Failed to link pattern');
      }

      // Update local state
      set((state) => ({
        goals: state.goals.map((g) =>
          g.id === goalId ? response.goal! : g
        ),
        selectedGoal:
          state.selectedGoal?.id === goalId
            ? response.goal
            : state.selectedGoal,
      }));
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to link pattern',
      });
    }
  },

  // Unlink a pattern from a goal
  unlinkPattern: async (goalId: string, patternId: string) => {
    try {
      const response = await unlinkPatternApi(goalId, patternId);

      if (!response.success || !response.goal) {
        throw new Error(response.error || 'Failed to unlink pattern');
      }

      // Update local state
      set((state) => ({
        goals: state.goals.map((g) =>
          g.id === goalId ? response.goal! : g
        ),
        selectedGoal:
          state.selectedGoal?.id === goalId
            ? response.goal
            : state.selectedGoal,
      }));
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to unlink pattern',
      });
    }
  },

  // Select a goal
  selectGoal: (id) => {
    if (id === null) {
      set({ selectedGoal: null });
      return;
    }

    const goal = get().goals.find((g) => g.id === id);
    set({ selectedGoal: goal || null });
  },

  // Modal controls
  openCreateModal: () => {
    set({ showCreateModal: true, modalGoalId: null });
  },

  openEditModal: (id) => {
    set({ showEditModal: true, modalGoalId: id });
    get().loadGoal(id);
  },

  openDeleteModal: (id) => {
    set({ showDeleteModal: true, modalGoalId: id });
  },

  openDetailsModal: (id) => {
    set({ showDetailsModal: true, modalGoalId: id });
    get().loadGoal(id);
  },

  closeModals: () => {
    set({
      showCreateModal: false,
      showEditModal: false,
      showDeleteModal: false,
      showDetailsModal: false,
      modalGoalId: null,
    });
  },

  // Clear error
  clearError: () => {
    set({ error: null });
  },
}));
