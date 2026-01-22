import { Clock, Zap, Database, Wifi } from 'lucide-react';
import { useAgentStore } from '../../stores/agent-store';
import { useCommandStore } from '../../stores/command-store';
import { useState, useEffect } from 'react';

export function StatusBar() {
  const { agents } = useAgentStore();
  const { queue, activeCommand } = useCommandStore();
  const [time, setTime] = useState(new Date());

  const activeAgents = agents.filter((a) => a.status === 'working').length;

  useEffect(() => {
    const interval = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <footer className="h-8 bg-surface-1 border-t border-border-subtle px-4 flex items-center justify-between text-xs">
      {/* Left: Active Status */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-1.5">
          <Zap
            className={`w-3 h-3 ${
              activeCommand ? 'text-status-active' : 'text-status-idle'
            }`}
          />
          <span className="text-text-secondary">
            {activeCommand
              ? `Executing: ${activeCommand.description.slice(0, 30)}...`
              : 'Idle'}
          </span>
        </div>
      </div>

      {/* Center: Metrics */}
      <div className="flex items-center gap-6 text-text-tertiary">
        <div className="flex items-center gap-1.5">
          <span>Queue:</span>
          <span className="text-text-secondary">{queue.length}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span>Agents:</span>
          <span
            className={activeAgents > 0 ? 'text-status-active' : 'text-text-secondary'}
          >
            {activeAgents}/{agents.length}
          </span>
        </div>
      </div>

      {/* Right: Connection + Time */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-1.5">
          <Database className="w-3 h-3 text-status-complete" />
          <span className="text-text-secondary">Mandrel</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Wifi className="w-3 h-3 text-status-complete" />
          <span className="text-text-secondary">Live</span>
        </div>
        <div className="flex items-center gap-1.5 text-text-tertiary">
          <Clock className="w-3 h-3" />
          <span>
            {time.toLocaleTimeString('en-US', {
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit',
            })}
          </span>
        </div>
      </div>
    </footer>
  );
}
