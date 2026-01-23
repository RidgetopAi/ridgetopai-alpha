/**
 * TypeScript types for Strategic Layer UI
 * Phase 3: Goal Management
 * Phase 4: Recommendation Engine
 */

// ============================================
// Goal Types (Phase 3)
// ============================================

export type GoalCategory = 'revenue' | 'product' | 'operational' | 'growth' | 'technical';
export type GoalPriority = 'critical' | 'high' | 'medium' | 'low';
export type GoalStatus = 'active' | 'completed' | 'paused' | 'abandoned';

export interface Goal {
  id: string;
  title: string;
  description: string;
  category: GoalCategory;
  priority: GoalPriority;
  target_metric: string | null;
  target_value: number | null;
  current_value: number;
  progress_percentage: number;
  target_date: string | null;
  status: GoalStatus;
  completed_at: string | null;
  created_by: string;
  parent_goal_id: string | null;
  related_pattern_ids: string[];
  created_at: string;
  updated_at: string;
  // Computed metadata (from GoalWithMetadata)
  childCount?: number;
  linkedPatternCount?: number;
  daysUntilTarget?: number | null;
  isOverdue?: boolean;
}

export interface GoalStats {
  total: number;
  byStatus: Record<GoalStatus, number>;
  byCategory: Record<GoalCategory, number>;
  byPriority: Record<GoalPriority, number>;
  avgProgress: number;
  overdueCount: number;
  completedThisWeek: number;
  completedThisMonth: number;
}

export interface GoalProgress {
  overallProgress: number;
  totalGoals: number;
  weightedProgress: number;
}

// Goal API Request/Response Types
export interface ListGoalsParams {
  status?: GoalStatus | GoalStatus[];
  category?: GoalCategory | GoalCategory[];
  priority?: GoalPriority | GoalPriority[];
  parentGoalId?: string | null;
  hasParent?: boolean;
  limit?: number;
  offset?: number;
  orderBy?: 'priority' | 'created_at' | 'updated_at' | 'target_date' | 'progress_percentage';
  orderDir?: 'ASC' | 'DESC';
}

export interface ListGoalsResponse {
  success: boolean;
  goals: Goal[];
  total: number;
  limit: number;
  offset: number;
  error?: string;
}

export interface GetGoalResponse {
  success: boolean;
  goal?: Goal;
  error?: string;
}

export interface GoalStatsResponse {
  success: boolean;
  stats?: GoalStats;
  progress?: GoalProgress;
  error?: string;
}

export interface GoalHierarchyNode extends Goal {
  children: GoalHierarchyNode[];
}

export interface GoalHierarchyResponse {
  success: boolean;
  hierarchy: GoalHierarchyNode[];
  error?: string;
}

export interface CreateGoalInput {
  title: string;
  description: string;
  category: GoalCategory;
  priority?: GoalPriority;
  targetMetric?: string;
  targetValue?: number;
  currentValue?: number;
  targetDate?: string;
  parentGoalId?: string;
  relatedPatternIds?: string[];
}

export interface CreateGoalResponse {
  success: boolean;
  goal?: Goal;
  error?: string;
}

export interface UpdateGoalInput {
  title?: string;
  description?: string;
  category?: GoalCategory;
  priority?: GoalPriority;
  targetMetric?: string;
  targetValue?: number;
  currentValue?: number;
  progressPercentage?: number;
  targetDate?: string | null;
  status?: GoalStatus;
  parentGoalId?: string | null;
  relatedPatternIds?: string[];
}

export interface UpdateGoalResponse {
  success: boolean;
  goal?: Goal;
  previousStatus?: GoalStatus;
  error?: string;
}

export interface UpdateProgressResponse {
  success: boolean;
  goal?: Goal;
  error?: string;
}

export interface DeleteGoalResponse {
  success: boolean;
  goal?: Goal;
  error?: string;
}

export interface LinkPatternResponse {
  success: boolean;
  goal?: Goal;
  error?: string;
}

