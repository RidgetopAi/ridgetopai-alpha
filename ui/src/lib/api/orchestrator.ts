/**
 * Orchestrator API Client
 * Handles communication with the backend orchestration endpoints
 */

import type {
  CreateSessionRequest,
  CreateSessionResponse,
  GetSessionResponse,
  ExecuteResponse,
  ListSessionsResponse,
} from '../types/orchestration';

// Backend URL - configurable via env
const API_BASE = import.meta.env.VITE_API_URL || '';

/**
 * Create a new orchestration session
 * Sends intent to backend, Claude analyzes and generates tasks
 */
export async function createOrchestrationSession(
  request: CreateSessionRequest
): Promise<CreateSessionResponse> {
  try {
    const response = await fetch(`${API_BASE}/api/orchestrate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    });

    const data = await response.json();

    if (!response.ok) {
      return {
        success: false,
        error: data.error || `HTTP ${response.status}`,
      };
    }

    return data as CreateSessionResponse;
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Network error',
    };
  }
}

/**
 * Get orchestration session status
 */
export async function getOrchestrationSession(
  sessionId: string
): Promise<GetSessionResponse> {
  try {
    const response = await fetch(`${API_BASE}/api/orchestrate/${sessionId}`);
    const data = await response.json();

    if (!response.ok) {
      return {
        success: false,
        error: data.error || `HTTP ${response.status}`,
      };
    }

    return data as GetSessionResponse;
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Network error',
    };
  }
}

/**
 * Execute all pending tasks in a session
 */
export async function executeOrchestrationTasks(
  sessionId: string
): Promise<ExecuteResponse> {
  try {
    const response = await fetch(`${API_BASE}/api/orchestrate/${sessionId}/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });

    const data = await response.json();

    if (!response.ok) {
      return {
        success: false,
        error: data.error || `HTTP ${response.status}`,
      };
    }

    return data as ExecuteResponse;
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Network error',
    };
  }
}

/**
 * List all orchestration sessions
 */
export async function listOrchestrationSessions(): Promise<ListSessionsResponse> {
  try {
    const response = await fetch(`${API_BASE}/api/orchestrate`);
    const data = await response.json();

    if (!response.ok) {
      return {
        success: false,
        count: 0,
        sessions: [],
      };
    }

    return data as ListSessionsResponse;
  } catch (error) {
    console.error('Failed to list sessions:', error);
    return {
      success: false,
      count: 0,
      sessions: [],
    };
  }
}

/**
 * Poll session status until completion or failure
 */
export async function pollSessionUntilComplete(
  sessionId: string,
  onUpdate: (session: GetSessionResponse['session']) => void,
  intervalMs: number = 2000,
  maxAttempts: number = 60
): Promise<GetSessionResponse> {
  let attempts = 0;

  return new Promise((resolve, reject) => {
    const poll = async () => {
      attempts++;

      const response = await getOrchestrationSession(sessionId);

      if (!response.success || !response.session) {
        reject(new Error(response.error || 'Failed to get session'));
        return;
      }

      onUpdate(response.session);

      // Check if all tasks are done
      const { execution } = response.session;
      const allDone = execution.pending === 0 && execution.running === 0;

      if (allDone || attempts >= maxAttempts) {
        resolve(response);
        return;
      }

      // Continue polling
      setTimeout(poll, intervalMs);
    };

    poll();
  });
}
