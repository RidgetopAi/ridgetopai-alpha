/**
 * TaskRunner Types
 * Instance 10 - Backend for business workflows
 */

import { z } from 'zod';

// Severity levels for bugs
export const SeveritySchema = z.enum(['blocker', 'major', 'minor']);
export type Severity = z.infer<typeof SeveritySchema>;

// Bug report from UI
export const BugReportSchema = z.object({
  title: z.string().min(1),
  description: z.string().min(1),
  stepsToReproduce: z.string().optional(),
  expectedBehavior: z.string().optional(),
  actualBehavior: z.string().optional(),
  severity: SeveritySchema,
});
export type BugReport = z.infer<typeof BugReportSchema>;

// Request to execute bug fix analysis
export const BugFixRequestSchema = z.object({
  workflowId: z.string(),
  bugReport: BugReportSchema,
  projectPath: z.string().optional(),
});
export type BugFixRequest = z.infer<typeof BugFixRequestSchema>;

// Confidence level for analysis
export type Confidence = 'high' | 'medium' | 'low';

// Proposed code change
export interface CodeChange {
  file: string;
  original: string;
  proposed: string;
  explanation?: string;
}

// Analysis result from AI
export interface BugAnalysis {
  rootCause: string;
  evidence: string;
  confidence: Confidence;
  questions?: string[];
  proposedFix?: {
    explanation: string;
    changes: CodeChange[];
    risks: string[];
    testNeeds: string[];
  };
  rawOutput?: string;
}

// Task execution result
export interface TaskResult<T> {
  success: boolean;
  data?: T;
  error?: string;
  durationMs: number;
}

// Workflow status updates
export type WorkflowStatus =
  | 'gathering_context'
  | 'analyzing'
  | 'proposing_fix'
  | 'implementing'
  | 'verifying'
  | 'completed'
  | 'failed';

export interface WorkflowUpdate {
  workflowId: string;
  status: WorkflowStatus;
  message?: string;
  progress?: number;
  result?: BugAnalysis;
  implementationResult?: ImplementationResult;
}

// Implementation request - sent after user approves a fix
export const ImplementRequestSchema = z.object({
  workflowId: z.string(),
  approvedChanges: z.array(z.object({
    file: z.string(),
    original: z.string(),
    proposed: z.string(),
    explanation: z.string().optional(),
  })),
  projectPath: z.string().optional(),
  runTests: z.boolean().optional().default(true),
});
export type ImplementRequest = z.infer<typeof ImplementRequestSchema>;

// Test result from running tests after implementation
export interface TestResult {
  passed: number;
  failed: number;
  skipped: number;
  duration: number; // ms
  output?: string;
}

// Build result from compiling after implementation
export interface BuildResult {
  success: boolean;
  command: string;
  output?: string;
}

// Implementation result from AI
export interface ImplementationResult {
  success: boolean;
  changedFiles: string[];
  buildResult?: BuildResult;
  testResults?: TestResult;
  warnings: string[];
  errors: string[];
  rawOutput?: string;
}

// ==========================================
// Content Generation Types (Instance 12 - GROW)
// ==========================================

// Content format types
export const ContentFormatSchema = z.enum([
  'blog_post',
  'tweet_thread',
  'documentation',
  'email',
  'announcement',
  'case_study',
]);
export type ContentFormat = z.infer<typeof ContentFormatSchema>;

// Audience type for targeting content tone
export const AudienceTypeSchema = z.enum([
  'developers',
  'business',
  'general',
  'internal',
]);
export type AudienceType = z.infer<typeof AudienceTypeSchema>;

// Tone for content voice
export const ContentToneSchema = z.enum([
  'professional',
  'conversational',
  'technical',
  'educational',
]);
export type ContentTone = z.infer<typeof ContentToneSchema>;

// Content brief from UI
export const ContentBriefSchema = z.object({
  title: z.string().min(1),
  topic: z.string().min(1),
  format: ContentFormatSchema,
  audience: AudienceTypeSchema,
  tone: ContentToneSchema,
  keyPoints: z.array(z.string()).optional(),
  keywords: z.array(z.string()).optional(),
  wordCount: z.number().optional(),
  additionalContext: z.string().optional(),
});
export type ContentBrief = z.infer<typeof ContentBriefSchema>;

