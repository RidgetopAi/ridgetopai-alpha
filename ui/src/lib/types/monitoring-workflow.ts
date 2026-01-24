/**
 * Monitoring Alert Workflow Types
 * Instance 21 - OPERATE capability
 */

// Workflow states represent the progression through the monitoring alert process
export type AlertWorkflowState =
  | 'draft'        // User is writing alert
  | 'submitted'    // Alert submitted
  | 'analyzing'    // AI is analyzing
  | 'proposed'     // Remediation proposed
  | 'remediating'  // Human reviewing/executing remediation
  | 'completed'    // Remediation complete
  | 'failed';      // Something went wrong

export type AlertSeverity = 'critical' | 'high' | 'medium' | 'low';
export type AlertCategory =
  | 'infrastructure'
  | 'application'
  | 'security'
  | 'business'
  | 'other';
export type AlertSource =
  | 'prometheus'
  | 'cloudwatch'
  | 'datadog'
  | 'sentry'
  | 'custom'
  | 'manual';
export type Confidence = 'high' | 'medium' | 'low';
export type RemediationActionType =
  | 'restart'
  | 'scale'
  | 'rollback'
  | 'investigate'
  | 'notify'
  | 'none';

// Monitoring alert input from user
export interface MonitoringAlert {
  title: string;
  description: string;
  category: AlertCategory;
  severity: AlertSeverity;
  source: AlertSource;
  affectedService?: string;
  rawPayload?: string;
  metricValue?: string;
  threshold?: string;
  startedAt?: string;
}

// AI analysis result
export interface AlertAnalysis {
  summary: string;
  rootCause: string;
  impact: string;
  urgency: AlertSeverity;
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
  analyzedAt: Date;
}

// Remediation action taken
export interface RemediationAction {
  action: 'execute' | 'dismiss' | 'escalate';
  notes?: string;
  executedAt: Date;
}

// The complete workflow entity
export interface MonitoringAlertWorkflow {
  id: string;
  state: AlertWorkflowState;
  createdAt: Date;
  updatedAt: Date;

  // Step 1: Alert
  alert: MonitoringAlert;

  // Step 2: Analysis (optional until analyzed)
  analysis?: AlertAnalysis;

  // Step 3: Remediation (optional until remediated)
  remediation?: RemediationAction;

  // Error information if failed
  error?: {
    message: string;
    step: AlertWorkflowState;
    occurredAt: Date;
    timedOut?: boolean; // True if the error was due to a timeout
  };
}

// State labels for display
export const ALERT_STATE_LABELS: Record<AlertWorkflowState, string> = {
  draft: 'Draft',
  submitted: 'Submitted',
  analyzing: 'Analyzing Alert',
  proposed: 'Remediation Ready',
  remediating: 'Reviewing Remediation',
  completed: 'Completed',
  failed: 'Failed',
};

// State progression order (for progress bar)
export const ALERT_STATE_ORDER: AlertWorkflowState[] = [
  'draft',
  'submitted',
  'analyzing',
  'proposed',
  'remediating',
  'completed',
];

// Category labels for display
export const CATEGORY_LABELS: Record<AlertCategory, string> = {
  infrastructure: 'Infrastructure',
  application: 'Application',
  security: 'Security',
  business: 'Business',
  other: 'Other',
};

// Severity labels for display
export const SEVERITY_LABELS: Record<AlertSeverity, string> = {
  critical: 'Critical',
  high: 'High',
  medium: 'Medium',
  low: 'Low',
};

// Source labels for display
export const SOURCE_LABELS: Record<AlertSource, string> = {
  prometheus: 'Prometheus',
  cloudwatch: 'CloudWatch',
  datadog: 'Datadog',
  sentry: 'Sentry',
  custom: 'Custom',
  manual: 'Manual Entry',
};

// Remediation action type labels for display
export const REMEDIATION_TYPE_LABELS: Record<RemediationActionType, string> = {
  restart: 'Restart Service',
  scale: 'Scale Resources',
  rollback: 'Rollback',
  investigate: 'Investigate',
  notify: 'Notify Team',
  none: 'No Action',
};

// Helper to check if a state is before another
export function isAlertStateBefore(current: AlertWorkflowState, target: AlertWorkflowState): boolean {
  const currentIndex = ALERT_STATE_ORDER.indexOf(current);
  const targetIndex = ALERT_STATE_ORDER.indexOf(target);
  return currentIndex < targetIndex && current !== 'failed';
}

// Helper to check if a state is active or complete
export function isAlertStateActiveOrComplete(current: AlertWorkflowState, step: AlertWorkflowState): boolean {
  if (current === 'failed') return false;
  if (current === 'completed') return true;
  const currentIndex = ALERT_STATE_ORDER.indexOf(current);
  const stepIndex = ALERT_STATE_ORDER.indexOf(step);
  return currentIndex >= stepIndex;
}

// Helper to detect if an error is a timeout
export function isAlertTimeoutError(error: string | undefined): boolean {
  if (!error) return false;
  const lowerError = error.toLowerCase();
  return lowerError.includes('timed out') ||
         lowerError.includes('timeout') ||
         lowerError.includes('time out');
}

// Processing states that could indicate a stuck/orphaned workflow
export const ALERT_PROCESSING_STATES: AlertWorkflowState[] = [
  'submitted',
  'analyzing',
  'remediating',
];
