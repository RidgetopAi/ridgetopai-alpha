import { GripVertical, Play, Trash2 } from 'lucide-react';
import { Panel } from '../shared/Panel';
import { StatusBadge } from '../shared/StatusBadge';
import { ActionButton } from '../shared/ActionButton';
import { useCommandStore } from '../../stores/command-store';
import type { Command } from '../../lib/types';

function QueueItem({ command, index }: { command: Command; index: number }) {
  const { startCommand, cancelCommand } = useCommandStore();

  return (
    <div className="flex items-center gap-3 p-3 bg-surface-2 rounded-lg border border-border-subtle group hover:border-border-default transition-colors">
      {/* Drag Handle */}
      <button className="text-text-tertiary hover:text-text-secondary cursor-grab active:cursor-grabbing">
        <GripVertical className="w-4 h-4" />
      </button>

      {/* Position */}
      <span className="w-6 h-6 rounded-full bg-surface-3 flex items-center justify-center text-xs text-text-secondary">
        {index + 1}
      </span>

      {/* Command Info */}
      <div className="flex-1 min-w-0">
        <p className="text-sm text-text-primary truncate">{command.description}</p>
        <p className="text-xs text-text-tertiary">
          Added {new Date(command.createdAt).toLocaleTimeString()}
        </p>
      </div>

      {/* Status */}
      <StatusBadge status={command.status} size="sm" />

      {/* Actions */}
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <ActionButton
          variant="ghost"
          size="sm"
          icon={<Play className="w-3 h-3" />}
          onClick={() => startCommand(command.id)}
          title="Start now"
        />
        <ActionButton
          variant="ghost"
          size="sm"
          icon={<Trash2 className="w-3 h-3" />}
          onClick={() => cancelCommand(command.id)}
          title="Remove"
        />
      </div>
    </div>
  );
}

export function CommandQueue() {
  const { queue } = useCommandStore();

  return (
    <Panel
      title="Command Queue"
      subtitle={`${queue.length} pending`}
      headerActions={
        queue.length > 0 && (
          <ActionButton variant="ghost" size="sm">
            Clear All
          </ActionButton>
        )
      }
    >
      {queue.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-6 text-text-tertiary">
          <p className="text-sm">Queue is empty</p>
          <p className="text-xs mt-1">Add commands to get started</p>
        </div>
      ) : (
        <div className="space-y-2">
          {queue.map((command, index) => (
            <QueueItem key={command.id} command={command} index={index} />
          ))}
        </div>
      )}
    </Panel>
  );
}
