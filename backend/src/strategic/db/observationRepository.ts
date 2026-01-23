/**
 * Observation Repository - Database access layer for pattern_observations
 * Strategic Layer Phase 1: Observation Layer
 *
 * Provides CRUD operations and query functions for workflow observations.
 * These observations feed into Phase 2 (Pattern Detection) for analysis.
 */

import { query } from '../../db.js';

// ============================================
// TypeScript Interfaces
// ============================================

/**
 * Row type matching PostgreSQL pattern_observations table structure
 */
export interface ObservationRow {
  id: string;
  observation_type: string;
  source_workflow: string;
  source_capability: string;
  payload: Record<string, unknown>;
  outcome: string;
  confidence_score: number | null;
  duration_ms: number | null;
  tags: string[];
  observed_at: Date;
  created_at: Date;
}

/**
 * Input for creating a new observation (id and created_at auto-generated)
 */
export interface ObservationInput {
  observationType?: string; // defaults to 'workflow_completion'
  sourceWorkflow: string;   // bugfix, content, support, monitoring
  sourceCapability: string; // PRODUCE, GROW, OPERATE, COMMAND
  payload: Record<string, unknown>;
  outcome: string;          // success, failure, partial
  confidenceScore?: number; // 0.0-1.0
  durationMs?: number;
  tags?: string[];
  observedAt?: Date;
}

/**
 * Query options for filtering observations
 */
export interface ObservationQueryOptions {
  sourceWorkflow?: string | string[];  // Filter by workflow type
  sourceCapability?: string;           // Filter by capability
  outcome?: string;                     // Filter by outcome
  observationType?: string;            // Filter by observation type
  sinceDate?: Date;                     // Filter by date range start
  untilDate?: Date;                     // Filter by date range end
  tags?: string[];                      // Filter by tags (ANY match)
  limit?: number;                       // Max results (default 100)
  offset?: number;                      // Pagination offset
  orderBy?: 'observed_at' | 'created_at';
  orderDir?: 'ASC' | 'DESC';
}

/**
 * Summary statistics for observations
 */
export interface ObservationStats {
  total: number;
  byWorkflow: Record<string, number>;
  byOutcome: Record<string, number>;
  byCapability: Record<string, number>;
  avgConfidence: number | null;
  avgDuration: number | null;
  oldestDate: Date | null;
  newestDate: Date | null;
}

// ============================================
// Repository Functions
// ============================================

/**
 * Insert a new observation into pattern_observations
 * Returns the inserted row or null on failure
 */
