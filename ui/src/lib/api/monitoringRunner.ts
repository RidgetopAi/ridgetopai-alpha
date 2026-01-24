/**
 * Monitoring Alert Runner API Client
 * Instance 21 - OPERATE capability
 */

import type { MonitoringAlert, AlertAnalysis } from '../types/monitoring-workflow';

const API_BASE_URL = import.meta.env.VITE_TASKRUNNER_URL || '';

interface AnalyzeAlertResponse {
  success: boolean;
  workflowId: string;
  analysis?: AlertAnalysis;
  error?: string;
  durationMs?: number;
}

interface AlertStatusResponse {
  workflowId: string;
  status: string;
  message?: string;
  progress?: number;
  result?: AlertAnalysis;
}

interface RemediateAlertResponse {
  success: boolean;
  workflowId: string;
  action: string;
  message: string;
  remediatedAt?: string;
  error?: string;
}

interface StoreMandrelResponse {
  success: boolean;
  workflowId: string;
  message: string;
}

/**
 * Submit a monitoring alert for AI analysis
 */
export async function analyzeAlert(
  workflowId: string,
  alert: MonitoringAlert,
  projectPath?: string
): Promise<AnalyzeAlertResponse> {
  const response = await fetch(`${API_BASE_URL}/api/workflow/alert`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      workflowId,
      alert,
      projectPath,
    }),
  });

  const data = await response.json();
  return data;
}

/**
 * Get the status of an alert workflow
 */
export async function getAlertStatus(workflowId: string): Promise<AlertStatusResponse> {
  const response = await fetch(`${API_BASE_URL}/api/workflow/alert/${workflowId}`);
  const data = await response.json();
  return data;
}

/**
 * Execute remediation for an alert
 */
export async function executeRemediation(
  workflowId: string,
  action: 'execute' | 'dismiss' | 'escalate',
  notes?: string,
  modifiedSteps?: string[]
): Promise<RemediateAlertResponse> {
  const response = await fetch(`${API_BASE_URL}/api/workflow/alert/${workflowId}/remediate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      action,
      notes,
      modifiedSteps,
    }),
  });

  const data = await response.json();
  return data;
}

/**
 * Store alert completion to Mandrel
 * Instance 10 (bugfix-run) - Added projectName parameter
 */
export async function storeAlertToMandrel(
  workflowId: string,
  alert: MonitoringAlert,
  analysis: AlertAnalysis,
  remediation?: { action: string; notes?: string; executedAt: Date },
  projectName?: string
): Promise<StoreMandrelResponse> {
  const response = await fetch(`${API_BASE_URL}/api/mandrel/alert/${workflowId}/complete`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      alert,
      analysis,
      remediation,
      projectName,
    }),
  });

  const data = await response.json();
  return data;
}

// =========================================
// Remediation Execution API (Instance 6-7)
// Step-by-step remediation with safety controls
// =========================================

/**
 * Remediation step from backend
 */
export interface RemediationStep {
  index: number;
  description: string;
  command?: string;
  status: 'pending' | 'dry_run' | 'approved' | 'executing' | 'completed' | 'failed' | 'skipped';
  dryRunOutput?: string;
  executionOutput?: string;
  error?: string;
  startedAt?: Date;
  completedAt?: Date;
}

/**
 * Remediation execution state from backend
 */
export interface RemediationExecution {
  workflowId: string;
  type: string;
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

interface RemediationStatusResponse {
  success: boolean;
  workflowId: string;
  execution?: RemediationExecution;
  error?: string;
}

// RemediationDryRunResponse used for POST /remediate response (dry-run mode)
// Currently handled by RemediationStatusResponse since structure is similar

/**
 * Get remediation status (dry-run results, step statuses)
 */
export async function getRemediationStatus(
  workflowId: string
): Promise<RemediationStatusResponse> {
  const response = await fetch(`${API_BASE_URL}/api/workflow/alert/${workflowId}/remediate`);
  const data = await response.json();
  return data;
}

/**
 * Approve remediation steps for execution
 */
export async function approveRemediationSteps(
  workflowId: string,
  stepIndices: number[],
  approvedBy: string = 'user'
): Promise<RemediationStatusResponse> {
  const response = await fetch(`${API_BASE_URL}/api/workflow/alert/${workflowId}/remediate/approve`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      stepIndices,
      approvedBy,
    }),
  });

  const data = await response.json();
  return data;
}

/**
 * Execute a specific remediation step
 */
export async function executeRemediationStep(
  workflowId: string,
  stepIndex: number,
  approved: boolean = true,
  modifiedCommand?: string
): Promise<{ success: boolean; step?: RemediationStep; error?: string }> {
  const response = await fetch(`${API_BASE_URL}/api/workflow/alert/${workflowId}/remediate/step/${stepIndex}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      approved,
      modifiedCommand,
    }),
  });

  const data = await response.json();
  return data;
}

/**
 * Execute all approved remediation steps
 */
export async function executeAllRemediationSteps(
  workflowId: string
): Promise<RemediationStatusResponse> {
  const response = await fetch(`${API_BASE_URL}/api/workflow/alert/${workflowId}/remediate/execute-all`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  const data = await response.json();
  return data;
}

/**
 * Cancel an in-progress remediation
 */
export async function cancelRemediation(
  workflowId: string
): Promise<RemediationStatusResponse> {
  const response = await fetch(`${API_BASE_URL}/api/workflow/alert/${workflowId}/remediate/cancel`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  const data = await response.json();
  return data;
}

/**
 * Poll for alert status until completion or failure
 */
export async function pollAlertUntilComplete(
  workflowId: string,
  onProgress?: (status: AlertStatusResponse) => void,
  intervalMs: number = 2000,
  timeoutMs: number = 300000
): Promise<AlertStatusResponse> {
  const startTime = Date.now();

  return new Promise((resolve, reject) => {
    const poll = async () => {
      try {
        const status = await getAlertStatus(workflowId);

        if (onProgress) {
          onProgress(status);
        }

        if (status.status === 'completed' || status.status === 'failed') {
          resolve(status);
          return;
        }

        if (Date.now() - startTime > timeoutMs) {
          reject(new Error('Polling timeout exceeded'));
          return;
        }

        setTimeout(poll, intervalMs);
      } catch (error) {
        reject(error);
      }
    };

    poll();
  });
}
