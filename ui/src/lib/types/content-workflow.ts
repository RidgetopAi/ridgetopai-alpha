/**
 * Content Generation Workflow Types
 * Instance 12 - First GROW capability
 *
 * This workflow enables AI-assisted content creation:
 * - Human directs (content brief)
 * - AI executes (research, draft, polish)
 * - Human verifies (review, edit, approve)
 */

// Content workflow states represent the progression through content creation
export type ContentWorkflowState =
  | 'draft'        // User is writing content brief
  | 'submitted'    // Brief submitted, gathering research
  | 'researching'  // AI is researching topic and context
  | 'generating'   // AI is generating content draft
  | 'proposed'     // AI has proposed content
  | 'reviewing'    // Human is reviewing the content
  | 'refining'     // AI is refining based on feedback
  | 'completed'    // Content is finalized
  | 'failed';      // Something went wrong

// Content format types
export type ContentFormat =
  | 'blog_post'         // Long-form blog article
  | 'tweet_thread'      // Twitter/X thread
  | 'documentation'     // Technical documentation
  | 'email'             // Email communication
  | 'announcement'      // Product announcement
  | 'case_study';       // Customer case study

// Audience type for targeting content tone
export type AudienceType =
  | 'developers'        // Technical developers
  | 'business'          // Business decision makers
  | 'general'           // General public
  | 'internal';         // Internal team

// Tone for content voice
export type ContentTone =
  | 'professional'      // Formal, business-appropriate
  | 'conversational'    // Casual, friendly
  | 'technical'         // Detailed, precise
  | 'educational';      // Teaching, explanatory

// Confidence level for AI generation
export type ContentConfidence = 'high' | 'medium' | 'low';

// Review decision options
export type ContentReviewDecision = 'approved' | 'needs_revision' | 'rejected';

// Content brief input from user
export interface ContentBrief {
  title: string;
  topic: string;
  format: ContentFormat;
  audience: AudienceType;
  tone: ContentTone;
  keyPoints?: string[];        // Main points to cover
  keywords?: string[];         // SEO/discovery keywords
  wordCount?: number;          // Target word count
  additionalContext?: string;  // Any extra context
}

// Research gathered for content creation
export interface ContentResearch {
  relatedContent?: string[];   // Related existing content
  competitorInsights?: string; // Competitor analysis
  audienceInsights?: string;   // Audience preferences
  topicalContext?: string;     // Current context for topic
  generatedAt: Date;
}

// Generated content structure
export interface GeneratedContent {
  title: string;               // Generated/refined title
  body: string;                // Main content body
  summary?: string;            // Short summary
  callToAction?: string;       // CTA if applicable
  metadata?: {
    readTime?: number;         // Estimated read time in minutes
    wordCount: number;
    targetKeywords?: string[];
  };
}

// AI content generation result
export interface ContentGeneration {
  content: GeneratedContent;
  confidence: ContentConfidence;
  suggestions?: string[];       // AI suggestions for improvement
  alternatives?: {             // Alternative approaches
    title: string;
    approach: string;
  }[];
  generatedAt: Date;
}

// Human review of generated content
export interface ContentReview {
  decision: ContentReviewDecision;
  feedback?: string;           // Specific feedback for revision
  edits?: string[];           // List of specific edits requested
  reviewedAt: Date;
}

// Refined content after revision
export interface ContentRefinement {
  originalVersion: number;
  content: GeneratedContent;
  changesApplied: string[];
  refinedAt: Date;
}

// Final output ready for publishing
export interface FinalContent {
  content: GeneratedContent;
  format: ContentFormat;
  readyForPlatform: boolean;
  exportFormats?: ('markdown' | 'html' | 'plain')[];
  completedAt: Date;
}

// The complete content workflow entity
export interface ContentWorkflow {
  id: string;
  state: ContentWorkflowState;
  createdAt: Date;
  updatedAt: Date;

  // Step 1: Content Brief
  brief: ContentBrief;

  // Step 2: Research (optional until gathered)
  research?: ContentResearch;

  // Step 3-4: Generation (optional until generated)
  generation?: ContentGeneration;

  // Step 5: Review (optional until reviewed)
  review?: ContentReview;

  // Step 6: Refinement (optional, may have multiple)
  refinements?: ContentRefinement[];

  // Step 7: Final Content (optional until finalized)
  finalContent?: FinalContent;

  // Error information if failed
  error?: {
    message: string;
    step: ContentWorkflowState;
    occurredAt: Date;
  };
}

// State labels for display
export const CONTENT_STATE_LABELS: Record<ContentWorkflowState, string> = {
  draft: 'Draft',
  submitted: 'Gathering Research',
  researching: 'Researching Topic',
  generating: 'Generating Content',
  proposed: 'Content Proposed',
  reviewing: 'Under Review',
  refining: 'Refining Content',
  completed: 'Completed',
  failed: 'Failed',
};

// Format labels for display
export const FORMAT_LABELS: Record<ContentFormat, string> = {
  blog_post: 'Blog Post',
  tweet_thread: 'Tweet Thread',
  documentation: 'Documentation',
  email: 'Email',
  announcement: 'Announcement',
  case_study: 'Case Study',
};

// Audience labels for display
export const AUDIENCE_LABELS: Record<AudienceType, string> = {
  developers: 'Developers',
  business: 'Business',
  general: 'General Public',
  internal: 'Internal Team',
};

// Tone labels for display
export const TONE_LABELS: Record<ContentTone, string> = {
  professional: 'Professional',
  conversational: 'Conversational',
  technical: 'Technical',
  educational: 'Educational',
};

// State progression order (for progress bar)
export const CONTENT_STATE_ORDER: ContentWorkflowState[] = [
  'draft',
  'submitted',
  'researching',
  'generating',
  'proposed',
  'reviewing',
  'refining',
  'completed',
];

// Helper to check if a state is before another
export function isContentStateBefore(current: ContentWorkflowState, target: ContentWorkflowState): boolean {
  const currentIndex = CONTENT_STATE_ORDER.indexOf(current);
  const targetIndex = CONTENT_STATE_ORDER.indexOf(target);
  return currentIndex < targetIndex && current !== 'failed';
}

// Helper to check if a state is active or complete
export function isContentStateActiveOrComplete(current: ContentWorkflowState, step: ContentWorkflowState): boolean {
  if (current === 'failed') return false;
  if (current === 'completed') return true;
  const currentIndex = CONTENT_STATE_ORDER.indexOf(current);
  const stepIndex = CONTENT_STATE_ORDER.indexOf(step);
  return currentIndex >= stepIndex;
}
