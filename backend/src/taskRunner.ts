/**
 * TaskRunner - Executes bounded AI tasks via Claude CLI
 * Instance 10 - Core execution engine for business workflows
 *
 * Design principles:
 * - Uses claude CLI (like Forge/ClaudeRunner) for full tool access
 * - Captures structured output for UI parsing
 * - Supports timeout and cancellation
 * - Isolated execution per task
 */

import { spawn, type ChildProcess } from 'child_process';
import type { BugReport, BugAnalysis, TaskResult, Confidence, CodeChange, ImplementationResult } from './types.js';
import { getContextForBugAnalysis, storeWorkflowCompletion, type WorkflowCompletion } from './mandrelClient.js';

export interface TaskRunnerConfig {
  timeoutMs: number;
  projectPath: string;
}

const DEFAULT_CONFIG: TaskRunnerConfig = {
  timeoutMs: 300000, // 5 minutes
  projectPath: process.cwd(),
};

// Remote execution configuration
const REMOTE_USER = process.env.REMOTE_USER || 'ridgetop';
const REMOTE_PORT = process.env.REMOTE_PORT || '2222';
const REMOTE_HOST = process.env.REMOTE_HOST || 'localhost';
const USE_REMOTE = process.env.USE_REMOTE_EXECUTION === 'true';

/**
 * Escape a string for use in a shell command
 */
function escapeShellArg(arg: string): string {
  // Use base64 encoding to safely pass complex prompts through SSH
  return Buffer.from(arg).toString('base64');
}

/**
 * Spawn Claude CLI either locally or remotely via SSH tunnel
 */
function spawnClaude(prompt: string, projectPath: string, env: NodeJS.ProcessEnv): ChildProcess {
  if (USE_REMOTE) {
    // Remote execution via SSH tunnel
    // Write prompt to a temp file and execute via SSH to avoid encoding issues
    const tempFile = `/tmp/claude-prompt-${Date.now()}.txt`;

    console.log(`[TaskRunner] Remote execution via SSH tunnel to ${REMOTE_USER}@${REMOTE_HOST}:${REMOTE_PORT}`);
    console.log(`[TaskRunner] Remote project path: ${projectPath}`);

    // Use bash -l to load login profile, write prompt to temp file, run claude, clean up
    const remoteCommand = `bash -l -c 'cat > ${tempFile} && cd "${projectPath}" && claude --print --dangerously-skip-permissions "$(cat ${tempFile})" && rm -f ${tempFile}'`;

    const child = spawn('ssh', [
      '-p', REMOTE_PORT,
      '-o', 'StrictHostKeyChecking=no',
      '-o', 'ConnectTimeout=10',
      `${REMOTE_USER}@${REMOTE_HOST}`,
      remoteCommand
    ], {
      env,
      stdio: ['pipe', 'pipe', 'pipe'],  // Enable stdin for prompt
    });

    // Write prompt to SSH stdin
    if (child.stdin) {
      child.stdin.write(prompt);
      child.stdin.end();
    }

    return child;
  } else {
    // Local execution
    console.log(`[TaskRunner] Local execution at: ${projectPath}`);
    return spawn('claude', [
      '--print',
      '--dangerously-skip-permissions',
      prompt,
    ], {
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
      cwd: projectPath,
    });
  }
}

/**
 * Build the analysis prompt for bug fix workflow
 * Instance 13: Added mandrelContext parameter for institutional memory
 */
function buildBugAnalysisPrompt(bugReport: BugReport, projectPath: string, mandrelContext?: string): string {
  return `You are analyzing a bug report for a codebase at: ${projectPath}
${mandrelContext || ''}

## Bug Report

**Title:** ${bugReport.title}

**Description:** ${bugReport.description}

**Severity:** ${bugReport.severity}

${bugReport.stepsToReproduce ? `**Steps to Reproduce:**\n${bugReport.stepsToReproduce}\n` : ''}
${bugReport.expectedBehavior ? `**Expected Behavior:**\n${bugReport.expectedBehavior}\n` : ''}
${bugReport.actualBehavior ? `**Actual Behavior:**\n${bugReport.actualBehavior}\n` : ''}

## Your Task

1. Analyze this bug report and identify the likely root cause
2. Search the codebase to find relevant files and evidence
3. Propose a fix with specific code changes

## Output Format

You MUST respond with a JSON object in this exact format (and nothing else):

\`\`\`json
{
  "rootCause": "Clear explanation of what is causing the bug",
  "evidence": "Code references and reasoning that support your analysis",
  "confidence": "high" | "medium" | "low",
  "questions": ["Optional array of clarifying questions if needed"],
  "proposedFix": {
    "explanation": "What the fix does and why it works",
    "changes": [
      {
        "file": "path/to/file.ts",
        "original": "original code snippet",
        "proposed": "proposed code change",
        "explanation": "why this change helps"
      }
    ],
    "risks": ["potential risks or side effects"],
    "testNeeds": ["tests that should be added or verified"]
  }
}
\`\`\`

Important:
- Be specific and cite actual file paths and code
- If you cannot find enough information, say so in the rootCause and set confidence to "low"
- Focus on the most likely root cause based on the symptoms
- Keep proposed changes minimal and surgical`;
}

