import { TrendingUp, Clock, CheckCircle, AlertTriangle } from 'lucide-react';
import { Panel } from '../shared/Panel';
import { useCommandStore } from '../../stores/command-store';

interface StatCardProps {
  label: string;
  value: string | number;
  icon: typeof TrendingUp;
  color: 'primary' | 'gold' | 'green' | 'red';
  trend?: { value: number; label: string };
}

function StatCard({ label, value, icon: Icon, color, trend }: StatCardProps) {
  const colorStyles = {
    primary: 'text-accent-primary bg-accent-primary/10',
    gold: 'text-accent-gold bg-accent-gold/10',
    green: 'text-status-complete bg-status-complete/10',
    red: 'text-status-error bg-status-error/10',
  };

  return (
    <div className="p-4 bg-surface-2 rounded-lg">
      <div className="flex items-start justify-between mb-2">
        <div
          className={`w-8 h-8 rounded-md flex items-center justify-center ${colorStyles[color]}`}
        >
          <Icon className="w-4 h-4" />
        </div>
        {trend && (
          <span
            className={`text-xs ${
              trend.value >= 0 ? 'text-status-complete' : 'text-status-error'
            }`}
          >
            {trend.value >= 0 ? '+' : ''}{trend.value}%
          </span>
        )}
      </div>
      <p className="text-2xl font-semibold text-text-primary">{value}</p>
      <p className="text-xs text-text-tertiary mt-1">{label}</p>
    </div>
  );
}

export function QuickStats() {
  const { commands } = useCommandStore();

  const today = new Date().toDateString();

  const completedToday = commands.filter(
    (c) =>
      c.status === 'complete' &&
      c.completedAt &&
      new Date(c.completedAt).toDateString() === today
  ).length;

  const errorCount = commands.filter(
    (c) =>
      c.status === 'error' &&
      c.completedAt &&
      new Date(c.completedAt).toDateString() === today
  ).length;

  // Calculate average time for completed commands
  const completedWithTime = commands.filter(
    (c) => c.status === 'complete' && c.startedAt && c.completedAt
  );

  const avgTimeMin = completedWithTime.length
    ? Math.round(
        completedWithTime.reduce((acc, c) => {
          const start = new Date(c.startedAt!).getTime();
          const end = new Date(c.completedAt!).getTime();
          return acc + (end - start) / 60000;
        }, 0) / completedWithTime.length
      )
    : 0;

  return (
    <Panel title="Today's Stats">
      <div className="grid grid-cols-4 gap-3">
        <StatCard
          label="Completed"
          value={completedToday}
          icon={CheckCircle}
          color="green"
          trend={{ value: 12, label: 'vs yesterday' }}
        />
        <StatCard
          label="Avg Time"
          value={`${avgTimeMin}m`}
          icon={Clock}
          color="primary"
        />
        <StatCard
          label="Leverage"
          value="8.5x"
          icon={TrendingUp}
          color="gold"
          trend={{ value: 5, label: 'improving' }}
        />
        <StatCard
          label="Errors"
          value={errorCount}
          icon={AlertTriangle}
          color={errorCount > 0 ? 'red' : 'green'}
        />
      </div>
    </Panel>
  );
}
