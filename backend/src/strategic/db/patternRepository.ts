/**
 * Pattern Repository - Database access layer for patterns table
 * Strategic Layer Phase 2: Pattern Detection
 *
 * Provides CRUD operations and query functions for pattern detection results.
 * Patterns are detected by analyzing observations from Phase 1.
 */

import { query } from '../../db.js';
import { randomUUID } from 'crypto';

// ============================================
// TypeScript Interfaces
// ============================================

/**
 * Pattern types for classification
 */
export type PatternType =
  | 'recurring_success'
  | 'recurring_failure'
  | 'timing_pattern'
  | 'correlation'
  | 'trend';

/**
 * Row type matching PostgreSQL patterns table structure
 */
export interface PatternRow {
  id: string;
  pattern_type: string;
  name: string;
  description: string;
  observation_ids: string[];
  observation_count: number;
  confidence: number;
  first_observed: Date;
  last_observed: Date;
  status: string;
  dismissed_reason: string | null;
  ai_analysis: string | null;
  ai_recommendations: string[];
  created_at: Date;
  updated_at: Date;
}

/**
 * Input for creating a new pattern
 */
export interface PatternInput {
  patternType: PatternType;
  name: string;
  description: string;
  observationIds: string[];
  confidence: number;
  firstObserved: Date;
  lastObserved: Date;
  aiAnalysis?: string;
  aiRecommendations?: string[];
}

/**
 * Query options for filtering patterns
 */
export interface PatternQueryOptions {
  patternType?: PatternType | PatternType[];
  status?: 'active' | 'superseded' | 'dismissed';
  minConfidence?: number;
  sinceDate?: Date;
  limit?: number;
  offset?: number;
  orderBy?: 'created_at' | 'updated_at' | 'confidence' | 'observation_count';
  orderDir?: 'ASC' | 'DESC';
}

/**
 * Statistics about patterns
 */
export interface PatternStats {
  total: number;
  byType: Record<string, number>;
  byStatus: Record<string, number>;
  avgConfidence: number | null;
  totalObservations: number;
  newestPattern: Date | null;
  oldestPattern: Date | null;
}

// ============================================
// Repository Functions
// ============================================

/**
 * Insert a new pattern into the patterns table
 * Returns the inserted row or null on failure
 */
export async function insertPattern(input: PatternInput): Promise<PatternRow | null> {
  const id = randomUUID();
  const now = new Date();

  try {
    const result = await query<PatternRow>(
      `INSERT INTO patterns
        (id, pattern_type, name, description, observation_ids, observation_count,
         confidence, first_observed, last_observed, status, ai_analysis, ai_recommendations,
         created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'active', $10, $11, $12, $13)
       RETURNING *`,
      [
        id,
        input.patternType,
        input.name,
        input.description,
        input.observationIds,
        input.observationIds.length,
        input.confidence,
        input.firstObserved,
        input.lastObserved,
        input.aiAnalysis || null,
        input.aiRecommendations || [],
        now,
        now,
      ]
    );

    if (result.rows.length > 0) {
      console.log(`[PatternRepo] Inserted pattern ${result.rows[0].id}: ${input.name}`);
      return result.rows[0];
    }
    return null;
  } catch (error) {
    console.error('[PatternRepo] Failed to insert pattern:', error);
    return null;
  }
}

/**
 * Retrieve a single pattern by UUID
 * Returns null if not found
 */
export async function getPatternById(id: string): Promise<PatternRow | null> {
  try {
    const result = await query<PatternRow>(
      `SELECT * FROM patterns WHERE id = $1`,
      [id]
    );

    return result.rows.length > 0 ? result.rows[0] : null;
  } catch (error) {
    console.error('[PatternRepo] Failed to get pattern by ID:', error);
    return null;
  }
}

/**
 * Flexible query with filters and pagination
 * Default limit 50, ordered by created_at DESC
 */