// ============================================
// Recommendation Types (Phase 4)
// ============================================

export type RecommendationType = 'action' | 'optimization' | 'warning' | 'opportunity';
export type RecommendationPriority = 'critical' | 'high' | 'medium' | 'low';
export type RecommendationStatus = 'pending' | 'accepted' | 'rejected' | 'deferred' | 'expired';

export interface Recommendation {
  id: string;
  title: string;
  description: string;
  recommendation_type: RecommendationType;
  priority: RecommendationPriority;
  source_pattern_ids: string[];
  related_goal_ids: string[];
  suggested_intent: string;
  confidence: number;
  status: RecommendationStatus;
  accepted_at: string | null;
  rejected_at: string | null;
  deferred_until: string | null;
  feedback_id: string | null;
  created_at: string;
  updated_at: string;
  expires_at: string | null;
}

export interface RecommendationStats {
  total: number;
  byStatus: Record<string, number>;
  byPriority: Record<string, number>;
  byType: Record<string, number>;
  avgConfidence: number | null;
  acceptanceRate: number | null;
  pendingCount: number;
  expiringInNext24h: number;
}

// ============================================
// Feedback Types
// ============================================

export interface Feedback {
  id: string;
  entity_type: 'recommendation' | 'pattern' | 'goal';
  entity_id: string;
  action: 'accept' | 'reject' | 'defer';
  feedback_text: string | null;
  feedback_rating: number | null;
  created_by: string;
  created_at: string;
}

export interface FeedbackStats {
  total: number;
  byAction: Record<string, number>;
  byEntityType: Record<string, number>;
  avgRating: number | null;
}

// ============================================
// API Request/Response Types
// ============================================

export interface ListRecommendationsParams {
  status?: RecommendationStatus;
  priority?: RecommendationPriority;
  type?: RecommendationType;
  minConfidence?: number;
  limit?: number;
  offset?: number;
  orderBy?: 'created_at' | 'priority' | 'confidence' | 'expires_at';
  orderDir?: 'ASC' | 'DESC';
}

export interface ListRecommendationsResponse {
  success: boolean;
  recommendations: Recommendation[];
  count: number;
  error?: string;
}

export interface GetRecommendationResponse {
  success: boolean;
  recommendation?: Recommendation;
  error?: string;
}

export interface RecommendationStatsResponse {
  success: boolean;
  stats?: RecommendationStats;
  error?: string;
}

export interface GenerateRecommendationsParams {
  minPatternConfidence?: number;
  maxRecommendationsPerRun?: number;
}

export interface GenerateRecommendationsResponse {
  success: boolean;
  result?: {
    success: boolean;
    recommendationsCreated: number;
    patternsAnalyzed: number;
    goalsConsidered: number;
    durationMs: number;
    errors: string[];
    insights: string[];
    warnings: string[];
  };
  error?: string;
}

export interface AcceptRecommendationParams {
  feedbackText?: string;
  feedbackRating?: number;
  triggerOrchestration?: boolean;
}

export interface AcceptRecommendationResponse {
  success: boolean;
  recommendation?: Recommendation;
  feedbackId?: string;
  sessionId?: string;
  error?: string;
}

export interface RejectRecommendationParams {
  feedbackText?: string;
  feedbackRating?: number;
}

export interface RejectRecommendationResponse {
  success: boolean;
  recommendation?: Recommendation;
  feedbackId?: string;
  error?: string;
}

export interface DeferRecommendationParams {
  deferUntil: string; // ISO date string
  feedbackText?: string;
}

export interface DeferRecommendationResponse {
  success: boolean;
  recommendation?: Recommendation;
  feedbackId?: string;
  error?: string;
}

export interface GetFeedbackResponse {
  success: boolean;
  feedback: Feedback[];
  error?: string;
}

export interface FeedbackStatsResponse {
  success: boolean;
  stats?: FeedbackStats;
  error?: string;
}
