/**
 * Scheduler Types
 * Types for scheduled task management
 */

// Schedule status
export type ScheduleStatus = 'active' | 'paused' | 'disabled';

// Schedule context for orchestration
export interface ScheduleContext {
  focus?: string;
  urgency?: 'low' | 'medium' | 'high';
  constraints?: string[];
}

// Scheduled task from backend
export interface ScheduledTask {
  id: string;
  name: string;
  description?: string;
  cronPattern: string;
  intentTemplate: string;
  context?: ScheduleContext;
  autoDispatch: boolean;
  status: ScheduleStatus;
  maxRetries?: number;
  timeout?: number;
  tags?: string[];
  lastRunAt?: string;
  nextRunAt?: string;
  runCount: number;
  lastResult?: 'success' | 'failure' | 'timeout';
  lastSessionId?: string;
  createdAt: string;
  updatedAt: string;
}

// Create schedule request
export interface CreateScheduleRequest {
  name: string;
  description?: string;
  cronPattern: string;
  intentTemplate: string;
  context?: ScheduleContext;
  autoDispatch?: boolean;
  status?: ScheduleStatus;
  maxRetries?: number;
  timeout?: number;
  tags?: string[];
}

// Update schedule request
export interface UpdateScheduleRequest {
  name?: string;
  description?: string;
  cronPattern?: string;
  intentTemplate?: string;
  context?: ScheduleContext;
  autoDispatch?: boolean;
  status?: ScheduleStatus;
  maxRetries?: number;
  timeout?: number;
  tags?: string[];
}

// Scheduler statistics
export interface SchedulerStats {
  totalTasks: number;
  activeTasks: number;
  pausedTasks: number;
  disabledTasks: number;
  runningJobs: number;
}

// Trigger execution result
export interface TriggerExecutionResult {
  triggerId: string;
  triggerName: string;
  sessionId?: string;
  success: boolean;
  error?: string;
  executedAt: string;
}

// API Response types
export interface ListSchedulesResponse {
  schedules: ScheduledTask[];
  stats: SchedulerStats;
}

export interface ScheduleResponse {
  success: boolean;
  schedule?: ScheduledTask;
  error?: string;
}

export interface DeleteScheduleResponse {
  success: boolean;
  error?: string;
}

export interface TriggerScheduleResponse extends TriggerExecutionResult {}

// Status labels for display
export const SCHEDULE_STATUS_LABELS: Record<ScheduleStatus, string> = {
  active: 'Active',
  paused: 'Paused',
  disabled: 'Disabled',
};

// Common cron patterns for quick selection
export const COMMON_CRON_PATTERNS = [
  { label: 'Every minute', pattern: '* * * * *' },
  { label: 'Every 5 minutes', pattern: '*/5 * * * *' },
  { label: 'Every 15 minutes', pattern: '*/15 * * * *' },
  { label: 'Every hour', pattern: '0 * * * *' },
  { label: 'Every day at 9 AM', pattern: '0 9 * * *' },
  { label: 'Every day at 6 PM', pattern: '0 18 * * *' },
  { label: 'Every Monday at 9 AM', pattern: '0 9 * * 1' },
  { label: 'Weekdays at 9 AM', pattern: '0 9 * * 1-5' },
  { label: 'First of month at 9 AM', pattern: '0 9 1 * *' },
];
