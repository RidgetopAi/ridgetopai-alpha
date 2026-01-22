/**
 * AlertRemediationReview - Review and approve AI-suggested remediation
 * Instance 21 - OPERATE capability
 */

import { useState } from 'react';
import type { MonitoringAlertWorkflow } from '../../lib/types/monitoring-workflow';
import { SEVERITY_LABELS, REMEDIATION_TYPE_LABELS } from '../../lib/types/monitoring-workflow';
import { useMonitoringStore } from '../../stores/monitoring-store';

interface AlertRemediationReviewProps {
  workflow: MonitoringAlertWorkflow;
}

export function AlertRemediationReview({ workflow }: AlertRemediationReviewProps) {
  const { executeRemediationAction } = useMonitoringStore();
  const [notes, setNotes] = useState('');
  const [isExecuting, setIsExecuting] = useState(false);

  if (!workflow.analysis) {
    return <div className="text-gray-400">No analysis available</div>;
  }

  const analysis = workflow.analysis;

  const handleAction = async (action: 'execute' | 'dismiss' | 'escalate') => {
    setIsExecuting(true);
    await executeRemediationAction(workflow.id, action, notes || undefined);
    setIsExecuting(false);
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
          <h5 className="text-xs font-medium text-gray-400 uppercase">Steps</h5>
          <ol className="list-decimal list-inside space-y-1">
            {analysis.suggestedRemediation.steps.map((step, index) => (
              <li key={index} className="text-sm text-gray-300">{step}</li>
            ))}
          </ol>
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

      {/* Action Notes */}
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

      {/* Action Buttons */}
      <div className="flex gap-3">
        <button
          onClick={() => handleAction('execute')}
          disabled={isExecuting}
          className="flex-1 px-4 py-2 bg-orange-600 text-white rounded-md font-medium hover:bg-orange-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isExecuting ? 'Processing...' : 'Execute Remediation'}
        </button>
        <button
          onClick={() => handleAction('escalate')}
          disabled={isExecuting}
          className="px-4 py-2 bg-yellow-600 text-white rounded-md font-medium hover:bg-yellow-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Escalate
        </button>
        <button
          onClick={() => handleAction('dismiss')}
          disabled={isExecuting}
          className="px-4 py-2 bg-gray-700 text-gray-300 rounded-md font-medium hover:bg-gray-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}
