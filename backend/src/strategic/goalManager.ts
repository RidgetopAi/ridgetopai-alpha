/**
 * Goal Manager - Business logic for goal operations
 * Strategic Layer Phase 3: Goal Management
 *
 * Provides high-level goal operations including validation, lifecycle management,
 * and integration with Mandrel for context storage.
 */

import * as goalRepository from './db/goalRepository.js';
import type {
  GoalRow,
  GoalInput,
  GoalUpdateInput,
  GoalQueryOptions,
  GoalStats,
  GoalCategory,
  GoalPriority,
  GoalStatus,
} from './db/goalRepository.js';
import { storeMilestoneContext } from '../mandrelClient.js';

// ============================================
// Export types from repository for convenience
// ============================================

export type {
  GoalRow,
  GoalInput,
  GoalUpdateInput,
  GoalQueryOptions,
  GoalStats,
  GoalCategory,
  GoalPriority,
  GoalStatus,
};

// ============================================
// Computed Types
// ============================================

export interface GoalWithMetadata extends GoalRow {
  childCount: number;
  linkedPatternCount: number;
  daysUntilTarget: number | null;
  isOverdue: boolean;
}

export interface GoalHierarchyNode extends GoalRow {
  children: GoalHierarchyNode[];
}

export interface CreateGoalResult {
  success: boolean;
  goal?: GoalRow;
  error?: string;
}

export interface UpdateGoalResult {
  success: boolean;
  goal?: GoalRow;
  previousStatus?: GoalStatus;
  error?: string;
}

// ============================================
// Validation
// ============================================

const VALID_CATEGORIES: GoalCategory[] = ['revenue', 'product', 'operational', 'growth', 'technical'];
const VALID_PRIORITIES: GoalPriority[] = ['critical', 'high', 'medium', 'low'];
const VALID_STATUSES: GoalStatus[] = ['active', 'completed', 'paused', 'abandoned'];

function validateGoalInput(input: GoalInput): string | null {
  if (!input.title || input.title.trim().length === 0) {
    return 'Title is required';
  }
  if (input.title.length > 200) {
    return 'Title must be 200 characters or less';
  }
  if (!input.description || input.description.trim().length === 0) {
    return 'Description is required';
  }
  if (!VALID_CATEGORIES.includes(input.category)) {
    return `Invalid category. Must be one of: ${VALID_CATEGORIES.join(', ')}`;
  }
  if (input.priority && !VALID_PRIORITIES.includes(input.priority)) {
    return `Invalid priority. Must be one of: ${VALID_PRIORITIES.join(', ')}`;
  }
  if (input.targetValue !== undefined && input.targetValue < 0) {
    return 'Target value must be non-negative';
  }
  if (input.currentValue !== undefined && input.currentValue < 0) {
    return 'Current value must be non-negative';
  }
  return null;
}

function validateGoalUpdate(input: GoalUpdateInput): string | null {
  if (input.title !== undefined && input.title.trim().length === 0) {
    return 'Title cannot be empty';
  }
  if (input.title !== undefined && input.title.length > 200) {
    return 'Title must be 200 characters or less';
  }
  if (input.description !== undefined && input.description.trim().length === 0) {
    return 'Description cannot be empty';
  }
  if (input.category !== undefined && !VALID_CATEGORIES.includes(input.category)) {
    return `Invalid category. Must be one of: ${VALID_CATEGORIES.join(', ')}`;
  }
  if (input.priority !== undefined && !VALID_PRIORITIES.includes(input.priority)) {
    return `Invalid priority. Must be one of: ${VALID_PRIORITIES.join(', ')}`;
  }
  if (input.status !== undefined && !VALID_STATUSES.includes(input.status)) {
    return `Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}`;
  }
  if (input.progressPercentage !== undefined && (input.progressPercentage < 0 || input.progressPercentage > 100)) {
    return 'Progress percentage must be between 0 and 100';
  }
  return null;
}

// ============================================
// Goal Operations
// ============================================

/**
 * Create a new goal with validation and Mandrel integration
 */
export async function createGoal(input: GoalInput): Promise<CreateGoalResult> {
  // Validate input
  const validationError = validateGoalInput(input);
  if (validationError) {
    return { success: false, error: validationError };
  }

  // Create the goal
  const goal = await goalRepository.insertGoal(input);
  if (!goal) {
    return { success: false, error: 'Failed to create goal' };
  }

  // Store milestone to Mandrel (fire-and-forget)
  storeMilestoneContext(
    `Goal created: ${goal.title}`,
    ['strategic-layer', 'goal-created', goal.category, goal.priority]
  ).catch(err => console.error('[GoalManager] Failed to store milestone:', err));

  console.log(`[GoalManager] Created goal: ${goal.id} - ${goal.title}`);
  return { success: true, goal };
}

