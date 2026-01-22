import { Bot, Cpu, Zap } from 'lucide-react';
import { Panel } from '../shared/Panel';
import { StatusBadge } from '../shared/StatusBadge';
import { useAgentStore } from '../../stores/agent-store';
import type { Agent } from '../../lib/types';

function AgentCard({ agent }: { agent: Agent }) {
  const typeIcons = {
    forge: Zap,
    claude: Bot,
    custom: Cpu,
  };

  const Icon = typeIcons[agent.type];

  return (
    <div className="p-3 bg-surface-2 rounded-lg border border-border-subtle hover:border-border-default transition-colors">
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          <div
            className={`
              w-8 h-8 rounded-md flex items-center justify-center
              ${agent.type === 'forge' ? 'bg-accent-primary/20 text-accent-primary' : ''}
              ${agent.type === 'claude' ? 'bg-accent-purple/20 text-accent-purple' : ''}
              ${agent.type === 'custom' ? 'bg-accent-gold/20 text-accent-gold' : ''}
            `}
          >
            <Icon className="w-4 h-4" />
          </div>
          <div>
            <p className="text-sm font-medium text-text-primary">{agent.name}</p>
            <p className="text-xs text-text-tertiary capitalize">{agent.type}</p>
          </div>
        </div>
        <StatusBadge status={agent.status} size="sm" showLabel={false} />
      </div>

      {agent.currentTask && (
        <p className="text-xs text-text-secondary truncate mb-2">
          {agent.currentTask}
        </p>
      )}

      <div className="flex items-center gap-4 text-xs text-text-tertiary">
        <span>{agent.stats.tasksCompleted} tasks</span>
        <span>{agent.stats.successRate}% success</span>
      </div>
    </div>
  );
}

export function AgentGrid() {
  const { agents } = useAgentStore();

  return (
    <Panel title="Agents" subtitle={`${agents.length} registered`}>
      <div className="grid grid-cols-2 gap-3">
        {agents.map((agent) => (
          <AgentCard key={agent.id} agent={agent} />
        ))}
      </div>
    </Panel>
  );
}
