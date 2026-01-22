/**
 * Workflow Store - Bug Fix Workflow State Management
 * Instance 09 - First PRODUCE capability
 * Instance 10 - Added real AI integration via TaskRunner backend
 * Instance 11 - Fixed submitWorkflow type signature (void -> Promise<void>)
 * Instance 11b - Added real AI integration for implementation phase
 */

import { create } from 'zustand';
import type {
  BugFixWorkflow,
  WorkflowState,
  BugReport,
  BugAnalysis,
  FixReview,
  Implementation,
} from '../lib/types/workflow';
import { executeBugFix, executeImplementation, toImplementation } from '../lib/api/taskRunner';

// Feature flag: set to true to use real backend, false for mock
const USE_REAL_BACKEND = import.meta.env.VITE_USE_REAL_BACKEND === 'true';

interface WorkflowStore {
  // State
  workflows: BugFixWorkflow[];
  activeWorkflow: BugFixWorkflow | null;
  isLoading: boolean;
  error: string | null;
  useRealBackend: boolean;

  // Actions - Workflow Lifecycle
  createWorkflow: (bugReport: BugReport) => string;
  submitWorkflow: (id: string, projectPath?: string) => Promise<void>;
  transitionState: (id: string, newState: WorkflowState) => void;
  failWorkflow: (id: string, error: string, step: WorkflowState) => void;

  // Actions - Workflow Data
  setAnalysis: (id: string, analysis: BugAnalysis) => void;
  setReview: (id: string, review: FixReview) => void;
  setImplementation: (id: string, implementation: Implementation) => void;

  // Actions - Selection
  selectWorkflow: (id: string | null) => void;
  getWorkflow: (id: string) => BugFixWorkflow | undefined;

  // Actions - Cleanup
  clearWorkflows: () => void;
  deleteWorkflow: (id: string) => void;

  // Actions - Config
  setUseRealBackend: (value: boolean) => void;
}

const generateId = () => Math.random().toString(36).substring(2, 11);

// Mock analysis data for testing the UI (fallback when backend unavailable)
const createMockAnalysis = (bugReport: BugReport): BugAnalysis => ({
  rootCause: `Based on the description "${bugReport.title}", the issue appears to be related to state management or data flow. The symptoms suggest that either the data is not being properly validated before use, or there's a race condition in the update logic.`,
  evidence: `Found relevant code patterns in the codebase that match this behavior. The affected area likely involves component state updates or API response handling.`,
  confidence: 'medium',
  proposedFix: {
    explanation: 'Add proper validation and null checks before processing the data. This will prevent the error state from occurring.',
    changes: [
      {
        file: 'src/components/Example.tsx',
        original: `function handleData(data) {
  processData(data.value);
}`,
        proposed: `function handleData(data) {
  if (!data?.value) {
    console.warn('Invalid data received');
    return;
  }
  processData(data.value);
}`,
      },
    ],
    risks: ['Minimal risk - adds defensive coding'],
    testNeeds: ['Unit test for null/undefined cases', 'Integration test for error path'],
  },
  generatedAt: new Date(),
});

// Mock implementation result
const createMockImplementation = (): Implementation => ({
  changedFiles: ['src/components/Example.tsx'],
  testResults: {
    passed: 12,
    failed: 0,
    skipped: 2,
    duration: 3400,
  },
  warnings: [],
  completedAt: new Date(),
});

