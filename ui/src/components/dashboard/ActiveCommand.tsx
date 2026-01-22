import { Play, Pause, XCircle, Clock, Bot } from 'lucide-react';
import { Panel } from '../shared/Panel';
import { StatusBadge } from '../shared/StatusBadge';
import { ActionButton } from '../shared/ActionButton';
import { useCommandStore } from '../../stores/command-store';
import { useAgentStore } from '../../stores/agent-store';

export function ActiveCommand() {
  const { activeCommand } = useCommandStore();
  const { getAgent } = useAgentStore();

  if (!activeCommand) {
    return (
      <Panel title="Active Command" accent="default">
        <div className="flex flex-col items-center justify-center py-8 text-text-tertiary">
          <div className="w-12 h-12 rounded-full bg-surface-2 flex items-center justify-center mb-3">
            <Play className="w-5 h-5" />
          </div>
          <p className="text-sm">No active command</p>
          <p className="text-xs mt-1">
            Press <kbd className="px-1.5 py-0.5 bg-surface-3 rounded text-text-secondary">Cmd+K</kbd> to start
          </p>
        </div>
      </Panel>
    );
  }

  const agent = activeCommand.agentId ? getAgent(activeCommand.agentId) : null;
  const elapsedMs = activeCommand.startedAt
    ? Date.now() - new Date(activeCommand.startedAt).getTime()
    : 0;
  const elapsedMin = Math.floor(elapsedMs / 60000);
  const elapsedSec = Math.floor((elapsedMs % 60000) / 1000);

  return (
    <Panel
      title="Active Command"
      accent={activeCommand.status === 'review' ? 'gold' : 'primary'}
      headerActions={
        <div className="flex items-center gap-2">
          <ActionButton variant="ghost" size="sm" icon={<Pause className="w-3 h-3" />}>
            Pause
          </ActionButton>
          <ActionButton variant="ghost" size="sm" icon={<XCircle className="w-3 h-3" />}>
            Cancel
          </ActionButton>
        </div>
      }
    >
      <div className="space-y-4">
        {/* Command Description */}
        <div>
          <p className="text-text-primary">{activeCommand.description}</p>
        </div>

        {/* Status Row */}
        <div className="flex items-center justify-between">
          <StatusBadge status={activeCommand.status} size="md" />
          <div className="flex items-center gap-1.5 text-text-tertiary text-sm">
            <Clock className="w-3.5 h-3.5" />
            <span>
              {elapsedMin}:{elapsedSec.toString().padStart(2, '0')}
            </span>
          </div>
        </div>

        {/* Agent Info */}
        {agent && (
          <div className="flex items-center gap-2 px-3 py-2 bg-surface-2 rounded-md">
            <Bot className="w-4 h-4 text-accent-purple" />
            <span className="text-sm text-text-secondary">{agent.name}</span>
            <span className="text-xs text-text-tertiary ml-auto">
              {agent.currentTask || 'Processing...'}
            </span>
          </div>
        )}

        {/* Review Required Banner */}
        {activeCommand.status === 'review' && (
          <div className="flex items-center gap-3 p-3 bg-human-action/10 border border-human-action/30 rounded-md">
            <div className="w-8 h-8 rounded-full bg-human-action/20 flex items-center justify-center">
              <span className="text-human-action text-lg">?</span>
            </div>
            <div className="flex-1">
              <p className="text-sm text-human-action font-medium">Decision Required</p>
              <p className="text-xs text-text-secondary">Click to review and decide</p>
            </div>
            <ActionButton variant="primary" size="sm">
              Review
            </ActionButton>
          </div>
        )}

        {/* Progress Indicator */}
        <div className="h-1 bg-surface-3 rounded-full overflow-hidden">
          <div
            className="h-full bg-accent-primary animate-pulse-subtle"
            style={{ width: '60%' }}
          />
        </div>
      </div>
    </Panel>
  );
}
