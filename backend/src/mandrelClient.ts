/**
 * Mandrel Client - Institutional Memory for Business Workflows
 * Instance 13 - Memory integration for PRODUCE and GROW capabilities
 *
 * This client connects to Mandrel on the VPS to:
 * - Store completed workflows for future reference
 * - Retrieve relevant context before starting new workflows
 * - Build institutional memory over time
 *
 * Mandrel endpoint: http://localhost:8080/mcp/tools/<toolName>
 * Accessed via SSH tunnel or direct VPS connection
 */

import type { BugReport, BugAnalysis, ContentBrief, ContentGenerationResult, SupportTicket, TicketAnalysis, MonitoringAlert, AlertAnalysis } from './types.js';
import type { OrchestrationSession, GeneratedTask } from './orchestrator.js';
import {
  recordBugfixCompletion,
  recordContentCompletion,
  recordTicketCompletion,
  recordAlertCompletion,
  recordOrchestrationCompletion,
} from './strategic/strategicObserver.js';

// Configuration
// Default to the public Mandrel URL on VPS - can be overridden for local development
const MANDREL_BASE_URL = process.env.MANDREL_URL || 'https://mandrel.ridgetopai.net/mcp/tools';

// Context types that Mandrel accepts
export type MandrelContextType =
  | 'code'
  | 'decision'
  | 'error'
  | 'discussion'
  | 'planning'
  | 'completion'
  | 'milestone'
  | 'reflections'
  | 'handoff';

// Structure for storing workflow completions
export interface WorkflowCompletion {
  type: 'bugfix' | 'content';
  capability: 'PRODUCE' | 'GROW' | 'OPERATE';
  workflowId: string;
  input: BugReport | ContentBrief;
  output: BugAnalysis | ContentGenerationResult;
  review?: {
    decision: 'approved' | 'rejected' | 'changes_requested';
    feedback?: string;
  };
  completedAt: Date;
  /** Stage of workflow: 'proposed' for initial analysis, 'confirmed' for user verification */
  stage?: 'proposed' | 'confirmed';
}

// Structure for storing support ticket completions
export interface TicketCompletion {
  type: 'support';
  capability: 'OPERATE';
  workflowId: string;
  input: SupportTicket;
  output: TicketAnalysis;
  response?: {
    sentTo: string;
    body: string;
    sentAt: Date;
  };
  completedAt: Date;
}

// Structure for storing monitoring alert completions
export interface AlertCompletion {
  type: 'monitoring';
  capability: 'OPERATE';
  workflowId: string;
  input: MonitoringAlert;
  output: AlertAnalysis;
  remediation?: {
    action: string;
    notes?: string;
    executedAt: Date;
  };
  completedAt: Date;
}

// Structure for storing orchestration completions
export interface OrchestrationCompletion {
  type: 'orchestration';
  capability: 'COMMAND';
  sessionId: string;
  intent: string;
  context?: {
    focus?: string;
    urgency?: 'high' | 'normal' | 'low';
    constraints?: string;
  };
  interpretation: {
    understood: string;
    reasoning: string;
    warnings?: string[];
  };
  tasks: Array<{
    id: string;
    type: string;
    title: string;
    status: string;
    result?: unknown;
    error?: string;
  }>;
  execution: {
    total: number;
    completed: number;
    failed: number;
  };
  completedAt: Date;
}

// Search result from Mandrel
export interface MandrelContext {
  id: string;
  content: string;
  type: MandrelContextType;
  tags: string[];
  createdAt: string;
  relevance?: number;
}

// Response from context_store
interface StoreResponse {
  success: boolean;
  result?: {
    content: Array<{
      type: string;
      text: string;
    }>;
  };
  error?: string;
}

// Response from context_search
interface SearchResponse {
  success: boolean;
  result?: {
    content: Array<{
      type: string;
      text: string;
    }>;
  };
  error?: string;
}

/**
 * Call a Mandrel MCP tool via HTTP
 */
