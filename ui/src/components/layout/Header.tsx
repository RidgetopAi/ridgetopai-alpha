import { Plus, Bell, Settings, Keyboard } from 'lucide-react';
import { ActionButton } from '../shared/ActionButton';
import { ProjectSelector } from './ProjectSelector';
import { useUIStore } from '../../stores/ui-store';
import { useCommandStore } from '../../stores/command-store';
import { useAgentStore } from '../../stores/agent-store';

export function Header() {
  const { openCommandInput, notifications } = useUIStore();
  const { activeCommand, queue } = useCommandStore();
  const { agents } = useAgentStore();

  const activeAgents = agents.filter((a) => a.status === 'working').length;
  const unreadNotifications = notifications.filter((n) => !n.read).length;

  return (
    <header className="h-14 bg-surface-1 border-b border-border-subtle px-4 flex items-center justify-between">
      {/* Left: Logo + Project */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-gradient-to-br from-accent-primary to-accent-purple rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-sm">RT</span>
          </div>
          <span className="text-text-primary font-semibold">RidgeTop AI</span>
        </div>

        <div className="h-6 w-px bg-border-subtle" />

        <ProjectSelector />
      </div>

      {/* Center: Status Summary */}
      <div className="flex items-center gap-6 text-sm">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-status-active animate-pulse-subtle" />
          <span className="text-text-secondary">
            {activeCommand ? '1 Active' : 'Idle'}
          </span>
        </div>
        <div className="text-text-tertiary">|</div>
        <div className="text-text-secondary">
          {queue.length} Queued
        </div>
        <div className="text-text-tertiary">|</div>
        <div className="text-text-secondary">
          {activeAgents} Agent{activeAgents !== 1 ? 's' : ''} Working
        </div>
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-2">
        <ActionButton
          variant="primary"
          size="md"
          icon={<Plus className="w-4 h-4" />}
          onClick={openCommandInput}
        >
          New Command
        </ActionButton>

        <div className="h-6 w-px bg-border-subtle mx-1" />

        <ActionButton
          variant="ghost"
          size="md"
          icon={<Keyboard className="w-4 h-4" />}
          title="Keyboard Shortcuts"
        >
          <span className="sr-only">Shortcuts</span>
        </ActionButton>

        <ActionButton
          variant="ghost"
          size="md"
          icon={
            <div className="relative">
              <Bell className="w-4 h-4" />
              {unreadNotifications > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-status-error text-white text-xs rounded-full flex items-center justify-center">
                  {unreadNotifications > 9 ? '9+' : unreadNotifications}
                </span>
              )}
            </div>
          }
          title="Notifications"
        >
          <span className="sr-only">Notifications</span>
        </ActionButton>

        <ActionButton
          variant="ghost"
          size="md"
          icon={<Settings className="w-4 h-4" />}
          title="Settings"
        >
          <span className="sr-only">Settings</span>
        </ActionButton>
      </div>
    </header>
  );
}
