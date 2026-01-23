/**
 * Strategic Layer API Client
 * Handles communication with the backend strategic endpoints
 * Phase 3: Goal Management
 * Phase 4: Recommendation Engine
 */

import type {
  // Goal types
  ListGoalsParams,
  ListGoalsResponse,
  GetGoalResponse,
  GoalStatsResponse,
  GoalHierarchyResponse,
  CreateGoalInput,
  CreateGoalResponse,
  UpdateGoalInput,
  UpdateGoalResponse,
  UpdateProgressResponse,
  DeleteGoalResponse,
  LinkPatternResponse,
  // Recommendation types
  ListRecommendationsParams,
  ListRecommendationsResponse,
  GetRecommendationResponse,
  RecommendationStatsResponse,
  GenerateRecommendationsParams,
  GenerateRecommendationsResponse,
  AcceptRecommendationParams,
  AcceptRecommendationResponse,
  RejectRecommendationParams,
  RejectRecommendationResponse,
  DeferRecommendationParams,
  DeferRecommendationResponse,
  GetFeedbackResponse,
  FeedbackStatsResponse,
} from '../types/strategic';

// Backend URL - configurable via env
const API_BASE = import.meta.env.VITE_API_URL || '';

// ============================================
// Goal Endpoints (Phase 3)
// ============================================

/**
 * List goals with optional filters
 */
export async function listGoals(params: ListGoalsParams = {}): Promise<ListGoalsResponse> {
  try {
    const searchParams = new URLSearchParams();
    if (params.status) {
      if (Array.isArray(params.status)) {
        params.status.forEach(s => searchParams.append('status', s));
      } else {
        searchParams.set('status', params.status);
      }
    }
    if (params.category) {
      if (Array.isArray(params.category)) {
        params.category.forEach(c => searchParams.append('category', c));
      } else {
        searchParams.set('category', params.category);
      }
    }
    if (params.priority) {
      if (Array.isArray(params.priority)) {
        params.priority.forEach(p => searchParams.append('priority', p));
      } else {
        searchParams.set('priority', params.priority);
      }
    }
    if (params.parentGoalId !== undefined) searchParams.set('parentGoalId', params.parentGoalId || '');
    if (params.hasParent !== undefined) searchParams.set('hasParent', String(params.hasParent));
    if (params.limit !== undefined) searchParams.set('limit', String(params.limit));
    if (params.offset !== undefined) searchParams.set('offset', String(params.offset));
    if (params.orderBy) searchParams.set('orderBy', params.orderBy);
    if (params.orderDir) searchParams.set('orderDir', params.orderDir);

    const url = `${API_BASE}/api/strategic/goals${searchParams.toString() ? '?' + searchParams.toString() : ''}`;
    const response = await fetch(url);
    const data = await response.json();

    if (!response.ok) {
      return {
        success: false,
        goals: [],
        total: 0,
        limit: 0,
        offset: 0,
        error: data.error || `HTTP ${response.status}`,
      };
    }

    return data as ListGoalsResponse;
  } catch (error) {
    return {
      success: false,
      goals: [],
      total: 0,
      limit: 0,
      offset: 0,
      error: error instanceof Error ? error.message : 'Network error',
    };
  }
}

/**
 * Get a single goal by ID
 */
export async function getGoal(id: string): Promise<GetGoalResponse> {
  try {
    const response = await fetch(`${API_BASE}/api/strategic/goals/${id}`);
    const data = await response.json();

    if (!response.ok) {
      return {
        success: false,
        error: data.error || `HTTP ${response.status}`,
      };
    }

    return data as GetGoalResponse;
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Network error',
    };
  }
}

/**
 * Get goal statistics
 */
export async function getGoalStats(): Promise<GoalStatsResponse> {
  try {
    const response = await fetch(`${API_BASE}/api/strategic/goals/stats`);
    const data = await response.json();

    if (!response.ok) {
      return {
        success: false,
        error: data.error || `HTTP ${response.status}`,
      };
    }

    return data as GoalStatsResponse;
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Network error',
    };
  }
}

/**
 * Get goal hierarchy (tree structure)
 */
export async function getGoalHierarchy(rootId?: string): Promise<GoalHierarchyResponse> {
  try {
    const url = rootId
      ? `${API_BASE}/api/strategic/goals/hierarchy?rootId=${rootId}`
      : `${API_BASE}/api/strategic/goals/hierarchy`;
    const response = await fetch(url);
    const data = await response.json();

    if (!response.ok) {
      return {
        success: false,
        hierarchy: [],
        error: data.error || `HTTP ${response.status}`,
      };
    }

    return data as GoalHierarchyResponse;
  } catch (error) {
    return {
      success: false,
      hierarchy: [],
      error: error instanceof Error ? error.message : 'Network error',
    };
  }
}

/**
 * Create a new goal
 */
