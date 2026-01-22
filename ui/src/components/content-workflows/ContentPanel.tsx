/**
 * ContentPanel - Main panel for content generation workflow
 * Instance 12 - First GROW capability
 *
 * This is the primary entry point for the GROW capability.
 * It demonstrates the Inverse Hierarchy model for content:
 * - Human directs (content brief)
 * - AI executes (research, generation)
 * - Human verifies (review, approval)
 */

import { useState } from 'react';
import type { ContentWorkflow } from '../../lib/types/content-workflow';
import { CONTENT_STATE_LABELS, FORMAT_LABELS } from '../../lib/types/content-workflow';
import { useContentWorkflowStore } from '../../stores/content-workflow-store';
import { ContentBriefForm } from './ContentBriefForm';
import { ContentProgress } from './ContentProgress';
import { ContentReview } from './ContentReview';

export function ContentPanel() {
  const { workflows, activeWorkflow, selectWorkflow, deleteWorkflow } = useContentWorkflowStore();
  const [showForm, setShowForm] = useState(true);

  const handleWorkflowSubmit = (workflowId: string) => {
    setShowForm(false);
    selectWorkflow(workflowId);
  };

  const handleNewWorkflow = () => {
    selectWorkflow(null);
    setShowForm(true);
  };

  // Copy content to clipboard
  const handleCopyContent = (workflow: ContentWorkflow) => {
    const content = workflow.finalContent?.content || workflow.generation?.content;
    if (content) {
      const text = `# ${content.title}\n\n${content.body}`;
      navigator.clipboard.writeText(text);
    }
  };

  // Render the workflow detail view
  const renderWorkflowDetail = (workflow: ContentWorkflow) => {
    return (
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-lg font-medium text-white">{workflow.brief.title}</h3>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xs px-2 py-0.5 rounded-full bg-green-500/20 text-green-400">
                {FORMAT_LABELS[workflow.brief.format]}
              </span>
              <span className="text-xs text-gray-500">
                Created {workflow.createdAt.toLocaleTimeString()}
              </span>
            </div>
          </div>
          <button
            onClick={handleNewWorkflow}
            className="text-sm text-green-400 hover:text-green-300"
          >
            + New Content
          </button>
        </div>

        {/* Progress */}
        <ContentProgress currentState={workflow.state} />

        {/* State-specific content */}
        <div className="bg-gray-900/50 rounded-lg p-4">
          {/* Draft state - shouldn't happen here but handle it */}
          {workflow.state === 'draft' && (
            <div className="text-gray-400 text-center py-4">
              Preparing workflow...
            </div>
          )}

          {/* Submitted / Research gathering */}
          {workflow.state === 'submitted' && (
            <div className="text-center py-8">
              <div className="animate-pulse text-blue-400 mb-2">Gathering research...</div>
              <p className="text-gray-500 text-sm">
                Collecting relevant context and research for content
              </p>
            </div>
          )}

          {/* Researching */}
          {workflow.state === 'researching' && (
            <div className="text-center py-8">
              <div className="animate-pulse text-purple-400 mb-2">Researching topic...</div>
              <p className="text-gray-500 text-sm">
                Analyzing topic and gathering insights
              </p>
            </div>
          )}

          {/* Generating */}
          {workflow.state === 'generating' && (
            <div className="text-center py-8">
              <div className="animate-pulse text-green-400 mb-2">Generating content...</div>
              <p className="text-gray-500 text-sm">
                AI is creating your {FORMAT_LABELS[workflow.brief.format].toLowerCase()}
              </p>
            </div>
          )}

          {/* Proposed / Reviewing */}
          {(workflow.state === 'proposed' || workflow.state === 'reviewing') && (
            <ContentReview workflow={workflow} />
          )}

          {/* Refining */}
          {workflow.state === 'refining' && (
            <div className="text-center py-8">
              <div className="animate-pulse text-yellow-400 mb-2">Refining content...</div>
              <p className="text-gray-500 text-sm">
                Applying your feedback and requested changes
              </p>
            </div>
          )}

          {/* Completed */}
          {workflow.state === 'completed' && workflow.finalContent && (
            <div className="space-y-4">
              <div className="bg-green-900/20 rounded-lg p-4 text-center">
                <div className="text-green-400 text-lg mb-2">Content Ready!</div>
                <p className="text-gray-400 text-sm">
                  Your {FORMAT_LABELS[workflow.brief.format].toLowerCase()} is ready to use.
                </p>
              </div>

              {/* Final Content Preview */}
              <div className="bg-gray-800/50 rounded-lg p-4">
                <h4 className="text-white font-medium mb-2">{workflow.finalContent.content.title}</h4>
                <div className="bg-gray-900/50 rounded p-3 max-h-48 overflow-y-auto">
                  <pre className="text-gray-300 text-sm whitespace-pre-wrap font-sans">
                    {workflow.finalContent.content.body}
                  </pre>
                </div>
              </div>

              {/* Export options */}
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-500">
                  {workflow.finalContent.content.metadata?.wordCount || 0} words
                </span>
                <div className="flex gap-2">
                  {workflow.finalContent.exportFormats?.map((format) => (
                    <span key={format} className="px-2 py-1 bg-gray-700 text-gray-300 rounded text-xs">
                      {format.toUpperCase()}
                    </span>
                  ))}
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => handleCopyContent(workflow)}
                  className="flex-1 px-4 py-2 bg-green-600 text-white rounded-md font-medium hover:bg-green-500 transition-colors"
                >
                  Copy to Clipboard
                </button>
                <button
                  onClick={handleNewWorkflow}
                  className="px-4 py-2 bg-gray-700 text-white rounded-md font-medium hover:bg-gray-600 transition-colors"
                >
                  New Content
                </button>
              </div>
            </div>
          )}

          {/* Failed */}
          {workflow.state === 'failed' && workflow.error && (
            <div className="space-y-4">
              <div className="bg-red-900/20 rounded-lg p-4 text-center">
                <div className="text-red-400 text-lg mb-2">Generation Failed</div>
                <p className="text-gray-400 text-sm">{workflow.error.message}</p>
                <p className="text-gray-500 text-xs mt-1">
                  Failed at: {CONTENT_STATE_LABELS[workflow.error.step]}
                </p>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={handleNewWorkflow}
                  className="flex-1 px-4 py-2 bg-green-600 text-white rounded-md font-medium hover:bg-green-500 transition-colors"
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
          <h2 className="text-sm font-medium text-white">Content Generation</h2>
          <span className="text-xs px-2 py-0.5 rounded-full bg-green-500/20 text-green-400">
            GROW
          </span>
        </div>
      </div>

      {/* Panel Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {/* Show form if no active workflow or explicitly showing form */}
        {showForm && !activeWorkflow ? (
          <div className="space-y-4">
            <p className="text-sm text-gray-400">
              Create content with AI assistance. Describe what you need and review the generated content before publishing.
            </p>
            <ContentBriefForm onSubmit={handleWorkflowSubmit} />
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
                  className="px-4 py-2 bg-green-600 text-white rounded-md font-medium hover:bg-green-500 transition-colors"
                >
                  New Content
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
                      <div className="text-sm text-white">{workflow.brief.title}</div>
                      <div className="text-xs text-gray-500">
                        {CONTENT_STATE_LABELS[workflow.state]} • {FORMAT_LABELS[workflow.brief.format]}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-gray-400">No content workflows yet.</p>
                <button
                  onClick={handleNewWorkflow}
                  className="px-4 py-2 bg-green-600 text-white rounded-md font-medium hover:bg-green-500 transition-colors"
                >
                  Create Content
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
