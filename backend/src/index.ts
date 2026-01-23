/**
 * TaskRunner Backend Server
 * Instance 10 - HTTP API for business workflow execution
 *
 * This server provides HTTP endpoints for the Command Center UI
 * to trigger AI-powered workflow tasks.
 */

import express, { type Request, type Response, type NextFunction } from 'express';
import cors from 'cors';
import { initializeSessionStore, isDatabaseAvailable, loadWorkflowStatuses } from './sessionStore.js';
import {
  BugFixRequestSchema,
  ImplementRequestSchema,
  ContentGenerationRequestSchema,
  ContentRefineRequestSchema,
  SupportTicketRequestSchema,
  SupportTicketRespondSchema,
  MonitoringAlertRequestSchema,
  AlertRemediateSchema,
  type WorkflowUpdate,
  type ContentGenerationResult,
  type TicketAnalysis,
  type TicketWorkflowStatus,
  type AlertAnalysis,
  type AlertWorkflowStatus,
} from './types.js';
import { runBugAnalysis, runImplementation, checkClaudeAvailable, storeBugFixCompletion } from './taskRunner.js';
import { runContentGeneration, runContentRefinement, storeContentCompletion } from './contentRunner.js';
import { runTicketAnalysis, storeTicketWorkflowCompletion } from './supportTicketRunner.js';
import { runAlertAnalysis, storeAlertWorkflowCompletion } from './monitoringAlertRunner.js';
import { checkMandrelAvailable, searchRelevantContext, getRecentWorkflows } from './mandrelClient.js';
import {
  OrchestrationRequestSchema,
  createOrchestrationSession,
  getSession,
  getAllSessions,
  dispatchAllTasks,
  updateTaskStatus,
} from './orchestrator.js';
import {
  initializeScheduler,
  setServerBaseUrl,
  createScheduledTask,
  updateScheduledTask,
  deleteScheduledTask,
  getScheduledTask,
  getAllScheduledTasks,
  triggerScheduledTask,
  getSchedulerStats,
  stopAllJobs,
} from './scheduler.js';
import {
  initializeEventTriggers,
  setEventTriggerServerUrl,
  createEventTrigger,
  updateEventTrigger,
  deleteEventTrigger,
  getEventTrigger,
  getAllEventTriggers,
  processWebhookEvent,
  verifyWebhookSignature,
  getEventTriggerStats,
  getRecentExecutions,
} from './eventTrigger.js';
import {
  CreateScheduleRequestSchema,
  UpdateScheduleRequestSchema,
  CreateEventTriggerRequestSchema,
  UpdateEventTriggerRequestSchema,
  EventSourceSchema,
  type EventSource,
} from './types.js';
// Strategic Layer Phase 2 imports
import { analyzePatterns } from './strategic/patternAnalyzer.js';
import * as patternRepository from './strategic/db/patternRepository.js';
import { z } from 'zod';

// Zod schemas for pattern API endpoints
const PatternQuerySchema = z.object({
  type: z.enum(['recurring_success', 'recurring_failure', 'timing_pattern', 'correlation', 'trend']).optional(),
  status: z.enum(['active', 'superseded', 'dismissed']).optional().default('active'),
  minConfidence: z.coerce.number().min(0).max(1).optional(),
  limit: z.coerce.number().min(1).max(100).optional().default(50),
  offset: z.coerce.number().min(0).optional().default(0),
  orderBy: z.enum(['created_at', 'updated_at', 'confidence', 'observation_count']).optional().default('created_at'),
  orderDir: z.enum(['ASC', 'DESC']).optional().default('DESC'),
});

const PatternAnalyzeRequestSchema = z.object({
  minObservations: z.number().min(1).optional(),
  analysisWindowDays: z.number().min(1).max(365).optional(),
  minPatternConfidence: z.number().min(0).max(1).optional(),
});

const PatternUpdateSchema = z.object({
  name: z.string().max(200).optional(),
  description: z.string().optional(),
  status: z.enum(['active', 'dismissed']).optional(),
  dismissedReason: z.string().optional(),
}).refine(data => {
  if (data.status === 'dismissed' && !data.dismissedReason) {
    return false;
  }
  return true;
}, { message: 'dismissedReason required when status is dismissed' });

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Request logging
app.use((req: Request, _res: Response, next: NextFunction) => {
  console.log(`[API] ${req.method} ${req.path}`);
  next();
});

// In-memory workflow status (could be Redis/DB in production)
const workflowStatus = new Map<string, WorkflowUpdate>();

/**
 * Health check endpoint
 * Instance 13: Added Mandrel status check
 * Instance 22: Added database status check
 */
app.get('/health', async (_req: Request, res: Response) => {
  const [claudeAvailable, mandrelAvailable] = await Promise.all([
    checkClaudeAvailable(),
    checkMandrelAvailable(),
  ]);

  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    claudeAvailable,
    mandrelAvailable,
    databaseAvailable: isDatabaseAvailable(),
  });
});

/**
 * Get workflow status
 */
app.get('/api/workflow/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const status = workflowStatus.get(id);

  if (!status) {
    res.status(404).json({ error: 'Workflow not found' });
    return;
  }

  res.json(status);
});

/**
 * Execute bug fix analysis
 *
 * This endpoint triggers the full bug analysis workflow:
 * 1. Validates the request
 * 2. Spawns Claude CLI with the bug report
 * 3. Parses the analysis result
 * 4. Returns structured response for UI
 */
