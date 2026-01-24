/**
 * RemediationExecutionPanel - Step-by-step remediation with safety controls
 * Instance 7 - OPERATE capability (SIRK Bugfix Run)
 *
 * Shows dry-run output for each step, allows individual step approval,
 * and tracks execution progress.
 */

import { useState, useEffect } from 'react';
import type { RemediationStep, RemediationExecution } from '../../lib/api/monitoringRunner';
import {
  getRemediationStatus,
  approveRemediationSteps,
  executeRemediationStep,
  executeAllRemediationSteps,
  cancelRemediation,
} from '../../lib/api/monitoringRunner';

interface RemediationExecutionPanelProps {
  workflowId: string;
  onComplete?: () => void;
  onCancel?: () => void;
}

export function RemediationExecutionPanel({
  workflowId,
  onComplete,
  onCancel,
}: RemediationExecutionPanelProps) {
  const [execution, setExecution] = useState<RemediationExecution | null>(null);
  const [selectedSteps, setSelectedSteps] = useState<Set<number>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [isExecuting, setIsExecuting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedSteps, setExpandedSteps] = useState<Set<number>>(new Set());

  // Fetch remediation status on mount and periodically
  useEffect(() => {
    let cancelled = false;

    const fetchStatus = async () => {
      try {
        const result = await getRemediationStatus(workflowId);
        if (!cancelled && result.success && result.execution) {
          setExecution(result.execution);
          setError(null);

          // Auto-expand steps with dry-run output
          const stepsWithOutput = result.execution.steps
            .filter((s: RemediationStep) => s.dryRunOutput || s.executionOutput || s.error)
            .map((s: RemediationStep) => s.index);
          setExpandedSteps(new Set(stepsWithOutput));
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to fetch status');
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    fetchStatus();

    // Poll for updates during execution
    const interval = setInterval(() => {
      if (execution?.status === 'executing' || execution?.status === 'dry_running') {
        fetchStatus();
      }
    }, 2000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [workflowId, execution?.status]);

  const toggleStepSelection = (index: number) => {
    const newSelected = new Set(selectedSteps);
    if (newSelected.has(index)) {
      newSelected.delete(index);
    } else {
      newSelected.add(index);
    }
    setSelectedSteps(newSelected);
  };

  const toggleStepExpanded = (index: number) => {
    const newExpanded = new Set(expandedSteps);
    if (newExpanded.has(index)) {
      newExpanded.delete(index);
    } else {
      newExpanded.add(index);
    }
    setExpandedSteps(newExpanded);
  };

  const selectAll = () => {
    if (!execution) return;
    const allIndices = execution.steps.map((_, i) => i);
    setSelectedSteps(new Set(allIndices));
  };

  const selectNone = () => {
    setSelectedSteps(new Set());
  };

  const handleApproveSelected = async () => {
    if (!execution || selectedSteps.size === 0) return;

    setIsExecuting(true);
    try {
      const result = await approveRemediationSteps(
        workflowId,
        Array.from(selectedSteps),
        'user'
      );
      if (result.success && result.execution) {
        setExecution(result.execution);
      } else {
        setError(result.error || 'Failed to approve steps');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to approve steps');
    } finally {
      setIsExecuting(false);
    }
  };

  const handleExecuteStep = async (stepIndex: number) => {
    setIsExecuting(true);
    try {
      const result = await executeRemediationStep(workflowId, stepIndex, true);
      if (result.success) {
        // Refresh execution state
        const status = await getRemediationStatus(workflowId);
        if (status.success && status.execution) {
          setExecution(status.execution);

          // Check if all done
          if (status.execution.status === 'completed') {
            onComplete?.();
          }
        }
      } else {
        setError(result.error || 'Failed to execute step');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to execute step');
    } finally {
      setIsExecuting(false);
    }
  };

  const handleExecuteAll = async () => {
    setIsExecuting(true);
    try {
      const result = await executeAllRemediationSteps(workflowId);
      if (result.success && result.execution) {
        setExecution(result.execution);
        if (result.execution.status === 'completed') {
          onComplete?.();
        }
      } else {
        setError(result.error || 'Failed to execute all steps');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to execute all steps');
    } finally {
      setIsExecuting(false);
    }
  };

  const handleCancel = async () => {
    setIsExecuting(true);
    try {
      const result = await cancelRemediation(workflowId);
      if (result.success) {
        setExecution(result.execution || null);
        onCancel?.();
      } else {
        setError(result.error || 'Failed to cancel remediation');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to cancel');
    } finally {
      setIsExecuting(false);
    }
  };

  const getStepStatusColor = (status: RemediationStep['status']) => {
    switch (status) {
      case 'completed':
        return 'bg-green-500/20 text-green-400 border-green-500/50';
      case 'approved':
        return 'bg-blue-500/20 text-blue-400 border-blue-500/50';
      case 'dry_run':
        return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/50';
      case 'executing':
        return 'bg-orange-500/20 text-orange-400 border-orange-500/50 animate-pulse';
      case 'failed':
        return 'bg-red-500/20 text-red-400 border-red-500/50';
      case 'skipped':
        return 'bg-gray-500/20 text-gray-400 border-gray-500/50';
      default:
        return 'bg-gray-700/50 text-gray-300 border-gray-600';
    }
  };

  const getStepStatusLabel = (status: RemediationStep['status']) => {
    switch (status) {
      case 'completed': return 'Completed';
      case 'approved': return 'Approved';
      case 'dry_run': return 'Dry-Run';
      case 'executing': return 'Executing...';
      case 'failed': return 'Failed';
      case 'skipped': return 'Skipped';
      default: return 'Pending';
    }
  };

  const getRiskBadge = (output: string | undefined) => {
    if (!output) return null;
    const riskMatch = output.match(/Risk Level:\s*(low|medium|high|critical)/i);
    if (!riskMatch) return null;

    const risk = riskMatch[1].toLowerCase();
    const colors: Record<string, string> = {
      low: 'bg-green-500/20 text-green-400',
      medium: 'bg-yellow-500/20 text-yellow-400',
      high: 'bg-orange-500/20 text-orange-400',
      critical: 'bg-red-500/20 text-red-400',
    };

    return (
      <span className={`text-xs px-2 py-0.5 rounded-full ${colors[risk] || colors.medium}`}>
        {risk.toUpperCase()} RISK
      </span>
    );
  };

  if (isLoading) {
    return (
      <div className="p-4 text-center text-gray-400">
        <div className="animate-spin inline-block w-6 h-6 border-2 border-current border-t-transparent rounded-full" />
        <p className="mt-2">Loading remediation status...</p>
      </div>
    );
  }

  if (!execution) {
    return (
      <div className="p-4 text-center text-gray-400">
        <p>No remediation in progress. Click "Execute Remediation" to start.</p>
      </div>
    );
  }

  const approvedCount = execution.steps.filter(s => s.status === 'approved').length;
  const completedCount = execution.steps.filter(s => s.status === 'completed').length;
  const failedCount = execution.steps.filter(s => s.status === 'failed').length;

  return (
    <div className="space-y-4">
      {/* Status Header */}
      <div className="bg-gray-800/50 rounded-lg p-4">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-lg font-medium text-white">Remediation Execution</h3>
          <span className={`px-3 py-1 rounded-full text-sm font-medium ${
            execution.status === 'completed' ? 'bg-green-500/20 text-green-400' :
            execution.status === 'failed' ? 'bg-red-500/20 text-red-400' :
            execution.status === 'cancelled' ? 'bg-gray-500/20 text-gray-400' :
            execution.status === 'executing' ? 'bg-orange-500/20 text-orange-400 animate-pulse' :
            'bg-blue-500/20 text-blue-400'
          }`}>
            {execution.status.replace('_', ' ').toUpperCase()}
          </span>
        </div>

        <p className="text-sm text-gray-400 mb-3">{execution.description}</p>

        {/* Progress Bar */}
        <div className="w-full bg-gray-700 rounded-full h-2 mb-2">
          <div
            className="bg-green-500 h-2 rounded-full transition-all duration-300"
            style={{ width: `${(completedCount / execution.steps.length) * 100}%` }}
          />
        </div>
        <p className="text-xs text-gray-500">
          {completedCount} of {execution.steps.length} steps completed
          {failedCount > 0 && <span className="text-red-400"> ({failedCount} failed)</span>}
          {approvedCount > 0 && completedCount < approvedCount && (
            <span className="text-blue-400"> ({approvedCount} approved)</span>
          )}
        </p>
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-red-900/20 border border-red-800/50 rounded-lg p-3">
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}

      {/* Steps List */}
      <div className="space-y-2">
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-sm font-medium text-gray-300">Remediation Steps</h4>
          {execution.status === 'awaiting_approval' && (
            <div className="flex gap-2 text-xs">
              <button onClick={selectAll} className="text-blue-400 hover:underline">
                Select All
              </button>
              <span className="text-gray-600">|</span>
              <button onClick={selectNone} className="text-gray-400 hover:underline">
                Clear
              </button>
            </div>
          )}
        </div>

        {execution.steps.map((step, index) => (
          <div
            key={index}
            className={`rounded-lg border ${getStepStatusColor(step.status)} overflow-hidden`}
          >
            {/* Step Header */}
            <div
              className="p-3 cursor-pointer flex items-start gap-3"
              onClick={() => toggleStepExpanded(index)}
            >
              {/* Checkbox for approval */}
              {execution.status === 'awaiting_approval' && step.status === 'dry_run' && (
                <input
                  type="checkbox"
                  checked={selectedSteps.has(index)}
                  onChange={(e) => {
                    e.stopPropagation();
                    toggleStepSelection(index);
                  }}
                  className="mt-1 w-4 h-4 rounded border-gray-600 bg-gray-800 text-blue-500 focus:ring-blue-500 focus:ring-offset-gray-900"
                />
              )}

              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-medium text-gray-400">Step {index + 1}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${getStepStatusColor(step.status)}`}>
                    {getStepStatusLabel(step.status)}
                  </span>
                  {getRiskBadge(step.dryRunOutput)}
                </div>
                <p className="text-sm text-gray-200">{step.description}</p>
                {step.command && (
                  <p className="text-xs text-gray-500 font-mono mt-1">
                    $ {step.command}
                  </p>
                )}
              </div>

              {/* Expand/Collapse Indicator */}
              <span className="text-gray-500">
                {expandedSteps.has(index) ? '▼' : '▶'}
              </span>
            </div>

            {/* Expanded Content */}
            {expandedSteps.has(index) && (
              <div className="border-t border-gray-700 p-3 bg-gray-900/50 space-y-3">
                {/* Dry-Run Output */}
                {step.dryRunOutput && (
                  <div>
                    <h5 className="text-xs font-medium text-yellow-400 uppercase mb-1">
                      Dry-Run Output
                    </h5>
                    <pre className="text-xs text-gray-300 bg-gray-800 rounded p-2 overflow-x-auto whitespace-pre-wrap">
                      {step.dryRunOutput}
                    </pre>
                  </div>
                )}

                {/* Execution Output */}
                {step.executionOutput && (
                  <div>
                    <h5 className="text-xs font-medium text-green-400 uppercase mb-1">
                      Execution Output
                    </h5>
                    <pre className="text-xs text-gray-300 bg-gray-800 rounded p-2 overflow-x-auto whitespace-pre-wrap">
                      {step.executionOutput}
                    </pre>
                  </div>
                )}

                {/* Error */}
                {step.error && (
                  <div>
                    <h5 className="text-xs font-medium text-red-400 uppercase mb-1">
                      Error
                    </h5>
                    <pre className="text-xs text-red-300 bg-red-900/20 rounded p-2 overflow-x-auto whitespace-pre-wrap">
                      {step.error}
                    </pre>
                  </div>
                )}

                {/* Execute Step Button (if approved and not yet executed) */}
                {step.status === 'approved' && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleExecuteStep(index);
                    }}
                    disabled={isExecuting}
                    className="px-3 py-1 bg-orange-600 text-white text-sm rounded hover:bg-orange-500 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isExecuting ? 'Executing...' : 'Execute This Step'}
                  </button>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Action Buttons */}
      <div className="flex gap-3 pt-4 border-t border-gray-700">
        {execution.status === 'awaiting_approval' && (
          <>
            <button
              onClick={handleApproveSelected}
              disabled={isExecuting || selectedSteps.size === 0}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md font-medium hover:bg-blue-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isExecuting ? 'Approving...' : `Approve Selected (${selectedSteps.size})`}
            </button>
            <button
              onClick={handleCancel}
              disabled={isExecuting}
              className="px-4 py-2 bg-gray-700 text-gray-300 rounded-md font-medium hover:bg-gray-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
          </>
        )}

        {execution.status === 'executing' && (
          <button
            onClick={handleCancel}
            disabled={isExecuting}
            className="flex-1 px-4 py-2 bg-red-600 text-white rounded-md font-medium hover:bg-red-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Stop Execution
          </button>
        )}

        {approvedCount > 0 && completedCount < approvedCount && execution.status !== 'executing' && (
          <button
            onClick={handleExecuteAll}
            disabled={isExecuting}
            className="flex-1 px-4 py-2 bg-orange-600 text-white rounded-md font-medium hover:bg-orange-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isExecuting ? 'Executing...' : `Execute All Approved (${approvedCount - completedCount})`}
          </button>
        )}

        {execution.status === 'completed' && (
          <div className="flex-1 text-center py-2 text-green-400 font-medium">
            Remediation Complete
          </div>
        )}

        {execution.status === 'cancelled' && (
          <div className="flex-1 text-center py-2 text-gray-400 font-medium">
            Remediation Cancelled
          </div>
        )}
      </div>
    </div>
  );
}