/**
 * Get a goal with computed metadata
 */
export async function getGoal(id: string): Promise<GoalWithMetadata | null> {
  const goal = await goalRepository.getGoalById(id);
  if (!goal) {
    return null;
  }

  // Get child goals count
  const children = await goalRepository.getChildGoals(id);
  const childCount = children.length;

  // Calculate days until target
  let daysUntilTarget: number | null = null;
  let isOverdue = false;

  if (goal.target_date) {
    const targetDate = new Date(goal.target_date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    targetDate.setHours(0, 0, 0, 0);

    const diffTime = targetDate.getTime() - today.getTime();
    daysUntilTarget = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    isOverdue = daysUntilTarget < 0 && goal.status === 'active';
  }

  return {
    ...goal,
    childCount,
    linkedPatternCount: goal.related_pattern_ids?.length || 0,
    daysUntilTarget,
    isOverdue,
  };
}

/**
 * List goals with optional filtering and computed metadata
 */
export async function listGoals(options: GoalQueryOptions = {}): Promise<GoalWithMetadata[]> {
  const goals = await goalRepository.queryGoals(options);

  // Add metadata to each goal
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return goals.map(goal => {
    let daysUntilTarget: number | null = null;
    let isOverdue = false;

    if (goal.target_date) {
      const targetDate = new Date(goal.target_date);
      targetDate.setHours(0, 0, 0, 0);

      const diffTime = targetDate.getTime() - today.getTime();
      daysUntilTarget = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      isOverdue = daysUntilTarget < 0 && goal.status === 'active';
    }

    return {
      ...goal,
      childCount: 0, // Not computed in list view for performance
      linkedPatternCount: goal.related_pattern_ids?.length || 0,
      daysUntilTarget,
      isOverdue,
    };
  });
}

/**
 * Get active goals (convenience wrapper for recommendation engine)
 */
export async function getActiveGoals(): Promise<GoalRow[]> {
  return goalRepository.getActiveGoals();
}

/**
 * Update a goal with validation and status change tracking
 */
export async function updateGoal(id: string, input: GoalUpdateInput): Promise<UpdateGoalResult> {
  // Validate input
  const validationError = validateGoalUpdate(input);
  if (validationError) {
    return { success: false, error: validationError };
  }

  // Get current goal for status comparison
  const currentGoal = await goalRepository.getGoalById(id);
  if (!currentGoal) {
    return { success: false, error: 'Goal not found' };
  }

  // Update the goal
  const updatedGoal = await goalRepository.updateGoal(id, input);
  if (!updatedGoal) {
    return { success: false, error: 'Failed to update goal' };
  }

  // If status changed, log milestone
  if (input.status && input.status !== currentGoal.status) {
    const statusMessage = input.status === 'completed'
      ? `Goal completed: ${updatedGoal.title}`
      : `Goal status changed to ${input.status}: ${updatedGoal.title}`;

    storeMilestoneContext(
      statusMessage,
      ['strategic-layer', 'goal-status-change', `status-${input.status}`, updatedGoal.category]
    ).catch(err => console.error('[GoalManager] Failed to store milestone:', err));
  }

  console.log(`[GoalManager] Updated goal: ${id}`);
  return {
    success: true,
    goal: updatedGoal,
    previousStatus: currentGoal.status,
  };
}

/**
 * Update progress for a goal with auto-completion
 */
export async function updateProgress(id: string, currentValue: number): Promise<UpdateGoalResult> {
  if (currentValue < 0) {
    return { success: false, error: 'Current value must be non-negative' };
  }

  const currentGoal = await goalRepository.getGoalById(id);
  if (!currentGoal) {
    return { success: false, error: 'Goal not found' };
  }

  const updatedGoal = await goalRepository.updateProgress(id, currentValue);
  if (!updatedGoal) {
    return { success: false, error: 'Failed to update progress' };
  }

  // Auto-complete if 100% progress and goal is active
  if (updatedGoal.progress_percentage >= 100 && updatedGoal.status === 'active') {
    const completedGoal = await goalRepository.updateGoal(id, { status: 'completed' });
    if (completedGoal) {
      storeMilestoneContext(
        `Goal auto-completed: ${completedGoal.title} (100% progress reached)`,
        ['strategic-layer', 'goal-auto-completed', completedGoal.category]
      ).catch(err => console.error('[GoalManager] Failed to store milestone:', err));

      console.log(`[GoalManager] Auto-completed goal: ${id}`);
      return {
        success: true,
        goal: completedGoal,
        previousStatus: 'active',
      };
    }
  }

  console.log(`[GoalManager] Updated progress for goal: ${id} (${updatedGoal.progress_percentage.toFixed(1)}%)`);
  return { success: true, goal: updatedGoal };
}

/**
 * Abandon a goal (soft delete)
 */
export async function abandonGoal(id: string, reason?: string): Promise<UpdateGoalResult> {
  const currentGoal = await goalRepository.getGoalById(id);
  if (!currentGoal) {
    return { success: false, error: 'Goal not found' };
  }

  const updatedGoal = await goalRepository.deleteGoal(id);
  if (!updatedGoal) {
    return { success: false, error: 'Failed to abandon goal' };
  }

  storeMilestoneContext(
    `Goal abandoned: ${updatedGoal.title}${reason ? ` - Reason: ${reason}` : ''}`,
    ['strategic-layer', 'goal-abandoned', updatedGoal.category]
  ).catch(err => console.error('[GoalManager] Failed to store milestone:', err));

  console.log(`[GoalManager] Abandoned goal: ${id}`);
  return {
    success: true,
    goal: updatedGoal,
    previousStatus: currentGoal.status,
  };
}

/**
 * Link a pattern to a goal
 */
export async function linkPattern(goalId: string, patternId: string): Promise<UpdateGoalResult> {
  const goal = await goalRepository.linkPatternToGoal(goalId, patternId);
  if (!goal) {
    return { success: false, error: 'Failed to link pattern to goal' };
  }

  console.log(`[GoalManager] Linked pattern ${patternId} to goal ${goalId}`);
  return { success: true, goal };
}

/**
 * Unlink a pattern from a goal
 */
export async function unlinkPattern(goalId: string, patternId: string): Promise<UpdateGoalResult> {
  const goal = await goalRepository.unlinkPatternFromGoal(goalId, patternId);
  if (!goal) {
    return { success: false, error: 'Failed to unlink pattern from goal' };
  }

  console.log(`[GoalManager] Unlinked pattern ${patternId} from goal ${goalId}`);
  return { success: true, goal };
}

/**
 * Get goal hierarchy (tree structure)
 */
export async function getGoalHierarchy(rootGoalId?: string): Promise<GoalHierarchyNode[]> {
  // Get all root goals or goals under specified root
  const rootGoals = rootGoalId
    ? [await goalRepository.getGoalById(rootGoalId)].filter(Boolean) as GoalRow[]
    : await goalRepository.queryGoals({ hasParent: false });

  // Build tree recursively
  const buildTree = async (goals: GoalRow[]): Promise<GoalHierarchyNode[]> => {
    const nodes: GoalHierarchyNode[] = [];

    for (const goal of goals) {
      const children = await goalRepository.getChildGoals(goal.id);
      const childNodes = await buildTree(children);

      nodes.push({
        ...goal,
        children: childNodes,
      });
    }

    return nodes;
  };

  return buildTree(rootGoals);
}

/**
 * Get goal statistics
 */
export async function getGoalStats(): Promise<GoalStats> {
  return goalRepository.getGoalStats();
}

/**
 * Calculate weighted overall progress across active goals
 * Higher priority goals have more weight
 */
export async function calculateOverallProgress(): Promise<{
  overallProgress: number;
  totalGoals: number;
  weightedProgress: number;
}> {
  const activeGoals = await goalRepository.getActiveGoals();

  if (activeGoals.length === 0) {
    return { overallProgress: 0, totalGoals: 0, weightedProgress: 0 };
  }

  // Weight by priority: critical=4, high=3, medium=2, low=1
  const priorityWeights: Record<GoalPriority, number> = {
    critical: 4,
    high: 3,
    medium: 2,
    low: 1,
  };

  let totalWeight = 0;
  let weightedSum = 0;
  let simpleSum = 0;

  for (const goal of activeGoals) {
    const weight = priorityWeights[goal.priority] || 2;
    totalWeight += weight;
    weightedSum += goal.progress_percentage * weight;
    simpleSum += goal.progress_percentage;
  }

  return {
    overallProgress: simpleSum / activeGoals.length,
    totalGoals: activeGoals.length,
    weightedProgress: totalWeight > 0 ? weightedSum / totalWeight : 0,
  };
}
