/**
 * Strategic Observer - Observation capture for Strategic Layer
 * Phase 1: Observation Layer
 *
 * This module captures workflow completions as structured observations
 * for later pattern analysis by Phase 2 (Pattern Detection).
 *
 * The Observer is called after each workflow stores its completion to Mandrel.
 * It extracts relevant data and stores it in the pattern_observations table.
 */

import type {
  WorkflowCompletion,
  TicketCompletion,
  AlertCompletion,
} from '../mandrelClient.js';
import type {
  BugReport,
  BugAnalysis,
  ContentBrief,
  ContentGenerationResult,
  SupportTicket,
  TicketAnalysis,
  MonitoringAlert,
  AlertAnalysis,
} from '../types.js';
import {
  insertObservation,
  countObservationsSince,
  type ObservationInput,
} from './db/observationRepository.js';
// Phase 2 import - lazy loaded to avoid circular dependency
let patternAnalyzerModule: typeof import('./patternAnalyzer.js') | null = null;

async function getPatternAnalyzer() {
  if (!patternAnalyzerModule) {
    patternAnalyzerModule = await import('./patternAnalyzer.js');
  }
  return patternAnalyzerModule;
}

// ============================================
// Configuration
// ============================================

// Threshold for triggering pattern analysis (Phase 2)
// When this many new observations accumulate since last analysis, trigger analysis
const OBSERVATION_THRESHOLD = 10;

// Date of last pattern analysis (will be set by patternAnalyzer in Phase 2)
let lastAnalysisDate: Date | null = null;

/**
 * Set the last analysis date (called by patternAnalyzer after completing analysis)
 */
export function setLastAnalysisDate(date: Date): void {
  lastAnalysisDate = date;
  console.log(`[StrategicObserver] Last analysis date set to: ${date.toISOString()}`);
}

/**
 * Get the last analysis date
 */
export function getLastAnalysisDate(): Date | null {
  return lastAnalysisDate;
}

// ============================================
// Core Recording Functions
// ============================================

/**
 * Record a generic observation
 * Low-level function used by workflow-specific recorders
 */
export async function recordObservation(input: ObservationInput): Promise<string | null> {
  console.log(`[StrategicObserver] Recording observation for ${input.sourceWorkflow} workflow`);

  const result = await insertObservation(input);

  if (result) {
    console.log(`[StrategicObserver] Observation ${result.id} recorded successfully`);

    // Check if we should trigger pattern analysis (Phase 2)
    // This is a fire-and-forget async call to avoid blocking the workflow
    checkAndTriggerAnalysis().catch(err => {
      console.error('[StrategicObserver] Error checking analysis trigger:', err);
    });

    return result.id;
  }

  console.error('[StrategicObserver] Failed to record observation');
  return null;
}

/**
 * Check if observation threshold has been reached for pattern analysis
 * Called after each observation insert
 */
async function checkAndTriggerAnalysis(): Promise<void> {
  // If no last analysis date, use 7 days ago as default
  const sinceDate = lastAnalysisDate || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const newObservations = await countObservationsSince(sinceDate);

  if (newObservations >= OBSERVATION_THRESHOLD) {
    console.log(`[StrategicObserver] Threshold reached (${newObservations} observations). Triggering pattern analysis.`);

    // Phase 2: Trigger pattern analysis asynchronously
    try {
      const patternAnalyzer = await getPatternAnalyzer();
      // Fire-and-forget - don't block observation recording
      patternAnalyzer.analyzePatterns().catch(err => {
        console.error('[StrategicObserver] Threshold-triggered pattern analysis failed:', err);
      });
    } catch (err) {
      console.error('[StrategicObserver] Failed to load pattern analyzer:', err);
    }
  }
}

// ============================================
// Workflow-Specific Recording Functions
// ============================================

/**
 * Record a bugfix workflow completion
 */
