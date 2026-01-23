/**
 * Recommendation Engine - Core intelligence for generating strategic recommendations
 * Strategic Layer Phase 4: Recommendation Engine
 *
 * Analyzes patterns from Phase 2 and goals from Phase 3, then uses Claude
 * to generate actionable recommendations that connect observations to objectives.
 */

import { spawn } from 'child_process';
import * as patternRepository from './db/patternRepository.js';
import type { PatternRow } from './db/patternRepository.js';
import * as recommendationRepository from './db/recommendationRepository.js';
import type {
  RecommendationRow,
  RecommendationType,
  RecommendationPriority,
  FeedbackRow,
} from './db/recommendationRepository.js';
import { query } from '../db.js';

// ============================================
// Configuration
// ============================================

export interface RecommendationEngineConfig {
  minPatternConfidence: number;
  maxRecommendationsPerRun: number;
  recommendationExpiryDays: number;
  minPatternsForAnalysis: number;
  timeoutMs: number;
}

const DEFAULT_CONFIG: RecommendationEngineConfig = {
  minPatternConfidence: 0.6,
  maxRecommendationsPerRun: 10,
  recommendationExpiryDays: 7,
  minPatternsForAnalysis: 1, // Lower for now since we may have few patterns
  timeoutMs: 120000, // 2 minutes
};

// ============================================
// Result Types
// ============================================

export interface RecommendationGenerationResult {
  success: boolean;
  recommendationsCreated: number;
  patternsAnalyzed: number;
  goalsConsidered: number;
  durationMs: number;
  errors: string[];
  insights: string[];
  warnings: string[];
}

interface PatternSummary {
  id: string;
  name: string;
  description: string;
  patternType: string;
  observationCount: number;
  confidence: number;
  aiRecommendations: string[];
}

interface GoalSummary {
  id: string;
  title: string;
  description: string;
  category: string;
  priority: string;
  status: string;
  progressPercentage: number;
  relatedPatternIds: string[];
}

interface FeedbackSummary {
  entityType: string;
  action: string;
  feedbackText: string | null;
  createdAt: Date;
}

interface RecommendationSummary {
  id: string;
  title: string;
  sourcePatternIds: string[];
  relatedGoalIds: string[];
}

interface ClaudeRecommendationOutput {
  recommendations: Array<{
    title: string;
    description: string;
    type: RecommendationType;
    priority: RecommendationPriority;
    sourcePatternIds: string[];
    relatedGoalIds: string[];
    suggestedIntent: string;
    confidence: number;
    reasoning: string;
  }>;
  insights: string[];
  warnings: string[];
}

// Goal row type (query from database since we don't have goalRepository)
interface GoalRow {
  id: string;
  title: string;
  description: string;
  category: string;
  priority: string;
  status: string;
  progress_percentage: number;
  related_pattern_ids: string[];
}

// ============================================
// Main Entry Point
// ============================================

/**
 * Main generation function - analyzes patterns and goals, generates recommendations
 */
