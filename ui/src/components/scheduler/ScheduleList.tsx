/**
 * ScheduleList - Displays list of scheduled tasks with actions
 */

import { Clock, Play, Pause, Trash2, PlayCircle, Calendar } from 'lucide-react';
import type { ScheduledTask, ScheduleStatus } from '../../lib/types/scheduler';
import { SCHEDULE_STATUS_LABELS } from '../../lib/types/scheduler';

interface ScheduleListProps {
  schedules: ScheduledTask[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onTrigger: (id: string) => void;
  onToggleStatus: (id: string, status: ScheduleStatus) => void;
  onDelete: (id: string) => void;
  isLoading?: boolean;
}

export function ScheduleList({
  schedules,
  selectedId,
  onSelect,
  onTrigger,
  onToggleStatus,
  onDelete,
  isLoading,
}: ScheduleListProps) {
  if (schedules.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        <Calendar className="w-12 h-12 mx-auto mb-4 opacity-50" />
        <p>No scheduled tasks yet</p>
        <p className="text-sm mt-2">Create a schedule to automate orchestration</p>
      </div>
    );
  }

  const getStatusColor = (status: ScheduleStatus) => {
    switch (status) {
      case 'active':
        return 'bg-green-500/20 text-green-400 border-green-500/30';
      case 'paused':
        return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
      case 'disabled':
        return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
    }
  };

  const getResultColor = (result?: string) => {
    switch (result) {
      case 'success':
        return 'text-green-400';
      case 'failure':
        return 'text-red-400';
      case 'timeout':
        return 'text-yellow-400';
      default:
        return 'text-gray-500';
    }
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return 'Never';
    const date = new Date(dateStr);
    return date.toLocaleString();
  };

  return (
    <div className="space-y-2">
      {schedules.map((schedule) => {
        const isSelected = schedule.id === selectedId;

        return (
          <div
            key={schedule.id}
            onClick={() => onSelect(schedule.id)}
            className={`
              p-4 rounded-lg border cursor-pointer transition-all
              ${isSelected
                ? 'border-cyan-500/50 bg-cyan-900/20'
                : 'border-gray-700 bg-gray-800/50 hover:border-gray-600'
              }
            `}
          >
            {/* Header */}
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="font-medium text-white truncate">{schedule.name}</h3>
                  <span className={`px-2 py-0.5 text-xs rounded-full border ${getStatusColor(schedule.status)}`}>
                    {SCHEDULE_STATUS_LABELS[schedule.status]}
                  </span>
                </div>
                {schedule.description && (
                  <p className="text-sm text-gray-400 mt-1 line-clamp-1">{schedule.description}</p>
                )}
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onTrigger(schedule.id);
                  }}
                  disabled={isLoading}
                  className="p-1.5 rounded-md text-cyan-400 hover:bg-cyan-900/50 transition-colors"
                  title="Run now"
                >
                  <PlayCircle className="w-4 h-4" />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleStatus(
                      schedule.id,
                      schedule.status === 'active' ? 'paused' : 'active'
                    );
                  }}
                  disabled={isLoading}
                  className="p-1.5 rounded-md text-gray-400 hover:bg-gray-700/50 transition-colors"
                  title={schedule.status === 'active' ? 'Pause' : 'Resume'}
                >
                  {schedule.status === 'active' ? (
                    <Pause className="w-4 h-4" />
                  ) : (
                    <Play className="w-4 h-4" />
                  )}
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (confirm('Delete this schedule?')) {
                      onDelete(schedule.id);
                    }
                  }}
                  disabled={isLoading}
                  className="p-1.5 rounded-md text-red-400 hover:bg-red-900/50 transition-colors"
                  title="Delete"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Details */}
            <div className="mt-3 flex items-center gap-4 text-xs text-gray-500">
              <div className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                <code className="text-gray-400">{schedule.cronPattern}</code>
              </div>
              <div>
                Runs: <span className="text-gray-400">{schedule.runCount}</span>
              </div>
              {schedule.lastRunAt && (
                <div>
                  Last: <span className={getResultColor(schedule.lastResult)}>{formatDate(schedule.lastRunAt)}</span>
                </div>
              )}
            </div>

            {/* Intent preview */}
            <div className="mt-2 text-xs text-gray-500">
              <span className="text-gray-600">Intent:</span>{' '}
              <span className="text-gray-400 line-clamp-1">{schedule.intentTemplate}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