/**
 * Parse Claude's output into structured BugAnalysis
 */
function parseAnalysisOutput(output: string): BugAnalysis {
  // Try to find JSON in the output
  const jsonMatch = output.match(/```json\s*([\s\S]*?)\s*```/);

  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[1]);
      return {
        rootCause: parsed.rootCause || 'Unable to determine root cause',
        evidence: parsed.evidence || 'No evidence found',
        confidence: (parsed.confidence as Confidence) || 'low',
        questions: parsed.questions,
        proposedFix: parsed.proposedFix,
        rawOutput: output,
      };
    } catch (e) {
      console.error('[TaskRunner] Failed to parse JSON from output:', e);
    }
  }

  // Fallback: try to parse the entire output as JSON
  try {
    const parsed = JSON.parse(output.trim());
    return {
      rootCause: parsed.rootCause || 'Unable to determine root cause',
      evidence: parsed.evidence || 'No evidence found',
      confidence: (parsed.confidence as Confidence) || 'low',
      questions: parsed.questions,
      proposedFix: parsed.proposedFix,
      rawOutput: output,
    };
  } catch {
    // Final fallback: return raw output as analysis
    return {
      rootCause: 'Analysis completed but output format was unexpected',
      evidence: output.substring(0, 500),
      confidence: 'low',
      rawOutput: output,
    };
  }
}

/**
 * Execute a bug analysis task using Claude CLI
 * Instance 13: Added Mandrel context retrieval for institutional memory
 */
