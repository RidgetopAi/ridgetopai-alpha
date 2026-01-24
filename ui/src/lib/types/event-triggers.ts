/**
 * Event Triggers Types
 * Types for event-driven workflow automation
 */

// Event source types (matches backend)
export type EventSource =
  | 'github'    // GitHub webhooks (push, PR, issue)
  | 'sentry'    // Sentry error events
  | 'slack'     // Slack commands/events
  | 'webhook'   // Generic webhook
  | 'internal'  // Internal system events
  | 'cron';     // Cron schedule trigger

// Trigger status
export type TriggerStatus = 'active' | 'paused' | 'disabled';

// Condition operators
export type ConditionOperator = 'equals' | 'contains' | 'regex' | 'exists' | 'gt' | 'lt';

// Trigger condition
export interface TriggerCondition {
  field?: string;       // JSON path to match (e.g., "action")
  operator?: ConditionOperator;
  value?: string;
}

// Event trigger from backend
export interface EventTrigger {
  id: string;
  name: string;
  description?: string;
  source: EventSource;
  eventType: string;      // e.g., "push", "error", "slash_command"
  conditions?: TriggerCondition[];
  intentTemplate: string; // Template with {{variables}}
  contextMapping?: Record<string, string>; // Map event fields to context
  autoDispatch: boolean;
  status: TriggerStatus;
  tags?: string[];
  webhookSecret?: string;
  triggerCount: number;
  lastTriggeredAt?: string;
  lastSessionId?: string;
  createdAt: string;
  updatedAt: string;
}

// Create trigger request
export interface CreateEventTriggerRequest {
  name: string;
  description?: string;
  source: EventSource;
  eventType: string;
  conditions?: TriggerCondition[];
  intentTemplate: string;
  contextMapping?: Record<string, string>;
  autoDispatch?: boolean;
  status?: TriggerStatus;
  tags?: string[];
}

// Update trigger request
export interface UpdateEventTriggerRequest {
  name?: string;
  description?: string;
  source?: EventSource;
  eventType?: string;
  conditions?: TriggerCondition[];
  intentTemplate?: string;
  contextMapping?: Record<string, string>;
  autoDispatch?: boolean;
  status?: TriggerStatus;
  tags?: string[];
}

// Trigger statistics
export interface EventTriggerStats {
  totalTriggers: number;
  activeTriggers: number;
  pausedTriggers: number;
  disabledTriggers: number;
  bySource: Record<string, number>;
}

// Trigger execution record
export interface TriggerExecution {
  id: string;
  triggerId: string;
  triggerType: string;
  sessionId: string | null;
  success: boolean;
  error: string | null;
  executedAt: string;
}

// API Response types
export interface ListTriggersResponse {
  triggers: EventTrigger[];
  stats: EventTriggerStats;
}

export interface TriggerResponse {
  success: boolean;
  trigger?: EventTrigger;
  error?: string;
}

export interface DeleteTriggerResponse {
  success: boolean;
  error?: string;
}

export interface ListExecutionsResponse {
  executions: TriggerExecution[];
}

// Status labels for display
export const TRIGGER_STATUS_LABELS: Record<TriggerStatus, string> = {
  active: 'Active',
  paused: 'Paused',
  disabled: 'Disabled',
};

// Source labels for display
export const EVENT_SOURCE_LABELS: Record<EventSource, string> = {
  github: 'GitHub',
  sentry: 'Sentry',
  slack: 'Slack',
  webhook: 'Webhook',
  internal: 'Internal',
  cron: 'Cron',
};

// Common event types per source
export const COMMON_EVENT_TYPES: Record<EventSource, { label: string; type: string }[]> = {
  github: [
    { label: 'Push', type: 'push' },
    { label: 'Pull Request', type: 'pull_request' },
    { label: 'Issue Created', type: 'issues.opened' },
    { label: 'Issue Closed', type: 'issues.closed' },
    { label: 'PR Merged', type: 'pull_request.merged' },
    { label: 'Any Event', type: '*' },
  ],
  sentry: [
    { label: 'Error', type: 'error' },
    { label: 'Issue Created', type: 'issue.created' },
    { label: 'Issue Resolved', type: 'issue.resolved' },
    { label: 'Any Event', type: '*' },
  ],
  slack: [
    { label: 'Slash Command', type: 'slash_command' },
    { label: 'Message', type: 'message' },
    { label: 'App Mention', type: 'app_mention' },
    { label: 'Any Event', type: '*' },
  ],
  webhook: [
    { label: 'POST', type: 'post' },
    { label: 'Any', type: '*' },
  ],
  internal: [
    { label: 'Workflow Complete', type: 'workflow.complete' },
    { label: 'Task Failed', type: 'task.failed' },
    { label: 'Session Created', type: 'session.created' },
    { label: 'Any Event', type: '*' },
  ],
  cron: [
    { label: 'Scheduled', type: 'scheduled' },
  ],
};