app.post('/api/workflow/bugfix', async (req: Request, res: Response) => {
  // Validate request body
  const parseResult = BugFixRequestSchema.safeParse(req.body);

  if (!parseResult.success) {
    res.status(400).json({
      error: 'Invalid request',
      details: parseResult.error.issues,
    });
    return;
  }

  const { workflowId, bugReport, projectPath } = parseResult.data;

  console.log(`[API] Starting bug fix workflow: ${workflowId}`);
  console.log(`[API] Bug: ${bugReport.title}`);

  // Update status: gathering context (simplified - we go straight to analysis)
  workflowStatus.set(workflowId, {
    workflowId,
    status: 'analyzing',
    message: 'AI is analyzing the bug...',
    progress: 25,
  });

  try {
    // Run the bug analysis
    const result = await runBugAnalysis(bugReport, {
      projectPath: projectPath || process.cwd(),
      timeoutMs: 300000, // 5 minutes
    });

    if (result.success && result.data) {
      // Update status: completed
      workflowStatus.set(workflowId, {
        workflowId,
        status: 'completed',
        message: 'Analysis complete',
        progress: 100,
        result: result.data,
      });

      console.log(`[API] Bug fix workflow completed: ${workflowId}`);
      console.log(`[API] Confidence: ${result.data.confidence}`);

      res.json({
        success: true,
        workflowId,
        analysis: result.data,
        durationMs: result.durationMs,
      });
    } else {
      // Update status: failed
      workflowStatus.set(workflowId, {
        workflowId,
        status: 'failed',
        message: result.error || 'Analysis failed',
      });

      console.error(`[API] Bug fix workflow failed: ${workflowId}`);
      console.error(`[API] Error: ${result.error}`);

      res.status(500).json({
        success: false,
        workflowId,
        error: result.error,
        durationMs: result.durationMs,
      });
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    workflowStatus.set(workflowId, {
      workflowId,
      status: 'failed',
      message: errorMessage,
    });

    console.error(`[API] Unexpected error in bug fix workflow: ${errorMessage}`);

    res.status(500).json({
      success: false,
      workflowId,
      error: errorMessage,
    });
  }
});

/**
 * Execute approved bug fix implementation
 *
 * This endpoint applies approved code changes:
 * 1. Validates the request
 * 2. Spawns Claude CLI with the approved changes
 * 3. Claude applies the changes and optionally runs tests
 * 4. Returns implementation result
 */
app.post('/api/workflow/bugfix/:id/implement', async (req: Request, res: Response) => {
  const { id: workflowId } = req.params;

  // Validate request body
  const parseResult = ImplementRequestSchema.safeParse({
    ...req.body,
    workflowId,
  });

  if (!parseResult.success) {
    res.status(400).json({
      error: 'Invalid request',
      details: parseResult.error.issues,
    });
    return;
  }

  const { approvedChanges, projectPath, runTests } = parseResult.data;

  console.log(`[API] Starting implementation for workflow: ${workflowId}`);
  console.log(`[API] Changes to apply: ${approvedChanges.length}`);
  console.log(`[API] Run tests: ${runTests}`);

  // Update status: implementing
  workflowStatus.set(workflowId, {
    workflowId,
    status: 'implementing',
    message: 'AI is applying approved changes...',
    progress: 60,
  });

  try {
    // Run the implementation
    const result = await runImplementation(
      approvedChanges,
      {
        projectPath: projectPath || process.cwd(),
        timeoutMs: 300000, // 5 minutes
      },
      runTests ?? true
    );

    if (result.success && result.data) {
      // Update status based on implementation result
      if (result.data.success) {
        workflowStatus.set(workflowId, {
          workflowId,
          status: 'completed',
          message: 'Implementation complete',
          progress: 100,
          implementationResult: result.data,
        });

        console.log(`[API] Implementation completed: ${workflowId}`);
        console.log(`[API] Files changed: ${result.data.changedFiles.join(', ')}`);

        res.json({
          success: true,
          workflowId,
          implementation: result.data,
          durationMs: result.durationMs,
        });
      } else {
        // Implementation ran but failed (e.g., tests failed)
        workflowStatus.set(workflowId, {
          workflowId,
          status: 'failed',
          message: result.data.errors.join(', ') || 'Implementation failed',
          implementationResult: result.data,
        });

        console.error(`[API] Implementation failed: ${workflowId}`);
        console.error(`[API] Errors: ${result.data.errors.join(', ')}`);

        res.status(500).json({
          success: false,
          workflowId,
          implementation: result.data,
          error: result.data.errors.join(', ') || 'Implementation failed',
          durationMs: result.durationMs,
        });
      }
    } else {
      // Failed to even run implementation
      workflowStatus.set(workflowId, {
        workflowId,
        status: 'failed',
        message: result.error || 'Implementation failed to execute',
      });

      console.error(`[API] Implementation execution failed: ${workflowId}`);
      console.error(`[API] Error: ${result.error}`);

      res.status(500).json({
        success: false,
        workflowId,
        error: result.error,
        durationMs: result.durationMs,
      });
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    workflowStatus.set(workflowId, {
      workflowId,
      status: 'failed',
      message: errorMessage,
    });

    console.error(`[API] Unexpected error in implementation: ${errorMessage}`);

    res.status(500).json({
      success: false,
      workflowId,
      error: errorMessage,
    });
  }
});

/**
 * List available workflow types
 */
app.get('/api/workflows', (_req: Request, res: Response) => {
  res.json({
    workflows: [
      {
        type: 'bugfix',
        name: 'Bug Fix Analysis',
        description: 'Analyze a bug report and propose a fix',
        endpoint: '/api/workflow/bugfix',
        implementEndpoint: '/api/workflow/bugfix/:id/implement',
        capability: 'PRODUCE',
      },
      {
        type: 'content',
        name: 'Content Generation',
        description: 'Generate marketing content, blog posts, and documentation',
        endpoint: '/api/workflow/content',
        refineEndpoint: '/api/workflow/content/:id/refine',
        capability: 'GROW',
      },
      {
        type: 'support',
        name: 'Support Ticket Handler',
        description: 'Analyze support tickets and generate customer responses',
        endpoint: '/api/workflow/support',
        respondEndpoint: '/api/workflow/support/:id/respond',
        capability: 'OPERATE',
      },
      {
        type: 'monitoring',
        name: 'Monitoring Alert Handler',
        description: 'Analyze monitoring alerts and generate remediation runbooks',
        endpoint: '/api/workflow/alert',
        remediateEndpoint: '/api/workflow/alert/:id/remediate',
        capability: 'OPERATE',
      },
    ],
  });
});

// ==========================================
// Content Generation Endpoints (Instance 12 - GROW)
// ==========================================

// In-memory content workflow status
const contentWorkflowStatus = new Map<string, {
  workflowId: string;
  status: 'generating' | 'refining' | 'completed' | 'failed';
  message?: string;
  progress?: number;
  result?: ContentGenerationResult;
}>();

/**
 * Get content workflow status
 */
app.get('/api/workflow/content/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const status = contentWorkflowStatus.get(id);

  if (!status) {
    res.status(404).json({ error: 'Content workflow not found' });
    return;
  }

  res.json(status);
});

/**
 * Execute content generation
 *
 * This endpoint triggers content generation:
 * 1. Validates the content brief
 * 2. Spawns Claude CLI with the brief
 * 3. Parses the generated content
 * 4. Returns structured content for UI
 */
app.post('/api/workflow/content', async (req: Request, res: Response) => {
  // Validate request body
  const parseResult = ContentGenerationRequestSchema.safeParse(req.body);

  if (!parseResult.success) {
    res.status(400).json({
      error: 'Invalid request',
      details: parseResult.error.issues,
    });
    return;
  }

  const { workflowId, brief, brandContext } = parseResult.data;

  console.log(`[API] Starting content generation workflow: ${workflowId}`);
  console.log(`[API] Content: ${brief.title} (${brief.format})`);

  // Update status: generating
  contentWorkflowStatus.set(workflowId, {
    workflowId,
    status: 'generating',
    message: 'AI is generating content...',
    progress: 25,
  });

  try {
    // Run the content generation
    const result = await runContentGeneration(brief, {
      timeoutMs: 300000,
      brandContext,
    });

    if (result.success && result.data) {
      // Update status: completed
      contentWorkflowStatus.set(workflowId, {
        workflowId,
        status: 'completed',
        message: 'Content generated',
        progress: 100,
        result: result.data,
      });

      console.log(`[API] Content generation completed: ${workflowId}`);
      console.log(`[API] Confidence: ${result.data.confidence}`);

      res.json({
        success: true,
        workflowId,
        generation: result.data,
        durationMs: result.durationMs,
      });
    } else {
      // Update status: failed
      contentWorkflowStatus.set(workflowId, {
        workflowId,
        status: 'failed',
        message: result.error || 'Generation failed',
      });

      console.error(`[API] Content generation failed: ${workflowId}`);
      console.error(`[API] Error: ${result.error}`);

      res.status(500).json({
        success: false,
        workflowId,
        error: result.error,
        durationMs: result.durationMs,
      });
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    contentWorkflowStatus.set(workflowId, {
      workflowId,
      status: 'failed',
      message: errorMessage,
    });

    console.error(`[API] Unexpected error in content generation: ${errorMessage}`);

    res.status(500).json({
      success: false,
      workflowId,
      error: errorMessage,
    });
  }
});

/**
 * Refine generated content based on feedback
 *
 * This endpoint refines existing content:
 * 1. Takes original content and feedback
 * 2. Spawns Claude CLI to apply revisions
 * 3. Returns refined content
 */
app.post('/api/workflow/content/:id/refine', async (req: Request, res: Response) => {
  const { id: workflowId } = req.params;

  // Validate request body
  const parseResult = ContentRefineRequestSchema.safeParse({
    ...req.body,
    workflowId,
  });

  if (!parseResult.success) {
    res.status(400).json({
      error: 'Invalid request',
      details: parseResult.error.issues,
    });
    return;
  }

  const { originalContent, feedback, specificEdits } = parseResult.data;

  console.log(`[API] Starting content refinement for workflow: ${workflowId}`);
  console.log(`[API] Feedback: ${feedback.substring(0, 50)}...`);

  // Update status: refining
  contentWorkflowStatus.set(workflowId, {
    workflowId,
    status: 'refining',
    message: 'AI is refining content...',
    progress: 50,
  });

  try {
    // Run the content refinement
    const result = await runContentRefinement(
      originalContent,
      feedback,
      specificEdits,
      { timeoutMs: 300000 }
    );

    if (result.success && result.data) {
      // Update status: completed
      contentWorkflowStatus.set(workflowId, {
        workflowId,
        status: 'completed',
        message: 'Content refined',
        progress: 100,
      });

      console.log(`[API] Content refinement completed: ${workflowId}`);
      console.log(`[API] Changes: ${result.data.changesApplied.length}`);

      res.json({
        success: true,
        workflowId,
        refinement: result.data,
        durationMs: result.durationMs,
      });
    } else {
      // Update status: failed
      contentWorkflowStatus.set(workflowId, {
        workflowId,
        status: 'failed',
        message: result.error || 'Refinement failed',
      });

      console.error(`[API] Content refinement failed: ${workflowId}`);
      console.error(`[API] Error: ${result.error}`);

      res.status(500).json({
        success: false,
        workflowId,
        error: result.error,
        durationMs: result.durationMs,
      });
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    contentWorkflowStatus.set(workflowId, {
      workflowId,
      status: 'failed',
      message: errorMessage,
    });

    console.error(`[API] Unexpected error in content refinement: ${errorMessage}`);

    res.status(500).json({
      success: false,
      workflowId,
      error: errorMessage,
    });
  }
});

// ==========================================
// Mandrel Integration Endpoints (Instance 13)
// ==========================================

/**
 * Store bug fix completion to Mandrel
 * @param stage - 'proposed' for initial analysis, 'confirmed' for user verification
 */
app.post('/api/mandrel/bugfix/:id/complete', async (req: Request, res: Response) => {
  const { id: workflowId } = req.params;
  const { bugReport, analysis, review, projectName, stage } = req.body;

  if (!bugReport || !analysis) {
    res.status(400).json({ error: 'bugReport and analysis are required' });
    return;
  }

  const stageLabel = stage || 'completion';
  console.log(`[API] Storing bug fix ${stageLabel} to Mandrel: ${workflowId}${projectName ? ` (project: ${projectName})` : ''}`);

  try {
    const stored = await storeBugFixCompletion(workflowId, bugReport, analysis, review, projectName, stage);
    res.json({
      success: stored,
      workflowId,
      message: stored ? 'Stored to Mandrel' : 'Failed to store',
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({
      success: false,
      workflowId,
      error: errorMessage,
    });
  }
});

/**
 * Store content completion to Mandrel
 */
app.post('/api/mandrel/content/:id/complete', async (req: Request, res: Response) => {
  const { id: workflowId } = req.params;
  const { brief, generation, review } = req.body;

  if (!brief || !generation) {
    res.status(400).json({ error: 'brief and generation are required' });
    return;
  }

  console.log(`[API] Storing content completion to Mandrel: ${workflowId}`);

  try {
    const stored = await storeContentCompletion(workflowId, brief, generation, review);
    res.json({
      success: stored,
      workflowId,
      message: stored ? 'Stored to Mandrel' : 'Failed to store',
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({
      success: false,
      workflowId,
      error: errorMessage,
    });
  }
});

/**
 * Search Mandrel for relevant context
 */
app.post('/api/mandrel/search', async (req: Request, res: Response) => {
  const { query, type, limit } = req.body;

  if (!query) {
    res.status(400).json({ error: 'query is required' });
    return;
  }

  console.log(`[API] Searching Mandrel: ${query.substring(0, 50)}...`);

  try {
    const contexts = await searchRelevantContext(query, { type, limit });
    res.json({
      success: true,
      query,
      count: contexts.length,
      contexts,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({
      success: false,
      error: errorMessage,
    });
  }
});

/**
 * Get recent workflow completions from Mandrel
 */
app.get('/api/mandrel/recent', async (req: Request, res: Response) => {
  const limit = parseInt(req.query.limit as string) || 10;

  console.log(`[API] Getting ${limit} recent workflows from Mandrel`);

  try {
    const workflows = await getRecentWorkflows(limit);
    res.json({
      success: true,
      count: workflows.length,
      workflows,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({
      success: false,
      error: errorMessage,
    });
  }
});

// ==========================================
// Mandrel Context Proxy Endpoints (for UI)
// ==========================================

/**
 * Get recent contexts from Mandrel (proxy for UI)
 */
app.get('/api/mandrel/contexts/recent', async (req: Request, res: Response) => {
  const limit = parseInt(req.query.limit as string) || 20;

  console.log(`[API] Getting ${limit} recent contexts from Mandrel`);

  try {
    // Use raw Mandrel tool call to get all context types
    const MANDREL_URL = process.env.MANDREL_URL || 'https://mandrel.ridgetopai.net/mcp/tools';
    const response = await fetch(`${MANDREL_URL}/context_get_recent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ arguments: { limit } }),
    });

    if (!response.ok) {
      res.status(response.status).json({
        success: false,
        error: `Mandrel returned HTTP ${response.status}`,
      });
      return;
    }

    const data = await response.json();
    res.json(data);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[API] Failed to get recent contexts: ${errorMessage}`);
    res.status(500).json({
      success: false,
      error: errorMessage,
    });
  }
});

/**
 * Search contexts from Mandrel (proxy for UI)
 */
app.post('/api/mandrel/contexts/search', async (req: Request, res: Response) => {
  const { query, type, limit = 20, id } = req.body;

  console.log(`[API] Searching contexts: query="${query?.substring(0, 50)}...", type=${type}, id=${id}`);

  try {
    const MANDREL_URL = process.env.MANDREL_URL || 'https://mandrel.ridgetopai.net/mcp/tools';
    const args: Record<string, unknown> = {};

    if (id) {
      args.id = id;
    } else if (query) {
      args.query = query;
      if (type) args.type = type;
      if (limit) args.limit = limit;
    }

    const response = await fetch(`${MANDREL_URL}/context_search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ arguments: args }),
    });

    if (!response.ok) {
      res.status(response.status).json({
        success: false,
        error: `Mandrel returned HTTP ${response.status}`,
      });
      return;
    }

    const data = await response.json();
    res.json(data);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[API] Failed to search contexts: ${errorMessage}`);
    res.status(500).json({
      success: false,
      error: errorMessage,
    });
  }
});

/**
 * Get context statistics from Mandrel (proxy for UI)
 */
app.get('/api/mandrel/contexts/stats', async (_req: Request, res: Response) => {
  console.log(`[API] Getting context stats from Mandrel`);

  try {
    const MANDREL_URL = process.env.MANDREL_URL || 'https://mandrel.ridgetopai.net/mcp/tools';
    const response = await fetch(`${MANDREL_URL}/context_stats`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ arguments: {} }),
    });

    if (!response.ok) {
      res.status(response.status).json({
        success: false,
        error: `Mandrel returned HTTP ${response.status}`,
      });
      return;
    }

    const data = await response.json();
    res.json(data);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[API] Failed to get context stats: ${errorMessage}`);
    res.status(500).json({
      success: false,
      error: errorMessage,
    });
  }
});

/**
 * Ping Mandrel (proxy for UI connection check)
 */
app.get('/api/mandrel/ping', async (_req: Request, res: Response) => {
  try {
    const available = await checkMandrelAvailable();
    res.json({
      success: available,
      message: available ? 'Mandrel is available' : 'Mandrel is not responding',
    });
  } catch (error) {
    res.json({
      success: false,
      message: 'Failed to connect to Mandrel',
    });
  }
});


/**
 * Project Management Endpoints (Mandrel Integration)
 */

/**
 * Get list of all Mandrel projects
 */
app.get("/api/mandrel/projects/list", async (_req: Request, res: Response) => {
  try {
    const MANDREL_URL = process.env.MANDREL_URL || "https://mandrel.ridgetopai.net/mcp/tools";
    const response = await fetch(`${MANDREL_URL}/project_list`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ arguments: { includeStats: true } }),
    });

    if (!response.ok) {
      res.json({ success: false, error: `Mandrel HTTP ${response.status}` });
      return;
    }

    const data = await response.json();
    res.json({ success: true, result: data });
  } catch (error) {
    console.error("[ProjectAPI] Failed to get project list:", error);
    res.json({ success: false, error: "Failed to fetch project list" });
  }
});

/**
 * Get current active Mandrel project
 */
app.get("/api/mandrel/projects/current", async (_req: Request, res: Response) => {
  try {
    const MANDREL_URL = process.env.MANDREL_URL || "https://mandrel.ridgetopai.net/mcp/tools";
    const response = await fetch(`${MANDREL_URL}/project_current`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ arguments: {} }),
    });

    if (!response.ok) {
      res.json({ success: false, error: `Mandrel HTTP ${response.status}` });
      return;
    }

    const data = await response.json();
    res.json({ success: true, result: data });
  } catch (error) {
    console.error("[ProjectAPI] Failed to get current project:", error);
    res.json({ success: false, error: "Failed to fetch current project" });
  }
});

/**
 * Switch to a different Mandrel project
 */
app.post("/api/mandrel/projects/switch", async (req: Request, res: Response) => {
  try {
    const { project } = req.body;
    
    if (!project) {
      res.status(400).json({ success: false, error: "Project name or ID required" });
      return;
    }

    const MANDREL_URL = process.env.MANDREL_URL || "https://mandrel.ridgetopai.net/mcp/tools";
    const response = await fetch(`${MANDREL_URL}/project_switch`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ arguments: { project } }),
    });

    if (!response.ok) {
      res.json({ success: false, error: `Mandrel HTTP ${response.status}` });
      return;
    }

    const data = await response.json();
    res.json({ success: true, result: data });
  } catch (error) {
    console.error("[ProjectAPI] Failed to switch project:", error);
    res.json({ success: false, error: "Failed to switch project" });
  }
});

// ==========================================
// Support Ticket Endpoints (Instance 20 - OPERATE)
// ==========================================

// In-memory support ticket workflow status
const ticketWorkflowStatus = new Map<string, {
  workflowId: string;
  status: TicketWorkflowStatus;
  message?: string;
  progress?: number;
  result?: TicketAnalysis;
}>();

/**
 * Get support ticket workflow status
 */
app.get('/api/workflow/support/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const status = ticketWorkflowStatus.get(id);

  if (!status) {
    res.status(404).json({ error: 'Support ticket workflow not found' });
    return;
  }

  res.json(status);
});

/**
 * Execute support ticket analysis
 *
 * This endpoint triggers support ticket analysis:
 * 1. Validates the support ticket
 * 2. Spawns Claude CLI with the ticket details
 * 3. Parses the analysis and suggested response
 * 4. Returns structured response for UI
 */
app.post('/api/workflow/support', async (req: Request, res: Response) => {
  // Validate request body
  const parseResult = SupportTicketRequestSchema.safeParse(req.body);

  if (!parseResult.success) {
    res.status(400).json({
      error: 'Invalid request',
      details: parseResult.error.issues,
    });
    return;
  }

  const { workflowId, ticket, projectPath } = parseResult.data;

  console.log(`[API] Starting support ticket workflow: ${workflowId}`);
  console.log(`[API] Ticket: ${ticket.title} (${ticket.category})`);
  console.log(`[API] Customer: ${ticket.customerEmail}`);

  // Update status: analyzing
  ticketWorkflowStatus.set(workflowId, {
    workflowId,
    status: 'analyzing',
    message: 'AI is analyzing the support ticket...',
    progress: 25,
  });

  try {
    // Run the ticket analysis
    const result = await runTicketAnalysis(ticket, {
      projectPath: projectPath || process.cwd(),
      timeoutMs: 300000, // 5 minutes
    });

    if (result.success && result.data) {
      // Update status: completed
      ticketWorkflowStatus.set(workflowId, {
        workflowId,
        status: 'completed',
        message: 'Analysis complete',
        progress: 100,
        result: result.data,
      });

      console.log(`[API] Support ticket workflow completed: ${workflowId}`);
      console.log(`[API] Confidence: ${result.data.confidence}`);
      console.log(`[API] Action: ${result.data.actionRequired.type}`);

      res.json({
        success: true,
        workflowId,
        analysis: result.data,
        durationMs: result.durationMs,
      });
    } else {
      // Update status: failed
      ticketWorkflowStatus.set(workflowId, {
        workflowId,
        status: 'failed',
        message: result.error || 'Analysis failed',
      });

      console.error(`[API] Support ticket workflow failed: ${workflowId}`);
      console.error(`[API] Error: ${result.error}`);

      res.status(500).json({
        success: false,
        workflowId,
        error: result.error,
        durationMs: result.durationMs,
      });
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    ticketWorkflowStatus.set(workflowId, {
      workflowId,
      status: 'failed',
      message: errorMessage,
    });

    console.error(`[API] Unexpected error in support ticket workflow: ${errorMessage}`);

    res.status(500).json({
      success: false,
      workflowId,
      error: errorMessage,
    });
  }
});

/**
 * Respond to a support ticket
 *
 * This endpoint records/sends the response:
 * 1. Validates the response
 * 2. Optionally sends email to customer
 * 3. Stores completion to Mandrel
 */
app.post('/api/workflow/support/:id/respond', async (req: Request, res: Response) => {
  const { id: workflowId } = req.params;

  // Validate request body
  const parseResult = SupportTicketRespondSchema.safeParse(req.body);

  if (!parseResult.success) {
    res.status(400).json({
      error: 'Invalid request',
      details: parseResult.error.issues,
    });
    return;
  }

  const { response, sendEmail } = parseResult.data;

  // Get the workflow status to retrieve the ticket and analysis
  const status = ticketWorkflowStatus.get(workflowId);
  if (!status) {
    res.status(404).json({ error: 'Workflow not found' });
    return;
  }

  console.log(`[API] Recording response for support ticket: ${workflowId}`);
  console.log(`[API] Send email: ${sendEmail}`);

  // Update status: responding
  ticketWorkflowStatus.set(workflowId, {
    ...status,
    status: 'responding',
    message: 'Recording response...',
    progress: 80,
  });

  try {
    // Note: Email sending would be implemented here in production
    // For now, we just record the response
    if (sendEmail) {
      console.log(`[API] Would send email to customer (not implemented)`);
    }

    // Update status: completed
    ticketWorkflowStatus.set(workflowId, {
      ...status,
      status: 'completed',
      message: 'Response recorded',
      progress: 100,
    });

    console.log(`[API] Support ticket response recorded: ${workflowId}`);

    res.json({
      success: true,
      workflowId,
      message: sendEmail ? 'Response sent to customer' : 'Response recorded',
      respondedAt: new Date().toISOString(),
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    ticketWorkflowStatus.set(workflowId, {
      ...status,
      status: 'failed',
      message: errorMessage,
    });

    console.error(`[API] Unexpected error responding to ticket: ${errorMessage}`);

    res.status(500).json({
      success: false,
      workflowId,
      error: errorMessage,
    });
  }
});

/**
 * Store support ticket completion to Mandrel
 */
app.post('/api/mandrel/support/:id/complete', async (req: Request, res: Response) => {
  const { id: workflowId } = req.params;
  const { ticket, analysis, response: ticketResponse } = req.body;

  if (!ticket || !analysis) {
    res.status(400).json({ error: 'ticket and analysis are required' });
    return;
  }

  console.log(`[API] Storing support ticket completion to Mandrel: ${workflowId}`);

  try {
    const stored = await storeTicketWorkflowCompletion(workflowId, ticket, analysis, ticketResponse);
    res.json({
      success: stored,
      workflowId,
      message: stored ? 'Stored to Mandrel' : 'Failed to store',
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({
      success: false,
      workflowId,
      error: errorMessage,
    });
  }
});

// ==========================================
// Monitoring Alert Endpoints (Instance 21 - OPERATE)
// ==========================================

// In-memory monitoring alert workflow status
const alertWorkflowStatus = new Map<string, {
  workflowId: string;
  status: AlertWorkflowStatus;
  message?: string;
  progress?: number;
  result?: AlertAnalysis;
}>();

/**
 * Get monitoring alert workflow status
 */
app.get('/api/workflow/alert/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const status = alertWorkflowStatus.get(id);

  if (!status) {
    res.status(404).json({ error: 'Alert workflow not found' });
    return;
  }

  res.json(status);
});

/**
 * Execute monitoring alert analysis
 *
 * This endpoint triggers alert analysis:
 * 1. Validates the monitoring alert
 * 2. Spawns Claude CLI with the alert details
 * 3. Parses the analysis and suggested remediation
 * 4. Returns structured response for UI
 */
app.post('/api/workflow/alert', async (req: Request, res: Response) => {
  // Validate request body
  const parseResult = MonitoringAlertRequestSchema.safeParse(req.body);

  if (!parseResult.success) {
    res.status(400).json({
      error: 'Invalid request',
      details: parseResult.error.issues,
    });
    return;
  }

  const { workflowId, alert, projectPath } = parseResult.data;

  console.log(`[API] Starting monitoring alert workflow: ${workflowId}`);
  console.log(`[API] Alert: ${alert.title} (${alert.category})`);
  console.log(`[API] Source: ${alert.source}, Severity: ${alert.severity}`);

  // Update status: analyzing
  alertWorkflowStatus.set(workflowId, {
    workflowId,
    status: 'analyzing',
    message: 'AI is analyzing the alert...',
    progress: 25,
  });

  try {
    // Run the alert analysis
    const result = await runAlertAnalysis(alert, {
      projectPath: projectPath || process.cwd(),
      timeoutMs: 300000, // 5 minutes
    });

    if (result.success && result.data) {
      // Update status: completed
      alertWorkflowStatus.set(workflowId, {
        workflowId,
        status: 'completed',
        message: 'Analysis complete',
        progress: 100,
        result: result.data,
      });

      console.log(`[API] Monitoring alert workflow completed: ${workflowId}`);
      console.log(`[API] Confidence: ${result.data.confidence}`);
      console.log(`[API] Remediation: ${result.data.suggestedRemediation.type}`);

      res.json({
        success: true,
        workflowId,
        analysis: result.data,
        durationMs: result.durationMs,
      });
    } else {
      // Update status: failed
      alertWorkflowStatus.set(workflowId, {
        workflowId,
        status: 'failed',
        message: result.error || 'Analysis failed',
      });

      console.error(`[API] Monitoring alert workflow failed: ${workflowId}`);
      console.error(`[API] Error: ${result.error}`);

      res.status(500).json({
        success: false,
        workflowId,
        error: result.error,
        durationMs: result.durationMs,
      });
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    alertWorkflowStatus.set(workflowId, {
      workflowId,
      status: 'failed',
      message: errorMessage,
    });

    console.error(`[API] Unexpected error in monitoring alert workflow: ${errorMessage}`);

    res.status(500).json({
      success: false,
      workflowId,
      error: errorMessage,
    });
  }
});

/**
 * Execute or record remediation for an alert
 *
 * This endpoint records/executes the remediation action:
 * 1. Validates the remediation request
 * 2. Records the action taken
 * 3. Stores completion to Mandrel
 */
app.post('/api/workflow/alert/:id/remediate', async (req: Request, res: Response) => {
  const { id: workflowId } = req.params;

  // Validate request body
  const parseResult = AlertRemediateSchema.safeParse(req.body);

  if (!parseResult.success) {
    res.status(400).json({
      error: 'Invalid request',
      details: parseResult.error.issues,
    });
    return;
  }

  const { action, notes } = parseResult.data;

  // Get the workflow status to retrieve the alert and analysis
  const status = alertWorkflowStatus.get(workflowId);
  if (!status) {
    res.status(404).json({ error: 'Workflow not found' });
    return;
  }

  console.log(`[API] Recording remediation for alert: ${workflowId}`);
  console.log(`[API] Action: ${action}`);

  // Update status: remediating
  alertWorkflowStatus.set(workflowId, {
    ...status,
    status: 'remediating',
    message: 'Recording remediation...',
    progress: 80,
  });

  try {
    // Note: Actual remediation execution would be implemented here in production
    // For now, we just record the action
    if (action === 'execute') {
      console.log(`[API] Remediation executed (would run actual commands in production)`);
    } else if (action === 'escalate') {
      console.log(`[API] Alert escalated for manual review`);
    } else {
      console.log(`[API] Alert dismissed`);
    }

    // Update status: completed
    alertWorkflowStatus.set(workflowId, {
      ...status,
      status: 'completed',
      message: 'Remediation recorded',
      progress: 100,
    });

    console.log(`[API] Alert remediation recorded: ${workflowId}`);

    res.json({
      success: true,
      workflowId,
      action,
      message: action === 'execute' ? 'Remediation executed' : action === 'escalate' ? 'Alert escalated' : 'Alert dismissed',
      remediatedAt: new Date().toISOString(),
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    alertWorkflowStatus.set(workflowId, {
      ...status,
      status: 'failed',
      message: errorMessage,
    });

    console.error(`[API] Unexpected error in remediation: ${errorMessage}`);

    res.status(500).json({
      success: false,
      workflowId,
      error: errorMessage,
    });
  }
});

/**
 * Store monitoring alert completion to Mandrel
 */
app.post('/api/mandrel/alert/:id/complete', async (req: Request, res: Response) => {
  const { id: workflowId } = req.params;
  const { alert, analysis, remediation } = req.body;

  if (!alert || !analysis) {
    res.status(400).json({ error: 'alert and analysis are required' });
    return;
  }

  console.log(`[API] Storing monitoring alert completion to Mandrel: ${workflowId}`);

  try {
    const stored = await storeAlertWorkflowCompletion(workflowId, alert, analysis, remediation);
    res.json({
      success: stored,
      workflowId,
      message: stored ? 'Stored to Mandrel' : 'Failed to store',
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({
      success: false,
      workflowId,
      error: errorMessage,
    });
  }
});

// ==========================================
// Orchestration Endpoints (Instance 17)
// The bridge between intent and parallel execution
// ==========================================

/**
 * Create a new orchestration session
 *
 * This endpoint:
 * 1. Takes natural language intent from Brian
 * 2. Uses Claude to analyze and break into tasks
 * 3. Returns the task breakdown for review
 */
app.post('/api/orchestrate', async (req: Request, res: Response) => {
  // Validate request
  const parseResult = OrchestrationRequestSchema.safeParse(req.body);

  if (!parseResult.success) {
    res.status(400).json({
      error: 'Invalid request',
      details: parseResult.error.issues,
    });
    return;
  }

  console.log(`[API] Starting orchestration session: ${parseResult.data.sessionId}`);
  console.log(`[API] Intent: "${parseResult.data.intent.substring(0, 100)}..."`);

  try {
    const session = await createOrchestrationSession(parseResult.data);

    res.json({
      success: true,
      session: {
        sessionId: session.sessionId,
        interpretation: session.interpretation,
        execution: session.execution,
        createdAt: session.createdAt,
      },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[API] Orchestration failed: ${errorMessage}`);

    res.status(500).json({
      success: false,
      error: errorMessage,
    });
  }
});

/**
 * Get orchestration session status
 */
app.get('/api/orchestrate/:sessionId', (req: Request, res: Response) => {
  const { sessionId } = req.params;
  const session = getSession(sessionId);

  if (!session) {
    res.status(404).json({ error: 'Session not found' });
    return;
  }

  res.json({
    success: true,
    session,
  });
});

/**
 * List all orchestration sessions
 * Returns full sessions for History page display
 */
app.get('/api/orchestrate', (_req: Request, res: Response) => {
  const sessions = getAllSessions();

  res.json({
    success: true,
    count: sessions.length,
    sessions: sessions.map(s => ({
      sessionId: s.sessionId,
      intent: s.intent,
      context: s.context,
      interpretation: s.interpretation,
      execution: s.execution,
      createdAt: s.createdAt,
      updatedAt: s.updatedAt,
    })),
  });
});

/**
 * Execute all tasks in an orchestration session
 *
 * This triggers parallel dispatch of all pending tasks
 */
app.post('/api/orchestrate/:sessionId/execute', async (req: Request, res: Response) => {
  const { sessionId } = req.params;

  const session = getSession(sessionId);
  if (!session) {
    res.status(404).json({ error: 'Session not found' });
    return;
  }

  console.log(`[API] Executing orchestration session: ${sessionId}`);

  try {
    // Determine the base URL for dispatching tasks
    const baseUrl = `http://localhost:${PORT}`;
    const result = await dispatchAllTasks(sessionId, baseUrl);

    // Get updated session
    const updatedSession = getSession(sessionId);

    res.json({
      success: true,
      dispatched: result.dispatched,
      failed: result.failed,
      execution: updatedSession?.execution,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[API] Execution failed: ${errorMessage}`);

    res.status(500).json({
      success: false,
      error: errorMessage,
    });
  }
});

/**
 * Update a specific task in an orchestration session
 * (Used by webhook callbacks from workflows)
 */
app.patch('/api/orchestrate/:sessionId/tasks/:taskId', (req: Request, res: Response) => {
  const { sessionId, taskId } = req.params;
  const { status, result, error } = req.body;

  const session = updateTaskStatus(sessionId, taskId, status, result, error);

  if (!session) {
    res.status(404).json({ error: 'Session or task not found' });
    return;
  }

  console.log(`[API] Updated task ${taskId} in session ${sessionId}: ${status}`);

  res.json({
    success: true,
    execution: session.execution,
  });
});

// ==========================================
// Scheduled Tasks API
// ==========================================

/**
 * List all scheduled tasks
 */
app.get('/api/schedules', (_req: Request, res: Response) => {
  const schedules = getAllScheduledTasks();
  const stats = getSchedulerStats();

  res.json({
    schedules,
    stats,
  });
});

/**
 * Get scheduler statistics
 */
app.get('/api/schedules/stats', (_req: Request, res: Response) => {
  const stats = getSchedulerStats();
  res.json(stats);
});

/**
 * Create a new scheduled task
 */
app.post('/api/schedules', async (req: Request, res: Response) => {
  try {
    const parsed = CreateScheduleRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: 'Invalid request',
        details: parsed.error.format(),
      });
      return;
    }

    const schedule = await createScheduledTask(parsed.data);
    res.status(201).json(schedule);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[API] Create schedule failed:', errorMessage);
    res.status(500).json({ error: errorMessage });
  }
});

/**
 * Get a specific scheduled task
 */
app.get('/api/schedules/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const schedule = getScheduledTask(id);

  if (!schedule) {
    res.status(404).json({ error: 'Schedule not found' });
    return;
  }

  res.json(schedule);
});

/**
 * Update a scheduled task
 */
app.patch('/api/schedules/:id', async (req: Request, res: Response) => {
  const { id } = req.params;

  try {
    const parsed = UpdateScheduleRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: 'Invalid request',
        details: parsed.error.format(),
      });
      return;
    }

    const schedule = await updateScheduledTask(id, parsed.data);
    if (!schedule) {
      res.status(404).json({ error: 'Schedule not found' });
      return;
    }

    res.json(schedule);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[API] Update schedule failed:', errorMessage);
    res.status(500).json({ error: errorMessage });
  }
});

/**
 * Delete a scheduled task
 */
app.delete('/api/schedules/:id', async (req: Request, res: Response) => {
  const { id } = req.params;

  try {
    const deleted = await deleteScheduledTask(id);
    if (!deleted) {
      res.status(404).json({ error: 'Schedule not found' });
      return;
    }

    res.json({ success: true });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[API] Delete schedule failed:', errorMessage);
    res.status(500).json({ error: errorMessage });
  }
});

/**
 * Manually trigger a scheduled task
 */
app.post('/api/schedules/:id/trigger', async (req: Request, res: Response) => {
  const { id } = req.params;

  try {
    const result = await triggerScheduledTask(id);
    res.json(result);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[API] Trigger schedule failed:', errorMessage);
    res.status(500).json({ error: errorMessage });
  }
});

// ==========================================
// Event Triggers API
// ==========================================

/**
 * List all event triggers
 */
app.get('/api/triggers', (_req: Request, res: Response) => {
  const triggers = getAllEventTriggers();
  const stats = getEventTriggerStats();

  res.json({
    triggers,
    stats,
  });
});

/**
 * Get event trigger statistics
 */
app.get('/api/triggers/stats', (_req: Request, res: Response) => {
  const stats = getEventTriggerStats();
  res.json(stats);
});

/**
 * Get recent trigger executions
 */
app.get('/api/triggers/executions', async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const executions = await getRecentExecutions(limit);
    res.json(executions);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[API] Get executions failed:', errorMessage);
    res.status(500).json({ error: errorMessage });
  }
});

/**
 * Create a new event trigger
 */
app.post('/api/triggers', async (req: Request, res: Response) => {
  try {
    const parsed = CreateEventTriggerRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: 'Invalid request',
        details: parsed.error.format(),
      });
      return;
    }

    const trigger = await createEventTrigger(parsed.data);
    res.status(201).json(trigger);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[API] Create trigger failed:', errorMessage);
    res.status(500).json({ error: errorMessage });
  }
});

/**
 * Get a specific event trigger
 */
app.get('/api/triggers/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const trigger = getEventTrigger(id);

  if (!trigger) {
    res.status(404).json({ error: 'Trigger not found' });
    return;
  }

  res.json(trigger);
});

/**
 * Update an event trigger
 */
app.patch('/api/triggers/:id', async (req: Request, res: Response) => {
  const { id } = req.params;

  try {
    const parsed = UpdateEventTriggerRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: 'Invalid request',
        details: parsed.error.format(),
      });
      return;
    }

    const trigger = await updateEventTrigger(id, parsed.data);
    if (!trigger) {
      res.status(404).json({ error: 'Trigger not found' });
      return;
    }

    res.json(trigger);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[API] Update trigger failed:', errorMessage);
    res.status(500).json({ error: errorMessage });
  }
});

/**
 * Delete an event trigger
 */
app.delete('/api/triggers/:id', async (req: Request, res: Response) => {
  const { id } = req.params;

  try {
    const deleted = await deleteEventTrigger(id);
    if (!deleted) {
      res.status(404).json({ error: 'Trigger not found' });
      return;
    }

    res.json({ success: true });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[API] Delete trigger failed:', errorMessage);
    res.status(500).json({ error: errorMessage });
  }
});

// ==========================================
// Strategic Layer - Pattern Detection (Phase 2)
// ==========================================

/**
 * List detected patterns with optional filters
 */
app.get('/api/strategic/patterns', async (req: Request, res: Response) => {
  try {
    const parseResult = PatternQuerySchema.safeParse(req.query);
    if (!parseResult.success) {
      res.status(400).json({
        success: false,
        error: 'Invalid query parameters',
        details: parseResult.error.issues,
      });
      return;
    }

    const { type, status, minConfidence, limit, offset, orderBy, orderDir } = parseResult.data;

    const patterns = await patternRepository.queryPatterns({
      patternType: type as patternRepository.PatternType | undefined,
      status: status as 'active' | 'superseded' | 'dismissed' | undefined,
      minConfidence,
      limit,
      offset,
      orderBy: orderBy as 'created_at' | 'updated_at' | 'confidence' | 'observation_count',
      orderDir: orderDir as 'ASC' | 'DESC',
    });

    res.json({
      success: true,
      patterns,
      total: patterns.length,
      limit,
      offset,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[API] List patterns failed:', errorMessage);
    res.status(500).json({ success: false, error: errorMessage });
  }
});

/**
 * Get pattern statistics for dashboard
 */
app.get('/api/strategic/patterns/stats', async (_req: Request, res: Response) => {
  try {
    const stats = await patternRepository.getPatternStats();
    res.json({ success: true, stats });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[API] Get pattern stats failed:', errorMessage);
    res.status(500).json({ success: false, error: errorMessage });
  }
});

/**
 * Get recent pattern analysis runs
 * NOTE: This route MUST be defined before /patterns/:id to avoid route conflict
 */
app.get('/api/strategic/patterns/runs', async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 10;
    const runs = await patternRepository.getRecentAnalysisRuns(Math.min(limit, 50));
    res.json({ success: true, runs });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[API] Get pattern runs failed:', errorMessage);
    res.status(500).json({ success: false, error: errorMessage });
  }
});

/**
 * Get a single pattern by ID
 */
app.get('/api/strategic/patterns/:id', async (req: Request, res: Response) => {
  const { id } = req.params;

  // Validate UUID format
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(id)) {
    res.status(400).json({ success: false, error: 'Invalid pattern ID format' });
    return;
  }

  try {
    const pattern = await patternRepository.getPatternById(id);
    if (!pattern) {
      res.status(404).json({ success: false, error: 'Pattern not found' });
      return;
    }

    res.json({ success: true, pattern });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[API] Get pattern failed:', errorMessage);
    res.status(500).json({ success: false, error: errorMessage });
  }
});

/**
 * Manually trigger pattern analysis
 */
app.post('/api/strategic/patterns/analyze', async (req: Request, res: Response) => {
  try {
    const parseResult = PatternAnalyzeRequestSchema.safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json({
        success: false,
        error: 'Invalid configuration',
        details: parseResult.error.issues,
      });
      return;
    }

    console.log('[API] Manual pattern analysis triggered');
    const result = await analyzePatterns(parseResult.data);

    res.json({ success: true, result });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[API] Pattern analysis failed:', errorMessage);
    res.status(500).json({ success: false, error: errorMessage });
  }
});

/**
 * Update a pattern (primarily for dismissing)
 */
app.patch('/api/strategic/patterns/:id', async (req: Request, res: Response) => {
  const { id } = req.params;

  // Validate UUID format
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(id)) {
    res.status(400).json({ success: false, error: 'Invalid pattern ID format' });
    return;
  }

  try {
    const parseResult = PatternUpdateSchema.safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json({
        success: false,
        error: 'Invalid update data',
        details: parseResult.error.issues,
      });
      return;
    }

    const { name, description, status, dismissedReason } = parseResult.data;

    // Handle dismiss case specially
    if (status === 'dismissed' && dismissedReason) {
      const updated = await patternRepository.dismissPattern(id, dismissedReason);
      if (!updated) {
        res.status(404).json({ success: false, error: 'Pattern not found' });
        return;
      }
      res.json({ success: true, pattern: updated });
      return;
    }

    // General update
    const updated = await patternRepository.updatePattern(id, {
      name,
      description,
      status: status as 'active' | 'dismissed' | undefined,
    });

    if (!updated) {
      res.status(404).json({ success: false, error: 'Pattern not found' });
      return;
    }

    res.json({ success: true, pattern: updated });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[API] Update pattern failed:', errorMessage);
    res.status(500).json({ success: false, error: errorMessage });
  }
});

// ==========================================
// Strategic Layer - Goal Management (Phase 3)
// ==========================================

// Import goal manager
import * as goalManager from './strategic/goalManager.js';
import * as goalRepository from './strategic/db/goalRepository.js';

// Zod schemas for Goal API endpoints
const GoalCategorySchema = z.enum(['revenue', 'product', 'operational', 'growth', 'technical']);
const GoalPrioritySchema = z.enum(['critical', 'high', 'medium', 'low']);
const GoalStatusSchema = z.enum(['active', 'completed', 'paused', 'abandoned']);

const GoalQuerySchema = z.object({
  status: z.union([GoalStatusSchema, z.array(GoalStatusSchema)]).optional(),
  category: z.union([GoalCategorySchema, z.array(GoalCategorySchema)]).optional(),
  priority: z.union([GoalPrioritySchema, z.array(GoalPrioritySchema)]).optional(),
  parentGoalId: z.string().uuid().optional().nullable(),
  hasParent: z.coerce.boolean().optional(),
  limit: z.coerce.number().min(1).max(100).optional().default(50),
  offset: z.coerce.number().min(0).optional().default(0),
  orderBy: z.enum(['priority', 'created_at', 'updated_at', 'target_date', 'progress_percentage']).optional().default('priority'),
  orderDir: z.enum(['ASC', 'DESC']).optional().default('ASC'),
});

const CreateGoalSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().min(1),
  category: GoalCategorySchema,
  priority: GoalPrioritySchema.optional().default('medium'),
  targetMetric: z.string().max(100).optional(),
  targetValue: z.number().min(0).optional(),
  currentValue: z.number().min(0).optional().default(0),
  targetDate: z.string().transform(s => new Date(s)).optional(),
  parentGoalId: z.string().uuid().optional(),
  relatedPatternIds: z.array(z.string().uuid()).optional(),
});

const UpdateGoalSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().min(1).optional(),
  category: GoalCategorySchema.optional(),
  priority: GoalPrioritySchema.optional(),
  targetMetric: z.string().max(100).optional(),
  targetValue: z.number().min(0).optional(),
  currentValue: z.number().min(0).optional(),
  progressPercentage: z.number().min(0).max(100).optional(),
  targetDate: z.string().transform(s => new Date(s)).optional().nullable(),
  status: GoalStatusSchema.optional(),
  parentGoalId: z.string().uuid().optional().nullable(),
  relatedPatternIds: z.array(z.string().uuid()).optional(),
});

const UpdateProgressSchema = z.object({
  currentValue: z.number().min(0),
});

/**
 * List goals with optional filters
 */
app.get('/api/strategic/goals', async (req: Request, res: Response) => {
  try {
    const parseResult = GoalQuerySchema.safeParse(req.query);
    if (!parseResult.success) {
      res.status(400).json({
        success: false,
        error: 'Invalid query parameters',
        details: parseResult.error.issues,
      });
      return;
    }

    const goals = await goalManager.listGoals(parseResult.data);
    res.json({
      success: true,
      goals,
      total: goals.length,
      limit: parseResult.data.limit,
      offset: parseResult.data.offset,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[API] List goals failed:', errorMessage);
    res.status(500).json({ success: false, error: errorMessage });
  }
});

/**
 * Get goal statistics for dashboard
 */
app.get('/api/strategic/goals/stats', async (_req: Request, res: Response) => {
  try {
    const stats = await goalManager.getGoalStats();
    const progress = await goalManager.calculateOverallProgress();
    res.json({ success: true, stats, progress });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[API] Get goal stats failed:', errorMessage);
    res.status(500).json({ success: false, error: errorMessage });
  }
});

/**
 * Get goal hierarchy (tree structure)
 */
app.get('/api/strategic/goals/hierarchy', async (req: Request, res: Response) => {
  try {
    const rootId = req.query.rootId as string | undefined;
    const hierarchy = await goalManager.getGoalHierarchy(rootId);
    res.json({ success: true, hierarchy });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[API] Get goal hierarchy failed:', errorMessage);
    res.status(500).json({ success: false, error: errorMessage });
  }
});

/**
 * Get a single goal by ID
 */
app.get('/api/strategic/goals/:id', async (req: Request, res: Response) => {
  const { id } = req.params;

  // Validate UUID format
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(id)) {
    res.status(400).json({ success: false, error: 'Invalid goal ID format' });
    return;
  }

  try {
    const goal = await goalManager.getGoal(id);
    if (!goal) {
      res.status(404).json({ success: false, error: 'Goal not found' });
      return;
    }

    res.json({ success: true, goal });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[API] Get goal failed:', errorMessage);
    res.status(500).json({ success: false, error: errorMessage });
  }
});

/**
 * Create a new goal
 */
app.post('/api/strategic/goals', async (req: Request, res: Response) => {
  try {
    const parseResult = CreateGoalSchema.safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json({
        success: false,
        error: 'Invalid goal data',
        details: parseResult.error.issues,
      });
      return;
    }

    const result = await goalManager.createGoal(parseResult.data);
    if (!result.success) {
      res.status(400).json({ success: false, error: result.error });
      return;
    }

    res.status(201).json({ success: true, goal: result.goal });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[API] Create goal failed:', errorMessage);
    res.status(500).json({ success: false, error: errorMessage });
  }
});

/**
 * Update a goal
 */
app.patch('/api/strategic/goals/:id', async (req: Request, res: Response) => {
  const { id } = req.params;

  // Validate UUID format
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(id)) {
    res.status(400).json({ success: false, error: 'Invalid goal ID format' });
    return;
  }

  try {
    const parseResult = UpdateGoalSchema.safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json({
        success: false,
        error: 'Invalid update data',
        details: parseResult.error.issues,
      });
      return;
    }

    const result = await goalManager.updateGoal(id, parseResult.data);
    if (!result.success) {
      res.status(404).json({ success: false, error: result.error });
      return;
    }

    res.json({ success: true, goal: result.goal, previousStatus: result.previousStatus });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[API] Update goal failed:', errorMessage);
    res.status(500).json({ success: false, error: errorMessage });
  }
});

/**
 * Update goal progress
 */
app.patch('/api/strategic/goals/:id/progress', async (req: Request, res: Response) => {
  const { id } = req.params;

  // Validate UUID format
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(id)) {
    res.status(400).json({ success: false, error: 'Invalid goal ID format' });
    return;
  }

  try {
    const parseResult = UpdateProgressSchema.safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json({
        success: false,
        error: 'Invalid progress data',
        details: parseResult.error.issues,
      });
      return;
    }

    const result = await goalManager.updateProgress(id, parseResult.data.currentValue);
    if (!result.success) {
      res.status(404).json({ success: false, error: result.error });
      return;
    }

    res.json({ success: true, goal: result.goal });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[API] Update progress failed:', errorMessage);
    res.status(500).json({ success: false, error: errorMessage });
  }
});

/**
 * Delete (abandon) a goal
 */
app.delete('/api/strategic/goals/:id', async (req: Request, res: Response) => {
  const { id } = req.params;

  // Validate UUID format
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(id)) {
    res.status(400).json({ success: false, error: 'Invalid goal ID format' });
    return;
  }

  try {
    const reason = req.query.reason as string | undefined;
    const result = await goalManager.abandonGoal(id, reason);
    if (!result.success) {
      res.status(404).json({ success: false, error: result.error });
      return;
    }

    res.json({ success: true, goal: result.goal });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[API] Delete goal failed:', errorMessage);
    res.status(500).json({ success: false, error: errorMessage });
  }
});

/**
 * Link a pattern to a goal
 */
app.post('/api/strategic/goals/:goalId/patterns/:patternId', async (req: Request, res: Response) => {
  const { goalId, patternId } = req.params;

  // Validate UUID format
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(goalId) || !uuidRegex.test(patternId)) {
    res.status(400).json({ success: false, error: 'Invalid ID format' });
    return;
  }

  try {
    const result = await goalManager.linkPattern(goalId, patternId);
    if (!result.success) {
      res.status(404).json({ success: false, error: result.error });
      return;
    }

    res.json({ success: true, goal: result.goal });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[API] Link pattern failed:', errorMessage);
    res.status(500).json({ success: false, error: errorMessage });
  }
});

/**
 * Unlink a pattern from a goal
 */
app.delete('/api/strategic/goals/:goalId/patterns/:patternId', async (req: Request, res: Response) => {
  const { goalId, patternId } = req.params;

  // Validate UUID format
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(goalId) || !uuidRegex.test(patternId)) {
    res.status(400).json({ success: false, error: 'Invalid ID format' });
    return;
  }

  try {
    const result = await goalManager.unlinkPattern(goalId, patternId);
    if (!result.success) {
      res.status(404).json({ success: false, error: result.error });
      return;
    }

    res.json({ success: true, goal: result.goal });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[API] Unlink pattern failed:', errorMessage);
    res.status(500).json({ success: false, error: errorMessage });
  }
});

// ==========================================
// Strategic Layer: Recommendation Endpoints
// ==========================================

// Import recommendation engine and repository
import { generateRecommendations, triggerRecommendationsIfNeeded } from './strategic/recommendationEngine.js';
import * as recommendationRepository from './strategic/db/recommendationRepository.js';

// Zod schemas for recommendation API endpoints
const RecommendationQuerySchema = z.object({
  status: z.enum(['pending', 'accepted', 'rejected', 'deferred', 'expired']).optional(),
  priority: z.enum(['critical', 'high', 'medium', 'low']).optional(),
  type: z.enum(['action', 'optimization', 'warning', 'opportunity']).optional(),
  minConfidence: z.coerce.number().min(0).max(1).optional(),
  limit: z.coerce.number().min(1).max(100).optional().default(50),
  offset: z.coerce.number().min(0).optional().default(0),
  orderBy: z.enum(['created_at', 'priority', 'confidence', 'expires_at']).optional().default('priority'),
  orderDir: z.enum(['ASC', 'DESC']).optional().default('ASC'),
});

const RecommendationGenerateSchema = z.object({
  minPatternConfidence: z.number().min(0).max(1).optional(),
  maxRecommendationsPerRun: z.number().min(1).max(50).optional(),
});

const RecommendationAcceptSchema = z.object({
  feedbackText: z.string().max(1000).optional(),
  feedbackRating: z.number().min(1).max(5).optional(),
  triggerOrchestration: z.boolean().optional().default(false),
});

const RecommendationRejectSchema = z.object({
  feedbackText: z.string().max(1000).optional(),
  feedbackRating: z.number().min(1).max(5).optional(),
});

const RecommendationDeferSchema = z.object({
  deferUntil: z.string().transform(s => new Date(s)),
  feedbackText: z.string().max(1000).optional(),
});

/**
 * List recommendations with optional filters
 */
app.get('/api/strategic/recommendations', async (req: Request, res: Response) => {
  try {
    const parseResult = RecommendationQuerySchema.safeParse(req.query);
    if (!parseResult.success) {
      res.status(400).json({ success: false, error: 'Invalid query parameters', details: parseResult.error.issues });
      return;
    }

    const { status, priority, type, minConfidence, limit, offset, orderBy, orderDir } = parseResult.data;

    const recommendations = await recommendationRepository.queryRecommendations({
      status,
      priority,
      type,
      minConfidence,
      limit,
      offset,
      orderBy,
      orderDir,
    });

    res.json({ success: true, recommendations, count: recommendations.length });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[API] List recommendations failed:', errorMessage);
    res.status(500).json({ success: false, error: errorMessage });
  }
});

/**
 * Get recommendation statistics for dashboard
 */
app.get('/api/strategic/recommendations/stats', async (_req: Request, res: Response) => {
  try {
    const stats = await recommendationRepository.getRecommendationStats();
    res.json({ success: true, stats });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[API] Get recommendation stats failed:', errorMessage);
    res.status(500).json({ success: false, error: errorMessage });
  }
});

/**
 * Get pending recommendations (priority-ordered)
 */
app.get('/api/strategic/recommendations/pending', async (req: Request, res: Response) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const recommendations = await recommendationRepository.getPendingRecommendations(limit);
    res.json({ success: true, recommendations, count: recommendations.length });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[API] Get pending recommendations failed:', errorMessage);
    res.status(500).json({ success: false, error: errorMessage });
  }
});

/**
 * Get recommendations expiring soon
 */
app.get('/api/strategic/recommendations/expiring', async (req: Request, res: Response) => {
  try {
    const withinHours = Math.min(parseInt(req.query.hours as string) || 24, 168);
    const recommendations = await recommendationRepository.getExpiringRecommendations(withinHours);
    res.json({ success: true, recommendations, count: recommendations.length });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[API] Get expiring recommendations failed:', errorMessage);
    res.status(500).json({ success: false, error: errorMessage });
  }
});

/**
 * Get a single recommendation by ID
 */
app.get('/api/strategic/recommendations/:id', async (req: Request, res: Response) => {
  const { id } = req.params;

  // Validate UUID format
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    res.status(400).json({ success: false, error: 'Invalid recommendation ID format' });
    return;
  }

  try {
    const recommendation = await recommendationRepository.getRecommendationById(id);

    if (!recommendation) {
      res.status(404).json({ success: false, error: 'Recommendation not found' });
      return;
    }

    res.json({ success: true, recommendation });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[API] Get recommendation failed:', errorMessage);
    res.status(500).json({ success: false, error: errorMessage });
  }
});

/**
 * Manually trigger recommendation generation
 */
app.post('/api/strategic/recommendations/generate', async (req: Request, res: Response) => {
  try {
    const parseResult = RecommendationGenerateSchema.safeParse(req.body || {});
    if (!parseResult.success) {
      res.status(400).json({ success: false, error: 'Invalid request body', details: parseResult.error.issues });
      return;
    }

    console.log('[API] Triggering recommendation generation...');
    const result = await generateRecommendations(parseResult.data);

    res.json({
      success: result.success,
      result,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[API] Recommendation generation failed:', errorMessage);
    res.status(500).json({ success: false, error: errorMessage });
  }
});

/**
 * Accept a recommendation
 */
app.post('/api/strategic/recommendations/:id/accept', async (req: Request, res: Response) => {
  const { id } = req.params;

  // Validate UUID format
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    res.status(400).json({ success: false, error: 'Invalid recommendation ID format' });
    return;
  }

  try {
    const parseResult = RecommendationAcceptSchema.safeParse(req.body || {});
    if (!parseResult.success) {
      res.status(400).json({ success: false, error: 'Invalid request body', details: parseResult.error.issues });
      return;
    }

    const { feedbackText, feedbackRating, triggerOrchestration } = parseResult.data;

    // Get the recommendation first
    const recommendation = await recommendationRepository.getRecommendationById(id);
    if (!recommendation) {
      res.status(404).json({ success: false, error: 'Recommendation not found' });
      return;
    }

    if (recommendation.status !== 'pending') {
      res.status(400).json({ success: false, error: `Cannot accept recommendation with status: ${recommendation.status}` });
      return;
    }

    // Create feedback if provided
    let feedbackId: string | undefined;
    if (feedbackText || feedbackRating) {
      const feedback = await recommendationRepository.insertFeedback({
        entityType: 'recommendation',
        entityId: id,
        action: 'accept',
        feedbackText,
        feedbackRating,
      });
      feedbackId = feedback?.id;
    }

    // Accept the recommendation
    const accepted = await recommendationRepository.acceptRecommendation(id, feedbackId);

    if (!accepted) {
      res.status(500).json({ success: false, error: 'Failed to accept recommendation' });
      return;
    }

    // Optionally trigger orchestration with the suggested intent
    let sessionId: string | undefined;
    if (triggerOrchestration && accepted.suggested_intent) {
      // Create orchestration session with the suggested intent
      const session = await createOrchestrationSession({
        sessionId: `rec-${id}-${Date.now()}`,
        intent: accepted.suggested_intent,
        context: {
          urgency: accepted.priority === 'critical' ? 'high' : accepted.priority === 'high' ? 'high' : 'normal',
        },
      });
      sessionId = session.sessionId;
      console.log(`[API] Created orchestration session ${sessionId} from accepted recommendation ${id}`);
    }

    res.json({
      success: true,
      recommendation: accepted,
      feedbackId,
      sessionId,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[API] Accept recommendation failed:', errorMessage);
    res.status(500).json({ success: false, error: errorMessage });
  }
});

/**
 * Reject a recommendation
 */
app.post('/api/strategic/recommendations/:id/reject', async (req: Request, res: Response) => {
  const { id } = req.params;

  // Validate UUID format
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    res.status(400).json({ success: false, error: 'Invalid recommendation ID format' });
    return;
  }

  try {
    const parseResult = RecommendationRejectSchema.safeParse(req.body || {});
    if (!parseResult.success) {
      res.status(400).json({ success: false, error: 'Invalid request body', details: parseResult.error.issues });
      return;
    }

    const { feedbackText, feedbackRating } = parseResult.data;

    // Get the recommendation first
    const recommendation = await recommendationRepository.getRecommendationById(id);
    if (!recommendation) {
      res.status(404).json({ success: false, error: 'Recommendation not found' });
      return;
    }

    if (recommendation.status !== 'pending') {
      res.status(400).json({ success: false, error: `Cannot reject recommendation with status: ${recommendation.status}` });
      return;
    }

    // Create feedback if provided
    let feedbackId: string | undefined;
    if (feedbackText || feedbackRating) {
      const feedback = await recommendationRepository.insertFeedback({
        entityType: 'recommendation',
        entityId: id,
        action: 'reject',
        feedbackText,
        feedbackRating,
      });
      feedbackId = feedback?.id;
    }

    // Reject the recommendation
    const rejected = await recommendationRepository.rejectRecommendation(id, feedbackId);

    if (!rejected) {
      res.status(500).json({ success: false, error: 'Failed to reject recommendation' });
      return;
    }

    res.json({
      success: true,
      recommendation: rejected,
      feedbackId,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[API] Reject recommendation failed:', errorMessage);
    res.status(500).json({ success: false, error: errorMessage });
  }
});

/**
 * Defer a recommendation
 */
app.post('/api/strategic/recommendations/:id/defer', async (req: Request, res: Response) => {
  const { id } = req.params;

  // Validate UUID format
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    res.status(400).json({ success: false, error: 'Invalid recommendation ID format' });
    return;
  }

  try {
    const parseResult = RecommendationDeferSchema.safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json({ success: false, error: 'Invalid request body', details: parseResult.error.issues });
      return;
    }

    const { deferUntil, feedbackText } = parseResult.data;

    // Get the recommendation first
    const recommendation = await recommendationRepository.getRecommendationById(id);
    if (!recommendation) {
      res.status(404).json({ success: false, error: 'Recommendation not found' });
      return;
    }

    if (recommendation.status !== 'pending') {
      res.status(400).json({ success: false, error: `Cannot defer recommendation with status: ${recommendation.status}` });
      return;
    }

    // Create feedback if provided
    let feedbackId: string | undefined;
    if (feedbackText) {
      const feedback = await recommendationRepository.insertFeedback({
        entityType: 'recommendation',
        entityId: id,
        action: 'defer',
        feedbackText,
      });
      feedbackId = feedback?.id;
    }

    // Defer the recommendation
    const deferred = await recommendationRepository.deferRecommendation(id, deferUntil, feedbackId);

    if (!deferred) {
      res.status(500).json({ success: false, error: 'Failed to defer recommendation' });
      return;
    }

    res.json({
      success: true,
      recommendation: deferred,
      feedbackId,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[API] Defer recommendation failed:', errorMessage);
    res.status(500).json({ success: false, error: errorMessage });
  }
});

/**
 * Get feedback for a recommendation
 */
app.get('/api/strategic/recommendations/:id/feedback', async (req: Request, res: Response) => {
  const { id } = req.params;

  // Validate UUID format
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    res.status(400).json({ success: false, error: 'Invalid recommendation ID format' });
    return;
  }

  try {
    const feedback = await recommendationRepository.getFeedbackForEntity('recommendation', id);
    res.json({ success: true, feedback });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[API] Get feedback failed:', errorMessage);
    res.status(500).json({ success: false, error: errorMessage });
  }
});

/**
 * Get feedback statistics
 */
app.get('/api/strategic/feedback/stats', async (_req: Request, res: Response) => {
  try {
    const stats = await recommendationRepository.getFeedbackStats();
    res.json({ success: true, stats });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[API] Get feedback stats failed:', errorMessage);
    res.status(500).json({ success: false, error: errorMessage });
  }
});

// ==========================================
// Webhook Endpoints (for external services)
// ==========================================

/**
 * Generic webhook receiver
 * Matches incoming events to configured triggers
 */
app.post('/api/webhook/:source', async (req: Request, res: Response) => {
  const { source } = req.params;

  // Validate source
  const sourceValidation = EventSourceSchema.safeParse(source);
  if (!sourceValidation.success) {
    res.status(400).json({ error: `Invalid webhook source: ${source}` });
    return;
  }

  const eventSource = sourceValidation.data as EventSource;

  try {
    // Extract event type from headers or payload
    let eventType = 'unknown';

    // GitHub uses X-GitHub-Event header
    if (eventSource === 'github') {
      eventType = req.headers['x-github-event'] as string || 'push';
    }
    // Sentry uses X-Sentry-Hook header
    else if (eventSource === 'sentry') {
      eventType = req.headers['x-sentry-hook'] as string || 'event';
    }
    // Slack uses type in payload
    else if (eventSource === 'slack') {
      eventType = req.body?.type || req.body?.event?.type || 'message';
    }
    // Generic webhook - try to get from header or body
    else {
      eventType = req.headers['x-event-type'] as string || req.body?.event_type || req.body?.type || 'generic';
    }

    console.log(`[Webhook] Received ${eventSource}/${eventType}`);

    // Process the webhook event
    const results = await processWebhookEvent({
      source: eventSource,
      eventType,
      payload: req.body,
      headers: req.headers as Record<string, string>,
      signature: req.headers['x-hub-signature-256'] as string || req.headers['x-signature'] as string,
      receivedAt: new Date(),
    });

    res.json({
      success: true,
      triggersMatched: results.length,
      results,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[Webhook] Processing failed for ${eventSource}:`, errorMessage);
    res.status(500).json({ error: errorMessage });
  }
});

/**
 * Webhook verification endpoint (for GitHub, Slack, etc.)
 * Some services require endpoint verification before sending events
 */
app.get('/api/webhook/:source', (req: Request, res: Response) => {
  const { source } = req.params;

  // Slack URL verification challenge
  if (source === 'slack' && req.query.challenge) {
    res.send(req.query.challenge);
    return;
  }

  // Generic verification - return 200 OK
  res.json({
    status: 'ok',
    source,
    message: 'Webhook endpoint ready',
  });
});

// Error handling middleware
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error('[API] Unhandled error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: err.message,
  });
});

// Initialize and start server
async function startServer() {
  // Initialize session persistence
  console.log('[TaskRunner] Initializing session persistence...');
  await initializeSessionStore();
  await loadWorkflowStatuses();

  const dbStatus = isDatabaseAvailable() ? 'connected' : 'memory-only mode';
  console.log(`[TaskRunner] Database: ${dbStatus}`);

  // Set base URL for scheduler and event trigger dispatch
  const baseUrl = `http://localhost:${PORT}`;
  setServerBaseUrl(baseUrl);
  setEventTriggerServerUrl(baseUrl);

  // Initialize scheduler (load schedules from DB, start cron jobs)
  console.log('[TaskRunner] Initializing scheduler...');
  await initializeScheduler();

  // Initialize event triggers (load triggers from DB)
  console.log('[TaskRunner] Initializing event triggers...');
  await initializeEventTriggers();

  app.listen(PORT, () => {
    console.log(`[TaskRunner] Server running on http://localhost:${PORT}`);
    console.log(`[TaskRunner] Health check: http://localhost:${PORT}/health`);
    console.log(`[TaskRunner] Bug fix endpoint: POST http://localhost:${PORT}/api/workflow/bugfix`);
    console.log(`[TaskRunner] Content endpoint: POST http://localhost:${PORT}/api/workflow/content`);
    console.log(`[TaskRunner] Orchestrator endpoint: POST http://localhost:${PORT}/api/orchestrate`);
    console.log(`[TaskRunner] Schedules endpoint: /api/schedules/*`);
    console.log(`[TaskRunner] Triggers endpoint: /api/triggers/*`);
    console.log(`[TaskRunner] Webhook endpoint: /api/webhook/:source`);
    console.log(`[TaskRunner] Mandrel endpoints: /api/mandrel/*`);
  });
}

// Handle graceful shutdown
process.on('SIGTERM', () => {
  console.log('[TaskRunner] SIGTERM received, stopping scheduler...');
  stopAllJobs();
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('[TaskRunner] SIGINT received, stopping scheduler...');
  stopAllJobs();
  process.exit(0);
});

startServer().catch(err => {
  console.error('[TaskRunner] Failed to start server:', err);
  process.exit(1);
});
