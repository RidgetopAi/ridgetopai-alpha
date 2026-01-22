/**
 * Session Store - Persistent Storage for Orchestration Sessions
 *
 * Provides a hybrid in-memory + PostgreSQL storage layer for orchestration sessions.
 * In-memory cache for fast reads, PostgreSQL for durability.
 */

import { query, checkConnection, initializeSchema } from './db.js';
import type { OrchestrationSession } from './orchestrator.js';

// In-memory cache for fast access
const sessionCache = new Map<string, OrchestrationSession>();

// Database availability flag
let dbAvailable = false;

/**
 * Initialize the session store
 * Loads existing sessions from database into memory
 */
export async function initializeSessionStore(): Promise<void> {
  console.log('[SessionStore] Initializing...');

  // Check database connection
  dbAvailable = await checkConnection();

  if (dbAvailable) {
    // Initialize schema (creates tables if not exist)
    await initializeSchema();

    // Load existing sessions into cache
    await loadSessionsFromDatabase();

    console.log('[SessionStore] Initialized with database persistence');
  } else {
    console.warn('[SessionStore] Database unavailable, running in memory-only mode');
  }
}

/**
 * Load all sessions from database into memory cache
 */
async function loadSessionsFromDatabase(): Promise<void> {
  try {
    const result = await query<{
      session_id: string;
      intent: string;
      context: OrchestrationSession['context'];
      interpretation: OrchestrationSession['interpretation'];
      execution: OrchestrationSession['execution'];
      created_at: Date;
      updated_at: Date;
    }>(`
      SELECT session_id, intent, context, interpretation, execution, created_at, updated_at
      FROM orchestration_sessions
      ORDER BY created_at DESC
      LIMIT 100
    `);

    for (const row of result.rows) {
      const session: OrchestrationSession = {
        sessionId: row.session_id,
        intent: row.intent,
        context: row.context,
        interpretation: row.interpretation,
        execution: row.execution,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      };
      sessionCache.set(session.sessionId, session);
    }

    console.log(`[SessionStore] Loaded ${result.rows.length} sessions from database`);
  } catch (error) {
    console.error('[SessionStore] Failed to load sessions:', error);
  }
}

/**
 * Save a session (creates or updates)
 */
export async function saveSession(session: OrchestrationSession): Promise<void> {
  // Always update cache
  sessionCache.set(session.sessionId, session);

  // Persist to database if available
  if (dbAvailable) {
    try {
      await query(`
        INSERT INTO orchestration_sessions (
          session_id, intent, context, interpretation, execution, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT (session_id) DO UPDATE SET
          intent = EXCLUDED.intent,
          context = EXCLUDED.context,
          interpretation = EXCLUDED.interpretation,
          execution = EXCLUDED.execution,
          updated_at = EXCLUDED.updated_at
      `, [
        session.sessionId,
        session.intent,
        JSON.stringify(session.context),
        JSON.stringify(session.interpretation),
        JSON.stringify(session.execution),
        session.createdAt,
        session.updatedAt,
      ]);
    } catch (error) {
      console.error('[SessionStore] Failed to save session:', error);
      // Don't throw - cache still has the data
    }
  }
}

/**
 * Get a session by ID
 */
export function getSession(sessionId: string): OrchestrationSession | undefined {
  return sessionCache.get(sessionId);
}

/**
 * Get all sessions
 */
export function getAllSessions(): OrchestrationSession[] {
  return Array.from(sessionCache.values());
}

/**
 * Delete a session
 */
export async function deleteSession(sessionId: string): Promise<void> {
  // Remove from cache
  sessionCache.delete(sessionId);

  // Remove from database if available
  if (dbAvailable) {
    try {
      await query('DELETE FROM orchestration_sessions WHERE session_id = $1', [sessionId]);
    } catch (error) {
      console.error('[SessionStore] Failed to delete session:', error);
    }
  }
}

/**
 * Get sessions by status (for filtering completed/active)
 */
export function getSessionsByStatus(status: 'active' | 'completed' | 'failed'): OrchestrationSession[] {
  return Array.from(sessionCache.values()).filter(session => {
    const { execution } = session;
    const allDone = execution.pending === 0 && execution.running === 0;

    switch (status) {
      case 'active':
        return !allDone;
      case 'completed':
        return allDone && execution.failed === 0;
      case 'failed':
        return allDone && execution.failed > 0;
    }
  });
}

/**
 * Get session count
 */
export function getSessionCount(): number {
  return sessionCache.size;
}

/**
 * Check if database persistence is available
 */
export function isDatabaseAvailable(): boolean {
  return dbAvailable;
}

// ==========================================
// Workflow Status Storage
// ==========================================

// In-memory workflow status cache
const workflowStatusCache = new Map<string, {
  workflowId: string;
  workflowType: string;
  status: string;
  message?: string;
  progress?: number;
  result?: unknown;
}>();

/**
 * Save workflow status
 */
export async function saveWorkflowStatus(
  workflowId: string,
  workflowType: string,
  status: string,
  message?: string,
  progress?: number,
  result?: unknown
): Promise<void> {
  // Update cache
  workflowStatusCache.set(workflowId, {
    workflowId,
    workflowType,
    status,
    message,
    progress,
    result,
  });

  // Persist to database if available
  if (dbAvailable) {
    try {
      await query(`
        INSERT INTO workflow_status (
          workflow_id, workflow_type, status, message, progress, result, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, NOW())
        ON CONFLICT (workflow_id) DO UPDATE SET
          status = EXCLUDED.status,
          message = EXCLUDED.message,
          progress = EXCLUDED.progress,
          result = EXCLUDED.result,
          updated_at = NOW()
      `, [
        workflowId,
        workflowType,
        status,
        message,
        progress,
        result ? JSON.stringify(result) : null,
      ]);
    } catch (error) {
      console.error('[SessionStore] Failed to save workflow status:', error);
    }
  }
}

/**
 * Get workflow status
 */
export function getWorkflowStatus(workflowId: string) {
  return workflowStatusCache.get(workflowId);
}

/**
 * Load workflow statuses from database
 */
export async function loadWorkflowStatuses(): Promise<void> {
  if (!dbAvailable) return;

  try {
    const result = await query<{
      workflow_id: string;
      workflow_type: string;
      status: string;
      message: string | null;
      progress: number | null;
      result: unknown;
    }>(`
      SELECT workflow_id, workflow_type, status, message, progress, result
      FROM workflow_status
      WHERE created_at > NOW() - INTERVAL '24 hours'
      ORDER BY created_at DESC
    `);

    for (const row of result.rows) {
      workflowStatusCache.set(row.workflow_id, {
        workflowId: row.workflow_id,
        workflowType: row.workflow_type,
        status: row.status,
        message: row.message ?? undefined,
        progress: row.progress ?? undefined,
        result: row.result,
      });
    }

    console.log(`[SessionStore] Loaded ${result.rows.length} workflow statuses`);
  } catch (error) {
    console.error('[SessionStore] Failed to load workflow statuses:', error);
  }
}