export const useWorkflowStore = create<WorkflowStore>((set, get) => ({
  workflows: [],
  activeWorkflow: null,
  isLoading: false,
  error: null,
  useRealBackend: USE_REAL_BACKEND,

  createWorkflow: (bugReport) => {
    const id = generateId();
    const workflow: BugFixWorkflow = {
      id,
      state: 'draft',
      createdAt: new Date(),
      updatedAt: new Date(),
      bugReport,
    };

    set((state) => ({
      workflows: [...state.workflows, workflow],
      activeWorkflow: workflow,
    }));

    return id;
  },

  submitWorkflow: async (id, projectPath) => {
    const workflow = get().workflows.find((w) => w.id === id);
    if (!workflow || workflow.state !== 'draft') return;

    // Start the workflow - transition to submitted
    get().transitionState(id, 'submitted');

    const useReal = get().useRealBackend;

    if (useReal) {
      // Real backend execution
      try {
        get().transitionState(id, 'analyzing');

        console.log('[WorkflowStore] Calling TaskRunner backend...');
        const response = await executeBugFix(id, workflow.bugReport, projectPath);

        if (response.success && response.analysis) {
          // Add generatedAt timestamp if not present
          const analysis: BugAnalysis = {
            ...response.analysis,
            generatedAt: response.analysis.generatedAt || new Date(),
          };
          get().setAnalysis(id, analysis);
          get().transitionState(id, 'proposed');
          console.log('[WorkflowStore] Analysis complete:', analysis.confidence);
        } else {
          get().failWorkflow(id, response.error || 'Analysis failed', 'analyzing');
          console.error('[WorkflowStore] Analysis failed:', response.error);
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        get().failWorkflow(id, errorMessage, 'analyzing');
        console.error('[WorkflowStore] Backend error:', errorMessage);
      }
    } else {
      // Mock execution (original Instance 09 behavior)
      setTimeout(() => {
        get().transitionState(id, 'analyzing');

        setTimeout(() => {
          const w = get().workflows.find((wf) => wf.id === id);
          if (!w) return;

          const analysis = createMockAnalysis(w.bugReport);
          get().setAnalysis(id, analysis);
          get().transitionState(id, 'proposed');
        }, 2000);
      }, 1500);
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
              state: 'failed' as WorkflowState,
              updatedAt: new Date(),
              error: { message: errorMessage, step, occurredAt: new Date() },
            }
          : w
      ),
      activeWorkflow:
        state.activeWorkflow?.id === id
          ? {
              ...state.activeWorkflow,
              state: 'failed' as WorkflowState,
              error: { message: errorMessage, step, occurredAt: new Date() },
            }
          : state.activeWorkflow,
    }));
  },

  setAnalysis: (id, analysis) => {
    set((state) => ({
      workflows: state.workflows.map((w) =>
        w.id === id ? { ...w, analysis, updatedAt: new Date() } : w
      ),
      activeWorkflow:
        state.activeWorkflow?.id === id
          ? { ...state.activeWorkflow, analysis, updatedAt: new Date() }
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

    // If approved, start implementation
    if (review.decision === 'approved') {
      const workflow = get().workflows.find((w) => w.id === id);
      const useReal = get().useRealBackend;

      if (useReal && workflow?.analysis?.proposedFix?.changes) {
        // Real backend implementation
        (async () => {
          try {
            get().transitionState(id, 'implementing');
            console.log('[WorkflowStore] Calling TaskRunner implementation...');

            // Get the project path from the workflow if available
            // For now, use current directory
            const projectPath = undefined; // Could be stored in workflow

            const response = await executeImplementation(
              id,
              workflow.analysis!.proposedFix!.changes,
              projectPath,
              true // run tests
            );

            if (response.success && response.implementation?.success) {
              get().transitionState(id, 'verifying');
              const impl = toImplementation(response);
              if (impl) {
                get().setImplementation(id, impl);
                get().transitionState(id, 'completed');
                console.log('[WorkflowStore] Implementation complete:', impl.changedFiles.join(', '));
              } else {
                get().failWorkflow(id, 'Failed to parse implementation result', 'implementing');
              }
            } else {
              const errorMsg = response.error ||
                response.implementation?.errors?.join(', ') ||
                'Implementation failed';
              get().failWorkflow(id, errorMsg, 'implementing');
              console.error('[WorkflowStore] Implementation failed:', errorMsg);
            }
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            get().failWorkflow(id, errorMessage, 'implementing');
            console.error('[WorkflowStore] Implementation error:', errorMessage);
          }
        })();
      } else {
        // Mock implementation (fallback when backend unavailable)
        get().transitionState(id, 'implementing');

        setTimeout(() => {
          get().transitionState(id, 'verifying');

          setTimeout(() => {
            const impl = createMockImplementation();
            get().setImplementation(id, impl);
            get().transitionState(id, 'completed');
          }, 1500);
        }, 2000);
      }
    } else if (review.decision === 'rejected') {
      get().failWorkflow(id, 'Fix rejected by reviewer', 'reviewing');
    }
    // changes_requested stays in reviewing state
  },

  setImplementation: (id, implementation) => {
    set((state) => ({
      workflows: state.workflows.map((w) =>
        w.id === id ? { ...w, implementation, updatedAt: new Date() } : w
      ),
      activeWorkflow:
        state.activeWorkflow?.id === id
          ? { ...state.activeWorkflow, implementation, updatedAt: new Date() }
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