export async function runBugAnalysis(
  bugReport: BugReport,
  config: Partial<TaskRunnerConfig> = {}
): Promise<TaskResult<BugAnalysis>> {
  const { timeoutMs, projectPath } = { ...DEFAULT_CONFIG, ...config };
  const startTime = Date.now();

  // Instance 13: Query Mandrel for relevant previous work
  let mandrelContext = '';
  try {
    console.log('[TaskRunner] Querying Mandrel for relevant context...');
    mandrelContext = await getContextForBugAnalysis(bugReport);
    if (mandrelContext) {
      console.log('[TaskRunner] Found relevant context from Mandrel');
    }
  } catch (error) {
    console.warn('[TaskRunner] Mandrel context retrieval failed (continuing without):', error);
  }

  const prompt = buildBugAnalysisPrompt(bugReport, projectPath, mandrelContext);

  return new Promise((resolve) => {
    let stdout = '';
    let stderr = '';
    let killed = false;
    let timeoutHandle: ReturnType<typeof setTimeout> | null = null;

    console.log(`[TaskRunner] Starting bug analysis for: ${bugReport.title}`);
    console.log(`[TaskRunner] Project path: ${projectPath}`);
    console.log(`[TaskRunner] Timeout: ${timeoutMs}ms`);

    // Spawn claude CLI with the analysis prompt
    // Using --print to get output and --dangerously-skip-permissions for automated execution
    // Supports both local and remote execution via SSH tunnel
    const child: ChildProcess = spawnClaude(prompt, projectPath, process.env);

    const cleanup = () => {
      if (timeoutHandle) {
        clearTimeout(timeoutHandle);
        timeoutHandle = null;
      }
    };

    child.stdout?.on('data', (data) => {
      const chunk = data.toString();
      stdout += chunk;
      // Log progress indicator
      if (stdout.length % 1000 < 100) {
        console.log(`[TaskRunner] Received ${stdout.length} bytes of output...`);
      }
    });

    child.stderr?.on('data', (data) => {
      const chunk = data.toString();
      stderr += chunk;
      // Only log errors, not progress messages
      if (chunk.includes('error') || chunk.includes('Error')) {
        console.error(`[TaskRunner] stderr: ${chunk}`);
      }
    });

    child.on('error', (err) => {
      cleanup();
      console.error(`[TaskRunner] Spawn error: ${err.message}`);
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
        console.log('[TaskRunner] Process killed due to timeout');
        resolve({
          success: false,
          error: 'Analysis timed out',
          durationMs,
        });
        return;
      }

      console.log(`[TaskRunner] Claude CLI exited with code ${code}`);
      console.log(`[TaskRunner] Analysis completed in ${durationMs}ms`);

      if (code !== 0) {
        resolve({
          success: false,
          error: `Claude CLI exited with code ${code}: ${stderr || stdout}`,
          durationMs,
        });
        return;
      }

      // Parse the output into structured analysis
      const analysis = parseAnalysisOutput(stdout);

      resolve({
        success: true,
        data: analysis,
        durationMs,
      });
    });

    // Set timeout
    timeoutHandle = setTimeout(() => {
      killed = true;
      console.log(`[TaskRunner] Timeout reached (${timeoutMs}ms), killing process`);
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
 * Check if claude CLI is available
 */
export async function checkClaudeAvailable(): Promise<boolean> {
  return new Promise((resolve) => {
    const child = spawn('claude', ['--version'], {
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    child.on('error', () => resolve(false));
    child.on('close', (code) => resolve(code === 0));

    // Timeout after 5 seconds
    setTimeout(() => {
      child.kill();
      resolve(false);
    }, 5000);
  });
}

/**
 * Build the implementation prompt for applying approved changes
 */
function buildImplementationPrompt(changes: CodeChange[], runTests: boolean, projectPath: string): string {
  const changesDescription = changes.map((change, index) => `
### Change ${index + 1}: ${change.file}

**Original code to find:**
\`\`\`
${change.original}
\`\`\`

**Replace with:**
\`\`\`
${change.proposed}
\`\`\`

${change.explanation ? `**Rationale:** ${change.explanation}` : ''}
`).join('\n');

  return `You are implementing approved code changes for a codebase at: ${projectPath}

## Approved Changes

The user has reviewed and approved the following changes. Apply them EXACTLY as specified.

${changesDescription}

## Your Task

1. Apply each change to the specified file
2. Make ONLY the approved changes - do not modify anything else
3. Run the build to verify the code compiles cleanly (cargo build, npm run build, etc.)
4. ${runTests ? 'Run the test suite to verify changes work correctly' : 'Skip test verification'}
5. Report what was done

## Output Format

You MUST respond with a JSON object in this exact format (and nothing else):

\`\`\`json
{
  "success": true | false,
  "changedFiles": ["list", "of", "files", "modified"],
  "buildResult": {
    "success": true | false,
    "command": "the build command used",
    "output": "summary of build output or errors"
  },
  ${runTests ? `"testResults": {
    "passed": <number>,
    "failed": <number>,
    "skipped": <number>,
    "duration": <milliseconds>,
    "output": "summary of test output"
  },` : ''}
  "warnings": ["any warnings encountered"],
  "errors": ["any errors encountered - empty array if success is true"]
}
\`\`\`

Important:
- Apply changes EXACTLY as specified - match whitespace and formatting
- Do not add extra changes or "improvements"
- If a file cannot be found, report it in errors
- If the build fails, report success: false with the build errors
- If tests fail after changes, report success: false with the test results`;
}

/**
 * Parse implementation output into structured result
 */
function parseImplementationOutput(output: string): ImplementationResult {
  // Try to find JSON in the output
  const jsonMatch = output.match(/\`\`\`json\s*([\s\S]*?)\s*\`\`\`/);

  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[1]);
      return {
        success: parsed.success ?? false,
        changedFiles: parsed.changedFiles || [],
        buildResult: parsed.buildResult,
        testResults: parsed.testResults,
        warnings: parsed.warnings || [],
        errors: parsed.errors || [],
        rawOutput: output,
      };
    } catch (e) {
      console.error('[TaskRunner] Failed to parse implementation JSON:', e);
    }
  }

  // Fallback: try to parse entire output as JSON
  try {
    const parsed = JSON.parse(output.trim());
    return {
      success: parsed.success ?? false,
      changedFiles: parsed.changedFiles || [],
      buildResult: parsed.buildResult,
      testResults: parsed.testResults,
      warnings: parsed.warnings || [],
      errors: parsed.errors || [],
      rawOutput: output,
    };
  } catch {
    // Final fallback
    return {
      success: false,
      changedFiles: [],
      warnings: [],
      errors: ['Implementation output format was unexpected'],
      rawOutput: output,
    };
  }
}

/**
 * Execute approved code changes using Claude CLI
 */
export async function runImplementation(
  changes: CodeChange[],
  config: Partial<TaskRunnerConfig> = {},
  runTests: boolean = true
): Promise<TaskResult<ImplementationResult>> {
  const { timeoutMs, projectPath } = { ...DEFAULT_CONFIG, ...config };
  const startTime = Date.now();

  const prompt = buildImplementationPrompt(changes, runTests, projectPath);

  return new Promise((resolve) => {
    let stdout = '';
    let stderr = '';
    let killed = false;
    let timeoutHandle: ReturnType<typeof setTimeout> | null = null;

    console.log(`[TaskRunner] Starting implementation: ${changes.length} changes`);
    console.log(`[TaskRunner] Project path: ${projectPath}`);
    console.log(`[TaskRunner] Run tests: ${runTests}`);

    // Spawn claude CLI with the implementation prompt
    // Supports both local and remote execution via SSH tunnel
    const child: ChildProcess = spawnClaude(prompt, projectPath, process.env);

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
        console.log(`[TaskRunner] Implementation: ${stdout.length} bytes received...`);
      }
    });

    child.stderr?.on('data', (data) => {
      const chunk = data.toString();
      stderr += chunk;
      if (chunk.includes('error') || chunk.includes('Error')) {
        console.error(`[TaskRunner] Implementation stderr: ${chunk}`);
      }
    });

    child.on('error', (err) => {
      cleanup();
      console.error(`[TaskRunner] Implementation spawn error: ${err.message}`);
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
        console.log('[TaskRunner] Implementation killed due to timeout');
        resolve({
          success: false,
          error: 'Implementation timed out',
          durationMs,
        });
        return;
      }

      console.log(`[TaskRunner] Implementation CLI exited with code ${code}`);
      console.log(`[TaskRunner] Implementation completed in ${durationMs}ms`);

      if (code !== 0) {
        resolve({
          success: false,
          error: `Claude CLI exited with code ${code}: ${stderr || stdout}`,
          durationMs,
        });
        return;
      }

      // Parse the output into structured result
      const result = parseImplementationOutput(stdout);

      resolve({
        success: result.success,
        data: result,
        durationMs,
      });
    });

    // Set timeout (implementation might take longer than analysis)
    timeoutHandle = setTimeout(() => {
      killed = true;
      console.log(`[TaskRunner] Implementation timeout reached (${timeoutMs}ms), killing process`);
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
 * Store a completed bug fix workflow to Mandrel for institutional memory
 * Instance 13: Added for cross-workflow learning
 * @param projectName - Mandrel project name to store to (calls project_switch first)
 * @param stage - 'proposed' for initial analysis, 'confirmed' for user verification
 */
export async function storeBugFixCompletion(
  workflowId: string,
  bugReport: BugReport,
  analysis: BugAnalysis,
  review?: { decision: 'approved' | 'rejected' | 'changes_requested'; feedback?: string },
  projectName?: string,
  stage?: 'proposed' | 'confirmed'
): Promise<boolean> {
  const stageLabel = stage || 'completion';
  console.log(`[TaskRunner] Storing bug fix ${stageLabel}: ${workflowId}${projectName ? ` to project: ${projectName}` : ''}`);

  const completion: WorkflowCompletion = {
    type: 'bugfix',
    capability: 'PRODUCE',
    workflowId,
    input: bugReport,
    output: analysis,
    review,
    completedAt: new Date(),
    stage,
  };

  try {
    const stored = await storeWorkflowCompletion(completion, projectName);
    if (stored) {
      console.log(`[TaskRunner] Bug fix completion stored to Mandrel`);
    }
    return stored;
  } catch (error) {
    console.warn('[TaskRunner] Failed to store completion to Mandrel:', error);
    return false;
  }
}