async function callMandrelTool<T>(
  toolName: string,
  args: Record<string, unknown>
): Promise<T | null> {
  const url = `${MANDREL_BASE_URL}/${toolName}`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ arguments: args }),
    });

    if (!response.ok) {
      console.error(`[MandrelClient] HTTP ${response.status} from ${toolName}`);
      return null;
    }

    const data = await response.json() as T;
    return data;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[MandrelClient] Failed to call ${toolName}: ${errorMessage}`);
    return null;
  }
}

/**
 * Store a completed workflow to Mandrel for future reference
 * @param completion - The workflow completion data
 * @param projectName - Optional Mandrel project name to store to (will call project_switch first)
 */
export async function storeWorkflowCompletion(
  completion: WorkflowCompletion,
  projectName?: string
): Promise<boolean> {
  console.log(`[MandrelClient] Storing ${completion.type} workflow completion: ${completion.workflowId}`);

  // Switch to the correct project before storing
  if (projectName) {
    const switched = await switchProject(projectName);
    if (!switched) {
      console.error(`[MandrelClient] Failed to switch to project ${projectName}, aborting store`);
      return false;
    }
  }

  // Build a human-readable summary for the content
  const summary = buildCompletionSummary(completion);

  // Determine context type based on stage
  // - 'proposed' stage uses 'planning' type (awaiting verification)
  // - 'confirmed' stage uses 'completion' type (verified outcome)
  const contextType: MandrelContextType = completion.stage === 'proposed' ? 'planning' : 'completion';

  // Build tags for searchability
  const tags = [
    'workflow',
    completion.type,
    completion.capability.toLowerCase(),
    projectName || 'ridgetopai-alpha',
    completion.stage || 'completion', // tag with stage for filtering
  ];

  // Add specific tags based on workflow type
  if (completion.type === 'bugfix' && 'severity' in completion.input) {
    tags.push(`severity-${completion.input.severity}`);
  }
  if (completion.type === 'content' && 'format' in completion.input) {
    tags.push(`format-${completion.input.format}`);
  }

  const response = await callMandrelTool<StoreResponse>('context_store', {
    content: summary,
    type: contextType,
    tags,
  });

  if (response?.success) {
    console.log(`[MandrelClient] Workflow ${completion.stage || 'completion'} stored successfully (type: ${contextType})`);

    // Record observation for Strategic Layer (Phase 1)
    // Fire-and-forget: don't block the workflow completion
    if (completion.type === 'bugfix') {
      recordBugfixCompletion(completion).catch(err => {
        console.error('[MandrelClient] Failed to record bugfix observation:', err);
      });
    } else if (completion.type === 'content') {
      recordContentCompletion(completion).catch(err => {
        console.error('[MandrelClient] Failed to record content observation:', err);
      });
    }

    return true;
  }

  console.error(`[MandrelClient] Failed to store workflow completion`);
  return false;
}

/**
 * Build a human-readable summary of a workflow completion
 * Generates different content based on stage:
 * - 'proposed': Focus on the proposed fix awaiting verification
 * - 'confirmed': Focus on the verified outcome with user confirmation
 */
function buildCompletionSummary(completion: WorkflowCompletion): string {
  const timestamp = completion.completedAt.toISOString();

  if (completion.type === 'bugfix') {
    const input = completion.input as BugReport;
    const output = completion.output as BugAnalysis;

    // PROPOSED stage: AI analysis complete, awaiting user verification
    if (completion.stage === 'proposed') {
      return `PROPOSED FIX: Bug Fix (Awaiting Verification)
Capability: ${completion.capability}
WorkflowId: ${completion.workflowId}
ProposedAt: ${timestamp}
Status: PENDING VERIFICATION

## Bug Report
Title: ${input.title}
Severity: ${input.severity}
Description: ${input.description}

## AI Analysis
Root Cause: ${output.rootCause}
Confidence: ${output.confidence}
Evidence: ${output.evidence}

## Proposed Solution
${output.proposedFix ? `
Explanation: ${output.proposedFix.explanation}
Files to Change: ${output.proposedFix.changes.map(c => c.file).join(', ')}
Identified Risks: ${output.proposedFix.risks.join('; ')}
` : 'No fix proposed'}

