/**
 * QueueView - Unified Task Queue Visualization
 *
 * Displays all tasks across orchestration sessions with filtering,
 * sorting, and detailed task information.
 */

import { useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Filter,
  SortAsc,
  SortDesc,
  Search,
  X,
  Clock,
  CheckCircle,
  AlertCircle,
  Play,
  Pause,
  RefreshCw,
} from 'lucide-react';
import { Panel } from '../shared/Panel';
import { useOrchestrationStore } from '../../stores/orchestration-store';
import { useQueueStore, type QueueTask, type Capability } from '../../stores/queue-store';
import type { OrchTaskStatus, TaskType, Priority } from '../../lib/types/orchestration';
import {
  TASK_TYPE_LABELS,
  PRIORITY_LABELS,
  TASK_STATUS_LABELS,
  TASK_TYPE_CAPABILITY,
} from '../../lib/types/orchestration';

export function QueueView() {
  const { sessions, loadSessions } = useOrchestrationStore();
  const {
    filters,
    sortBy,
    sortOrder,
    selectedTaskId,
    setStatusFilter,
    setTypeFilter,
    setPriorityFilter,
    setCapabilityFilter,
    setSearch,
    clearFilters,
    setSortBy,
    toggleSortOrder,
    selectTask,
    filterTasks,
    sortTasks,
  } = useQueueStore();

  // Aggregate all tasks from all sessions
  const allTasks: QueueTask[] = useMemo(() => {
    return sessions.flatMap((session) =>
      (session.interpretation?.tasks || []).map((task) => ({
        ...task,
        sessionId: session.sessionId,
        sessionIntent: session.intent,
      }))
    );
  }, [sessions]);

  // Apply filters and sorting
  const filteredTasks = useMemo(() => {
    const filtered = filterTasks(allTasks);
    return sortTasks(filtered);
  }, [allTasks, filterTasks, sortTasks]);

  // Task stats
  const stats = useMemo(() => {
    return {
      total: allTasks.length,
      pending: allTasks.filter((t) => t.status === 'pending').length,
      running: allTasks.filter((t) => t.status === 'running' || t.status === 'dispatched').length,
      completed: allTasks.filter((t) => t.status === 'completed').length,
      failed: allTasks.filter((t) => t.status === 'failed').length,
    };
  }, [allTasks]);

  // Get selected task details
  const selectedTask = selectedTaskId
    ? filteredTasks.find((t) => t.id === selectedTaskId)
    : null;

  // Check if any filters are active
  const hasActiveFilters =
    filters.status !== 'all' ||
    filters.type !== 'all' ||
    filters.priority !== 'all' ||
    filters.capability !== 'all' ||
    filters.search !== '';

  return (
    <div className="flex-1 p-6 overflow-hidden flex flex-col">
      <div className="max-w-7xl mx-auto w-full flex-1 flex flex-col space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-text-primary">Task Queue</h1>
            <p className="text-sm text-text-tertiary mt-1">
              {filteredTasks.length} of {allTasks.length} tasks
            </p>
          </div>

          <button
            onClick={() => loadSessions()}
            className="flex items-center gap-2 px-3 py-2 text-sm text-text-secondary hover:text-text-primary hover:bg-surface-2 rounded-md transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
        </div>

        {/* Stats Bar */}
        <div className="grid grid-cols-5 gap-3">
          <StatCard
            label="Total"
            value={stats.total}
            icon={<Clock className="w-4 h-4" />}
            onClick={() => setStatusFilter('all')}
            active={filters.status === 'all'}
          />
          <StatCard
            label="Pending"
            value={stats.pending}
            icon={<Pause className="w-4 h-4" />}
            color="text-gray-400"
            onClick={() => setStatusFilter('pending')}
            active={filters.status === 'pending'}
          />
          <StatCard
            label="Running"
            value={stats.running}
            icon={<Play className="w-4 h-4" />}
            color="text-yellow-400"
            onClick={() => setStatusFilter('running')}
            active={filters.status === 'running'}
          />
          <StatCard
            label="Completed"
            value={stats.completed}
            icon={<CheckCircle className="w-4 h-4" />}
            color="text-green-400"
            onClick={() => setStatusFilter('completed')}
            active={filters.status === 'completed'}
          />
          <StatCard
            label="Failed"
            value={stats.failed}
            icon={<AlertCircle className="w-4 h-4" />}
            color="text-red-400"
            onClick={() => setStatusFilter('failed')}
            active={filters.status === 'failed'}
          />
        </div>

        {/* Filters Bar */}
        <Panel className="!p-3">
          <div className="flex items-center gap-4 flex-wrap">
            {/* Search */}
            <div className="relative flex-1 min-w-[200px] max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-tertiary" />
              <input
                type="text"
                placeholder="Search tasks..."
                value={filters.search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-surface-2 border border-border-subtle rounded-md text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-accent-primary"
              />
            </div>

            {/* Type Filter */}
            <FilterSelect
              label="Type"
              value={filters.type}
              onChange={(v) => setTypeFilter(v as TaskType | 'all')}
              options={[
                { value: 'all', label: 'All Types' },
                { value: 'bugfix', label: 'Bug Fix' },
                { value: 'content', label: 'Content' },
                { value: 'support', label: 'Support' },
                { value: 'analysis', label: 'Analysis' },
                { value: 'review', label: 'Review' },
              ]}
            />

            {/* Priority Filter */}
            <FilterSelect
              label="Priority"
              value={filters.priority}
              onChange={(v) => setPriorityFilter(v as Priority | 'all')}
              options={[
                { value: 'all', label: 'All Priorities' },
                { value: 'high', label: 'High' },
                { value: 'medium', label: 'Medium' },
                { value: 'low', label: 'Low' },
              ]}
            />

            {/* Capability Filter */}
            <FilterSelect
              label="Capability"
              value={filters.capability}
              onChange={(v) => setCapabilityFilter(v as Capability)}
              options={[
                { value: 'all', label: 'All Capabilities' },
                { value: 'PRODUCE', label: 'PRODUCE' },
                { value: 'GROW', label: 'GROW' },
                { value: 'OPERATE', label: 'OPERATE' },
                { value: 'INTERNAL', label: 'INTERNAL' },
              ]}
            />

            {/* Sort */}
            <div className="flex items-center gap-2">
              <FilterSelect
                label="Sort"
                value={sortBy}
                onChange={(v) => setSortBy(v as typeof sortBy)}
                options={[
                  { value: 'priority', label: 'Priority' },
                  { value: 'status', label: 'Status' },
                  { value: 'type', label: 'Type' },
                  { value: 'created', label: 'Created' },
                ]}
              />
              <button
                onClick={toggleSortOrder}
                className="p-2 hover:bg-surface-2 rounded-md transition-colors"
                title={sortOrder === 'asc' ? 'Ascending' : 'Descending'}
              >
                {sortOrder === 'asc' ? (
                  <SortAsc className="w-4 h-4 text-text-secondary" />
                ) : (
                  <SortDesc className="w-4 h-4 text-text-secondary" />
                )}
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
          </div>
        </Panel>

        {/* Main Content */}
        <div className="flex-1 flex gap-4 min-h-0">
          {/* Task List */}
          <div className="flex-1 overflow-auto">
            <div className="space-y-2">
              <AnimatePresence mode="popLayout">
                {filteredTasks.length === 0 ? (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="flex flex-col items-center justify-center py-12 text-text-tertiary"
                  >
                    <Filter className="w-12 h-12 mb-3 opacity-50" />
                    <p className="text-sm">No tasks match your filters</p>
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
                  filteredTasks.map((task) => (
                    <QueueTaskCard
                      key={task.id}
                      task={task}
                      isSelected={selectedTaskId === task.id}
                      onClick={() => selectTask(selectedTaskId === task.id ? null : task.id)}
                    />
                  ))
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* Task Detail Panel */}
          <AnimatePresence>
            {selectedTask && (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="w-96 shrink-0"
              >
                <TaskDetailPanel task={selectedTask} onClose={() => selectTask(null)} />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

// Stat Card Component
interface StatCardProps {
  label: string;
  value: number;
  icon: React.ReactNode;
  color?: string;
  onClick: () => void;
  active: boolean;
}

function StatCard({ label, value, icon, color = 'text-text-primary', onClick, active }: StatCardProps) {
  return (
    <button
      onClick={onClick}
      className={`
        p-3 rounded-lg border transition-all
        ${active
          ? 'bg-surface-2 border-accent-primary/50'
          : 'bg-surface-1 border-border-subtle hover:border-border-default'
        }
      `}
    >
      <div className="flex items-center gap-2">
        <span className={color}>{icon}</span>
        <span className="text-2xl font-semibold text-text-primary">{value}</span>
      </div>
      <p className="text-xs text-text-tertiary mt-1 text-left">{label}</p>
    </button>
  );
}

// Filter Select Component
interface FilterSelectProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
}

function FilterSelect({ label, value, onChange, options }: FilterSelectProps) {
  return (
    <div className="flex items-center gap-2">
      <label className="text-xs text-text-tertiary">{label}:</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="bg-surface-2 border border-border-subtle rounded-md px-2 py-1.5 text-sm text-text-primary focus:outline-none focus:border-accent-primary"
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}

// Queue Task Card Component
interface QueueTaskCardProps {
  task: QueueTask;
  isSelected: boolean;
  onClick: () => void;
}

function QueueTaskCard({ task, isSelected, onClick }: QueueTaskCardProps) {
  const capability = TASK_TYPE_CAPABILITY[task.type] ?? 'INTERNAL';
  const isActive = task.status === 'running' || task.status === 'dispatched';

  const getStatusColor = (status: OrchTaskStatus): string => {
    const colors: Record<OrchTaskStatus, string> = {
      pending: 'bg-gray-500/20 text-gray-400',
      dispatched: 'bg-blue-500/20 text-blue-400',
      running: 'bg-yellow-500/20 text-yellow-400',
      completed: 'bg-green-500/20 text-green-400',
      failed: 'bg-red-500/20 text-red-400',
    };
    return colors[status];
  };

  const getPriorityColor = (priority: Priority): string => {
    const colors: Record<Priority, string> = {
      high: 'text-red-400',
      medium: 'text-yellow-400',
      low: 'text-gray-400',
    };
    return colors[priority];
  };

  const getCapabilityColor = (cap: string): string => {
    const colors: Record<string, string> = {
      PRODUCE: 'bg-purple-500/20 text-purple-400',
      GROW: 'bg-green-500/20 text-green-400',
      OPERATE: 'bg-orange-500/20 text-orange-400',
      INTERNAL: 'bg-gray-500/20 text-gray-400',
    };
    return colors[cap] || colors.INTERNAL;
  };

  const borderClass = isSelected
    ? 'border-accent-primary'
    : isActive
    ? 'border-blue-500/50'
    : task.status === 'completed'
    ? 'border-green-500/30'
    : task.status === 'failed'
    ? 'border-red-500/30'
    : 'border-transparent';

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      onClick={onClick}
      className={`
        bg-surface-1 rounded-lg p-4 border cursor-pointer transition-all
        hover:bg-surface-2 ${borderClass}
      `}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          {/* Badges Row */}
          <div className="flex items-center gap-2 flex-wrap mb-2">
            <span className={`text-xs px-1.5 py-0.5 rounded ${getCapabilityColor(capability)}`}>
              {capability}
            </span>
            <span className="text-xs text-text-tertiary">
              {TASK_TYPE_LABELS[task.type] ?? task.type}
            </span>
            <span className={`text-xs ${getPriorityColor(task.priority)}`}>
              {task.priority === 'high' ? '●' : task.priority === 'medium' ? '○' : '◦'}{' '}
              {PRIORITY_LABELS[task.priority]}
            </span>
          </div>

          {/* Title */}
          <h4 className="text-sm font-medium text-text-primary truncate">{task.title}</h4>

          {/* Description */}
          <p className="text-xs text-text-tertiary mt-1 line-clamp-1">{task.description}</p>

          {/* Session Intent */}
          <p className="text-xs text-text-tertiary/70 mt-2 truncate">
            From: {task.sessionIntent}
          </p>
        </div>

        {/* Status Badge */}
        <div className="shrink-0">
          <span className={`text-xs px-2 py-1 rounded-full ${getStatusColor(task.status)}`}>
            {task.status === 'running' && <span className="animate-pulse mr-1">●</span>}
            {TASK_STATUS_LABELS[task.status]}
          </span>
        </div>
      </div>
    </motion.div>
  );
}

// Task Detail Panel Component
interface TaskDetailPanelProps {
  task: QueueTask;
  onClose: () => void;
}

function TaskDetailPanel({ task, onClose }: TaskDetailPanelProps) {
  const capability = TASK_TYPE_CAPABILITY[task.type] ?? 'INTERNAL';

  const getCapabilityColor = (cap: string): string => {
    const colors: Record<string, string> = {
      PRODUCE: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
      GROW: 'bg-green-500/20 text-green-400 border-green-500/30',
      OPERATE: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
      INTERNAL: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
    };
    return colors[cap] || colors.INTERNAL;
  };

  const getStatusColor = (status: OrchTaskStatus): string => {
    const colors: Record<OrchTaskStatus, string> = {
      pending: 'text-gray-400',
      dispatched: 'text-blue-400',
      running: 'text-yellow-400',
      completed: 'text-green-400',
      failed: 'text-red-400',
    };
    return colors[status];
  };

  return (
    <Panel
      title="Task Details"
      headerActions={
        <button
          onClick={onClose}
          className="p-1 hover:bg-surface-2 rounded transition-colors"
        >
          <X className="w-4 h-4 text-text-tertiary" />
        </button>
      }
      className="h-full overflow-auto"
    >
      <div className="space-y-4">
        {/* Capability Badge */}
        <div className={`inline-block px-3 py-1 rounded-full border ${getCapabilityColor(capability)}`}>
          {capability}
        </div>

        {/* Title & Type */}
        <div>
          <h3 className="text-lg font-medium text-text-primary">{task.title}</h3>
          <p className="text-sm text-text-tertiary mt-1">
            {TASK_TYPE_LABELS[task.type]} Task
          </p>
        </div>

        {/* Status & Priority */}
        <div className="flex gap-4">
          <div>
            <p className="text-xs text-text-tertiary uppercase tracking-wide">Status</p>
            <p className={`text-sm font-medium mt-1 ${getStatusColor(task.status)}`}>
              {TASK_STATUS_LABELS[task.status]}
            </p>
          </div>
          <div>
            <p className="text-xs text-text-tertiary uppercase tracking-wide">Priority</p>
            <p className="text-sm font-medium mt-1 text-text-primary">
              {PRIORITY_LABELS[task.priority]}
            </p>
          </div>
        </div>

        {/* Description */}
        <div>
          <p className="text-xs text-text-tertiary uppercase tracking-wide">Description</p>
          <p className="text-sm text-text-secondary mt-1">{task.description}</p>
        </div>

        {/* Session Context */}
        <div>
          <p className="text-xs text-text-tertiary uppercase tracking-wide">Session Intent</p>
          <p className="text-sm text-text-secondary mt-1">{task.sessionIntent}</p>
        </div>

        {/* Parameters */}
        {Object.keys(task.parameters).length > 0 && (
          <div>
            <p className="text-xs text-text-tertiary uppercase tracking-wide mb-2">Parameters</p>
            <div className="bg-surface-2 rounded-md p-3">
              <pre className="text-xs text-text-secondary overflow-auto">
                {JSON.stringify(task.parameters, null, 2)}
              </pre>
            </div>
          </div>
        )}

        {/* Timing Info */}
        <div className="pt-3 border-t border-border-subtle">
          {task.startedAt && (
            <p className="text-xs text-text-tertiary">
              Started: {new Date(task.startedAt).toLocaleString()}
            </p>
          )}
          {task.completedAt && (
            <p className="text-xs text-text-tertiary">
              Completed: {new Date(task.completedAt).toLocaleString()}
            </p>
          )}
        </div>

        {/* Result */}
        {task.result !== undefined && (
          <div>
            <p className="text-xs text-text-tertiary uppercase tracking-wide mb-2">Result</p>
            <div className="bg-surface-2 rounded-md p-3">
              <pre className="text-xs text-text-secondary overflow-auto max-h-40">
                {JSON.stringify(task.result, null, 2)}
              </pre>
            </div>
          </div>
        )}

        {/* Error */}
        {task.error && (
          <div>
            <p className="text-xs text-red-400 uppercase tracking-wide mb-2">Error</p>
            <div className="bg-red-900/20 border border-red-500/30 rounded-md p-3">
              <p className="text-sm text-red-400">{task.error}</p>
            </div>
          </div>
        )}
      </div>
    </Panel>
  );
}
