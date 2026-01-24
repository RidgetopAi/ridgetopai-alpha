/**
 * Event Triggers API Client
 * Handles communication with the backend event trigger endpoints
 */

import type {
  EventTrigger,
  CreateEventTriggerRequest,
  UpdateEventTriggerRequest,
  EventTriggerStats,
  ListTriggersResponse,
  TriggerResponse,
  DeleteTriggerResponse,
  TriggerExecution,
} from '../types/event-triggers';

// Backend URL - configurable via env
const API_BASE = import.meta.env.VITE_API_URL || '';

/**
 * List all event triggers with stats
 */
export async function listEventTriggers(): Promise<ListTriggersResponse> {
  try {
    const response = await fetch(`${API_BASE}/api/triggers`);
    const data = await response.json();

    if (!response.ok) {
      return {
        triggers: [],
        stats: {
          totalTriggers: 0,
          activeTriggers: 0,
          pausedTriggers: 0,
          disabledTriggers: 0,
          bySource: {},
        },
      };
    }

    return data as ListTriggersResponse;
  } catch (error) {
    console.error('Failed to list event triggers:', error);
    return {
      triggers: [],
      stats: {
        totalTriggers: 0,
        activeTriggers: 0,
        pausedTriggers: 0,
        disabledTriggers: 0,
        bySource: {},
      },
    };
  }
}

/**
 * Get event trigger statistics
 */
export async function getEventTriggerStats(): Promise<EventTriggerStats> {
  try {
    const response = await fetch(`${API_BASE}/api/triggers/stats`);
    const data = await response.json();

    if (!response.ok) {
      return {
        totalTriggers: 0,
        activeTriggers: 0,
        pausedTriggers: 0,
        disabledTriggers: 0,
        bySource: {},
      };
    }

    return data as EventTriggerStats;
  } catch (error) {
    console.error('Failed to get trigger stats:', error);
    return {
      totalTriggers: 0,
      activeTriggers: 0,
      pausedTriggers: 0,
      disabledTriggers: 0,
      bySource: {},
    };
  }
}

/**
 * Get recent trigger executions
 */
export async function getRecentExecutions(limit = 50): Promise<TriggerExecution[]> {
  try {
    const response = await fetch(`${API_BASE}/api/triggers/executions?limit=${limit}`);
    const data = await response.json();

    if (!response.ok) {
      return [];
    }

    return data as TriggerExecution[];
  } catch (error) {
    console.error('Failed to get recent executions:', error);
    return [];
  }
}

/**
 * Get a specific event trigger
 */
export async function getEventTrigger(id: string): Promise<TriggerResponse> {
  try {
    const response = await fetch(`${API_BASE}/api/triggers/${id}`);
    const data = await response.json();

    if (!response.ok) {
      return {
        success: false,
        error: data.error || `HTTP ${response.status}`,
      };
    }

    return {
      success: true,
      trigger: data as EventTrigger,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Network error',
    };
  }
}

/**
 * Create a new event trigger
 */
export async function createEventTrigger(
  request: CreateEventTriggerRequest
): Promise<TriggerResponse> {
  try {
    const response = await fetch(`${API_BASE}/api/triggers`, {
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

    return {
      success: true,
      trigger: data as EventTrigger,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Network error',
    };
  }
}

/**
 * Update an event trigger
 */
export async function updateEventTrigger(
  id: string,
  updates: UpdateEventTriggerRequest
): Promise<TriggerResponse> {
  try {
    const response = await fetch(`${API_BASE}/api/triggers/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });

    const data = await response.json();

    if (!response.ok) {
      return {
        success: false,
        error: data.error || `HTTP ${response.status}`,
      };
    }

    return {
      success: true,
      trigger: data as EventTrigger,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Network error',
    };
  }
}

/**
 * Delete an event trigger
 */
export async function deleteEventTrigger(id: string): Promise<DeleteTriggerResponse> {
  try {
    const response = await fetch(`${API_BASE}/api/triggers/${id}`, {
      method: 'DELETE',
    });

    const data = await response.json();

    if (!response.ok) {
      return {
        success: false,
        error: data.error || `HTTP ${response.status}`,
      };
    }

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Network error',
    };
  }
}