export async function recordBugfixCompletion(completion: WorkflowCompletion): Promise<string | null> {
  if (completion.type !== 'bugfix') {
    console.error('[StrategicObserver] Expected bugfix completion, got:', completion.type);
    return null;
  }

  const input = completion.input as BugReport;
  const output = completion.output as BugAnalysis;

  // Determine outcome based on stage and review
  let outcome: string;
  if (completion.stage === 'proposed') {
    outcome = 'proposed';
  } else if (completion.review?.decision === 'approved') {
    outcome = 'success';
  } else if (completion.review?.decision === 'rejected') {
    outcome = 'failure';
  } else if (completion.review?.decision === 'changes_requested') {
    outcome = 'partial';
  } else {
    outcome = 'unknown';
  }

  // Extract confidence as number
  const confidenceMap: Record<string, number> = {
    high: 0.9,
    medium: 0.6,
    low: 0.3,
  };
  const confidenceScore = confidenceMap[output.confidence] || 0.5;

  // Build tags for searchability
  const tags = [
    'bugfix',
    completion.capability.toLowerCase(),
    `severity-${input.severity}`,
    `confidence-${output.confidence}`,
    completion.stage || 'confirmed',
  ];

  if (output.proposedFix) {
    tags.push('has-fix');
    tags.push(`files-${output.proposedFix.changes.length}`);
  }

  if (completion.review?.decision) {
    tags.push(`review-${completion.review.decision}`);
  }

  return recordObservation({
    observationType: 'workflow_completion',
    sourceWorkflow: 'bugfix',
    sourceCapability: completion.capability,
    payload: {
      workflowId: completion.workflowId,
      stage: completion.stage,
      input: {
        title: input.title,
        severity: input.severity,
        hasStepsToReproduce: !!input.stepsToReproduce,
      },
      output: {
        rootCause: output.rootCause,
        confidence: output.confidence,
        hasProposedFix: !!output.proposedFix,
        filesChanged: output.proposedFix?.changes.map(c => c.file) || [],
        risksIdentified: output.proposedFix?.risks.length || 0,
      },
      review: completion.review,
    },
    outcome,
    confidenceScore,
    tags,
    observedAt: completion.completedAt,
  });
}

/**
 * Record a content workflow completion
 */
export async function recordContentCompletion(completion: WorkflowCompletion): Promise<string | null> {
  if (completion.type !== 'content') {
    console.error('[StrategicObserver] Expected content completion, got:', completion.type);
    return null;
  }

  const input = completion.input as ContentBrief;
  const output = completion.output as ContentGenerationResult;

  // Determine outcome based on review
  let outcome: string;
  if (completion.review?.decision === 'approved') {
    outcome = 'success';
  } else if (completion.review?.decision === 'rejected') {
    outcome = 'failure';
  } else if (completion.review?.decision === 'changes_requested') {
    outcome = 'partial';
  } else {
    outcome = 'success'; // Default for content is success unless reviewed
  }

  // Extract confidence as number
  const confidenceMap: Record<string, number> = {
    high: 0.9,
    medium: 0.6,
    low: 0.3,
  };
  const confidenceScore = confidenceMap[output.confidence] || 0.5;

  // Build tags
  const tags = [
    'content',
    completion.capability.toLowerCase(),
    `format-${input.format}`,
    `audience-${input.audience}`,
    `tone-${input.tone}`,
    `confidence-${output.confidence}`,
  ];

  if (completion.review?.decision) {
    tags.push(`review-${completion.review.decision}`);
  }

  if (input.keywords && input.keywords.length > 0) {
    tags.push('has-keywords');
  }

  return recordObservation({
    observationType: 'workflow_completion',
    sourceWorkflow: 'content',
    sourceCapability: completion.capability,
    payload: {
      workflowId: completion.workflowId,
      input: {
        title: input.title,
        topic: input.topic,
        format: input.format,
        audience: input.audience,
        tone: input.tone,
        hasKeyPoints: !!input.keyPoints && input.keyPoints.length > 0,
        requestedWordCount: input.wordCount,
      },
      output: {
        title: output.content.title,
        wordCount: output.content.metadata?.wordCount,
        readTime: output.content.metadata?.readTime,
        confidence: output.confidence,
        alternativesOffered: output.alternatives?.length || 0,
      },
      review: completion.review,
    },
    outcome,
    confidenceScore,
    tags,
    observedAt: completion.completedAt,
  });
}

/**
 * Record a support ticket workflow completion
 */
