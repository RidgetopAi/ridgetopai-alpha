/**
 * Support Ticket Workflow Types
 * Instance 20 - OPERATE capability
 */

// Workflow states represent the progression through the support ticket process
export type TicketWorkflowState =
  | 'draft'        // User is writing ticket
  | 'submitted'    // Ticket submitted
  | 'analyzing'    // AI is analyzing
  | 'proposed'     // Response proposed
  | 'responding'   // Human reviewing/editing response
  | 'completed'    // Response sent
  | 'failed';      // Something went wrong

export type TicketSeverity = 'critical' | 'high' | 'medium' | 'low';
export type TicketCategory =
  | 'bug_report'
  | 'feature_request'
  | 'billing'
  | 'account'
  | 'how_to'
  | 'integration'
  | 'performance'
  | 'other';
export type Confidence = 'high' | 'medium' | 'low';
export type TicketActionType =
  | 'immediate_fix'
  | 'documentation'
  | 'workaround'
  | 'investigation'
  | 'escalation'
  | 'no_action';

// Support ticket input from user
export interface SupportTicket {
  title: string;
  description: string;
  customerEmail: string;
  customerName?: string;
  category: TicketCategory;
  severity: TicketSeverity;
  affectedFeature?: string;
  errorMessage?: string;
  stepsToReproduce?: string;
}

// AI analysis result
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
  analyzedAt: Date;
}

// Response sent to customer
export interface TicketResponse {
  response: string;
  sentTo: string;
  sentAt: Date;
}

// The complete workflow entity
export interface SupportTicketWorkflow {
  id: string;
  state: TicketWorkflowState;
  createdAt: Date;
  updatedAt: Date;

  // Step 1: Ticket
  ticket: SupportTicket;

  // Step 2: Analysis (optional until analyzed)
  analysis?: TicketAnalysis;

  // Step 3: Response (optional until responded)
  response?: TicketResponse;

  // Error information if failed
  error?: {
    message: string;
    step: TicketWorkflowState;
    occurredAt: Date;
  };
}

// State labels for display
export const TICKET_STATE_LABELS: Record<TicketWorkflowState, string> = {
  draft: 'Draft',
  submitted: 'Submitted',
  analyzing: 'Analyzing Ticket',
  proposed: 'Response Ready',
  responding: 'Reviewing Response',
  completed: 'Completed',
  failed: 'Failed',
};

// State progression order (for progress bar)
export const TICKET_STATE_ORDER: TicketWorkflowState[] = [
  'draft',
  'submitted',
  'analyzing',
  'proposed',
  'responding',
  'completed',
];

// Category labels for display
export const CATEGORY_LABELS: Record<TicketCategory, string> = {
  bug_report: 'Bug Report',
  feature_request: 'Feature Request',
  billing: 'Billing',
  account: 'Account',
  how_to: 'How To',
  integration: 'Integration',
  performance: 'Performance',
  other: 'Other',
};

// Severity labels for display
export const SEVERITY_LABELS: Record<TicketSeverity, string> = {
  critical: 'Critical',
  high: 'High',
  medium: 'Medium',
  low: 'Low',
};

// Action type labels for display
export const ACTION_TYPE_LABELS: Record<TicketActionType, string> = {
  immediate_fix: 'Immediate Fix',
  documentation: 'Documentation',
  workaround: 'Workaround',
  investigation: 'Investigation',
  escalation: 'Escalation',
  no_action: 'No Action',
};

// Helper to check if a state is before another
export function isTicketStateBefore(current: TicketWorkflowState, target: TicketWorkflowState): boolean {
  const currentIndex = TICKET_STATE_ORDER.indexOf(current);
  const targetIndex = TICKET_STATE_ORDER.indexOf(target);
  return currentIndex < targetIndex && current !== 'failed';
}

// Helper to check if a state is active or complete
export function isTicketStateActiveOrComplete(current: TicketWorkflowState, step: TicketWorkflowState): boolean {
  if (current === 'failed') return false;
  if (current === 'completed') return true;
  const currentIndex = TICKET_STATE_ORDER.indexOf(current);
  const stepIndex = TICKET_STATE_ORDER.indexOf(step);
  return currentIndex >= stepIndex;
}
