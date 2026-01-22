/**
 * Event Trigger Service
 * Manages webhook-based and event-driven workflow automation
 */

import { randomUUID } from 'crypto';
import { createHmac } from 'crypto';
import { query } from './db.js';
import { createOrchestrationSession, dispatchAllTasks } from './orchestrator.js';
import type {
  EventTriggerRuntime,
  CreateEventTriggerRequest,
  UpdateEventTriggerRequest,
  WebhookEvent,
  TriggerExecutionResult,
  EventSource,
} from './types.js';

// In-memory cache of event triggers
const eventTriggers = new Map<string, EventTriggerRuntime>();

// Server base URL for dispatching tasks
let serverBaseUrl = 'http://localhost:3001';

// Track if database is available
let dbAvailable = false;

/**
 * Set the server base URL for task dispatch
 */
export function setEventTriggerServerUrl(url: string): void {
  serverBaseUrl = url;
}

/**
 * Initialize event triggers - load from DB
 */
export async function initializeEventTriggers(): Promise<void> {
  console.log('[EventTrigger] Initializing...');

  try {
    const result = await query<EventTriggerRow>(
      `SELECT * FROM event_triggers ORDER BY created_at DESC`
    );

    dbAvailable = true;

    for (const row of result.rows) {
      const trigger = rowToEventTrigger(row);
      eventTriggers.set(trigger.id, trigger);
    }

    console.log(`[EventTrigger] Loaded ${eventTriggers.size} event triggers`);
  } catch (error) {
    dbAvailable = false;
    console.log('[EventTrigger] Database unavailable, running in memory-only mode');
  }
}

/**
 * Create a new event trigger
 */
export async function createEventTrigger(
  request: CreateEventTriggerRequest
): Promise<EventTriggerRuntime> {
  const id = randomUUID();
  const now = new Date();

  // Generate webhook secret for verification
  const webhookSecret = generateWebhookSecret();

  const trigger: EventTriggerRuntime = {
    id,
    name: request.name,
    description: request.description,
    source: request.source,
    eventType: request.eventType,
    conditions: request.conditions,
    intentTemplate: request.intentTemplate,
    contextMapping: request.contextMapping,
    autoDispatch: request.autoDispatch ?? true,
    status: request.status || 'active',
    tags: request.tags,
    webhookSecret,
    triggerCount: 0,
    createdAt: now,
    updatedAt: now,
  };

  // Save to database if available
  if (dbAvailable) {
    try {
      await query(
        `INSERT INTO event_triggers (
          id, name, description, source, event_type, conditions, intent_template,
          context_mapping, auto_dispatch, status, tags, webhook_secret,
          trigger_count, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)`,
        [
          trigger.id,
          trigger.name,
          trigger.description,
          trigger.source,
          trigger.eventType,
          JSON.stringify(trigger.conditions),
          trigger.intentTemplate,
          JSON.stringify(trigger.contextMapping),
          trigger.autoDispatch,
          trigger.status,
          JSON.stringify(trigger.tags),
          trigger.webhookSecret,
          trigger.triggerCount,
          trigger.createdAt,
          trigger.updatedAt,
        ]
      );
    } catch (err) {
      console.error('[EventTrigger] Failed to persist trigger to DB:', err);
    }
  }

  // Add to cache
  eventTriggers.set(trigger.id, trigger);

  console.log(`[EventTrigger] Created: ${trigger.name} (${trigger.source}/${trigger.eventType})`);
  return trigger;
}

/**
 * Update an existing event trigger
 */
export async function updateEventTrigger(
  id: string,
  updates: UpdateEventTriggerRequest
): Promise<EventTriggerRuntime | null> {
  const existing = eventTriggers.get(id);
  if (!existing) {
    return null;
  }

  const updated: EventTriggerRuntime = {
    ...existing,
    ...updates,
    updatedAt: new Date(),
  };

  // Update database if available
  if (dbAvailable) {
    try {
      await query(
        `UPDATE event_triggers SET
          name = $1, description = $2, source = $3, event_type = $4, conditions = $5,
          intent_template = $6, context_mapping = $7, auto_dispatch = $8, status = $9,
          tags = $10, updated_at = $11
        WHERE id = $12`,
        [
          updated.name,
          updated.description,
          updated.source,
          updated.eventType,
          JSON.stringify(updated.conditions),
          updated.intentTemplate,
          JSON.stringify(updated.contextMapping),
          updated.autoDispatch,
          updated.status,
          JSON.stringify(updated.tags),
          updated.updatedAt,
          id,
        ]
      );
    } catch (err) {
      console.error('[EventTrigger] Failed to update trigger in DB:', err);
    }
  }

  // Update cache
  eventTriggers.set(id, updated);

  console.log(`[EventTrigger] Updated: ${updated.name}`);
  return updated;
}

