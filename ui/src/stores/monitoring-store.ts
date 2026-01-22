/**
 * Monitoring Alert Store - Monitoring Alert Workflow State Management
 * Instance 21 - OPERATE capability
 */

import { create } from 'zustand';
import type {
  MonitoringAlertWorkflow,
  AlertWorkflowState,
  MonitoringAlert,
  AlertAnalysis,
  RemediationAction,
} from '../lib/types/monitoring-workflow';
import {
  analyzeAlert,
  executeRemediation,
  storeAlertToMandrel,
} from '../lib/api/monitoringRunner';

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
  submitWorkflow: (id: string, projectPath?: string) => Promise<void>;
  transitionState: (id: string, newState: AlertWorkflowState) => void;
  failWorkflow: (id: string, error: string, step: AlertWorkflowState) => void;

  // Actions - Workflow Data
  setAnalysis: (id: string, analysis: AlertAnalysis) => void;
  setRemediation: (id: string, remediation: RemediationAction) => void;

  // Actions - User Actions
  executeRemediationAction: (id: string, action: 'execute' | 'dismiss' | 'escalate', notes?: string) => Promise<void>;

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

export const useMonitoringStore = create<MonitoringStore>((set, get) => ({
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

        console.log('[MonitoringStore] Calling TaskRunner backend...');
        const response = await analyzeAlert(id, workflow.alert, projectPath);

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

  failWorkflow: (id, errorMessage, step) => {
    set((state) => ({
      workflows: state.workflows.map((w) =>
        w.id === id
          ? {
              ...w,
              state: 'failed' as AlertWorkflowState,
              updatedAt: new Date(),
              error: { message: errorMessage, step, occurredAt: new Date() },
            }
          : w
      ),
      activeWorkflow:
        state.activeWorkflow?.id === id
          ? {
              ...state.activeWorkflow,
              state: 'failed' as AlertWorkflowState,
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

  executeRemediationAction: async (id, action, notes) => {
    const workflow = get().workflows.find((w) => w.id === id);
    if (!workflow || !workflow.analysis) return;

    get().transitionState(id, 'remediating');

    const useReal = get().useRealBackend;

    if (useReal) {
      try {
        console.log('[MonitoringStore] Executing remediation via backend...');
        const result = await executeRemediation(id, action, notes);

        if (result.success) {
          const remediation: RemediationAction = {
            action,
            notes,
            executedAt: new Date(),
          };
          get().setRemediation(id, remediation);
          get().transitionState(id, 'completed');

          // Store to Mandrel for institutional memory
          try {
            await storeAlertToMandrel(
              id,
              workflow.alert,
              workflow.analysis,
              {
                action,
                notes,
                executedAt: new Date(),
              }
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