---
This proposed fix requires user verification after implementation.`;
    }

    // CONFIRMED stage: User has verified the fix worked or failed
    const verificationStatus = completion.review?.decision === 'approved' ? 'FIX VERIFIED - WORKED' : 'FIX VERIFIED - FAILED';
    return `VERIFIED FIX: Bug Fix
Capability: ${completion.capability}
WorkflowId: ${completion.workflowId}
VerifiedAt: ${timestamp}
Status: ${verificationStatus}

## Bug Report
Title: ${input.title}
Severity: ${input.severity}

## Fix Outcome
Verification: ${completion.review?.decision === 'approved' ? 'User confirmed fix WORKED' : 'User reported fix FAILED'}
${completion.review?.feedback ? `User Feedback: ${completion.review.feedback}` : ''}

## Original Analysis
Root Cause: ${output.rootCause}
Confidence: ${output.confidence}
${output.proposedFix ? `Files Changed: ${output.proposedFix.changes.map(c => c.file).join(', ')}` : ''}

---
This fix has been verified by the user.`;
  }

  if (completion.type === 'content') {
    const input = completion.input as ContentBrief;
    const output = completion.output as ContentGenerationResult;

    return `WORKFLOW COMPLETION: Content Generation
Capability: ${completion.capability}
WorkflowId: ${completion.workflowId}
CompletedAt: ${timestamp}

## Content Brief
Title: ${input.title}
Topic: ${input.topic}
Format: ${input.format}
Audience: ${input.audience}
Tone: ${input.tone}
${input.keyPoints ? `Key Points: ${input.keyPoints.join(', ')}` : ''}

## Generated Content
Title: ${output.content.title}
Word Count: ${output.content.metadata?.wordCount || 'unknown'}
Confidence: ${output.confidence}

Summary: ${output.content.summary || 'No summary'}

## Review
Decision: ${completion.review?.decision || 'not reviewed'}
${completion.review?.feedback ? `Feedback: ${completion.review.feedback}` : ''}`;
  }

  return `Unknown workflow type: ${completion.type}`;
}

/**
 * Search Mandrel for relevant context before starting a workflow
 */
export async function searchRelevantContext(
  query: string,
  options: {
    type?: MandrelContextType;
    limit?: number;
  } = {}
): Promise<MandrelContext[]> {
  const { type, limit = 5 } = options;

  console.log(`[MandrelClient] Searching for: "${query.substring(0, 50)}..."`);

  const args: Record<string, unknown> = {
    query,
    limit,
  };
  if (type) {
    args.type = type;
  }

  const response = await callMandrelTool<SearchResponse>('context_search', args);

  if (!response?.success || !response.result?.content) {
    console.log(`[MandrelClient] No relevant context found`);
    return [];
  }

  // Parse the response text into structured contexts
  const contexts = parseSearchResults(response.result.content);
  console.log(`[MandrelClient] Found ${contexts.length} relevant contexts`);

  return contexts;
}

/**
 * Parse Mandrel search results into structured contexts
 */
function parseSearchResults(content: Array<{ type: string; text: string }>): MandrelContext[] {
  const contexts: MandrelContext[] = [];

  for (const item of content) {
    if (item.type === 'text') {
      // Parse the text output which typically contains multiple results
      // Format: numbered list with Content:, Tags:, ID: fields
      const matches = item.text.matchAll(/(\d+)\.\s+\*\*(\w+)\*\*.*?\n\s+Content:\s*([\s\S]*?)\n\s+Tags:\s*\[(.*?)\]\n\s+ID:\s*(\S+)/g);

      for (const match of matches) {
        contexts.push({
          id: match[5],
          type: match[2].toLowerCase() as MandrelContextType,
          content: match[3].trim(),
          tags: match[4].split(',').map(t => t.trim()),
          createdAt: new Date().toISOString(), // Mandrel doesn't always return this
        });
      }
    }
  }

  return contexts;
}

/**
 * Get recent workflow completions from Mandrel
 */
export async function getRecentWorkflows(
  limit: number = 10
): Promise<MandrelContext[]> {
  console.log(`[MandrelClient] Getting ${limit} recent workflows`);

  const response = await callMandrelTool<SearchResponse>('context_get_recent', {
    limit,
  });

  if (!response?.success || !response.result?.content) {
    console.log(`[MandrelClient] No recent workflows found`);
    return [];
  }

  // Filter to just workflow completions
  const contexts = parseSearchResults(response.result.content);
  return contexts.filter(c =>
    c.type === 'completion' && c.tags.includes('workflow')
  );
}

/**
 * Build context augmentation for bug analysis prompts
 */
export async function getContextForBugAnalysis(
  bugReport: BugReport
): Promise<string> {
  // Search for similar bugs
  const query = `bug ${bugReport.title} ${bugReport.description.substring(0, 100)}`;
  const contexts = await searchRelevantContext(query, {
    type: 'completion',
    limit: 3,
  });

  if (contexts.length === 0) {
    return '';
  }

  // Build context section for prompt
  return `
