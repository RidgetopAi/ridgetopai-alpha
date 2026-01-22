/**
 * Context API Client - Mandrel Context Browser
 * Communicates with backend to access Mandrel contexts
 */

import type {
  MandrelContext,
  MandrelContextType,
  ContextSearchResponse,
  ContextRecentResponse,
  ContextStatsResponse,
} from '../types/context';

// Backend API URL (proxies to Mandrel)
const API_BASE_URL = import.meta.env.VITE_API_URL || '';

/**
 * Call backend Mandrel proxy endpoint
 */
async function callBackendProxy<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T | null> {
  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      headers: { 'Content-Type': 'application/json' },
      ...options,
    });

    if (!response.ok) {
      console.error(`[ContextAPI] HTTP ${response.status} from ${endpoint}`);
      return null;
    }

    return await response.json() as T;
  } catch (error) {
    console.error(`[ContextAPI] Failed to call ${endpoint}:`, error);
    return null;
  }
}

/**
 * Parse Mandrel response text into structured contexts
 */
function parseContextsFromText(text: string): MandrelContext[] {
  const contexts: MandrelContext[] = [];

  // Pattern to match context entries in Mandrel output
  // Format varies but typically includes: type, content preview, tags, ID
  const lines = text.split('\n');
  let currentContext: Partial<MandrelContext> | null = null;
  let inContent = false;
  let contentLines: string[] = [];

  for (const line of lines) {
    // Look for numbered entries like "1. **completion**" or similar
    const typeMatch = line.match(/^\s*\d+\.\s+\*\*(\w+)\*\*/i);
    if (typeMatch) {
      // Save accumulated content before switching context
      if (currentContext && inContent && contentLines.length > 0) {
        currentContext.content = contentLines.join('\n').trim();
      }
      if (currentContext && currentContext.id) {
        contexts.push(currentContext as MandrelContext);
      }
      currentContext = {
        type: typeMatch[1].toLowerCase() as MandrelContextType,
        tags: [],
        createdAt: new Date().toISOString(),
      };
      inContent = false;
      contentLines = [];
      continue;
    }

    if (!currentContext) continue;

    // Parse Content line (and start accumulating multi-line content)
    const contentMatch = line.match(/^\s*Content:\s*(.*)$/i);
    if (contentMatch) {
      inContent = true;
      contentLines = [contentMatch[1].trim()];
      continue;
    }

    // Parse Tags line - ends content accumulation
    const tagsMatch = line.match(/^\s*Tags:\s*\[([^\]]*)\]/i);
    if (tagsMatch) {
      if (inContent && contentLines.length > 0) {
        currentContext.content = contentLines.join('\n').trim();
        inContent = false;
      }
      currentContext.tags = tagsMatch[1]
        .split(',')
        .map((t) => t.trim())
        .filter((t) => t);
      continue;
    }

    // Parse ID line - ends content accumulation
    const idMatch = line.match(/^\s*ID:\s*(\S+)/i);
    if (idMatch) {
      if (inContent && contentLines.length > 0) {
        currentContext.content = contentLines.join('\n').trim();
        inContent = false;
      }
      currentContext.id = idMatch[1];
      continue;
    }

    // Parse relevance/similarity if present
    const relevanceMatch = line.match(/relevance[:\s]+(\d+(?:\.\d+)?)/i);
    if (relevanceMatch) {
      currentContext.relevance = parseFloat(relevanceMatch[1]);
      continue;
    }

    // Parse created/stored time if present
    const timeMatch = line.match(/(?:created|stored)[:\s]+(\d{4}-\d{2}-\d{2}[T\s]\d{2}:\d{2})/i);
    if (timeMatch) {
      currentContext.createdAt = timeMatch[1];
      continue;
    }

    // If we're in content mode and line isn't a known field, accumulate it
    if (inContent && line.trim()) {
      contentLines.push(line);
    }
  }

  // Don't forget the last context
  if (currentContext) {
    if (inContent && contentLines.length > 0) {
      currentContext.content = contentLines.join('\n').trim();
    }
    if (currentContext.id) {
      contexts.push(currentContext as MandrelContext);
    }
  }

  return contexts;
}

/**
 * Search contexts by query
 */
