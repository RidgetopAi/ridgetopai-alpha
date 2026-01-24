/**
 * Orchestration Store - State Management for Natural Language → Parallel Execution
 *
 * This store manages the orchestration workflow:
 * 1. User provides natural language intent
 * 2. Backend analyzes and generates tasks
 * 3. User reviews and approves tasks
 * 4. Tasks execute in parallel
 * 5. Results aggregate
 */

import { create } from 'zustand';
import type {
  OrchestrationSession,
  SessionState,
  GeneratedTask,
} from '../lib/types/orchestration';
import {
  createOrchestrationSession,
  getOrchestrationSession,
  executeOrchestrationTasks,
  listOrchestrationSessions,
  cancelOrchestrationSession,
} from '../lib/api/orchestrator';

interface OrchestrationStore {
  // State
  sessions: OrchestrationSession[];
  activeSession: OrchestrationSession | null;
  sessionState: SessionState;
  isLoading: boolean;
  error: string | null;

  // Actions - Session Lifecycle
  createSession: (intent: string, context?: OrchestrationSession['context']) => Promise<void>;
  executeSession: () => Promise<void>;
  cancelSession: () => Promise<void>;
  refreshSession: () => Promise<void>;
  selectSession: (sessionId: string | null) => void;
  clearError: () => void;

  // Actions - Data
  loadSessions: () => Promise<void>;
  getTask: (taskId: string) => GeneratedTask | undefined;

  // Actions - Cleanup
  clearSessions: () => void;
  resetActiveSession: () => void;
}

