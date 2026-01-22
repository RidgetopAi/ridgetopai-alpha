/**
 * TicketResponseReview - Review and approve AI-generated response
 * Instance 20 - OPERATE capability
 */

import { useState } from 'react';
import type { SupportTicketWorkflow } from '../../lib/types/support-workflow';
import { ACTION_TYPE_LABELS, SEVERITY_LABELS } from '../../lib/types/support-workflow';
import { useSupportTicketStore } from '../../stores/support-ticket-store';

interface TicketResponseReviewProps {
  workflow: SupportTicketWorkflow;
}

export function TicketResponseReview({ workflow }: TicketResponseReviewProps) {
  const { approveResponse } = useSupportTicketStore();
  const { analysis } = workflow;

  const [editedResponse, setEditedResponse] = useState(analysis?.suggestedResponse || '');
  const [isEditing, setIsEditing] = useState(false);
  const [sendEmail, setSendEmail] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!analysis) {
    return <div className="text-gray-400">No analysis available</div>;
  }

  const handleApprove = async () => {
    setIsSubmitting(true);
    await approveResponse(workflow.id, isEditing ? editedResponse : undefined, sendEmail);
    setIsSubmitting(false);
  };

  const confidenceColor = {
    high: 'text-green-400',
    medium: 'text-yellow-400',
    low: 'text-red-400',
  }[analysis.confidence];

  const severityColor = {
    critical: 'bg-red-500/20 text-red-400',
    high: 'bg-orange-500/20 text-orange-400',
    medium: 'bg-yellow-500/20 text-yellow-400',
    low: 'bg-blue-500/20 text-blue-400',
  }[analysis.severity];

  return (
    <div className="space-y-4">
      {/* Analysis Summary */}
      <div className="bg-gray-800/50 rounded-lg p-4">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-sm font-medium text-white">Analysis</h4>
          <div className="flex items-center gap-2">
            <span className={`text-xs px-2 py-0.5 rounded-full ${severityColor}`}>
              {SEVERITY_LABELS[analysis.severity]}
            </span>
            <span className={`text-xs ${confidenceColor}`}>
              {analysis.confidence} confidence
            </span>
          </div>
        </div>

        <div className="space-y-3 text-sm">
          <div>
            <span className="text-gray-400">Summary:</span>
            <p className="text-gray-200 mt-1">{analysis.summary}</p>
          </div>

          <div>
            <span className="text-gray-400">Root Cause:</span>
            <p className="text-gray-200 mt-1">{analysis.rootCause}</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <span className="text-gray-400">Affected Users:</span>
              <p className="text-gray-200 mt-1">{analysis.affectedUsers}</p>
            </div>
            <div>
              <span className="text-gray-400">Impact:</span>
              <p className="text-gray-200 mt-1">{analysis.impact}</p>
            </div>
          </div>

          {analysis.workaround && (
            <div>
              <span className="text-gray-400">Workaround:</span>
              <p className="text-cyan-300 mt-1">{analysis.workaround}</p>
            </div>
          )}
        </div>
      </div>

      {/* Action Required */}
      <div className="bg-cyan-900/20 border border-cyan-800/50 rounded-lg p-4">
        <h4 className="text-sm font-medium text-cyan-400 mb-2">Action Required</h4>
        <div className="flex items-center gap-2 mb-2">
          <span className="text-xs px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300">
            {ACTION_TYPE_LABELS[analysis.actionRequired.type]}
          </span>
          {analysis.actionRequired.estimatedEffort && (
            <span className="text-xs text-gray-400">
              Est: {analysis.actionRequired.estimatedEffort}
            </span>
          )}
        </div>
        <p className="text-sm text-gray-200">{analysis.actionRequired.description}</p>
      </div>

      {/* Internal Notes */}
      {analysis.internalNotes && (
        <div className="bg-gray-800/30 rounded-lg p-4">
          <h4 className="text-sm font-medium text-gray-400 mb-2">Internal Notes</h4>
          <p className="text-sm text-gray-300">{analysis.internalNotes}</p>
        </div>
      )}

      {/* Customer Response */}
      <div className="bg-gray-800/50 rounded-lg p-4">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-sm font-medium text-white">Customer Response</h4>
          <button
            onClick={() => setIsEditing(!isEditing)}
            className="text-xs text-cyan-400 hover:text-cyan-300"
          >
            {isEditing ? 'Use Suggested' : 'Edit Response'}
          </button>
        </div>

        {isEditing ? (
          <textarea
            value={editedResponse}
            onChange={(e) => setEditedResponse(e.target.value)}
            rows={8}
            className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-md text-white text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
          />
        ) : (
          <div className="bg-gray-900/50 rounded-lg p-4">
            <p className="text-sm text-gray-200 whitespace-pre-wrap">
              {analysis.suggestedResponse}
            </p>
          </div>
        )}

        {/* Send Email Toggle */}
        <div className="flex items-center mt-3">
          <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
            <input
              type="checkbox"
              checked={sendEmail}
              onChange={(e) => setSendEmail(e.target.checked)}
              className="w-4 h-4 rounded border-gray-600 bg-gray-800 text-cyan-500 focus:ring-cyan-500"
            />
            Send email to {workflow.ticket.customerEmail}
          </label>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        <button
          onClick={handleApprove}
          disabled={isSubmitting}
          className={`
            flex-1 px-4 py-2 rounded-md font-medium transition-colors
            ${isSubmitting
              ? 'bg-gray-700 text-gray-400 cursor-not-allowed'
              : 'bg-cyan-600 text-white hover:bg-cyan-500'
            }
          `}
        >
          {isSubmitting ? 'Sending...' : sendEmail ? 'Send Response' : 'Record Response'}
        </button>
      </div>
    </div>
  );
}
