/**
 * EventTriggersStats - Dashboard-style stats for event triggers
 */

import { Zap, Play, Pause, XCircle, Github, AlertTriangle, MessageSquare, Globe } from 'lucide-react';
import type { EventTriggerStats } from '../../lib/types/event-triggers';

interface EventTriggersStatsProps {
  stats: EventTriggerStats;
}

export function EventTriggersStats({ stats }: EventTriggersStatsProps) {
  const statItems = [
    {
      label: 'Total',
      value: stats.totalTriggers,
      icon: Zap,
      color: 'text-purple-400',
    },
    {
      label: 'Active',
      value: stats.activeTriggers,
      icon: Play,
      color: 'text-green-400',
    },
    {
      label: 'Paused',
      value: stats.pausedTriggers,
      icon: Pause,
      color: 'text-yellow-400',
    },
    {
      label: 'Disabled',
      value: stats.disabledTriggers,
      icon: XCircle,
      color: 'text-gray-400',
    },
  ];

  // Source breakdown with icons
  const sourceIcons: Record<string, typeof Github> = {
    github: Github,
    sentry: AlertTriangle,
    slack: MessageSquare,
    webhook: Globe,
    internal: Zap,
    cron: Play,
  };

  const bySourceItems = Object.entries(stats.bySource || {}).map(([source, count]) => ({
    label: source.charAt(0).toUpperCase() + source.slice(1),
    value: count,
    icon: sourceIcons[source] || Globe,
    color: source === 'github' ? 'text-gray-300' :
           source === 'sentry' ? 'text-red-400' :
           source === 'slack' ? 'text-purple-400' :
           'text-blue-400',
  }));

  return (
    <div className="space-y-4">
      {/* Main stats */}
      <div className="grid grid-cols-4 gap-4">
        {statItems.map((item) => {
          const Icon = item.icon;
          return (
            <div
              key={item.label}
              className="bg-gray-800/50 border border-gray-700 rounded-lg p-4 text-center"
            >
              <Icon className={`w-5 h-5 mx-auto mb-2 ${item.color}`} />
              <div className="text-2xl font-bold text-white">{item.value}</div>
              <div className="text-xs text-gray-500 uppercase tracking-wide">{item.label}</div>
            </div>
          );
        })}
      </div>

      {/* Source breakdown (if any) */}
      {bySourceItems.length > 0 && (
        <div className="grid grid-cols-6 gap-2">
          {bySourceItems.map((item) => {
            const Icon = item.icon;
            return (
              <div
                key={item.label}
                className="bg-gray-800/30 border border-gray-800 rounded-md p-2 text-center"
              >
                <Icon className={`w-4 h-4 mx-auto mb-1 ${item.color}`} />
                <div className="text-lg font-medium text-white">{item.value}</div>
                <div className="text-xs text-gray-600 truncate">{item.label}</div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
