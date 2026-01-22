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
 */
export async function storeWorkflowCompletion(
  completion: WorkflowCompletion
): Promise<boolean> {
  console.log(`[MandrelClient] Storing ${completion.type} workflow completion: ${completion.workflowId}`);

  // Build a human-readable summary for the content
  const summary = buildCompletionSummary(completion);

  // Build tags for searchability
  const tags = [
    'workflow',
    completion.type,
    completion.capability.toLowerCase(),
    'ridgetopai-alpha',
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
    type: 'completion' as MandrelContextType,
    tags,
  });

  if (response?.success) {
    console.log(`[MandrelClient] Workflow completion stored successfully`);
    return true;
  }

  console.error(`[MandrelClient] Failed to store workflow completion`);
  return false;
}

/**
 * Build a human-readable summary of a workflow completion
 */
function buildCompletionSummary(completion: WorkflowCompletion): string {
  const timestamp = completion.completedAt.toISOString();

  if (completion.type === 'bugfix') {
    const input = completion.input as BugReport;
    const output = completion.output as BugAnalysis;

    return `WORKFLOW COMPLETION: Bug Fix
Capability: ${completion.capability}
WorkflowId: ${completion.workflowId}
CompletedAt: ${timestamp}

## Bug Report
Title: ${input.title}
Severity: ${input.severity}
Description: ${input.description}

## Analysis
Root Cause: ${output.rootCause}
Confidence: ${output.confidence}
Evidence: ${output.evidence}

## Proposed Fix
${output.proposedFix ? `
Explanation: ${output.proposedFix.explanation}
Files Changed: ${output.proposedFix.changes.map(c => c.file).join(', ')}
Risks: ${output.proposedFix.risks.join('; ')}
` : 'No fix proposed'}

## Review
Decision: ${completion.review?.decision || 'not reviewed'}
${completion.review?.feedback ? `Feedback: ${completion.review.feedback}` : ''}`;
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
