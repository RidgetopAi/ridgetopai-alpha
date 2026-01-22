/**
 * WorkflowProgress - Visual progress indicator for bug fix workflow
 * Instance 09 - First PRODUCE capability
 */

import type { WorkflowState } from '../../lib/types/workflow';
import {
  WORKFLOW_STATE_LABELS,
  isStateActiveOrComplete,
} from '../../lib/types/workflow';

interface WorkflowProgressProps {
  currentState: WorkflowState;
}

const STEP_ICONS: Record<WorkflowState, string> = {
  draft: '1',
  submitted: '2',
  analyzing: '3',
  proposed: '4',
  reviewing: '5',
  implementing: '6',
  verifying: '7',
  completed: '✓',
  failed: '!',
};

export function WorkflowProgress({ currentState }: WorkflowProgressProps) {
  // Only show the main steps (exclude draft, failed)
  const displaySteps: WorkflowState[] = [
    'submitted',
    'analyzing',
    'proposed',
    'reviewing',
    'implementing',
    'completed',
  ];

  const getStepStatus = (step: WorkflowState): 'pending' | 'active' | 'complete' | 'failed' => {
    if (currentState === 'failed') return 'failed';
    if (currentState === step) return 'active';
    if (isStateActiveOrComplete(currentState, step)) return 'complete';
    return 'pending';
  };

  return (
    <div className="py-4">
      <div className="flex items-center justify-between">
        {displaySteps.map((step, index) => {
          const status = getStepStatus(step);
          const isLast = index === displaySteps.length - 1;

          return (
            <div key={step} className="flex items-center flex-1">
              {/* Step Circle */}
              <div className="flex flex-col items-center">
                <div
                  className={`
                    w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium
                    ${status === 'complete' ? 'bg-green-500 text-white' : ''}
                    ${status === 'active' ? 'bg-blue-500 text-white animate-pulse' : ''}
                    ${status === 'pending' ? 'bg-gray-700 text-gray-400' : ''}
                    ${status === 'failed' ? 'bg-red-500 text-white' : ''}
                  `}
                >
                  {status === 'complete' ? '✓' : status === 'failed' ? '!' : STEP_ICONS[step]}
                </div>
                <span
                  className={`
                    mt-2 text-xs text-center whitespace-nowrap
                    ${status === 'active' ? 'text-blue-400 font-medium' : ''}
                    ${status === 'complete' ? 'text-green-400' : ''}
                    ${status === 'pending' ? 'text-gray-500' : ''}
                    ${status === 'failed' ? 'text-red-400' : ''}
                  `}
                >
                  {WORKFLOW_STATE_LABELS[step]}
                </span>
              </div>

              {/* Connector Line */}
              {!isLast && (
                <div
                  className={`
                    flex-1 h-0.5 mx-2
                    ${status === 'complete' ? 'bg-green-500' : 'bg-gray-700'}
                  `}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
