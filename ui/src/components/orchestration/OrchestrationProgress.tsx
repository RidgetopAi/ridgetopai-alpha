/**
 * OrchestrationProgress - Visual Progress for Task Execution
 *
 * Shows the progress of task execution with counts and a progress bar.
 */

import type { ExecutionSummary, SessionState } from '../../lib/types/orchestration';

interface OrchestrationProgressProps {
  execution: ExecutionSummary;
  state: SessionState;
}

export function OrchestrationProgress({ execution, state }: OrchestrationProgressProps) {
  const { total, completed, failed, pending, running } = execution;

  // Calculate progress percentage
  const doneCount = completed + failed;
  const progressPercent = total > 0 ? Math.round((doneCount / total) * 100) : 0;

  // Determine progress bar color based on state
  const progressColor =
    state === 'failed' || failed > 0 ? 'bg-red-500' :
    state === 'completed' ? 'bg-green-500' :
    'bg-cyan-500';

  return (
    <div className="space-y-2">
      {/* Progress Bar */}
      <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
        <div
          className={`h-full ${progressColor} transition-all duration-500 ease-out`}
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      {/* Stats Row */}
      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center gap-3">
          {/* Completed */}
          <div className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-green-500" />
            <span className="text-gray-400">
              {completed} <span className="text-gray-500">done</span>
            </span>
          </div>

          {/* Running */}
          {running > 0 && (
            <div className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-yellow-500 animate-pulse" />
              <span className="text-gray-400">
                {running} <span className="text-gray-500">running</span>
              </span>
            </div>
          )}

          {/* Pending */}
          {pending > 0 && (
            <div className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-gray-500" />
              <span className="text-gray-400">
                {pending} <span className="text-gray-500">pending</span>
              </span>
            </div>
          )}

          {/* Failed */}
          {failed > 0 && (
            <div className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-red-500" />
              <span className="text-gray-400">
                {failed} <span className="text-gray-500">failed</span>
              </span>
            </div>
          )}
        </div>

        {/* Percentage */}
        <span className="text-gray-500">
          {progressPercent}%
        </span>
      </div>
    </div>
  );
}