/**
 * Delete an event trigger
 */
export async function deleteEventTrigger(id: string): Promise<boolean> {
  const existing = eventTriggers.get(id);
  if (!existing) {
    return false;
  }

  // Remove from database if available
  if (dbAvailable) {
    try {
      await query(`DELETE FROM event_triggers WHERE id = $1`, [id]);
    } catch (err) {
      console.error('[EventTrigger] Failed to delete trigger from DB:', err);
    }
  }

  // Remove from cache
  eventTriggers.delete(id);

  console.log(`[EventTrigger] Deleted: ${existing.name}`);
  return true;
}

/**
 * Get an event trigger by ID
 */
export function getEventTrigger(id: string): EventTriggerRuntime | undefined {
  return eventTriggers.get(id);
}

/**
 * Get all event triggers
 */
export function getAllEventTriggers(): EventTriggerRuntime[] {
  return Array.from(eventTriggers.values());
}

/**
 * Get event triggers by source
 */
export function getEventTriggersBySource(source: EventSource): EventTriggerRuntime[] {
  return Array.from(eventTriggers.values()).filter(t => t.source === source && t.status === 'active');
}

/**
 * Process an incoming webhook event
 */
export async function processWebhookEvent(event: WebhookEvent): Promise<TriggerExecutionResult[]> {
  const results: TriggerExecutionResult[] = [];

  // Find matching triggers
  const triggers = findMatchingTriggers(event);

  if (triggers.length === 0) {
    console.log(`[EventTrigger] No matching triggers for ${event.source}/${event.eventType}`);
    return results;
  }

  console.log(`[EventTrigger] Found ${triggers.length} matching triggers for ${event.source}/${event.eventType}`);

  // Execute each matching trigger
  for (const trigger of triggers) {
    const result = await executeEventTrigger(trigger, event);
    results.push(result);
  }

  return results;
}

/**
 * Find triggers that match the incoming event
 */
function findMatchingTriggers(event: WebhookEvent): EventTriggerRuntime[] {
  return Array.from(eventTriggers.values()).filter(trigger => {
    // Check status
    if (trigger.status !== 'active') {
      return false;
    }

    // Check source and event type
    if (trigger.source !== event.source) {
      return false;
    }

    // Event type can be exact match or wildcard (*)
    if (trigger.eventType !== '*' && trigger.eventType !== event.eventType) {
      return false;
    }

    // Check conditions
    if (trigger.conditions && trigger.conditions.length > 0) {
      const conditionsMet = trigger.conditions.every(condition => {
        if (!condition.field || !condition.operator) {
          return true; // Skip invalid conditions
        }

        const fieldValue = getNestedValue(event.payload, condition.field);
        return evaluateCondition(fieldValue, condition.operator, condition.value);
      });

      if (!conditionsMet) {
        return false;
      }
    }

    return true;
  });
}

/**
 * Execute an event trigger
 */
