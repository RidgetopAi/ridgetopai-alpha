/**
 * Context Types - Mandrel Context Browser
 * Types for browsing and searching institutional memory
 */

// Context types that Mandrel stores
export type MandrelContextType =
  | 'code'
  | 'decision'
  | 'error'
  | 'discussion'
  | 'planning'
  | 'completion'
  | 'milestone'
  | 'reflections'
  | 'handoff';

// A context entry from Mandrel
export interface MandrelContext {
  id: string;
  content: string;
  type: MandrelContextType;
  tags: string[];
  createdAt: string;
  relevance?: number;
}

// Context statistics
export interface ContextStats {
  total: number;
  byType: Record<MandrelContextType, number>;
  recentCount: number;
}

// API Response types
export interface ContextSearchResponse {
  success: boolean;
  contexts: MandrelContext[];
  count: number;
  error?: string;
}

export interface ContextRecentResponse {
  success: boolean;
  contexts: MandrelContext[];
  count: number;
  error?: string;
}

export interface ContextStatsResponse {
  success: boolean;
  stats?: ContextStats;
  error?: string;
}

// Display labels
export const CONTEXT_TYPE_LABELS: Record<MandrelContextType, string> = {
  code: 'Code',
  decision: 'Decision',
  error: 'Error',
  discussion: 'Discussion',
  planning: 'Planning',
  completion: 'Completion',
  milestone: 'Milestone',
  reflections: 'Reflections',
  handoff: 'Handoff',
};

// Type colors for badges
export const CONTEXT_TYPE_COLORS: Record<MandrelContextType, string> = {
  code: 'bg-blue-500/20 text-blue-400',
  decision: 'bg-purple-500/20 text-purple-400',
  error: 'bg-red-500/20 text-red-400',
  discussion: 'bg-cyan-500/20 text-cyan-400',
  planning: 'bg-yellow-500/20 text-yellow-400',
  completion: 'bg-green-500/20 text-green-400',
  milestone: 'bg-orange-500/20 text-orange-400',
  reflections: 'bg-pink-500/20 text-pink-400',
  handoff: 'bg-indigo-500/20 text-indigo-400',
};
