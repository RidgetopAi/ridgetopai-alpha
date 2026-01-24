/**
 * Scheduler API Client
 * Handles communication with the backend scheduler endpoints
 */

import type {
  ScheduledTask,
  CreateScheduleRequest,
  UpdateScheduleRequest,
  SchedulerStats,
  ListSchedulesResponse,
  ScheduleResponse,
  DeleteScheduleResponse,
  TriggerScheduleResponse,
} from '../types/scheduler';

// Backend URL - configurable via env
const API_BASE = import.meta.env.VITE_API_URL || '';

/**
 * List all scheduled tasks with stats
 */
export async function listSchedules(): Promise<ListSchedulesResponse> {
  try {
    const response = await fetch(`${API_BASE}/api/schedules`);
    const data = await response.json();

    if (!response.ok) {
      return {
        schedules: [],
        stats: {
          totalTasks: 0,
          activeTasks: 0,
          pausedTasks: 0,
          disabledTasks: 0,
          runningJobs: 0,
        },
      };
    }

    return data as ListSchedulesResponse;
  } catch (error) {
    console.error('Failed to list schedules:', error);
    return {
      schedules: [],
      stats: {
        totalTasks: 0,
        activeTasks: 0,
        pausedTasks: 0,
        disabledTasks: 0,
        runningJobs: 0,
      },
    };
  }
}

/**
 * Get scheduler statistics
 */
export async function getSchedulerStats(): Promise<SchedulerStats> {
  try {
    const response = await fetch(`${API_BASE}/api/schedules/stats`);
    const data = await response.json();

    if (!response.ok) {
      return {
        totalTasks: 0,
        activeTasks: 0,
        pausedTasks: 0,
        disabledTasks: 0,
        runningJobs: 0,
      };
    }

    return data as SchedulerStats;
  } catch (error) {
    console.error('Failed to get scheduler stats:', error);
    return {
      totalTasks: 0,
      activeTasks: 0,
      pausedTasks: 0,
      disabledTasks: 0,
      runningJobs: 0,
    };
  }
}

/**
 * Get a specific scheduled task
 */
export async function getSchedule(id: string): Promise<ScheduleResponse> {
  try {
    const response = await fetch(`${API_BASE}/api/schedules/${id}`);
    const data = await response.json();

    if (!response.ok) {
      return {
        success: false,
        error: data.error || `HTTP ${response.status}`,
      };
    }

    return {
      success: true,
      schedule: data as ScheduledTask,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Network error',
    };
  }
}

/**
 * Create a new scheduled task
 */
export async function createSchedule(
  request: CreateScheduleRequest
): Promise<ScheduleResponse> {
  try {
    const response = await fetch(`${API_BASE}/api/schedules`, {
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
      schedule: data as ScheduledTask,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Network error',
    };
  }
}

/**
 * Update a scheduled task
 */
export async function updateSchedule(
  id: string,
  updates: UpdateScheduleRequest
): Promise<ScheduleResponse> {
  try {
    const response = await fetch(`${API_BASE}/api/schedules/${id}`, {
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
      schedule: data as ScheduledTask,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Network error',
    };
  }
}

/**
 * Delete a scheduled task
 */
export async function deleteSchedule(id: string): Promise<DeleteScheduleResponse> {
  try {
    const response = await fetch(`${API_BASE}/api/schedules/${id}`, {
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

/**
 * Manually trigger a scheduled task
 */
export async function triggerSchedule(id: string): Promise<TriggerScheduleResponse> {
  try {
    const response = await fetch(`${API_BASE}/api/schedules/${id}/trigger`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });

    const data = await response.json();

    if (!response.ok) {
      return {
        triggerId: id,
        triggerName: 'unknown',
        success: false,
        error: data.error || `HTTP ${response.status}`,
        executedAt: new Date().toISOString(),
      };
    }

    return data as TriggerScheduleResponse;
  } catch (error) {
    return {
      triggerId: id,
      triggerName: 'unknown',
      success: false,
      error: error instanceof Error ? error.message : 'Network error',
      executedAt: new Date().toISOString(),
    };
  }
}
