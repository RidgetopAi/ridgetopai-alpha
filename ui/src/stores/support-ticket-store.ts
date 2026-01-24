/**
 * Support Ticket Store - Support Ticket Workflow State Management
 * Instance 20 - OPERATE capability
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type {
  SupportTicketWorkflow,
  TicketWorkflowState,
  SupportTicket,
  TicketAnalysis,
  TicketResponse,
} from '../lib/types/support-workflow';
import { isTicketTimeoutError } from '../lib/types/support-workflow';
import {
  executeSupportTicketAnalysis,
  sendSupportTicketResponse,
  storeSupportTicketCompletion,
} from '../lib/api/supportTicketRunner';

// Helper to revive Date objects from JSON storage
const reviveDates = (workflow: SupportTicketWorkflow): SupportTicketWorkflow => ({
  ...workflow,
  createdAt: new Date(workflow.createdAt),
  updatedAt: new Date(workflow.updatedAt),
  analysis: workflow.analysis ? {
    ...workflow.analysis,
    analyzedAt: new Date(workflow.analysis.analyzedAt),
  } : undefined,
  response: workflow.response ? {
    ...workflow.response,
    sentAt: new Date(workflow.response.sentAt),
  } : undefined,
  error: workflow.error ? {
    ...workflow.error,
    occurredAt: new Date(workflow.error.occurredAt),
  } : undefined,
});

// Feature flag: set to true to use real backend, false for mock
const USE_REAL_BACKEND = import.meta.env.VITE_USE_REAL_BACKEND === 'true';

interface SupportTicketStore {
  // State
  workflows: SupportTicketWorkflow[];
  activeWorkflow: SupportTicketWorkflow | null;
  isLoading: boolean;
  error: string | null;
  useRealBackend: boolean;

  // Actions - Workflow Lifecycle
  createWorkflow: (ticket: SupportTicket) => string;
  submitWorkflow: (id: string, projectName?: string) => Promise<void>;
  transitionState: (id: string, newState: TicketWorkflowState) => void;
  failWorkflow: (id: string, error: string, step: TicketWorkflowState, timedOut?: boolean) => void;

  // Actions - Workflow Data
  setAnalysis: (id: string, analysis: TicketAnalysis) => void;
  setResponse: (id: string, response: TicketResponse) => void;

  // Actions - User Actions
  approveResponse: (id: string, customResponse?: string, sendEmail?: boolean) => Promise<void>;
  reanalyze: (id: string, additionalContext?: string) => Promise<void>;

  // Actions - Selection
  selectWorkflow: (id: string | null) => void;
  getWorkflow: (id: string) => SupportTicketWorkflow | undefined;

  // Actions - Cleanup
  clearWorkflows: () => void;
  deleteWorkflow: (id: string) => void;

  // Actions - Config
  setUseRealBackend: (value: boolean) => void;
}

const generateId = () => Math.random().toString(36).substring(2, 11);

// Mock analysis data for testing the UI (fallback when backend unavailable)
const createMockAnalysis = (ticket: SupportTicket): TicketAnalysis => ({
  summary: `Customer is experiencing issues with ${ticket.title.toLowerCase()}.`,
  rootCause: `Based on the description, this appears to be related to ${ticket.category === 'bug_report' ? 'a known issue in the system' : 'a user configuration or understanding gap'}.`,
  affectedUsers: ticket.severity === 'critical' ? 'All users' : 'Some users with specific configurations',
  impact: ticket.severity === 'critical' ? 'High - blocking customer operations' : 'Medium - workaround available',
  workaround: 'Customer can try clearing browser cache and logging in again.',
  suggestedResponse: `Dear ${ticket.customerName || 'Customer'},

Thank you for reaching out to us regarding "${ticket.title}".

We understand this issue is impacting your work and apologize for any inconvenience. Our team has analyzed your report and identified a potential solution.

In the meantime, you may try [workaround steps here] as a temporary solution.

We'll keep you updated on our progress. Please don't hesitate to reach out if you have any questions.

Best regards,
Support Team`,
  internalNotes: `Ticket category: ${ticket.category}. Review for possible pattern with similar recent tickets.`,
  severity: ticket.severity,
  confidence: 'medium',
  actionRequired: {
    type: ticket.category === 'bug_report' ? 'investigation' : 'documentation',
    description: ticket.category === 'bug_report'
      ? 'Engineering should investigate the root cause'
      : 'Consider updating documentation for this scenario',
    estimatedEffort: 'half day',
  },
  analyzedAt: new Date(),
});

export const useSupportTicketStore = create<SupportTicketStore>()(
  persist(
    (set, get) => ({
      workflows: [],
      activeWorkflow: null,
      isLoading: false,
      error: null,
      useRealBackend: USE_REAL_BACKEND,

  createWorkflow: (ticket) => {
    const id = generateId();
    const workflow: SupportTicketWorkflow = {
      id,
      state: 'draft',
      createdAt: new Date(),
      updatedAt: new Date(),
      ticket,
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

        console.log('[SupportTicketStore] Calling TaskRunner backend...');
        const response = await executeSupportTicketAnalysis(id, workflow.ticket);

        if (response.success && response.analysis) {
          // Add analyzedAt timestamp if not present
          const analysis: TicketAnalysis = {
            ...response.analysis,
            analyzedAt: response.analysis.analyzedAt || new Date(),
          };
          get().setAnalysis(id, analysis);
          get().transitionState(id, 'proposed');
          console.log('[SupportTicketStore] Analysis complete:', analysis.confidence);
        } else {
          get().failWorkflow(id, response.error || 'Analysis failed', 'analyzing');
          console.error('[SupportTicketStore] Analysis failed:', response.error);
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        get().failWorkflow(id, errorMessage, 'analyzing');
        console.error('[SupportTicketStore] Backend error:', errorMessage);
      }
    } else {
      // Mock execution (fallback when backend unavailable)
      setTimeout(() => {
        get().transitionState(id, 'analyzing');

        setTimeout(() => {
          const w = get().workflows.find((wf) => wf.id === id);
          if (!w) return;

          const analysis = createMockAnalysis(w.ticket);
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
    const isTimeout = timedOut ?? isTicketTimeoutError(errorMessage);

    set((state) => ({
      workflows: state.workflows.map((w) =>
        w.id === id
          ? {
              ...w,
              state: 'failed' as TicketWorkflowState,
              updatedAt: new Date(),
              error: { message: errorMessage, step, occurredAt: new Date(), timedOut: isTimeout },
            }
          : w
      ),
      activeWorkflow:
        state.activeWorkflow?.id === id
          ? {
              ...state.activeWorkflow,
              state: 'failed' as TicketWorkflowState,
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

  setResponse: (id, response) => {
    set((state) => ({
      workflows: state.workflows.map((w) =>
        w.id === id ? { ...w, response, updatedAt: new Date() } : w
      ),
      activeWorkflow:
        state.activeWorkflow?.id === id
          ? { ...state.activeWorkflow, response, updatedAt: new Date() }
          : state.activeWorkflow,
    }));
  },

  approveResponse: async (id, customResponse, sendEmail = false) => {
    const workflow = get().workflows.find((w) => w.id === id);
    if (!workflow || !workflow.analysis) return;

    get().transitionState(id, 'responding');

    const useReal = get().useRealBackend;
    const responseText = customResponse || workflow.analysis.suggestedResponse;

    if (useReal) {
      try {
        console.log('[SupportTicketStore] Sending response via backend...');
        const result = await sendSupportTicketResponse(id, responseText, sendEmail);

        if (result.success) {
          const ticketResponse: TicketResponse = {
            response: responseText,
            sentTo: workflow.ticket.customerEmail,
            sentAt: new Date(),
          };
          get().setResponse(id, ticketResponse);
          get().transitionState(id, 'completed');

          // Store to Mandrel for institutional memory
          // Instance 10 (bugfix-run) - Pass projectName for project selector
          try {
            const wf = get().workflows.find((w) => w.id === id);
            await storeSupportTicketCompletion(
              id,
              workflow.ticket,
              workflow.analysis,
              {
                sentTo: workflow.ticket.customerEmail,
                body: responseText,
                sentAt: new Date(),
              },
              (wf as unknown as { projectName?: string })?.projectName
            );
            console.log('[SupportTicketStore] Stored to Mandrel');
          } catch (mandrelError) {
            console.warn('[SupportTicketStore] Failed to store to Mandrel:', mandrelError);
          }

          console.log('[SupportTicketStore] Response sent successfully');
        } else {
          get().failWorkflow(id, result.error || 'Failed to send response', 'responding');
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        get().failWorkflow(id, errorMessage, 'responding');
        console.error('[SupportTicketStore] Response error:', errorMessage);
      }
    } else {
      // Mock response
      setTimeout(() => {
        const ticketResponse: TicketResponse = {
          response: responseText,
          sentTo: workflow.ticket.customerEmail,
          sentAt: new Date(),
        };
        get().setResponse(id, ticketResponse);
        get().transitionState(id, 'completed');
      }, 1000);
    }
  },

  reanalyze: async (id, additionalContext) => {
    const workflow = get().workflows.find((w) => w.id === id);
    if (!workflow) {
      console.warn('[SupportTicketStore] Cannot reanalyze - workflow not found');
      return;
    }

    // Only allow reanalyze from proposed or failed states
    if (workflow.state !== 'proposed' && workflow.state !== 'failed') {
      console.warn('[SupportTicketStore] Cannot reanalyze - invalid state:', workflow.state);
      return;
    }

    console.log('[SupportTicketStore] Re-analyzing ticket with additional context:', additionalContext);

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

        // Create enhanced ticket with additional context if provided
        const enhancedTicket = additionalContext
          ? {
              ...workflow.ticket,
              description: `${workflow.ticket.description}\n\n---\nADDITIONAL CONTEXT (for re-analysis):\n${additionalContext}`,
            }
          : workflow.ticket;

        console.log('[SupportTicketStore] Calling TaskRunner backend for re-analysis...');
        const response = await executeSupportTicketAnalysis(id, enhancedTicket);

        if (response.success && response.analysis) {
          const analysis: TicketAnalysis = {
            ...response.analysis,
            analyzedAt: response.analysis.analyzedAt || new Date(),
          };
          get().setAnalysis(id, analysis);
          get().transitionState(id, 'proposed');
          console.log('[SupportTicketStore] Re-analysis complete:', analysis.confidence);
        } else {
          get().failWorkflow(id, response.error || 'Re-analysis failed', 'analyzing');
          console.error('[SupportTicketStore] Re-analysis failed:', response.error);
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        get().failWorkflow(id, errorMessage, 'analyzing');
        console.error('[SupportTicketStore] Backend error:', errorMessage);
      }
    } else {
      // Mock re-analysis
      setTimeout(() => {
        get().transitionState(id, 'analyzing');

        setTimeout(() => {
          const w = get().workflows.find((wf) => wf.id === id);
          if (!w) return;

          const analysis = createMockAnalysis(w.ticket);
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
      name: 'ridgetop-support-workflows',
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
