/**
 * Orchestration Types
 * Types for the orchestration panel - natural language → parallel execution
 */

// Task types that the orchestrator can generate
export type TaskType = 'bugfix' | 'content' | 'support' | 'analysis' | 'review';

// Priority levels for generated tasks
export type Priority = 'high' | 'medium' | 'low';

// Status of an orchestrated task
export type OrchTaskStatus = 'pending' | 'dispatched' | 'running' | 'completed' | 'failed' | 'cancelled';

// Session states
export type SessionState = 'idle' | 'analyzing' | 'ready' | 'executing' | 'completed' | 'failed' | 'cancelled';

// A generated task from the orchestrator
export interface GeneratedTask {
  id: string;
  type: TaskType;
  priority: Priority;
  title: string;
  description: string;
  parameters: Record<string, unknown>;
  status: OrchTaskStatus;
  workflowId?: string;
  result?: unknown;
  error?: string;
  startedAt?: string;
  completedAt?: string;
}

// The orchestrator's interpretation of the intent
export interface IntentInterpretation {
  understood: string;
  reasoning: string;
  tasks: GeneratedTask[];
  warnings?: string[];
}

// Execution summary
export interface ExecutionSummary {
  total: number;
  completed: number;
  failed: number;
  pending: number;
  running: number;
  cancelled: number;
}

// The complete orchestration session
export interface OrchestrationSession {
  sessionId: string;
  intent: string;
  context?: {
    focus?: string;
    urgency?: 'high' | 'normal' | 'low';
    constraints?: string;
    projectPath?: string;
  };
  interpretation: IntentInterpretation;
  execution: ExecutionSummary;
  isCancelled?: boolean;
  createdAt: string;
  updatedAt: string;
}

// API request/response types
export interface CreateSessionRequest {
  sessionId: string;
  intent: string;
  context?: OrchestrationSession['context'];
}

export interface CreateSessionResponse {
  success: boolean;
  session?: OrchestrationSession;
  error?: string;
}

export interface GetSessionResponse {
  success: boolean;
  session?: OrchestrationSession;
  error?: string;
}

export interface ExecuteResponse {
  success: boolean;
  dispatched?: number;
  failed?: number;
  execution?: ExecutionSummary;
  error?: string;
}

export interface ListSessionsResponse {
  success: boolean;
  count: number;
  sessions: OrchestrationSession[];
}

export interface CancelSessionResponse {
  success: boolean;
  session?: OrchestrationSession;
  message?: string;
  error?: string;
}

// Labels for display
export const TASK_TYPE_LABELS: Record<TaskType, string> = {
  bugfix: 'Bug Fix',
  content: 'Content',
  support: 'Support',
  analysis: 'Analysis',
  review: 'Review',
};

export const PRIORITY_LABELS: Record<Priority, string> = {
  high: 'High',
  medium: 'Medium',
  low: 'Low',
};

export const TASK_STATUS_LABELS: Record<OrchTaskStatus, string> = {
  pending: 'Pending',
  dispatched: 'Dispatched',
  running: 'Running',
  completed: 'Completed',
  failed: 'Failed',
  cancelled: 'Cancelled',
};

export const SESSION_STATE_LABELS: Record<SessionState, string> = {
  idle: 'Ready',
  analyzing: 'Analyzing Intent',
  ready: 'Tasks Ready',
  executing: 'Executing',
  completed: 'Completed',
  failed: 'Failed',
  cancelled: 'Cancelled',
};

// Capability mapping for styling
export const TASK_TYPE_CAPABILITY: Record<TaskType, 'PRODUCE' | 'GROW' | 'OPERATE' | 'INTERNAL'> = {
  bugfix: 'PRODUCE',
  content: 'GROW',
  support: 'OPERATE',
  analysis: 'INTERNAL',
  review: 'INTERNAL',
};
