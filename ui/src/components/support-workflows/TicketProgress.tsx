/**
 * TicketProgress - Visual progress indicator for support ticket workflow
 * Instance 20 - OPERATE capability
 */

import type { TicketWorkflowState } from '../../lib/types/support-workflow';
import { TICKET_STATE_ORDER, TICKET_STATE_LABELS, isTicketStateActiveOrComplete } from '../../lib/types/support-workflow';

interface TicketProgressProps {
  currentState: TicketWorkflowState;
}

export function TicketProgress({ currentState }: TicketProgressProps) {
  // Filter out draft as it's not part of the progress display
  const displaySteps = TICKET_STATE_ORDER.filter((s) => s !== 'draft');

  const getStepStatus = (step: TicketWorkflowState) => {
    if (currentState === 'failed') {
      // Show which steps were completed before failure
      const currentIndex = TICKET_STATE_ORDER.indexOf(step);
      const failedIndex = TICKET_STATE_ORDER.indexOf(currentState);
      if (currentIndex < failedIndex) return 'completed';
      return 'pending';
    }
    if (step === currentState) return 'active';
    if (isTicketStateActiveOrComplete(currentState, step)) return 'completed';
    return 'pending';
  };

  return (
    <div className="py-2">
      <div className="flex items-center justify-between">
        {displaySteps.map((step, index) => {
          const status = getStepStatus(step);
          const isLast = index === displaySteps.length - 1;

          return (
            <div key={step} className="flex items-center flex-1">
              {/* Step circle */}
              <div className="flex flex-col items-center">
                <div
                  className={`
                    w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium
                    ${status === 'completed' ? 'bg-cyan-500 text-white' : ''}
                    ${status === 'active' ? 'bg-cyan-500/30 text-cyan-400 ring-2 ring-cyan-500' : ''}
                    ${status === 'pending' ? 'bg-gray-700 text-gray-500' : ''}
                  `}
                >
                  {status === 'completed' ? (
                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                      <path
                        fillRule="evenodd"
                        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                        clipRule="evenodd"
                      />
                    </svg>
                  ) : (
                    index + 1
                  )}
                </div>
                <span
                  className={`
                    text-[10px] mt-1 whitespace-nowrap
                    ${status === 'active' ? 'text-cyan-400' : 'text-gray-500'}
                  `}
                >
                  {TICKET_STATE_LABELS[step]}
                </span>
              </div>

              {/* Connector line */}
              {!isLast && (
                <div
                  className={`
                    flex-1 h-0.5 mx-2 mt-[-16px]
                    ${status === 'completed' ? 'bg-cyan-500' : 'bg-gray-700'}
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
