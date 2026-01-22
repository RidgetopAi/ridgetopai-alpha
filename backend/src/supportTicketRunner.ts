/**
 * SupportTicketRunner - Executes AI-powered support ticket analysis via Claude CLI
 * Instance 20 - OPERATE capability for support workflow
 *
 * Design principles:
 * - Analyzes customer support tickets to identify root cause
 * - Generates professional customer-facing responses
 * - Suggests internal actions (fix, documentation, escalation)
 * - Leverages Mandrel for similar past tickets
 */

import { spawn, type ChildProcess } from 'child_process';
import type {
  SupportTicket,
  TicketAnalysis,
  TaskResult,
  Confidence,
  TicketSeverity,
  TicketActionType,
} from './types.js';
import { getContextForTicketAnalysis, storeTicketCompletion, type TicketCompletion } from './mandrelClient.js';

export interface TicketRunnerConfig {
  timeoutMs: number;
  projectPath: string;
}

const DEFAULT_CONFIG: TicketRunnerConfig = {
  timeoutMs: 300000, // 5 minutes
  projectPath: process.cwd(),
};

/**
 * Build the analysis prompt for support ticket workflow
 */
function buildTicketAnalysisPrompt(
  ticket: SupportTicket,
  projectPath: string,
  mandrelContext?: string
): string {
  return `You are a support agent analyzing a customer support ticket for a codebase at: ${projectPath}
${mandrelContext || ''}

## Support Ticket

**Title:** ${ticket.title}
**Customer:** ${ticket.customerName || 'Anonymous'} <${ticket.customerEmail}>
**Category:** ${ticket.category}
**Severity:** ${ticket.severity}

**Description:**
${ticket.description}

${ticket.affectedFeature ? `**Affected Feature:** ${ticket.affectedFeature}\n` : ''}
${ticket.errorMessage ? `**Error Message:** ${ticket.errorMessage}\n` : ''}
${ticket.stepsToReproduce ? `**Steps to Reproduce:**\n${ticket.stepsToReproduce}\n` : ''}

## Your Task

1. Analyze this support ticket to understand the customer's issue
2. If it's a technical issue, search the codebase for relevant code
3. Identify the root cause and assess impact
4. Draft a professional, empathetic customer response
5. Recommend internal actions (code fix, documentation update, etc.)

## Output Format

You MUST respond with a JSON object in this exact format:

\`\`\`json
{
  "summary": "Brief summary of the issue (1-2 sentences)",
  "rootCause": "Technical root cause explanation",
  "affectedUsers": "Who is affected (e.g., 'All users', 'Users with feature X enabled')",
  "impact": "Business/user impact description",
  "workaround": "Temporary workaround if available, or null",
  "suggestedResponse": "Professional customer-facing email response. Be empathetic and clear. Include next steps.",
  "internalNotes": "Notes for the support/engineering team",
  "severity": "critical|high|medium|low (based on your analysis, may differ from customer's assessment)",
  "confidence": "high|medium|low",
  "actionRequired": {
    "type": "immediate_fix|documentation|workaround|investigation|escalation|no_action",
    "description": "What needs to be done",
    "estimatedEffort": "quick fix|1 hour|half day|1 day|multiple days"
  },
  "relatedIssues": ["Optional array of related file paths or issue references"]
}
\`\`\`

Important:
- Be empathetic in the customer response - acknowledge their frustration
- Keep technical details in internalNotes, not in suggestedResponse
- If this is a known issue, reference any related past work
- If you cannot determine the cause, recommend investigation and set confidence to "low"
- Suggest escalation if the issue is complex or severity is critical`;
}

/**
 * Parse Claude's output into structured TicketAnalysis
 */
function parseTicketAnalysisOutput(output: string): TicketAnalysis {
  // Try to find JSON in the output
  const jsonMatch = output.match(/```json\s*([\s\S]*?)\s*```/);

  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[1]);
      return {
        summary: parsed.summary || 'Analysis completed',
        rootCause: parsed.rootCause || 'Unable to determine root cause',
        affectedUsers: parsed.affectedUsers || 'Unknown',
        impact: parsed.impact || 'Unknown impact',
        workaround: parsed.workaround || undefined,
        suggestedResponse: parsed.suggestedResponse || 'We are investigating your issue and will follow up shortly.',
        internalNotes: parsed.internalNotes || '',
        severity: (parsed.severity as TicketSeverity) || 'medium',
        confidence: (parsed.confidence as Confidence) || 'low',
        actionRequired: {
          type: (parsed.actionRequired?.type as TicketActionType) || 'investigation',
          description: parsed.actionRequired?.description || 'Further analysis needed',
          estimatedEffort: parsed.actionRequired?.estimatedEffort,
        },
        relatedIssues: parsed.relatedIssues,
        rawOutput: output,
      };
    } catch (e) {
      console.error('[SupportTicketRunner] Failed to parse JSON from output:', e);
    }
  }

  // Fallback: try to parse the entire output as JSON
  try {
    const parsed = JSON.parse(output.trim());
    return {
      summary: parsed.summary || 'Analysis completed',
      rootCause: parsed.rootCause || 'Unable to determine root cause',
      affectedUsers: parsed.affectedUsers || 'Unknown',
      impact: parsed.impact || 'Unknown impact',
      workaround: parsed.workaround || undefined,
      suggestedResponse: parsed.suggestedResponse || 'We are investigating your issue and will follow up shortly.',
      internalNotes: parsed.internalNotes || '',
      severity: (parsed.severity as TicketSeverity) || 'medium',
      confidence: (parsed.confidence as Confidence) || 'low',
      actionRequired: {
        type: (parsed.actionRequired?.type as TicketActionType) || 'investigation',
        description: parsed.actionRequired?.description || 'Further analysis needed',
        estimatedEffort: parsed.actionRequired?.estimatedEffort,
      },
      relatedIssues: parsed.relatedIssues,
      rawOutput: output,
    };
  } catch {
    // Final fallback: return raw output as analysis
    return {
      summary: 'Analysis completed but output format was unexpected',
      rootCause: 'Unable to parse analysis results',
      affectedUsers: 'Unknown',
      impact: 'Unknown',
      suggestedResponse: 'We are investigating your issue and will follow up shortly.',
      internalNotes: output.substring(0, 500),
      severity: 'medium',
      confidence: 'low',
      actionRequired: {
        type: 'investigation',
        description: 'Manual review required - automated analysis failed to parse',
      },
      rawOutput: output,
    };
  }
}

