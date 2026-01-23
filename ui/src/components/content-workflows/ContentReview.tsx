/**
 * ContentReview - Review panel for generated content
 * Instance 12 - First GROW capability
 * Instance 14 - Added expandable panel for detail view
 *
 * Shows generated content for human review with approve/revise/reject options.
 */

import { useState } from 'react';
import type { ContentWorkflow, ContentReviewDecision } from '../../lib/types/content-workflow';
import { FORMAT_LABELS, AUDIENCE_LABELS, TONE_LABELS } from '../../lib/types/content-workflow';
import { useContentWorkflowStore } from '../../stores/content-workflow-store';
import { ExpandablePanel } from '../shared/ExpandablePanel';

interface ContentReviewProps {
  workflow: ContentWorkflow;
}

export function ContentReview({ workflow }: ContentReviewProps) {
  const { setReview, transitionState } = useContentWorkflowStore();
  const [showFeedback, setShowFeedback] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [specificEdits, setSpecificEdits] = useState<string[]>([]);
  const [editInput, setEditInput] = useState('');

  const generation = workflow.generation;
  if (!generation) return null;

  const handleDecision = (decision: ContentReviewDecision) => {
    if (decision === 'needs_revision') {
      if (!showFeedback) {
        setShowFeedback(true);
        return;
      }
      if (!feedback.trim()) {
        return; // Need feedback for revision
      }
    }

    transitionState(workflow.id, 'reviewing');

    setReview(workflow.id, {
      decision,
      feedback: decision === 'needs_revision' ? feedback : undefined,
      edits: decision === 'needs_revision' && specificEdits.length > 0 ? specificEdits : undefined,
      reviewedAt: new Date(),
    });
  };

  const addEdit = () => {
    if (editInput.trim()) {
      setSpecificEdits([...specificEdits, editInput.trim()]);
      setEditInput('');
    }
  };

  const removeEdit = (index: number) => {
    setSpecificEdits(specificEdits.filter((_, i) => i !== index));
  };

  const confidenceColors = {
    high: 'text-green-400 bg-green-900/20',
    medium: 'text-yellow-400 bg-yellow-900/20',
    low: 'text-red-400 bg-red-900/20',
  };

  return (
    <ExpandablePanel
      title={`Content: ${workflow.brief.title}`}
      accent="green"
    >
    <div className="space-y-4">
      {/* Content Brief Summary */}
      <div className="bg-gray-800/50 rounded-lg p-3">
        <div className="text-xs text-gray-500 mb-2">Content Brief</div>
        <div className="flex flex-wrap gap-2 text-xs">
          <span className="px-2 py-1 bg-green-900/30 text-green-400 rounded">
            {FORMAT_LABELS[workflow.brief.format]}
          </span>
          <span className="px-2 py-1 bg-blue-900/30 text-blue-400 rounded">
            {AUDIENCE_LABELS[workflow.brief.audience]}
          </span>
          <span className="px-2 py-1 bg-purple-900/30 text-purple-400 rounded">
            {TONE_LABELS[workflow.brief.tone]}
          </span>
        </div>
      </div>

      {/* Confidence */}
      <div className="flex items-center justify-between">
        <span className="text-sm text-gray-400">AI Confidence</span>
        <span className={`px-2 py-1 rounded text-xs font-medium ${confidenceColors[generation.confidence]}`}>
          {generation.confidence.toUpperCase()}
        </span>
      </div>

      {/* Generated Content */}
      <div className="bg-gray-800/50 rounded-lg p-4">
        <h4 className="text-white font-medium mb-2">{generation.content.title}</h4>

        {generation.content.summary && (
          <p className="text-gray-400 text-sm mb-3 italic">
            {generation.content.summary}
          </p>
        )}

        {/* Content Body - Rendered as markdown-ish preview */}
        <div className="bg-gray-900/50 rounded p-3 max-h-64 overflow-y-auto">
          <pre className="text-gray-300 text-sm whitespace-pre-wrap font-sans">
            {generation.content.body}
          </pre>
        </div>

        {/* Call to Action */}
        {generation.content.callToAction && (
          <div className="mt-3 p-2 bg-green-900/20 rounded">
            <span className="text-xs text-gray-500">Call to Action: </span>
            <span className="text-green-400 text-sm">{generation.content.callToAction}</span>
          </div>
        )}

        {/* Metadata */}
        {generation.content.metadata && (
          <div className="mt-3 flex gap-4 text-xs text-gray-500">
            <span>
              Words: <span className="text-gray-400">{generation.content.metadata.wordCount}</span>
            </span>
            {generation.content.metadata.readTime && (
              <span>
                Read time: <span className="text-gray-400">{generation.content.metadata.readTime} min</span>
              </span>
            )}
          </div>
        )}
      </div>

      {/* AI Suggestions */}
      {generation.suggestions && generation.suggestions.length > 0 && (
        <div className="bg-blue-900/20 rounded-lg p-3">
          <div className="text-xs text-blue-400 font-medium mb-2">AI Suggestions</div>
          <ul className="text-sm text-gray-400 space-y-1">
            {generation.suggestions.map((suggestion, index) => (
              <li key={index} className="flex items-start gap-2">
                <span className="text-blue-400">•</span>
                {suggestion}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Alternative Approaches */}
      {generation.alternatives && generation.alternatives.length > 0 && (
        <div className="bg-gray-800/30 rounded-lg p-3">
          <div className="text-xs text-gray-500 font-medium mb-2">Alternative Approaches</div>
          <div className="space-y-2">
            {generation.alternatives.map((alt, index) => (
              <div key={index} className="text-sm">
                <span className="text-gray-300">{alt.title}:</span>
                <span className="text-gray-500 ml-1">{alt.approach}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Revision History */}
      {workflow.refinements && workflow.refinements.length > 0 && (
        <div className="bg-purple-900/20 rounded-lg p-3">
          <div className="text-xs text-purple-400 font-medium mb-2">
            Revision History ({workflow.refinements.length} revision{workflow.refinements.length !== 1 ? 's' : ''})
          </div>
          <div className="space-y-2 text-xs">
            {workflow.refinements.map((ref, index) => (
              <div key={index} className="text-gray-400">
                <span className="text-gray-500">v{ref.originalVersion + 1} → v{ref.originalVersion + 2}:</span>
                <span className="ml-1">{ref.changesApplied.slice(0, 2).join(', ')}</span>
                {ref.changesApplied.length > 2 && <span className="text-gray-500"> (+{ref.changesApplied.length - 2} more)</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Feedback Form (for revision) */}
      {showFeedback && (
        <div className="bg-yellow-900/20 rounded-lg p-3 space-y-3">
          <div className="text-xs text-yellow-400 font-medium">What changes would you like?</div>
          <textarea
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            placeholder="Describe the changes you want..."
            rows={2}
            className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-md text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-yellow-500 text-sm resize-none"
          />

          {/* Specific edits */}
          <div>
            <div className="flex gap-2 mb-2">
              <input
                type="text"
                value={editInput}
                onChange={(e) => setEditInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addEdit())}
                placeholder="Add specific edit request..."
                className="flex-1 px-2 py-1 bg-gray-800 border border-gray-700 rounded text-white placeholder-gray-500 text-xs"
              />
              <button
                onClick={addEdit}
                className="px-2 py-1 bg-gray-700 text-white rounded text-xs hover:bg-gray-600"
              >
                Add
              </button>
            </div>
            {specificEdits.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {specificEdits.map((edit, index) => (
                  <span
                    key={index}
                    className="inline-flex items-center gap-1 px-2 py-0.5 bg-yellow-900/30 text-yellow-400 rounded text-xs"
                  >
                    {edit}
                    <button onClick={() => removeEdit(index)} className="hover:text-yellow-200">x</button>
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex gap-2">
        <button
          onClick={() => handleDecision('approved')}
          className="flex-1 px-4 py-2 bg-green-600 text-white rounded-md font-medium hover:bg-green-500 transition-colors"
        >
          Approve
        </button>
        <button
          onClick={() => handleDecision('needs_revision')}
          className={`flex-1 px-4 py-2 rounded-md font-medium transition-colors ${
            showFeedback && !feedback.trim()
              ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
              : 'bg-yellow-600 text-white hover:bg-yellow-500'
          }`}
        >
          {showFeedback ? 'Submit Revision' : 'Request Changes'}
        </button>
        <button
          onClick={() => handleDecision('rejected')}
          className="px-4 py-2 bg-red-900/50 text-red-400 rounded-md font-medium hover:bg-red-900/70 transition-colors"
        >
          Reject
        </button>
      </div>
    </div>
    </ExpandablePanel>
  );
}