## Relevant Previous Work (from institutional memory)

The following past bug fixes may be relevant to this issue:

${contexts.map((c, i) => `### Previous Fix ${i + 1}
${c.content.substring(0, 500)}${c.content.length > 500 ? '...' : ''}
`).join('\n')}

Consider whether these past fixes provide insights for the current bug.
`;
}

/**
 * Build context augmentation for content generation prompts
 */
export async function getContextForContentGeneration(
  brief: ContentBrief
): Promise<string> {
  // Search for similar content
  const query = `content ${brief.format} ${brief.topic} ${brief.audience}`;
  const contexts = await searchRelevantContext(query, {
    type: 'completion',
    limit: 3,
  });

  if (contexts.length === 0) {
    return '';
  }

  // Build context section for prompt
  return `
## Brand Voice and Previous Content (from institutional memory)

Review the following past content to maintain consistency in tone and style:

${contexts.map((c, i) => `### Previous Content ${i + 1}
${c.content.substring(0, 500)}${c.content.length > 500 ? '...' : ''}
`).join('\n')}

Ensure new content aligns with established brand voice and builds on previous work.
`;
}

/**
 * Check if Mandrel is available
 */
export async function checkMandrelAvailable(): Promise<boolean> {
  const response = await callMandrelTool<{ success: boolean }>('mandrel_ping', {});
  return response?.success === true;
}

/**
 * Switch Mandrel to a specific project
 * MUST be called before storing context to ensure it goes to the right project
 */
export async function switchProject(projectName: string): Promise<boolean> {
  console.log(`[MandrelClient] Switching to project: ${projectName}`);

  const response = await callMandrelTool<{ success: boolean }>('project_switch', {
    project: projectName,
  });

  if (response?.success) {
    console.log(`[MandrelClient] Successfully switched to project: ${projectName}`);
    return true;
  }

  console.error(`[MandrelClient] Failed to switch to project: ${projectName}`);
  return false;
}

/**
 * Store a decision or reflection for future reference
 */
export async function storeDecision(
  content: string,
  tags: string[] = []
): Promise<boolean> {
  const response = await callMandrelTool<StoreResponse>('context_store', {
    content,
    type: 'decision' as MandrelContextType,
    tags: ['ridgetopai-alpha', ...tags],
  });

  return response?.success === true;
}

/**
 * Store a milestone context to Mandrel
 * Used by Strategic Layer for goal lifecycle events
 */
export async function storeMilestoneContext(
  content: string,
  tags: string[] = []
): Promise<boolean> {
  const response = await callMandrelTool<StoreResponse>('context_store', {
    content,
    type: 'milestone' as MandrelContextType,
    tags: ['ridgetopai-alpha', ...tags],
  });

  return response?.success === true;
}

/**
 * Build context augmentation for support ticket analysis prompts
 */
export async function getContextForTicketAnalysis(
  ticket: SupportTicket
): Promise<string> {
  // Search for similar tickets
  const query = `support ticket ${ticket.category} ${ticket.title} ${ticket.description.substring(0, 100)}`;
  const contexts = await searchRelevantContext(query, {
    type: 'completion',
    limit: 3,
  });

  if (contexts.length === 0) {
    return '';
  }

  // Build context section for prompt
  return `
