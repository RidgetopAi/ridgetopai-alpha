/**
 * Scheduler Service
 * Manages cron-based scheduled task execution
 */

import * as cron from 'node-cron';
import { randomUUID } from 'crypto';
import { query } from './db.js';
import { createOrchestrationSession, dispatchAllTasks } from './orchestrator.js';
import type {
  ScheduledTaskRuntime,
  CreateScheduleRequest,
  UpdateScheduleRequest,
  TriggerExecutionResult
} from './types.js';

// In-memory cache of active cron jobs
const activeJobs = new Map<string, cron.ScheduledTask>();

// Cache of scheduled tasks loaded from DB
const scheduledTasks = new Map<string, ScheduledTaskRuntime>();

// Server base URL for dispatching tasks
let serverBaseUrl = 'http://localhost:3001';

/**
 * Set the server base URL for task dispatch
 */
export function setServerBaseUrl(url: string): void {
  serverBaseUrl = url;
}

// Track if database is available for scheduler
let dbAvailable = false;

/**
 * Initialize the scheduler - load tasks from DB and start active jobs
 */
export async function initializeScheduler(): Promise<void> {
  console.log('[Scheduler] Initializing...');

  try {
    // Load all scheduled tasks from database
    const result = await query<ScheduledTaskRow>(
      `SELECT * FROM scheduled_tasks ORDER BY created_at DESC`
    );

    dbAvailable = true;

    for (const row of result.rows) {
      const task = rowToScheduledTask(row);
      scheduledTasks.set(task.id, task);

      // Start active jobs
      if (task.status === 'active') {
        startCronJob(task);
      }
    }

    console.log(`[Scheduler] Loaded ${scheduledTasks.size} scheduled tasks, ${activeJobs.size} active`);
  } catch (error) {
    dbAvailable = false;
    console.log('[Scheduler] Database unavailable, running in memory-only mode');
  }
}

/**
 * Create a new scheduled task
 */
export async function createScheduledTask(
  request: CreateScheduleRequest
): Promise<ScheduledTaskRuntime> {
  const id = randomUUID();
  const now = new Date();

  // Validate cron pattern
  if (!cron.validate(request.cronPattern)) {
    throw new Error(`Invalid cron pattern: ${request.cronPattern}`);
  }

  // Calculate next run time
  const nextRunAt = calculateNextRun(request.cronPattern);

  const task: ScheduledTaskRuntime = {
    id,
    name: request.name,
    description: request.description,
    cronPattern: request.cronPattern,
    intentTemplate: request.intentTemplate,
    context: request.context,
    autoDispatch: request.autoDispatch ?? true,
    status: request.status || 'active',
    maxRetries: request.maxRetries ?? 0,
    timeout: request.timeout,
    tags: request.tags,
    runCount: 0,
    nextRunAt,
    createdAt: now,
    updatedAt: now,
  };

  // Save to database if available
  if (dbAvailable) {
    try {
      await query(
        `INSERT INTO scheduled_tasks (
          id, name, description, cron_pattern, intent_template, context,
          auto_dispatch, status, max_retries, timeout, tags,
          next_run_at, run_count, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)`,
        [
          task.id,
          task.name,
          task.description,
          task.cronPattern,
          task.intentTemplate,
          JSON.stringify(task.context),
          task.autoDispatch,
          task.status,
          task.maxRetries,
          task.timeout,
          JSON.stringify(task.tags),
          task.nextRunAt,
          task.runCount,
          task.createdAt,
          task.updatedAt,
        ]
      );
    } catch (err) {
      console.error('[Scheduler] Failed to persist task to DB:', err);
    }
  }

  // Add to cache
  scheduledTasks.set(task.id, task);

  // Start cron job if active
  if (task.status === 'active') {
    startCronJob(task);
  }

  console.log(`[Scheduler] Created task: ${task.name} (${task.cronPattern})`);
  return task;
}

/**
 * Update an existing scheduled task
 */
export async function updateScheduledTask(
  id: string,
  updates: UpdateScheduleRequest
): Promise<ScheduledTaskRuntime | null> {
  const existing = scheduledTasks.get(id);
  if (!existing) {
    return null;
  }

  // Validate cron pattern if changed
  if (updates.cronPattern && !cron.validate(updates.cronPattern)) {
    throw new Error(`Invalid cron pattern: ${updates.cronPattern}`);
  }

  const updated: ScheduledTaskRuntime = {
    ...existing,
    ...updates,
    updatedAt: new Date(),
  };

  // Recalculate next run if cron pattern changed
  if (updates.cronPattern) {
    updated.nextRunAt = calculateNextRun(updates.cronPattern);
  }

  // Update database if available
  if (dbAvailable) {
    try {
      await query(
        `UPDATE scheduled_tasks SET
          name = $1, description = $2, cron_pattern = $3, intent_template = $4,
          context = $5, auto_dispatch = $6, status = $7, max_retries = $8,
          timeout = $9, tags = $10, next_run_at = $11, updated_at = $12
        WHERE id = $13`,
        [
          updated.name,
          updated.description,
          updated.cronPattern,
          updated.intentTemplate,
          JSON.stringify(updated.context),
          updated.autoDispatch,
          updated.status,
          updated.maxRetries,
          updated.timeout,
          JSON.stringify(updated.tags),
          updated.nextRunAt,
          updated.updatedAt,
          id,
        ]
      );
    } catch (err) {
      console.error('[Scheduler] Failed to update task in DB:', err);
    }
  }

  // Update cache
  scheduledTasks.set(id, updated);

  // Handle status changes
  const wasActive = activeJobs.has(id);
  const shouldBeActive = updated.status === 'active';

  if (wasActive && !shouldBeActive) {
    stopCronJob(id);
  } else if (!wasActive && shouldBeActive) {
    startCronJob(updated);
  } else if (wasActive && shouldBeActive && updates.cronPattern) {
    // Restart with new cron pattern
    stopCronJob(id);
    startCronJob(updated);
  }

  console.log(`[Scheduler] Updated task: ${updated.name}`);
  return updated;
}

