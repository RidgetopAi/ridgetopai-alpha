/**
 * Pattern Analyzer - Core intelligence for detecting patterns in workflow observations
 * Strategic Layer Phase 2: Pattern Detection
 *
 * Queries observations from Phase 1, batches them for Claude analysis,
 * and stores detected patterns for Phase 4 recommendation engine.
 */

import { spawn } from 'child_process';
import { randomUUID } from 'crypto';
import * as observationRepository from './db/observationRepository.js';
import type { ObservationRow } from './db/observationRepository.js';
import * as patternRepository from './db/patternRepository.js';
import type { PatternRow, PatternType } from './db/patternRepository.js';
import { setLastAnalysisDate } from './strategicObserver.js';
import { triggerRecommendationsIfNeeded } from './recommendationEngine.js';

// ============================================
// Configuration
// ============================================

export interface PatternAnalysisConfig {
  minObservations: number;
  analysisWindowDays: number;
  minPatternConfidence: number;
  maxPatternsPerRun: number;
  timeoutMs: number;
}

const DEFAULT_CONFIG: PatternAnalysisConfig = {
  minObservations: 10,
  analysisWindowDays: 30,
  minPatternConfidence: 0.5,
  maxPatternsPerRun: 20,
  timeoutMs: 60000,
};

// ============================================
// Result Types
// ============================================

export interface PatternAnalysisResult {
  runId: string;
  observationsAnalyzed: number;
  patternsDetected: number;
  patternsUpdated: number;
  patterns: PatternDetectionResult[];
  analysisTimeMs: number;
  error?: string;
}

export interface PatternDetectionResult {
  patternId: string;
  isNew: boolean;
  patternType: PatternType;
  name: string;
  description: string;
  confidence: number;
  observationCount: number;
  aiAnalysis: string;
  aiRecommendations: string[];
}

interface ObservationBatch {
  batchId: string;
  observations: ObservationSummary[];
  timeRange: { start: Date; end: Date };
  workflowBreakdown: Record<string, number>;
  outcomeBreakdown: Record<string, number>;
}

interface ObservationSummary {
  id: string;
  workflow: string;
  capability: string;
  outcome: string;
  confidence: number | null;
  tags: string[];
  observedAt: string;
  payloadSummary: string;
}

interface ClaudePatternResponse {
  patternType: PatternType;
  name: string;
  description: string;
  confidence: number;
  observationIds: string[];
  analysis: string;
  recommendations: string[];
}

// ============================================
// Main Entry Point
// ============================================

/**
 * Main analysis function - queries observations, sends to Claude, stores patterns
 */
