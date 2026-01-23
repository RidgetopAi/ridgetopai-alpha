/**
 * CreateGoalModal - Modal for creating and editing goals
 * Phase 3: Goal Management UI
 */

import { useState, useEffect } from 'react';
import type {
  Goal,
  GoalCategory,
  GoalPriority,
  CreateGoalInput,
  UpdateGoalInput,
} from '../../lib/types/strategic';

interface CreateGoalModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (input: CreateGoalInput | UpdateGoalInput) => Promise<void>;
  existingGoal?: Goal | null;
  parentGoals?: Goal[];
  isLoading?: boolean;
}

const CATEGORIES: { value: GoalCategory; label: string; icon: string }[] = [
  { value: 'revenue', label: 'Revenue', icon: '💰' },
  { value: 'product', label: 'Product', icon: '📦' },
  { value: 'operational', label: 'Operational', icon: '⚙️' },
  { value: 'growth', label: 'Growth', icon: '📈' },
  { value: 'technical', label: 'Technical', icon: '🔧' },
];

const PRIORITIES: { value: GoalPriority; label: string }[] = [
  { value: 'critical', label: 'Critical' },
  { value: 'high', label: 'High' },
  { value: 'medium', label: 'Medium' },
  { value: 'low', label: 'Low' },
];

