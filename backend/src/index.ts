/**
 * TaskRunner Backend Server
 * Instance 10 - HTTP API for business workflow execution
 *
 * This server provides HTTP endpoints for the Command Center UI
 * to trigger AI-powered workflow tasks.
 */

import express, { type Request, type Response, type NextFunction } from 'express';
import cors from 'cors';
import {
  BugFixRequestSchema,
  ImplementRequestSchema,
  ContentGenerationRequestSchema,
  ContentRefineRequestSchema,
  type WorkflowUpdate,
  type ContentGenerationResult,
} from './types.js';
import { runBugAnalysis, runImplementation, checkClaudeAvailable, storeBugFixCompletion } from './taskRunner.js';
import { runContentGeneration, runContentRefinement, storeContentCompletion } from './contentRunner.js';
import { checkMandrelAvailable, searchRelevantContext, getRecentWorkflows } from './mandrelClient.js';
import {
  OrchestrationRequestSchema,
  createOrchestrationSession,
  getSession,
  getAllSessions,
  dispatchAllTasks,
  updateTaskStatus,
} from './orchestrator.js';

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
      // Future workflows can be added here:
      // { type: 'feature', name: 'Feature Implementation', capability: 'PRODUCE' },
      // { type: 'support', name: 'Support Ticket Handler', capability: 'OPERATE' },
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
 */
app.post('/api/mandrel/bugfix/:id/complete', async (req: Request, res: Response) => {
  const { id: workflowId } = req.params;
  const { bugReport, analysis, review } = req.body;

  if (!bugReport || !analysis) {
    res.status(400).json({ error: 'bugReport and analysis are required' });
    return;
  }

  console.log(`[API] Storing bug fix completion to Mandrel: ${workflowId}`);

  try {
    const stored = await storeBugFixCompletion(workflowId, bugReport, analysis, review);
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
 */
app.get('/api/orchestrate', (_req: Request, res: Response) => {
  const sessions = getAllSessions();

  res.json({
    success: true,
    count: sessions.length,
    sessions: sessions.map(s => ({
      sessionId: s.sessionId,
      intent: s.intent.substring(0, 100) + (s.intent.length > 100 ? '...' : ''),
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

// Error handling middleware
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error('[API] Unhandled error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: err.message,
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`[TaskRunner] Server running on http://localhost:${PORT}`);
  console.log(`[TaskRunner] Health check: http://localhost:${PORT}/health`);
  console.log(`[TaskRunner] Bug fix endpoint: POST http://localhost:${PORT}/api/workflow/bugfix`);
  console.log(`[TaskRunner] Content endpoint: POST http://localhost:${PORT}/api/workflow/content`);
  console.log(`[TaskRunner] Orchestrator endpoint: POST http://localhost:${PORT}/api/orchestrate`);
  console.log(`[TaskRunner] Mandrel endpoints: /api/mandrel/*`);
});