// Request to generate content
export const ContentGenerationRequestSchema = z.object({
  workflowId: z.string(),
  brief: ContentBriefSchema,
  brandContext: z.string().optional(),  // Brand voice/guidelines
});
export type ContentGenerationRequest = z.infer<typeof ContentGenerationRequestSchema>;

// Generated content structure
export interface GeneratedContent {
  title: string;
  body: string;
  summary?: string;
  callToAction?: string;
  metadata?: {
    readTime?: number;
    wordCount: number;
    targetKeywords?: string[];
  };
}

// Content generation result from AI
export interface ContentGenerationResult {
  content: GeneratedContent;
  confidence: Confidence;
  suggestions?: string[];
  alternatives?: {
    title: string;
    approach: string;
  }[];
  rawOutput?: string;
}

// Request to refine content based on feedback
export const ContentRefineRequestSchema = z.object({
  workflowId: z.string(),
  originalContent: z.object({
    title: z.string(),
    body: z.string(),
    summary: z.string().optional(),
    callToAction: z.string().optional(),
  }),
  feedback: z.string(),
  specificEdits: z.array(z.string()).optional(),
});
export type ContentRefineRequest = z.infer<typeof ContentRefineRequestSchema>;

// Refinement result from AI
export interface ContentRefinementResult {
  content: GeneratedContent;
  changesApplied: string[];
  rawOutput?: string;
}

// Content workflow status
export type ContentWorkflowStatus =
  | 'researching'
  | 'generating'
  | 'refining'
  | 'completed'
  | 'failed';

// ==========================================
// Support Ticket Types (Instance 20 - OPERATE)
// ==========================================

// Severity levels for support tickets
export const TicketSeveritySchema = z.enum(['critical', 'high', 'medium', 'low']);
export type TicketSeverity = z.infer<typeof TicketSeveritySchema>;

// Category for routing tickets
export const TicketCategorySchema = z.enum([
  'bug_report',
  'feature_request',
  'billing',
  'account',
  'how_to',
  'integration',
  'performance',
  'other',
]);
export type TicketCategory = z.infer<typeof TicketCategorySchema>;

// Support ticket from UI
export const SupportTicketSchema = z.object({
  title: z.string().min(1),
  description: z.string().min(1),
  customerEmail: z.string().email(),
  customerName: z.string().optional(),
  category: TicketCategorySchema,
  severity: TicketSeveritySchema,
  affectedFeature: z.string().optional(),
  errorMessage: z.string().optional(),
  stepsToReproduce: z.string().optional(),
  attachments: z.array(z.string()).optional(),
});
export type SupportTicket = z.infer<typeof SupportTicketSchema>;

// Request to execute support ticket analysis
export const SupportTicketRequestSchema = z.object({
  workflowId: z.string(),
  ticket: SupportTicketSchema,
  projectPath: z.string().optional(),
});
export type SupportTicketRequest = z.infer<typeof SupportTicketRequestSchema>;

// Action required types for ticket resolution
export type TicketActionType =
  | 'immediate_fix'
  | 'documentation'
  | 'workaround'
  | 'investigation'
  | 'escalation'
  | 'no_action';

// Ticket analysis result from AI
export interface TicketAnalysis {
  summary: string;
  rootCause: string;
  affectedUsers: string;
  impact: string;
  workaround?: string;
  suggestedResponse: string;
  internalNotes: string;
  severity: TicketSeverity;
  confidence: Confidence;
  actionRequired: {
    type: TicketActionType;
    description: string;
    estimatedEffort?: string;
  };
  relatedIssues?: string[];
  rawOutput?: string;
}

// Response to customer
export interface TicketResponse {
  response: string;
  sentTo: string;
  sentAt: Date;
  respondedBy: string;
}

// Request to respond to support ticket
export const SupportTicketRespondSchema = z.object({
  response: z.string().min(1),
  customResponse: z.boolean().optional(),
  sendEmail: z.boolean().optional(),
});
export type SupportTicketRespond = z.infer<typeof SupportTicketRespondSchema>;

// Ticket workflow status
export type TicketWorkflowStatus =
  | 'gathering_context'
  | 'analyzing'
  | 'proposing_response'
  | 'reviewing_response'
  | 'responding'
  | 'completed'
  | 'failed';