export async function createGoal(input: CreateGoalInput): Promise<CreateGoalResponse> {
  try {
    const response = await fetch(`${API_BASE}/api/strategic/goals`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });

    const data = await response.json();

    if (!response.ok) {
      return {
        success: false,
        error: data.error || `HTTP ${response.status}`,
      };
    }

    return data as CreateGoalResponse;
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Network error',
    };
  }
}

/**
 * Update a goal
 */
export async function updateGoal(id: string, input: UpdateGoalInput): Promise<UpdateGoalResponse> {
  try {
    const response = await fetch(`${API_BASE}/api/strategic/goals/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });

    const data = await response.json();

    if (!response.ok) {
      return {
        success: false,
        error: data.error || `HTTP ${response.status}`,
      };
    }

    return data as UpdateGoalResponse;
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Network error',
    };
  }
}

/**
 * Update goal progress
 */
export async function updateGoalProgress(id: string, currentValue: number): Promise<UpdateProgressResponse> {
  try {
    const response = await fetch(`${API_BASE}/api/strategic/goals/${id}/progress`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ currentValue }),
    });

    const data = await response.json();

    if (!response.ok) {
      return {
        success: false,
        error: data.error || `HTTP ${response.status}`,
      };
    }

    return data as UpdateProgressResponse;
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Network error',
    };
  }
}

/**
 * Delete (abandon) a goal
 */
export async function deleteGoal(id: string, reason?: string): Promise<DeleteGoalResponse> {
  try {
    const url = reason
      ? `${API_BASE}/api/strategic/goals/${id}?reason=${encodeURIComponent(reason)}`
      : `${API_BASE}/api/strategic/goals/${id}`;
    const response = await fetch(url, { method: 'DELETE' });

    const data = await response.json();

    if (!response.ok) {
      return {
        success: false,
        error: data.error || `HTTP ${response.status}`,
      };
    }

    return data as DeleteGoalResponse;
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Network error',
    };
  }
}

/**
 * Link a pattern to a goal
 */
export async function linkPatternToGoal(goalId: string, patternId: string): Promise<LinkPatternResponse> {
  try {
    const response = await fetch(`${API_BASE}/api/strategic/goals/${goalId}/patterns/${patternId}`, {
      method: 'POST',
    });

    const data = await response.json();

    if (!response.ok) {
      return {
        success: false,
        error: data.error || `HTTP ${response.status}`,
      };
    }

    return data as LinkPatternResponse;
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Network error',
    };
  }
}

/**
 * Unlink a pattern from a goal
 */
export async function unlinkPatternFromGoal(goalId: string, patternId: string): Promise<LinkPatternResponse> {
  try {
    const response = await fetch(`${API_BASE}/api/strategic/goals/${goalId}/patterns/${patternId}`, {
      method: 'DELETE',
    });

    const data = await response.json();

    if (!response.ok) {
      return {
        success: false,
        error: data.error || `HTTP ${response.status}`,
      };
    }

    return data as LinkPatternResponse;
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Network error',
    };
  }
}

// ============================================
// Recommendation Endpoints (Phase 4)
// ============================================

/**
 * List recommendations with optional filters
 */
export async function listRecommendations(
  params: ListRecommendationsParams = {}
): Promise<ListRecommendationsResponse> {
  try {
    const searchParams = new URLSearchParams();
    if (params.status) searchParams.set('status', params.status);
    if (params.priority) searchParams.set('priority', params.priority);
    if (params.type) searchParams.set('type', params.type);
    if (params.minConfidence !== undefined) searchParams.set('minConfidence', String(params.minConfidence));
    if (params.limit !== undefined) searchParams.set('limit', String(params.limit));
    if (params.offset !== undefined) searchParams.set('offset', String(params.offset));
    if (params.orderBy) searchParams.set('orderBy', params.orderBy);
    if (params.orderDir) searchParams.set('orderDir', params.orderDir);

    const url = `${API_BASE}/api/strategic/recommendations${searchParams.toString() ? '?' + searchParams.toString() : ''}`;
    const response = await fetch(url);
    const data = await response.json();

    if (!response.ok) {
      return {
        success: false,
        recommendations: [],
        count: 0,
        error: data.error || `HTTP ${response.status}`,
      };
    }

    return data as ListRecommendationsResponse;
  } catch (error) {
    return {
      success: false,
      recommendations: [],
      count: 0,
      error: error instanceof Error ? error.message : 'Network error',
    };
  }
}

/**
 * Get pending recommendations (priority-ordered)
 */
export async function getPendingRecommendations(
  limit: number = 20
): Promise<ListRecommendationsResponse> {
  try {
    const response = await fetch(`${API_BASE}/api/strategic/recommendations/pending?limit=${limit}`);
    const data = await response.json();

    if (!response.ok) {
      return {
        success: false,
        recommendations: [],
        count: 0,
        error: data.error || `HTTP ${response.status}`,
      };
    }

    return data as ListRecommendationsResponse;
  } catch (error) {
    return {
      success: false,
      recommendations: [],
      count: 0,
      error: error instanceof Error ? error.message : 'Network error',
    };
  }
}

/**
 * Get recommendations expiring soon
 */
export async function getExpiringRecommendations(
  withinHours: number = 24
): Promise<ListRecommendationsResponse> {
  try {
    const response = await fetch(`${API_BASE}/api/strategic/recommendations/expiring?hours=${withinHours}`);
    const data = await response.json();

    if (!response.ok) {
      return {
        success: false,
        recommendations: [],
        count: 0,
        error: data.error || `HTTP ${response.status}`,
      };
    }

    return data as ListRecommendationsResponse;
  } catch (error) {
    return {
      success: false,
      recommendations: [],
      count: 0,
      error: error instanceof Error ? error.message : 'Network error',
    };
  }
}

/**
 * Get a single recommendation by ID
 */
export async function getRecommendation(id: string): Promise<GetRecommendationResponse> {
  try {
    const response = await fetch(`${API_BASE}/api/strategic/recommendations/${id}`);
    const data = await response.json();

    if (!response.ok) {
      return {
        success: false,
        error: data.error || `HTTP ${response.status}`,
      };
    }

    return data as GetRecommendationResponse;
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Network error',
    };
  }
}

/**
 * Get recommendation statistics
 */
export async function getRecommendationStats(): Promise<RecommendationStatsResponse> {
  try {
    const response = await fetch(`${API_BASE}/api/strategic/recommendations/stats`);
    const data = await response.json();

    if (!response.ok) {
      return {
        success: false,
        error: data.error || `HTTP ${response.status}`,
      };
    }

    return data as RecommendationStatsResponse;
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Network error',
    };
  }
}

/**
 * Manually trigger recommendation generation
 */
export async function generateRecommendations(
  params: GenerateRecommendationsParams = {}
): Promise<GenerateRecommendationsResponse> {
  try {
    const response = await fetch(`${API_BASE}/api/strategic/recommendations/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });

    const data = await response.json();

    if (!response.ok) {
      return {
        success: false,
        error: data.error || `HTTP ${response.status}`,
      };
    }

    return data as GenerateRecommendationsResponse;
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Network error',
    };
  }
}

