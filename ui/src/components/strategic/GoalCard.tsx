/**
 * GoalCard - Display a single goal with actions
 * Phase 3: Goal Management UI
 */

import type { Goal } from '../../lib/types/strategic';
import { GoalProgressBar, GoalProgressIndicator } from './GoalProgressBar';

interface GoalCardProps {
  goal: Goal;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  onViewDetails: (id: string) => void;
  onUpdateProgress?: (id: string) => void;
  compact?: boolean;
}

/**
 * Get priority badge styling
 */
function getPriorityBadge(priority: string) {
  switch (priority) {
    case 'critical':
      return 'bg-red-600 text-white';
    case 'high':
      return 'bg-orange-500 text-white';
    case 'medium':
      return 'bg-blue-500 text-white';
    case 'low':
      return 'bg-gray-500 text-white';
    default:
      return 'bg-gray-400 text-white';
  }
}

/**
 * Get category icon and styling
 */
function getCategoryInfo(category: string) {
  switch (category) {
    case 'revenue':
      return { icon: '💰', label: 'Revenue', color: 'text-green-400' };
    case 'product':
      return { icon: '📦', label: 'Product', color: 'text-blue-400' };
    case 'operational':
      return { icon: '⚙️', label: 'Operational', color: 'text-yellow-400' };
    case 'growth':
      return { icon: '📈', label: 'Growth', color: 'text-purple-400' };
    case 'technical':
      return { icon: '🔧', label: 'Technical', color: 'text-cyan-400' };
    default:
      return { icon: '📋', label: 'Unknown', color: 'text-gray-400' };
  }
}

/**
 * Get status badge styling
 */
function getStatusBadge(status: string) {
  switch (status) {
    case 'active':
      return 'bg-green-900 text-green-300';
    case 'completed':
      return 'bg-blue-900 text-blue-300';
    case 'paused':
      return 'bg-yellow-900 text-yellow-300';
    case 'abandoned':
      return 'bg-zinc-800 text-zinc-400';
    default:
      return 'bg-zinc-800 text-zinc-400';
  }
}

/**
 * Format target date with overdue indicator
 */
function formatTargetDate(
  targetDate: string | null,
  isOverdue?: boolean
): { text: string; className: string } | null {
  if (!targetDate) return null;

  const date = new Date(targetDate);
  const formattedDate = date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: date.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined,
  });

  if (isOverdue) {
    return { text: formattedDate, className: 'text-red-400 font-semibold' };
  }

  return { text: formattedDate, className: 'text-zinc-400' };
}

/**
 * Format metric display
 */
function formatMetric(
  currentValue: number,
  targetValue: number | null,
  targetMetric: string | null
): string | null {
  if (targetValue === null || targetMetric === null) return null;
  return `${currentValue.toLocaleString()} / ${targetValue.toLocaleString()} ${targetMetric}`;
}

