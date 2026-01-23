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
import { executeBugFix, executeImplementation, toImplementation, storeBugFixToMandrel } from '../lib/api/taskRunner';

// Always use real backend - mock mode removed for production
const USE_REAL_BACKEND = true;

interface WorkflowStore {
  // State
  workflows: BugFixWorkflow[];
  activeWorkflow: BugFixWorkflow | null;
  isLoading: boolean;
  error: string | null;
  useRealBackend: boolean;

  // Actions - Workflow Lifecycle
  createWorkflow: (bugReport: BugReport) => string;
  submitWorkflow: (id: string, projectPath?: string, projectName?: string) => Promise<void>;
  transitionState: (id: string, newState: WorkflowState) => void;
  failWorkflow: (id: string, error: string, step: WorkflowState) => void;

  // Actions - Workflow Data
  setAnalysis: (id: string, analysis: BugAnalysis) => void;
  setReview: (id: string, review: FixReview) => void;
  setImplementation: (id: string, implementation: Implementation) => void;
  confirmWorkflow: (id: string, confirmed: boolean, feedback?: string) => Promise<void>;

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

  submitWorkflow: async (id, projectPath, projectName) => {
    const workflow = get().workflows.find((w) => w.id === id);
    if (!workflow || workflow.state !== 'draft') return;

    // Store projectPath and projectName in workflow for later phases
    if (projectPath || projectName) {
      set((state) => ({
        workflows: state.workflows.map((w) =>
          w.id === id ? { ...w, ...(projectPath && { projectPath }), ...(projectName && { projectName }) } : w
        ),
        activeWorkflow:
          state.activeWorkflow?.id === id
            ? { ...state.activeWorkflow, ...(projectPath && { projectPath }), ...(projectName && { projectName }) }
            : state.activeWorkflow,
      }));
    }

    // Start the workflow - transition to submitted
    get().transitionState(id, 'submitted');

    // Real backend execution - no mock fallback
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

        // Store proposed fix to Mandrel for institutional memory (stage: proposed)
        const updatedWorkflow = get().workflows.find((w) => w.id === id);
        if (updatedWorkflow?.projectName) {
          console.log('[WorkflowStore] Storing proposed fix to Mandrel:', updatedWorkflow.projectName);
          storeBugFixToMandrel(
            id,
            updatedWorkflow.bugReport,
            analysis,
            updatedWorkflow.projectName,
            undefined, // no review yet
            'proposed' // stage: awaiting verification
          ).then((result) => {
            if (result.success) {
              console.log('[WorkflowStore] Proposed fix stored to Mandrel successfully');
            } else {
              console.warn('[WorkflowStore] Failed to store to Mandrel:', result.error);
            }
          });
        }
      } else {
        const errorMsg = response.error || 'Analysis failed - no details provided';
        get().failWorkflow(id, errorMsg, 'analyzing');
        console.error('[WorkflowStore] Analysis failed:', errorMsg);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      get().failWorkflow(id, `Backend error: ${errorMessage}`, 'analyzing');
      console.error('[WorkflowStore] Backend error:', errorMessage);
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

      if (!workflow?.analysis?.proposedFix?.changes) {
        get().failWorkflow(id, 'No proposed changes to implement', 'implementing');
        return;
      }

      // Real backend implementation - no mock fallback
      (async () => {
        try {
          get().transitionState(id, 'implementing');
          console.log('[WorkflowStore] Calling TaskRunner implementation...');
          console.log('[WorkflowStore] Using projectPath:', workflow.projectPath);

          const response = await executeImplementation(
            id,
            workflow.analysis!.proposedFix!.changes,
            workflow.projectPath,
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
              'Implementation failed - no details provided';
            get().failWorkflow(id, errorMsg, 'implementing');
            console.error('[WorkflowStore] Implementation failed:', errorMsg);
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          get().failWorkflow(id, `Implementation error: ${errorMessage}`, 'implementing');
          console.error('[WorkflowStore] Implementation error:', errorMessage);
        }
      })();
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

  confirmWorkflow: async (id, confirmed, feedback) => {
    const workflow = get().workflows.find((w) => w.id === id);
    if (!workflow || workflow.state !== 'completed' || !workflow.analysis) {
      console.warn('[WorkflowStore] Cannot confirm workflow:', id);
      return;
    }

    const confirmation = {
      confirmed,
      feedback,
      confirmedAt: new Date(),
      storedToMandrel: false,
    };

    // Update workflow with confirmation (before Mandrel call)
    set((state) => ({
      workflows: state.workflows.map((w) =>
        w.id === id ? { ...w, confirmation, updatedAt: new Date() } : w
      ),
      activeWorkflow:
        state.activeWorkflow?.id === id
          ? { ...state.activeWorkflow, confirmation, updatedAt: new Date() }
          : state.activeWorkflow,
    }));

    // Store confirmed fix to Mandrel (stage: confirmed)
    if (workflow.projectName) {
      console.log('[WorkflowStore] Storing confirmed fix to Mandrel:', workflow.projectName);
      const reviewDecision = confirmed ? 'approved' : 'rejected';

      const result = await storeBugFixToMandrel(
        id,
        workflow.bugReport,
        workflow.analysis,
        workflow.projectName,
        { decision: reviewDecision, feedback },
        'confirmed' // stage: user has verified
      );

      // Update storedToMandrel status
      set((state) => ({
        workflows: state.workflows.map((w) =>
          w.id === id && w.confirmation
            ? { ...w, confirmation: { ...w.confirmation, storedToMandrel: result.success } }
            : w
        ),
        activeWorkflow:
          state.activeWorkflow?.id === id && state.activeWorkflow.confirmation
            ? { ...state.activeWorkflow, confirmation: { ...state.activeWorkflow.confirmation, storedToMandrel: result.success } }
            : state.activeWorkflow,
      }));

      if (result.success) {
        console.log('[WorkflowStore] Confirmed fix stored to Mandrel successfully');
      } else {
        console.warn('[WorkflowStore] Failed to store confirmed fix to Mandrel:', result.error);
      }
    }
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