## Similar Past Support Cases (from institutional memory)

The following past support tickets may be relevant to this issue:

${contexts.map((c, i) => `### Previous Case ${i + 1}
${c.content.substring(0, 500)}${c.content.length > 500 ? '...' : ''}
`).join('\n')}

Consider whether these past cases provide insights for the current ticket.
`;
}

/**
 * Store a completed support ticket workflow to Mandrel
 */
export async function storeTicketCompletion(
  completion: TicketCompletion
): Promise<boolean> {
  console.log(`[MandrelClient] Storing support ticket completion: ${completion.workflowId}`);

  // Build a human-readable summary for the content
  const summary = buildTicketCompletionSummary(completion);

  // Build tags for searchability
  const tags = [
    'workflow',
    'support',
    'operate',
    'ridgetopai-alpha',
    `category-${completion.input.category}`,
    `severity-${completion.input.severity}`,
  ];

  if (completion.output.actionRequired.type) {
    tags.push(`action-${completion.output.actionRequired.type}`);
  }

  const response = await callMandrelTool<StoreResponse>('context_store', {
    content: summary,
    type: 'completion' as MandrelContextType,
    tags,
  });

  if (response?.success) {
    console.log(`[MandrelClient] Ticket completion stored successfully`);

    // Record observation for Strategic Layer (Phase 1)
    // Fire-and-forget: don't block the workflow completion
    recordTicketCompletion(completion).catch(err => {
      console.error('[MandrelClient] Failed to record ticket observation:', err);
    });

    return true;
  }

  console.error(`[MandrelClient] Failed to store ticket completion`);
  return false;
}

/**
 * Build a human-readable summary of a support ticket completion
 */
function buildTicketCompletionSummary(completion: TicketCompletion): string {
  const timestamp = completion.completedAt.toISOString();
  const input = completion.input;
  const output = completion.output;

  return `WORKFLOW COMPLETION: Support Ticket
Capability: ${completion.capability}
WorkflowId: ${completion.workflowId}
CompletedAt: ${timestamp}

## Ticket Details
Title: ${input.title}
Customer: ${input.customerName || 'Anonymous'} <${input.customerEmail}>
Category: ${input.category}
Severity: ${input.severity}
Description: ${input.description.substring(0, 500)}${input.description.length > 500 ? '...' : ''}
${input.affectedFeature ? `Affected Feature: ${input.affectedFeature}` : ''}

## Analysis
Summary: ${output.summary}
Root Cause: ${output.rootCause}
Affected Users: ${output.affectedUsers}
Impact: ${output.impact}
Confidence: ${output.confidence}
${output.workaround ? `Workaround: ${output.workaround}` : ''}

## Action Required
Type: ${output.actionRequired.type}
Description: ${output.actionRequired.description}
${output.actionRequired.estimatedEffort ? `Estimated Effort: ${output.actionRequired.estimatedEffort}` : ''}

## Response
${completion.response ? `
Sent To: ${completion.response.sentTo}
Sent At: ${completion.response.sentAt.toISOString()}
Response: ${completion.response.body.substring(0, 300)}${completion.response.body.length > 300 ? '...' : ''}
` : 'No response sent yet'}

## Internal Notes
${output.internalNotes}`;
}

/**
 * Build context augmentation for monitoring alert analysis prompts
 */
export async function getContextForAlertAnalysis(
  alert: MonitoringAlert
): Promise<string> {
  // Search for similar alerts/incidents
  const query = `monitoring alert ${alert.category} ${alert.title} ${alert.affectedService || ''} ${alert.description.substring(0, 100)}`;
  const contexts = await searchRelevantContext(query, {
    type: 'completion',
    limit: 3,
  });

  if (contexts.length === 0) {
    return '';
  }

  // Build context section for prompt
  return `
