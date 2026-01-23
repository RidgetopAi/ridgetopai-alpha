/**
 * BugFixPanel - Main panel for bug fix workflow
 * Instance 09 - First PRODUCE capability
 *
 * This is the primary entry point for the PRODUCE capability.
 * It demonstrates the Inverse Hierarchy model:
 * - Human directs (bug report)
 * - AI executes (analysis, fix proposal)
 * - Human verifies (review, approval)
 */

import { useState } from 'react';
import type { BugFixWorkflow } from '../../lib/types/workflow';
import { WORKFLOW_STATE_LABELS } from '../../lib/types/workflow';
import { useWorkflowStore } from '../../stores/workflow-store';
import { BugReportForm } from './BugReportForm';
import { WorkflowProgress } from './WorkflowProgress';
import { ProposedFixReview } from './ProposedFixReview';

export function BugFixPanel() {
  const { workflows, activeWorkflow, selectWorkflow, deleteWorkflow, confirmWorkflow } = useWorkflowStore();
  const [showForm, setShowForm] = useState(true);
  const [confirmFeedback, setConfirmFeedback] = useState('');
  const [isConfirming, setIsConfirming] = useState(false);

  const handleWorkflowSubmit = (workflowId: string) => {
    setShowForm(false);
    selectWorkflow(workflowId);
  };

  const handleNewWorkflow = () => {
    selectWorkflow(null);
    setShowForm(true);
  };

  // Render the workflow detail view
  const renderWorkflowDetail = (workflow: BugFixWorkflow) => {
    return (
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-lg font-medium text-white">{workflow.bugReport.title}</h3>
            <div className="flex items-center gap-2 mt-1">
              <span
                className={`
                  text-xs px-2 py-0.5 rounded-full
                  ${workflow.bugReport.severity === 'blocker' ? 'bg-red-500/20 text-red-400' : ''}
                  ${workflow.bugReport.severity === 'major' ? 'bg-yellow-500/20 text-yellow-400' : ''}
                  ${workflow.bugReport.severity === 'minor' ? 'bg-gray-500/20 text-gray-400' : ''}
                `}
              >
                {workflow.bugReport.severity}
              </span>
              <span className="text-xs text-gray-500">
                Created {workflow.createdAt.toLocaleTimeString()}
              </span>
            </div>
          </div>
          <button
            onClick={handleNewWorkflow}
            className="text-sm text-blue-400 hover:text-blue-300"
          >
            + New Bug
          </button>
        </div>

        {/* Progress */}
        <WorkflowProgress currentState={workflow.state} />

        {/* State-specific content */}
        <div className="bg-gray-900/50 rounded-lg p-4">
          {/* Draft state - shouldn't happen here but handle it */}
          {workflow.state === 'draft' && (
            <div className="text-gray-400 text-center py-4">
              Preparing workflow...
            </div>
          )}

          {/* Submitted / Context gathering */}
          {workflow.state === 'submitted' && (
            <div className="text-center py-8">
              <div className="animate-pulse text-blue-400 mb-2">Gathering context...</div>
              <p className="text-gray-500 text-sm">
                Collecting relevant code files and project history
              </p>
            </div>
          )}

          {/* Analyzing */}
          {workflow.state === 'analyzing' && (
            <div className="text-center py-8">
              <div className="animate-pulse text-purple-400 mb-2">AI is analyzing...</div>
              <p className="text-gray-500 text-sm">
                Identifying root cause and preparing fix proposal
              </p>
            </div>
          )}

          {/* Proposed / Reviewing */}
          {(workflow.state === 'proposed' || workflow.state === 'reviewing') && (
            <ProposedFixReview workflow={workflow} />
          )}

          {/* Implementing */}
          {workflow.state === 'implementing' && (
            <div className="text-center py-8">
              <div className="animate-pulse text-green-400 mb-2">Implementing fix...</div>
              <p className="text-gray-500 text-sm">
                Applying approved changes to codebase
              </p>
            </div>
          )}

          {/* Verifying */}
          {workflow.state === 'verifying' && (
            <div className="text-center py-8">
              <div className="animate-pulse text-yellow-400 mb-2">Verifying fix...</div>
              <p className="text-gray-500 text-sm">
                Running tests and confirming fix works
              </p>
            </div>
          )}

          {/* Completed */}
          {workflow.state === 'completed' && workflow.implementation && (
            <div className="space-y-4">
              <div className="bg-green-900/20 rounded-lg p-4 text-center">
                <div className="text-green-400 text-lg mb-2">Bug Fix Complete!</div>
                <p className="text-gray-400 text-sm">
                  Changes have been implemented.
                </p>
              </div>

              {/* Changed Files */}
              <div className="bg-gray-800/50 rounded-lg p-4">
                <h4 className="text-sm font-medium text-gray-400 mb-2">
                  Files Changed ({workflow.implementation.changedFiles.length})
                </h4>
                {workflow.implementation.changedFiles.length > 0 ? (
                  <ul className="text-sm text-gray-300 space-y-1">
                    {workflow.implementation.changedFiles.map((file, i) => (
                      <li key={i} className="font-mono text-xs truncate">{file}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-gray-500 text-sm">No files reported</p>
                )}
              </div>

              {/* Build Result */}
              {workflow.implementation.buildResult && (
                <div className="bg-gray-800/50 rounded-lg p-4">
                  <h4 className="text-sm font-medium text-gray-400 mb-2">Build</h4>
                  <div className="flex items-center gap-2 text-sm">
                    <span className={workflow.implementation.buildResult.success ? 'text-green-400' : 'text-red-400'}>
                      {workflow.implementation.buildResult.success ? '✓ Passed' : '✗ Failed'}
                    </span>
                    <span className="text-gray-500 font-mono text-xs">
                      {workflow.implementation.buildResult.command}
                    </span>
                  </div>
                  {workflow.implementation.buildResult.output && (
                    <pre className="mt-2 text-xs text-gray-400 bg-gray-900 p-2 rounded overflow-x-auto max-h-24">
                      {workflow.implementation.buildResult.output}
                    </pre>
                  )}
                </div>
              )}

              {/* Test Results */}
              {workflow.implementation.testResults && (
                <div className="bg-gray-800/50 rounded-lg p-4">
                  <h4 className="text-sm font-medium text-gray-400 mb-2">Tests</h4>
                  <div className="flex items-center gap-4 text-sm">
                    <span className="text-green-400">
                      {workflow.implementation.testResults.passed} passed
                    </span>
                    {workflow.implementation.testResults.failed > 0 && (
                      <span className="text-red-400">
                        {workflow.implementation.testResults.failed} failed
                      </span>
                    )}
                    {workflow.implementation.testResults.skipped > 0 && (
                      <span className="text-yellow-400">
                        {workflow.implementation.testResults.skipped} skipped
                      </span>
                    )}
                    {workflow.implementation.testResults.duration && (
                      <span className="text-gray-500">
                        ({Math.round(workflow.implementation.testResults.duration / 1000)}s)
                      </span>
                    )}
                  </div>
                  {workflow.implementation.testResults.output && (
                    <pre className="mt-2 text-xs text-gray-400 bg-gray-900 p-2 rounded overflow-x-auto max-h-24">
                      {workflow.implementation.testResults.output}
                    </pre>
                  )}
                </div>
              )}

              {/* Warnings */}
              {workflow.implementation.warnings.length > 0 && (
                <div className="bg-yellow-900/20 rounded-lg p-4">
                  <h4 className="text-sm font-medium text-yellow-400 mb-2">Warnings</h4>
                  <ul className="text-sm text-yellow-300 space-y-1">
                    {workflow.implementation.warnings.map((warning, i) => (
                      <li key={i}>{warning}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Confirmation Section */}
              {!workflow.confirmation ? (
                <div className="bg-gray-800/50 rounded-lg p-4 space-y-3">
                  <h4 className="text-sm font-medium text-gray-300">Verify the Fix</h4>
                  <p className="text-xs text-gray-500">
                    Please test the changes and confirm whether the fix worked.
                    This feedback will be stored to Mandrel for future reference.
                  </p>
                  <textarea
                    value={confirmFeedback}
                    onChange={(e) => setConfirmFeedback(e.target.value)}
                    placeholder="Optional: Add notes about your testing..."
                    className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-md text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm resize-none"
                    rows={2}
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={async () => {
                        setIsConfirming(true);
                        await confirmWorkflow(workflow.id, true, confirmFeedback || undefined);
                        setIsConfirming(false);
                        setConfirmFeedback('');
                      }}
                      disabled={isConfirming}
                      className="flex-1 px-4 py-2 bg-green-600 text-white rounded-md font-medium hover:bg-green-500 transition-colors disabled:opacity-50"
                    >
                      {isConfirming ? 'Confirming...' : '✓ Fix Worked'}
                    </button>
                    <button
                      onClick={async () => {
                        setIsConfirming(true);
                        await confirmWorkflow(workflow.id, false, confirmFeedback || undefined);
                        setIsConfirming(false);
                        setConfirmFeedback('');
                      }}
                      disabled={isConfirming}
                      className="flex-1 px-4 py-2 bg-red-600 text-white rounded-md font-medium hover:bg-red-500 transition-colors disabled:opacity-50"
                    >
                      {isConfirming ? 'Confirming...' : '✗ Fix Failed'}
                    </button>
                  </div>
                </div>
              ) : (
                <div className={`rounded-lg p-4 ${workflow.confirmation.confirmed ? 'bg-green-900/20' : 'bg-red-900/20'}`}>
                  <div className="flex items-center justify-between">
                    <div>
                      <span className={workflow.confirmation.confirmed ? 'text-green-400' : 'text-red-400'}>
                        {workflow.confirmation.confirmed ? '✓ Fix Confirmed Working' : '✗ Fix Did Not Work'}
                      </span>
                      {workflow.confirmation.storedToMandrel && (
                        <span className="ml-2 text-xs text-gray-500">(saved to Mandrel)</span>
                      )}
                    </div>
                    <span className="text-xs text-gray-500">
                      {workflow.confirmation.confirmedAt.toLocaleTimeString()}
                    </span>
                  </div>
                  {workflow.confirmation.feedback && (
                    <p className="mt-2 text-sm text-gray-400">{workflow.confirmation.feedback}</p>
                  )}
                </div>
              )}

              <button
                onClick={handleNewWorkflow}
                className="w-full px-4 py-2 bg-blue-600 text-white rounded-md font-medium hover:bg-blue-500 transition-colors"
              >
                Start Another Bug Fix
              </button>
            </div>
          )}

          {/* Failed */}
          {workflow.state === 'failed' && workflow.error && (
            <div className="space-y-4">
              <div className="bg-red-900/20 rounded-lg p-4 text-center">
                <div className="text-red-400 text-lg mb-2">Workflow Failed</div>
                <p className="text-gray-400 text-sm">{workflow.error.message}</p>
                <p className="text-gray-500 text-xs mt-1">
                  Failed at: {WORKFLOW_STATE_LABELS[workflow.error.step]}
                </p>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={handleNewWorkflow}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md font-medium hover:bg-blue-500 transition-colors"
                >
                  Try Again
                </button>
                <button
                  onClick={() => deleteWorkflow(workflow.id)}
                  className="px-4 py-2 bg-gray-700 text-gray-300 rounded-md font-medium hover:bg-gray-600 transition-colors"
                >
                  Delete
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="bg-gray-900 rounded-lg border border-gray-800 overflow-hidden h-full flex flex-col">
      {/* Panel Header */}
      <div className="px-4 py-3 border-b border-gray-800 bg-gray-900/50">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium text-white">Bug Fix Workflow</h2>
          <span className="text-xs px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-400">
            PRODUCE
          </span>
        </div>
      </div>

      {/* Panel Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {/* Show form if no active workflow or explicitly showing form */}
        {showForm && !activeWorkflow ? (
          <div className="space-y-4">
            <p className="text-sm text-gray-400">
              Describe the bug and let AI help fix it. You'll review and approve all changes before
              they're applied.
            </p>
            <BugReportForm onSubmit={handleWorkflowSubmit} />
          </div>
        ) : activeWorkflow ? (
          renderWorkflowDetail(activeWorkflow)
        ) : (
          // Fallback - show recent workflows or empty state
          <div className="text-center py-8">
            {workflows.length > 0 ? (
              <div className="space-y-4">
                <p className="text-gray-400">Select a workflow or start a new one.</p>
                <button
                  onClick={handleNewWorkflow}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md font-medium hover:bg-blue-500 transition-colors"
                >
                  New Bug Fix
                </button>
                <div className="mt-4 space-y-2">
                  {workflows.slice(-5).map((workflow) => (
                    <button
                      key={workflow.id}
                      onClick={() => {
                        selectWorkflow(workflow.id);
                        setShowForm(false);
                      }}
                      className="w-full text-left px-3 py-2 bg-gray-800 rounded-md hover:bg-gray-700 transition-colors"
                    >
                      <div className="text-sm text-white">{workflow.bugReport.title}</div>
                      <div className="text-xs text-gray-500">
                        {WORKFLOW_STATE_LABELS[workflow.state]}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-gray-400">No bug fix workflows yet.</p>
                <button
                  onClick={handleNewWorkflow}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md font-medium hover:bg-blue-500 transition-colors"
                >
                  Start Bug Fix
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
