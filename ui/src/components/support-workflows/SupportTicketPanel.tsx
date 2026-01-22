/**
 * SupportTicketPanel - Main panel for support ticket workflow
 * Instance 20 - OPERATE capability
 *
 * This is the primary entry point for the OPERATE capability.
 * It demonstrates the Inverse Hierarchy model:
 * - Human directs (support ticket)
 * - AI executes (analysis, response generation)
 * - Human verifies (review, approval)
 */

import { useState } from 'react';
import type { SupportTicketWorkflow } from '../../lib/types/support-workflow';
import { TICKET_STATE_LABELS, CATEGORY_LABELS, SEVERITY_LABELS } from '../../lib/types/support-workflow';
import { useSupportTicketStore } from '../../stores/support-ticket-store';
import { SupportTicketForm } from './SupportTicketForm';
import { TicketProgress } from './TicketProgress';
import { TicketResponseReview } from './TicketResponseReview';

export function SupportTicketPanel() {
  const { workflows, activeWorkflow, selectWorkflow, deleteWorkflow } = useSupportTicketStore();
  const [showForm, setShowForm] = useState(true);

  const handleWorkflowSubmit = (workflowId: string) => {
    setShowForm(false);
    selectWorkflow(workflowId);
  };

  const handleNewWorkflow = () => {
    selectWorkflow(null);
    setShowForm(true);
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'bg-red-500/20 text-red-400';
      case 'high': return 'bg-orange-500/20 text-orange-400';
      case 'medium': return 'bg-yellow-500/20 text-yellow-400';
      case 'low': return 'bg-blue-500/20 text-blue-400';
      default: return 'bg-gray-500/20 text-gray-400';
    }
  };

  // Render the workflow detail view
  const renderWorkflowDetail = (workflow: SupportTicketWorkflow) => {
    return (
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-lg font-medium text-white">{workflow.ticket.title}</h3>
            <div className="flex items-center gap-2 mt-1">
              <span className={`text-xs px-2 py-0.5 rounded-full ${getSeverityColor(workflow.ticket.severity)}`}>
                {SEVERITY_LABELS[workflow.ticket.severity]}
              </span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-gray-700 text-gray-300">
                {CATEGORY_LABELS[workflow.ticket.category]}
              </span>
              <span className="text-xs text-gray-500">
                {workflow.ticket.customerEmail}
              </span>
            </div>
          </div>
          <button
            onClick={handleNewWorkflow}
            className="text-sm text-cyan-400 hover:text-cyan-300"
          >
            + New Ticket
          </button>
        </div>

        {/* Progress */}
        <TicketProgress currentState={workflow.state} />

        {/* State-specific content */}
        <div className="bg-gray-900/50 rounded-lg p-4">
          {/* Draft state - shouldn't happen here but handle it */}
          {workflow.state === 'draft' && (
            <div className="text-gray-400 text-center py-4">
              Preparing workflow...
            </div>
          )}

          {/* Submitted */}
          {workflow.state === 'submitted' && (
            <div className="text-center py-8">
              <div className="animate-pulse text-cyan-400 mb-2">Gathering context...</div>
              <p className="text-gray-500 text-sm">
                Collecting relevant information for analysis
              </p>
            </div>
          )}

          {/* Analyzing */}
          {workflow.state === 'analyzing' && (
            <div className="text-center py-8">
              <div className="animate-pulse text-cyan-400 mb-2">AI is analyzing...</div>
              <p className="text-gray-500 text-sm">
                Identifying root cause and preparing response
              </p>
            </div>
          )}

          {/* Proposed / Responding */}
          {(workflow.state === 'proposed' || workflow.state === 'responding') && (
            <TicketResponseReview workflow={workflow} />
          )}

          {/* Completed */}
          {workflow.state === 'completed' && workflow.response && (
            <div className="space-y-4">
              <div className="bg-green-900/20 rounded-lg p-4 text-center">
                <div className="text-green-400 text-lg mb-2">Response Sent!</div>
                <p className="text-gray-400 text-sm">
                  Response recorded and sent to {workflow.response.sentTo}
                </p>
              </div>

              <div className="bg-gray-800/50 rounded-lg p-4">
                <h4 className="text-sm font-medium text-gray-400 mb-2">Response Summary</h4>
                <div className="text-sm">
                  <div className="mb-2">
                    <span className="text-gray-500">Sent to:</span>
                    <span className="text-white ml-2">{workflow.response.sentTo}</span>
                  </div>
                  <div className="mb-2">
                    <span className="text-gray-500">Sent at:</span>
                    <span className="text-white ml-2">
                      {workflow.response.sentAt.toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>

              {workflow.analysis && (
                <div className="bg-cyan-900/20 border border-cyan-800/50 rounded-lg p-4">
                  <h4 className="text-sm font-medium text-cyan-400 mb-2">Follow-up Action</h4>
                  <p className="text-sm text-gray-200">
                    {workflow.analysis.actionRequired.description}
                  </p>
                </div>
              )}

              <button
                onClick={handleNewWorkflow}
                className="w-full px-4 py-2 bg-cyan-600 text-white rounded-md font-medium hover:bg-cyan-500 transition-colors"
              >
                Handle Another Ticket
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
                  Failed at: {TICKET_STATE_LABELS[workflow.error.step]}
                </p>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={handleNewWorkflow}
                  className="flex-1 px-4 py-2 bg-cyan-600 text-white rounded-md font-medium hover:bg-cyan-500 transition-colors"
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
          <h2 className="text-sm font-medium text-white">Support Tickets</h2>
          <span className="text-xs px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-400">
            OPERATE
          </span>
        </div>
      </div>

      {/* Panel Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {/* Show form if no active workflow or explicitly showing form */}
        {showForm && !activeWorkflow ? (
          <div className="space-y-4">
            <p className="text-sm text-gray-400">
              Enter a support ticket and let AI analyze it and draft a response.
              You'll review and approve before sending.
            </p>
            <SupportTicketForm onSubmit={handleWorkflowSubmit} />
          </div>
        ) : activeWorkflow ? (
          renderWorkflowDetail(activeWorkflow)
        ) : (
          // Fallback - show recent workflows or empty state
          <div className="text-center py-8">
            {workflows.length > 0 ? (
              <div className="space-y-4">
                <p className="text-gray-400">Select a ticket or start a new one.</p>
                <button
                  onClick={handleNewWorkflow}
                  className="px-4 py-2 bg-cyan-600 text-white rounded-md font-medium hover:bg-cyan-500 transition-colors"
                >
                  New Support Ticket
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
                      <div className="text-sm text-white">{workflow.ticket.title}</div>
                      <div className="text-xs text-gray-500">
                        {TICKET_STATE_LABELS[workflow.state]} - {workflow.ticket.customerEmail}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-gray-400">No support tickets yet.</p>
                <button
                  onClick={handleNewWorkflow}
                  className="px-4 py-2 bg-cyan-600 text-white rounded-md font-medium hover:bg-cyan-500 transition-colors"
                >
                  New Support Ticket
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
