/**
 * Goal Repository - Database access layer for goals table
 * Strategic Layer Phase 3: Goal Management
 *
 * Provides CRUD operations and query functions for strategic goals.
 * Goals are used by Phase 4 (Recommendation Engine) to generate targeted recommendations.
 */

import { query } from '../../db.js';

// ============================================
// TypeScript Interfaces
// ============================================

/** Valid goal categories */
export type GoalCategory = 'revenue' | 'product' | 'operational' | 'growth' | 'technical';

/** Valid goal priorities */
export type GoalPriority = 'critical' | 'high' | 'medium' | 'low';

/** Valid goal statuses */
export type GoalStatus = 'active' | 'completed' | 'paused' | 'abandoned';

/**
 * Row type matching PostgreSQL goals table structure
 */
export interface GoalRow {
  id: string;
  title: string;
  description: string;
  category: GoalCategory;
  priority: GoalPriority;
  target_metric: string | null;
  target_value: number | null;
  current_value: number;
  progress_percentage: number;
  target_date: Date | null;
  status: GoalStatus;
  completed_at: Date | null;
  created_by: string;
  parent_goal_id: string | null;
  related_pattern_ids: string[];
  created_at: Date;
  updated_at: Date;
}

/**
 * Input for creating a new goal
 */
export interface GoalInput {
  title: string;
  description: string;
  category: GoalCategory;
  priority?: GoalPriority;
  targetMetric?: string;
  targetValue?: number;
  currentValue?: number;
  targetDate?: Date;
  createdBy?: string;
  parentGoalId?: string;
  relatedPatternIds?: string[];
}

/**
 * Input for updating an existing goal
 */
export interface GoalUpdateInput {
  title?: string;
  description?: string;
  category?: GoalCategory;
  priority?: GoalPriority;
  targetMetric?: string;
  targetValue?: number;
  currentValue?: number;
  progressPercentage?: number;
  targetDate?: Date | null;
  status?: GoalStatus;
  parentGoalId?: string | null;
  relatedPatternIds?: string[];
}

/**
 * Query options for filtering goals
 */
export interface GoalQueryOptions {
  status?: GoalStatus | GoalStatus[];
  category?: GoalCategory | GoalCategory[];
  priority?: GoalPriority | GoalPriority[];
  parentGoalId?: string | null;
  hasParent?: boolean;
  sinceDate?: Date;
  untilDate?: Date;
  limit?: number;
  offset?: number;
  orderBy?: 'priority' | 'created_at' | 'updated_at' | 'target_date' | 'progress_percentage';
  orderDir?: 'ASC' | 'DESC';
}

/**
 * Summary statistics for goals
 */
export interface GoalStats {
  total: number;
  byStatus: Record<GoalStatus, number>;
  byCategory: Record<GoalCategory, number>;
  byPriority: Record<GoalPriority, number>;
  avgProgress: number;
  overdueCount: number;
  completedThisWeek: number;
  completedThisMonth: number;
}

// ============================================
// Repository Functions
// ============================================

/**
 * Insert a new goal into the goals table
 * Returns the inserted row or null on failure
 */
export async function insertGoal(input: GoalInput): Promise<GoalRow | null> {
  try {
    const result = await query<GoalRow>(
      `INSERT INTO goals
        (title, description, category, priority, target_metric, target_value, current_value, target_date, created_by, parent_goal_id, related_pattern_ids)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING *`,
      [
        input.title,
        input.description,
        input.category,
        input.priority || 'medium',
        input.targetMetric ?? null,
        input.targetValue ?? null,
        input.currentValue ?? 0,
        input.targetDate ?? null,
        input.createdBy || 'brian',
        input.parentGoalId ?? null,
        input.relatedPatternIds || [],
      ]
    );

    if (result.rows.length > 0) {
      console.log(`[GoalRepo] Inserted goal ${result.rows[0].id}: ${input.title}`);
      return result.rows[0];
    }
    return null;
  } catch (error) {
    console.error('[GoalRepo] Failed to insert goal:', error);
    return null;
  }
}

/**
 * Retrieve a single goal by UUID
 * Returns null if not found
 */
