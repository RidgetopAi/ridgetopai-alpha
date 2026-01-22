/**
 * Content Workflow Store - Content Generation Workflow State Management
 * Instance 12 - First GROW capability
 *
 * This store manages the content generation workflow:
 * - Human directs (content brief)
 * - AI executes (research, generation)
 * - Human verifies (review, approve, request changes)
 */

import { create } from 'zustand';
import type {
  ContentWorkflow,
  ContentWorkflowState,
  ContentBrief,
  ContentGeneration,
  ContentReview,
  ContentRefinement,
  FinalContent,
  GeneratedContent,
} from '../lib/types/content-workflow';
import {
  executeContentGeneration,
  executeContentRefinement,
  toContentGeneration,
  toContentRefinement,
} from '../lib/api/contentRunner';

// Feature flag: set to true to use real backend, false for mock
const USE_REAL_BACKEND = import.meta.env.VITE_USE_REAL_BACKEND === 'true';

interface ContentWorkflowStore {
  // State
  workflows: ContentWorkflow[];
  activeWorkflow: ContentWorkflow | null;
  isLoading: boolean;
  error: string | null;
  useRealBackend: boolean;

  // Actions - Workflow Lifecycle
  createWorkflow: (brief: ContentBrief) => string;
  submitWorkflow: (id: string, brandContext?: string) => Promise<void>;
  transitionState: (id: string, newState: ContentWorkflowState) => void;
  failWorkflow: (id: string, error: string, step: ContentWorkflowState) => void;

  // Actions - Workflow Data
  setGeneration: (id: string, generation: ContentGeneration) => void;
  setReview: (id: string, review: ContentReview) => void;
  addRefinement: (id: string, refinement: ContentRefinement) => void;
  setFinalContent: (id: string, finalContent: FinalContent) => void;

  // Actions - Selection
  selectWorkflow: (id: string | null) => void;
  getWorkflow: (id: string) => ContentWorkflow | undefined;

  // Actions - Cleanup
  clearWorkflows: () => void;
  deleteWorkflow: (id: string) => void;

  // Actions - Config
  setUseRealBackend: (value: boolean) => void;
}

const generateId = () => Math.random().toString(36).substring(2, 11);

// Mock generation data for testing the UI (fallback when backend unavailable)
const createMockGeneration = (brief: ContentBrief): ContentGeneration => ({
  content: {
    title: brief.title,
    body: `# ${brief.title}

This is mock-generated content for testing purposes.

## Introduction

Based on your brief about "${brief.topic}", here is a comprehensive ${brief.format.replace('_', ' ')} tailored for ${brief.audience}.

## Key Points

${(brief.keyPoints || ['First point', 'Second point', 'Third point']).map(p => `- ${p}`).join('\n')}

## Conclusion

This content demonstrates the workflow capabilities. In production, real AI-generated content would appear here with proper formatting, insights, and value tailored to your specifications.

---

*Generated for ${brief.audience} audience with ${brief.tone} tone.*
`,
    summary: `A ${brief.format.replace('_', ' ')} about ${brief.topic} for ${brief.audience}.`,
    callToAction: 'Learn more by visiting our website.',
    metadata: {
      wordCount: 150,
      readTime: 1,
      targetKeywords: brief.keywords || [],
    },
  },
  confidence: 'medium',
  suggestions: [
    'Consider adding specific examples or case studies',
    'Could be repurposed as a tweet thread',
    'Add visual elements for better engagement',
  ],
  alternatives: [
    {
      title: `${brief.title} - Alternative Angle`,
      approach: 'Focus more on practical tips and actionable advice',
    },
  ],
  generatedAt: new Date(),
});

// Mock refinement result
const createMockRefinement = (
  original: GeneratedContent,
  feedback: string,
  version: number
): ContentRefinement => ({
  originalVersion: version,
  content: {
    ...original,
    body: original.body + `\n\n---\n\n**Refinement Applied:**\nBased on feedback: "${feedback.substring(0, 50)}..."\n\nContent has been updated to address your concerns.`,
    metadata: original.metadata ? {
      ...original.metadata,
      wordCount: (original.metadata.wordCount || 0) + 30,
    } : undefined,
  },
  changesApplied: [
    `Addressed feedback: ${feedback.substring(0, 50)}...`,
    'Updated content structure',
    'Improved clarity',
  ],
  refinedAt: new Date(),
});