/**
 * Delete a scheduled task
 */
export async function deleteScheduledTask(id: string): Promise<boolean> {
  const existing = scheduledTasks.get(id);
  if (!existing) {
    return false;
  }

  // Stop cron job if running
  stopCronJob(id);

  // Remove from database if available
  if (dbAvailable) {
    try {
      await query(`DELETE FROM scheduled_tasks WHERE id = $1`, [id]);
    } catch (err) {
      console.error('[Scheduler] Failed to delete task from DB:', err);
    }
  }

  // Remove from cache
  scheduledTasks.delete(id);

  console.log(`[Scheduler] Deleted task: ${existing.name}`);
  return true;
}

/**
 * Get a scheduled task by ID
 */
export function getScheduledTask(id: string): ScheduledTaskRuntime | undefined {
  return scheduledTasks.get(id);
}

/**
 * Get all scheduled tasks
 */
export function getAllScheduledTasks(): ScheduledTaskRuntime[] {
  return Array.from(scheduledTasks.values());
}

/**
 * Get scheduled tasks by status
 */
export function getScheduledTasksByStatus(
  status: 'active' | 'paused' | 'disabled'
): ScheduledTaskRuntime[] {
  return Array.from(scheduledTasks.values()).filter(t => t.status === status);
}

/**
 * Manually trigger a scheduled task (bypasses cron schedule)
 */
export async function triggerScheduledTask(id: string): Promise<TriggerExecutionResult> {
  const task = scheduledTasks.get(id);
  if (!task) {
    return {
      triggerId: id,
      triggerName: 'unknown',
      success: false,
      error: 'Task not found',
      executedAt: new Date(),
    };
  }

  return executeScheduledTask(task);
}

/**
 * Start a cron job for a scheduled task
 */
function startCronJob(task: ScheduledTaskRuntime): void {
  if (activeJobs.has(task.id)) {
    console.log(`[Scheduler] Job already running for: ${task.name}`);
    return;
  }

  const job = cron.schedule(task.cronPattern, async () => {
    console.log(`[Scheduler] Cron triggered: ${task.name}`);
    await executeScheduledTask(task);
  }, {
    scheduled: true,
    timezone: 'UTC',
  });

  activeJobs.set(task.id, job);
  console.log(`[Scheduler] Started job: ${task.name} (${task.cronPattern})`);
}

/**
 * Stop a cron job
 */
function stopCronJob(id: string): void {
  const job = activeJobs.get(id);
  if (job) {
    job.stop();
    activeJobs.delete(id);
    console.log(`[Scheduler] Stopped job: ${id}`);
  }
}

/**
 * Execute a scheduled task - create orchestration session and dispatch
 */