export async function getGoalById(id: string): Promise<GoalRow | null> {
  try {
    const result = await query<GoalRow>(
      `SELECT * FROM goals WHERE id = $1`,
      [id]
    );

    return result.rows.length > 0 ? result.rows[0] : null;
  } catch (error) {
    console.error('[GoalRepo] Failed to get goal by ID:', error);
    return null;
  }
}

/**
 * Flexible query with filters and pagination
 * Default limit 100, ordered by priority and created_at DESC
 */
export async function queryGoals(options: GoalQueryOptions = {}): Promise<GoalRow[]> {
  const {
    status,
    category,
    priority,
    parentGoalId,
    hasParent,
    sinceDate,
    untilDate,
    limit = 100,
    offset = 0,
    orderBy = 'created_at',
    orderDir = 'DESC',
  } = options;

  const conditions: string[] = [];
  const params: unknown[] = [];
  let paramIndex = 1;

  // Build dynamic WHERE clauses
  if (status) {
    if (Array.isArray(status)) {
      conditions.push(`status = ANY($${paramIndex}::text[])`);
      params.push(status);
    } else {
      conditions.push(`status = $${paramIndex}`);
      params.push(status);
    }
    paramIndex++;
  }

  if (category) {
    if (Array.isArray(category)) {
      conditions.push(`category = ANY($${paramIndex}::text[])`);
      params.push(category);
    } else {
      conditions.push(`category = $${paramIndex}`);
      params.push(category);
    }
    paramIndex++;
  }

  if (priority) {
    if (Array.isArray(priority)) {
      conditions.push(`priority = ANY($${paramIndex}::text[])`);
      params.push(priority);
    } else {
      conditions.push(`priority = $${paramIndex}`);
      params.push(priority);
    }
    paramIndex++;
  }

  if (parentGoalId !== undefined) {
    if (parentGoalId === null) {
      conditions.push(`parent_goal_id IS NULL`);
    } else {
      conditions.push(`parent_goal_id = $${paramIndex}`);
      params.push(parentGoalId);
      paramIndex++;
    }
  }

  if (hasParent !== undefined) {
    if (hasParent) {
      conditions.push(`parent_goal_id IS NOT NULL`);
    } else {
      conditions.push(`parent_goal_id IS NULL`);
    }
  }

  if (sinceDate) {
    conditions.push(`created_at >= $${paramIndex}`);
    params.push(sinceDate);
    paramIndex++;
  }

  if (untilDate) {
    conditions.push(`created_at <= $${paramIndex}`);
    params.push(untilDate);
    paramIndex++;
  }

  // Build WHERE clause
  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  // Validate order columns to prevent SQL injection
  const validOrderBy = ['priority', 'created_at', 'updated_at', 'target_date', 'progress_percentage'].includes(orderBy)
    ? orderBy
    : 'created_at';
  const validOrderDir = ['ASC', 'DESC'].includes(orderDir.toUpperCase()) ? orderDir.toUpperCase() : 'DESC';

  // Priority ordering: critical > high > medium > low
  const orderClause = validOrderBy === 'priority'
    ? `ORDER BY CASE priority WHEN 'critical' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 WHEN 'low' THEN 4 END ${validOrderDir}, created_at DESC`
    : `ORDER BY ${validOrderBy} ${validOrderDir}`;

  params.push(limit);
  params.push(offset);

  const sql = `
    SELECT * FROM goals
    ${whereClause}
    ${orderClause}
    LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
  `;

  try {
    const result = await query<GoalRow>(sql, params);
    return result.rows;
  } catch (error) {
    console.error('[GoalRepo] Failed to query goals:', error);
    return [];
  }
}

/**
 * Get active goals ordered by priority (for Phase 4 recommendation engine)
 */
export async function getActiveGoals(): Promise<GoalRow[]> {
  return queryGoals({
    status: 'active',
    orderBy: 'priority',
    orderDir: 'ASC',
  });
}

/**
 * Get goals by category
 */
export async function getGoalsByCategory(category: GoalCategory, limit: number = 50): Promise<GoalRow[]> {
  return queryGoals({
    category,
    limit,
  });
}