export async function searchContexts(
  query: string,
  options: { type?: MandrelContextType; limit?: number } = {}
): Promise<ContextSearchResponse> {
  const { type, limit = 20 } = options;

  try {
    const response = await callBackendProxy<{
      success: boolean;
      result?: { content: Array<{ type: string; text: string }> };
      error?: string;
    }>('/api/mandrel/contexts/search', {
      method: 'POST',
      body: JSON.stringify({ query, type, limit }),
    });

    if (!response?.success || !response.result?.content) {
      return {
        success: false,
        contexts: [],
        count: 0,
        error: response?.error || 'Search failed',
      };
    }

    // Combine all text content
    const fullText = response.result.content
      .filter((c) => c.type === 'text')
      .map((c) => c.text)
      .join('\n');

    const contexts = parseContextsFromText(fullText);

    return {
      success: true,
      contexts,
      count: contexts.length,
    };
  } catch (error) {
    return {
      success: false,
      contexts: [],
      count: 0,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Get recent contexts
 */
export async function getRecentContexts(
  limit: number = 20
): Promise<ContextRecentResponse> {
  try {
    const response = await callBackendProxy<{
      success: boolean;
      result?: { content: Array<{ type: string; text: string }> };
      error?: string;
    }>(`/api/mandrel/contexts/recent?limit=${limit}`);

    if (!response?.success || !response.result?.content) {
      return {
        success: false,
        contexts: [],
        count: 0,
        error: response?.error || 'Failed to get recent contexts',
      };
    }

    // Combine all text content
    const fullText = response.result.content
      .filter((c) => c.type === 'text')
      .map((c) => c.text)
      .join('\n');

    const contexts = parseContextsFromText(fullText);

    return {
      success: true,
      contexts,
      count: contexts.length,
    };
  } catch (error) {
    return {
      success: false,
      contexts: [],
      count: 0,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Get context statistics
 */
export async function getContextStats(): Promise<ContextStatsResponse> {
  try {
    const response = await callBackendProxy<{
      success: boolean;
      result?: { content: Array<{ type: string; text: string }> };
      error?: string;
    }>('/api/mandrel/contexts/stats');

    if (!response?.success || !response.result?.content) {
      return {
        success: false,
        error: response?.error || 'Failed to get stats',
      };
    }

    // Parse stats from response text
    const fullText = response.result.content
      .filter((c) => c.type === 'text')
      .map((c) => c.text)
      .join('\n');

    // Extract total count - matches "Total Contexts: 147" or similar
    const totalMatch = fullText.match(/total\s*(?:contexts)?[:\s]+(\d+)/i);
    const total = totalMatch ? parseInt(totalMatch[1], 10) : 0;

    // Extract type breakdown
    const byType: Record<MandrelContextType, number> = {
      code: 0,
      decision: 0,
      error: 0,
      discussion: 0,
      planning: 0,
      completion: 0,
      milestone: 0,
      reflections: 0,
      handoff: 0,
    };

    const typeMatches = fullText.matchAll(/(\w+)[:\s]+(\d+)/g);
    for (const match of typeMatches) {
      const type = match[1].toLowerCase() as MandrelContextType;
      if (type in byType) {
        byType[type] = parseInt(match[2], 10);
      }
    }

    return {
      success: true,
      stats: {
        total,
        byType,
        recentCount: total, // Mandrel doesn't distinguish
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Get a specific context by ID
 */
export async function getContextById(
  id: string
): Promise<{ success: boolean; context?: MandrelContext; error?: string }> {
  try {
    const response = await callBackendProxy<{
      success: boolean;
      result?: { content: Array<{ type: string; text: string }> };
      error?: string;
    }>('/api/mandrel/contexts/search', {
      method: 'POST',
      body: JSON.stringify({ id }),
    });

    if (!response?.success || !response.result?.content) {
      return {
        success: false,
        error: response?.error || 'Context not found',
      };
    }

    const fullText = response.result.content
      .filter((c) => c.type === 'text')
      .map((c) => c.text)
      .join('\n');

    const contexts = parseContextsFromText(fullText);
    const context = contexts.find((c) => c.id === id) || contexts[0];

    if (!context) {
      return { success: false, error: 'Context not found' };
    }

    return { success: true, context };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Check if Mandrel is available
 */
export async function checkMandrelConnection(): Promise<boolean> {
  try {
    const response = await callBackendProxy<{ success: boolean }>('/api/mandrel/ping');
    return response?.success === true;
  } catch {
    return false;
  }
}
