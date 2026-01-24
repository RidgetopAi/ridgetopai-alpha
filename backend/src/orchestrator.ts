/**
 * Orchestrator - The Bridge Between Intent and Execution
 * Instance 17 - The missing piece for solo builder scaling
 *
 * This module enables Brian to give high-level strategic direction
 * and have it translated into multiple parallel workflow executions.
 *
 * In a 200-person company:
 * - CEO gives strategic direction
 * - Managers break it into tasks
 * - Workers execute
 * - Results aggregate back up
 *
 * In our AI company:
 * - Brian gives intent (natural language)
 * - Orchestrator analyzes and generates tasks
 * - Workflows execute in parallel
 * - Results aggregate into Mandrel
 */

import { spawn } from 'child_process';
import { z } from 'zod';
import {
  saveSession,
  getSession as getSessionFromStore,
  getAllSessions as getAllSessionsFromStore,
} from './sessionStore.js';

// ==========================================
// Types for Orchestration
// ==========================================

/**
 * Task types that the orchestrator can generate and dispatch
 */
export type TaskType = 'bugfix' | 'content' | 'support' | 'monitoring' | 'analysis' | 'review';

/**
 * Priority levels for generated tasks
 */
export type Priority = 'high' | 'medium' | 'low';

/**
 * Status of an orchestrated task
 */
export type OrchTaskStatus = 'pending' | 'dispatched' | 'running' | 'completed' | 'failed';

/**
 * Schema for orchestration request
 */
export const OrchestrationRequestSchema = z.object({
  sessionId: z.string(),
  intent: z.string().min(10, 'Intent must be at least 10 characters'),
  context: z.object({
    focus: z.string().optional(),     // engineering, marketing, support, general
    urgency: z.enum(['high', 'normal', 'low']).optional(),
    constraints: z.string().optional(),
    projectPath: z.string().optional(),
  }).optional(),
});
export type OrchestrationRequest = z.infer<typeof OrchestrationRequestSchema>;

/**
 * A generated task from the orchestrator
 */
export interface GeneratedTask {
  id: string;
  type: TaskType;
  priority: Priority;
  title: string;
  description: string;
  parameters: Record<string, unknown>;  // Parameters to pass to the workflow
  status: OrchTaskStatus;
  workflowId?: string;  // Set when dispatched
  result?: unknown;     // Set when completed
  error?: string;       // Set if failed
  startedAt?: Date;
  completedAt?: Date;
}

/**
 * The orchestrator's interpretation of the intent
 */
export interface IntentInterpretation {
  understood: string;       // What the orchestrator understood
  reasoning: string;        // Why it generated these tasks
  tasks: GeneratedTask[];   // The generated tasks
  warnings?: string[];      // Any concerns or ambiguities
}

/**
 * Status of an orchestration session
 */
export interface OrchestrationSession {
  sessionId: string;
  intent: string;
  context?: OrchestrationRequest['context'];
  interpretation: IntentInterpretation;
  execution: {
    total: number;
    completed: number;
    failed: number;
    pending: number;
    running: number;
  };
  createdAt: Date;
  updatedAt: Date;
}

// ==========================================
// Session Storage (using sessionStore for persistence)
// ==========================================

/**
 * Get an orchestration session by ID
 */
export function getSession(sessionId: string): OrchestrationSession | undefined {
  return getSessionFromStore(sessionId);
}

/**
 * Get all active sessions
 */
export function getAllSessions(): OrchestrationSession[] {
  return getAllSessionsFromStore();
}

// ==========================================
// Intent Analysis using Claude
// ==========================================

/**
 * Analyze intent and generate tasks using Claude
 */
export async function analyzeIntent(
  intent: string,
  context?: OrchestrationRequest['context']
): Promise<IntentInterpretation> {
  const prompt = buildIntentAnalysisPrompt(intent, context);

  console.log(`[Orchestrator] Analyzing intent: "${intent.substring(0, 50)}..."`);

  try {
    const result = await runClaudeAnalysis(prompt);
    return parseIntentAnalysisResult(result);
  } catch (error) {
    console.error('[Orchestrator] Intent analysis failed:', error);
    throw error;
  }
}

