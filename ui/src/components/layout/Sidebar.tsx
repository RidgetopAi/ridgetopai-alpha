import { LayoutDashboard, ListTodo, GitBranch, Database, History, Bot } from 'lucide-react';
import type { ViewMode } from '../../lib/types';
import { useUIStore } from '../../stores/ui-store';
import { useCommandStore } from '../../stores/command-store';
import { useAgentStore } from '../../stores/agent-store';

interface NavItem {
  id: ViewMode;
  label: string;
  icon: typeof LayoutDashboard;
  badge?: number;
}

export function Sidebar() {
  const { activeView, setView } = useUIStore();
  const { queue, commands } = useCommandStore();
  const { agents } = useAgentStore();

  const activeAgents = agents.filter((a) => a.status === 'working').length;
  const completedToday = commands.filter(
    (c) =>
      c.status === 'complete' &&
      c.completedAt &&
      new Date(c.completedAt).toDateString() === new Date().toDateString()
  ).length;

  const navItems: NavItem[] = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'queue', label: 'Queue', icon: ListTodo, badge: queue.length || undefined },
    { id: 'workflow', label: 'Workflow', icon: GitBranch },
    { id: 'context', label: 'Context', icon: Database },
    { id: 'history', label: 'History', icon: History, badge: completedToday || undefined },
  ];

  return (
    <aside className="w-56 bg-surface-1 border-r border-border-subtle flex flex-col">
      {/* Navigation */}
      <nav className="flex-1 p-3">
        <ul className="space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeView === item.id;

            return (
              <li key={item.id}>
                <button
                  onClick={() => setView(item.id)}
                  className={`
                    w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm
                    transition-colors duration-150
                    ${
                      isActive
                        ? 'bg-surface-3 text-text-primary'
                        : 'text-text-secondary hover:bg-surface-2 hover:text-text-primary'
                    }
                  `}
                >
                  <Icon className="w-4 h-4" />
                  <span className="flex-1 text-left">{item.label}</span>
                  {item.badge !== undefined && (
                    <span
                      className={`
                        px-1.5 py-0.5 text-xs rounded-full
                        ${isActive ? 'bg-surface-4' : 'bg-surface-2'}
                      `}
                    >
                      {item.badge}
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Agents Summary */}
      <div className="p-3 border-t border-border-subtle">
        <div className="flex items-center gap-2 mb-2">
          <Bot className="w-4 h-4 text-accent-purple" />
          <span className="text-xs font-medium text-text-secondary uppercase tracking-wider">
            Agents
          </span>
        </div>
        <div className="space-y-2">
          {agents.slice(0, 3).map((agent) => (
            <div
              key={agent.id}
              className="flex items-center justify-between text-sm"
            >
              <span className="text-text-secondary truncate">{agent.name}</span>
              <span
                className={`
                  w-2 h-2 rounded-full
                  ${
                    agent.status === 'working'
                      ? 'bg-status-active animate-pulse-subtle'
                      : agent.status === 'waiting'
                      ? 'bg-status-pending'
                      : 'bg-status-idle'
                  }
                `}
              />
            </div>
          ))}
        </div>
        {activeAgents > 0 && (
          <p className="text-xs text-accent-purple mt-2">
            {activeAgents} agent{activeAgents !== 1 ? 's' : ''} working
          </p>
        )}
      </div>

      {/* Mandrel Status */}
      <div className="p-3 border-t border-border-subtle">
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-status-complete" />
            <span className="text-text-secondary">Mandrel</span>
          </div>
          <span className="text-text-tertiary text-xs">Connected</span>
        </div>
      </div>
    </aside>
  );
}
