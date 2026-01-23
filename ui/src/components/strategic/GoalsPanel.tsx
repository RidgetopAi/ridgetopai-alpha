/**
 * GoalsPanel - Main container for goals view
 * Phase 3: Goal Management UI
 */

import { useEffect, useState } from 'react';
import { useGoalsStore } from '../../stores/goals-store';
import { GoalCard } from './GoalCard';
import { GoalProgressBar } from './GoalProgressBar';
import { CreateGoalModal, UpdateProgressModal } from './CreateGoalModal';
import type {
  GoalCategory,
  GoalPriority,
  GoalStatus,
  CreateGoalInput,
  UpdateGoalInput,
} from '../../lib/types/strategic';

export function GoalsPanel() {
  const {
    goals,
    selectedGoal,
    stats,
    progress,
    isLoading,
    error,
    showCreateModal,
    showEditModal,
    showDeleteModal,
    modalGoalId,
    loadGoals,
    loadStats,
    loadGoal,
    setFilters,
    clearFilters,
    createGoal,
    updateGoal,
    updateProgress,
    deleteGoal,
    openCreateModal,
    openEditModal,
    openDeleteModal,
    openDetailsModal,
    closeModals,
    clearError,
  } = useGoalsStore();

  // Local state for filter dropdowns
  const [statusFilter, setStatusFilter] = useState<GoalStatus | ''>('');
  const [categoryFilter, setCategoryFilter] = useState<GoalCategory | ''>('');
  const [priorityFilter, setPriorityFilter] = useState<GoalPriority | ''>('');

  // State for update progress modal
  const [showProgressModal, setShowProgressModal] = useState(false);
  const [progressGoalId, setProgressGoalId] = useState<string | null>(null);

  // State for delete confirmation
  const [deleteReason, setDeleteReason] = useState('');

  // Load data on mount
  useEffect(() => {
    loadGoals();
    loadStats();
  }, [loadGoals, loadStats]);

  // Handle filter changes
  const handleFilterChange = (
    type: 'status' | 'category' | 'priority',
    value: string
  ) => {
    const newFilters: Record<string, string | undefined> = {};

    if (type === 'status') {
      setStatusFilter(value as GoalStatus | '');
      newFilters.status = value || undefined;
    } else if (type === 'category') {
      setCategoryFilter(value as GoalCategory | '');
      newFilters.category = value || undefined;
    } else if (type === 'priority') {
      setPriorityFilter(value as GoalPriority | '');
      newFilters.priority = value || undefined;
    }

    setFilters(newFilters);
  };

  const handleClearFilters = () => {
    setStatusFilter('');
    setCategoryFilter('');
    setPriorityFilter('');
    clearFilters();
  };

  // Handle create goal
  const handleCreate = async (input: CreateGoalInput | UpdateGoalInput) => {
    await createGoal(input as CreateGoalInput);
  };

  // Handle edit goal
  const handleEdit = async (input: CreateGoalInput | UpdateGoalInput) => {
    if (!modalGoalId) return;
    await updateGoal(modalGoalId, input as UpdateGoalInput);
  };

  // Handle update progress
  const handleOpenProgressModal = (id: string) => {
    setProgressGoalId(id);
    loadGoal(id);
    setShowProgressModal(true);
  };

  const handleUpdateProgress = async (currentValue: number) => {
    if (!progressGoalId) return;
    await updateProgress(progressGoalId, currentValue);
  };

  const handleCloseProgressModal = () => {
    setShowProgressModal(false);
    setProgressGoalId(null);
  };

  // Handle delete
  const handleConfirmDelete = async () => {
    if (!modalGoalId) return;
    await deleteGoal(modalGoalId, deleteReason || undefined);
    setDeleteReason('');
    closeModals();
  };

  // Get goal for edit modal
  const editGoal = showEditModal && modalGoalId
    ? goals.find(g => g.id === modalGoalId) || selectedGoal
    : null;

  // Get goal for progress modal
  const progressGoal = showProgressModal && progressGoalId
    ? goals.find(g => g.id === progressGoalId) || selectedGoal
    : null;

  // Get goal for delete modal
  const deleteGoalData = showDeleteModal && modalGoalId
    ? goals.find(g => g.id === modalGoalId)
    : null;

  return (
    <div className="h-full flex flex-col bg-zinc-900 flex-1">
      {/* Header */}
      <div className="flex-shrink-0 px-6 py-4 border-b border-zinc-800">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl font-semibold text-white">
            Strategic Goals
          </h1>
          <div className="flex items-center gap-2">
            <button
              onClick={openCreateModal}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded transition-colors"
            >
              + New Goal
            </button>
            <button
              onClick={() => loadGoals()}
              disabled={isLoading}
              className="px-4 py-2 border border-zinc-600 hover:border-zinc-500 text-zinc-300 text-sm rounded transition-colors"
            >
              Refresh
            </button>
          </div>
        </div>

        {/* Overall Progress Bar */}
        {progress && (
          <div className="mb-4 p-4 bg-zinc-800 rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-white">Overall Progress</span>
              <span className="text-sm text-zinc-400">
                {Math.round(progress.overallProgress)}% complete across {progress.totalGoals} goals
              </span>
            </div>
            <GoalProgressBar progress={progress.overallProgress} size="lg" />
          </div>
        )}

        {/* Stats Bar */}
        {stats && (
          <div className="flex items-center gap-6 text-sm mb-4 flex-wrap">
            <span className="text-zinc-400">
              Active:{' '}
              <span className="text-white font-medium">{stats.byStatus.active || 0}</span>
            </span>
            <span className="text-zinc-400">
              Completed:{' '}
              <span className="text-green-400 font-medium">{stats.byStatus.completed || 0}</span>
            </span>
            <span className="text-zinc-400">
              Overdue:{' '}
              <span className={stats.overdueCount > 0 ? 'text-red-400 font-medium' : 'text-white font-medium'}>
                {stats.overdueCount}
              </span>
            </span>
            <span className="text-zinc-400">
              Avg Progress:{' '}
              <span className="text-white font-medium">
                {Math.round(stats.avgProgress)}%
              </span>
            </span>
            <span className="text-zinc-400">
              This Week:{' '}
              <span className="text-green-400 font-medium">{stats.completedThisWeek}</span>
            </span>
          </div>
        )}

        {/* Filters */}
        <div className="flex items-center gap-3">
          <select
            value={statusFilter}
            onChange={(e) => handleFilterChange('status', e.target.value)}
            className="px-3 py-1.5 bg-zinc-800 border border-zinc-700 rounded text-sm text-zinc-300 focus:outline-none focus:border-zinc-600"
          >
            <option value="">All Status</option>
            <option value="active">Active</option>
            <option value="completed">Completed</option>
            <option value="paused">Paused</option>
            <option value="abandoned">Abandoned</option>
          </select>

          <select
            value={categoryFilter}
            onChange={(e) => handleFilterChange('category', e.target.value)}
            className="px-3 py-1.5 bg-zinc-800 border border-zinc-700 rounded text-sm text-zinc-300 focus:outline-none focus:border-zinc-600"
          >
            <option value="">All Categories</option>
            <option value="revenue">Revenue</option>
            <option value="product">Product</option>
            <option value="operational">Operational</option>
            <option value="growth">Growth</option>
            <option value="technical">Technical</option>
          </select>

          <select
            value={priorityFilter}
            onChange={(e) => handleFilterChange('priority', e.target.value)}
            className="px-3 py-1.5 bg-zinc-800 border border-zinc-700 rounded text-sm text-zinc-300 focus:outline-none focus:border-zinc-600"
          >
            <option value="">All Priorities</option>
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>

          {(statusFilter || categoryFilter || priorityFilter) && (
            <button
              onClick={handleClearFilters}
              className="text-sm text-zinc-400 hover:text-white transition-colors"
            >
              Clear Filters
            </button>
          )}
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="mx-6 mt-4 p-3 bg-red-900/50 border border-red-700 rounded-lg flex items-center justify-between">
          <span className="text-red-300 text-sm">{error}</span>
          <button
            onClick={clearError}
            className="text-red-400 hover:text-red-300"
          >
            ×
          </button>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-zinc-400">Loading goals...</div>
          </div>
        ) : goals.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-center">
            <div className="text-4xl mb-4">🎯</div>
            <div className="text-lg text-white mb-2">No Goals</div>
            <div className="text-sm text-zinc-400 max-w-md">
              {statusFilter || categoryFilter || priorityFilter
                ? 'No goals match your current filters. Try adjusting your filters or clearing them.'
                : 'You haven\'t created any strategic goals yet. Click "+ New Goal" to get started.'}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {goals.map((goal) => (
              <GoalCard
                key={goal.id}
                goal={goal}
                onEdit={openEditModal}
                onDelete={openDeleteModal}
                onViewDetails={openDetailsModal}
                onUpdateProgress={handleOpenProgressModal}
              />
            ))}
          </div>
        )}
      </div>

      {/* Create Modal */}
      <CreateGoalModal
        isOpen={showCreateModal}
        onClose={closeModals}
        onSubmit={handleCreate}
        parentGoals={goals.filter(g => g.status === 'active')}
      />

      {/* Edit Modal */}
      <CreateGoalModal
        isOpen={showEditModal}
        onClose={closeModals}
        onSubmit={handleEdit}
        existingGoal={editGoal}
        parentGoals={goals.filter(g => g.status === 'active')}
      />

      {/* Update Progress Modal */}
      <UpdateProgressModal
        isOpen={showProgressModal}
        onClose={handleCloseProgressModal}
        onSubmit={handleUpdateProgress}
        goal={progressGoal}
      />

      {/* Delete Confirmation Modal */}
      {showDeleteModal && deleteGoalData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={closeModals}
          />
          <div className="relative w-full max-w-md mx-4 bg-zinc-900 border border-zinc-700 rounded-xl shadow-xl">
            <div className="px-6 py-4 border-b border-zinc-700">
              <h2 className="text-lg font-semibold text-white">Abandon Goal</h2>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-zinc-300">
                Are you sure you want to abandon this goal?
              </p>
              <div className="p-3 bg-zinc-800 rounded-lg">
                <p className="text-white font-medium">{deleteGoalData.title}</p>
                <p className="text-zinc-400 text-sm mt-1">{deleteGoalData.description}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-1">
                  Reason (optional)
                </label>
                <textarea
                  value={deleteReason}
                  onChange={(e) => setDeleteReason(e.target.value)}
                  rows={2}
                  className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:border-red-500 resize-none"
                  placeholder="Why is this goal being abandoned?"
                />
              </div>
              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  onClick={closeModals}
                  className="px-4 py-2 border border-zinc-600 hover:border-zinc-500 text-zinc-300 text-sm rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmDelete}
                  className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white text-sm font-medium rounded-lg transition-colors"
                >
                  Abandon Goal
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
