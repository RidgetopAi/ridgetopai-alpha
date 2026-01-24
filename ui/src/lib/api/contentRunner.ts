/**
 * ContentRunner API Client
 * Instance 12 - Connects UI to Content Generation backend (GROW capability)
 */

import type {
  ContentBrief,
  ContentGeneration,
  ContentRefinement,
  GeneratedContent,
} from '../types/content-workflow';

const API_BASE_URL = import.meta.env.VITE_TASKRUNNER_URL || '';

export interface ContentGenerationResponse {
  success: boolean;
  workflowId: string;
  generation?: {
    content: GeneratedContent;
    confidence: 'high' | 'medium' | 'low';
    suggestions?: string[];
    alternatives?: {
      title: string;
      approach: string;
    }[];
    rawOutput?: string;
  };
  error?: string;
  durationMs?: number;
}

export interface ContentRefinementResponse {
  success: boolean;
  workflowId: string;
  refinement?: {
    content: GeneratedContent;
    changesApplied: string[];
    rawOutput?: string;
  };
  error?: string;
  durationMs?: number;
}

export interface ContentWorkflowStatusResponse {
  workflowId: string;
  status: 'generating' | 'refining' | 'completed' | 'failed';
  message?: string;
  progress?: number;
  result?: ContentGenerationResponse['generation'];
}

/**
 * Execute content generation via TaskRunner
 */
export async function executeContentGeneration(
  workflowId: string,
  brief: ContentBrief,
  brandContext?: string
): Promise<ContentGenerationResponse> {
  const response = await fetch(`${API_BASE_URL}/api/workflow/content`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      workflowId,
      brief,
      brandContext,
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
 * Execute content refinement via TaskRunner
 */
export async function executeContentRefinement(
  workflowId: string,
  originalContent: GeneratedContent,
  feedback: string,
  specificEdits?: string[]
): Promise<ContentRefinementResponse> {
  const response = await fetch(`${API_BASE_URL}/api/workflow/content/${workflowId}/refine`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      originalContent,
      feedback,
      specificEdits,
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
 * Get content workflow status from TaskRunner
 */
export async function getContentWorkflowStatus(
  workflowId: string
): Promise<ContentWorkflowStatusResponse | { status: 'not_found' }> {
  const response = await fetch(`${API_BASE_URL}/api/workflow/content/${workflowId}`);

  if (!response.ok) {
    if (response.status === 404) {
      return { status: 'not_found' };
    }
    throw new Error(`Failed to get workflow status: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Convert backend generation response to UI ContentGeneration type
 */
export function toContentGeneration(response: ContentGenerationResponse): ContentGeneration | null {
  if (!response.success || !response.generation) {
    return null;
  }

  const gen = response.generation;
  return {
    content: gen.content,
    confidence: gen.confidence,
    suggestions: gen.suggestions,
    alternatives: gen.alternatives,
    generatedAt: new Date(),
  };
}

/**
 * Convert backend refinement response to UI ContentRefinement type
 */
export function toContentRefinement(
  response: ContentRefinementResponse,
  version: number
): ContentRefinement | null {
  if (!response.success || !response.refinement) {
    return null;
  }

  const ref = response.refinement;
  return {
    originalVersion: version,
    content: ref.content,
    changesApplied: ref.changesApplied,
    refinedAt: new Date(),
  };
}

export interface ContentCompletionResponse {
  success: boolean;
  workflowId: string;
  message?: string;
  error?: string;
}

/**
 * Store content completion to Mandrel for institutional memory
 * Instance 2 - Wire Content Workflow to Mandrel (audit fix)
 * Instance 10 (bugfix-run) - Added projectName parameter
 */
export async function storeContentCompletion(
  workflowId: string,
  brief: ContentBrief,
  generation: ContentGeneration,
  review?: { decision: 'approved' | 'rejected' | 'needs_revision'; feedback?: string },
  projectName?: string
): Promise<ContentCompletionResponse> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/mandrel/content/${workflowId}/complete`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        brief,
        generation: {
          content: generation.content,
          confidence: generation.confidence,
          suggestions: generation.suggestions,
          alternatives: generation.alternatives,
        },
        review,
        projectName,
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
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[ContentRunner API] Failed to store completion:', errorMessage);
    return {
      success: false,
      workflowId,
      error: errorMessage,
    };
  }
}