export async function recordTicketCompletion(completion: TicketCompletion): Promise<string | null> {
  const input = completion.input;
  const output = completion.output;

  // Determine outcome based on response status
  let outcome: string;
  if (completion.response) {
    outcome = 'success'; // Response was sent
  } else if (output.actionRequired.type === 'no_action') {
    outcome = 'success'; // No action needed
  } else {
    outcome = 'pending'; // Still needs action
  }

  // Extract confidence as number
  const confidenceMap: Record<string, number> = {
    high: 0.9,
    medium: 0.6,
    low: 0.3,
  };
  const confidenceScore = confidenceMap[output.confidence] || 0.5;

  // Build tags
  const tags = [
    'support',
    completion.capability.toLowerCase(),
    `category-${input.category}`,
    `severity-${input.severity}`,
    `action-${output.actionRequired.type}`,
    `confidence-${output.confidence}`,
  ];

  if (completion.response) {
    tags.push('responded');
  }

  if (output.workaround) {
    tags.push('has-workaround');
  }

  if (input.affectedFeature) {
    tags.push(`feature-${input.affectedFeature.toLowerCase().replace(/\s+/g, '-')}`);
  }

  return recordObservation({
    observationType: 'workflow_completion',
    sourceWorkflow: 'support',
    sourceCapability: completion.capability,
    payload: {
      workflowId: completion.workflowId,
      input: {
        title: input.title,
        category: input.category,
        severity: input.severity,
        affectedFeature: input.affectedFeature,
        hasErrorMessage: !!input.errorMessage,
        hasAttachments: (input.attachments?.length || 0) > 0,
      },
      output: {
        summary: output.summary,
        rootCause: output.rootCause,
        impact: output.impact,
        confidence: output.confidence,
        actionType: output.actionRequired.type,
        hasWorkaround: !!output.workaround,
        affectedUsers: output.affectedUsers,
      },
      response: completion.response ? {
        sentTo: completion.response.sentTo,
        sentAt: completion.response.sentAt,
      } : null,
    },
    outcome,
    confidenceScore,
    tags,
    observedAt: completion.completedAt,
  });
}

/**
 * Record a monitoring alert workflow completion
 */
export async function recordAlertCompletion(completion: AlertCompletion): Promise<string | null> {
  const input = completion.input;
  const output = completion.output;

  // Determine outcome based on remediation status
  let outcome: string;
  if (completion.remediation) {
    outcome = 'success'; // Remediation was executed
  } else if (output.suggestedRemediation.type === 'none') {
    outcome = 'success'; // No remediation needed
  } else {
    outcome = 'pending'; // Still needs remediation
  }

  // Extract confidence as number
  const confidenceMap: Record<string, number> = {
    high: 0.9,
    medium: 0.6,
    low: 0.3,
  };
  const confidenceScore = confidenceMap[output.confidence] || 0.5;

  // Build tags
  const tags = [
    'monitoring',
    completion.capability.toLowerCase(),
    `category-${input.category}`,
    `severity-${input.severity}`,
    `source-${input.source}`,
    `remediation-${output.suggestedRemediation.type}`,
    `urgency-${output.urgency}`,
    `confidence-${output.confidence}`,
  ];

  if (completion.remediation) {
    tags.push('remediated');
  }

  if (input.affectedService) {
    tags.push(`service-${input.affectedService.toLowerCase().replace(/\s+/g, '-')}`);
  }

  if (output.suggestedRemediation.estimatedDowntime) {
    tags.push('has-downtime');
  }

  return recordObservation({
    observationType: 'workflow_completion',
    sourceWorkflow: 'monitoring',
    sourceCapability: completion.capability,
    payload: {
      workflowId: completion.workflowId,
      input: {
        title: input.title,
        category: input.category,
        severity: input.severity,
        source: input.source,
        affectedService: input.affectedService,
        hasMetricValue: !!input.metricValue,
        hasThreshold: !!input.threshold,
      },
      output: {
        summary: output.summary,
        rootCause: output.rootCause,
        impact: output.impact,
        urgency: output.urgency,
        affectedSystems: output.affectedSystems,
        confidence: output.confidence,
        remediationType: output.suggestedRemediation.type,
        remediationSteps: output.suggestedRemediation.steps.length,
        risksIdentified: output.suggestedRemediation.risks.length,
        estimatedDowntime: output.suggestedRemediation.estimatedDowntime,
      },
      remediation: completion.remediation ? {
        action: completion.remediation.action,
        executedAt: completion.remediation.executedAt,
        hasNotes: !!completion.remediation.notes,
      } : null,
    },
    outcome,
    confidenceScore,
    tags,
    observedAt: completion.completedAt,
  });
}

// ============================================
// Unified Recording Function
// ============================================

/**
 * Record any type of workflow completion
 * Dispatches to the appropriate workflow-specific recorder
 */
export async function recordWorkflowCompletion(
  completion: WorkflowCompletion | TicketCompletion | AlertCompletion
): Promise<string | null> {
  switch (completion.type) {
    case 'bugfix':
    case 'content':
      return completion.type === 'bugfix'
        ? recordBugfixCompletion(completion as WorkflowCompletion)
        : recordContentCompletion(completion as WorkflowCompletion);

    case 'support':
      return recordTicketCompletion(completion as TicketCompletion);

    case 'monitoring':
      return recordAlertCompletion(completion as AlertCompletion);

    default:
      console.error('[StrategicObserver] Unknown workflow type:', (completion as { type: string }).type);
      return null;
  }
}
