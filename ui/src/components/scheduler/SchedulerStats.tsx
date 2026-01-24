/**
 * SchedulerStats - Dashboard-style stats for scheduler
 */

import { Calendar, Play, Pause, XCircle, Clock } from 'lucide-react';
import type { SchedulerStats as SchedulerStatsType } from '../../lib/types/scheduler';

interface SchedulerStatsProps {
  stats: SchedulerStatsType;
}

export function SchedulerStats({ stats }: SchedulerStatsProps) {
  const statItems = [
    {
      label: 'Total',
      value: stats.totalTasks,
      icon: Calendar,
      color: 'text-cyan-400',
    },
    {
      label: 'Active',
      value: stats.activeTasks,
      icon: Play,
      color: 'text-green-400',
    },
    {
      label: 'Paused',
      value: stats.pausedTasks,
      icon: Pause,
      color: 'text-yellow-400',
    },
    {
      label: 'Disabled',
      value: stats.disabledTasks,
      icon: XCircle,
      color: 'text-gray-400',
    },
    {
      label: 'Running',
      value: stats.runningJobs,
      icon: Clock,
      color: 'text-purple-400',
    },
  ];

  return (
    <div className="grid grid-cols-5 gap-4">
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
  );
}
