/**
 * TaskList - Display Generated Tasks from Orchestration
 *
 * Shows the tasks that the AI generated from the user's intent.
 * Displays task type, priority, status, and results.
 */

import type { GeneratedTask } from '../../lib/types/orchestration';
import {
  TASK_TYPE_LABELS,
  PRIORITY_LABELS,
  TASK_STATUS_LABELS,
  TASK_TYPE_CAPABILITY,
} from '../../lib/types/orchestration';

interface TaskListProps {
  tasks: GeneratedTask[];
}

export function TaskList({ tasks }: TaskListProps) {
  if (!tasks || tasks.length === 0) {
    return (
      <div className="text-center py-4 text-gray-500 text-sm">
        No tasks generated
      </div>
    );
  }

  // Sort by priority (high first) then by status
  const sortedTasks = [...tasks].sort((a, b) => {
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    const statusOrder = { running: 0, pending: 1, dispatched: 2, completed: 3, failed: 4, cancelled: 5 };

    const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
    if (priorityDiff !== 0) return priorityDiff;

    return statusOrder[a.status] - statusOrder[b.status];
  });

  return (
    <div className="space-y-2">
      <h4 className="text-xs font-medium text-gray-400 uppercase tracking-wide">
        Generated Tasks ({tasks.length})
      </h4>

      <div className="space-y-2">
        {sortedTasks.map((task) => (
          <TaskItem key={task.id} task={task} />
        ))}
      </div>
    </div>
  );
}

function TaskItem({ task }: { task: GeneratedTask }) {
  const capability: string = TASK_TYPE_CAPABILITY[task.type] ?? 'INTERNAL';
  const isDone = task.status === 'completed' || task.status === 'failed';

  // Get display strings safely
  const typeLabel = TASK_TYPE_LABELS[task.type] ?? task.type;
  const priorityLabel = PRIORITY_LABELS[task.priority] ?? task.priority;
  const statusLabel = TASK_STATUS_LABELS[task.status] ?? task.status;

  // Status colors
  const getStatusColor = (status: string): string => {
    const colors: Record<string, string> = {
      pending: 'bg-gray-500/20 text-gray-400',
      dispatched: 'bg-blue-500/20 text-blue-400',
      running: 'bg-yellow-500/20 text-yellow-400',
      completed: 'bg-green-500/20 text-green-400',
      failed: 'bg-red-500/20 text-red-400',
    };
    return colors[status] || '';
  };

  // Priority colors
  const getPriorityColor = (priority: string): string => {
    const colors: Record<string, string> = {
      high: 'text-red-400',
      medium: 'text-yellow-400',
      low: 'text-gray-400',
    };
    return colors[priority] || '';
  };

  // Capability colors
  const getCapabilityColor = (cap: string): string => {
    const colors: Record<string, string> = {
      PRODUCE: 'bg-purple-500/20 text-purple-400',
      GROW: 'bg-green-500/20 text-green-400',
      OPERATE: 'bg-orange-500/20 text-orange-400',
      INTERNAL: 'bg-gray-500/20 text-gray-400',
    };
    return colors[cap] || '';
  };

  const isActive = task.status === 'running' || task.status === 'dispatched';
  const borderClass = isActive
    ? 'border-blue-500/50'
    : task.status === 'completed'
    ? 'border-green-500/30'
    : task.status === 'failed'
    ? 'border-red-500/30'
    : 'border-transparent';

  return (
    <div className={`bg-gray-800/50 rounded-lg p-3 border transition-colors ${borderClass}`}>
      {/* Task Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            {/* Capability Badge */}
            <span className={`text-xs px-1.5 py-0.5 rounded ${getCapabilityColor(capability)}`}>
              {capability}
            </span>

            {/* Type Badge */}
            <span className="text-xs text-gray-500">{typeLabel}</span>

            {/* Priority Indicator */}
            <span className={`text-xs ${getPriorityColor(task.priority)}`}>
              {task.priority === 'high' ? '● ' : task.priority === 'medium' ? '○ ' : '◦ '}
              {priorityLabel}
            </span>
          </div>

          {/* Task Title */}
          <h5 className="text-sm font-medium text-white mt-1">{task.title}</h5>

          {/* Task Description */}
          <p className="text-xs text-gray-400 mt-1 line-clamp-2">{task.description}</p>
        </div>

        {/* Status Badge */}
        <div className="shrink-0">
          <span className={`text-xs px-2 py-1 rounded-full ${getStatusColor(task.status)}`}>
            {task.status === 'running' && <span className="animate-pulse mr-1">●</span>}
            {statusLabel}
          </span>
        </div>
      </div>

      {/* Result Preview (for completed tasks) */}
      {isDone && task.result !== undefined && (
        <div className="mt-2 pt-2 border-t border-gray-700">
          <TaskResult task={task} />
        </div>
      )}

      {/* Error Display (for failed tasks) */}
      {task.status === 'failed' && task.error && (
        <div className="mt-2 pt-2 border-t border-red-900/50">
          <p className="text-xs text-red-400">
            <span className="font-medium">Error:</span> {task.error}
          </p>
        </div>
      )}
    </div>
  );
}

function TaskResult({ task }: { task: GeneratedTask }) {
  const result = task.result as Record<string, unknown> | undefined;

  if (!result) {
    return (
      <p className="text-xs text-gray-500">No result data</p>
    );
  }

  // Handle content generation results
  if (task.type === 'content' && result.generation) {
    const gen = result.generation as { content?: { title?: string; body?: string } };
    return (
      <div className="space-y-1">
        <p className="text-xs text-green-400">
          Content generated: {gen.content?.title || 'Untitled'}
        </p>
        {gen.content?.body && (
          <p className="text-xs text-gray-500 line-clamp-2">
            {gen.content.body.substring(0, 150)}...
          </p>
        )}
      </div>
    );
  }

  // Handle bug fix results
  if (task.type === 'bugfix' && result.analysis) {
    const analysis = result.analysis as { rootCause?: string; confidence?: string };
    return (
      <div className="space-y-1">
        <p className="text-xs text-green-400">
          Analysis complete (confidence: {analysis.confidence || 'unknown'})
        </p>
        {analysis.rootCause && (
          <p className="text-xs text-gray-500 line-clamp-2">
            {analysis.rootCause.substring(0, 150)}...
          </p>
        )}
      </div>
    );
  }

  // Generic result display
  if (typeof result.note === 'string') {
    return <p className="text-xs text-gray-400">{String(result.note)}</p>;
  }

  return (
    <p className="text-xs text-gray-500">Task completed</p>
  );
}
