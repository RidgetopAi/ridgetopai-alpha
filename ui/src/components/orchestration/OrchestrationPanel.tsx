/**
 * OrchestrationPanel - The Core Interface for Natural Language Direction
 *
 * This is the key component that transforms this system from a prototype
 * into a usable tool. It enables:
 *
 * 1. Natural language input (intent)
 * 2. AI interpretation and task generation
 * 3. Review of generated tasks
 * 4. One-click parallel execution
 * 5. Real-time status tracking
 *
 * The Inverse Hierarchy in action:
 * - Human: Provides direction
 * - AI: Analyzes, plans, executes
 * - Human: Reviews results
 */

import { useState } from 'react';
import { useOrchestrationStore } from '../../stores/orchestration-store';
import { IntentInput } from './IntentInput';
import { TaskList } from './TaskList';
import { OrchestrationProgress } from './OrchestrationProgress';
import { SESSION_STATE_LABELS } from '../../lib/types/orchestration';

export function OrchestrationPanel() {
  const {
    activeSession,
    sessionState,
    isLoading,
    error,
    createSession,
    executeSession,
    resetActiveSession,
    clearError,
  } = useOrchestrationStore();

  const [showInput, setShowInput] = useState(true);

  const handleSubmitIntent = async (intent: string, context?: { focus?: string; urgency?: 'high' | 'normal' | 'low' }) => {
    setShowInput(false);
    await createSession(intent, context);
  };

  const handleExecute = async () => {
    await executeSession();
  };

  const handleNewSession = () => {
    resetActiveSession();
    setShowInput(true);
  };

  // Render the session detail view
  const renderSessionDetail = () => {
    if (!activeSession) return null;

    const { interpretation, execution } = activeSession;
    const canExecute = sessionState === 'ready' && execution.pending > 0;
    const isExecuting = sessionState === 'executing';
    const isDone = sessionState === 'completed' || sessionState === 'failed';

    return (
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <h3 className="text-lg font-medium text-white truncate">
              {activeSession.intent.length > 60
                ? activeSession.intent.substring(0, 60) + '...'
                : activeSession.intent}
            </h3>
            <div className="flex items-center gap-2 mt-1">
              <span className={`
                text-xs px-2 py-0.5 rounded-full
                ${sessionState === 'completed' ? 'bg-green-500/20 text-green-400' : ''}
                ${sessionState === 'executing' ? 'bg-blue-500/20 text-blue-400' : ''}
                ${sessionState === 'ready' ? 'bg-yellow-500/20 text-yellow-400' : ''}
                ${sessionState === 'failed' ? 'bg-red-500/20 text-red-400' : ''}
                ${sessionState === 'analyzing' ? 'bg-purple-500/20 text-purple-400' : ''}
              `}>
                {SESSION_STATE_LABELS[sessionState]}
              </span>
              <span className="text-xs text-gray-500">
                {interpretation.tasks.length} task{interpretation.tasks.length !== 1 ? 's' : ''}
              </span>
            </div>
          </div>
          <button
            onClick={handleNewSession}
            className="text-sm text-cyan-400 hover:text-cyan-300 ml-2 shrink-0"
          >
            + New
          </button>
        </div>

        {/* AI Interpretation */}
        <div className="bg-gray-800/50 rounded-lg p-3">
          <h4 className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">
            AI Understanding
          </h4>
          <p className="text-sm text-gray-300">{interpretation.understood}</p>
          {interpretation.warnings && interpretation.warnings.length > 0 && (
            <div className="mt-2 text-xs text-yellow-400">
              {interpretation.warnings.map((w, i) => (
                <div key={i} className="flex items-start gap-1">
                  <span>⚠</span>
                  <span>{w}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Progress (when executing or done) */}
        {(isExecuting || isDone) && (
          <OrchestrationProgress execution={execution} state={sessionState} />
        )}

        {/* Task List */}
        <TaskList tasks={interpretation.tasks} />

        {/* Action Buttons */}
        <div className="flex gap-2">
          {canExecute && (
            <button
              onClick={handleExecute}
              disabled={isLoading}
              className="flex-1 px-4 py-3 bg-cyan-600 text-white rounded-md font-medium hover:bg-cyan-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? 'Processing...' : `Execute ${execution.pending} Task${execution.pending !== 1 ? 's' : ''}`}
            </button>
          )}

          {isExecuting && (
            <div className="flex-1 px-4 py-3 bg-blue-600/20 text-blue-400 rounded-md font-medium text-center">
              <span className="animate-pulse">Executing...</span>
              <span className="ml-2 text-sm">
                {execution.completed}/{execution.total}
              </span>
            </div>
          )}

          {isDone && (
            <button
              onClick={handleNewSession}
              className="flex-1 px-4 py-3 bg-cyan-600 text-white rounded-md font-medium hover:bg-cyan-500 transition-colors"
            >
              Start New Session
            </button>
          )}
        </div>

        {/* Completed Summary */}
        {sessionState === 'completed' && execution.completed > 0 && (
          <div className="bg-green-900/20 rounded-lg p-4 text-center">
            <div className="text-green-400 text-lg mb-1">Orchestration Complete!</div>
            <p className="text-gray-400 text-sm">
              {execution.completed} task{execution.completed !== 1 ? 's' : ''} completed successfully
              {execution.failed > 0 && `, ${execution.failed} failed`}
            </p>
          </div>
        )}

        {/* Failed Summary */}
        {sessionState === 'failed' && (
          <div className="bg-red-900/20 rounded-lg p-4 text-center">
            <div className="text-red-400 text-lg mb-1">Orchestration Failed</div>
            <p className="text-gray-400 text-sm">
              {execution.failed} task{execution.failed !== 1 ? 's' : ''} failed
              {execution.completed > 0 && `, ${execution.completed} succeeded`}
            </p>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="bg-gray-900 rounded-lg border border-gray-800 overflow-hidden h-full flex flex-col">
      {/* Panel Header */}
      <div className="px-4 py-3 border-b border-gray-800 bg-gray-900/50">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium text-white">Orchestrator</h2>
          <span className="text-xs px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-400">
            COMMAND
          </span>
        </div>
      </div>

      {/* Panel Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {/* Error Display */}
        {error && (
          <div className="mb-4 p-3 bg-red-900/20 border border-red-800 rounded-lg">
            <div className="flex items-start justify-between">
              <p className="text-sm text-red-400">{error}</p>
              <button
                onClick={clearError}
                className="text-red-400 hover:text-red-300 ml-2"
              >
                ×
              </button>
            </div>
          </div>
        )}

        {/* Show input form or session detail */}
        {showInput && !activeSession ? (
          <div className="space-y-4">
            <p className="text-sm text-gray-400">
              Give a high-level directive in natural language. The AI will analyze
              your intent, generate specific tasks, and execute them in parallel.
            </p>
            <IntentInput onSubmit={handleSubmitIntent} isLoading={isLoading} />
          </div>
        ) : sessionState === 'analyzing' ? (
          <div className="text-center py-12">
            <div className="animate-pulse text-cyan-400 mb-2 text-lg">
              Analyzing your intent...
            </div>
            <p className="text-gray-500 text-sm">
              AI is breaking down your directive into actionable tasks
            </p>
          </div>
        ) : activeSession ? (
          renderSessionDetail()
        ) : (
          <div className="text-center py-8">
            <p className="text-gray-400 mb-4">Ready to orchestrate.</p>
            <button
              onClick={handleNewSession}
              className="px-4 py-2 bg-cyan-600 text-white rounded-md font-medium hover:bg-cyan-500 transition-colors"
            >
              Start Orchestration
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