## Similar Past Incidents (from institutional memory)

The following past alerts/incidents may be relevant:

${contexts.map((c, i) => `### Previous Incident ${i + 1}
${c.content.substring(0, 500)}${c.content.length > 500 ? '...' : ''}
`).join('\n')}

Consider whether these past incidents provide insights for the current alert.
`;
}

/**
 * Store a completed monitoring alert workflow to Mandrel
 */
export async function storeAlertCompletion(
  completion: AlertCompletion
): Promise<boolean> {
  console.log(`[MandrelClient] Storing monitoring alert completion: ${completion.workflowId}`);

  // Build a human-readable summary for the content
  const summary = buildAlertCompletionSummary(completion);

  // Build tags for searchability
  const tags = [
    'workflow',
    'monitoring',
    'operate',
    'ridgetopai-alpha',
    `category-${completion.input.category}`,
    `severity-${completion.input.severity}`,
    `source-${completion.input.source}`,
  ];

  if (completion.output.suggestedRemediation.type) {
    tags.push(`remediation-${completion.output.suggestedRemediation.type}`);
  }

  if (completion.input.affectedService) {
    tags.push(`service-${completion.input.affectedService.toLowerCase().replace(/\s+/g, '-')}`);
  }

  const response = await callMandrelTool<StoreResponse>('context_store', {
    content: summary,
    type: 'completion' as MandrelContextType,
    tags,
  });

  if (response?.success) {
    console.log(`[MandrelClient] Alert completion stored successfully`);

    // Record observation for Strategic Layer (Phase 1)
    // Fire-and-forget: don't block the workflow completion
    recordAlertCompletion(completion).catch(err => {
      console.error('[MandrelClient] Failed to record alert observation:', err);
    });

    return true;
  }

  console.error(`[MandrelClient] Failed to store alert completion`);
  return false;
}

/**
 * Build a human-readable summary of a monitoring alert completion
 */
function buildAlertCompletionSummary(completion: AlertCompletion): string {
  const timestamp = completion.completedAt.toISOString();
  const input = completion.input;
  const output = completion.output;

  return `WORKFLOW COMPLETION: Monitoring Alert
Capability: ${completion.capability}
WorkflowId: ${completion.workflowId}
CompletedAt: ${timestamp}

## Alert Details
Title: ${input.title}
Category: ${input.category}
Severity: ${input.severity}
Source: ${input.source}
${input.affectedService ? `Affected Service: ${input.affectedService}` : ''}
${input.metricValue ? `Metric Value: ${input.metricValue}` : ''}
${input.threshold ? `Threshold: ${input.threshold}` : ''}
Description: ${input.description.substring(0, 500)}${input.description.length > 500 ? '...' : ''}

## Analysis
Summary: ${output.summary}
Root Cause: ${output.rootCause}
Impact: ${output.impact}
Urgency: ${output.urgency}
Affected Systems: ${output.affectedSystems}
Confidence: ${output.confidence}

## Suggested Remediation
Type: ${output.suggestedRemediation.type}
Description: ${output.suggestedRemediation.description}
Steps:
${output.suggestedRemediation.steps.map((s, i) => `  ${i + 1}. ${s}`).join('\n')}
Risks: ${output.suggestedRemediation.risks.join(', ') || 'None identified'}
${output.suggestedRemediation.estimatedDowntime ? `Estimated Downtime: ${output.suggestedRemediation.estimatedDowntime}` : ''}

## Remediation Outcome
${completion.remediation ? `
Action Taken: ${completion.remediation.action}
Executed At: ${completion.remediation.executedAt.toISOString()}
${completion.remediation.notes ? `Notes: ${completion.remediation.notes}` : ''}
` : 'No remediation executed yet'}