/**
 * Build the prompt for intent analysis
 */
function buildIntentAnalysisPrompt(
  intent: string,
  context?: OrchestrationRequest['context']
): string {
  const focusInstruction = context?.focus
    ? `Focus area: ${context.focus}. Prioritize tasks related to this area.`
    : 'No specific focus area. Consider all relevant capabilities.';

  const urgencyInstruction = context?.urgency
    ? `Urgency: ${context.urgency}. ${context.urgency === 'high' ? 'Prioritize quick wins and critical tasks.' : 'Normal prioritization.'}`
    : 'Normal urgency.';

  const constraintInstruction = context?.constraints
    ? `Constraints: ${context.constraints}`
    : '';

  return `You are an AI orchestrator for a solo software builder. Your job is to analyze high-level directives and break them down into specific, actionable workflow tasks.

AVAILABLE WORKFLOW TYPES:
1. "bugfix" - Bug analysis and fixing (PRODUCE capability)
   - Parameters: title, description, severity (blocker|major|minor), stepsToReproduce

2. "content" - Content generation for marketing/docs (GROW capability)
   - Parameters: title, topic, format (blog_post|tweet_thread|documentation|email|announcement|case_study), audience (developers|business|general|internal), tone (professional|conversational|technical|educational), keyPoints, keywords

3. "support" - Support ticket handling (OPERATE capability)
   - Parameters: title, description, customerEmail, customerName, category (bug_report|feature_request|billing|account|how_to|integration|performance|other), severity (critical|high|medium|low), affectedFeature, errorMessage

4. "monitoring" - Monitoring alert handling (OPERATE capability)
   - Parameters: title, description, category (infrastructure|application|security|business|other), severity (critical|high|medium|low), source (prometheus|cloudwatch|datadog|sentry|custom|manual), affectedService, metricValue, threshold

5. "analysis" - General analysis tasks (internal)
   - Parameters: subject, question, depth (deep|surface)

6. "review" - Code or content review (internal)
   - Parameters: target, criteria

CONTEXT:
${focusInstruction}
${urgencyInstruction}
${constraintInstruction}

THE DIRECTIVE FROM THE BUILDER:
"${intent}"

YOUR TASK:
1. Understand what the builder wants to accomplish
2. Break this down into 1-5 specific workflow tasks
3. For each task, specify the appropriate workflow type and parameters
4. Explain your reasoning

RESPOND IN THIS EXACT JSON FORMAT:
{
  "understood": "A clear summary of what you understood the builder wants",
  "reasoning": "Why you chose these specific tasks and this breakdown",
  "tasks": [
    {
      "type": "bugfix|content|support|analysis|review",
      "priority": "high|medium|low",
      "title": "Short descriptive title",
      "description": "Detailed description of what this task should accomplish",
      "parameters": {
        // Task-specific parameters based on the type
      }
    }
  ],
  "warnings": ["Any concerns about ambiguity or missing information"]
}

Be strategic. A solo builder needs maximum impact from minimum tasks. Don't generate busywork.`;
}

/**
 * Run Claude CLI to analyze intent
 * Instance 18: Fixed CLI invocation - -p is --print, not prompt flag
 */
