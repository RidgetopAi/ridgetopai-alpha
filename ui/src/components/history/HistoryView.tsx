/**
 * HistoryView - Completed Workflows Timeline
 *
 * Shows completed orchestration sessions in a timeline format with:
 * - Time-based grouping (Today, Yesterday, This Week, Earlier)
 * - Aggregate success metrics
 * - Capability breakdown statistics
 * - Detailed view of selected session outcomes
 */

import { useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  History,
  Clock,
  CheckCircle,
  XCircle,
  Search,
  Calendar,
  ChevronRight,
  TrendingUp,
  BarChart3,
  X,
  ListTodo,
  Target,
} from 'lucide-react';
import { Panel } from '../shared/Panel';
import { useOrchestrationStore } from '../../stores/orchestration-store';
import { useHistoryStore } from '../../stores/history-store';
import type {
  OrchestrationSession,
  GeneratedTask,
} from '../../lib/types/orchestration';
import {
  TASK_TYPE_LABELS,
  TASK_TYPE_CAPABILITY,
  TASK_STATUS_LABELS,
} from '../../lib/types/orchestration';

// Time group labels
type TimeGroup = 'today' | 'yesterday' | 'thisWeek' | 'thisMonth' | 'earlier';

const TIME_GROUP_LABELS: Record<TimeGroup, string> = {
  today: 'Today',
  yesterday: 'Yesterday',
  thisWeek: 'This Week',
  thisMonth: 'This Month',
  earlier: 'Earlier',
};