export async function generateRecommendations(
  config: Partial<RecommendationEngineConfig> = {}
): Promise<RecommendationGenerationResult> {
  const fullConfig = { ...DEFAULT_CONFIG, ...config };
  const startTime = Date.now();
  const errors: string[] = [];

  console.log(`[RecommendationEngine] Starting recommendation generation`);
  console.log(`[RecommendationEngine] Config: ${JSON.stringify(fullConfig)}`);

  try {
    // 1. Run housekeeping - expire old recommendations, reactivate deferred
    await recommendationRepository.expireOldRecommendations();
    await recommendationRepository.reactivateDeferredRecommendations();

    // 2. Fetch active patterns from Phase 2
    const patterns = await patternRepository.getActivePatterns();
    const filteredPatterns = patterns.filter(p => p.confidence >= fullConfig.minPatternConfidence);

    console.log(`[RecommendationEngine] Found ${patterns.length} active patterns, ${filteredPatterns.length} meet confidence threshold`);

    if (filteredPatterns.length < fullConfig.minPatternsForAnalysis) {
      console.log(`[RecommendationEngine] Not enough patterns (${filteredPatterns.length} < ${fullConfig.minPatternsForAnalysis}), skipping analysis`);
      return {
        success: true,
        recommendationsCreated: 0,
        patternsAnalyzed: filteredPatterns.length,
        goalsConsidered: 0,
        durationMs: Date.now() - startTime,
        errors: [],
        insights: ['Not enough high-confidence patterns for analysis'],
        warnings: [],
      };
    }

    // 3. Fetch active goals
    const goals = await getActiveGoals();
    console.log(`[RecommendationEngine] Found ${goals.length} active goals`);

    // 4. Fetch recent feedback for learning
    const recentFeedback = await recommendationRepository.getRecentFeedback(50);
    console.log(`[RecommendationEngine] Loaded ${recentFeedback.length} recent feedback items`);

    // 5. Fetch existing pending recommendations (for deduplication)
    const existingPending = await recommendationRepository.getPendingRecommendations(100);
    console.log(`[RecommendationEngine] Found ${existingPending.length} existing pending recommendations`);

    // 6. Prepare analysis input
    const analysisInput = prepareAnalysisInput(filteredPatterns, goals, recentFeedback, existingPending);

    // 7. Build Claude prompt and call Claude
    const prompt = buildRecommendationPrompt(analysisInput, fullConfig);
    console.log(`[RecommendationEngine] Calling Claude for recommendation generation...`);

    const claudeResponse = await runClaudeAnalysis(prompt, fullConfig.timeoutMs);

    // 8. Parse response
    const output = parseRecommendationResponse(claudeResponse);
    console.log(`[RecommendationEngine] Claude generated ${output.recommendations.length} recommendations`);

    // 9. Deduplicate and store recommendations
    let recommendationsCreated = 0;
    const existingSummaries = existingPending.map(r => ({
      id: r.id,
      title: r.title,
      sourcePatternIds: r.source_pattern_ids,
      relatedGoalIds: r.related_goal_ids,
    }));

    for (const rec of output.recommendations.slice(0, fullConfig.maxRecommendationsPerRun)) {
      // Check for duplicates
      if (isDuplicateRecommendation(rec, existingSummaries)) {
        console.log(`[RecommendationEngine] Skipping duplicate: ${rec.title}`);
        continue;
      }

      // Calculate expiry date
      const expiresAt = new Date(Date.now() + fullConfig.recommendationExpiryDays * 24 * 60 * 60 * 1000);

      // Store the recommendation
      const stored = await recommendationRepository.insertRecommendation({
        title: rec.title,
        description: rec.description,
        recommendationType: rec.type,
        priority: rec.priority,
        sourcePatternIds: rec.sourcePatternIds,
        relatedGoalIds: rec.relatedGoalIds,
        suggestedIntent: rec.suggestedIntent,
        confidence: rec.confidence,
        expiresAt,
      });

      if (stored) {
        recommendationsCreated++;
        // Add to existing summaries for dedup within this run
        existingSummaries.push({
          id: stored.id,
          title: stored.title,
          sourcePatternIds: stored.source_pattern_ids,
          relatedGoalIds: stored.related_goal_ids,
        });
      }
    }

    // 10. Log completion (Mandrel integration would go here)
    if (recommendationsCreated > 0) {
      console.log(`[RecommendationEngine] Generated ${recommendationsCreated} recommendations from ${filteredPatterns.length} patterns and ${goals.length} goals`);
      if (output.insights.length > 0) {
        console.log(`[RecommendationEngine] Insights: ${output.insights.join('; ')}`);
      }
    }

    const result: RecommendationGenerationResult = {
      success: true,
      recommendationsCreated,
      patternsAnalyzed: filteredPatterns.length,
      goalsConsidered: goals.length,
      durationMs: Date.now() - startTime,
      errors,
      insights: output.insights,
      warnings: output.warnings,
    };

    console.log(`[RecommendationEngine] Generation complete: ${recommendationsCreated} recommendations created in ${result.durationMs}ms`);
    return result;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[RecommendationEngine] Generation failed:`, errorMessage);

    return {
      success: false,
      recommendationsCreated: 0,
      patternsAnalyzed: 0,
      goalsConsidered: 0,
      durationMs: Date.now() - startTime,
      errors: [errorMessage],
      insights: [],
      warnings: [],
    };
  }
}

// ============================================
// Data Preparation
// ============================================

/**
 * Get active goals from database (Phase 3 may not exist yet)
 */
async function getActiveGoals(): Promise<GoalRow[]> {
  try {
    const result = await query<GoalRow>(
      `SELECT * FROM goals WHERE status = 'active' ORDER BY priority, created_at DESC`
    );
    return result.rows;
  } catch (error) {
    console.error('[RecommendationEngine] Failed to get active goals:', error);
    return [];
  }
}

/**
 * Prepare summarized data for Claude analysis
 */
function prepareAnalysisInput(
  patterns: PatternRow[],
  goals: GoalRow[],
  feedback: FeedbackRow[],
  existing: RecommendationRow[]
): {
  patterns: PatternSummary[];
  goals: GoalSummary[];
  recentFeedback: FeedbackSummary[];
  existingPendingRecommendations: RecommendationSummary[];
} {
  const patternSummaries: PatternSummary[] = patterns.map(p => ({
    id: p.id,
    name: p.name,
    description: p.description,
    patternType: p.pattern_type,
    observationCount: p.observation_count,
    confidence: p.confidence,
    aiRecommendations: p.ai_recommendations || [],
  }));

  const goalSummaries: GoalSummary[] = goals.map(g => ({
    id: g.id,
    title: g.title,
    description: g.description,
    category: g.category,
    priority: g.priority,
    status: g.status,
    progressPercentage: g.progress_percentage,
    relatedPatternIds: g.related_pattern_ids || [],
  }));

  const feedbackSummaries: FeedbackSummary[] = feedback.map(f => ({
    entityType: f.entity_type,
    action: f.action,
    feedbackText: f.feedback_text,
    createdAt: f.created_at,
  }));

  const existingSummaries: RecommendationSummary[] = existing.map(r => ({
    id: r.id,
    title: r.title,
    sourcePatternIds: r.source_pattern_ids,
    relatedGoalIds: r.related_goal_ids,
  }));

  return {
    patterns: patternSummaries,
    goals: goalSummaries,
    recentFeedback: feedbackSummaries,
    existingPendingRecommendations: existingSummaries,
  };
}

// ============================================
// Prompt Building
// ============================================

/**
 * Build the Claude prompt for recommendation generation
 */
function buildRecommendationPrompt(
  input: ReturnType<typeof prepareAnalysisInput>,
  config: RecommendationEngineConfig
): string {
  // Format patterns
  const patternsText = input.patterns.length > 0
    ? input.patterns.map(p => `---
ID: ${p.id}
Name: ${p.name}
Type: ${p.patternType}
Confidence: ${(p.confidence * 100).toFixed(0)}%
Observations: ${p.observationCount}
Description: ${p.description}
AI Recommendations: ${p.aiRecommendations.join('; ') || 'None'}`).join('\n\n')
    : 'No patterns available';

  // Format goals
  const goalsText = input.goals.length > 0
    ? input.goals.map(g => `---
ID: ${g.id}
Title: ${g.title}
Category: ${g.category}
Priority: ${g.priority}
Progress: ${g.progressPercentage.toFixed(0)}%
Description: ${g.description}
Linked Patterns: ${g.relatedPatternIds.join(', ') || 'None'}`).join('\n\n')
    : 'No active goals';

  // Format recent feedback (last 10 for brevity)
  const feedbackText = input.recentFeedback.slice(0, 10).length > 0
    ? input.recentFeedback.slice(0, 10).map(f =>
      `- ${f.action} on ${f.entityType}${f.feedbackText ? `: "${f.feedbackText}"` : ''}`
    ).join('\n')
    : 'No recent feedback';

  // Format existing recommendations to avoid
  const existingText = input.existingPendingRecommendations.length > 0
    ? input.existingPendingRecommendations.map(r => `- ${r.title}`).join('\n')
    : 'No existing pending recommendations';

  return `You are a strategic advisor for a software business. Analyze detected patterns and active goals to generate actionable recommendations.

## DETECTED PATTERNS (from workflow analysis)

${patternsText}

## ACTIVE GOALS

${goalsText}

## RECENT USER FEEDBACK (for learning preferences)

${feedbackText}

## EXISTING PENDING RECOMMENDATIONS (avoid duplicates)

${existingText}

## YOUR TASK

Generate strategic recommendations that:
1. Connect observed patterns to active goals
2. Suggest specific actions the user can take
3. Prioritize based on impact and goal alignment
4. Include a pre-filled orchestrator intent for each recommendation

## RECOMMENDATION TYPES

- **action**: Direct task to execute (e.g., "Fix the recurring API timeout")
- **optimization**: Improvement to existing process (e.g., "Optimize content workflow cadence")
- **warning**: Risk or issue to address (e.g., "Address increasing support ticket volume")
- **opportunity**: Growth or expansion idea (e.g., "Capitalize on content success pattern")

## PRIORITY LEVELS

- **critical**: Blocks high-priority goals, requires immediate attention
- **high**: Strongly supports high-priority goals
- **medium**: Supports any active goal
- **low**: Interesting insight but no urgent goal connection

## OUTPUT FORMAT

Respond with ONLY valid JSON (no markdown, no explanation outside JSON):

{
  "recommendations": [
    {
      "title": "Short action title (max 100 chars)",
      "description": "Full description of what to do and why (2-4 sentences)",
      "type": "action" | "optimization" | "warning" | "opportunity",
      "priority": "critical" | "high" | "medium" | "low",
      "sourcePatternIds": ["pattern-uuid-1", ...],
      "relatedGoalIds": ["goal-uuid-1", ...],
      "suggestedIntent": "Pre-filled intent for the orchestrator to execute this recommendation",
      "confidence": 0.0 to 1.0,
      "reasoning": "Brief explanation of why this recommendation is valuable"
    }
  ],
  "insights": ["Meta-observation about the patterns or goals"],
  "warnings": ["Any concerns or risks identified"]
}

## RULES

1. Generate at most ${config.maxRecommendationsPerRun} recommendations
2. Each recommendation must reference at least one pattern ID
3. Prefer recommendations that connect patterns to goals
4. Do not duplicate existing pending recommendations
5. suggestedIntent should be actionable (e.g., "Investigate and fix the API timeout issue in the payment service")
6. Return empty recommendations array if no valuable recommendations can be made
7. Be specific - avoid vague recommendations like "improve performance"`;
}

// ============================================
// Claude Integration
// ============================================

/**
 * Run Claude CLI for recommendation generation
 */
async function runClaudeAnalysis(prompt: string, timeoutMs: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const claude = spawn('claude', [
      '--print',
      '--dangerously-skip-permissions',
      '--output-format', 'text',
      prompt,
    ], {
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';
    let killed = false;

    const timeoutHandle = setTimeout(() => {
      if (!killed) {
        killed = true;
        claude.kill('SIGTERM');
        reject(new Error(`Recommendation generation timed out after ${timeoutMs}ms`));
      }
    }, timeoutMs);

    claude.stdout?.on('data', (data) => {
      stdout += data.toString();
    });

    claude.stderr?.on('data', (data) => {
      stderr += data.toString();
    });

    claude.on('close', (code) => {
      clearTimeout(timeoutHandle);
      if (killed) {
        return;
      }
      if (code === 0) {
        resolve(stdout);
      } else {
        reject(new Error(`Claude exited with code ${code}: ${stderr}`));
      }
    });

    claude.on('error', (err) => {
      clearTimeout(timeoutHandle);
      reject(err);
    });
  });
}

// ============================================
// Response Parsing
// ============================================

/**
 * Parse Claude's JSON response
 */
function parseRecommendationResponse(response: string): ClaudeRecommendationOutput {
  // Try to find JSON in response
  let jsonStr: string | null = null;

  // First try: entire response is JSON
  try {
    const trimmed = response.trim();
    if (trimmed.startsWith('{')) {
      jsonStr = trimmed;
    }
  } catch {
    // Not pure JSON
  }

  // Second try: look for JSON in markdown code blocks
  if (!jsonStr) {
    const codeBlockMatch = response.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (codeBlockMatch) {
      jsonStr = codeBlockMatch[1].trim();
    }
  }

  // Third try: find JSON object anywhere in response
  if (!jsonStr) {
    const objectMatch = response.match(/\{[\s\S]*\}/);
    if (objectMatch) {
      jsonStr = objectMatch[0];
    }
  }

  if (!jsonStr) {
    console.warn('[RecommendationEngine] No JSON found in Claude response');
    return { recommendations: [], insights: [], warnings: [] };
  }

  try {
    const parsed = JSON.parse(jsonStr);

    if (!parsed.recommendations || !Array.isArray(parsed.recommendations)) {
      console.warn('[RecommendationEngine] Response missing recommendations array');
      return { recommendations: [], insights: parsed.insights || [], warnings: parsed.warnings || [] };
    }

    // Validate and filter recommendations
    const validRecommendations: ClaudeRecommendationOutput['recommendations'] = [];

    for (const rec of parsed.recommendations) {
      // Validate required fields
      if (!rec.title || !rec.description || !rec.type || !rec.priority ||
          !Array.isArray(rec.sourcePatternIds) || !rec.suggestedIntent ||
          typeof rec.confidence !== 'number') {
        console.warn('[RecommendationEngine] Skipping recommendation with missing fields:', rec.title);
        continue;
      }

      // Validate enum values
      const validTypes: RecommendationType[] = ['action', 'optimization', 'warning', 'opportunity'];
      const validPriorities: RecommendationPriority[] = ['critical', 'high', 'medium', 'low'];

      if (!validTypes.includes(rec.type)) {
        console.warn(`[RecommendationEngine] Invalid type "${rec.type}", defaulting to "action"`);
        rec.type = 'action';
      }

      if (!validPriorities.includes(rec.priority)) {
        console.warn(`[RecommendationEngine] Invalid priority "${rec.priority}", defaulting to "medium"`);
        rec.priority = 'medium';
      }

      validRecommendations.push({
        title: rec.title.substring(0, 200),
        description: rec.description,
        type: rec.type as RecommendationType,
        priority: rec.priority as RecommendationPriority,
        sourcePatternIds: rec.sourcePatternIds,
        relatedGoalIds: rec.relatedGoalIds || [],
        suggestedIntent: rec.suggestedIntent,
        confidence: Math.min(1, Math.max(0, rec.confidence)),
        reasoning: rec.reasoning || '',
      });
    }

    return {
      recommendations: validRecommendations,
      insights: parsed.insights || [],
      warnings: parsed.warnings || [],
    };
  } catch (error) {
    console.error('[RecommendationEngine] Failed to parse JSON:', error);
    return { recommendations: [], insights: [], warnings: [] };
  }
}

// ============================================
// Deduplication
// ============================================

/**
 * Check if a recommendation is a duplicate of existing ones
 */
function isDuplicateRecommendation(
  newRec: ClaudeRecommendationOutput['recommendations'][0],
  existing: RecommendationSummary[]
): boolean {
  for (const ex of existing) {
    // Check title similarity (simple case-insensitive containment)
    const newTitleLower = newRec.title.toLowerCase();
    const exTitleLower = ex.title.toLowerCase();

    if (newTitleLower === exTitleLower ||
        newTitleLower.includes(exTitleLower) ||
        exTitleLower.includes(newTitleLower)) {
      return true;
    }

    // Check pattern overlap
    const patternOverlap = newRec.sourcePatternIds.filter(id => ex.sourcePatternIds.includes(id));
    const maxPatterns = Math.max(newRec.sourcePatternIds.length, ex.sourcePatternIds.length);
    if (maxPatterns > 0 && patternOverlap.length / maxPatterns > 0.8) {
      return true;
    }

    // Check goal overlap (if both have goals)
    if (newRec.relatedGoalIds.length > 0 && ex.relatedGoalIds.length > 0) {
      const goalOverlap = newRec.relatedGoalIds.filter(id => ex.relatedGoalIds.includes(id));
      const maxGoals = Math.max(newRec.relatedGoalIds.length, ex.relatedGoalIds.length);
      if (goalOverlap.length / maxGoals > 0.8) {
        // High goal overlap + any pattern overlap = likely duplicate
        if (patternOverlap.length > 0) {
          return true;
        }
      }
    }
  }

  return false;
}

// ============================================
// Utility Functions
// ============================================

/**
 * Check if recommendation generation should run
 * Returns true if there are patterns and goals to analyze
 */
export async function shouldGenerateRecommendations(): Promise<boolean> {
  const patterns = await patternRepository.getActivePatterns();
  const highConfidencePatterns = patterns.filter(p => p.confidence >= DEFAULT_CONFIG.minPatternConfidence);

  if (highConfidencePatterns.length < DEFAULT_CONFIG.minPatternsForAnalysis) {
    return false;
  }

  const goals = await getActiveGoals();
  // Only generate if there are goals to connect to
  return goals.length > 0;
}

/**
 * Trigger recommendation generation if conditions are met
 * Called after pattern analysis completes
 */
export async function triggerRecommendationsIfNeeded(): Promise<RecommendationGenerationResult | null> {
  const shouldRun = await shouldGenerateRecommendations();

  if (shouldRun) {
    console.log('[RecommendationEngine] Triggering recommendation generation after pattern analysis');
    return generateRecommendations();
  }

  console.log('[RecommendationEngine] Conditions not met for recommendation generation');
  return null;
}
