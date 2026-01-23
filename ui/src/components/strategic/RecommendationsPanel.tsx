/**
 * RecommendationsPanel - Main container for recommendations view
 * Phase 4: Recommendation Engine UI
 */

import { useEffect, useState } from 'react';
import { useStrategicStore } from '../../stores/strategic-store';
import { RecommendationCard } from './RecommendationCard';
import type { RecommendationPriority, RecommendationStatus, RecommendationType } from '../../lib/types/strategic';

export function RecommendationsPanel() {
  const {
    recommendations,
    stats,
    filters,
    isLoading,
    isGenerating,
    error,
    lastGenerationResult,
    loadRecommendations,
    loadStats,
    setFilters,
    clearFilters,
    triggerGeneration,
    openAcceptModal,
    openRejectModal,
    openDeferModal,
    openDetailModal,
    clearError,
  } = useStrategicStore();

  // Local state for filter dropdowns
  const [statusFilter, setStatusFilter] = useState<RecommendationStatus | ''>('');
  const [priorityFilter, setPriorityFilter] = useState<RecommendationPriority | ''>('');
  const [typeFilter, setTypeFilter] = useState<RecommendationType | ''>('');

  // Load data on mount
  useEffect(() => {
    loadRecommendations();
    loadStats();
  }, [loadRecommendations, loadStats]);

  // Handle filter changes
  const handleFilterChange = (
    type: 'status' | 'priority' | 'type',
    value: string
  ) => {
    const newFilters: Record<string, string | undefined> = {};

    if (type === 'status') {
      setStatusFilter(value as RecommendationStatus | '');
      newFilters.status = value || undefined;
    } else if (type === 'priority') {
      setPriorityFilter(value as RecommendationPriority | '');
      newFilters.priority = value || undefined;
    } else if (type === 'type') {
      setTypeFilter(value as RecommendationType | '');
      newFilters.type = value || undefined;
    }

    setFilters(newFilters);
  };

  const handleClearFilters = () => {
    setStatusFilter('');
    setPriorityFilter('');
    setTypeFilter('');
    clearFilters();
  };

  const handleGenerate = async () => {
    await triggerGeneration();
  };

  return (
    <div className="h-full flex flex-col bg-zinc-900">
      {/* Header */}
      <div className="flex-shrink-0 px-6 py-4 border-b border-zinc-800">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl font-semibold text-white">
            Strategic Recommendations
          </h1>
          <div className="flex items-center gap-2">
            <button
              onClick={handleGenerate}
              disabled={isGenerating}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-800 disabled:cursor-not-allowed text-white text-sm font-medium rounded transition-colors"
            >
              {isGenerating ? 'Generating...' : 'Generate'}
            </button>
            <button
              onClick={() => loadRecommendations()}
              disabled={isLoading}
              className="px-4 py-2 border border-zinc-600 hover:border-zinc-500 text-zinc-300 text-sm rounded transition-colors"
            >
              Refresh
            </button>
          </div>
        </div>

        {/* Stats Bar */}
        {stats && (
          <div className="flex items-center gap-6 text-sm">
            <span className="text-zinc-400">
              Pending:{' '}
              <span className="text-white font-medium">{stats.pendingCount}</span>
            </span>
            <span className="text-zinc-400">
              Expiring Soon:{' '}
              <span className={stats.expiringInNext24h > 0 ? 'text-red-400 font-medium' : 'text-white font-medium'}>
                {stats.expiringInNext24h}
              </span>
            </span>
            {stats.acceptanceRate !== null && (
              <span className="text-zinc-400">
                Acceptance Rate:{' '}
                <span className="text-green-400 font-medium">
                  {Math.round(stats.acceptanceRate * 100)}%
                </span>
              </span>
            )}
            {stats.avgConfidence !== null && (
              <span className="text-zinc-400">
                Avg Confidence:{' '}
                <span className="text-white font-medium">
                  {Math.round(stats.avgConfidence * 100)}%
                </span>
              </span>
            )}
          </div>
        )}

        {/* Filters */}
        <div className="flex items-center gap-3 mt-4">
          <select
            value={statusFilter}
            onChange={(e) => handleFilterChange('status', e.target.value)}
            className="px-3 py-1.5 bg-zinc-800 border border-zinc-700 rounded text-sm text-zinc-300 focus:outline-none focus:border-zinc-600"
          >
            <option value="">All Status</option>
            <option value="pending">Pending</option>
            <option value="accepted">Accepted</option>
            <option value="rejected">Rejected</option>
            <option value="deferred">Deferred</option>
            <option value="expired">Expired</option>
          </select>

          <select
            value={priorityFilter}
            onChange={(e) => handleFilterChange('priority', e.target.value)}
            className="px-3 py-1.5 bg-zinc-800 border border-zinc-700 rounded text-sm text-zinc-300 focus:outline-none focus:border-zinc-600"
          >
            <option value="">All Priority</option>
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>

          <select
            value={typeFilter}
            onChange={(e) => handleFilterChange('type', e.target.value)}
            className="px-3 py-1.5 bg-zinc-800 border border-zinc-700 rounded text-sm text-zinc-300 focus:outline-none focus:border-zinc-600"
          >
            <option value="">All Types</option>
            <option value="action">Action</option>
            <option value="optimization">Optimization</option>
            <option value="warning">Warning</option>
            <option value="opportunity">Opportunity</option>
          </select>

          {(statusFilter || priorityFilter || typeFilter) && (
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
            ✕
          </button>
        </div>
      )}

      {/* Generation Result Alert */}
      {lastGenerationResult && lastGenerationResult.recommendationsCreated > 0 && (
        <div className="mx-6 mt-4 p-3 bg-green-900/50 border border-green-700 rounded-lg">
          <span className="text-green-300 text-sm">
            Generated {lastGenerationResult.recommendationsCreated} new recommendations
            from {lastGenerationResult.patternsAnalyzed} patterns and{' '}
            {lastGenerationResult.goalsConsidered} goals.
          </span>
          {lastGenerationResult.insights.length > 0 && (
            <div className="mt-2 text-xs text-green-400">
              Insights: {lastGenerationResult.insights.join(' • ')}
            </div>
          )}
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-zinc-400">Loading recommendations...</div>
          </div>
        ) : recommendations.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-center">
            <div className="text-4xl mb-4">📋</div>
            <div className="text-lg text-white mb-2">No Recommendations</div>
            <div className="text-sm text-zinc-400 max-w-md">
              {filters.status || filters.priority || filters.type
                ? 'No recommendations match your current filters. Try adjusting your filters or clearing them.'
                : 'No recommendations have been generated yet. Click "Generate" to analyze patterns and goals.'}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {recommendations.map((recommendation) => (
              <RecommendationCard
                key={recommendation.id}
                recommendation={recommendation}
                onAccept={openAcceptModal}
                onReject={openRejectModal}
                onDefer={openDeferModal}
                onViewDetails={openDetailModal}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