async function runClaudeAnalysis(prompt: string): Promise<string> {
  return new Promise((resolve, reject) => {
    // Instance 18 FIX: Correct invocation pattern
    // --print = output response and exit (non-interactive)
    // --dangerously-skip-permissions = automated execution
    // prompt is passed as a positional argument, NOT with -p flag
    // --output-format only works with --print
    const claude = spawn('claude', [
      '--print',
      '--dangerously-skip-permissions',
      '--output-format', 'text',
      prompt,
    ], {
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';
    let killed = false;

    // Instance 18: Implement proper timeout handling
    // Increased to 10 minutes for complex intents (image generation can take time)
    const timeoutMs = 600000; // 10 minutes
    const timeoutHandle = setTimeout(() => {
      if (!killed) {
        killed = true;
        claude.kill('SIGTERM');
        reject(new Error(`Claude analysis timed out after ${timeoutMs}ms`));
      }
    }, timeoutMs);

    claude.stdout?.on('data', (data) => {
      stdout += data.toString();
    });

    claude.stderr?.on('data', (data) => {
      stderr += data.toString();
    });

    claude.on('close', (code) => {
      clearTimeout(timeoutHandle);
      if (killed) {
        return; // Already rejected via timeout
      }
      if (code === 0) {
        resolve(stdout);
      } else {
        reject(new Error(`Claude exited with code ${code}: ${stderr}`));
      }
    });

    claude.on('error', (err) => {
      clearTimeout(timeoutHandle);
      reject(err);
    });
  });
}

/**
 * Parse the JSON response from Claude
 */
function parseIntentAnalysisResult(rawOutput: string): IntentInterpretation {
  // Extract JSON from Claude's response
  const jsonMatch = rawOutput.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('No JSON found in Claude response');
  }

  try {
    const parsed = JSON.parse(jsonMatch[0]);

    // Validate required fields
    if (!parsed.understood || !parsed.reasoning || !Array.isArray(parsed.tasks)) {
      throw new Error('Missing required fields in response');
    }

    // Generate IDs for tasks and set initial status
    const tasks: GeneratedTask[] = parsed.tasks.map((task: {
      type: TaskType;
      priority?: Priority;
      title: string;
      description: string;
      parameters?: Record<string, unknown>;
    }, index: number) => ({
      id: `task-${Date.now()}-${index}`,
      type: task.type || 'analysis',
      priority: task.priority || 'medium',
      title: task.title,
      description: task.description,
      parameters: task.parameters || {},
      status: 'pending' as OrchTaskStatus,
    }));

    return {
      understood: parsed.understood,
      reasoning: parsed.reasoning,
      tasks,
      warnings: parsed.warnings,
    };
  } catch (error) {
    console.error('[Orchestrator] Failed to parse response:', rawOutput);
    throw new Error(`Failed to parse intent analysis: ${error}`);
  }
}

// ==========================================
// Orchestration Session Management
// ==========================================

/**
 * Create a new orchestration session
 */
export async function createOrchestrationSession(
  request: OrchestrationRequest
): Promise<OrchestrationSession> {
  const { sessionId, intent, context } = request;

  console.log(`[Orchestrator] Creating session: ${sessionId}`);
  console.log(`[Orchestrator] Intent: "${intent}"`);

  // Analyze the intent
  const interpretation = await analyzeIntent(intent, context);

  // Create the session
  const session: OrchestrationSession = {
    sessionId,
    intent,
    context,
    interpretation,
    execution: {
      total: interpretation.tasks.length,
      completed: 0,
      failed: 0,
      pending: interpretation.tasks.length,
      running: 0,
    },
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  // Store the session (with persistence)
  await saveSession(session);

  console.log(`[Orchestrator] Session created with ${interpretation.tasks.length} tasks`);

  return session;
}

/**
 * Update task status within a session
 */
export function updateTaskStatus(
  sessionId: string,
  taskId: string,
  status: OrchTaskStatus,
  result?: unknown,
  error?: string
): OrchestrationSession | undefined {
  const session = getSessionFromStore(sessionId);
  if (!session) return undefined;

  const task = session.interpretation.tasks.find(t => t.id === taskId);
  if (!task) return undefined;

  const oldStatus = task.status;
  task.status = status;
  task.result = result;
  task.error = error;

  if (status === 'running' && !task.startedAt) {
    task.startedAt = new Date();
  }
  if (status === 'completed' || status === 'failed') {
    task.completedAt = new Date();
  }

  // Update execution counts
  if (oldStatus !== status) {
    if (oldStatus === 'pending') session.execution.pending--;
    if (oldStatus === 'running') session.execution.running--;

    if (status === 'running') session.execution.running++;
    if (status === 'completed') session.execution.completed++;
    if (status === 'failed') session.execution.failed++;
  }

  session.updatedAt = new Date();

  // Persist the updated session (async, fire-and-forget for performance)
  saveSession(session).catch(err => {
    console.error('[Orchestrator] Failed to persist session update:', err);
  });

  return session;
}

// ==========================================
// Task Dispatching
// ==========================================

/**
 * Result from a workflow dispatch
 */
interface DispatchResult {
  success: boolean;
  result?: unknown;
  error?: string;
}

/**
 * Dispatch a task to its appropriate workflow
 * Returns the workflow ID if successful
 *
 * Fixed: Now properly tracks task state through running → completed/failed
 */
export async function dispatchTask(
  session: OrchestrationSession,
  taskId: string,
  baseUrl: string
): Promise<string | null> {
  const task = session.interpretation.tasks.find(t => t.id === taskId);
  if (!task) {
    console.error(`[Orchestrator] Task not found: ${taskId}`);
    return null;
  }

  const workflowId = `orch-${session.sessionId}-${task.id}`;
  task.workflowId = workflowId;

  console.log(`[Orchestrator] Dispatching task: ${task.title} (${task.type})`);

  // Mark as running BEFORE calling the workflow
  updateTaskStatus(session.sessionId, taskId, 'running');

  try {
    let dispatchResult: DispatchResult;

    switch (task.type) {
      case 'bugfix':
        dispatchResult = await dispatchBugfix(workflowId, task, baseUrl);
        break;
      case 'content':
        dispatchResult = await dispatchContent(workflowId, task, baseUrl);
        break;
      case 'support':
        dispatchResult = await dispatchSupport(workflowId, task, baseUrl);
        break;
      case 'monitoring':
        dispatchResult = await dispatchMonitoring(workflowId, task, baseUrl);
        break;
      case 'analysis':
      case 'review':
        // These don't have dedicated workflows yet - mark as completed with note
        console.log(`[Orchestrator] Task type ${task.type} not yet implemented`);
        updateTaskStatus(session.sessionId, taskId, 'completed', {
          note: `Task type ${task.type} logged for future implementation`,
        });
        return workflowId;
      default:
        console.log(`[Orchestrator] Unknown task type: ${task.type}`);
        updateTaskStatus(session.sessionId, taskId, 'failed', undefined, `Unknown task type: ${task.type}`);
        return null;
    }

    // Update status based on workflow result
    if (dispatchResult.success) {
      console.log(`[Orchestrator] Task ${taskId} completed successfully`);
      updateTaskStatus(session.sessionId, taskId, 'completed', dispatchResult.result);
    } else {
      console.error(`[Orchestrator] Task ${taskId} failed: ${dispatchResult.error}`);
      updateTaskStatus(session.sessionId, taskId, 'failed', undefined, dispatchResult.error);
    }

    return workflowId;
  } catch (error) {
    console.error(`[Orchestrator] Failed to dispatch task ${taskId}:`, error);
    updateTaskStatus(session.sessionId, taskId, 'failed', undefined, String(error));
    return null;
  }
}

/**
 * Dispatch to bugfix workflow
 */
async function dispatchBugfix(
  workflowId: string,
  task: GeneratedTask,
  baseUrl: string
): Promise<DispatchResult> {
  const params = task.parameters as {
    title?: string;
    description?: string;
    severity?: string;
    stepsToReproduce?: string;
  };

  const body = {
    workflowId,
    bugReport: {
      title: params.title || task.title,
      description: params.description || task.description,
      severity: params.severity || 'minor',
      stepsToReproduce: params.stepsToReproduce,
    },
  };

  const response = await fetch(`${baseUrl}/api/workflow/bugfix`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  const data = await response.json() as { success?: boolean; error?: string; analysis?: unknown };

  if (!response.ok || !data.success) {
    return {
      success: false,
      error: data.error || `Bugfix dispatch failed: ${response.status}`,
    };
  }

  return {
    success: true,
    result: { analysis: data.analysis },
  };
}

/**
 * Dispatch to content workflow
 */
async function dispatchContent(
  workflowId: string,
  task: GeneratedTask,
  baseUrl: string
): Promise<DispatchResult> {
  const params = task.parameters as {
    title?: string;
    topic?: string;
    format?: string;
    audience?: string;
    tone?: string;
    keyPoints?: string[];
    keywords?: string[];
  };

  const body = {
    workflowId,
    brief: {
      title: params.title || task.title,
      topic: params.topic || task.description,
      format: params.format || 'blog_post',
      audience: params.audience || 'general',
      tone: params.tone || 'professional',
      keyPoints: params.keyPoints,
      keywords: params.keywords,
    },
  };

  const response = await fetch(`${baseUrl}/api/workflow/content`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  const data = await response.json() as { success?: boolean; error?: string; generation?: unknown };

  if (!response.ok || !data.success) {
    return {
      success: false,
      error: data.error || `Content dispatch failed: ${response.status}`,
    };
  }

  return {
    success: true,
    result: { generation: data.generation },
  };
}

/**
 * Dispatch to support ticket workflow
 */
async function dispatchSupport(
  workflowId: string,
  task: GeneratedTask,
  baseUrl: string
): Promise<DispatchResult> {
  const params = task.parameters as {
    title?: string;
    description?: string;
    customerEmail?: string;
    customerName?: string;
    category?: string;
    severity?: string;
    affectedFeature?: string;
    errorMessage?: string;
  };

  const body = {
    workflowId,
    ticket: {
      title: params.title || task.title,
      description: params.description || task.description,
      customerEmail: params.customerEmail || 'support@example.com',
      customerName: params.customerName,
      category: params.category || 'other',
      severity: params.severity || 'medium',
      affectedFeature: params.affectedFeature,
      errorMessage: params.errorMessage,
    },
  };

  const response = await fetch(`${baseUrl}/api/workflow/support`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  const data = await response.json() as { success?: boolean; error?: string; analysis?: unknown };

  if (!response.ok || !data.success) {
    return {
      success: false,
      error: data.error || `Support dispatch failed: ${response.status}`,
    };
  }

  return {
    success: true,
    result: data.analysis,
  };
}

/**
 * Dispatch to monitoring alert workflow
 */
async function dispatchMonitoring(
  workflowId: string,
  task: GeneratedTask,
  baseUrl: string
): Promise<DispatchResult> {
  const params = task.parameters as {
    title?: string;
    description?: string;
    category?: string;
    severity?: string;
    source?: string;
    affectedService?: string;
    metricValue?: string;
    threshold?: string;
  };

  const body = {
    workflowId,
    alert: {
      title: params.title || task.title,
      description: params.description || task.description,
      category: params.category || 'other',
      severity: params.severity || 'medium',
      source: params.source || 'manual',
      affectedService: params.affectedService,
      metricValue: params.metricValue,
      threshold: params.threshold,
    },
  };

  const response = await fetch(`${baseUrl}/api/workflow/alert`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  const data = await response.json() as { success?: boolean; error?: string; analysis?: unknown };

  if (!response.ok || !data.success) {
    return {
      success: false,
      error: data.error || `Monitoring dispatch failed: ${response.status}`,
    };
  }

  return {
    success: true,
    result: data.analysis,
  };
}

/**
 * Dispatch all pending tasks in a session
 */
export async function dispatchAllTasks(
  sessionId: string,
  baseUrl: string
): Promise<{ dispatched: number; failed: number }> {
  const session = getSessionFromStore(sessionId);
  if (!session) {
    throw new Error(`Session not found: ${sessionId}`);
  }

  let dispatched = 0;
  let failed = 0;

  // Dispatch tasks based on priority order
  const sortedTasks = [...session.interpretation.tasks]
    .filter(t => t.status === 'pending')
    .sort((a, b) => {
      const priorityOrder = { high: 0, medium: 1, low: 2 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });

  // Dispatch all tasks (they will run in parallel on the backend)
  const dispatchPromises = sortedTasks.map(async (task) => {
    const result = await dispatchTask(session, task.id, baseUrl);
    if (result) {
      dispatched++;
    } else {
      failed++;
    }
  });

  await Promise.all(dispatchPromises);

  console.log(`[Orchestrator] Dispatched ${dispatched} tasks, ${failed} failed`);

  return { dispatched, failed };
}