export async function queryPatterns(options: PatternQueryOptions = {}): Promise<PatternRow[]> {
  const {
    patternType,
    status,
    minConfidence,
    sinceDate,
    limit = 50,
    offset = 0,
    orderBy = 'created_at',
    orderDir = 'DESC',
  } = options;

  const conditions: string[] = [];
  const params: unknown[] = [];
  let paramIndex = 1;

  // Build dynamic WHERE clauses
  if (patternType) {
    if (Array.isArray(patternType)) {
      conditions.push(`pattern_type = ANY($${paramIndex}::text[])`);
      params.push(patternType);
    } else {
      conditions.push(`pattern_type = $${paramIndex}`);
      params.push(patternType);
    }
    paramIndex++;
  }

  if (status) {
    conditions.push(`status = $${paramIndex}`);
    params.push(status);
    paramIndex++;
  }

  if (minConfidence !== undefined) {
    conditions.push(`confidence >= $${paramIndex}`);
    params.push(minConfidence);
    paramIndex++;
  }

  if (sinceDate) {
    conditions.push(`created_at >= $${paramIndex}`);
    params.push(sinceDate);
    paramIndex++;
  }

  // Build WHERE clause
  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  // Validate order columns to prevent SQL injection
  const validOrderBy = ['created_at', 'updated_at', 'confidence', 'observation_count'].includes(orderBy)
    ? orderBy
    : 'created_at';
  const validOrderDir = ['ASC', 'DESC'].includes(orderDir.toUpperCase()) ? orderDir.toUpperCase() : 'DESC';

  // Add limit and offset
  params.push(limit);
  params.push(offset);

  const sql = `
    SELECT * FROM patterns
    ${whereClause}
    ORDER BY ${validOrderBy} ${validOrderDir}
    LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
  `;

  try {
    const result = await query<PatternRow>(sql, params);
    return result.rows;
  } catch (error) {
    console.error('[PatternRepo] Failed to query patterns:', error);
    return [];
  }
}

/**
 * Convenience function for getting active patterns
 * Ordered by confidence DESC
 * Used by Recommendation Engine (Phase 4)
 */
export async function getActivePatterns(): Promise<PatternRow[]> {
  try {
    const result = await query<PatternRow>(
      `SELECT * FROM patterns WHERE status = 'active' ORDER BY confidence DESC`
    );
    return result.rows;
  } catch (error) {
    console.error('[PatternRepo] Failed to get active patterns:', error);
    return [];
  }
}

/**
 * Convenience function for type-specific queries
 * Default limit 20
 */
export async function getPatternsByType(type: PatternType, limit: number = 20): Promise<PatternRow[]> {
  return queryPatterns({
    patternType: type,
    status: 'active',
    limit,
    orderBy: 'confidence',
    orderDir: 'DESC',
  });
}

/**
 * Update an existing pattern
 * Sets updated_at to now
 * Returns updated row or null if not found
 */
export async function updatePattern(
  id: string,
  updates: Partial<PatternInput> & {
    observationIds?: string[];
    status?: 'active' | 'superseded' | 'dismissed';
    dismissedReason?: string;
  }
): Promise<PatternRow | null> {
  const existing = await getPatternById(id);
  if (!existing) {
    return null;
  }

  const now = new Date();
  const fields: string[] = ['updated_at = $1'];
  const params: unknown[] = [now];
  let paramIndex = 2;

  // Build dynamic SET clauses
  if (updates.patternType !== undefined) {
    fields.push(`pattern_type = $${paramIndex}`);
    params.push(updates.patternType);
    paramIndex++;
  }

  if (updates.name !== undefined) {
    fields.push(`name = $${paramIndex}`);
    params.push(updates.name);
    paramIndex++;
  }

  if (updates.description !== undefined) {
    fields.push(`description = $${paramIndex}`);
    params.push(updates.description);
    paramIndex++;
  }

  if (updates.observationIds !== undefined) {
    fields.push(`observation_ids = $${paramIndex}`);
    params.push(updates.observationIds);
    paramIndex++;
    fields.push(`observation_count = $${paramIndex}`);
    params.push(updates.observationIds.length);
    paramIndex++;
  }

  if (updates.confidence !== undefined) {
    fields.push(`confidence = $${paramIndex}`);
    params.push(updates.confidence);
    paramIndex++;
  }

  if (updates.firstObserved !== undefined) {
    fields.push(`first_observed = $${paramIndex}`);
    params.push(updates.firstObserved);
    paramIndex++;
  }

  if (updates.lastObserved !== undefined) {
    fields.push(`last_observed = $${paramIndex}`);
    params.push(updates.lastObserved);
    paramIndex++;
  }

  if (updates.status !== undefined) {
    fields.push(`status = $${paramIndex}`);
    params.push(updates.status);
    paramIndex++;
  }

  if (updates.dismissedReason !== undefined) {
    fields.push(`dismissed_reason = $${paramIndex}`);
    params.push(updates.dismissedReason);
    paramIndex++;
  }

  if (updates.aiAnalysis !== undefined) {
    fields.push(`ai_analysis = $${paramIndex}`);
    params.push(updates.aiAnalysis);
    paramIndex++;
  }

  if (updates.aiRecommendations !== undefined) {
    fields.push(`ai_recommendations = $${paramIndex}`);
    params.push(updates.aiRecommendations);
    paramIndex++;
  }

  // Add ID for WHERE clause
  params.push(id);

  const sql = `
    UPDATE patterns
    SET ${fields.join(', ')}
    WHERE id = $${paramIndex}
    RETURNING *
  `;

  try {
    const result = await query<PatternRow>(sql, params);
    if (result.rows.length > 0) {
      console.log(`[PatternRepo] Updated pattern ${id}`);
      return result.rows[0];
    }
    return null;
  } catch (error) {
    console.error('[PatternRepo] Failed to update pattern:', error);
    return null;
  }
}

