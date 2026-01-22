/**
 * MonitoringAlertPanel - Main panel for monitoring alert workflow
 * Instance 21 - OPERATE capability
 *
 * Full-width panel with more room for remediation runbooks.
 * Demonstrates the Inverse Hierarchy model:
 * - Human directs (alert input)
 * - AI executes (analysis, remediation suggestion)
 * - Human verifies (review, approval)
 */

import { useState } from 'react';
import type { MonitoringAlertWorkflow } from '../../lib/types/monitoring-workflow';
import { ALERT_STATE_LABELS, CATEGORY_LABELS, SEVERITY_LABELS, SOURCE_LABELS } from '../../lib/types/monitoring-workflow';
import { useMonitoringStore } from '../../stores/monitoring-store';
import { AlertInputForm } from './AlertInputForm';
import { AlertProgress } from './AlertProgress';
import { AlertRemediationReview } from './AlertRemediationReview';

export function MonitoringAlertPanel() {
  const { workflows, activeWorkflow, selectWorkflow, deleteWorkflow } = useMonitoringStore();
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
  const renderWorkflowDetail = (workflow: MonitoringAlertWorkflow) => {
    return (
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-lg font-medium text-white">{workflow.alert.title}</h3>
            <div className="flex items-center gap-2 mt-1">
              <span className={`text-xs px-2 py-0.5 rounded-full ${getSeverityColor(workflow.alert.severity)}`}>
                {SEVERITY_LABELS[workflow.alert.severity]}
              </span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-gray-700 text-gray-300">
                {CATEGORY_LABELS[workflow.alert.category]}
              </span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-gray-700 text-gray-300">
                {SOURCE_LABELS[workflow.alert.source]}
              </span>
              {workflow.alert.affectedService && (
                <span className="text-xs text-gray-500">
                  {workflow.alert.affectedService}
                </span>
              )}
            </div>
          </div>
          <button
            onClick={handleNewWorkflow}
            className="text-sm text-orange-400 hover:text-orange-300"
          >
            + New Alert
          </button>
        </div>

        {/* Progress */}
        <AlertProgress currentState={workflow.state} />

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
              <div className="animate-pulse text-orange-400 mb-2">Gathering context...</div>
              <p className="text-gray-500 text-sm">
                Collecting relevant information from Mandrel
              </p>
            </div>
          )}

          {/* Analyzing */}
          {workflow.state === 'analyzing' && (
            <div className="text-center py-8">
              <div className="animate-pulse text-orange-400 mb-2">AI is analyzing...</div>
              <p className="text-gray-500 text-sm">
                Identifying root cause and preparing remediation
              </p>
            </div>
          )}

          {/* Proposed / Remediating */}
          {(workflow.state === 'proposed' || workflow.state === 'remediating') && (
            <AlertRemediationReview workflow={workflow} />
          )}

          {/* Completed */}
          {workflow.state === 'completed' && workflow.remediation && (
            <div className="space-y-4">
              <div className="bg-green-900/20 rounded-lg p-4 text-center">
                <div className="text-green-400 text-lg mb-2">
                  {workflow.remediation.action === 'execute' ? 'Remediation Executed!' :
                   workflow.remediation.action === 'escalate' ? 'Alert Escalated!' :
                   'Alert Dismissed'}
                </div>
                <p className="text-gray-400 text-sm">
                  Recorded at {workflow.remediation.executedAt.toLocaleString()}
                </p>
              </div>

              {workflow.analysis && (
                <div className="bg-gray-800/50 rounded-lg p-4">
                  <h4 className="text-sm font-medium text-gray-400 mb-2">Resolution Summary</h4>
                  <div className="text-sm space-y-2">
                    <div>
                      <span className="text-gray-500">Action taken:</span>
                      <span className="text-white ml-2 capitalize">{workflow.remediation.action}</span>
                    </div>
                    {workflow.remediation.notes && (
                      <div>
                        <span className="text-gray-500">Notes:</span>
                        <span className="text-white ml-2">{workflow.remediation.notes}</span>
                      </div>
                    )}
                    <div>
                      <span className="text-gray-500">Root cause:</span>
                      <span className="text-white ml-2">{workflow.analysis.rootCause}</span>
                    </div>
                  </div>
                </div>
              )}

              <button
                onClick={handleNewWorkflow}
                className="w-full px-4 py-2 bg-orange-600 text-white rounded-md font-medium hover:bg-orange-500 transition-colors"
              >
                Handle Another Alert
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
                  Failed at: {ALERT_STATE_LABELS[workflow.error.step]}
                </p>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={handleNewWorkflow}
                  className="flex-1 px-4 py-2 bg-orange-600 text-white rounded-md font-medium hover:bg-orange-500 transition-colors"
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
          <h2 className="text-sm font-medium text-white">Monitoring Alerts</h2>
          <span className="text-xs px-2 py-0.5 rounded-full bg-orange-500/20 text-orange-400">
            OPERATE
          </span>
        </div>
      </div>

      {/* Panel Content - two-column layout for full width */}
      <div className="flex-1 overflow-y-auto p-4">
        {showForm && !activeWorkflow ? (
          <div className="grid grid-cols-2 gap-6">
            {/* Left column: Form */}
            <div className="space-y-4">
              <p className="text-sm text-gray-400">
                Enter an alert from your monitoring system. AI will analyze it
                and suggest remediation steps for your review.
              </p>
              <AlertInputForm onSubmit={handleWorkflowSubmit} />
            </div>

            {/* Right column: Recent alerts */}
            <div className="space-y-4">
              <h3 className="text-sm font-medium text-gray-300">Recent Alerts</h3>
              {workflows.length > 0 ? (
                <div className="space-y-2">
                  {workflows.slice(-5).reverse().map((workflow) => (
                    <button
                      key={workflow.id}
                      onClick={() => {
                        selectWorkflow(workflow.id);
                        setShowForm(false);
                      }}
                      className="w-full text-left px-3 py-2 bg-gray-800 rounded-md hover:bg-gray-700 transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-white truncate">{workflow.alert.title}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${getSeverityColor(workflow.alert.severity)}`}>
                          {SEVERITY_LABELS[workflow.alert.severity]}
                        </span>
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        {ALERT_STATE_LABELS[workflow.state]} - {workflow.alert.affectedService || 'No service'}
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="bg-gray-800/50 rounded-lg p-4 text-center text-gray-500">
                  No alerts yet. Enter one to get started.
                </div>
              )}
            </div>
          </div>
        ) : activeWorkflow ? (
          renderWorkflowDetail(activeWorkflow)
        ) : (
          <div className="text-center py-8">
            <button
              onClick={handleNewWorkflow}
              className="px-4 py-2 bg-orange-600 text-white rounded-md font-medium hover:bg-orange-500 transition-colors"
            >
              New Alert
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