## Internal Notes
${output.internalNotes}`;
}

/**
 * Build context augmentation for orchestration intent analysis prompts
 * Searches for similar past orchestration sessions to inform task generation
 */
export async function getContextForOrchestration(
  intent: string,
  focus?: string
): Promise<string> {
  // Search for similar orchestration sessions and strategic decisions
  const query = `orchestration ${focus || ''} ${intent.substring(0, 100)}`;
  const contexts = await searchRelevantContext(query, {
    type: 'completion',
    limit: 3,
  });

  if (contexts.length === 0) {
    return '';
  }

  // Build context section for prompt
  return `
## Relevant Previous Orchestrations (from institutional memory)

The following past orchestration sessions may be relevant:

${contexts.map((c, i) => `### Previous Session ${i + 1}
${c.content.substring(0, 500)}${c.content.length > 500 ? '...' : ''}
`).join('\n')}

Consider whether these past sessions provide insights for task decomposition.
`;
}

/**
 * Store a completed orchestration session to Mandrel
 */
export async function storeOrchestrationCompletion(
  completion: OrchestrationCompletion
): Promise<boolean> {
  console.log(`[MandrelClient] Storing orchestration completion: ${completion.sessionId}`);

  // Build a human-readable summary for the content
  const summary = buildOrchestrationCompletionSummary(completion);

  // Build tags for searchability
  const tags = [
    'workflow',
    'orchestration',
    'command',
    'ridgetopai-alpha',
  ];

  if (completion.context?.focus) {
    tags.push(`focus-${completion.context.focus}`);
  }

  if (completion.context?.urgency) {
    tags.push(`urgency-${completion.context.urgency}`);
  }

  // Add task type tags
  const taskTypes = [...new Set(completion.tasks.map(t => t.type))];
  taskTypes.forEach(type => tags.push(`task-${type}`));

  // Add outcome tags
  if (completion.execution.failed > 0) {
    tags.push('has-failures');
  }
  if (completion.execution.completed === completion.execution.total) {
    tags.push('all-completed');
  }

  const response = await callMandrelTool<StoreResponse>('context_store', {
    content: summary,
    type: 'completion' as MandrelContextType,
    tags,
  });

  if (response?.success) {
    console.log(`[MandrelClient] Orchestration completion stored successfully`);

    // Record observation for Strategic Layer (Phase 1)
    // Fire-and-forget: don't block the workflow completion
    recordOrchestrationCompletion(completion).catch(err => {
      console.error('[MandrelClient] Failed to record orchestration observation:', err);
    });

    return true;
  }

  console.error(`[MandrelClient] Failed to store orchestration completion`);
  return false;
}

/**
 * Build a human-readable summary of an orchestration completion
 */
function buildOrchestrationCompletionSummary(completion: OrchestrationCompletion): string {
  const timestamp = completion.completedAt.toISOString();

  const taskSummaries = completion.tasks.map((task, i) => {
    const status = task.status === 'completed' ? '✓' : task.status === 'failed' ? '✗' : '○';
    const error = task.error ? ` (Error: ${task.error})` : '';
    return `  ${i + 1}. [${status}] ${task.title} (${task.type})${error}`;
  }).join('\n');

  return `WORKFLOW COMPLETION: Orchestration Session
Capability: ${completion.capability}
SessionId: ${completion.sessionId}
CompletedAt: ${timestamp}

## Original Intent
"${completion.intent}"

## Context
Focus: ${completion.context?.focus || 'auto-detect'}
Urgency: ${completion.context?.urgency || 'normal'}
${completion.context?.constraints ? `Constraints: ${completion.context.constraints}` : ''}

## AI Interpretation
Understood: ${completion.interpretation.understood}
Reasoning: ${completion.interpretation.reasoning}
${completion.interpretation.warnings?.length ? `Warnings: ${completion.interpretation.warnings.join('; ')}` : ''}

## Tasks Generated (${completion.execution.total} total)
${taskSummaries}

## Execution Summary
Completed: ${completion.execution.completed}
Failed: ${completion.execution.failed}
Success Rate: ${completion.execution.total > 0 ? Math.round((completion.execution.completed / completion.execution.total) * 100) : 0}%`;
}
