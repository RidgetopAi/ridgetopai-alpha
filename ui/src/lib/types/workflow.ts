/**
 * Bug Fix Workflow Types
 * Instance 09 - First PRODUCE capability
 */

// Workflow states represent the progression through the bug fix process
export type WorkflowState =
  | 'draft'        // User is writing bug report
  | 'submitted'    // Bug report submitted, gathering context
  | 'analyzing'    // AI is analyzing the bug
  | 'proposed'     // AI has proposed a fix
  | 'reviewing'    // Human is reviewing the proposed fix
  | 'implementing' // AI is implementing approved fix
  | 'verifying'    // Running tests and verification
  | 'completed'    // Fix is done
  | 'failed';      // Something went wrong

export type Severity = 'blocker' | 'major' | 'minor';
export type Confidence = 'high' | 'medium' | 'low';
export type ReviewDecision = 'approved' | 'changes_requested' | 'rejected';

// Bug report input from user
export interface BugReport {
  title: string;
  description: string;
  stepsToReproduce?: string;
  expectedBehavior?: string;
  actualBehavior?: string;
  severity: Severity;
}

// Context gathered for analysis
export interface WorkflowContext {
  files: Array<{ path: string; content: string; lines: number }>;
  mandrelContext?: string;
  generatedAt: Date;
}

// Proposed code change
export interface CodeChange {
  file: string;
  original: string;
  proposed: string;
  lineStart?: number;
  lineEnd?: number;
}

// AI analysis result
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
  generatedAt: Date;
}

// Human review of proposed fix
export interface FixReview {
  decision: ReviewDecision;
  notes?: string;
  reviewedAt: Date;
}

// Test execution results
export interface TestResults {
  passed: number;
  failed: number;
  skipped: number;
  duration?: number;
  failedTests?: string[];
  output?: string;
}

// Build result
export interface BuildResult {
  success: boolean;
  command: string;
  output?: string;
}

// Implementation result
export interface Implementation {
  changedFiles: string[];
  buildResult?: BuildResult;
  testResults?: TestResults;
  warnings: string[];
  completedAt: Date;
}

// The complete workflow entity
export interface BugFixWorkflow {
  id: string;
  state: WorkflowState;
  createdAt: Date;
  updatedAt: Date;

  // Project path for remote execution
  projectPath?: string;

  // Mandrel project name for context storage
  projectName?: string;

  // Step 1: Bug Report
  bugReport: BugReport;

  // Step 2: Context (optional until gathered)
  context?: WorkflowContext;

  // Step 3-4: Analysis and Proposal (optional until analyzed)
  analysis?: BugAnalysis;

  // Step 5: Review (optional until reviewed)
  review?: FixReview;

  // Step 6-7: Implementation and Verification (optional until implemented)
  implementation?: Implementation;

  // Step 8: User confirmation that fix worked
  confirmation?: {
    confirmed: boolean;
    feedback?: string;
    confirmedAt: Date;
    storedToMandrel: boolean;
  };

  // Error information if failed
  error?: {
    message: string;
    step: WorkflowState;
    occurredAt: Date;
    timedOut?: boolean; // True if the error was due to a timeout
  };
}

// State labels for display
export const WORKFLOW_STATE_LABELS: Record<WorkflowState, string> = {
  draft: 'Draft',
  submitted: 'Gathering Context',
  analyzing: 'Analyzing Bug',
  proposed: 'Fix Proposed',
  reviewing: 'Under Review',
  implementing: 'Implementing Fix',
  verifying: 'Verifying',
  completed: 'Completed',
  failed: 'Failed',
};

// State progression order (for progress bar)
export const WORKFLOW_STATE_ORDER: WorkflowState[] = [
  'draft',
  'submitted',
  'analyzing',
  'proposed',
  'reviewing',
  'implementing',
  'verifying',
  'completed',
];

// Helper to check if a state is before another
export function isStateBefore(current: WorkflowState, target: WorkflowState): boolean {
  const currentIndex = WORKFLOW_STATE_ORDER.indexOf(current);
  const targetIndex = WORKFLOW_STATE_ORDER.indexOf(target);
  return currentIndex < targetIndex && current !== 'failed';
}

// Helper to check if a state is active or complete
export function isStateActiveOrComplete(current: WorkflowState, step: WorkflowState): boolean {
  if (current === 'failed') return false;
  if (current === 'completed') return true;
  const currentIndex = WORKFLOW_STATE_ORDER.indexOf(current);
  const stepIndex = WORKFLOW_STATE_ORDER.indexOf(step);
  return currentIndex >= stepIndex;
}

// Helper to detect if an error is a timeout
export function isTimeoutError(error: string | undefined): boolean {
  if (!error) return false;
  const lowerError = error.toLowerCase();
  return lowerError.includes('timed out') ||
         lowerError.includes('timeout') ||
         lowerError.includes('time out');
}

// Processing states that could indicate a stuck/orphaned workflow
export const PROCESSING_STATES: WorkflowState[] = [
  'submitted',
  'analyzing',
  'implementing',
  'verifying',
];

// Default timeout in milliseconds (6 minutes - slightly more than backend 5 min to account for network)
export const CLIENT_TIMEOUT_MS = 6 * 60 * 1000;