/**
 * Execute a support ticket analysis task using Claude CLI
 */
export async function runTicketAnalysis(
  ticket: SupportTicket,
  config: Partial<TicketRunnerConfig> = {}
): Promise<TaskResult<TicketAnalysis>> {
  const { timeoutMs, projectPath } = { ...DEFAULT_CONFIG, ...config };
  const startTime = Date.now();

  // Query Mandrel for relevant previous tickets
  let mandrelContext = '';
  try {
    console.log('[SupportTicketRunner] Querying Mandrel for relevant context...');
    mandrelContext = await getContextForTicketAnalysis(ticket);
    if (mandrelContext) {
      console.log('[SupportTicketRunner] Found relevant context from Mandrel');
    }
  } catch (error) {
    console.warn('[SupportTicketRunner] Mandrel context retrieval failed (continuing without):', error);
  }

  const prompt = buildTicketAnalysisPrompt(ticket, projectPath, mandrelContext);

  return new Promise((resolve) => {
    let stdout = '';
    let stderr = '';
    let killed = false;
    let timeoutHandle: ReturnType<typeof setTimeout> | null = null;

    console.log(`[SupportTicketRunner] Starting ticket analysis for: ${ticket.title}`);
    console.log(`[SupportTicketRunner] Category: ${ticket.category}, Severity: ${ticket.severity}`);
    console.log(`[SupportTicketRunner] Customer: ${ticket.customerEmail}`);
    console.log(`[SupportTicketRunner] Timeout: ${timeoutMs}ms`);

    // Spawn claude CLI with the analysis prompt
    const child: ChildProcess = spawn('claude', [
      '--print',
      '--dangerously-skip-permissions',
      prompt,
    ], {
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
      cwd: projectPath,
    });

    const cleanup = () => {
      if (timeoutHandle) {
        clearTimeout(timeoutHandle);
        timeoutHandle = null;
      }
    };

    child.stdout?.on('data', (data) => {
      const chunk = data.toString();
      stdout += chunk;
      if (stdout.length % 1000 < 100) {
        console.log(`[SupportTicketRunner] Received ${stdout.length} bytes of output...`);
      }
    });

    child.stderr?.on('data', (data) => {
      const chunk = data.toString();
      stderr += chunk;
      if (chunk.includes('error') || chunk.includes('Error')) {
        console.error(`[SupportTicketRunner] stderr: ${chunk}`);
      }
    });

    child.on('error', (err) => {
      cleanup();
      console.error(`[SupportTicketRunner] Spawn error: ${err.message}`);
      resolve({
        success: false,
        error: `Failed to spawn claude CLI: ${err.message}`,
        durationMs: Date.now() - startTime,
      });
    });

    child.on('close', (code) => {
      cleanup();
      const durationMs = Date.now() - startTime;

      if (killed) {
        console.log('[SupportTicketRunner] Process killed due to timeout');
        resolve({
          success: false,
          error: 'Analysis timed out',
          durationMs,
        });
        return;
      }

      console.log(`[SupportTicketRunner] Claude CLI exited with code ${code}`);
      console.log(`[SupportTicketRunner] Analysis completed in ${durationMs}ms`);

      if (code !== 0) {
        resolve({
          success: false,
          error: `Claude CLI exited with code ${code}: ${stderr || stdout}`,
          durationMs,
        });
        return;
      }

      // Parse the output into structured analysis
      const analysis = parseTicketAnalysisOutput(stdout);

      resolve({
        success: true,
        data: analysis,
        durationMs,
      });
    });

    // Set timeout
    timeoutHandle = setTimeout(() => {
      killed = true;
      console.log(`[SupportTicketRunner] Timeout reached (${timeoutMs}ms), killing process`);
      child.kill('SIGTERM');

      setTimeout(() => {
        if (!child.killed) {
          child.kill('SIGKILL');
        }
      }, 5000);
    }, timeoutMs);
  });
}

/**
 * Store a completed support ticket workflow to Mandrel
 */
export async function storeTicketWorkflowCompletion(
  workflowId: string,
  ticket: SupportTicket,
  analysis: TicketAnalysis,
  response?: { sentTo: string; body: string; sentAt: Date }
): Promise<boolean> {
  console.log(`[SupportTicketRunner] Storing ticket completion: ${workflowId}`);

  const completion: TicketCompletion = {
    type: 'support',
    capability: 'OPERATE',
    workflowId,
    input: ticket,
    output: analysis,
    response,
    completedAt: new Date(),
  };

  try {
    const stored = await storeTicketCompletion(completion);
    if (stored) {
      console.log(`[SupportTicketRunner] Ticket completion stored to Mandrel`);
    }
    return stored;
  } catch (error) {
    console.warn('[SupportTicketRunner] Failed to store completion to Mandrel:', error);
    return false;
  }
}
