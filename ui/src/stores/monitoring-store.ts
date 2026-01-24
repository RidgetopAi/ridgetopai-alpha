/**
 * Monitoring Alert Store - Monitoring Alert Workflow State Management
 * Instance 21 - OPERATE capability
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type {
  MonitoringAlertWorkflow,
  AlertWorkflowState,
  MonitoringAlert,
  AlertAnalysis,
  RemediationAction,
} from '../lib/types/monitoring-workflow';
import { isAlertTimeoutError } from '../lib/types/monitoring-workflow';
import {
  analyzeAlert,
  executeRemediation,
  storeAlertToMandrel,
} from '../lib/api/monitoringRunner';

// Helper to revive Date objects from JSON storage
const reviveDates = (workflow: MonitoringAlertWorkflow): MonitoringAlertWorkflow => ({
  ...workflow,
  createdAt: new Date(workflow.createdAt),
  updatedAt: new Date(workflow.updatedAt),
  analysis: workflow.analysis ? {
    ...workflow.analysis,
    analyzedAt: new Date(workflow.analysis.analyzedAt),
  } : undefined,
  remediation: workflow.remediation ? {
    ...workflow.remediation,
    executedAt: new Date(workflow.remediation.executedAt),
  } : undefined,
  error: workflow.error ? {
    ...workflow.error,
    occurredAt: new Date(workflow.error.occurredAt),
  } : undefined,
});

// Feature flag: set to true to use real backend, false for mock
const USE_REAL_BACKEND = import.meta.env.VITE_USE_REAL_BACKEND === 'true';

interface MonitoringStore {
  // State
  workflows: MonitoringAlertWorkflow[];
  activeWorkflow: MonitoringAlertWorkflow | null;
  isLoading: boolean;
  error: string | null;
  useRealBackend: boolean;

  // Actions - Workflow Lifecycle
  createWorkflow: (alert: MonitoringAlert) => string;
  submitWorkflow: (id: string, projectName?: string) => Promise<void>;
  transitionState: (id: string, newState: AlertWorkflowState) => void;
  failWorkflow: (id: string, error: string, step: AlertWorkflowState, timedOut?: boolean) => void;

  // Actions - Workflow Data
  setAnalysis: (id: string, analysis: AlertAnalysis) => void;
  setRemediation: (id: string, remediation: RemediationAction) => void;

  // Actions - User Actions
  executeRemediationAction: (id: string, action: 'execute' | 'dismiss' | 'escalate', notes?: string, modifiedSteps?: string[]) => Promise<void>;
  reanalyze: (id: string, additionalContext?: string) => Promise<void>;

  // Actions - Selection
  selectWorkflow: (id: string | null) => void;
  getWorkflow: (id: string) => MonitoringAlertWorkflow | undefined;

  // Actions - Cleanup
  clearWorkflows: () => void;
  deleteWorkflow: (id: string) => void;

  // Actions - Config
  setUseRealBackend: (value: boolean) => void;
}

const generateId = () => Math.random().toString(36).substring(2, 11);

// Mock analysis data for testing the UI (fallback when backend unavailable)
const createMockAnalysis = (alert: MonitoringAlert): AlertAnalysis => ({
  summary: `${alert.severity.toUpperCase()} alert detected: ${alert.title}`,
  rootCause: `Based on the ${alert.category} category and ${alert.source} source, this appears to be ${
    alert.category === 'infrastructure' ? 'a resource constraint issue' :
    alert.category === 'application' ? 'an application-level error' :
    alert.category === 'security' ? 'a potential security concern' :
    'a business metric deviation'
  }.`,
  impact: alert.severity === 'critical'
    ? 'Critical - Service degradation affecting all users'
    : alert.severity === 'high'
    ? 'High - Significant impact on some users'
    : 'Medium - Limited impact, monitoring recommended',
  urgency: alert.severity,
  affectedSystems: alert.affectedService || 'Unknown - requires investigation',
  suggestedRemediation: {
    type: alert.category === 'infrastructure' ? 'restart' : 'investigate',
    description: alert.category === 'infrastructure'
      ? 'Restart the affected service to restore normal operation'
      : 'Investigate the root cause before taking action',
    steps: [
      `1. Check ${alert.affectedService || 'affected service'} health status`,
      '2. Review recent deployments or configuration changes',
      '3. Check for correlated alerts or issues',
      alert.category === 'infrastructure'
        ? '4. If safe, restart the service with rolling deployment'
        : '4. Gather logs and metrics for analysis',
      '5. Monitor for 15 minutes to confirm resolution',
    ],
    risks: [
      'Brief service interruption during restart',
      'Potential for cascading effects on dependent services',
    ],
    estimatedDowntime: alert.category === 'infrastructure' ? '2-5 minutes' : 'None',
  },
  confidence: 'medium',
  internalNotes: `Alert from ${alert.source}. ${alert.metricValue ? `Current value: ${alert.metricValue}` : ''} ${alert.threshold ? `Threshold: ${alert.threshold}` : ''}`,
  analyzedAt: new Date(),
});

export const useMonitoringStore = create<MonitoringStore>()(
  persist(
    (set, get) => ({
      workflows: [],
      activeWorkflow: null,
      isLoading: false,
      error: null,
      useRealBackend: USE_REAL_BACKEND,

  createWorkflow: (alert) => {
    const id = generateId();
    const workflow: MonitoringAlertWorkflow = {
      id,
      state: 'draft',
      createdAt: new Date(),
      updatedAt: new Date(),
      alert,
    };

    set((state) => ({
      workflows: [...state.workflows, workflow],
      activeWorkflow: workflow,
    }));

    return id;
  },

  submitWorkflow: async (id, projectName) => {
    const workflow = get().workflows.find((w) => w.id === id);
    if (!workflow || workflow.state !== 'draft') return;

    // Store projectName in workflow for later phases
    if (projectName) {
      set((state) => ({
        workflows: state.workflows.map((w) =>
          w.id === id ? { ...w, projectName } : w
        ),
        activeWorkflow:
          state.activeWorkflow?.id === id
            ? { ...state.activeWorkflow, projectName }
            : state.activeWorkflow,
      }));
    }

    // Start the workflow - transition to submitted
    get().transitionState(id, 'submitted');

    const useReal = get().useRealBackend;

    if (useReal) {
      // Real backend execution
      try {
        get().transitionState(id, 'analyzing');

        console.log('[MonitoringStore] Calling TaskRunner backend...');
        const response = await analyzeAlert(id, workflow.alert);

        if (response.success && response.analysis) {
          // Add analyzedAt timestamp if not present
          const analysis: AlertAnalysis = {
            ...response.analysis,
            analyzedAt: response.analysis.analyzedAt || new Date(),
          };
          get().setAnalysis(id, analysis);
          get().transitionState(id, 'proposed');
          console.log('[MonitoringStore] Analysis complete:', analysis.confidence);
        } else {
          get().failWorkflow(id, response.error || 'Analysis failed', 'analyzing');
          console.error('[MonitoringStore] Analysis failed:', response.error);
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        get().failWorkflow(id, errorMessage, 'analyzing');
        console.error('[MonitoringStore] Backend error:', errorMessage);
      }
    } else {
      // Mock execution (fallback when backend unavailable)
      setTimeout(() => {
        get().transitionState(id, 'analyzing');

        setTimeout(() => {
          const w = get().workflows.find((wf) => wf.id === id);
          if (!w) return;

          const analysis = createMockAnalysis(w.alert);
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

  failWorkflow: (id, errorMessage, step, timedOut) => {
    // Auto-detect timeout if not explicitly specified
    const isTimeout = timedOut ?? isAlertTimeoutError(errorMessage);

    set((state) => ({
      workflows: state.workflows.map((w) =>
        w.id === id
          ? {
              ...w,
              state: 'failed' as AlertWorkflowState,
              updatedAt: new Date(),
              error: { message: errorMessage, step, occurredAt: new Date(), timedOut: isTimeout },
            }
          : w
      ),
      activeWorkflow:
        state.activeWorkflow?.id === id
          ? {
              ...state.activeWorkflow,
              state: 'failed' as AlertWorkflowState,
              error: { message: errorMessage, step, occurredAt: new Date(), timedOut: isTimeout },
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

  setRemediation: (id, remediation) => {
    set((state) => ({
      workflows: state.workflows.map((w) =>
        w.id === id ? { ...w, remediation, updatedAt: new Date() } : w
      ),
      activeWorkflow:
        state.activeWorkflow?.id === id
          ? { ...state.activeWorkflow, remediation, updatedAt: new Date() }
          : state.activeWorkflow,
    }));
  },

  executeRemediationAction: async (id, action, notes, modifiedSteps) => {
    const workflow = get().workflows.find((w) => w.id === id);
    if (!workflow || !workflow.analysis) return;

    get().transitionState(id, 'remediating');

    const useReal = get().useRealBackend;

    if (useReal) {
      try {
        console.log('[MonitoringStore] Executing remediation via backend...');
        const result = await executeRemediation(id, action, notes, modifiedSteps);

        if (result.success) {
          const remediation: RemediationAction = {
            action,
            notes,
            executedAt: new Date(),
          };
          get().setRemediation(id, remediation);
          get().transitionState(id, 'completed');

          // Store to Mandrel for institutional memory
          // Instance 10 (bugfix-run) - Pass projectName for project selector
          try {
            const wf = get().workflows.find((w) => w.id === id);
            await storeAlertToMandrel(
              id,
              workflow.alert,
              workflow.analysis,
              {
                action,
                notes,
                executedAt: new Date(),
              },
              (wf as unknown as { projectName?: string })?.projectName
            );
            console.log('[MonitoringStore] Stored to Mandrel');
          } catch (mandrelError) {
            console.warn('[MonitoringStore] Failed to store to Mandrel:', mandrelError);
          }

          console.log('[MonitoringStore] Remediation recorded successfully');
        } else {
          get().failWorkflow(id, result.error || 'Failed to execute remediation', 'remediating');
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        get().failWorkflow(id, errorMessage, 'remediating');
        console.error('[MonitoringStore] Remediation error:', errorMessage);
      }
    } else {
      // Mock remediation
      setTimeout(() => {
        const remediation: RemediationAction = {
          action,
          notes,
          executedAt: new Date(),
        };
        get().setRemediation(id, remediation);
        get().transitionState(id, 'completed');
      }, 1000);
    }
  },

  reanalyze: async (id, additionalContext) => {
    const workflow = get().workflows.find((w) => w.id === id);
    if (!workflow) {
      console.warn('[MonitoringStore] Cannot reanalyze - workflow not found');
      return;
    }

    // Only allow reanalyze from proposed or failed states
    if (workflow.state !== 'proposed' && workflow.state !== 'failed') {
      console.warn('[MonitoringStore] Cannot reanalyze - invalid state:', workflow.state);
      return;
    }

    console.log('[MonitoringStore] Re-analyzing alert with additional context:', additionalContext);

    // Clear the analysis, transition back to analyzing
    set((state) => ({
      workflows: state.workflows.map((w) =>
        w.id === id
          ? { ...w, analysis: undefined, error: undefined, updatedAt: new Date() }
          : w
      ),
      activeWorkflow:
        state.activeWorkflow?.id === id
          ? { ...state.activeWorkflow, analysis: undefined, error: undefined, updatedAt: new Date() }
          : state.activeWorkflow,
    }));

    const useReal = get().useRealBackend;

    if (useReal) {
      try {
        get().transitionState(id, 'analyzing');

        // Create enhanced alert with additional context if provided
        const enhancedAlert = additionalContext
          ? {
              ...workflow.alert,
              description: `${workflow.alert.description}\n\n---\nADDITIONAL CONTEXT (for re-analysis):\n${additionalContext}`,
            }
          : workflow.alert;

        console.log('[MonitoringStore] Calling TaskRunner backend for re-analysis...');
        const response = await analyzeAlert(id, enhancedAlert);

        if (response.success && response.analysis) {
          const analysis: AlertAnalysis = {
            ...response.analysis,
            analyzedAt: response.analysis.analyzedAt || new Date(),
          };
          get().setAnalysis(id, analysis);
          get().transitionState(id, 'proposed');
          console.log('[MonitoringStore] Re-analysis complete:', analysis.confidence);
        } else {
          get().failWorkflow(id, response.error || 'Re-analysis failed', 'analyzing');
          console.error('[MonitoringStore] Re-analysis failed:', response.error);
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        get().failWorkflow(id, errorMessage, 'analyzing');
        console.error('[MonitoringStore] Backend error:', errorMessage);
      }
    } else {
      // Mock re-analysis
      setTimeout(() => {
        get().transitionState(id, 'analyzing');

        setTimeout(() => {
          const w = get().workflows.find((wf) => wf.id === id);
          if (!w) return;

          const analysis = createMockAnalysis(w.alert);
          get().setAnalysis(id, analysis);
          get().transitionState(id, 'proposed');
        }, 2000);
      }, 500);
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
    }),
    {
      name: 'ridgetop-monitoring-workflows',
      // Only persist workflows array, not transient state
      partialize: (state) => ({
        workflows: state.workflows,
      }),
      // Revive Date objects when loading from storage
      onRehydrateStorage: () => (state) => {
        if (state?.workflows) {
          state.workflows = state.workflows.map(reviveDates);
        }
      },
    }
  )
);