/**
 * Soft delete - sets status to dismissed with reason
 * Returns updated row
 */
export async function dismissPattern(id: string, reason: string): Promise<PatternRow | null> {
  return updatePattern(id, {
    status: 'dismissed',
    dismissedReason: reason,
  });
}

/**
 * Mark pattern as superseded by a newer version
 * Sets status to superseded
 * Used when pattern is refined with more observations
 */
export async function supersedePattern(id: string, newPatternId: string): Promise<PatternRow | null> {
  const now = new Date();

  try {
    const result = await query<PatternRow>(
      `UPDATE patterns
       SET status = 'superseded', dismissed_reason = $1, updated_at = $2
       WHERE id = $3
       RETURNING *`,
      [`Superseded by pattern ${newPatternId}`, now, id]
    );

    if (result.rows.length > 0) {
      console.log(`[PatternRepo] Pattern ${id} superseded by ${newPatternId}`);
      return result.rows[0];
    }
    return null;
  } catch (error) {
    console.error('[PatternRepo] Failed to supersede pattern:', error);
    return null;
  }
}

/**
 * Get aggregate statistics for dashboard/monitoring
 * Used by Phase 4 and UI
 */
export async function getPatternStats(): Promise<PatternStats> {
  try {
    // Get basic stats
    const basicResult = await query<{
      total: string;
      avg_confidence: string | null;
      total_observations: string;
      oldest: Date | null;
      newest: Date | null;
    }>(
      `SELECT
        COUNT(*) as total,
        AVG(confidence) as avg_confidence,
        SUM(observation_count) as total_observations,
        MIN(created_at) as oldest,
        MAX(created_at) as newest
       FROM patterns`
    );

    // Get counts by type
    const typeResult = await query<{ pattern_type: string; count: string }>(
      `SELECT pattern_type, COUNT(*) as count
       FROM patterns
       GROUP BY pattern_type`
    );

    // Get counts by status
    const statusResult = await query<{ status: string; count: string }>(
      `SELECT status, COUNT(*) as count
       FROM patterns
       GROUP BY status`
    );

    const basic = basicResult.rows[0] || {};

    const byType: Record<string, number> = {};
    for (const row of typeResult.rows) {
      byType[row.pattern_type] = parseInt(row.count, 10);
    }

    const byStatus: Record<string, number> = {};
    for (const row of statusResult.rows) {
      byStatus[row.status] = parseInt(row.count, 10);
    }

    return {
      total: parseInt(basic.total || '0', 10),
      byType,
      byStatus,
      avgConfidence: basic.avg_confidence ? parseFloat(basic.avg_confidence) : null,
      totalObservations: parseInt(basic.total_observations || '0', 10),
      newestPattern: basic.newest,
      oldestPattern: basic.oldest,
    };
  } catch (error) {
    console.error('[PatternRepo] Failed to get pattern stats:', error);
    return {
      total: 0,
      byType: {},
      byStatus: {},
      avgConfidence: null,
      totalObservations: 0,
      newestPattern: null,
      oldestPattern: null,
    };
  }
}

/**
 * Count patterns created since a specific date
 * Used to check if new patterns have been detected
 */
