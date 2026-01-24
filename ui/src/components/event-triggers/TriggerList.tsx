/**
 * TriggerList - Displays list of event triggers with actions
 */

import { Zap, Play, Pause, Trash2, Github, AlertTriangle, MessageSquare, Globe, Clock } from 'lucide-react';
import type { EventTrigger, TriggerStatus, EventSource } from '../../lib/types/event-triggers';
import { TRIGGER_STATUS_LABELS, EVENT_SOURCE_LABELS } from '../../lib/types/event-triggers';

interface TriggerListProps {
  triggers: EventTrigger[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onToggleStatus: (id: string, status: TriggerStatus) => void;
  onDelete: (id: string) => void;
  isLoading?: boolean;
}

export function TriggerList({
  triggers,
  selectedId,
  onSelect,
  onToggleStatus,
  onDelete,
  isLoading,
}: TriggerListProps) {
  if (triggers.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        <Zap className="w-12 h-12 mx-auto mb-4 opacity-50" />
        <p>No event triggers yet</p>
        <p className="text-sm mt-2">Create a trigger to automate workflows on events</p>
      </div>
    );
  }

  const getStatusColor = (status: TriggerStatus) => {
    switch (status) {
      case 'active':
        return 'bg-green-500/20 text-green-400 border-green-500/30';
      case 'paused':
        return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
      case 'disabled':
        return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
    }
  };

  const getSourceIcon = (source: EventSource) => {
    switch (source) {
      case 'github':
        return Github;
      case 'sentry':
        return AlertTriangle;
      case 'slack':
        return MessageSquare;
      case 'cron':
        return Clock;
      default:
        return Globe;
    }
  };

  const getSourceColor = (source: EventSource) => {
    switch (source) {
      case 'github':
        return 'text-gray-300';
      case 'sentry':
        return 'text-red-400';
      case 'slack':
        return 'text-purple-400';
      case 'cron':
        return 'text-blue-400';
      default:
        return 'text-cyan-400';
    }
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return 'Never';
    const date = new Date(dateStr);
    return date.toLocaleString();
  };

  return (
    <div className="space-y-2">
      {triggers.map((trigger) => {
        const isSelected = trigger.id === selectedId;
        const SourceIcon = getSourceIcon(trigger.source);

        return (
          <div
            key={trigger.id}
            onClick={() => onSelect(trigger.id)}
            className={`
              p-4 rounded-lg border cursor-pointer transition-all
              ${isSelected
                ? 'border-purple-500/50 bg-purple-900/20'
                : 'border-gray-700 bg-gray-800/50 hover:border-gray-600'
              }
            `}
          >
            {/* Header */}
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <SourceIcon className={`w-4 h-4 ${getSourceColor(trigger.source)}`} />
                  <h3 className="font-medium text-white truncate">{trigger.name}</h3>
                  <span className={`px-2 py-0.5 text-xs rounded-full border ${getStatusColor(trigger.status)}`}>
                    {TRIGGER_STATUS_LABELS[trigger.status]}
                  </span>
                </div>
                {trigger.description && (
                  <p className="text-sm text-gray-400 mt-1 line-clamp-1">{trigger.description}</p>
                )}
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleStatus(
                      trigger.id,
                      trigger.status === 'active' ? 'paused' : 'active'
                    );
                  }}
                  disabled={isLoading}
                  className="p-1.5 rounded-md text-gray-400 hover:bg-gray-700/50 transition-colors"
                  title={trigger.status === 'active' ? 'Pause' : 'Resume'}
                >
                  {trigger.status === 'active' ? (
                    <Pause className="w-4 h-4" />
                  ) : (
                    <Play className="w-4 h-4" />
                  )}
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (confirm('Delete this trigger?')) {
                      onDelete(trigger.id);
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
                <span className="text-gray-600">Source:</span>
                <span className="text-gray-400">{EVENT_SOURCE_LABELS[trigger.source]}</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="text-gray-600">Event:</span>
                <code className="text-gray-400">{trigger.eventType}</code>
              </div>
              <div>
                Triggered: <span className="text-gray-400">{trigger.triggerCount}</span> times
              </div>
            </div>

            {trigger.lastTriggeredAt && (
              <div className="mt-2 text-xs text-gray-500">
                <span className="text-gray-600">Last triggered:</span>{' '}
                <span className="text-gray-400">{formatDate(trigger.lastTriggeredAt)}</span>
              </div>
            )}

            {/* Intent preview */}
            <div className="mt-2 text-xs text-gray-500">
              <span className="text-gray-600">Intent:</span>{' '}
              <span className="text-gray-400 line-clamp-1">{trigger.intentTemplate}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
