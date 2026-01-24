/**
 * WorkflowView - Workflow History and Details Visualization
 *
 * Shows all orchestration sessions as workflows with:
 * - Filterable/sortable list of sessions
 * - Timeline view showing session progression
 * - Detailed view of selected session
 */

import { useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  GitBranch,
  Clock,
  CheckCircle,
  XCircle,
  Play,
  ChevronDown,
  ChevronRight,
  Search,
  Filter,
  Calendar,
  ListTodo,
  X,
  ArrowUpDown,
} from 'lucide-react';
import { Panel } from '../shared/Panel';
import { useOrchestrationStore } from '../../stores/orchestration-store';
import { useWorkflowViewStore } from '../../stores/workflow-view-store';
import type {
  OrchestrationSession,
  SessionState,
  GeneratedTask,
} from '../../lib/types/orchestration';
import {
  SESSION_STATE_LABELS,
  TASK_TYPE_LABELS,
  TASK_STATUS_LABELS,
  TASK_TYPE_CAPABILITY,
} from '../../lib/types/orchestration';

export function WorkflowView() {
  const { sessions } = useOrchestrationStore();
  const {
    selectedSessionId,
    filter,
    sortBy,
    sortOrder,
    searchQuery,
    expandedSessions,
    selectSession,
    setFilter,
    setSortBy,
    toggleSortOrder,
    setSearchQuery,
    clearFilters,
    toggleSessionExpanded,
    collapseAll,
  } = useWorkflowViewStore();

  // Filter and sort sessions
  const filteredSessions = useMemo(() => {
    let result = [...sessions];

    // Apply status filter
    if (filter !== 'all') {
      result = result.filter((session) => {
        const state = getSessionState(session);
        return state === filter;
      });
    }

    // Apply search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (session) =>
          session.intent?.toLowerCase().includes(query) ||
          session.interpretation?.understood?.toLowerCase().includes(query) ||
          session.sessionId?.toLowerCase().includes(query)
      );
    }

    // Sort sessions
    result.sort((a, b) => {
      let comparison = 0;

      switch (sortBy) {
        case 'date':
          comparison = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
          break;
        case 'tasks':
          comparison = (a.interpretation?.tasks?.length || 0) - (b.interpretation?.tasks?.length || 0);
          break;
        case 'status':
          const statusOrder: Record<SessionState, number> = {
            executing: 5,
            ready: 4,
            analyzing: 3,
            completed: 2,
            failed: 1,
            idle: 0,
          };
          comparison = statusOrder[getSessionState(a)] - statusOrder[getSessionState(b)];
          break;
      }

      return sortOrder === 'desc' ? -comparison : comparison;
    });

    return result;
  }, [sessions, filter, searchQuery, sortBy, sortOrder]);

  // Get selected session
  const selectedSession = selectedSessionId
    ? sessions.find((s) => s.sessionId === selectedSessionId)
    : null;

  // Stats
  const stats = useMemo(() => {
    return {
      total: sessions.length,
      executing: sessions.filter((s) => getSessionState(s) === 'executing').length,
      completed: sessions.filter((s) => getSessionState(s) === 'completed').length,
      failed: sessions.filter((s) => getSessionState(s) === 'failed').length,
    };
  }, [sessions]);

  const hasActiveFilters = filter !== 'all' || searchQuery !== '';

  return (
    <div className="flex-1 p-6 overflow-hidden flex flex-col">
      <div className="max-w-7xl mx-auto w-full flex-1 flex flex-col space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-text-primary flex items-center gap-2">
              <GitBranch className="w-5 h-5 text-accent-primary" />
              Workflow History
            </h1>
            <p className="text-sm text-text-tertiary mt-1">
              {filteredSessions.length} of {sessions.length} workflows
            </p>
          </div>

          {/* Quick Stats */}
          <div className="flex items-center gap-4">
            <QuickStat label="Total" value={stats.total} />
            <QuickStat label="Running" value={stats.executing} color="text-yellow-400" />
            <QuickStat label="Completed" value={stats.completed} color="text-green-400" />
            <QuickStat label="Failed" value={stats.failed} color="text-red-400" />
          </div>
        </div>

        {/* Filters Bar */}
        <Panel className="!p-3">
          <div className="flex items-center gap-4 flex-wrap">
            {/* Search */}
            <div className="relative flex-1 min-w-[200px] max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-tertiary" />
              <input
                type="text"
                placeholder="Search workflows..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-surface-2 border border-border-subtle rounded-md text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-accent-primary"
              />
            </div>

            {/* Status Filter */}
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-text-tertiary" />
              <select
                value={filter}
                onChange={(e) => setFilter(e.target.value as typeof filter)}
                className="bg-surface-2 border border-border-subtle rounded-md px-2 py-1.5 text-sm text-text-primary focus:outline-none focus:border-accent-primary"
              >
                <option value="all">All Status</option>
                <option value="executing">Executing</option>
                <option value="ready">Ready</option>
                <option value="completed">Completed</option>
                <option value="failed">Failed</option>
              </select>
            </div>

            {/* Sort */}
            <div className="flex items-center gap-2">
              <ArrowUpDown className="w-4 h-4 text-text-tertiary" />
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
                className="bg-surface-2 border border-border-subtle rounded-md px-2 py-1.5 text-sm text-text-primary focus:outline-none focus:border-accent-primary"
              >
                <option value="date">Date</option>
                <option value="tasks">Tasks</option>
                <option value="status">Status</option>
              </select>
              <button
                onClick={toggleSortOrder}
                className="p-1.5 hover:bg-surface-2 rounded transition-colors"
                title={sortOrder === 'asc' ? 'Oldest first' : 'Newest first'}
              >
                <span className="text-xs text-text-tertiary">
                  {sortOrder === 'asc' ? 'ASC' : 'DESC'}
                </span>
              </button>
            </div>

            {/* Clear Filters */}
            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className="flex items-center gap-1 px-2 py-1 text-xs text-text-tertiary hover:text-text-primary hover:bg-surface-2 rounded transition-colors"
              >
                <X className="w-3 h-3" />
                Clear
              </button>
            )}

            {/* Collapse All */}
            {expandedSessions.size > 0 && (
              <button
                onClick={collapseAll}
                className="text-xs text-text-tertiary hover:text-text-primary"
              >
                Collapse All
              </button>
            )}
          </div>
        </Panel>

        {/* Main Content */}
        <div className="flex-1 flex gap-4 min-h-0">
          {/* Session List */}
          <div className="flex-1 overflow-auto">
            <div className="space-y-2">
              <AnimatePresence mode="popLayout">
                {filteredSessions.length === 0 ? (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="flex flex-col items-center justify-center py-12 text-text-tertiary"
                  >
                    <GitBranch className="w-12 h-12 mb-3 opacity-50" />
                    <p className="text-sm">No workflows match your filters</p>
                    {hasActiveFilters && (
                      <button
                        onClick={clearFilters}
                        className="mt-2 text-xs text-accent-primary hover:underline"
                      >
                        Clear all filters
                      </button>
                    )}
                  </motion.div>
                ) : (
                  filteredSessions.map((session) => (
                    <WorkflowCard
                      key={session.sessionId}
                      session={session}
                      isSelected={selectedSessionId === session.sessionId}
                      isExpanded={expandedSessions.has(session.sessionId)}
                      onSelect={() =>
                        selectSession(
                          selectedSessionId === session.sessionId ? null : session.sessionId
                        )
                      }
                      onToggleExpand={() => toggleSessionExpanded(session.sessionId)}
                    />
                  ))
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* Detail Panel */}
          <AnimatePresence>
            {selectedSession && (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="w-[420px] shrink-0"
              >
                <WorkflowDetailPanel
                  session={selectedSession}
                  onClose={() => selectSession(null)}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

// Helper function to determine session state
function getSessionState(session: OrchestrationSession): SessionState {
  const { execution } = session;
  if (execution.running > 0) return 'executing';
  if (execution.pending > 0 && execution.completed === 0) return 'ready';
  if (execution.failed > 0 && execution.pending === 0 && execution.running === 0) return 'failed';
  if (execution.completed > 0 && execution.pending === 0 && execution.running === 0)
    return 'completed';
  return 'idle';
}

// Quick Stat Component
function QuickStat({
  label,
  value,
  color = 'text-text-primary',
}: {
  label: string;
  value: number;
  color?: string;
}) {
  return (
    <div className="text-center">
      <p className={`text-lg font-semibold ${color}`}>{value}</p>
      <p className="text-xs text-text-tertiary">{label}</p>
    </div>
  );
}

// Workflow Card Component
interface WorkflowCardProps {
  session: OrchestrationSession;
  isSelected: boolean;
  isExpanded: boolean;
  onSelect: () => void;
  onToggleExpand: () => void;
}

function WorkflowCard({
  session,
  isSelected,
  isExpanded,
  onSelect,
  onToggleExpand,
}: WorkflowCardProps) {
  const state = getSessionState(session);
  const { execution, interpretation } = session;

  const getStatusIcon = () => {
    switch (state) {
      case 'executing':
        return <Play className="w-4 h-4 text-yellow-400 animate-pulse" />;
      case 'completed':
        return <CheckCircle className="w-4 h-4 text-green-400" />;
      case 'failed':
        return <XCircle className="w-4 h-4 text-red-400" />;
      default:
        return <Clock className="w-4 h-4 text-text-tertiary" />;
    }
  };

  const getStatusColor = (): string => {
    switch (state) {
      case 'executing':
        return 'border-yellow-500/50';
      case 'completed':
        return 'border-green-500/30';
      case 'failed':
        return 'border-red-500/30';
      default:
        return 'border-transparent';
    }
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className={`
        bg-surface-1 rounded-lg border transition-all
        ${isSelected ? 'border-accent-primary' : getStatusColor()}
      `}
    >
      {/* Main Card Content */}
      <div
        onClick={onSelect}
        className="p-4 cursor-pointer hover:bg-surface-2 transition-colors rounded-t-lg"
      >
        <div className="flex items-start gap-3">
          {/* Expand Toggle */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleExpand();
            }}
            className="p-1 hover:bg-surface-3 rounded transition-colors mt-0.5"
          >
            {isExpanded ? (
              <ChevronDown className="w-4 h-4 text-text-tertiary" />
            ) : (
              <ChevronRight className="w-4 h-4 text-text-tertiary" />
            )}
          </button>

          {/* Status Icon */}
          <div className="shrink-0 mt-0.5">{getStatusIcon()}</div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <h4 className="text-sm font-medium text-text-primary line-clamp-2">
              {session.intent}
            </h4>
            <div className="flex items-center gap-3 mt-2 text-xs text-text-tertiary">
              <span className="flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                {formatDate(session.createdAt)}
              </span>
              <span className="flex items-center gap-1">
                <ListTodo className="w-3 h-3" />
                {interpretation?.tasks?.length || 0} tasks
              </span>
              <span
                className={`
                px-1.5 py-0.5 rounded-full text-xs
                ${state === 'completed' ? 'bg-green-500/20 text-green-400' : ''}
                ${state === 'executing' ? 'bg-yellow-500/20 text-yellow-400' : ''}
                ${state === 'failed' ? 'bg-red-500/20 text-red-400' : ''}
                ${state === 'ready' ? 'bg-blue-500/20 text-blue-400' : ''}
                ${state === 'idle' ? 'bg-gray-500/20 text-gray-400' : ''}
              `}
              >
                {SESSION_STATE_LABELS[state]}
              </span>
            </div>
          </div>

          {/* Execution Stats */}
          <div className="shrink-0 text-right">
            <div className="flex items-center gap-2 text-xs">
              {execution.completed > 0 && (
                <span className="text-green-400">{execution.completed} done</span>
              )}
              {execution.running > 0 && (
                <span className="text-yellow-400">{execution.running} running</span>
              )}
              {execution.failed > 0 && (
                <span className="text-red-400">{execution.failed} failed</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Expanded Task List */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="border-t border-border-subtle overflow-hidden"
          >
            <div className="p-4 pt-3 space-y-2">
              <p className="text-xs text-text-tertiary mb-2">
                {interpretation?.understood || 'No interpretation available'}
              </p>
              {(interpretation?.tasks || []).map((task) => (
                <TaskRow key={task.id} task={task} />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// Task Row Component (for expanded view)
function TaskRow({ task }: { task: GeneratedTask }) {
  const capability = TASK_TYPE_CAPABILITY[task.type] ?? 'INTERNAL';

  const getStatusDot = () => {
    switch (task.status) {
      case 'completed':
        return 'bg-green-400';
      case 'running':
        return 'bg-yellow-400 animate-pulse';
      case 'failed':
        return 'bg-red-400';
      case 'dispatched':
        return 'bg-blue-400';
      default:
        return 'bg-gray-400';
    }
  };

  const getCapabilityColor = () => {
    const colors: Record<string, string> = {
      PRODUCE: 'text-purple-400',
      GROW: 'text-green-400',
      OPERATE: 'text-orange-400',
      INTERNAL: 'text-gray-400',
    };
    return colors[capability] || colors.INTERNAL;
  };

  return (
    <div className="flex items-center gap-3 py-1.5 px-2 rounded hover:bg-surface-2 transition-colors">
      <span className={`w-2 h-2 rounded-full ${getStatusDot()}`} />
      <span className={`text-xs font-medium ${getCapabilityColor()}`}>{capability}</span>
      <span className="text-xs text-text-secondary flex-1 truncate">{task.title}</span>
      <span className="text-xs text-text-tertiary">{TASK_STATUS_LABELS[task.status]}</span>
    </div>
  );
}

// Workflow Detail Panel Component
interface WorkflowDetailPanelProps {
  session: OrchestrationSession;
  onClose: () => void;
}

function WorkflowDetailPanel({ session, onClose }: WorkflowDetailPanelProps) {
  const state = getSessionState(session);
  const { interpretation, execution } = session;

  return (
    <Panel
      title="Workflow Details"
      headerActions={
        <button onClick={onClose} className="p-1 hover:bg-surface-2 rounded transition-colors">
          <X className="w-4 h-4 text-text-tertiary" />
        </button>
      }
      className="h-full overflow-auto"
    >
      <div className="space-y-6">
        {/* Intent */}
        <div>
          <h3 className="text-sm font-medium text-text-primary">{session.intent}</h3>
          <p className="text-xs text-text-tertiary mt-1">
            Session: {session.sessionId.substring(0, 20)}...
          </p>
        </div>

        {/* Status & Progress */}
        <div className="bg-surface-2 rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs text-text-tertiary uppercase tracking-wide">Progress</span>
            <span
              className={`
              text-xs px-2 py-0.5 rounded-full
              ${state === 'completed' ? 'bg-green-500/20 text-green-400' : ''}
              ${state === 'executing' ? 'bg-yellow-500/20 text-yellow-400' : ''}
              ${state === 'failed' ? 'bg-red-500/20 text-red-400' : ''}
              ${state === 'ready' ? 'bg-blue-500/20 text-blue-400' : ''}
            `}
            >
              {SESSION_STATE_LABELS[state]}
            </span>
          </div>

          {/* Progress Bar */}
          <div className="h-2 bg-surface-3 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all ${
                state === 'failed' ? 'bg-red-500' : 'bg-green-500'
              }`}
              style={{
                width: `${
                  execution.total > 0 ? ((execution.completed / execution.total) * 100) : 0
                }%`,
              }}
            />
          </div>

          {/* Stats */}
          <div className="flex items-center justify-between mt-3 text-xs">
            <span className="text-text-tertiary">
              {execution.completed} / {execution.total} tasks
            </span>
            {execution.failed > 0 && (
              <span className="text-red-400">{execution.failed} failed</span>
            )}
          </div>
        </div>

        {/* AI Interpretation */}
        <div>
          <h4 className="text-xs text-text-tertiary uppercase tracking-wide mb-2">
            AI Understanding
          </h4>
          <p className="text-sm text-text-secondary">{interpretation?.understood || 'No interpretation'}</p>
          {interpretation?.reasoning && (
            <p className="text-xs text-text-tertiary mt-2 italic">
              "{interpretation.reasoning}"
            </p>
          )}
        </div>

        {/* Warnings */}
        {interpretation?.warnings && interpretation.warnings.length > 0 && (
          <div className="bg-yellow-900/20 border border-yellow-500/30 rounded-lg p-3">
            <h4 className="text-xs text-yellow-400 uppercase tracking-wide mb-2">Warnings</h4>
            <ul className="space-y-1">
              {interpretation.warnings.map((warning, i) => (
                <li key={i} className="text-xs text-yellow-300">
                  {warning}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Tasks */}
        <div>
          <h4 className="text-xs text-text-tertiary uppercase tracking-wide mb-2">
            Tasks ({interpretation?.tasks?.length || 0})
          </h4>
          <div className="space-y-2">
            {(interpretation?.tasks || []).map((task) => (
              <DetailTaskCard key={task.id} task={task} />
            ))}
          </div>
        </div>

        {/* Timeline */}
        <div>
          <h4 className="text-xs text-text-tertiary uppercase tracking-wide mb-2">Timeline</h4>
          <div className="space-y-2 text-xs">
            <TimelineItem
              label="Created"
              time={session.createdAt}
              icon={<Clock className="w-3 h-3" />}
            />
            <TimelineItem
              label="Last Updated"
              time={session.updatedAt}
              icon={<Clock className="w-3 h-3" />}
            />
          </div>
        </div>

        {/* Context (if available) */}
        {session.context && (
          <div>
            <h4 className="text-xs text-text-tertiary uppercase tracking-wide mb-2">Context</h4>
            <div className="bg-surface-2 rounded-lg p-3 text-xs space-y-1">
              {session.context.focus && (
                <p>
                  <span className="text-text-tertiary">Focus:</span>{' '}
                  <span className="text-text-secondary">{session.context.focus}</span>
                </p>
              )}
              {session.context.urgency && (
                <p>
                  <span className="text-text-tertiary">Urgency:</span>{' '}
                  <span className="text-text-secondary">{session.context.urgency}</span>
                </p>
              )}
              {session.context.constraints && (
                <p>
                  <span className="text-text-tertiary">Constraints:</span>{' '}
                  <span className="text-text-secondary">{session.context.constraints}</span>
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </Panel>
  );
}

// Detail Task Card (for detail panel)
function DetailTaskCard({ task }: { task: GeneratedTask }) {
  const capability = TASK_TYPE_CAPABILITY[task.type] ?? 'INTERNAL';

  const getCapabilityColor = (cap: string): string => {
    const colors: Record<string, string> = {
      PRODUCE: 'bg-purple-500/20 text-purple-400',
      GROW: 'bg-green-500/20 text-green-400',
      OPERATE: 'bg-orange-500/20 text-orange-400',
      INTERNAL: 'bg-gray-500/20 text-gray-400',
    };
    return colors[cap] || colors.INTERNAL;
  };

  const getStatusColor = () => {
    switch (task.status) {
      case 'completed':
        return 'bg-green-500/20 text-green-400';
      case 'running':
        return 'bg-yellow-500/20 text-yellow-400';
      case 'failed':
        return 'bg-red-500/20 text-red-400';
      case 'dispatched':
        return 'bg-blue-500/20 text-blue-400';
      default:
        return 'bg-gray-500/20 text-gray-400';
    }
  };

  return (
    <div className="bg-surface-2 rounded-lg p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className={`text-xs px-1.5 py-0.5 rounded ${getCapabilityColor(capability)}`}>
              {capability}
            </span>
            <span className="text-xs text-text-tertiary">
              {TASK_TYPE_LABELS[task.type]}
            </span>
          </div>
          <h5 className="text-sm font-medium text-text-primary">{task.title}</h5>
          <p className="text-xs text-text-tertiary mt-1 line-clamp-2">{task.description}</p>
        </div>
        <span className={`text-xs px-2 py-1 rounded-full shrink-0 ${getStatusColor()}`}>
          {TASK_STATUS_LABELS[task.status]}
        </span>
      </div>

      {/* Error Display */}
      {task.error && (
        <div className="mt-2 pt-2 border-t border-red-500/30">
          <p className="text-xs text-red-400">{task.error}</p>
        </div>
      )}
    </div>
  );
}

// Timeline Item Component
function TimelineItem({
  label,
  time,
  icon,
}: {
  label: string;
  time: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-2 text-text-tertiary">
      {icon}
      <span>{label}:</span>
      <span className="text-text-secondary">{formatDate(time)}</span>
    </div>
  );
}

// Date formatting helper
function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}
