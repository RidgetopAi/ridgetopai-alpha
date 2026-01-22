/**
 * Monitoring Alert Runner API Client
 * Instance 21 - OPERATE capability
 */

import type { MonitoringAlert, AlertAnalysis } from '../types/monitoring-workflow';

const API_BASE_URL = import.meta.env.VITE_TASKRUNNER_URL || 'http://localhost:3001';

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
 */
export async function storeAlertToMandrel(
  workflowId: string,
  alert: MonitoringAlert,
  analysis: AlertAnalysis,
  remediation?: { action: string; notes?: string; executedAt: Date }
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
    }),
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
