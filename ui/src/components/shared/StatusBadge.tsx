import type { CommandStatus, AgentStatus } from '../../lib/types';

type Status = CommandStatus | AgentStatus;

interface StatusBadgeProps {
  status: Status;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
}

const statusConfig: Record<Status, { color: string; label: string; pulse?: boolean }> = {
  // Command statuses
  idle: { color: 'bg-status-idle', label: 'Idle' },
  pending: { color: 'bg-status-pending', label: 'Pending' },
  active: { color: 'bg-status-active', label: 'Active', pulse: true },
  review: { color: 'bg-status-review', label: 'Review', pulse: true },
  complete: { color: 'bg-status-complete', label: 'Complete' },
  error: { color: 'bg-status-error', label: 'Error' },
  // Agent statuses
  working: { color: 'bg-status-active', label: 'Working', pulse: true },
  waiting: { color: 'bg-status-pending', label: 'Waiting' },
};

const sizeConfig = {
  sm: { dot: 'w-2 h-2', text: 'text-xs', gap: 'gap-1' },
  md: { dot: 'w-3 h-3', text: 'text-sm', gap: 'gap-1.5' },
  lg: { dot: 'w-4 h-4', text: 'text-base', gap: 'gap-2' },
};

export function StatusBadge({ status, size = 'md', showLabel = true }: StatusBadgeProps) {
  const config = statusConfig[status];
  const sizes = sizeConfig[size];

  return (
    <div className={`flex items-center ${sizes.gap}`}>
      <span
        className={`${sizes.dot} rounded-full ${config.color} ${
          config.pulse ? 'animate-pulse-subtle' : ''
        }`}
      />
      {showLabel && (
        <span className={`${sizes.text} text-text-secondary`}>{config.label}</span>
      )}
    </div>
  );
}