const generateSessionId = () => `session-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

export const useOrchestrationStore = create<OrchestrationStore>((set, get) => ({
  sessions: [],
  activeSession: null,
  sessionState: 'idle',
  isLoading: false,
  error: null,

  createSession: async (intent, context) => {
    set({ isLoading: true, error: null, sessionState: 'analyzing' });

    const sessionId = generateSessionId();

    try {
      console.log('[OrchestrationStore] Creating session:', sessionId);
      console.log('[OrchestrationStore] Intent:', intent);

      const response = await createOrchestrationSession({
        sessionId,
        intent,
        context,
      });

      if (response.success && response.session) {
        const session = response.session;

        // Validate session has required fields
        if (!session.interpretation || !session.interpretation.tasks || !session.execution) {
          console.error('[OrchestrationStore] Session missing required fields:', session);
          set({
            error: 'Session data incomplete from server',
            sessionState: 'failed',
            isLoading: false,
          });
          return;
        }

        set((state) => ({
          sessions: [...state.sessions, session],
          activeSession: session,
          sessionState: 'ready',
          isLoading: false,
        }));

        console.log('[OrchestrationStore] Session created with', session.interpretation.tasks.length, 'tasks');
      } else {
        set({
          error: response.error || 'Failed to create session',
          sessionState: 'failed',
          isLoading: false,
        });
        console.error('[OrchestrationStore] Create failed:', response.error);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      set({
        error: errorMessage,
        sessionState: 'failed',
        isLoading: false,
      });
      console.error('[OrchestrationStore] Error:', errorMessage);
    }
  },

  executeSession: async () => {
    const session = get().activeSession;
    if (!session) {
      set({ error: 'No active session' });
      return;
    }

    set({ isLoading: true, error: null, sessionState: 'executing' });

    try {
      console.log('[OrchestrationStore] Executing session:', session.sessionId);

      const response = await executeOrchestrationTasks(session.sessionId);

      if (response.success) {
        console.log('[OrchestrationStore] Dispatched:', response.dispatched, 'Failed:', response.failed);

        // Start polling for updates
        get().refreshSession();

        // Poll until complete or cancelled
        const pollInterval = setInterval(async () => {
          const current = get().activeSession;
          const currentState = get().sessionState;

          // Stop polling if session is gone or cancelled
          if (!current || currentState === 'cancelled') {
            clearInterval(pollInterval);
            return;
          }

          await get().refreshSession();

          const updated = get().activeSession;
          const updatedState = get().sessionState;

          // Check again after refresh
          if (updatedState === 'cancelled') {
            clearInterval(pollInterval);
            return;
          }

          if (updated) {
            const { execution } = updated;
            const allDone = execution.pending === 0 && execution.running === 0;

            if (allDone) {
              clearInterval(pollInterval);
              // Determine final state based on what happened
              let finalState: SessionState = 'completed';
              if (updated.isCancelled || execution.cancelled > 0) {
                finalState = execution.failed > 0 ? 'failed' :
                            execution.completed === 0 ? 'cancelled' : 'completed';
              } else if (execution.failed > 0) {
                finalState = 'failed';
              }
              set({
                sessionState: finalState,
                isLoading: false,
              });
              console.log('[OrchestrationStore] Execution complete, final state:', finalState);
            }
          }
        }, 2000);

        // Timeout after 5 minutes
        setTimeout(() => {
          clearInterval(pollInterval);
          const state = get().sessionState;
          if (state === 'executing') {
            set({ sessionState: 'completed', isLoading: false });
          }
        }, 300000);
      } else {
        set({
          error: response.error || 'Execution failed',
          sessionState: 'failed',
          isLoading: false,
        });
        console.error('[OrchestrationStore] Execute failed:', response.error);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      set({
        error: errorMessage,
        sessionState: 'failed',
        isLoading: false,
      });
      console.error('[OrchestrationStore] Error:', errorMessage);
    }
  },

  cancelSession: async () => {
    const session = get().activeSession;
    if (!session) {
      set({ error: 'No active session' });
      return;
    }

    set({ isLoading: true, error: null });

    try {
      console.log('[OrchestrationStore] Cancelling session:', session.sessionId);

      const response = await cancelOrchestrationSession(session.sessionId);

      if (response.success && response.session) {
        const updatedSession = response.session;

        set((state) => ({
          activeSession: updatedSession,
          sessions: state.sessions.map((s) =>
            s.sessionId === session.sessionId ? updatedSession : s
          ),
          sessionState: 'cancelled',
          isLoading: false,
        }));

        console.log('[OrchestrationStore] Session cancelled:', response.message);
      } else {
        set({
          error: response.error || 'Cancel failed',
          isLoading: false,
        });
        console.error('[OrchestrationStore] Cancel failed:', response.error);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      set({
        error: errorMessage,
        isLoading: false,
      });
      console.error('[OrchestrationStore] Cancel error:', errorMessage);
    }
  },

  refreshSession: async () => {
    const session = get().activeSession;
    if (!session) return;

    try {
      const response = await getOrchestrationSession(session.sessionId);

      if (response.success && response.session) {
        set((state) => ({
          activeSession: response.session,
          sessions: state.sessions.map((s) =>
            s.sessionId === session.sessionId ? response.session! : s
          ),
        }));
      }
    } catch (error) {
      console.error('[OrchestrationStore] Refresh error:', error);
    }
  },

  selectSession: (sessionId) => {
    if (!sessionId) {
      set({ activeSession: null, sessionState: 'idle' });
      return;
    }

    const session = get().sessions.find((s) => s.sessionId === sessionId);
    if (session) {
      // Determine session state based on execution
      const { execution } = session;
      const allDone = execution.pending === 0 && execution.running === 0;
      let state: SessionState = 'ready';

      if (allDone && execution.total > 0) {
        state = execution.failed > 0 ? 'failed' : 'completed';
      } else if (execution.running > 0) {
        state = 'executing';
      }

      set({ activeSession: session, sessionState: state });
    }
  },

  clearError: () => {
    set({ error: null });
  },

  loadSessions: async () => {
    try {
      const response = await listOrchestrationSessions();

      if (response.success && response.sessions) {
        // Filter out any malformed sessions to prevent crashes
        const validSessions = response.sessions.filter((session) => {
          const isValid = session &&
            session.interpretation &&
            session.interpretation.tasks &&
            Array.isArray(session.interpretation.tasks) &&
            session.execution;
          if (!isValid) {
            console.warn('[OrchestrationStore] Skipping malformed session:', session?.sessionId);
          }
          return isValid;
        }) as OrchestrationSession[];

        set({ sessions: validSessions });
        console.log('[OrchestrationStore] Loaded', validSessions.length, 'valid sessions from backend');
      }
    } catch (error) {
      console.error('[OrchestrationStore] Load sessions error:', error);
    }
  },

  getTask: (taskId) => {
    const session = get().activeSession;
    if (!session || !session.interpretation?.tasks) return undefined;
    return session.interpretation.tasks.find((t) => t.id === taskId);
  },

  clearSessions: () => {
    set({ sessions: [], activeSession: null, sessionState: 'idle' });
  },

  resetActiveSession: () => {
    set({ activeSession: null, sessionState: 'idle', error: null });
  },
}));