export function HistoryView() {
  const { sessions } = useOrchestrationStore();
  const {
    selectedSessionId,
    timeRange,
    searchQuery,
    includeFailedOnly,
    selectSession,
    setTimeRange,
    setSearchQuery,
    setIncludeFailedOnly,
    clearFilters,
  } = useHistoryStore();

  // Filter to only completed/failed sessions
  const completedSessions = useMemo(() => {
    return sessions.filter((session) => {
      const { execution } = session;
      const allDone = execution.pending === 0 && execution.running === 0;
      return allDone && execution.total > 0;
    });
  }, [sessions]);

  // Apply filters
  const filteredSessions = useMemo(() => {
    let result = [...completedSessions];

    // Apply time range filter
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfWeek = new Date(startOfDay);
    startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    if (timeRange !== 'all') {
      result = result.filter((session) => {
        const sessionDate = new Date(session.createdAt);
        switch (timeRange) {
          case 'today':
            return sessionDate >= startOfDay;
          case 'week':
            return sessionDate >= startOfWeek;
          case 'month':
            return sessionDate >= startOfMonth;
          default:
            return true;
        }
      });
    }

    // Apply failed-only filter
    if (includeFailedOnly) {
      result = result.filter((session) => session.execution.failed > 0);
    }

    // Apply search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (session) =>
          session.intent.toLowerCase().includes(query) ||
          session.interpretation.understood.toLowerCase().includes(query)
      );
    }

    // Sort by date (newest first)
    result.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return result;
  }, [completedSessions, timeRange, searchQuery, includeFailedOnly]);

  // Group sessions by time
  const groupedSessions = useMemo(() => {
    const groups: Record<TimeGroup, OrchestrationSession[]> = {
      today: [],
      yesterday: [],
      thisWeek: [],
      thisMonth: [],
      earlier: [],
    };

    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfYesterday = new Date(startOfDay);
    startOfYesterday.setDate(startOfYesterday.getDate() - 1);
    const startOfWeek = new Date(startOfDay);
    startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    filteredSessions.forEach((session) => {
      const sessionDate = new Date(session.createdAt);

      if (sessionDate >= startOfDay) {
        groups.today.push(session);
      } else if (sessionDate >= startOfYesterday) {
        groups.yesterday.push(session);
      } else if (sessionDate >= startOfWeek) {
        groups.thisWeek.push(session);
      } else if (sessionDate >= startOfMonth) {
        groups.thisMonth.push(session);
      } else {
        groups.earlier.push(session);
      }
    });

    return groups;
  }, [filteredSessions]);

  // Selected session
  const selectedSession = selectedSessionId
    ? completedSessions.find((s) => s.sessionId === selectedSessionId)
    : null;

  // Aggregate statistics
  const stats = useMemo(() => {
    const successful = filteredSessions.filter((s) => s.execution.failed === 0).length;
    const failed = filteredSessions.filter((s) => s.execution.failed > 0).length;
    const totalTasks = filteredSessions.reduce(
      (sum, s) => sum + s.interpretation.tasks.length,
      0
    );
    const completedTasks = filteredSessions.reduce(
      (sum, s) => sum + s.execution.completed,
      0
    );

    // Capability breakdown
    const capabilityBreakdown: Record<string, number> = {
      PRODUCE: 0,
      GROW: 0,
      OPERATE: 0,
      INTERNAL: 0,
    };

    filteredSessions.forEach((session) => {
      session.interpretation.tasks.forEach((task) => {
        const capability = TASK_TYPE_CAPABILITY[task.type] ?? 'INTERNAL';
        capabilityBreakdown[capability]++;
      });
    });

    return {
      total: filteredSessions.length,
      successful,
      failed,
      successRate: filteredSessions.length > 0
        ? Math.round((successful / filteredSessions.length) * 100)
        : 0,
      totalTasks,
      completedTasks,
      capabilityBreakdown,
    };
  }, [filteredSessions]);

  const hasActiveFilters = timeRange !== 'all' || searchQuery !== '' || includeFailedOnly;

  return (
    <div className="flex-1 p-6 overflow-hidden flex flex-col">
      <div className="max-w-7xl mx-auto w-full flex-1 flex flex-col space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-text-primary flex items-center gap-2">
              <History className="w-5 h-5 text-accent-primary" />
              Workflow History
            </h1>
            <p className="text-sm text-text-tertiary mt-1">
              {filteredSessions.length} completed workflow{filteredSessions.length !== 1 ? 's' : ''}
            </p>
          </div>
        </div>

        {/* Stats Bar */}
        <Panel className="!p-4">
          <div className="flex items-center gap-6 flex-wrap">
            {/* Success Rate */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-green-500/20 rounded-lg flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-green-400" />
              </div>
              <div>
                <p className="text-lg font-semibold text-green-400">{stats.successRate}%</p>
                <p className="text-xs text-text-tertiary">Success Rate</p>
              </div>
            </div>

            {/* Divider */}
            <div className="h-10 w-px bg-border-subtle" />

            {/* Workflow Stats */}
            <div className="flex items-center gap-4">
              <StatChip
                label="Successful"
                value={stats.successful}
                color="text-green-400"
                onClick={() => setIncludeFailedOnly(false)}
                active={!includeFailedOnly}
              />
              <StatChip
                label="Failed"
                value={stats.failed}
                color="text-red-400"
                onClick={() => setIncludeFailedOnly(true)}
                active={includeFailedOnly}
              />
            </div>

            {/* Divider */}
            <div className="h-10 w-px bg-border-subtle" />

            {/* Task Stats */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-accent-primary/20 rounded-lg flex items-center justify-center">
                <ListTodo className="w-5 h-5 text-accent-primary" />
              </div>
              <div>
                <p className="text-lg font-semibold text-text-primary">
                  {stats.completedTasks}/{stats.totalTasks}
                </p>
                <p className="text-xs text-text-tertiary">Tasks Completed</p>
              </div>
            </div>

            {/* Divider */}
            <div className="h-10 w-px bg-border-subtle" />

            {/* Capability Breakdown */}
            <div className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-text-tertiary" />
              <div className="flex items-center gap-2">
                {stats.capabilityBreakdown.PRODUCE > 0 && (
                  <span className="text-xs px-2 py-1 rounded bg-purple-500/20 text-purple-400">
                    {stats.capabilityBreakdown.PRODUCE} PRODUCE
                  </span>
                )}
                {stats.capabilityBreakdown.GROW > 0 && (
                  <span className="text-xs px-2 py-1 rounded bg-green-500/20 text-green-400">
                    {stats.capabilityBreakdown.GROW} GROW
                  </span>
                )}
                {stats.capabilityBreakdown.OPERATE > 0 && (
                  <span className="text-xs px-2 py-1 rounded bg-orange-500/20 text-orange-400">
                    {stats.capabilityBreakdown.OPERATE} OPERATE
                  </span>
                )}
              </div>
            </div>
          </div>
        </Panel>

        {/* Filters Bar */}
        <div className="flex items-center gap-4 flex-wrap">
          {/* Search */}
          <div className="relative flex-1 min-w-[200px] max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-tertiary" />
            <input
              type="text"
              placeholder="Search completed workflows..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-surface-1 border border-border-subtle rounded-md text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-accent-primary"
            />
          </div>

          {/* Time Range Filter */}
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-text-tertiary" />
            <select
              value={timeRange}
              onChange={(e) => setTimeRange(e.target.value as typeof timeRange)}
              className="bg-surface-1 border border-border-subtle rounded-md px-2 py-1.5 text-sm text-text-primary focus:outline-none focus:border-accent-primary"
            >
              <option value="all">All Time</option>
              <option value="today">Today</option>
              <option value="week">This Week</option>
              <option value="month">This Month</option>
            </select>
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
        </div>

        {/* Main Content */}
        <div className="flex-1 flex gap-4 min-h-0">
          {/* Timeline */}
          <div className="flex-1 overflow-auto">
            <div className="space-y-6">
              {filteredSessions.length === 0 ? (
                <EmptyState hasFilters={hasActiveFilters} onClear={clearFilters} />
              ) : (
                Object.entries(groupedSessions).map(([group, sessions]) => {
                  if (sessions.length === 0) return null;
                  return (
                    <TimelineGroup
                      key={group}
                      label={TIME_GROUP_LABELS[group as TimeGroup]}
                      sessions={sessions}
                      selectedId={selectedSessionId}
                      onSelect={selectSession}
                    />
                  );
                })
              )}
            </div>
          </div>

          {/* Detail Panel */}
          <AnimatePresence>
            {selectedSession && (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="w-[400px] shrink-0"
              >
                <HistoryDetailPanel
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

// Stat Chip Component
function StatChip({
  label,
  value,
  color,
  onClick,
  active,
}: {
  label: string;
  value: number;
  color: string;
  onClick: () => void;
  active: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`
        flex items-center gap-2 px-3 py-1.5 rounded-lg transition-colors
        ${active ? 'bg-surface-2' : 'hover:bg-surface-2'}
      `}
    >
      <span className={`text-lg font-semibold ${color}`}>{value}</span>
      <span className="text-xs text-text-tertiary">{label}</span>
    </button>
  );
}

// Timeline Group Component
function TimelineGroup({
  label,
  sessions,
  selectedId,
  onSelect,
}: {
  label: string;
  sessions: OrchestrationSession[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}) {
  return (
    <div>
      {/* Group Header */}
      <div className="flex items-center gap-3 mb-3">
        <div className="w-2 h-2 bg-accent-primary rounded-full" />
        <h3 className="text-sm font-medium text-text-primary">{label}</h3>
        <span className="text-xs text-text-tertiary">
          {sessions.length} workflow{sessions.length !== 1 ? 's' : ''}
        </span>
        <div className="flex-1 h-px bg-border-subtle" />
      </div>

      {/* Session Cards */}
      <div className="space-y-2 pl-5 border-l border-border-subtle ml-1">
        <AnimatePresence mode="popLayout">
          {sessions.map((session) => (
            <HistoryCard
              key={session.sessionId}
              session={session}
              isSelected={selectedId === session.sessionId}
              onSelect={() =>
                onSelect(selectedId === session.sessionId ? null : session.sessionId)
              }
            />
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}

// History Card Component
function HistoryCard({
  session,
  isSelected,
  onSelect,
}: {
  session: OrchestrationSession;
  isSelected: boolean;
  onSelect: () => void;
}) {
  const { execution, interpretation } = session;
  const isSuccess = execution.failed === 0;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -10 }}
      onClick={onSelect}
      className={`
        relative bg-surface-1 rounded-lg p-4 cursor-pointer transition-all
        border hover:bg-surface-2
        ${isSelected ? 'border-accent-primary' : isSuccess ? 'border-green-500/20' : 'border-red-500/20'}
      `}
    >
      {/* Timeline dot */}
      <div
        className={`
          absolute -left-[21px] top-5 w-3 h-3 rounded-full border-2 border-surface-0
          ${isSuccess ? 'bg-green-500' : 'bg-red-500'}
        `}
      />

      <div className="flex items-start gap-3">
        {/* Status Icon */}
        <div className={`shrink-0 mt-0.5 ${isSuccess ? 'text-green-400' : 'text-red-400'}`}>
          {isSuccess ? <CheckCircle className="w-5 h-5" /> : <XCircle className="w-5 h-5" />}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-medium text-text-primary line-clamp-2">
            {session.intent}
          </h4>

          <div className="flex items-center gap-3 mt-2 text-xs text-text-tertiary">
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {formatTime(session.createdAt)}
            </span>
            <span className="flex items-center gap-1">
              <Target className="w-3 h-3" />
              {execution.completed}/{interpretation.tasks.length} tasks
            </span>
            {execution.failed > 0 && (
              <span className="text-red-400">{execution.failed} failed</span>
            )}
          </div>

          {/* Capability Tags */}
          <div className="flex items-center gap-1 mt-2">
            {getCapabilityTags(interpretation.tasks).map((cap) => (
              <span
                key={cap.name}
                className={`text-xs px-1.5 py-0.5 rounded ${cap.color}`}
              >
                {cap.count} {cap.name}
              </span>
            ))}
          </div>
        </div>

        {/* Arrow */}
        <ChevronRight
          className={`w-4 h-4 shrink-0 transition-transform ${
            isSelected ? 'text-accent-primary rotate-90' : 'text-text-tertiary'
          }`}
        />
      </div>
    </motion.div>
  );
}

// History Detail Panel
function HistoryDetailPanel({
  session,
  onClose,
}: {
  session: OrchestrationSession;
  onClose: () => void;
}) {
  const { execution, interpretation } = session;
  const isSuccess = execution.failed === 0;

  return (
    <Panel
      title="Workflow Summary"
      headerActions={
        <button onClick={onClose} className="p-1 hover:bg-surface-2 rounded transition-colors">
          <X className="w-4 h-4 text-text-tertiary" />
        </button>
      }
      className="h-full overflow-auto"
    >
      <div className="space-y-6">
        {/* Status Banner */}
        <div
          className={`
            p-4 rounded-lg flex items-center gap-3
            ${isSuccess ? 'bg-green-500/10 border border-green-500/30' : 'bg-red-500/10 border border-red-500/30'}
          `}
        >
          {isSuccess ? (
            <CheckCircle className="w-6 h-6 text-green-400" />
          ) : (
            <XCircle className="w-6 h-6 text-red-400" />
          )}
          <div>
            <p className={`font-medium ${isSuccess ? 'text-green-400' : 'text-red-400'}`}>
              {isSuccess ? 'Completed Successfully' : 'Completed with Errors'}
            </p>
            <p className="text-xs text-text-tertiary">
              {execution.completed} of {interpretation.tasks.length} tasks completed
            </p>
          </div>
        </div>

        {/* Intent */}
        <div>
          <h3 className="text-sm font-medium text-text-primary">{session.intent}</h3>
          <p className="text-xs text-text-tertiary mt-2">
            {interpretation.understood}
          </p>
        </div>

        {/* Timeline */}
        <div className="bg-surface-2 rounded-lg p-3">
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-2 text-text-tertiary">
              <Clock className="w-3 h-3" />
              <span>Started</span>
            </div>
            <span className="text-text-secondary">{formatDateTime(session.createdAt)}</span>
          </div>
          <div className="flex items-center justify-between text-xs mt-2">
            <div className="flex items-center gap-2 text-text-tertiary">
              <CheckCircle className="w-3 h-3" />
              <span>Completed</span>
            </div>
            <span className="text-text-secondary">{formatDateTime(session.updatedAt)}</span>
          </div>
        </div>

        {/* Tasks */}
        <div>
          <h4 className="text-xs text-text-tertiary uppercase tracking-wide mb-3">
            Tasks ({interpretation.tasks.length})
          </h4>
          <div className="space-y-2">
            {interpretation.tasks.map((task) => (
              <TaskSummaryCard key={task.id} task={task} />
            ))}
          </div>
        </div>

        {/* Session ID */}
        <div className="pt-4 border-t border-border-subtle">
          <p className="text-xs text-text-tertiary">
            Session: {session.sessionId.substring(0, 30)}...
          </p>
        </div>
      </div>
    </Panel>
  );
}

// Task Summary Card
function TaskSummaryCard({ task }: { task: GeneratedTask }) {
  const capability = TASK_TYPE_CAPABILITY[task.type] ?? 'INTERNAL';
  const isCompleted = task.status === 'completed';
  const isFailed = task.status === 'failed';

  const getCapabilityColor = (cap: string): string => {
    const colors: Record<string, string> = {
      PRODUCE: 'bg-purple-500/20 text-purple-400',
      GROW: 'bg-green-500/20 text-green-400',
      OPERATE: 'bg-orange-500/20 text-orange-400',
      INTERNAL: 'bg-gray-500/20 text-gray-400',
    };
    return colors[cap] || colors.INTERNAL;
  };

  return (
    <div
      className={`
        bg-surface-2 rounded-lg p-3 border
        ${isFailed ? 'border-red-500/30' : 'border-transparent'}
      `}
    >
      <div className="flex items-start gap-2">
        <div className="shrink-0 mt-0.5">
          {isCompleted ? (
            <CheckCircle className="w-4 h-4 text-green-400" />
          ) : isFailed ? (
            <XCircle className="w-4 h-4 text-red-400" />
          ) : (
            <Clock className="w-4 h-4 text-text-tertiary" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className={`text-xs px-1.5 py-0.5 rounded ${getCapabilityColor(capability)}`}>
              {capability}
            </span>
            <span className="text-xs text-text-tertiary">
              {TASK_TYPE_LABELS[task.type]}
            </span>
          </div>
          <p className="text-sm text-text-primary">{task.title}</p>
          {task.error && (
            <p className="text-xs text-red-400 mt-1">{task.error}</p>
          )}
        </div>
        <span
          className={`
            text-xs px-2 py-0.5 rounded-full shrink-0
            ${isCompleted ? 'bg-green-500/20 text-green-400' : ''}
            ${isFailed ? 'bg-red-500/20 text-red-400' : ''}
            ${!isCompleted && !isFailed ? 'bg-gray-500/20 text-gray-400' : ''}
          `}
        >
          {TASK_STATUS_LABELS[task.status]}
        </span>
      </div>
    </div>
  );
}

// Empty State
function EmptyState({
  hasFilters,
  onClear,
}: {
  hasFilters: boolean;
  onClear: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-text-tertiary">
      <History className="w-16 h-16 mb-4 opacity-50" />
      <h3 className="text-lg font-medium text-text-secondary mb-1">No Completed Workflows</h3>
      <p className="text-sm text-center max-w-md">
        {hasFilters
          ? 'No workflows match your current filters.'
          : 'Completed workflows will appear here once orchestration sessions finish executing.'}
      </p>
      {hasFilters && (
        <button
          onClick={onClear}
          className="mt-4 text-sm text-accent-primary hover:underline"
        >
          Clear all filters
        </button>
      )}
    </div>
  );
}

// Helper: Format time (relative)
function formatTime(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

// Helper: Format date/time (full)
function formatDateTime(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

// Helper: Get capability tags from tasks
function getCapabilityTags(tasks: GeneratedTask[]) {
  const counts: Record<string, number> = {};

  tasks.forEach((task) => {
    const capability = TASK_TYPE_CAPABILITY[task.type] ?? 'INTERNAL';
    counts[capability] = (counts[capability] || 0) + 1;
  });

  const colors: Record<string, string> = {
    PRODUCE: 'bg-purple-500/20 text-purple-400',
    GROW: 'bg-green-500/20 text-green-400',
    OPERATE: 'bg-orange-500/20 text-orange-400',
    INTERNAL: 'bg-gray-500/20 text-gray-400',
  };

  return Object.entries(counts)
    .filter(([name]) => name !== 'INTERNAL')
    .map(([name, count]) => ({
      name,
      count,
      color: colors[name],
    }));
}