async function executeScheduledTask(task: ScheduledTaskRuntime): Promise<TriggerExecutionResult> {
  const executionId = randomUUID();
  const now = new Date();

  try {
    console.log(`[Scheduler] Executing: ${task.name}`);

    // Map urgency: medium -> normal for orchestrator compatibility
    const mapUrgency = (u?: 'low' | 'medium' | 'high'): 'low' | 'normal' | 'high' | undefined => {
      if (!u) return undefined;
      return u === 'medium' ? 'normal' : u;
    };

    // Generate session ID
    const sessionId = `sched-${task.id}-${randomUUID().slice(0, 8)}`;

    // Create orchestration session with intent from template
    const session = await createOrchestrationSession({
      sessionId,
      intent: task.intentTemplate,
      context: task.context ? {
        focus: task.context.focus,
        urgency: mapUrgency(task.context.urgency),
        constraints: task.context.constraints?.join(', '),
      } : undefined,
    });

    // Auto-dispatch if enabled
    if (task.autoDispatch) {
      await dispatchAllTasks(session.sessionId, serverBaseUrl);
    }

    // Update task runtime info
    const nextRunAt = calculateNextRun(task.cronPattern);
    if (dbAvailable) {
      query(
        `UPDATE scheduled_tasks SET
          last_run_at = $1, next_run_at = $2, run_count = run_count + 1,
          last_result = 'success', last_session_id = $3, updated_at = $4
        WHERE id = $5`,
        [now, nextRunAt, session.sessionId, now, task.id]
      ).catch(err => console.error('[Scheduler] Failed to update task status:', err));
    }

    // Update cache
    const updated = scheduledTasks.get(task.id);
    if (updated) {
      updated.lastRunAt = now;
      updated.nextRunAt = nextRunAt;
      updated.runCount += 1;
      updated.lastResult = 'success';
      updated.lastSessionId = session.sessionId;
      updated.updatedAt = now;
    }

    // Log execution
    await logTriggerExecution(executionId, task.id, 'schedule', session.sessionId, true);

    console.log(`[Scheduler] Executed: ${task.name} -> session ${session.sessionId}`);

    return {
      triggerId: task.id,
      triggerName: task.name,
      sessionId: session.sessionId,
      success: true,
      executedAt: now,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[Scheduler] Execution failed for ${task.name}:`, errorMessage);

    // Update failure info if DB available
    if (dbAvailable) {
      query(
        `UPDATE scheduled_tasks SET
          last_run_at = $1, run_count = run_count + 1,
          last_result = 'failure', updated_at = $2
        WHERE id = $3`,
        [now, now, task.id]
      ).catch(err => console.error('[Scheduler] Failed to update failure status:', err));
    }

    // Log failed execution
    await logTriggerExecution(executionId, task.id, 'schedule', undefined, false, errorMessage);

    return {
      triggerId: task.id,
      triggerName: task.name,
      success: false,
      error: errorMessage,
      executedAt: now,
    };
  }
}

/**
 * Log a trigger execution for audit
 */
async function logTriggerExecution(
  id: string,
  triggerId: string,
  triggerType: string,
  sessionId: string | undefined,
  success: boolean,
  error?: string,
  eventPayload?: unknown
): Promise<void> {
  if (!dbAvailable) return;

  try {
    await query(
      `INSERT INTO trigger_executions (id, trigger_id, trigger_type, session_id, success, error, event_payload)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [id, triggerId, triggerType, sessionId, success, error, eventPayload ? JSON.stringify(eventPayload) : null]
    );
  } catch (err) {
    console.error('[Scheduler] Failed to log execution:', err);
  }
}

/**
 * Calculate the next run time for a cron pattern
 */
function calculateNextRun(cronPattern: string): Date {
  // Simple calculation - node-cron doesn't expose next run directly
  // We'll parse the pattern and estimate
  const now = new Date();

  // For simplicity, return now + 1 minute minimum
  // In production, use a proper cron parser like cron-parser
  const next = new Date(now.getTime() + 60000);
  return next;
}

/**
 * Stop all cron jobs (for graceful shutdown)
 */
export function stopAllJobs(): void {
  for (const [id, job] of activeJobs) {
    job.stop();
    console.log(`[Scheduler] Stopped job: ${id}`);
  }
  activeJobs.clear();
  console.log('[Scheduler] All jobs stopped');
}

/**
 * Get scheduler statistics
 */
export function getSchedulerStats(): {
  totalTasks: number;
  activeTasks: number;
  pausedTasks: number;
  disabledTasks: number;
  runningJobs: number;
} {
  const tasks = Array.from(scheduledTasks.values());
  return {
    totalTasks: tasks.length,
    activeTasks: tasks.filter(t => t.status === 'active').length,
    pausedTasks: tasks.filter(t => t.status === 'paused').length,
    disabledTasks: tasks.filter(t => t.status === 'disabled').length,
    runningJobs: activeJobs.size,
  };
}

// Database row type
interface ScheduledTaskRow {
  id: string;
  name: string;
  description: string | null;
  cron_pattern: string;
  intent_template: string;
  context: unknown;
  auto_dispatch: boolean;
  status: string;
  max_retries: number;
  timeout: number | null;
  tags: unknown;
  last_run_at: Date | null;
  next_run_at: Date | null;
  run_count: number;
  last_result: string | null;
  last_session_id: string | null;
  created_at: Date;
  updated_at: Date;
}

/**
 * Convert database row to ScheduledTaskRuntime
 */
function rowToScheduledTask(row: ScheduledTaskRow): ScheduledTaskRuntime {
  return {
    id: row.id,
    name: row.name,
    description: row.description ?? undefined,
    cronPattern: row.cron_pattern,
    intentTemplate: row.intent_template,
    context: row.context as ScheduledTaskRuntime['context'],
    autoDispatch: row.auto_dispatch,
    status: row.status as 'active' | 'paused' | 'disabled',
    maxRetries: row.max_retries,
    timeout: row.timeout ?? undefined,
    tags: row.tags as string[] | undefined,
    lastRunAt: row.last_run_at ?? undefined,
    nextRunAt: row.next_run_at ?? undefined,
    runCount: row.run_count,
    lastResult: row.last_result as 'success' | 'failure' | 'timeout' | undefined,
    lastSessionId: row.last_session_id ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
