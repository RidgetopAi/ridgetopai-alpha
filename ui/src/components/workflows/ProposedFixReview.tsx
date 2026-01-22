/**
 * ProposedFixReview - Review AI-proposed bug fix
 * Instance 09 - First PRODUCE capability
 */

import { useState } from 'react';
import type { BugFixWorkflow, ReviewDecision, CodeChange } from '../../lib/types/workflow';
import { useWorkflowStore } from '../../stores/workflow-store';

interface ProposedFixReviewProps {
  workflow: BugFixWorkflow;
}

function CodeDiff({ change }: { change: CodeChange }) {
  return (
    <div className="rounded-md overflow-hidden border border-gray-700">
      <div className="bg-gray-800 px-3 py-2 text-sm text-gray-400 border-b border-gray-700">
        {change.file}
      </div>
      <div className="grid grid-cols-2 divide-x divide-gray-700">
        {/* Original */}
        <div>
          <div className="bg-red-900/20 px-3 py-1 text-xs text-red-400 border-b border-gray-700">
            Original
          </div>
          <pre className="p-3 text-sm text-gray-300 bg-gray-900/50 overflow-x-auto">
            <code>{change.original}</code>
          </pre>
        </div>
        {/* Proposed */}
        <div>
          <div className="bg-green-900/20 px-3 py-1 text-xs text-green-400 border-b border-gray-700">
            Proposed
          </div>
          <pre className="p-3 text-sm text-gray-300 bg-gray-900/50 overflow-x-auto">
            <code>{change.proposed}</code>
          </pre>
        </div>
      </div>
    </div>
  );
}

export function ProposedFixReview({ workflow }: ProposedFixReviewProps) {
  const { setReview, transitionState } = useWorkflowStore();
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const analysis = workflow.analysis;
  if (!analysis?.proposedFix) {
    return (
      <div className="text-gray-500 text-center py-8">
        No proposed fix available yet.
      </div>
    );
  }

  const handleReview = (decision: ReviewDecision) => {
    setIsSubmitting(true);

    // Transition to reviewing state if not already there
    if (workflow.state === 'proposed') {
      transitionState(workflow.id, 'reviewing');
    }

    setReview(workflow.id, {
      decision,
      notes: notes.trim() || undefined,
      reviewedAt: new Date(),
    });

    setNotes('');
    setIsSubmitting(false);
  };

  const isInReviewableState = workflow.state === 'proposed' || workflow.state === 'reviewing';

  return (
    <div className="space-y-4">
      {/* Analysis Summary */}
      <div className="bg-gray-800/50 rounded-lg p-4">
        <h4 className="text-sm font-medium text-gray-400 mb-2">Root Cause Analysis</h4>
        <p className="text-sm text-gray-300">{analysis.rootCause}</p>
        <div className="mt-2 flex items-center gap-2">
          <span
            className={`
              text-xs px-2 py-0.5 rounded-full
              ${analysis.confidence === 'high' ? 'bg-green-500/20 text-green-400' : ''}
              ${analysis.confidence === 'medium' ? 'bg-yellow-500/20 text-yellow-400' : ''}
              ${analysis.confidence === 'low' ? 'bg-red-500/20 text-red-400' : ''}
            `}
          >
            {analysis.confidence} confidence
          </span>
        </div>
      </div>

      {/* Fix Explanation */}
      <div className="bg-gray-800/50 rounded-lg p-4">
        <h4 className="text-sm font-medium text-gray-400 mb-2">Proposed Solution</h4>
        <p className="text-sm text-gray-300">{analysis.proposedFix.explanation}</p>
      </div>

      {/* Code Changes */}
      <div>
        <h4 className="text-sm font-medium text-gray-400 mb-2">Code Changes</h4>
        <div className="space-y-3">
          {analysis.proposedFix.changes.map((change, index) => (
            <CodeDiff key={index} change={change} />
          ))}
        </div>
      </div>

      {/* Risks */}
      {analysis.proposedFix.risks.length > 0 && (
        <div className="bg-yellow-900/20 rounded-lg p-4">
          <h4 className="text-sm font-medium text-yellow-400 mb-2">Potential Risks</h4>
          <ul className="list-disc list-inside text-sm text-yellow-300">
            {analysis.proposedFix.risks.map((risk, index) => (
              <li key={index}>{risk}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Test Needs */}
      {analysis.proposedFix.testNeeds.length > 0 && (
        <div className="bg-blue-900/20 rounded-lg p-4">
          <h4 className="text-sm font-medium text-blue-400 mb-2">Testing Required</h4>
          <ul className="list-disc list-inside text-sm text-blue-300">
            {analysis.proposedFix.testNeeds.map((need, index) => (
              <li key={index}>{need}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Review Actions */}
      {isInReviewableState && (
        <div className="border-t border-gray-700 pt-4 mt-4">
          <div className="mb-3">
            <label htmlFor="review-notes" className="block text-sm font-medium text-gray-400 mb-1">
              Review Notes (optional)
            </label>
            <textarea
              id="review-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add any notes or guidance for the fix..."
              rows={2}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-md text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none text-sm"
            />
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => handleReview('approved')}
              disabled={isSubmitting}
              className="flex-1 px-4 py-2 bg-green-600 text-white rounded-md font-medium hover:bg-green-500 transition-colors disabled:opacity-50"
            >
              Approve & Implement
            </button>
            <button
              onClick={() => handleReview('changes_requested')}
              disabled={isSubmitting}
              className="flex-1 px-4 py-2 bg-yellow-600 text-white rounded-md font-medium hover:bg-yellow-500 transition-colors disabled:opacity-50"
            >
              Request Changes
            </button>
            <button
              onClick={() => handleReview('rejected')}
              disabled={isSubmitting}
              className="px-4 py-2 bg-red-600 text-white rounded-md font-medium hover:bg-red-500 transition-colors disabled:opacity-50"
            >
              Reject
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