export async function insertObservation(input: ObservationInput): Promise<ObservationRow | null> {
  const observedAt = input.observedAt || new Date();

  try {
    // Let PostgreSQL generate the UUID via gen_random_uuid()
    const result = await query<ObservationRow>(
      `INSERT INTO pattern_observations
        (observation_type, source_workflow, source_capability, payload, outcome, confidence_score, duration_ms, tags, observed_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [
        input.observationType || 'workflow_completion',
        input.sourceWorkflow,
        input.sourceCapability,
        JSON.stringify(input.payload),
        input.outcome,
        input.confidenceScore ?? null,
        input.durationMs ?? null,
        input.tags || [],
        observedAt,
      ]
    );

    if (result.rows.length > 0) {
      console.log(`[ObservationRepo] Inserted observation ${result.rows[0].id} for ${input.sourceWorkflow}`);
      return result.rows[0];
    }
    return null;
  } catch (error) {
    console.error('[ObservationRepo] Failed to insert observation:', error);
    return null;
  }
}

/**
 * Retrieve a single observation by UUID
 * Returns null if not found
 */
export async function getObservationById(id: string): Promise<ObservationRow | null> {
  try {
    const result = await query<ObservationRow>(
      `SELECT * FROM pattern_observations WHERE id = $1`,
      [id]
    );

    return result.rows.length > 0 ? result.rows[0] : null;
  } catch (error) {
    console.error('[ObservationRepo] Failed to get observation by ID:', error);
    return null;
  }
}

/**
 * Flexible query with filters and pagination
 * Default limit 100, ordered by observed_at DESC
 */
export async function queryObservations(options: ObservationQueryOptions = {}): Promise<ObservationRow[]> {
  const {
    sourceWorkflow,
    sourceCapability,
    outcome,
    observationType,
    sinceDate,
    untilDate,
    tags,
    limit = 100,
    offset = 0,
    orderBy = 'observed_at',
    orderDir = 'DESC',
  } = options;

  const conditions: string[] = [];
  const params: unknown[] = [];
  let paramIndex = 1;

  // Build dynamic WHERE clauses
  if (sourceWorkflow) {
    if (Array.isArray(sourceWorkflow)) {
      conditions.push(`source_workflow = ANY($${paramIndex}::text[])`);
      params.push(sourceWorkflow);
    } else {
      conditions.push(`source_workflow = $${paramIndex}`);
      params.push(sourceWorkflow);
    }
    paramIndex++;
  }

  if (sourceCapability) {
    conditions.push(`source_capability = $${paramIndex}`);
    params.push(sourceCapability);
    paramIndex++;
  }

  if (outcome) {
    conditions.push(`outcome = $${paramIndex}`);
    params.push(outcome);
    paramIndex++;
  }

  if (observationType) {
    conditions.push(`observation_type = $${paramIndex}`);
    params.push(observationType);
    paramIndex++;
  }

  if (sinceDate) {
    conditions.push(`observed_at >= $${paramIndex}`);
    params.push(sinceDate);
    paramIndex++;
  }

  if (untilDate) {
    conditions.push(`observed_at <= $${paramIndex}`);
    params.push(untilDate);
    paramIndex++;
  }

  if (tags && tags.length > 0) {
    conditions.push(`tags && $${paramIndex}::text[]`);
    params.push(tags);
    paramIndex++;
  }

  // Build WHERE clause
  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  // Validate order columns to prevent SQL injection
  const validOrderBy = ['observed_at', 'created_at'].includes(orderBy) ? orderBy : 'observed_at';
  const validOrderDir = ['ASC', 'DESC'].includes(orderDir.toUpperCase()) ? orderDir.toUpperCase() : 'DESC';

  // Add limit and offset
  params.push(limit);
  params.push(offset);

  const sql = `
    SELECT * FROM pattern_observations
    ${whereClause}
    ORDER BY ${validOrderBy} ${validOrderDir}
    LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
  `;

  try {
    const result = await query<ObservationRow>(sql, params);
    return result.rows;
  } catch (error) {
    console.error('[ObservationRepo] Failed to query observations:', error);
    return [];
  }
}

/**
 * Convenience function for workflow-specific queries
 * Default limit 50
 */
export async function getObservationsByWorkflow(
  workflow: string,
  limit: number = 50
): Promise<ObservationRow[]> {
  return queryObservations({
    sourceWorkflow: workflow,
    limit,
  });
}

/**
 * Get most recent observations across all workflows
 * Ordered by observed_at DESC
 */
export async function getRecentObservations(limit: number = 20): Promise<ObservationRow[]> {
  return queryObservations({
    limit,
    orderBy: 'observed_at',
    orderDir: 'DESC',
  });
}

/**
 * Get aggregate statistics for Phase 2 pattern analysis
 */
export async function getObservationStats(): Promise<ObservationStats> {
  try {
    // Get basic stats
    const basicResult = await query<{
      total: string;
      avg_confidence: string | null;
      avg_duration: string | null;
      oldest: Date | null;
      newest: Date | null;
    }>(
      `SELECT
        COUNT(*) as total,
        AVG(confidence_score) as avg_confidence,
        AVG(duration_ms) as avg_duration,
        MIN(observed_at) as oldest,
        MAX(observed_at) as newest
       FROM pattern_observations`
    );

    // Get counts by workflow
    const workflowResult = await query<{ source_workflow: string; count: string }>(
      `SELECT source_workflow, COUNT(*) as count
       FROM pattern_observations
       GROUP BY source_workflow`
    );

    // Get counts by outcome
    const outcomeResult = await query<{ outcome: string; count: string }>(
      `SELECT outcome, COUNT(*) as count
       FROM pattern_observations
       GROUP BY outcome`
    );

    // Get counts by capability
    const capabilityResult = await query<{ source_capability: string; count: string }>(
      `SELECT source_capability, COUNT(*) as count
       FROM pattern_observations
       GROUP BY source_capability`
    );

    const basic = basicResult.rows[0] || {};

    const byWorkflow: Record<string, number> = {};
    for (const row of workflowResult.rows) {
      byWorkflow[row.source_workflow] = parseInt(row.count, 10);
    }

    const byOutcome: Record<string, number> = {};
    for (const row of outcomeResult.rows) {
      byOutcome[row.outcome] = parseInt(row.count, 10);
    }

    const byCapability: Record<string, number> = {};
    for (const row of capabilityResult.rows) {
      byCapability[row.source_capability] = parseInt(row.count, 10);
    }

    return {
      total: parseInt(basic.total || '0', 10),
      byWorkflow,
      byOutcome,
      byCapability,
      avgConfidence: basic.avg_confidence ? parseFloat(basic.avg_confidence) : null,
      avgDuration: basic.avg_duration ? parseFloat(basic.avg_duration) : null,
      oldestDate: basic.oldest,
      newestDate: basic.newest,
    };
  } catch (error) {
    console.error('[ObservationRepo] Failed to get observation stats:', error);
    return {
      total: 0,
      byWorkflow: {},
      byOutcome: {},
      byCapability: {},
      avgConfidence: null,
      avgDuration: null,
      oldestDate: null,
      newestDate: null,
    };
  }
}

/**
 * Count observations since a specific date
 * Used to trigger pattern analysis after threshold
 */
export async function countObservationsSince(date: Date): Promise<number> {
  try {
    const result = await query<{ count: string }>(
      `SELECT COUNT(*) as count FROM pattern_observations WHERE observed_at >= $1`,
      [date]
    );

    return parseInt(result.rows[0]?.count || '0', 10);
  } catch (error) {
    console.error('[ObservationRepo] Failed to count observations:', error);
    return 0;
  }
}

/**
 * Get the timestamp of the most recent observation
 * Useful for determining if new observations have been added
 */
export async function getLatestObservationTime(): Promise<Date | null> {
  try {
    const result = await query<{ latest: Date | null }>(
      `SELECT MAX(observed_at) as latest FROM pattern_observations`
    );

    return result.rows[0]?.latest || null;
  } catch (error) {
    console.error('[ObservationRepo] Failed to get latest observation time:', error);
    return null;
  }
}

/**
 * Delete observations older than a given date (for cleanup)
 * Returns number of deleted rows
 */
export async function deleteObservationsBefore(date: Date): Promise<number> {
  try {
    const result = await query(
      `DELETE FROM pattern_observations WHERE observed_at < $1`,
      [date]
    );

    const deleted = result.rowCount || 0;
    console.log(`[ObservationRepo] Deleted ${deleted} observations before ${date.toISOString()}`);
    return deleted;
  } catch (error) {
    console.error('[ObservationRepo] Failed to delete old observations:', error);
    return 0;
  }
}