// ==========================================
// Monitoring Alert Types (Instance 21 - OPERATE)
// ==========================================

// Severity levels for alerts (reuses TicketSeverity pattern)
export const AlertSeveritySchema = z.enum(['critical', 'high', 'medium', 'low']);
export type AlertSeverity = z.infer<typeof AlertSeveritySchema>;

// Category for alert classification
export const AlertCategorySchema = z.enum([
  'infrastructure',
  'application',
  'security',
  'business',
  'other',
]);
export type AlertCategory = z.infer<typeof AlertCategorySchema>;

// Source of the alert
export const AlertSourceSchema = z.enum([
  'prometheus',
  'cloudwatch',
  'datadog',
  'sentry',
  'custom',
  'manual',
]);
export type AlertSource = z.infer<typeof AlertSourceSchema>;

// Remediation action types
export type RemediationActionType =
  | 'restart'
  | 'scale'
  | 'rollback'
  | 'investigate'
  | 'notify'
  | 'none';

// Monitoring alert from UI
export const MonitoringAlertSchema = z.object({
  title: z.string().min(1),
  description: z.string().min(1),
  category: AlertCategorySchema,
  severity: AlertSeveritySchema,
  source: AlertSourceSchema,
  affectedService: z.string().optional(),
  rawPayload: z.string().optional(),  // Raw alert JSON/payload
  metricValue: z.string().optional(),  // e.g., "CPU: 95%"
  threshold: z.string().optional(),    // e.g., "Threshold: 80%"
  startedAt: z.string().optional(),    // When the alert started
});
export type MonitoringAlert = z.infer<typeof MonitoringAlertSchema>;

// Request to execute monitoring alert analysis
export const MonitoringAlertRequestSchema = z.object({
  workflowId: z.string(),
  alert: MonitoringAlertSchema,
  projectPath: z.string().optional(),
});
export type MonitoringAlertRequest = z.infer<typeof MonitoringAlertRequestSchema>;

// Alert analysis result from AI
export interface AlertAnalysis {
  summary: string;
  rootCause: string;
  impact: string;
  urgency: AlertSeverity;  // AI-assessed urgency (may differ from input)
  affectedSystems: string;
  suggestedRemediation: {
    type: RemediationActionType;
    description: string;
    steps: string[];
    risks: string[];
    estimatedDowntime?: string;
  };
  confidence: Confidence;
  internalNotes: string;
  relatedIncidents?: string[];
  rawOutput?: string;
}

// Request to execute remediation
export const AlertRemediateSchema = z.object({
  action: z.enum(['execute', 'dismiss', 'escalate']),
  notes: z.string().optional(),
  modifiedSteps: z.array(z.string()).optional(),  // If user modified the steps
});
export type AlertRemediate = z.infer<typeof AlertRemediateSchema>;

// Alert workflow status
export type AlertWorkflowStatus =
  | 'gathering_context'
  | 'analyzing'
  | 'proposing_remediation'
  | 'reviewing_remediation'
  | 'remediating'
  | 'completed'
  | 'failed';

// ==========================================
// Workflow Automation Types (Scheduling & Events)
// ==========================================

// Cron schedule status
export type ScheduleStatus = 'active' | 'paused' | 'disabled';

// Scheduled task definition
export const ScheduledTaskSchema = z.object({
  id: z.string().optional(),  // Auto-generated UUID
  name: z.string().min(1),
  description: z.string().optional(),
  cronPattern: z.string().min(1),  // Cron expression (e.g., "0 9 * * 1-5")
  intentTemplate: z.string().min(1),  // Template for orchestration intent
  context: z.object({
    focus: z.string().optional(),
    urgency: z.enum(['low', 'medium', 'high']).optional(),
    constraints: z.array(z.string()).optional(),
  }).optional(),
  autoDispatch: z.boolean().default(true),  // Auto-execute tasks on trigger
  status: z.enum(['active', 'paused', 'disabled']).default('active'),
  maxRetries: z.number().optional().default(0),
  timeout: z.number().optional(),  // Timeout in ms for the workflow
  tags: z.array(z.string()).optional(),
});
export type ScheduledTask = z.infer<typeof ScheduledTaskSchema>;

