/**
 * TaskRunner API Client
 * Instance 10 - Connects UI to TaskRunner backend
 * Instance 11b - Added implementation phase support
 */

import type { BugReport, BugAnalysis, CodeChange, Implementation } from '../types/workflow';

const API_BASE_URL = import.meta.env.VITE_TASKRUNNER_URL || 'http://localhost:3001';

export interface BugFixResponse {
  success: boolean;
  workflowId: string;
  analysis?: BugAnalysis;
  error?: string;
  durationMs?: number;
}

export interface HealthResponse {
  status: string;
  timestamp: string;
  claudeAvailable: boolean;
}

/**
 * Check if TaskRunner backend is healthy
 */
export async function checkHealth(): Promise<HealthResponse> {
  const response = await fetch(`${API_BASE_URL}/health`);

  if (!response.ok) {
    throw new Error(`Health check failed: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Execute bug fix analysis via TaskRunner
 */
export async function executeBugFix(
  workflowId: string,
  bugReport: BugReport,
  projectPath?: string
): Promise<BugFixResponse> {
  const response = await fetch(`${API_BASE_URL}/api/workflow/bugfix`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      workflowId,
      bugReport,
      projectPath,
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    return {
      success: false,
      workflowId,
      error: data.error || `Request failed: ${response.statusText}`,
    };
  }

  return data;
}

/**
 * Get workflow status from TaskRunner
 */
export async function getWorkflowStatus(workflowId: string): Promise<{
  status: string;
  message?: string;
  result?: BugAnalysis;
}> {
  const response = await fetch(`${API_BASE_URL}/api/workflow/${workflowId}`);

  if (!response.ok) {
    if (response.status === 404) {
      return { status: 'not_found' };
    }
    throw new Error(`Failed to get workflow status: ${response.statusText}`);
  }

  return response.json();
}

// Implementation response from backend
export interface ImplementResponse {
  success: boolean;
  workflowId: string;
  implementation?: {
    success: boolean;
    changedFiles: string[];
    testResults?: {
      passed: number;
      failed: number;
      skipped: number;
      duration: number;
      output?: string;
    };
    warnings: string[];
    errors: string[];
  };
  error?: string;
  durationMs?: number;
}

/**
 * Execute approved bug fix implementation via TaskRunner
 */
export async function executeImplementation(
  workflowId: string,
  approvedChanges: CodeChange[],
  projectPath?: string,
  runTests: boolean = true
): Promise<ImplementResponse> {
  const response = await fetch(`${API_BASE_URL}/api/workflow/bugfix/${workflowId}/implement`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      approvedChanges,
      projectPath,
      runTests,
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    return {
      success: false,
      workflowId,
      error: data.error || `Request failed: ${response.statusText}`,
      implementation: data.implementation,
    };
  }

  return data;
}

/**
 * Convert backend implementation response to UI Implementation type
 */
export function toImplementation(response: ImplementResponse): Implementation | null {
  if (!response.success || !response.implementation) {
    return null;
  }

  const impl = response.implementation;
  return {
    changedFiles: impl.changedFiles,
    testResults: impl.testResults ? {
      passed: impl.testResults.passed,
      failed: impl.testResults.failed,
      skipped: impl.testResults.skipped,
      duration: impl.testResults.duration,
    } : {
      passed: 0,
      failed: 0,
      skipped: 0,
    },
    warnings: impl.warnings,
    completedAt: new Date(),
  };
}