/**
 * Accept a recommendation
 */
export async function acceptRecommendation(
  id: string,
  params: AcceptRecommendationParams = {}
): Promise<AcceptRecommendationResponse> {
  try {
    const response = await fetch(`${API_BASE}/api/strategic/recommendations/${id}/accept`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });

    const data = await response.json();

    if (!response.ok) {
      return {
        success: false,
        error: data.error || `HTTP ${response.status}`,
      };
    }

    return data as AcceptRecommendationResponse;
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Network error',
    };
  }
}

/**
 * Reject a recommendation
 */
export async function rejectRecommendation(
  id: string,
  params: RejectRecommendationParams = {}
): Promise<RejectRecommendationResponse> {
  try {
    const response = await fetch(`${API_BASE}/api/strategic/recommendations/${id}/reject`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });

    const data = await response.json();

    if (!response.ok) {
      return {
        success: false,
        error: data.error || `HTTP ${response.status}`,
      };
    }

    return data as RejectRecommendationResponse;
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Network error',
    };
  }
}

/**
 * Defer a recommendation
 */
export async function deferRecommendation(
  id: string,
  params: DeferRecommendationParams
): Promise<DeferRecommendationResponse> {
  try {
    const response = await fetch(`${API_BASE}/api/strategic/recommendations/${id}/defer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });

    const data = await response.json();

    if (!response.ok) {
      return {
        success: false,
        error: data.error || `HTTP ${response.status}`,
      };
    }

    return data as DeferRecommendationResponse;
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Network error',
    };
  }
}

/**
 * Get feedback for a recommendation
 */
export async function getRecommendationFeedback(id: string): Promise<GetFeedbackResponse> {
  try {
    const response = await fetch(`${API_BASE}/api/strategic/recommendations/${id}/feedback`);
    const data = await response.json();

    if (!response.ok) {
      return {
        success: false,
        feedback: [],
        error: data.error || `HTTP ${response.status}`,
      };
    }

    return data as GetFeedbackResponse;
  } catch (error) {
    return {
      success: false,
      feedback: [],
      error: error instanceof Error ? error.message : 'Network error',
    };
  }
}

/**
 * Get feedback statistics
 */
export async function getFeedbackStats(): Promise<FeedbackStatsResponse> {
  try {
    const response = await fetch(`${API_BASE}/api/strategic/feedback/stats`);
    const data = await response.json();

    if (!response.ok) {
      return {
        success: false,
        error: data.error || `HTTP ${response.status}`,
      };
    }

    return data as FeedbackStatsResponse;
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Network error',
    };
  }
}
