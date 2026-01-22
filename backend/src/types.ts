/**
 * TaskRunner Types
 * Instance 10 - Backend for business workflows
 */

import { z } from 'zod';

// Severity levels for bugs
export const SeveritySchema = z.enum(['blocker', 'major', 'minor']);
export type Severity = z.infer<typeof SeveritySchema>;

// Bug report from UI
export const BugReportSchema = z.object({
  title: z.string().min(1),
  description: z.string().min(1),
  stepsToReproduce: z.string().optional(),
  expectedBehavior: z.string().optional(),
  actualBehavior: z.string().optional(),
  severity: SeveritySchema,
});
export type BugReport = z.infer<typeof BugReportSchema>;

// Request to execute bug fix analysis
export const BugFixRequestSchema = z.object({
  workflowId: z.string(),
  bugReport: BugReportSchema,
  projectPath: z.string().optional(),
});
export type BugFixRequest = z.infer<typeof BugFixRequestSchema>;

// Confidence level for analysis
export type Confidence = 'high' | 'medium' | 'low';

// Proposed code change
export interface CodeChange {
  file: string;
  original: string;
  proposed: string;
  explanation?: string;
}

// Analysis result from AI
export interface BugAnalysis {
  rootCause: string;
  evidence: string;
  confidence: Confidence;
  questions?: string[];
  proposedFix?: {
    explanation: string;
    changes: CodeChange[];
    risks: string[];
    testNeeds: string[];
  };
  rawOutput?: string;
}

// Task execution result
export interface TaskResult<T> {
  success: boolean;
  data?: T;
  error?: string;
  durationMs: number;
}

// Workflow status updates
export type WorkflowStatus =
  | 'gathering_context'
  | 'analyzing'
  | 'proposing_fix'
  | 'implementing'
  | 'verifying'
  | 'completed'
  | 'failed';

export interface WorkflowUpdate {
  workflowId: string;
  status: WorkflowStatus;
  message?: string;
  progress?: number;
  result?: BugAnalysis;
  implementationResult?: ImplementationResult;
}

// Implementation request - sent after user approves a fix
export const ImplementRequestSchema = z.object({
  workflowId: z.string(),
  approvedChanges: z.array(z.object({
    file: z.string(),
    original: z.string(),
    proposed: z.string(),
    explanation: z.string().optional(),
  })),
  projectPath: z.string().optional(),
  runTests: z.boolean().optional().default(true),
});
export type ImplementRequest = z.infer<typeof ImplementRequestSchema>;

// Test result from running tests after implementation
export interface TestResult {
  passed: number;
  failed: number;
  skipped: number;
  duration: number; // ms
  output?: string;
}

// Implementation result from AI
export interface ImplementationResult {
  success: boolean;
  changedFiles: string[];
  testResults?: TestResult;
  warnings: string[];
  errors: string[];
  rawOutput?: string;
}

// ==========================================
// Content Generation Types (Instance 12 - GROW)
// ==========================================

// Content format types
export const ContentFormatSchema = z.enum([
  'blog_post',
  'tweet_thread',
  'documentation',
  'email',
  'announcement',
  'case_study',
]);
export type ContentFormat = z.infer<typeof ContentFormatSchema>;

// Audience type for targeting content tone
export const AudienceTypeSchema = z.enum([
  'developers',
  'business',
  'general',
  'internal',
]);
export type AudienceType = z.infer<typeof AudienceTypeSchema>;

// Tone for content voice
export const ContentToneSchema = z.enum([
  'professional',
  'conversational',
  'technical',
  'educational',
]);
export type ContentTone = z.infer<typeof ContentToneSchema>;

// Content brief from UI
export const ContentBriefSchema = z.object({
  title: z.string().min(1),
  topic: z.string().min(1),
  format: ContentFormatSchema,
  audience: AudienceTypeSchema,
  tone: ContentToneSchema,
  keyPoints: z.array(z.string()).optional(),
  keywords: z.array(z.string()).optional(),
  wordCount: z.number().optional(),
  additionalContext: z.string().optional(),
});
export type ContentBrief = z.infer<typeof ContentBriefSchema>;

// Request to generate content
export const ContentGenerationRequestSchema = z.object({
  workflowId: z.string(),
  brief: ContentBriefSchema,
  brandContext: z.string().optional(),  // Brand voice/guidelines
});
export type ContentGenerationRequest = z.infer<typeof ContentGenerationRequestSchema>;

// Generated content structure
export interface GeneratedContent {
  title: string;
  body: string;
  summary?: string;
  callToAction?: string;
  metadata?: {
    readTime?: number;
    wordCount: number;
    targetKeywords?: string[];
  };
}

// Content generation result from AI
export interface ContentGenerationResult {
  content: GeneratedContent;
  confidence: Confidence;
  suggestions?: string[];
  alternatives?: {
    title: string;
    approach: string;
  }[];
  rawOutput?: string;
}

// Request to refine content based on feedback
export const ContentRefineRequestSchema = z.object({
  workflowId: z.string(),
  originalContent: z.object({
    title: z.string(),
    body: z.string(),
    summary: z.string().optional(),
    callToAction: z.string().optional(),
  }),
  feedback: z.string(),
  specificEdits: z.array(z.string()).optional(),
});
export type ContentRefineRequest = z.infer<typeof ContentRefineRequestSchema>;

// Refinement result from AI
export interface ContentRefinementResult {
  content: GeneratedContent;
  changesApplied: string[];
  rawOutput?: string;
}

// Content workflow status
export type ContentWorkflowStatus =
  | 'researching'
  | 'generating'
  | 'refining'
  | 'completed'
  | 'failed';
