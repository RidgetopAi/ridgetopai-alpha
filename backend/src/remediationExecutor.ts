/**
 * RemediationExecutor - Execute remediation actions with safety controls
 * Instance 6 (SIRK Bugfix Run) - SAFETY CRITICAL MODULE
 *
 * Design principles:
 * - DRY-RUN MODE: Always preview what would happen before executing
 * - APPROVAL GATES: Require explicit user confirmation for each action
 * - STEP-BY-STEP: Execute one step at a time with confirmation
 * - AUDIT LOGGING: Log everything to console and Mandrel
 * - ROLLBACK READY: Keep track of what was done for potential rollback
 */

import { spawn } from 'child_process';
import type { AlertAnalysis, RemediationActionType } from './types.js';

export interface RemediationStep {
  index: number;
  description: string;
  command?: string;  // Shell command if applicable
  status: 'pending' | 'dry_run' | 'approved' | 'executing' | 'completed' | 'failed' | 'skipped';
  dryRunOutput?: string;
  executionOutput?: string;
  error?: string;
  startedAt?: Date;
  completedAt?: Date;
}

export interface RemediationExecution {
  workflowId: string;
  type: RemediationActionType;
  description: string;
  steps: RemediationStep[];
  mode: 'dry_run' | 'step_by_step' | 'full';
  status: 'pending' | 'dry_running' | 'awaiting_approval' | 'executing' | 'completed' | 'failed' | 'cancelled';
  currentStepIndex: number;
  startedAt: Date;
  completedAt?: Date;
  approvedBy?: string;
  notes?: string;
}

// In-memory store for active remediations
const activeRemediations = new Map<string, RemediationExecution>();

/**
 * Parse remediation steps from analysis into executable commands
 * Maps natural language steps to shell commands where applicable
 */