export async function analyzePatterns(
  config: Partial<PatternAnalysisConfig> = {}
): Promise<PatternAnalysisResult> {
  const fullConfig = { ...DEFAULT_CONFIG, ...config };
  const startTime = Date.now();
  const runId = await patternRepository.startAnalysisRun(fullConfig);

  console.log(`[PatternAnalyzer] Starting analysis run ${runId}`);
  console.log(`[PatternAnalyzer] Config: ${JSON.stringify(fullConfig)}`);

  try {
    // 1. Query observations from the analysis window
    const sinceDate = new Date(Date.now() - fullConfig.analysisWindowDays * 24 * 60 * 60 * 1000);
    const observations = await observationRepository.queryObservations({
      sinceDate,
      limit: 500, // Cap to avoid overwhelming Claude
      orderBy: 'observed_at',
      orderDir: 'DESC',
    });

    console.log(`[PatternAnalyzer] Found ${observations.length} observations in window`);

    // 2. Check if we have enough observations
    if (observations.length < fullConfig.minObservations) {
      console.log(`[PatternAnalyzer] Not enough observations (${observations.length} < ${fullConfig.minObservations}), skipping analysis`);

      await patternRepository.completeAnalysisRun(runId, observations.length, 0, 0, Date.now() - startTime);
      setLastAnalysisDate(new Date());

      return {
        runId,
        observationsAnalyzed: observations.length,
        patternsDetected: 0,
        patternsUpdated: 0,
        patterns: [],
        analysisTimeMs: Date.now() - startTime,
      };
    }

    // 3. Prepare batch for Claude
    const batch = prepareObservationBatch(observations);

    // 4. Build prompt and call Claude
    const prompt = buildPatternDetectionPrompt(batch);
    console.log(`[PatternAnalyzer] Calling Claude for pattern detection...`);

    const claudeResponse = await runClaudeAnalysis(prompt, fullConfig.timeoutMs);

    // 5. Parse response
    const detectedPatterns = parsePatternResponse(claudeResponse, fullConfig.minPatternConfidence);
    console.log(`[PatternAnalyzer] Claude detected ${detectedPatterns.length} patterns`);

    // 6. Store patterns (matching with existing or creating new)
    const results: PatternDetectionResult[] = [];
    let patternsDetected = 0;
    let patternsUpdated = 0;

    for (const detected of detectedPatterns.slice(0, fullConfig.maxPatternsPerRun)) {
      const result = await storeOrUpdatePattern(detected, batch.observations);

      if (result) {
        results.push(result);
        if (result.isNew) {
          patternsDetected++;
        } else {
          patternsUpdated++;
        }
      }
    }

    // 7. Complete the analysis run
    const analysisTimeMs = Date.now() - startTime;
    await patternRepository.completeAnalysisRun(runId, observations.length, patternsDetected, patternsUpdated, analysisTimeMs);

    // 8. Update last analysis date for threshold checking
    setLastAnalysisDate(new Date());

    console.log(`[PatternAnalyzer] Analysis complete: ${patternsDetected} new, ${patternsUpdated} updated, ${analysisTimeMs}ms`);

    // 9. Trigger recommendation generation if new patterns were detected
    if (patternsDetected > 0) {
      console.log(`[PatternAnalyzer] New patterns detected, triggering recommendation generation...`);
      // Fire and forget - don't block pattern analysis completion
      triggerRecommendationsIfNeeded().catch((err: unknown) => {
        console.error('[PatternAnalyzer] Recommendation generation failed:', err);
      });
    }

    return {
      runId,
      observationsAnalyzed: observations.length,
      patternsDetected,
      patternsUpdated,
      patterns: results,
      analysisTimeMs,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[PatternAnalyzer] Analysis failed:`, errorMessage);

    await patternRepository.failAnalysisRun(runId, errorMessage);

    return {
      runId,
      observationsAnalyzed: 0,
      patternsDetected: 0,
      patternsUpdated: 0,
      patterns: [],
      analysisTimeMs: Date.now() - startTime,
      error: errorMessage,
    };
  }
}

// ============================================
// Batch Preparation
// ============================================

/**
 * Transform raw observations into batch for Claude
 */
function prepareObservationBatch(observations: ObservationRow[]): ObservationBatch {
  const batchId = randomUUID();

  // Calculate breakdowns
  const workflowBreakdown: Record<string, number> = {};
  const outcomeBreakdown: Record<string, number> = {};

  for (const obs of observations) {
    workflowBreakdown[obs.source_workflow] = (workflowBreakdown[obs.source_workflow] || 0) + 1;
    outcomeBreakdown[obs.outcome] = (outcomeBreakdown[obs.outcome] || 0) + 1;
  }

  // Determine time range
  const dates = observations.map(o => new Date(o.observed_at).getTime());
  const timeRange = {
    start: new Date(Math.min(...dates)),
    end: new Date(Math.max(...dates)),
  };

  // Summarize each observation
  const summaries: ObservationSummary[] = observations.map(obs => ({
    id: obs.id,
    workflow: obs.source_workflow,
    capability: obs.source_capability,
    outcome: obs.outcome,
    confidence: obs.confidence_score,
    tags: obs.tags,
    observedAt: new Date(obs.observed_at).toISOString(),
    payloadSummary: summarizePayload(obs.source_workflow, obs.payload),
  }));

  return {
    batchId,
    observations: summaries,
    timeRange,
    workflowBreakdown,
    outcomeBreakdown,
  };
}

/**
 * Extract key fields from observation payload for Claude
 */
function summarizePayload(workflow: string, payload: Record<string, unknown>): string {
  const input = payload.input as Record<string, unknown> | undefined;
  const output = payload.output as Record<string, unknown> | undefined;

  if (!input || !output) {
    return 'No structured payload available';
  }

  switch (workflow) {
    case 'bugfix':
      return `Bug '${input.title}' (${input.severity}), root cause: ${output.rootCause}, fix proposed: ${output.hasProposedFix ? 'yes' : 'no'}`;

    case 'content':
      return `Content '${input.title}' (${input.format} for ${input.audience}), generated: ${output.wordCount || 'unknown'} words`;

    case 'support':
      return `Ticket '${input.title}' (${input.category}, ${input.severity}), action: ${output.actionType}`;

    case 'monitoring':
      return `Alert '${input.title}' (${input.category}, ${input.severity}), remediation: ${output.remediationType}`;

    default:
      return `Workflow ${workflow}: ${input.title || 'untitled'}`;
  }
}

// ============================================
// Prompt Building
// ============================================

/**
 * Build the Claude prompt for pattern detection
 */
function buildPatternDetectionPrompt(batch: ObservationBatch): string {
  // Format workflow breakdown
  const workflowLines = Object.entries(batch.workflowBreakdown)
    .map(([k, v]) => `  - ${k}: ${v} observations`)
    .join('\n');

  // Format outcome breakdown with percentages
  const total = batch.observations.length;
  const outcomeLines = Object.entries(batch.outcomeBreakdown)
    .map(([k, v]) => `  - ${k}: ${v} observations (${Math.round((v / total) * 100)}%)`)
    .join('\n');

  // Format individual observations (limit to 50 to avoid token limits)
  const observationList = batch.observations.slice(0, 50)
    .map(obs => `---
ID: ${obs.id}
Workflow: ${obs.workflow} (${obs.capability})
Outcome: ${obs.outcome} (confidence: ${obs.confidence !== null ? obs.confidence.toFixed(2) : 'unknown'})
Observed: ${obs.observedAt}
Tags: ${obs.tags.join(', ')}
Summary: ${obs.payloadSummary}`)
    .join('\n');

  return `You are analyzing workflow execution data to identify patterns that could inform business decisions.

## Observation Batch

**Batch ID:** ${batch.batchId}
**Time Range:** ${batch.timeRange.start.toISOString()} to ${batch.timeRange.end.toISOString()}
**Total Observations:** ${batch.observations.length}

### Breakdown by Workflow Type:
${workflowLines}

### Breakdown by Outcome:
${outcomeLines}

### Individual Observations:
${observationList}

## Your Task

Analyze these observations and identify PATTERNS. A pattern is a recurring behavior, correlation, or trend that appears across multiple observations.

Look for:
1. **recurring_success** - Workflow types that consistently succeed
2. **recurring_failure** - Workflow types that consistently fail
3. **timing_pattern** - Patterns in when workflows run (time of day, day of week)
4. **correlation** - Two workflow types that often occur together
5. **trend** - Increasing or decreasing frequency over time

## Output Format

Respond with ONLY a JSON array (no markdown, no explanation outside JSON):

[
  {
    "patternType": "recurring_success" | "recurring_failure" | "timing_pattern" | "correlation" | "trend",
    "name": "Short descriptive name (max 100 chars)",
    "description": "Full description of the pattern (2-4 sentences)",
    "confidence": 0.0 to 1.0,
    "observationIds": ["uuid1", "uuid2", ...],
    "analysis": "Your reasoning for identifying this pattern",
    "recommendations": ["Action 1 to take based on this pattern", "Action 2..."]
  }
]

Rules:
- Only report patterns with confidence >= 0.5
- A pattern must be supported by at least 3 observations
- Include specific observation IDs that support each pattern
- Recommendations should be actionable
- Return empty array [] if no patterns detected`;
}

// ============================================
// Claude Integration
// ============================================

/**
 * Run Claude CLI for pattern analysis
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
        reject(new Error(`Pattern analysis timed out after ${timeoutMs}ms`));
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
 * Parse Claude's JSON response into structured results
 */
function parsePatternResponse(response: string, minConfidence: number): ClaudePatternResponse[] {
  // Try to find JSON array in response
  let jsonStr: string | null = null;

  // First try: entire response is JSON
  try {
    const trimmed = response.trim();
    if (trimmed.startsWith('[')) {
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

  // Third try: find JSON array anywhere in response
  if (!jsonStr) {
    const arrayMatch = response.match(/\[[\s\S]*\]/);
    if (arrayMatch) {
      jsonStr = arrayMatch[0];
    }
  }

  if (!jsonStr) {
    console.warn('[PatternAnalyzer] No JSON found in Claude response');
    return [];
  }

  try {
    const parsed = JSON.parse(jsonStr);

    if (!Array.isArray(parsed)) {
      console.warn('[PatternAnalyzer] Response is not an array');
      return [];
    }

    // Validate and filter patterns
    const validPatterns: ClaudePatternResponse[] = [];

    for (const item of parsed) {
      // Validate required fields
      if (!item.patternType || !item.name || !item.description ||
          typeof item.confidence !== 'number' || !Array.isArray(item.observationIds)) {
        console.warn('[PatternAnalyzer] Skipping pattern with missing fields:', item.name);
        continue;
      }

      // Filter by confidence
      if (item.confidence < minConfidence) {
        console.log(`[PatternAnalyzer] Skipping low-confidence pattern: ${item.name} (${item.confidence})`);
        continue;
      }

      // Filter by minimum observations
      if (item.observationIds.length < 3) {
        console.log(`[PatternAnalyzer] Skipping pattern with few observations: ${item.name} (${item.observationIds.length})`);
        continue;
      }

      validPatterns.push({
        patternType: item.patternType as PatternType,
        name: item.name.substring(0, 200),
        description: item.description,
        confidence: Math.min(1, Math.max(0, item.confidence)),
        observationIds: item.observationIds,
        analysis: item.analysis || '',
        recommendations: item.recommendations || [],
      });
    }

    return validPatterns;
  } catch (error) {
    console.error('[PatternAnalyzer] Failed to parse JSON:', error);
    return [];
  }
}

// ============================================
// Pattern Storage
// ============================================

/**
 * Store a new pattern or update an existing matching pattern
 */
async function storeOrUpdatePattern(
  detected: ClaudePatternResponse,
  observations: ObservationSummary[]
): Promise<PatternDetectionResult | null> {
  // Check for existing similar pattern
  const existing = await matchToExistingPattern(detected);

  // Get observation dates for first/last observed
  const matchingObs = observations.filter(o => detected.observationIds.includes(o.id));
  const dates = matchingObs.map(o => new Date(o.observedAt).getTime());
  const firstObserved = dates.length > 0 ? new Date(Math.min(...dates)) : new Date();
  const lastObserved = dates.length > 0 ? new Date(Math.max(...dates)) : new Date();

  if (existing) {
    // Update existing pattern with new observations
    const mergedObservationIds = [...new Set([...existing.observation_ids, ...detected.observationIds])];

    const updated = await patternRepository.updatePattern(existing.id, {
      observationIds: mergedObservationIds,
      confidence: (existing.confidence + detected.confidence) / 2, // Average confidence
      lastObserved,
      aiAnalysis: detected.analysis,
      aiRecommendations: detected.recommendations,
    });

    if (updated) {
      console.log(`[PatternAnalyzer] Updated existing pattern: ${existing.name}`);
      return {
        patternId: existing.id,
        isNew: false,
        patternType: detected.patternType,
        name: existing.name,
        description: existing.description,
        confidence: (existing.confidence + detected.confidence) / 2,
        observationCount: mergedObservationIds.length,
        aiAnalysis: detected.analysis,
        aiRecommendations: detected.recommendations,
      };
    }

    return null;
  }

  // Create new pattern
  const inserted = await patternRepository.insertPattern({
    patternType: detected.patternType,
    name: detected.name,
    description: detected.description,
    observationIds: detected.observationIds,
    confidence: detected.confidence,
    firstObserved,
    lastObserved,
    aiAnalysis: detected.analysis,
    aiRecommendations: detected.recommendations,
  });

  if (inserted) {
    console.log(`[PatternAnalyzer] Created new pattern: ${detected.name}`);
    return {
      patternId: inserted.id,
      isNew: true,
      patternType: detected.patternType,
      name: detected.name,
      description: detected.description,
      confidence: detected.confidence,
      observationCount: detected.observationIds.length,
      aiAnalysis: detected.analysis,
      aiRecommendations: detected.recommendations,
    };
  }

  return null;
}

/**
 * Check if a detected pattern matches an existing active pattern
 */
async function matchToExistingPattern(detected: ClaudePatternResponse): Promise<PatternRow | null> {
  // Get active patterns of the same type
  const existing = await patternRepository.queryPatterns({
    patternType: detected.patternType,
    status: 'active',
    limit: 50,
  });

  // Look for patterns with overlapping observations or similar names
  for (const pattern of existing) {
    // Check observation overlap
    const overlap = pattern.observation_ids.filter(id => detected.observationIds.includes(id));
    const overlapRatio = overlap.length / Math.max(pattern.observation_ids.length, detected.observationIds.length);

    if (overlapRatio > 0.3) {
      // 30% overlap = likely same pattern
      return pattern;
    }

    // Check name similarity (simple case-insensitive containment)
    const patternNameLower = pattern.name.toLowerCase();
    const detectedNameLower = detected.name.toLowerCase();

    if (patternNameLower.includes(detectedNameLower) || detectedNameLower.includes(patternNameLower)) {
      return pattern;
    }
  }

  return null;
}

// ============================================
// Utility Functions
// ============================================

/**
 * Check if analysis should run based on threshold
 */
export async function shouldTriggerAnalysis(): Promise<boolean> {
  const lastRun = await patternRepository.getLastCompletedAnalysisRun();
  const sinceDate = lastRun?.completed_at || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const count = await observationRepository.countObservationsSince(sinceDate);

  return count >= DEFAULT_CONFIG.minObservations;
}

/**
 * Get timestamp of most recent completed analysis
 */
export async function getLastAnalysisTime(): Promise<Date | null> {
  const lastRun = await patternRepository.getLastCompletedAnalysisRun();
  return lastRun?.completed_at || null;
}

/**
 * Trigger analysis if threshold is met (called from strategicObserver)
 */
export async function triggerAnalysisIfNeeded(): Promise<PatternAnalysisResult | null> {
  const shouldRun = await shouldTriggerAnalysis();

  if (shouldRun) {
    console.log('[PatternAnalyzer] Threshold reached, triggering analysis');
    return analyzePatterns();
  }

  return null;
}