export function CreateGoalModal({
  isOpen,
  onClose,
  onSubmit,
  existingGoal,
  parentGoals = [],
  isLoading = false,
}: CreateGoalModalProps) {
  const isEditMode = !!existingGoal;

  // Form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<GoalCategory>('product');
  const [priority, setPriority] = useState<GoalPriority>('medium');
  const [targetMetric, setTargetMetric] = useState('');
  const [targetValue, setTargetValue] = useState('');
  const [currentValue, setCurrentValue] = useState('');
  const [targetDate, setTargetDate] = useState('');
  const [parentGoalId, setParentGoalId] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Reset form when modal opens/closes or existing goal changes
  useEffect(() => {
    if (isOpen) {
      if (existingGoal) {
        setTitle(existingGoal.title);
        setDescription(existingGoal.description);
        setCategory(existingGoal.category);
        setPriority(existingGoal.priority);
        setTargetMetric(existingGoal.target_metric || '');
        setTargetValue(existingGoal.target_value?.toString() || '');
        setCurrentValue(existingGoal.current_value?.toString() || '0');
        setTargetDate(existingGoal.target_date?.split('T')[0] || '');
        setParentGoalId(existingGoal.parent_goal_id || '');
      } else {
        setTitle('');
        setDescription('');
        setCategory('product');
        setPriority('medium');
        setTargetMetric('');
        setTargetValue('');
        setCurrentValue('0');
        setTargetDate('');
        setParentGoalId('');
      }
      setError(null);
    }
  }, [isOpen, existingGoal]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validation
    if (!title.trim()) {
      setError('Title is required');
      return;
    }
    if (!description.trim()) {
      setError('Description is required');
      return;
    }

    setSubmitting(true);

    try {
      const input: CreateGoalInput | UpdateGoalInput = {
        title: title.trim(),
        description: description.trim(),
        category,
        priority,
        targetMetric: targetMetric.trim() || undefined,
        targetValue: targetValue ? parseFloat(targetValue) : undefined,
        currentValue: currentValue ? parseFloat(currentValue) : 0,
        targetDate: targetDate || undefined,
        parentGoalId: parentGoalId || undefined,
      };

      await onSubmit(input);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save goal');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-lg mx-4 bg-zinc-900 border border-zinc-700 rounded-xl shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-700">
          <h2 className="text-lg font-semibold text-white">
            {isEditMode ? 'Edit Goal' : 'Create New Goal'}
          </h2>
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-white transition-colors"
            disabled={submitting}
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Error Alert */}
          {error && (
            <div className="p-3 bg-red-900/50 border border-red-700 rounded-lg text-red-300 text-sm">
              {error}
            </div>
          )}

          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-1">
              Title <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:border-indigo-500"
              placeholder="Enter goal title"
              disabled={submitting}
              autoFocus
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-1">
              Description <span className="text-red-400">*</span>
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:border-indigo-500 resize-none"
              placeholder="Describe what this goal aims to achieve"
              disabled={submitting}
            />
          </div>

          {/* Category and Priority Row */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-1">
                Category
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as GoalCategory)}
                className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:outline-none focus:border-indigo-500"
                disabled={submitting}
              >
                {CATEGORIES.map((cat) => (
                  <option key={cat.value} value={cat.value}>
                    {cat.icon} {cat.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-1">
                Priority
              </label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as GoalPriority)}
                className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:outline-none focus:border-indigo-500"
                disabled={submitting}
              >
                {PRIORITIES.map((pri) => (
                  <option key={pri.value} value={pri.value}>
                    {pri.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Metric Row */}
          <div className="grid grid-cols-3 gap-4">
            <div className="col-span-1">
              <label className="block text-sm font-medium text-zinc-300 mb-1">
                Target Metric
              </label>
              <input
                type="text"
                value={targetMetric}
                onChange={(e) => setTargetMetric(e.target.value)}
                className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:border-indigo-500"
                placeholder="e.g., customers"
                disabled={submitting}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-1">
                Target Value
              </label>
              <input
                type="number"
                value={targetValue}
                onChange={(e) => setTargetValue(e.target.value)}
                className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:border-indigo-500"
                placeholder="100"
                disabled={submitting}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-1">
                Current Value
              </label>
              <input
                type="number"
                value={currentValue}
                onChange={(e) => setCurrentValue(e.target.value)}
                className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:border-indigo-500"
                placeholder="0"
                disabled={submitting}
              />
            </div>
          </div>

          {/* Target Date */}
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-1">
              Target Date
            </label>
            <input
              type="date"
              value={targetDate}
              onChange={(e) => setTargetDate(e.target.value)}
              className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:outline-none focus:border-indigo-500"
              disabled={submitting}
            />
          </div>

          {/* Parent Goal */}
          {parentGoals.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-1">
                Parent Goal (optional)
              </label>
              <select
                value={parentGoalId}
                onChange={(e) => setParentGoalId(e.target.value)}
                className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:outline-none focus:border-indigo-500"
                disabled={submitting}
              >
                <option value="">No parent (top-level goal)</option>
                {parentGoals
                  .filter((g) => g.id !== existingGoal?.id) // Can't be own parent
                  .map((goal) => (
                    <option key={goal.id} value={goal.id}>
                      {goal.title}
                    </option>
                  ))}
              </select>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-zinc-700">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-zinc-600 hover:border-zinc-500 text-zinc-300 text-sm rounded-lg transition-colors"
              disabled={submitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-800 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors"
              disabled={submitting || isLoading}
            >
              {submitting ? 'Saving...' : isEditMode ? 'Save Changes' : 'Create Goal'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/**
 * UpdateProgressModal - Modal for updating goal progress
 */
interface UpdateProgressModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (currentValue: number) => Promise<void>;
  goal: Goal | null;
}

export function UpdateProgressModal({
  isOpen,
  onClose,
  onSubmit,
  goal,
}: UpdateProgressModalProps) {
  const [currentValue, setCurrentValue] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen && goal) {
      setCurrentValue(goal.current_value.toString());
      setError(null);
    }
  }, [isOpen, goal]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const value = parseFloat(currentValue);
    if (isNaN(value)) {
      setError('Please enter a valid number');
      return;
    }

    setSubmitting(true);
    try {
      await onSubmit(value);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update progress');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen || !goal) return null;

  const progressIfUpdated = goal.target_value
    ? Math.min(100, (parseFloat(currentValue) / goal.target_value) * 100)
    : goal.progress_percentage;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-md mx-4 bg-zinc-900 border border-zinc-700 rounded-xl shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-700">
          <h2 className="text-lg font-semibold text-white">Update Progress</h2>
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-white transition-colors"
            disabled={submitting}
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-red-900/50 border border-red-700 rounded-lg text-red-300 text-sm">
              {error}
            </div>
          )}

          <div className="text-center mb-4">
            <h3 className="text-white font-medium mb-1">{goal.title}</h3>
            {goal.target_metric && goal.target_value && (
              <p className="text-zinc-400 text-sm">
                Target: {goal.target_value.toLocaleString()} {goal.target_metric}
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-1">
              Current Value
            </label>
            <input
              type="number"
              value={currentValue}
              onChange={(e) => setCurrentValue(e.target.value)}
              className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-center text-lg focus:outline-none focus:border-indigo-500"
              disabled={submitting}
              autoFocus
            />
            {goal.target_value && (
              <div className="mt-2 text-center">
                <span className="text-zinc-400 text-sm">
                  Progress: <span className="text-white font-medium">{Math.round(progressIfUpdated)}%</span>
                </span>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-zinc-600 hover:border-zinc-500 text-zinc-300 text-sm rounded-lg transition-colors"
              disabled={submitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-800 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors"
              disabled={submitting}
            >
              {submitting ? 'Updating...' : 'Update Progress'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