async function executeEventTrigger(
  trigger: EventTriggerRuntime,
  event: WebhookEvent
): Promise<TriggerExecutionResult> {
  const executionId = randomUUID();
  const now = new Date();

  try {
    console.log(`[EventTrigger] Executing: ${trigger.name}`);

    // Build intent from template with variable substitution
    const intent = buildIntentFromTemplate(trigger.intentTemplate, event.payload);

    // Build context from mapping
    const context = buildContextFromMapping(trigger.contextMapping, event.payload);

    // Generate session ID
    const sessionId = `evt-${trigger.id.slice(0, 8)}-${randomUUID().slice(0, 8)}`;

    // Create orchestration session
    const session = await createOrchestrationSession({
      sessionId,
      intent,
      context: context || undefined,
    });

    // Auto-dispatch if enabled
    if (trigger.autoDispatch) {
      await dispatchAllTasks(session.sessionId, serverBaseUrl);
    }

    // Update trigger runtime info if DB available
    if (dbAvailable) {
      query(
        `UPDATE event_triggers SET
          trigger_count = trigger_count + 1, last_triggered_at = $1,
          last_session_id = $2, updated_at = $3
        WHERE id = $4`,
        [now, session.sessionId, now, trigger.id]
      ).catch(err => console.error('[EventTrigger] Failed to update trigger stats:', err));
    }

    // Update cache
    const cached = eventTriggers.get(trigger.id);
    if (cached) {
      cached.triggerCount += 1;
      cached.lastTriggeredAt = now;
      cached.lastSessionId = session.sessionId;
      cached.updatedAt = now;
    }

    // Log execution
    await logTriggerExecution(executionId, trigger.id, 'event', session.sessionId, true, undefined, event.payload);

    console.log(`[EventTrigger] Executed: ${trigger.name} -> session ${session.sessionId}`);

    return {
      triggerId: trigger.id,
      triggerName: trigger.name,
      sessionId: session.sessionId,
      success: true,
      executedAt: now,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[EventTrigger] Execution failed for ${trigger.name}:`, errorMessage);

    // Log failed execution
    await logTriggerExecution(executionId, trigger.id, 'event', undefined, false, errorMessage, event.payload);

    return {
      triggerId: trigger.id,
      triggerName: trigger.name,
      success: false,
      error: errorMessage,
      executedAt: now,
    };
  }
}

/**
 * Build intent string from template with variable substitution
 * Template format: "Analyze issue {{issue.title}} from {{repo.name}}"
 */
function buildIntentFromTemplate(template: string, payload: Record<string, unknown>): string {
  return template.replace(/\{\{([^}]+)\}\}/g, (match, path) => {
    const value = getNestedValue(payload, path.trim());
    return value !== undefined ? String(value) : match;
  });
}

/**
 * Build context object from mapping
 * Maps to orchestrator context format: { focus, urgency, constraints, projectPath }
 */
function buildContextFromMapping(
  mapping: Record<string, string> | undefined,
  payload: Record<string, unknown>
): { focus?: string; urgency?: 'low' | 'normal' | 'high'; constraints?: string; projectPath?: string } | null {
  if (!mapping) {
    return null;
  }

  const context: { focus?: string; urgency?: 'low' | 'normal' | 'high'; constraints?: string; projectPath?: string } = {};

  if (mapping.focus) {
    const focusValue = getNestedValue(payload, mapping.focus);
    if (focusValue) {
      context.focus = String(focusValue);
    }
  }

  if (mapping.urgency) {
    const urgencyValue = getNestedValue(payload, mapping.urgency);
    if (urgencyValue) {
      // Map 'medium' to 'normal' for orchestrator compatibility
      const urgency = String(urgencyValue);
      if (urgency === 'medium') {
        context.urgency = 'normal';
      } else if (['low', 'normal', 'high'].includes(urgency)) {
        context.urgency = urgency as 'low' | 'normal' | 'high';
      }
    }
  }

  if (mapping.constraints) {
    const constraintsValue = getNestedValue(payload, mapping.constraints);
    if (Array.isArray(constraintsValue)) {
      context.constraints = constraintsValue.map(String).join(', ');
    } else if (constraintsValue) {
      context.constraints = String(constraintsValue);
    }
  }

  if (mapping.projectPath) {
    const pathValue = getNestedValue(payload, mapping.projectPath);
    if (pathValue) {
      context.projectPath = String(pathValue);
    }
  }

  return Object.keys(context).length > 0 ? context : null;
}

/**
 * Get a nested value from an object using dot notation
 */
function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  const parts = path.split('.');
  let current: unknown = obj;

  for (const part of parts) {
    if (current === null || current === undefined) {
      return undefined;
    }
    if (typeof current === 'object') {
      current = (current as Record<string, unknown>)[part];
    } else {
      return undefined;
    }
  }

  return current;
}

/**
 * Evaluate a condition against a value
 */
function evaluateCondition(
  fieldValue: unknown,
  operator: string,
  conditionValue: string | undefined
): boolean {
  switch (operator) {
    case 'exists':
      return fieldValue !== undefined && fieldValue !== null;

    case 'equals':
      return String(fieldValue) === conditionValue;

    case 'contains':
      return conditionValue ? String(fieldValue).includes(conditionValue) : false;

    case 'regex':
      if (!conditionValue) return false;
      try {
        const regex = new RegExp(conditionValue);
        return regex.test(String(fieldValue));
      } catch {
        return false;
      }

    case 'gt':
      if (!conditionValue) return false;
      return Number(fieldValue) > Number(conditionValue);

    case 'lt':
      if (!conditionValue) return false;
      return Number(fieldValue) < Number(conditionValue);

    default:
      return false;
  }
}

/**
 * Verify webhook signature
 */
export function verifyWebhookSignature(
  triggerId: string,
  payload: string,
  signature: string,
  algorithm: 'sha256' | 'sha1' = 'sha256'
): boolean {
  const trigger = eventTriggers.get(triggerId);
  if (!trigger || !trigger.webhookSecret) {
    return false;
  }

  const expectedSignature = createHmac(algorithm, trigger.webhookSecret)
    .update(payload)
    .digest('hex');

  // Handle GitHub-style signatures (sha256=xxx)
  const actualSignature = signature.includes('=')
    ? signature.split('=')[1]
    : signature;

  return expectedSignature === actualSignature;
}

/**
 * Generate a random webhook secret
 */
function generateWebhookSecret(): string {
  return randomUUID().replace(/-/g, '') + randomUUID().replace(/-/g, '');
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
    console.error('[EventTrigger] Failed to log execution:', err);
  }
}

/**
 * Get event trigger statistics
 */
export function getEventTriggerStats(): {
  totalTriggers: number;
  activeTriggers: number;
  pausedTriggers: number;
  disabledTriggers: number;
  bySource: Record<string, number>;
} {
  const triggers = Array.from(eventTriggers.values());
  const bySource: Record<string, number> = {};

  for (const trigger of triggers) {
    bySource[trigger.source] = (bySource[trigger.source] || 0) + 1;
  }

  return {
    totalTriggers: triggers.length,
    activeTriggers: triggers.filter(t => t.status === 'active').length,
    pausedTriggers: triggers.filter(t => t.status === 'paused').length,
    disabledTriggers: triggers.filter(t => t.status === 'disabled').length,
    bySource,
  };
}

/**
 * Get recent trigger executions
 */
export async function getRecentExecutions(limit = 50): Promise<{
  id: string;
  triggerId: string;
  triggerType: string;
  sessionId: string | null;
  success: boolean;
  error: string | null;
  executedAt: Date;
}[]> {
  if (!dbAvailable) {
    return [];
  }

  try {
    const result = await query<{
      id: string;
      trigger_id: string;
      trigger_type: string;
      session_id: string | null;
      success: boolean;
      error: string | null;
      executed_at: Date;
    }>(
      `SELECT id, trigger_id, trigger_type, session_id, success, error, executed_at
       FROM trigger_executions
       ORDER BY executed_at DESC
       LIMIT $1`,
      [limit]
    );

    return result.rows.map(row => ({
      id: row.id,
      triggerId: row.trigger_id,
      triggerType: row.trigger_type,
      sessionId: row.session_id,
      success: row.success,
      error: row.error,
      executedAt: row.executed_at,
    }));
  } catch (err) {
    console.error('[EventTrigger] Failed to get recent executions:', err);
    return [];
  }
}

// Database row type
interface EventTriggerRow {
  id: string;
  name: string;
  description: string | null;
  source: string;
  event_type: string;
  conditions: unknown;
  intent_template: string;
  context_mapping: unknown;
  auto_dispatch: boolean;
  status: string;
  tags: unknown;
  webhook_secret: string | null;
  trigger_count: number;
  last_triggered_at: Date | null;
  last_session_id: string | null;
  created_at: Date;
  updated_at: Date;
}

/**
 * Convert database row to EventTriggerRuntime
 */
function rowToEventTrigger(row: EventTriggerRow): EventTriggerRuntime {
  return {
    id: row.id,
    name: row.name,
    description: row.description ?? undefined,
    source: row.source as EventSource,
    eventType: row.event_type,
    conditions: row.conditions as EventTriggerRuntime['conditions'],
    intentTemplate: row.intent_template,
    contextMapping: row.context_mapping as Record<string, string> | undefined,
    autoDispatch: row.auto_dispatch,
    status: row.status as 'active' | 'paused' | 'disabled',
    tags: row.tags as string[] | undefined,
    webhookSecret: row.webhook_secret ?? undefined,
    triggerCount: row.trigger_count,
    lastTriggeredAt: row.last_triggered_at ?? undefined,
    lastSessionId: row.last_session_id ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
