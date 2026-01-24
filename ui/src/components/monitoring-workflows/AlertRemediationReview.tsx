/**
 * AlertRemediationReview - Review and approve AI-suggested remediation
 * Instance 21 + Instance 7 (SIRK Bugfix) - OPERATE capability
 *
 * Enhanced with step-by-step remediation execution panel
 */

import { useState, useEffect } from 'react';
import type { MonitoringAlertWorkflow } from '../../lib/types/monitoring-workflow';
import { SEVERITY_LABELS, REMEDIATION_TYPE_LABELS } from '../../lib/types/monitoring-workflow';
import { useMonitoringStore } from '../../stores/monitoring-store';
import { RemediationExecutionPanel } from './RemediationExecutionPanel';
import { getRemediationStatus } from '../../lib/api/monitoringRunner';

interface AlertRemediationReviewProps {
  workflow: MonitoringAlertWorkflow;
}

export function AlertRemediationReview({ workflow }: AlertRemediationReviewProps) {
  const { executeRemediationAction, transitionState, reanalyze } = useMonitoringStore();
  const [notes, setNotes] = useState('');
  const [isExecuting, setIsExecuting] = useState(false);
  const [showExecutionPanel, setShowExecutionPanel] = useState(false);
  const [isEditingSteps, setIsEditingSteps] = useState(false);
  const [editedSteps, setEditedSteps] = useState<string[]>([]);
  const [showReanalyze, setShowReanalyze] = useState(false);
  const [reanalyzeContext, setReanalyzeContext] = useState('');
  const [isReanalyzing, setIsReanalyzing] = useState(false);

  // Check if there's an active remediation on mount
  useEffect(() => {
    const checkExistingRemediation = async () => {
      try {
        const result = await getRemediationStatus(workflow.id);
        if (result.success && result.execution) {
          setShowExecutionPanel(true);
        }
      } catch {
        // No existing remediation, that's fine
      }
    };

    if (workflow.state === 'remediating') {
      checkExistingRemediation();
    }
  }, [workflow.id, workflow.state]);

  if (!workflow.analysis) {
    return <div className="text-gray-400">No analysis available</div>;
  }

  const analysis = workflow.analysis;

  const handleAction = async (action: 'execute' | 'dismiss' | 'escalate') => {
    setIsExecuting(true);
    // Pass modified steps if user edited them, otherwise undefined
    const stepsToUse = isEditingSteps && editedSteps.length > 0 ? editedSteps : undefined;
    await executeRemediationAction(workflow.id, action, notes || undefined, stepsToUse);
    setIsExecuting(false);

    // If executing, show the execution panel
    if (action === 'execute') {
      setShowExecutionPanel(true);
    }
  };

  // Initialize edited steps from analysis when entering edit mode
  const handleStartEditing = () => {
    if (workflow.analysis) {
      setEditedSteps([...workflow.analysis.suggestedRemediation.steps]);
    }
    setIsEditingSteps(true);
  };

  // Cancel editing and revert to original steps
  const handleCancelEditing = () => {
    setEditedSteps([]);
    setIsEditingSteps(false);
  };

  // Update a specific step
  const handleStepChange = (index: number, value: string) => {
    const newSteps = [...editedSteps];
    newSteps[index] = value;
    setEditedSteps(newSteps);
  };

  // Add a new step
  const handleAddStep = () => {
    setEditedSteps([...editedSteps, '']);
  };

  // Remove a step
  const handleRemoveStep = (index: number) => {
    setEditedSteps(editedSteps.filter((_, i) => i !== index));
  };

  // Move step up
  const handleMoveStepUp = (index: number) => {
    if (index === 0) return;
    const newSteps = [...editedSteps];
    [newSteps[index - 1], newSteps[index]] = [newSteps[index], newSteps[index - 1]];
    setEditedSteps(newSteps);
  };

  // Move step down
  const handleMoveStepDown = (index: number) => {
    if (index === editedSteps.length - 1) return;
    const newSteps = [...editedSteps];
    [newSteps[index], newSteps[index + 1]] = [newSteps[index + 1], newSteps[index]];
    setEditedSteps(newSteps);
  };

  // Get the current steps to display (edited or original)
  const displaySteps = isEditingSteps ? editedSteps : (workflow.analysis?.suggestedRemediation.steps || []);

  const handleReanalyze = async () => {
    setIsReanalyzing(true);
    await reanalyze(workflow.id, reanalyzeContext || undefined);
    setIsReanalyzing(false);
    setShowReanalyze(false);
    setReanalyzeContext('');
  };

  const handleExecutionComplete = () => {
    transitionState(workflow.id, 'completed');
  };

  const handleExecutionCancel = () => {
    transitionState(workflow.id, 'proposed');
    setShowExecutionPanel(false);
  };

  const getUrgencyColor = (urgency: string) => {
    switch (urgency) {
      case 'critical': return 'bg-red-500/20 text-red-400 border-red-500/50';
      case 'high': return 'bg-orange-500/20 text-orange-400 border-orange-500/50';
      case 'medium': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/50';
      case 'low': return 'bg-blue-500/20 text-blue-400 border-blue-500/50';
      default: return 'bg-gray-500/20 text-gray-400 border-gray-500/50';
    }
  };

  const getConfidenceColor = (confidence: string) => {
    switch (confidence) {
      case 'high': return 'text-green-400';
      case 'medium': return 'text-yellow-400';
      case 'low': return 'text-red-400';
      default: return 'text-gray-400';
    }
  };

  const getRemediationTypeColor = (type: string) => {
    switch (type) {
      case 'restart': return 'bg-orange-500/20 text-orange-400';
      case 'scale': return 'bg-blue-500/20 text-blue-400';
      case 'rollback': return 'bg-purple-500/20 text-purple-400';
      case 'investigate': return 'bg-yellow-500/20 text-yellow-400';
      case 'notify': return 'bg-cyan-500/20 text-cyan-400';
      case 'none': return 'bg-gray-500/20 text-gray-400';
      default: return 'bg-gray-500/20 text-gray-400';
    }
  };

  return (
    <div className="space-y-4">
      {/* Summary Header */}
      <div className={`rounded-lg p-4 border ${getUrgencyColor(analysis.urgency)}`}>
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium">
            Urgency: {SEVERITY_LABELS[analysis.urgency]}
          </span>
          <span className={`text-sm ${getConfidenceColor(analysis.confidence)}`}>
            Confidence: {analysis.confidence}
          </span>
        </div>
        <p className="text-white">{analysis.summary}</p>
      </div>

      {/* Analysis Grid */}
      <div className="grid grid-cols-2 gap-4">
        {/* Root Cause */}
        <div className="bg-gray-800/50 rounded-lg p-3">
          <h4 className="text-xs font-medium text-gray-400 uppercase mb-1">Root Cause</h4>
          <p className="text-sm text-gray-200">{analysis.rootCause}</p>
        </div>

        {/* Impact */}
        <div className="bg-gray-800/50 rounded-lg p-3">
          <h4 className="text-xs font-medium text-gray-400 uppercase mb-1">Impact</h4>
          <p className="text-sm text-gray-200">{analysis.impact}</p>
        </div>

        {/* Affected Systems */}
        <div className="bg-gray-800/50 rounded-lg p-3">
          <h4 className="text-xs font-medium text-gray-400 uppercase mb-1">Affected Systems</h4>
          <p className="text-sm text-gray-200">{analysis.affectedSystems}</p>
        </div>

        {/* Estimated Downtime */}
        <div className="bg-gray-800/50 rounded-lg p-3">
          <h4 className="text-xs font-medium text-gray-400 uppercase mb-1">Estimated Downtime</h4>
          <p className="text-sm text-gray-200">
            {analysis.suggestedRemediation.estimatedDowntime || 'Unknown'}
          </p>
        </div>
      </div>

      {/* Suggested Remediation */}
      <div className="bg-orange-900/20 border border-orange-800/50 rounded-lg p-4">
        <div className="flex items-center gap-2 mb-3">
          <h4 className="text-sm font-medium text-orange-400">Suggested Remediation</h4>
          <span className={`text-xs px-2 py-0.5 rounded-full ${getRemediationTypeColor(analysis.suggestedRemediation.type)}`}>
            {REMEDIATION_TYPE_LABELS[analysis.suggestedRemediation.type]}
          </span>
        </div>

        <p className="text-sm text-gray-200 mb-3">{analysis.suggestedRemediation.description}</p>

        {/* Steps */}
        <div className="space-y-2 mb-3">
          <div className="flex items-center justify-between">
            <h5 className="text-xs font-medium text-gray-400 uppercase">Steps</h5>
            {!isEditingSteps && !showExecutionPanel && (
              <button
                onClick={handleStartEditing}
                className="text-xs text-orange-400 hover:text-orange-300 transition-colors"
              >
                Edit Steps
              </button>
            )}
            {isEditingSteps && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-orange-400">Editing</span>
                <button
                  onClick={handleCancelEditing}
                  className="text-xs text-gray-400 hover:text-gray-300 transition-colors"
                >
                  Cancel
                </button>
              </div>
            )}
          </div>

          {isEditingSteps ? (
            <div className="space-y-2">
              {displaySteps.map((step, index) => (
                <div key={index} className="flex items-start gap-2">
                  <span className="text-sm text-gray-500 mt-2 w-6">{index + 1}.</span>
                  <textarea
                    value={step}
                    onChange={(e) => handleStepChange(index, e.target.value)}
                    rows={2}
                    className="flex-1 px-3 py-2 bg-gray-800 border border-gray-700 rounded-md text-white text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent resize-none"
                  />
                  <div className="flex flex-col gap-1">
                    <button
                      onClick={() => handleMoveStepUp(index)}
                      disabled={index === 0}
                      className="p-1 text-gray-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed"
                      title="Move up"
                    >
                      ↑
                    </button>
                    <button
                      onClick={() => handleMoveStepDown(index)}
                      disabled={index === displaySteps.length - 1}
                      className="p-1 text-gray-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed"
                      title="Move down"
                    >
                      ↓
                    </button>
                    <button
                      onClick={() => handleRemoveStep(index)}
                      className="p-1 text-red-400 hover:text-red-300"
                      title="Remove step"
                    >
                      ×
                    </button>
                  </div>
                </div>
              ))}
              <button
                onClick={handleAddStep}
                className="w-full px-3 py-2 border border-dashed border-gray-600 rounded-md text-sm text-gray-400 hover:text-gray-300 hover:border-gray-500 transition-colors"
              >
                + Add Step
              </button>
            </div>
          ) : (
            <ol className="list-decimal list-inside space-y-1">
              {displaySteps.map((step, index) => (
                <li key={index} className="text-sm text-gray-300">{step}</li>
              ))}
            </ol>
          )}
        </div>

        {/* Risks */}
        {analysis.suggestedRemediation.risks.length > 0 && (
          <div className="bg-red-900/20 rounded-lg p-3">
            <h5 className="text-xs font-medium text-red-400 uppercase mb-1">Risks</h5>
            <ul className="list-disc list-inside space-y-1">
              {analysis.suggestedRemediation.risks.map((risk, index) => (
                <li key={index} className="text-sm text-gray-300">{risk}</li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Internal Notes */}
      {analysis.internalNotes && (
        <div className="bg-gray-800/50 rounded-lg p-3">
          <h4 className="text-xs font-medium text-gray-400 uppercase mb-1">Internal Notes</h4>
          <p className="text-sm text-gray-300">{analysis.internalNotes}</p>
        </div>
      )}

      {/* Related Incidents */}
      {analysis.relatedIncidents && analysis.relatedIncidents.length > 0 && (
        <div className="bg-gray-800/50 rounded-lg p-3">
          <h4 className="text-xs font-medium text-gray-400 uppercase mb-1">Related Incidents</h4>
          <ul className="list-disc list-inside">
            {analysis.relatedIncidents.map((incident, index) => (
              <li key={index} className="text-sm text-gray-300">{incident}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Step-by-Step Execution Panel (shown after clicking Execute) */}
      {showExecutionPanel && (
        <div className="border-t border-gray-700 pt-4 mt-4">
          <RemediationExecutionPanel
            workflowId={workflow.id}
            onComplete={handleExecutionComplete}
            onCancel={handleExecutionCancel}
          />
        </div>
      )}

      {/* Action Notes (hidden when execution panel is shown) */}
      {!showExecutionPanel && (
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">
            Notes (optional)
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Add any notes about the remediation..."
            rows={2}
            className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-md text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent resize-none"
          />
        </div>
      )}

      {/* Re-analyze Panel (hidden when execution panel is shown) */}
      {showReanalyze && !showExecutionPanel && (
        <div className="bg-yellow-900/20 border border-yellow-800/50 rounded-lg p-4">
          <h4 className="text-sm font-medium text-yellow-400 mb-2">Re-analyze Alert</h4>
          <p className="text-xs text-gray-400 mb-3">
            Provide additional context to improve the analysis, or leave blank to retry with original alert.
          </p>
          <textarea
            value={reanalyzeContext}
            onChange={(e) => setReanalyzeContext(e.target.value)}
            placeholder="Additional context for re-analysis (optional)..."
            rows={3}
            className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-md text-white text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-yellow-500 resize-none mb-3"
          />
          <div className="flex gap-2">
            <button
              onClick={handleReanalyze}
              disabled={isReanalyzing}
              className="flex-1 px-4 py-2 bg-yellow-600 text-white rounded-md font-medium hover:bg-yellow-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isReanalyzing ? 'Re-analyzing...' : 'Re-analyze'}
            </button>
            <button
              onClick={() => {
                setShowReanalyze(false);
                setReanalyzeContext('');
              }}
              className="px-4 py-2 bg-gray-700 text-gray-300 rounded-md font-medium hover:bg-gray-600 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Action Buttons (hidden when execution panel is shown) */}
      {!showExecutionPanel && (
        <div className="flex gap-3">
          <button
            onClick={() => handleAction('execute')}
            disabled={isExecuting || isReanalyzing}
            className="flex-1 px-4 py-2 bg-orange-600 text-white rounded-md font-medium hover:bg-orange-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isExecuting ? 'Processing...' : 'Execute Remediation'}
          </button>
          <button
            onClick={() => handleAction('escalate')}
            disabled={isExecuting || isReanalyzing}
            className="px-4 py-2 bg-yellow-600 text-white rounded-md font-medium hover:bg-yellow-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Escalate
          </button>
          <button
            onClick={() => handleAction('dismiss')}
            disabled={isExecuting || isReanalyzing}
            className="px-4 py-2 bg-gray-700 text-gray-300 rounded-md font-medium hover:bg-gray-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Dismiss
          </button>
          {!showReanalyze && (
            <button
              onClick={() => setShowReanalyze(true)}
              disabled={isExecuting || isReanalyzing}
              className="px-4 py-2 bg-gray-700 text-gray-300 rounded-md font-medium hover:bg-gray-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Re-analyze
            </button>
          )}
        </div>
      )}
    </div>
  );
}