export async function countPatternsSince(date: Date): Promise<number> {
  try {
    const result = await query<{ count: string }>(
      `SELECT COUNT(*) as count FROM patterns WHERE created_at >= $1`,
      [date]
    );

    return parseInt(result.rows[0]?.count || '0', 10);
  } catch (error) {
    console.error('[PatternRepo] Failed to count patterns:', error);
    return 0;
  }
}

/**
 * Find patterns that reference any of the given observation IDs
 * Used to check if new observations match existing patterns
 */
export async function getPatternsWithObservations(observationIds: string[]): Promise<PatternRow[]> {
  if (observationIds.length === 0) {
    return [];
  }

  try {
    const result = await query<PatternRow>(
      `SELECT * FROM patterns
       WHERE observation_ids && $1::uuid[]
       AND status = 'active'
       ORDER BY confidence DESC`,
      [observationIds]
    );

    return result.rows;
  } catch (error) {
    console.error('[PatternRepo] Failed to get patterns with observations:', error);
    return [];
  }
}

// ============================================
// Analysis Run Functions
// ============================================

/**
 * Row type for pattern analysis runs (audit table)
 */
export interface PatternAnalysisRunRow {
  id: string;
  observations_analyzed: number;
  patterns_detected: number;
  patterns_updated: number;
  config: Record<string, unknown> | null;
  analysis_time_ms: number | null;
  status: string;
  error: string | null;
  started_at: Date;
  completed_at: Date | null;
}

/**
 * Insert a new analysis run record
 */
export async function startAnalysisRun(config: Record<string, unknown> | null = null): Promise<string> {
  const id = randomUUID();

  try {
    await query(
      `INSERT INTO pattern_analysis_runs (id, config, status, started_at)
       VALUES ($1, $2, 'running', NOW())`,
      [id, config ? JSON.stringify(config) : null]
    );

    console.log(`[PatternRepo] Started analysis run ${id}`);
    return id;
  } catch (error) {
    console.error('[PatternRepo] Failed to start analysis run:', error);
    throw error;
  }
}

/**
 * Complete an analysis run with results
 */
export async function completeAnalysisRun(
  runId: string,
  observationsAnalyzed: number,
  patternsDetected: number,
  patternsUpdated: number,
  analysisTimeMs: number
): Promise<void> {
  try {
    await query(
      `UPDATE pattern_analysis_runs
       SET status = 'completed',
           observations_analyzed = $1,
           patterns_detected = $2,
           patterns_updated = $3,
           analysis_time_ms = $4,
           completed_at = NOW()
       WHERE id = $5`,
      [observationsAnalyzed, patternsDetected, patternsUpdated, analysisTimeMs, runId]
    );

    console.log(`[PatternRepo] Completed analysis run ${runId}: ${patternsDetected} detected, ${patternsUpdated} updated`);
  } catch (error) {
    console.error('[PatternRepo] Failed to complete analysis run:', error);
    throw error;
  }
}

/**
 * Mark an analysis run as failed
 */
export async function failAnalysisRun(runId: string, error: string): Promise<void> {
  try {
    await query(
      `UPDATE pattern_analysis_runs
       SET status = 'failed', error = $1, completed_at = NOW()
       WHERE id = $2`,
      [error, runId]
    );

    console.log(`[PatternRepo] Analysis run ${runId} failed: ${error}`);
  } catch (error) {
    console.error('[PatternRepo] Failed to update analysis run failure:', error);
  }
}

/**
 * Get the most recent completed analysis run
 */
export async function getLastCompletedAnalysisRun(): Promise<PatternAnalysisRunRow | null> {
  try {
    const result = await query<PatternAnalysisRunRow>(
      `SELECT * FROM pattern_analysis_runs
       WHERE status = 'completed'
       ORDER BY completed_at DESC
       LIMIT 1`
    );

    return result.rows.length > 0 ? result.rows[0] : null;
  } catch (error) {
    console.error('[PatternRepo] Failed to get last completed analysis run:', error);
    return null;
  }
}

/**
 * Get recent analysis runs for monitoring
 */
export async function getRecentAnalysisRuns(limit: number = 10): Promise<PatternAnalysisRunRow[]> {
  try {
    const result = await query<PatternAnalysisRunRow>(
      `SELECT * FROM pattern_analysis_runs
       ORDER BY started_at DESC
       LIMIT $1`,
      [limit]
    );

    return result.rows;
  } catch (error) {
    console.error('[PatternRepo] Failed to get recent analysis runs:', error);
    return [];
  }
}