/**
 * Get child goals of a parent goal
 */
export async function getChildGoals(parentGoalId: string): Promise<GoalRow[]> {
  return queryGoals({
    parentGoalId,
    orderBy: 'created_at',
    orderDir: 'ASC',
  });
}

/**
 * Update an existing goal
 * Returns the updated row or null on failure
 */
export async function updateGoal(id: string, input: GoalUpdateInput): Promise<GoalRow | null> {
  // Build SET clause dynamically based on provided fields
  const setClauses: string[] = [];
  const params: unknown[] = [];
  let paramIndex = 1;

  if (input.title !== undefined) {
    setClauses.push(`title = $${paramIndex}`);
    params.push(input.title);
    paramIndex++;
  }

  if (input.description !== undefined) {
    setClauses.push(`description = $${paramIndex}`);
    params.push(input.description);
    paramIndex++;
  }

  if (input.category !== undefined) {
    setClauses.push(`category = $${paramIndex}`);
    params.push(input.category);
    paramIndex++;
  }

  if (input.priority !== undefined) {
    setClauses.push(`priority = $${paramIndex}`);
    params.push(input.priority);
    paramIndex++;
  }

  if (input.targetMetric !== undefined) {
    setClauses.push(`target_metric = $${paramIndex}`);
    params.push(input.targetMetric);
    paramIndex++;
  }

  if (input.targetValue !== undefined) {
    setClauses.push(`target_value = $${paramIndex}`);
    params.push(input.targetValue);
    paramIndex++;
  }

  if (input.currentValue !== undefined) {
    setClauses.push(`current_value = $${paramIndex}`);
    params.push(input.currentValue);
    paramIndex++;
  }

  if (input.progressPercentage !== undefined) {
    setClauses.push(`progress_percentage = $${paramIndex}`);
    params.push(Math.min(100, Math.max(0, input.progressPercentage)));
    paramIndex++;
  }

  if (input.targetDate !== undefined) {
    setClauses.push(`target_date = $${paramIndex}`);
    params.push(input.targetDate);
    paramIndex++;
  }

  if (input.status !== undefined) {
    setClauses.push(`status = $${paramIndex}`);
    params.push(input.status);
    paramIndex++;

    // Auto-set completed_at when status changes to completed
    if (input.status === 'completed') {
      setClauses.push(`completed_at = NOW()`);
    } else {
      setClauses.push(`completed_at = NULL`);
    }
  }

  if (input.parentGoalId !== undefined) {
    setClauses.push(`parent_goal_id = $${paramIndex}`);
    params.push(input.parentGoalId);
    paramIndex++;
  }

  if (input.relatedPatternIds !== undefined) {
    setClauses.push(`related_pattern_ids = $${paramIndex}`);
    params.push(input.relatedPatternIds);
    paramIndex++;
  }

  // Always update updated_at
  setClauses.push(`updated_at = NOW()`);

  if (setClauses.length === 1) {
    // Only updated_at, nothing to update
    return getGoalById(id);
  }

  params.push(id);

  const sql = `
    UPDATE goals
    SET ${setClauses.join(', ')}
    WHERE id = $${paramIndex}
    RETURNING *
  `;

  try {
    const result = await query<GoalRow>(sql, params);

    if (result.rows.length > 0) {
      console.log(`[GoalRepo] Updated goal ${id}`);
      return result.rows[0];
    }
    return null;
  } catch (error) {
    console.error('[GoalRepo] Failed to update goal:', error);
    return null;
  }
}

/**
 * Soft delete a goal (set status to abandoned)
 * Returns the updated row or null on failure
 */
export async function deleteGoal(id: string): Promise<GoalRow | null> {
  return updateGoal(id, { status: 'abandoned' });
}

/**
 * Update progress based on current_value and target_value
 * Automatically calculates progress_percentage
 * Returns the updated row or null on failure
 */
