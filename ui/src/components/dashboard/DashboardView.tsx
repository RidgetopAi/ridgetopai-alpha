import { ActiveCommand } from './ActiveCommand';
import { AgentGrid } from './AgentGrid';
import { QuickStats } from './QuickStats';
import { CommandQueue } from './CommandQueue';
import { ActivityStream } from './ActivityStream';
import { BugFixPanel } from '../workflows';
import { ContentPanel } from '../content-workflows';
import { OrchestrationPanel } from '../orchestration';

export function DashboardView() {
  return (
    <div className="flex-1 p-6 overflow-auto">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Hero Section: Orchestrator (COMMAND) + PRODUCE + GROW */}
        <div className="grid grid-cols-12 gap-6">
          {/* COMMAND Capability - Orchestrator (primary interface) */}
          <div className="col-span-4 h-[500px]">
            <OrchestrationPanel />
          </div>
          {/* PRODUCE Capability - Bug Fix */}
          <div className="col-span-4 h-[500px]">
            <BugFixPanel />
          </div>
          {/* GROW Capability - Content Generation */}
          <div className="col-span-4 h-[500px]">
            <ContentPanel />
          </div>
        </div>

        {/* Activity Stream - Full Width */}
        <div className="h-[300px]">
          <ActivityStream />
        </div>

        {/* Secondary Row: Active Command + Agent Grid */}
        <div className="grid grid-cols-12 gap-6">
          <div className="col-span-8">
            <ActiveCommand />
          </div>
          <div className="col-span-4">
            <AgentGrid />
          </div>
        </div>

        {/* Stats + Queue */}
        <div className="grid grid-cols-12 gap-6">
          <div className="col-span-8">
            <QuickStats />
          </div>
          <div className="col-span-4">
            <CommandQueue />
          </div>
        </div>
      </div>
    </div>
  );
}