function parseStepsToCommands(
  type: RemediationActionType,
  steps: string[],
  affectedService?: string
): RemediationStep[] {
  return steps.map((description, index) => {
    const step: RemediationStep = {
      index,
      description,
      status: 'pending',
    };

    // Extract commands from step descriptions
    // Look for patterns like "Run: ..." or commands in backticks
    const commandMatch = description.match(/`([^`]+)`/) ||
                         description.match(/Run:?\s*(.+)/i) ||
                         description.match(/Execute:?\s*(.+)/i);

    if (commandMatch) {
      step.command = commandMatch[1].trim();
    } else {
      // Generate commands based on remediation type and context
      step.command = generateCommandForStep(type, description, affectedService);
    }

    return step;
  });
}

/**
 * Generate shell commands based on remediation type and step description
 * Returns undefined for steps that can't be automated
 */
function generateCommandForStep(
  type: RemediationActionType,
  description: string,
  affectedService?: string
): string | undefined {
  const descLower = description.toLowerCase();
  const service = affectedService || 'unknown-service';

  // Restart-related commands
  if (type === 'restart') {
    if (descLower.includes('restart') && descLower.includes('service')) {
      if (descLower.includes('systemd') || descLower.includes('systemctl')) {
        return `systemctl restart ${service}`;
      }
      if (descLower.includes('docker')) {
        return `docker restart ${service}`;
      }
      if (descLower.includes('pm2')) {
        return `pm2 restart ${service}`;
      }
    }
    if (descLower.includes('graceful')) {
      return `systemctl reload-or-restart ${service}`;
    }
  }

  // Scale-related commands
  if (type === 'scale') {
    const scaleMatch = descLower.match(/scale.+?(\d+)/);
    if (scaleMatch) {
      const replicas = scaleMatch[1];
      if (descLower.includes('kubernetes') || descLower.includes('k8s')) {
        return `kubectl scale deployment ${service} --replicas=${replicas}`;
      }
      if (descLower.includes('docker') && descLower.includes('swarm')) {
        return `docker service scale ${service}=${replicas}`;
      }
    }
  }

  // Rollback-related commands
  if (type === 'rollback') {
    if (descLower.includes('git') && descLower.includes('revert')) {
      return `git revert HEAD --no-edit`;
    }
    if (descLower.includes('kubernetes') || descLower.includes('k8s')) {
      return `kubectl rollout undo deployment/${service}`;
    }
    if (descLower.includes('docker')) {
      return `docker rollback ${service}`;
    }
  }

  // Investigation-related - these are typically non-destructive
  if (type === 'investigate') {
    if (descLower.includes('log') && descLower.includes('check')) {
      return `journalctl -u ${service} -n 50 --no-pager`;
    }
    if (descLower.includes('status')) {
      return `systemctl status ${service}`;
    }
    if (descLower.includes('disk') || descLower.includes('space')) {
      return 'df -h';
    }
    if (descLower.includes('memory') || descLower.includes('ram')) {
      return 'free -h';
    }
    if (descLower.includes('process') || descLower.includes('cpu')) {
      return `top -b -n 1 | head -20`;
    }
  }

  // Notify-related - no automated commands, these are manual
  if (type === 'notify') {
    return undefined;  // Notifications require manual action
  }

  return undefined;  // Step cannot be automated
}

/**
 * Execute a command in dry-run mode
 * For most commands, this shows what WOULD happen without actually doing it
 */
async function executeDryRun(command: string): Promise<{ output: string; wouldSucceed: boolean }> {
  console.log(`[RemediationExecutor] Dry-run: ${command}`);

  // For dry-run, we analyze the command and predict its effect
  // Some commands have built-in dry-run flags we can use

  // Commands that are safe to actually run in dry-run (read-only)
  const safeCommands = [
    'systemctl status',
    'docker ps',
    'kubectl get',
    'journalctl',
    'df ',
    'free ',
    'top -b',
    'ps ',
    'cat ',
    'ls ',
  ];

  const isSafe = safeCommands.some(safe => command.includes(safe));

  if (isSafe) {
    // Actually run the command since it's read-only
    try {
      const output = await runCommand(command, 10000);  // 10s timeout for read-only
      return {
        output: `[LIVE OUTPUT]\n${output}`,
        wouldSucceed: true,
      };
    } catch (error) {
      return {
        output: `[WOULD FAIL]\n${error instanceof Error ? error.message : 'Unknown error'}`,
        wouldSucceed: false,
      };
    }
  }

  // For destructive commands, just describe what would happen
  const commandAnalysis = analyzeCommand(command);
  return {
    output: `[DRY-RUN PREVIEW]\nCommand: ${command}\n\n${commandAnalysis.description}\n\nRisk Level: ${commandAnalysis.risk}\nRollback: ${commandAnalysis.rollbackPossible ? 'Yes' : 'No - Manual recovery required'}`,
    wouldSucceed: commandAnalysis.wouldSucceed,
  };
}

/**
 * Analyze a command to describe what it would do
 */
function analyzeCommand(command: string): {
  description: string;
  risk: 'low' | 'medium' | 'high' | 'critical';
  rollbackPossible: boolean;
  wouldSucceed: boolean;
} {
  const cmdLower = command.toLowerCase();

  if (cmdLower.includes('systemctl restart')) {
    const service = command.split(' ').pop();
    return {
      description: `Would restart the ${service} systemd service.\nThis causes a brief service interruption while the process restarts.`,
      risk: 'medium',
      rollbackPossible: false,  // Can't un-restart, but service should come back up
      wouldSucceed: true,
    };
  }

  if (cmdLower.includes('docker restart')) {
    const container = command.split(' ').pop();
    return {
      description: `Would restart Docker container: ${container}\nContainer will stop and start with same configuration.`,
      risk: 'medium',
      rollbackPossible: false,
      wouldSucceed: true,
    };
  }

  if (cmdLower.includes('kubectl scale')) {
    const replicaMatch = command.match(/--replicas=(\d+)/);
    const replicas = replicaMatch ? replicaMatch[1] : 'N';
    return {
      description: `Would scale Kubernetes deployment to ${replicas} replicas.\nPods will be created/destroyed to match new replica count.`,
      risk: 'medium',
      rollbackPossible: true,
      wouldSucceed: true,
    };
  }

  if (cmdLower.includes('kubectl rollout undo')) {
    return {
      description: `Would rollback Kubernetes deployment to previous revision.\nCurrent pods will be replaced with previous version.`,
      risk: 'high',
      rollbackPossible: true,
      wouldSucceed: true,
    };
  }

  if (cmdLower.includes('git revert')) {
    return {
      description: `Would create a new commit that undoes the last commit.\nThis is safe and reversible.`,
      risk: 'low',
      rollbackPossible: true,
      wouldSucceed: true,
    };
  }

  if (cmdLower.includes('rm ') || cmdLower.includes('delete')) {
    return {
      description: `DESTRUCTIVE: Would delete files or resources.\nThis action may not be reversible!`,
      risk: 'critical',
      rollbackPossible: false,
      wouldSucceed: true,
    };
  }

  // Default for unknown commands
  return {
    description: `Would execute: ${command}\nEffect unknown - manual verification recommended.`,
    risk: 'medium',
    rollbackPossible: false,
    wouldSucceed: true,
  };
}

/**
 * Run a shell command with timeout
 */
async function runCommand(command: string, timeoutMs: number = 60000): Promise<string> {
  return new Promise((resolve, reject) => {
    let stdout = '';
    let stderr = '';
    let killed = false;

    const child = spawn('bash', ['-c', command], {
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    const timeout = setTimeout(() => {
      killed = true;
      child.kill('SIGTERM');
      setTimeout(() => {
        if (!child.killed) child.kill('SIGKILL');
      }, 5000);
    }, timeoutMs);

    child.stdout?.on('data', (data) => {
      stdout += data.toString();
    });

    child.stderr?.on('data', (data) => {
      stderr += data.toString();
    });

    child.on('error', (err) => {
      clearTimeout(timeout);
      reject(new Error(`Failed to execute: ${err.message}`));
    });

    child.on('close', (code) => {
      clearTimeout(timeout);
      if (killed) {
        reject(new Error('Command timed out'));
        return;
      }
      if (code !== 0) {
        reject(new Error(`Command failed (exit ${code}): ${stderr || stdout}`));
        return;
      }
      resolve(stdout);
    });
  });
}

/**
 * Start a new remediation execution
 */
export function startRemediation(
  workflowId: string,
  analysis: AlertAnalysis,
  mode: 'dry_run' | 'step_by_step' | 'full' = 'dry_run',
  notes?: string
): RemediationExecution {
  console.log(`[RemediationExecutor] Starting remediation for ${workflowId} in ${mode} mode`);

  const steps = parseStepsToCommands(
    analysis.suggestedRemediation.type,
    analysis.suggestedRemediation.steps,
    analysis.affectedSystems
  );

  const execution: RemediationExecution = {
    workflowId,
    type: analysis.suggestedRemediation.type,
    description: analysis.suggestedRemediation.description,
    steps,
    mode,
    status: 'pending',
    currentStepIndex: 0,
    startedAt: new Date(),
    notes,
  };

  activeRemediations.set(workflowId, execution);
  return execution;
}

/**
 * Run dry-run for all steps
 * Returns execution with dry-run outputs for each step
 */
export async function runDryRun(workflowId: string): Promise<RemediationExecution> {
  const execution = activeRemediations.get(workflowId);
  if (!execution) {
    throw new Error(`No remediation found for workflow ${workflowId}`);
  }

  console.log(`[RemediationExecutor] Running dry-run for ${workflowId}`);
  execution.status = 'dry_running';

  for (const step of execution.steps) {
    if (step.command) {
      try {
        const result = await executeDryRun(step.command);
        step.dryRunOutput = result.output;
        step.status = 'dry_run';
      } catch (error) {
        step.dryRunOutput = `Error: ${error instanceof Error ? error.message : 'Unknown error'}`;
        step.status = 'dry_run';
      }
    } else {
      step.dryRunOutput = '[MANUAL STEP]\nThis step requires manual action and cannot be automated.';
      step.status = 'dry_run';
    }
  }

  execution.status = 'awaiting_approval';
  activeRemediations.set(workflowId, execution);
  return execution;
}

/**
 * Approve and execute a specific step
 */
export async function executeStep(
  workflowId: string,
  stepIndex: number,
  approved: boolean,
  modifiedCommand?: string
): Promise<RemediationStep> {
  const execution = activeRemediations.get(workflowId);
  if (!execution) {
    throw new Error(`No remediation found for workflow ${workflowId}`);
  }

  const step = execution.steps[stepIndex];
  if (!step) {
    throw new Error(`Step ${stepIndex} not found`);
  }

  if (!approved) {
    step.status = 'skipped';
    console.log(`[RemediationExecutor] Step ${stepIndex} skipped by user`);
    return step;
  }

  const commandToRun = modifiedCommand || step.command;
  if (!commandToRun) {
    step.status = 'skipped';
    step.executionOutput = 'No command to execute (manual step)';
    return step;
  }

  step.status = 'executing';
  step.startedAt = new Date();
  console.log(`[RemediationExecutor] Executing step ${stepIndex}: ${commandToRun}`);

  try {
    const output = await runCommand(commandToRun, 120000);  // 2 minute timeout
    step.executionOutput = output;
    step.status = 'completed';
    step.completedAt = new Date();
    console.log(`[RemediationExecutor] Step ${stepIndex} completed successfully`);
  } catch (error) {
    step.error = error instanceof Error ? error.message : 'Unknown error';
    step.status = 'failed';
    step.completedAt = new Date();
    console.error(`[RemediationExecutor] Step ${stepIndex} failed: ${step.error}`);
  }

  // Update current step index
  execution.currentStepIndex = stepIndex + 1;

  // Check if all steps are done
  const allDone = execution.steps.every(
    s => s.status === 'completed' || s.status === 'failed' || s.status === 'skipped'
  );

  if (allDone) {
    execution.status = 'completed';
    execution.completedAt = new Date();
    console.log(`[RemediationExecutor] Remediation completed for ${workflowId}`);
  } else {
    execution.status = 'executing';
  }

  activeRemediations.set(workflowId, execution);
  return step;
}

/**
 * Execute all approved steps in sequence
 */
export async function executeAllSteps(workflowId: string): Promise<RemediationExecution> {
  const execution = activeRemediations.get(workflowId);
  if (!execution) {
    throw new Error(`No remediation found for workflow ${workflowId}`);
  }

  execution.status = 'executing';
  console.log(`[RemediationExecutor] Executing all steps for ${workflowId}`);

  for (let i = 0; i < execution.steps.length; i++) {
    const step = execution.steps[i];
    if (step.status !== 'approved') {
      continue;  // Skip non-approved steps
    }
    const executedStep = await executeStep(workflowId, i, true);

    // Stop if step failed and this isn't the last step
    if (executedStep.status === 'failed' && i < execution.steps.length - 1) {
      console.log(`[RemediationExecutor] Stopping execution due to failure at step ${i}`);
      break;
    }
  }

  return activeRemediations.get(workflowId)!;
}

/**
 * Cancel an in-progress remediation
 */
export function cancelRemediation(workflowId: string): RemediationExecution | undefined {
  const execution = activeRemediations.get(workflowId);
  if (!execution) {
    return undefined;
  }

  execution.status = 'cancelled';
  execution.completedAt = new Date();

  // Mark pending steps as skipped
  for (const step of execution.steps) {
    if (step.status === 'pending' || step.status === 'approved') {
      step.status = 'skipped';
    }
  }

  activeRemediations.set(workflowId, execution);
  console.log(`[RemediationExecutor] Remediation cancelled for ${workflowId}`);
  return execution;
}

/**
 * Get remediation status
 */
export function getRemediation(workflowId: string): RemediationExecution | undefined {
  return activeRemediations.get(workflowId);
}

/**
 * Approve steps for execution
 */
export function approveSteps(
  workflowId: string,
  stepIndices: number[],
  approvedBy: string
): RemediationExecution {
  const execution = activeRemediations.get(workflowId);
  if (!execution) {
    throw new Error(`No remediation found for workflow ${workflowId}`);
  }

  for (const index of stepIndices) {
    if (execution.steps[index]) {
      execution.steps[index].status = 'approved';
    }
  }

  execution.approvedBy = approvedBy;
  activeRemediations.set(workflowId, execution);
  console.log(`[RemediationExecutor] Steps ${stepIndices.join(', ')} approved by ${approvedBy}`);
  return execution;
}

/**
 * Generate remediation summary for Mandrel storage
 */
export function generateRemediationSummary(execution: RemediationExecution): string {
  const completedSteps = execution.steps.filter(s => s.status === 'completed');
  const failedSteps = execution.steps.filter(s => s.status === 'failed');
  const skippedSteps = execution.steps.filter(s => s.status === 'skipped');

  return `
## Remediation Execution Summary

**Workflow ID:** ${execution.workflowId}
**Type:** ${execution.type}
**Description:** ${execution.description}
**Mode:** ${execution.mode}
**Status:** ${execution.status}

### Execution Timeline
- Started: ${execution.startedAt.toISOString()}
${execution.completedAt ? `- Completed: ${execution.completedAt.toISOString()}` : '- In Progress'}
${execution.approvedBy ? `- Approved By: ${execution.approvedBy}` : ''}

### Steps Summary
- Total: ${execution.steps.length}
- Completed: ${completedSteps.length}
- Failed: ${failedSteps.length}
- Skipped: ${skippedSteps.length}

### Step Details
${execution.steps.map((step, i) => `
**Step ${i + 1}: ${step.description}**
- Status: ${step.status}
- Command: ${step.command || 'N/A (manual)'}
${step.executionOutput ? `- Output: ${step.executionOutput.substring(0, 200)}...` : ''}
${step.error ? `- Error: ${step.error}` : ''}
`).join('')}

${execution.notes ? `\n### Notes\n${execution.notes}` : ''}
`.trim();
}