export const useContentWorkflowStore = create<ContentWorkflowStore>((set, get) => ({
  workflows: [],
  activeWorkflow: null,
  isLoading: false,
  error: null,
  useRealBackend: USE_REAL_BACKEND,

  createWorkflow: (brief) => {
    const id = generateId();
    const workflow: ContentWorkflow = {
      id,
      state: 'draft',
      createdAt: new Date(),
      updatedAt: new Date(),
      brief,
    };

    set((state) => ({
      workflows: [...state.workflows, workflow],
      activeWorkflow: workflow,
    }));

    return id;
  },

  submitWorkflow: async (id, brandContext) => {
    const workflow = get().workflows.find((w) => w.id === id);
    if (!workflow || workflow.state !== 'draft') return;

    // Start the workflow - transition to submitted
    get().transitionState(id, 'submitted');

    const useReal = get().useRealBackend;

    if (useReal) {
      // Real backend execution
      try {
        get().transitionState(id, 'generating');

        console.log('[ContentWorkflowStore] Calling ContentRunner backend...');
        const response = await executeContentGeneration(id, workflow.brief, brandContext);

        if (response.success && response.generation) {
          const generation = toContentGeneration(response);
          if (generation) {
            get().setGeneration(id, generation);
            get().transitionState(id, 'proposed');
            console.log('[ContentWorkflowStore] Generation complete:', generation.confidence);
          } else {
            get().failWorkflow(id, 'Failed to parse generation result', 'generating');
          }
        } else {
          get().failWorkflow(id, response.error || 'Generation failed', 'generating');
          console.error('[ContentWorkflowStore] Generation failed:', response.error);
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        get().failWorkflow(id, errorMessage, 'generating');
        console.error('[ContentWorkflowStore] Backend error:', errorMessage);
      }
    } else {
      // Mock execution (for UI testing)
      setTimeout(() => {
        get().transitionState(id, 'researching');

        setTimeout(() => {
          get().transitionState(id, 'generating');

          setTimeout(() => {
            const w = get().workflows.find((wf) => wf.id === id);
            if (!w) return;

            const generation = createMockGeneration(w.brief);
            get().setGeneration(id, generation);
            get().transitionState(id, 'proposed');
          }, 2000);
        }, 1500);
      }, 1000);
    }
  },

  transitionState: (id, newState) => {
    set((state) => ({
      workflows: state.workflows.map((w) =>
        w.id === id ? { ...w, state: newState, updatedAt: new Date() } : w
      ),
      activeWorkflow:
        state.activeWorkflow?.id === id
          ? { ...state.activeWorkflow, state: newState, updatedAt: new Date() }
          : state.activeWorkflow,
    }));
  },

  failWorkflow: (id, errorMessage, step) => {
    set((state) => ({
      workflows: state.workflows.map((w) =>
        w.id === id
          ? {
              ...w,
              state: 'failed' as ContentWorkflowState,
              updatedAt: new Date(),
              error: { message: errorMessage, step, occurredAt: new Date() },
            }
          : w
      ),
      activeWorkflow:
        state.activeWorkflow?.id === id
          ? {
              ...state.activeWorkflow,
              state: 'failed' as ContentWorkflowState,
              error: { message: errorMessage, step, occurredAt: new Date() },
            }
          : state.activeWorkflow,
    }));
  },

  setGeneration: (id, generation) => {
    set((state) => ({
      workflows: state.workflows.map((w) =>
        w.id === id ? { ...w, generation, updatedAt: new Date() } : w
      ),
      activeWorkflow:
        state.activeWorkflow?.id === id
          ? { ...state.activeWorkflow, generation, updatedAt: new Date() }
          : state.activeWorkflow,
    }));
  },

  setReview: (id, review) => {
    set((state) => ({
      workflows: state.workflows.map((w) =>
        w.id === id ? { ...w, review, updatedAt: new Date() } : w
      ),
      activeWorkflow:
        state.activeWorkflow?.id === id
          ? { ...state.activeWorkflow, review, updatedAt: new Date() }
          : state.activeWorkflow,
    }));

    // Handle review decision
    if (review.decision === 'approved') {
      // Finalize the content
      const workflow = get().workflows.find((w) => w.id === id);
      if (workflow?.generation) {
        const finalContent: FinalContent = {
          content: workflow.generation.content,
          format: workflow.brief.format,
          readyForPlatform: true,
          exportFormats: ['markdown', 'html', 'plain'],
          completedAt: new Date(),
        };
        get().setFinalContent(id, finalContent);
        get().transitionState(id, 'completed');
      }
    } else if (review.decision === 'needs_revision') {
      // Start refinement
      const workflow = get().workflows.find((w) => w.id === id);
      const useReal = get().useRealBackend;

      if (useReal && workflow?.generation && review.feedback) {
        // Real backend refinement
        (async () => {
          try {
            get().transitionState(id, 'refining');
            console.log('[ContentWorkflowStore] Calling refinement...');

            const response = await executeContentRefinement(
              id,
              workflow.generation!.content,
              review.feedback!,
              review.edits
            );

            if (response.success && response.refinement) {
              const refinementCount = workflow.refinements?.length || 0;
              const refinement = toContentRefinement(response, refinementCount);
              if (refinement) {
                get().addRefinement(id, refinement);
                // Update generation with refined content
                get().setGeneration(id, {
                  ...workflow.generation!,
                  content: refinement.content,
                  generatedAt: new Date(),
                });
                get().transitionState(id, 'proposed');
                console.log('[ContentWorkflowStore] Refinement complete');
              } else {
                get().failWorkflow(id, 'Failed to parse refinement result', 'refining');
              }
            } else {
              get().failWorkflow(id, response.error || 'Refinement failed', 'refining');
            }
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            get().failWorkflow(id, errorMessage, 'refining');
          }
        })();
      } else if (workflow?.generation && review.feedback) {
        // Mock refinement
        get().transitionState(id, 'refining');

        setTimeout(() => {
          const w = get().workflows.find((wf) => wf.id === id);
          if (!w?.generation) return;

          const refinementCount = w.refinements?.length || 0;
          const refinement = createMockRefinement(w.generation.content, review.feedback!, refinementCount);
          get().addRefinement(id, refinement);
          // Update generation with refined content
          get().setGeneration(id, {
            ...w.generation,
            content: refinement.content,
            generatedAt: new Date(),
          });
          get().transitionState(id, 'proposed');
        }, 2000);
      }
    } else if (review.decision === 'rejected') {
      get().failWorkflow(id, 'Content rejected by reviewer', 'reviewing');
    }
  },

  addRefinement: (id, refinement) => {
    set((state) => ({
      workflows: state.workflows.map((w) =>
        w.id === id
          ? {
              ...w,
              refinements: [...(w.refinements || []), refinement],
              updatedAt: new Date(),
            }
          : w
      ),
      activeWorkflow:
        state.activeWorkflow?.id === id
          ? {
              ...state.activeWorkflow,
              refinements: [...(state.activeWorkflow.refinements || []), refinement],
              updatedAt: new Date(),
            }
          : state.activeWorkflow,
    }));
  },

  setFinalContent: (id, finalContent) => {
    set((state) => ({
      workflows: state.workflows.map((w) =>
        w.id === id ? { ...w, finalContent, updatedAt: new Date() } : w
      ),
      activeWorkflow:
        state.activeWorkflow?.id === id
          ? { ...state.activeWorkflow, finalContent, updatedAt: new Date() }
          : state.activeWorkflow,
    }));
  },

  selectWorkflow: (id) => {
    if (!id) {
      set({ activeWorkflow: null });
      return;
    }
    const workflow = get().workflows.find((w) => w.id === id);
    set({ activeWorkflow: workflow || null });
  },

  getWorkflow: (id) => {
    return get().workflows.find((w) => w.id === id);
  },

  clearWorkflows: () => {
    set({ workflows: [], activeWorkflow: null });
  },

  deleteWorkflow: (id) => {
    set((state) => ({
      workflows: state.workflows.filter((w) => w.id !== id),
      activeWorkflow: state.activeWorkflow?.id === id ? null : state.activeWorkflow,
    }));
  },

  setUseRealBackend: (value) => {
    set({ useRealBackend: value });
  },
}));
