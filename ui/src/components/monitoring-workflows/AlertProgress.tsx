/**
 * AlertProgress - Visual progress bar for monitoring alert workflow
 * Instance 21 - OPERATE capability
 */

import type { AlertWorkflowState } from '../../lib/types/monitoring-workflow';
import { ALERT_STATE_ORDER, ALERT_STATE_LABELS, isAlertStateActiveOrComplete } from '../../lib/types/monitoring-workflow';

interface AlertProgressProps {
  currentState: AlertWorkflowState;
}

export function AlertProgress({ currentState }: AlertProgressProps) {
  // Filter out draft state for progress display
  const progressSteps = ALERT_STATE_ORDER.filter(s => s !== 'draft');

  const getStepStatus = (step: AlertWorkflowState) => {
    if (currentState === 'failed') {
      // Show all steps as neutral if failed
      return 'neutral';
    }
    if (isAlertStateActiveOrComplete(currentState, step)) {
      if (currentState === step) {
        return 'active';
      }
      return 'complete';
    }
    return 'pending';
  };

  const getStepColor = (status: string) => {
    switch (status) {
      case 'complete':
        return 'bg-orange-500 text-white';
      case 'active':
        return 'bg-orange-500 text-white animate-pulse';
      case 'neutral':
        return 'bg-gray-700 text-gray-400';
      default:
        return 'bg-gray-800 text-gray-500';
    }
  };

  const getLineColor = (status: string) => {
    switch (status) {
      case 'complete':
        return 'bg-orange-500';
      case 'active':
        return 'bg-orange-500/50';
      default:
        return 'bg-gray-700';
    }
  };

  return (
    <div className="py-3">
      <div className="flex items-center justify-between">
        {progressSteps.map((step, index) => {
          const status = getStepStatus(step);
          const isLast = index === progressSteps.length - 1;

          return (
            <div key={step} className="flex items-center flex-1">
              {/* Step circle */}
              <div className="flex flex-col items-center">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium ${getStepColor(status)}`}
                >
                  {status === 'complete' ? (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    index + 1
                  )}
                </div>
                <span className={`mt-1 text-xs ${status === 'active' ? 'text-orange-400' : 'text-gray-500'}`}>
                  {ALERT_STATE_LABELS[step]}
                </span>
              </div>

              {/* Connecting line */}
              {!isLast && (
                <div className={`flex-1 h-0.5 mx-2 ${getLineColor(status)}`} />
              )}
            </div>
          );
        })}
      </div>

      {/* Current state message */}
      {currentState === 'failed' && (
        <div className="mt-2 text-center text-red-400 text-sm">
          Workflow failed - see details below
        </div>
      )}
    </div>
  );
}
