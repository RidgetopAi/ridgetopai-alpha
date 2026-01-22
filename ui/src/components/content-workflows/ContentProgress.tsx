/**
 * ContentProgress - Progress indicator for content generation workflow
 * Instance 12 - First GROW capability
 */

import type { ContentWorkflowState } from '../../lib/types/content-workflow';
import {
  CONTENT_STATE_LABELS,
  CONTENT_STATE_ORDER,
  isContentStateActiveOrComplete,
} from '../../lib/types/content-workflow';

interface ContentProgressProps {
  currentState: ContentWorkflowState;
}

export function ContentProgress({ currentState }: ContentProgressProps) {
  // Only show key states in the progress bar
  const displayStates: ContentWorkflowState[] = [
    'draft',
    'researching',
    'generating',
    'proposed',
    'reviewing',
    'completed',
  ];

  const getStateStatus = (state: ContentWorkflowState): 'completed' | 'current' | 'pending' => {
    if (currentState === 'failed') {
      const currentIndex = CONTENT_STATE_ORDER.indexOf(currentState);
      const stateIndex = displayStates.indexOf(state);
      if (stateIndex < currentIndex) return 'completed';
      return 'pending';
    }

    if (state === currentState) return 'current';
    if (isContentStateActiveOrComplete(currentState, state)) return 'completed';
    return 'pending';
  };

  return (
    <div className="py-2">
      <div className="flex items-center justify-between">
        {displayStates.map((state, index) => {
          const status = getStateStatus(state);
          const isLast = index === displayStates.length - 1;

          return (
            <div key={state} className="flex items-center flex-1">
              {/* Step circle */}
              <div className="flex flex-col items-center">
                <div
                  className={`
                    w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium
                    ${status === 'completed' ? 'bg-green-600 text-white' : ''}
                    ${status === 'current' ? 'bg-green-500 text-white ring-2 ring-green-300' : ''}
                    ${status === 'pending' ? 'bg-gray-700 text-gray-500' : ''}
                  `}
                >
                  {status === 'completed' ? '✓' : index + 1}
                </div>
                <span
                  className={`
                    text-[10px] mt-1 whitespace-nowrap
                    ${status === 'current' ? 'text-green-400 font-medium' : 'text-gray-500'}
                  `}
                >
                  {CONTENT_STATE_LABELS[state]}
                </span>
              </div>

              {/* Connector line */}
              {!isLast && (
                <div
                  className={`
                    flex-1 h-0.5 mx-2
                    ${status === 'completed' ? 'bg-green-600' : 'bg-gray-700'}
                  `}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Failed state indicator */}
      {currentState === 'failed' && (
        <div className="mt-2 text-center text-red-400 text-xs">
          Workflow failed - see error details below
        </div>
      )}
    </div>
  );
}