export async function updateProgress(id: string, currentValue: number): Promise<GoalRow | null> {
  try {
    // First get the goal to check target_value
    const goal = await getGoalById(id);
    if (!goal) {
      return null;
    }

    let progressPercentage = goal.progress_percentage;

    // Calculate progress if we have a target
    if (goal.target_value && goal.target_value > 0) {
      progressPercentage = Math.min(100, Math.max(0, (currentValue / goal.target_value) * 100));
    }

    const result = await query<GoalRow>(
      `UPDATE goals
       SET current_value = $1, progress_percentage = $2, updated_at = NOW()
       WHERE id = $3
       RETURNING *`,
      [currentValue, progressPercentage, id]
    );

    if (result.rows.length > 0) {
      console.log(`[GoalRepo] Updated progress for goal ${id}: ${currentValue} (${progressPercentage.toFixed(1)}%)`);
      return result.rows[0];
    }
    return null;
  } catch (error) {
    console.error('[GoalRepo] Failed to update progress:', error);
    return null;
  }
}

/**
 * Link a pattern to a goal
 * Returns the updated row or null on failure
 */
export async function linkPatternToGoal(goalId: string, patternId: string): Promise<GoalRow | null> {
  try {
    const result = await query<GoalRow>(
      `UPDATE goals
       SET related_pattern_ids = array_append(
         array_remove(related_pattern_ids, $1::uuid),
         $1::uuid
       ),
       updated_at = NOW()
       WHERE id = $2
       RETURNING *`,
      [patternId, goalId]
    );

    if (result.rows.length > 0) {
      console.log(`[GoalRepo] Linked pattern ${patternId} to goal ${goalId}`);
      return result.rows[0];
    }
    return null;
  } catch (error) {
    console.error('[GoalRepo] Failed to link pattern to goal:', error);
    return null;
  }
}

/**
 * Unlink a pattern from a goal
 * Returns the updated row or null on failure
 */
export async function unlinkPatternFromGoal(goalId: string, patternId: string): Promise<GoalRow | null> {
  try {
    const result = await query<GoalRow>(
      `UPDATE goals
       SET related_pattern_ids = array_remove(related_pattern_ids, $1::uuid),
           updated_at = NOW()
       WHERE id = $2
       RETURNING *`,
      [patternId, goalId]
    );

    if (result.rows.length > 0) {
      console.log(`[GoalRepo] Unlinked pattern ${patternId} from goal ${goalId}`);
      return result.rows[0];
    }
    return null;
  } catch (error) {
    console.error('[GoalRepo] Failed to unlink pattern from goal:', error);
    return null;
  }
}

/**
 * Get aggregate statistics for goals
 */