// Scheduled task with runtime info
export interface ScheduledTaskRuntime extends ScheduledTask {
  id: string;
  lastRunAt?: Date;
  nextRunAt?: Date;
  runCount: number;
  lastResult?: 'success' | 'failure' | 'timeout';
  lastSessionId?: string;
  createdAt: Date;
  updatedAt: Date;
}

// Create schedule request
export const CreateScheduleRequestSchema = ScheduledTaskSchema.omit({ id: true, status: true }).extend({
  status: z.enum(['active', 'paused', 'disabled']).optional(),
});
export type CreateScheduleRequest = z.infer<typeof CreateScheduleRequestSchema>;

// Update schedule request
export const UpdateScheduleRequestSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  cronPattern: z.string().min(1).optional(),
  intentTemplate: z.string().min(1).optional(),
  context: z.object({
    focus: z.string().optional(),
    urgency: z.enum(['low', 'medium', 'high']).optional(),
    constraints: z.array(z.string()).optional(),
  }).optional(),
  autoDispatch: z.boolean().optional(),
  status: z.enum(['active', 'paused', 'disabled']).optional(),
  maxRetries: z.number().optional(),
  timeout: z.number().optional(),
  tags: z.array(z.string()).optional(),
});
export type UpdateScheduleRequest = z.infer<typeof UpdateScheduleRequestSchema>;

// Event trigger source types
export const EventSourceSchema = z.enum([
  'github',      // GitHub webhooks (push, PR, issue)
  'sentry',      // Sentry error events
  'slack',       // Slack commands/events
  'webhook',     // Generic webhook
  'internal',    // Internal system events
  'cron',        // Cron schedule trigger
]);
export type EventSource = z.infer<typeof EventSourceSchema>;

// Event trigger definition
export const EventTriggerSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1),
  description: z.string().optional(),
  source: EventSourceSchema,
  eventType: z.string().min(1),  // e.g., "push", "error", "slash_command"
  conditions: z.object({
    field: z.string().optional(),    // JSON path to match (e.g., "action")
    operator: z.enum(['equals', 'contains', 'regex', 'exists', 'gt', 'lt']).optional(),
    value: z.string().optional(),
  }).array().optional(),  // Multiple conditions (AND logic)
  intentTemplate: z.string().min(1),  // Template with {{variables}}
  contextMapping: z.record(z.string()).optional(),  // Map event fields to context
  autoDispatch: z.boolean().default(true),
  status: z.enum(['active', 'paused', 'disabled']).default('active'),
  tags: z.array(z.string()).optional(),
});
export type EventTrigger = z.infer<typeof EventTriggerSchema>;

// Event trigger with runtime info
export interface EventTriggerRuntime extends EventTrigger {
  id: string;
  triggerCount: number;
  lastTriggeredAt?: Date;
  lastSessionId?: string;
  webhookSecret?: string;  // For verifying webhook signatures
  createdAt: Date;
  updatedAt: Date;
}

// Create event trigger request
export const CreateEventTriggerRequestSchema = EventTriggerSchema.omit({ id: true, status: true }).extend({
  status: z.enum(['active', 'paused', 'disabled']).optional(),
});
export type CreateEventTriggerRequest = z.infer<typeof CreateEventTriggerRequestSchema>;

// Event trigger update request
export const UpdateEventTriggerRequestSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  source: EventSourceSchema.optional(),
  eventType: z.string().min(1).optional(),
  conditions: z.object({
    field: z.string().optional(),
    operator: z.enum(['equals', 'contains', 'regex', 'exists', 'gt', 'lt']).optional(),
    value: z.string().optional(),
  }).array().optional(),
  intentTemplate: z.string().min(1).optional(),
  contextMapping: z.record(z.string()).optional(),
  autoDispatch: z.boolean().optional(),
  status: z.enum(['active', 'paused', 'disabled']).optional(),
  tags: z.array(z.string()).optional(),
});
export type UpdateEventTriggerRequest = z.infer<typeof UpdateEventTriggerRequestSchema>;

// Incoming webhook event payload
export interface WebhookEvent {
  source: EventSource;
  eventType: string;
  payload: Record<string, unknown>;
  headers?: Record<string, string>;
  signature?: string;
  receivedAt: Date;
}

// Trigger execution result
export interface TriggerExecutionResult {
  triggerId: string;
  triggerName: string;
  sessionId?: string;
  success: boolean;
  error?: string;
  executedAt: Date;
}