export function GoalCard({
  goal,
  onEdit,
  onDelete,
  onViewDetails,
  onUpdateProgress,
  compact = false,
}: GoalCardProps) {
  const categoryInfo = getCategoryInfo(goal.category);
  const targetDateInfo = formatTargetDate(goal.target_date, goal.isOverdue);
  const metricDisplay = formatMetric(
    goal.current_value,
    goal.target_value,
    goal.target_metric
  );

  if (compact) {
    return (
      <div
        className="bg-zinc-800 border border-zinc-700 rounded-lg p-3 hover:border-zinc-600 transition-colors cursor-pointer"
        onClick={() => onViewDetails(goal.id)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <span className={categoryInfo.color}>{categoryInfo.icon}</span>
            <span className="text-sm text-white truncate">{goal.title}</span>
          </div>
          <GoalProgressIndicator progress={goal.progress_percentage} size={24} />
        </div>
      </div>
    );
  }

  return (
    <div className="bg-zinc-800 border border-zinc-700 rounded-lg p-4 hover:border-zinc-600 transition-colors">
      {/* Header Row */}
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="flex items-center gap-2 flex-wrap">
          {/* Priority Badge */}
          <span
            className={`px-2 py-0.5 text-xs font-semibold rounded uppercase ${getPriorityBadge(
              goal.priority
            )}`}
          >
            {goal.priority}
          </span>

          {/* Category Badge */}
          <span className={`text-sm ${categoryInfo.color}`}>
            {categoryInfo.icon} {categoryInfo.label}
          </span>

          {/* Status Badge (for non-active) */}
          {goal.status !== 'active' && (
            <span
              className={`px-2 py-0.5 text-xs rounded ${getStatusBadge(goal.status)}`}
            >
              {goal.status.charAt(0).toUpperCase() + goal.status.slice(1)}
            </span>
          )}
        </div>

        {/* Target Date */}
        {targetDateInfo && (
          <span className={`text-xs ${targetDateInfo.className}`}>
            {goal.isOverdue && '⚠️ '}{targetDateInfo.text}
          </span>
        )}
      </div>

      {/* Title */}
      <h3 className="text-lg font-medium text-white mb-1">{goal.title}</h3>

      {/* Description */}
      <p className="text-sm text-zinc-400 mb-3 line-clamp-2">{goal.description}</p>

      {/* Progress Bar */}
      <div className="mb-3">
        <GoalProgressBar progress={goal.progress_percentage} showLabel />
      </div>

      {/* Metadata Row */}
      <div className="flex items-center gap-4 text-xs text-zinc-500 mb-3 flex-wrap">
        {/* Metric Display */}
        {metricDisplay && (
          <span className="flex items-center gap-1">
            <span className="text-zinc-400">📊</span>
            {metricDisplay}
          </span>
        )}

        {/* Child Goals */}
        {goal.childCount !== undefined && goal.childCount > 0 && (
          <span>Sub-goals: {goal.childCount}</span>
        )}

        {/* Linked Patterns */}
        {goal.linkedPatternCount !== undefined && goal.linkedPatternCount > 0 && (
          <span>Patterns: {goal.linkedPatternCount}</span>
        )}

        {/* Days Until Target */}
        {goal.daysUntilTarget !== undefined && goal.daysUntilTarget !== null && goal.daysUntilTarget > 0 && (
          <span className="text-zinc-400">
            {goal.daysUntilTarget} days left
          </span>
        )}
      </div>

      {/* Action Buttons */}
      {goal.status === 'active' && (
        <div className="flex items-center gap-2 pt-2 border-t border-zinc-700">
          {onUpdateProgress && (
            <button
              onClick={() => onUpdateProgress(goal.id)}
              className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded transition-colors"
            >
              Update Progress
            </button>
          )}
          <button
            onClick={() => onEdit(goal.id)}
            className="px-3 py-1.5 bg-zinc-600 hover:bg-zinc-500 text-white text-sm font-medium rounded transition-colors"
          >
            Edit
          </button>
          <button
            onClick={() => onDelete(goal.id)}
            className="px-3 py-1.5 border border-red-700 hover:border-red-600 hover:bg-red-900/50 text-red-400 text-sm rounded transition-colors"
          >
            Abandon
          </button>
          <button
            onClick={() => onViewDetails(goal.id)}
            className="ml-auto px-3 py-1.5 border border-zinc-600 hover:border-zinc-500 text-zinc-300 text-sm rounded transition-colors"
          >
            Details
          </button>
        </div>
      )}

      {/* Status indicator for non-active goals */}
      {goal.status !== 'active' && (
        <div className="flex items-center gap-2 pt-2 border-t border-zinc-700 text-sm">
          <span className={`px-2 py-1 rounded ${getStatusBadge(goal.status)}`}>
            {goal.status.charAt(0).toUpperCase() + goal.status.slice(1)}
          </span>
          {goal.completed_at && (
            <span className="text-zinc-500 text-xs">
              {new Date(goal.completed_at).toLocaleDateString()}
            </span>
          )}
          <button
            onClick={() => onViewDetails(goal.id)}
            className="ml-auto px-3 py-1.5 border border-zinc-600 hover:border-zinc-500 text-zinc-300 text-sm rounded transition-colors"
          >
            Details
          </button>
        </div>
      )}
    </div>
  );
}