export async function getGoalStats(): Promise<GoalStats> {
  try {
    // Basic count
    const totalResult = await query<{ count: string }>(
      `SELECT COUNT(*) as count FROM goals`
    );

    // Count by status
    const statusResult = await query<{ status: GoalStatus; count: string }>(
      `SELECT status, COUNT(*) as count FROM goals GROUP BY status`
    );

    // Count by category
    const categoryResult = await query<{ category: GoalCategory; count: string }>(
      `SELECT category, COUNT(*) as count FROM goals GROUP BY category`
    );

    // Count by priority
    const priorityResult = await query<{ priority: GoalPriority; count: string }>(
      `SELECT priority, COUNT(*) as count FROM goals GROUP BY priority`
    );

    // Average progress of active goals
    const avgProgressResult = await query<{ avg: string | null }>(
      `SELECT AVG(progress_percentage) as avg FROM goals WHERE status = 'active'`
    );

    // Overdue count (active goals with target_date in the past)
    const overdueResult = await query<{ count: string }>(
      `SELECT COUNT(*) as count FROM goals
       WHERE status = 'active' AND target_date IS NOT NULL AND target_date < CURRENT_DATE`
    );

    // Completed this week
    const completedWeekResult = await query<{ count: string }>(
      `SELECT COUNT(*) as count FROM goals
       WHERE status = 'completed' AND completed_at >= NOW() - INTERVAL '7 days'`
    );

    // Completed this month
    const completedMonthResult = await query<{ count: string }>(
      `SELECT COUNT(*) as count FROM goals
       WHERE status = 'completed' AND completed_at >= NOW() - INTERVAL '30 days'`
    );

    // Build response
    const byStatus: Record<GoalStatus, number> = {
      active: 0,
      completed: 0,
      paused: 0,
      abandoned: 0,
    };
    for (const row of statusResult.rows) {
      byStatus[row.status] = parseInt(row.count, 10);
    }

    const byCategory: Record<GoalCategory, number> = {
      revenue: 0,
      product: 0,
      operational: 0,
      growth: 0,
      technical: 0,
    };
    for (const row of categoryResult.rows) {
      byCategory[row.category] = parseInt(row.count, 10);
    }

    const byPriority: Record<GoalPriority, number> = {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
    };
    for (const row of priorityResult.rows) {
      byPriority[row.priority] = parseInt(row.count, 10);
    }

    return {
      total: parseInt(totalResult.rows[0]?.count || '0', 10),
      byStatus,
      byCategory,
      byPriority,
      avgProgress: avgProgressResult.rows[0]?.avg ? parseFloat(avgProgressResult.rows[0].avg) : 0,
      overdueCount: parseInt(overdueResult.rows[0]?.count || '0', 10),
      completedThisWeek: parseInt(completedWeekResult.rows[0]?.count || '0', 10),
      completedThisMonth: parseInt(completedMonthResult.rows[0]?.count || '0', 10),
    };
  } catch (error) {
    console.error('[GoalRepo] Failed to get goal stats:', error);
    return {
      total: 0,
      byStatus: { active: 0, completed: 0, paused: 0, abandoned: 0 },
      byCategory: { revenue: 0, product: 0, operational: 0, growth: 0, technical: 0 },
      byPriority: { critical: 0, high: 0, medium: 0, low: 0 },
      avgProgress: 0,
      overdueCount: 0,
      completedThisWeek: 0,
      completedThisMonth: 0,
    };
  }
}

/**
 * Count goals matching criteria
 */
export async function countGoals(options: Omit<GoalQueryOptions, 'limit' | 'offset' | 'orderBy' | 'orderDir'> = {}): Promise<number> {
  const { status, category, priority, parentGoalId, hasParent, sinceDate, untilDate } = options;

  const conditions: string[] = [];
  const params: unknown[] = [];
  let paramIndex = 1;

  if (status) {
    if (Array.isArray(status)) {
      conditions.push(`status = ANY($${paramIndex}::text[])`);
      params.push(status);
    } else {
      conditions.push(`status = $${paramIndex}`);
      params.push(status);
    }
    paramIndex++;
  }

  if (category) {
    if (Array.isArray(category)) {
      conditions.push(`category = ANY($${paramIndex}::text[])`);
      params.push(category);
    } else {
      conditions.push(`category = $${paramIndex}`);
      params.push(category);
    }
    paramIndex++;
  }

  if (priority) {
    if (Array.isArray(priority)) {
      conditions.push(`priority = ANY($${paramIndex}::text[])`);
      params.push(priority);
    } else {
      conditions.push(`priority = $${paramIndex}`);
      params.push(priority);
    }
    paramIndex++;
  }

  if (parentGoalId !== undefined) {
    if (parentGoalId === null) {
      conditions.push(`parent_goal_id IS NULL`);
    } else {
      conditions.push(`parent_goal_id = $${paramIndex}`);
      params.push(parentGoalId);
      paramIndex++;
    }
  }

  if (hasParent !== undefined) {
    conditions.push(hasParent ? `parent_goal_id IS NOT NULL` : `parent_goal_id IS NULL`);
  }

  if (sinceDate) {
    conditions.push(`created_at >= $${paramIndex}`);
    params.push(sinceDate);
    paramIndex++;
  }

  if (untilDate) {
    conditions.push(`created_at <= $${paramIndex}`);
    params.push(untilDate);
    paramIndex++;
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  try {
    const result = await query<{ count: string }>(
      `SELECT COUNT(*) as count FROM goals ${whereClause}`,
      params
    );

    return parseInt(result.rows[0]?.count || '0', 10);
  } catch (error) {
    console.error('[GoalRepo] Failed to count goals:', error);
    return 0;
  }
}
