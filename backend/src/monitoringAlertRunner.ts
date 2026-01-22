/**
 * MonitoringAlertRunner - Executes AI-powered monitoring alert analysis via Claude CLI
 * Instance 21 - OPERATE capability for monitoring/alerting workflow
 *
 * Design principles:
 * - Analyzes infrastructure/application alerts to identify root cause
 * - Generates remediation runbooks with step-by-step instructions
 * - Suggests actions (restart, scale, rollback, investigate, notify)
 * - Leverages Mandrel for similar past incidents
 */

import { spawn, type ChildProcess } from 'child_process';
import type {
  MonitoringAlert,
  AlertAnalysis,
  TaskResult,
  Confidence,
  AlertSeverity,
  RemediationActionType,
} from './types.js';
import { getContextForAlertAnalysis, storeAlertCompletion, type AlertCompletion } from './mandrelClient.js';

export interface AlertRunnerConfig {
  timeoutMs: number;
  projectPath: string;
}

const DEFAULT_CONFIG: AlertRunnerConfig = {
  timeoutMs: 300000, // 5 minutes
  projectPath: process.cwd(),
};

/**
 * Build the analysis prompt for monitoring alert workflow
 */
function buildAlertAnalysisPrompt(
  alert: MonitoringAlert,
  projectPath: string,
  mandrelContext?: string
): string {
  return `You are an operations engineer analyzing a monitoring alert for a system at: ${projectPath}
${mandrelContext || ''}

## Monitoring Alert

**Title:** ${alert.title}
**Category:** ${alert.category}
**Severity:** ${alert.severity}
**Source:** ${alert.source}
${alert.affectedService ? `**Affected Service:** ${alert.affectedService}` : ''}
${alert.metricValue ? `**Metric Value:** ${alert.metricValue}` : ''}
${alert.threshold ? `**Threshold:** ${alert.threshold}` : ''}
${alert.startedAt ? `**Started At:** ${alert.startedAt}` : ''}

**Description:**
${alert.description}

${alert.rawPayload ? `**Raw Payload:**\n\`\`\`\n${alert.rawPayload}\n\`\`\`` : ''}

## Your Task

1. Analyze this alert to understand what is happening
2. Identify the likely root cause
3. Assess the impact and urgency
4. Recommend a remediation action with step-by-step instructions
5. Identify any risks or potential complications

## Output Format

You MUST respond with a JSON object in this exact format:

\`\`\`json
{
  "summary": "Brief summary of the alert and situation (1-2 sentences)",
  "rootCause": "Likely root cause of this alert",
  "impact": "Business/system impact description",
  "urgency": "critical|high|medium|low (based on your analysis, may differ from alert severity)",
  "affectedSystems": "What systems/services are affected",
  "suggestedRemediation": {
    "type": "restart|scale|rollback|investigate|notify|none",
    "description": "What action to take",
    "steps": [
      "Step 1: Description of first action",
      "Step 2: Description of second action",
      "..."
    ],
    "risks": ["Potential risk or side effect of this action"],
    "estimatedDowntime": "Expected downtime, e.g., '2-5 minutes' or 'none'"
  },
  "confidence": "high|medium|low",
  "internalNotes": "Additional context or notes for the ops team",
  "relatedIncidents": ["Optional array of related past incidents or similar issues"]
}
\`\`\`

Important:
- Be specific in remediation steps - include actual commands where applicable
- Consider blast radius - what else might be affected
- If this is a known issue pattern, reference past incidents
- If you cannot determine the cause, recommend investigation and set confidence to "low"
- For critical alerts, prioritize quick stabilization over perfect solutions`;
}

/**
 * Parse Claude's output into structured AlertAnalysis
 */
function parseAlertAnalysisOutput(output: string): AlertAnalysis {
  // Try to find JSON in the output
  const jsonMatch = output.match(/```json\s*([\s\S]*?)\s*```/);

  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[1]);
      return {
        summary: parsed.summary || 'Analysis completed',
        rootCause: parsed.rootCause || 'Unable to determine root cause',
        impact: parsed.impact || 'Unknown impact',
        urgency: (parsed.urgency as AlertSeverity) || 'medium',
        affectedSystems: parsed.affectedSystems || 'Unknown',
        suggestedRemediation: {
          type: (parsed.suggestedRemediation?.type as RemediationActionType) || 'investigate',
          description: parsed.suggestedRemediation?.description || 'Further investigation needed',
          steps: parsed.suggestedRemediation?.steps || ['Investigate the alert manually'],
          risks: parsed.suggestedRemediation?.risks || [],
          estimatedDowntime: parsed.suggestedRemediation?.estimatedDowntime,
        },
        confidence: (parsed.confidence as Confidence) || 'low',
        internalNotes: parsed.internalNotes || '',
        relatedIncidents: parsed.relatedIncidents,
        rawOutput: output,
      };
    } catch (e) {
      console.error('[MonitoringAlertRunner] Failed to parse JSON from output:', e);
    }
  }

  // Fallback: try to parse the entire output as JSON
  try {
    const parsed = JSON.parse(output.trim());
    return {
      summary: parsed.summary || 'Analysis completed',
      rootCause: parsed.rootCause || 'Unable to determine root cause',
      impact: parsed.impact || 'Unknown impact',
      urgency: (parsed.urgency as AlertSeverity) || 'medium',
      affectedSystems: parsed.affectedSystems || 'Unknown',
      suggestedRemediation: {
        type: (parsed.suggestedRemediation?.type as RemediationActionType) || 'investigate',
        description: parsed.suggestedRemediation?.description || 'Further investigation needed',
        steps: parsed.suggestedRemediation?.steps || ['Investigate the alert manually'],
        risks: parsed.suggestedRemediation?.risks || [],
        estimatedDowntime: parsed.suggestedRemediation?.estimatedDowntime,
      },
      confidence: (parsed.confidence as Confidence) || 'low',
      internalNotes: parsed.internalNotes || '',
      relatedIncidents: parsed.relatedIncidents,
      rawOutput: output,
    };
  } catch {
    // Final fallback: return raw output as analysis
    return {
      summary: 'Analysis completed but output format was unexpected',
      rootCause: 'Unable to parse analysis results',
      impact: 'Unknown',
      urgency: 'medium',
      affectedSystems: 'Unknown',
      suggestedRemediation: {
        type: 'investigate',
        description: 'Manual review required - automated analysis failed to parse',
        steps: ['Review the raw output below', 'Investigate the alert manually'],
        risks: ['Unknown - analysis failed'],
      },
      confidence: 'low',
      internalNotes: output.substring(0, 500),
      rawOutput: output,
    };
  }
}

/**
 * Execute a monitoring alert analysis task using Claude CLI
 */
export async function runAlertAnalysis(
  alert: MonitoringAlert,
  config: Partial<AlertRunnerConfig> = {}
): Promise<TaskResult<AlertAnalysis>> {
  const { timeoutMs, projectPath } = { ...DEFAULT_CONFIG, ...config };
  const startTime = Date.now();

  // Query Mandrel for relevant past incidents
  let mandrelContext = '';
  try {
    console.log('[MonitoringAlertRunner] Querying Mandrel for relevant context...');
    mandrelContext = await getContextForAlertAnalysis(alert);
    if (mandrelContext) {
      console.log('[MonitoringAlertRunner] Found relevant context from Mandrel');
    }
  } catch (error) {
    console.warn('[MonitoringAlertRunner] Mandrel context retrieval failed (continuing without):', error);
  }

  const prompt = buildAlertAnalysisPrompt(alert, projectPath, mandrelContext);

  return new Promise((resolve) => {
    let stdout = '';
    let stderr = '';
    let killed = false;
    let timeoutHandle: ReturnType<typeof setTimeout> | null = null;

    console.log(`[MonitoringAlertRunner] Starting alert analysis for: ${alert.title}`);
    console.log(`[MonitoringAlertRunner] Category: ${alert.category}, Severity: ${alert.severity}`);
    console.log(`[MonitoringAlertRunner] Source: ${alert.source}`);
    console.log(`[MonitoringAlertRunner] Timeout: ${timeoutMs}ms`);

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
        console.log(`[MonitoringAlertRunner] Received ${stdout.length} bytes of output...`);
      }
    });

    child.stderr?.on('data', (data) => {
      const chunk = data.toString();
      stderr += chunk;
      if (chunk.includes('error') || chunk.includes('Error')) {
        console.error(`[MonitoringAlertRunner] stderr: ${chunk}`);
      }
    });

    child.on('error', (err) => {
      cleanup();
      console.error(`[MonitoringAlertRunner] Spawn error: ${err.message}`);
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
        console.log('[MonitoringAlertRunner] Process killed due to timeout');
        resolve({
          success: false,
          error: 'Analysis timed out',
          durationMs,
        });
        return;
      }

      console.log(`[MonitoringAlertRunner] Claude CLI exited with code ${code}`);
      console.log(`[MonitoringAlertRunner] Analysis completed in ${durationMs}ms`);

      if (code !== 0) {
        resolve({
          success: false,
          error: `Claude CLI exited with code ${code}: ${stderr || stdout}`,
          durationMs,
        });
        return;
      }

      // Parse the output into structured analysis
      const analysis = parseAlertAnalysisOutput(stdout);

      resolve({
        success: true,
        data: analysis,
        durationMs,
      });
    });

    // Set timeout
    timeoutHandle = setTimeout(() => {
      killed = true;
      console.log(`[MonitoringAlertRunner] Timeout reached (${timeoutMs}ms), killing process`);
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
 * Store a completed monitoring alert workflow to Mandrel
 */
export async function storeAlertWorkflowCompletion(
  workflowId: string,
  alert: MonitoringAlert,
  analysis: AlertAnalysis,
  remediation?: { action: string; notes?: string; executedAt: Date }
): Promise<boolean> {
  console.log(`[MonitoringAlertRunner] Storing alert completion: ${workflowId}`);

  const completion: AlertCompletion = {
    type: 'monitoring',
    capability: 'OPERATE',
    workflowId,
    input: alert,
    output: analysis,
    remediation,
    completedAt: new Date(),
  };

  try {
    const stored = await storeAlertCompletion(completion);
    if (stored) {
      console.log(`[MonitoringAlertRunner] Alert completion stored to Mandrel`);
    }
    return stored;
  } catch (error) {
    console.warn('[MonitoringAlertRunner] Failed to store completion to Mandrel:', error);
    return false;
  }
}
