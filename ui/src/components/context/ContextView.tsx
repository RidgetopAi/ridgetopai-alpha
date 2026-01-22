/**
 * ContextView - Mandrel Context Browser
 *
 * Browse and search institutional memory stored in Mandrel.
 * Shows contexts with type badges, tags, and full content preview.
 */

import { useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Database,
  Search,
  RefreshCw,
  X,
  Tag,
  Clock,
  FileText,
  AlertCircle,
  Wifi,
  WifiOff,
  Filter,
  ChevronRight,
} from 'lucide-react';
import { Panel } from '../shared/Panel';
import { useContextStore } from '../../stores/context-store';
import type { MandrelContext, MandrelContextType } from '../../lib/types/context';
import {
  CONTEXT_TYPE_LABELS,
  CONTEXT_TYPE_COLORS,
} from '../../lib/types/context';

export function ContextView() {
  const {
    contexts,
    selectedContext,
    stats,
    isLoading,
    isConnected,
    error,
    searchQuery,
    typeFilter,
    tagFilter,
    viewMode,
    loadRecentContexts,
    searchContexts,
    loadStats,
    checkConnection,
    selectContext,
    setSearchQuery,
    setTypeFilter,
    setTagFilter,
    clearFilters,
    clearError,
  } = useContextStore();

  // Load initial data
  useEffect(() => {
    checkConnection();
    loadRecentContexts();
    loadStats();
  }, []);

  // Filter contexts locally by type and tag
  const filteredContexts = useMemo(() => {
    let result = contexts;

    if (typeFilter !== 'all') {
      result = result.filter((c) => c.type === typeFilter);
    }

    if (tagFilter) {
      result = result.filter((c) => c.tags.includes(tagFilter));
    }

    return result;
  }, [contexts, typeFilter, tagFilter]);

  // Extract all unique tags
  const allTags = useMemo(() => {
    const tagSet = new Set<string>();
    contexts.forEach((c) => c.tags.forEach((t) => tagSet.add(t)));
    return Array.from(tagSet).sort();
  }, [contexts]);

  // Handle search submit
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      searchContexts(searchQuery, typeFilter !== 'all' ? typeFilter : undefined);
    } else {
      loadRecentContexts();
    }
  };

  const hasActiveFilters = typeFilter !== 'all' || tagFilter !== null || searchQuery !== '';

  return (
    <div className="flex-1 p-6 overflow-hidden flex flex-col">
      <div className="max-w-7xl mx-auto w-full flex-1 flex flex-col space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Database className="w-6 h-6 text-accent-primary" />
            <div>
              <h1 className="text-xl font-semibold text-text-primary">Context Browser</h1>
              <p className="text-sm text-text-tertiary">
                Mandrel Institutional Memory
              </p>
            </div>
          </div>

          {/* Connection Status */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              {isConnected ? (
                <>
                  <Wifi className="w-4 h-4 text-green-400" />
                  <span className="text-xs text-green-400">Connected</span>
                </>
              ) : (
                <>
                  <WifiOff className="w-4 h-4 text-red-400" />
                  <span className="text-xs text-red-400">Disconnected</span>
                </>
              )}
            </div>
            <button
              onClick={() => {
                checkConnection();
                loadRecentContexts();
                loadStats();
              }}
              disabled={isLoading}
              className="flex items-center gap-2 px-3 py-2 text-sm text-text-secondary hover:text-text-primary hover:bg-surface-2 rounded-md transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </div>

        {/* Stats Bar */}
        {stats && (
          <div className="grid grid-cols-6 gap-2">
            <StatCard
              label="Total"
              value={stats.total}
              onClick={() => clearFilters()}
              active={!hasActiveFilters}
            />
            {Object.entries(stats.byType)
              .filter(([_, count]) => count > 0)
              .slice(0, 5)
              .map(([type, count]) => (
                <StatCard
                  key={type}
                  label={CONTEXT_TYPE_LABELS[type as MandrelContextType]}
                  value={count}
                  color={CONTEXT_TYPE_COLORS[type as MandrelContextType]}
                  onClick={() => setTypeFilter(type as MandrelContextType)}
                  active={typeFilter === type}
                />
              ))}
          </div>
        )}

        {/* Search & Filters */}
        <Panel className="!p-3">
          <form onSubmit={handleSearch} className="flex items-center gap-4 flex-wrap">
            {/* Search Input */}
            <div className="relative flex-1 min-w-[250px] max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-tertiary" />
              <input
                type="text"
                placeholder="Search contexts..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-surface-2 border border-border-subtle rounded-md text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-accent-primary"
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="px-4 py-2 bg-accent-primary text-white rounded-md text-sm font-medium hover:bg-accent-primary/80 transition-colors disabled:opacity-50"
            >
              Search
            </button>

            {/* Type Filter */}
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-text-tertiary" />
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value as MandrelContextType | 'all')}
                className="bg-surface-2 border border-border-subtle rounded-md px-2 py-1.5 text-sm text-text-primary focus:outline-none focus:border-accent-primary"
              >
                <option value="all">All Types</option>
                {Object.entries(CONTEXT_TYPE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>

            {/* Tag Filter */}
            {allTags.length > 0 && (
              <div className="flex items-center gap-2">
                <Tag className="w-4 h-4 text-text-tertiary" />
                <select
                  value={tagFilter || ''}
                  onChange={(e) => setTagFilter(e.target.value || null)}
                  className="bg-surface-2 border border-border-subtle rounded-md px-2 py-1.5 text-sm text-text-primary focus:outline-none focus:border-accent-primary"
                >
                  <option value="">All Tags</option>
                  {allTags.map((tag) => (
                    <option key={tag} value={tag}>
                      {tag}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Clear Filters */}
            {hasActiveFilters && (
              <button
                type="button"
                onClick={clearFilters}
                className="flex items-center gap-1 px-2 py-1 text-xs text-text-tertiary hover:text-text-primary hover:bg-surface-2 rounded transition-colors"
              >
                <X className="w-3 h-3" />
                Clear
              </button>
            )}

            {/* View Mode Indicator */}
            <span className="text-xs text-text-tertiary ml-auto">
              {viewMode === 'search' ? 'Search Results' : 'Recent Contexts'}
            </span>
          </form>
        </Panel>

        {/* Error Display */}
        {error && (
          <div className="flex items-center justify-between p-3 bg-red-900/20 border border-red-500/30 rounded-lg">
            <div className="flex items-center gap-2 text-red-400">
              <AlertCircle className="w-4 h-4" />
              <span className="text-sm">{error}</span>
            </div>
            <button onClick={clearError} className="text-red-400 hover:text-red-300">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Main Content */}
        <div className="flex-1 flex gap-4 min-h-0">
          {/* Context List */}
          <div className="flex-1 overflow-auto">
            <div className="space-y-2">
              <AnimatePresence mode="popLayout">
                {isLoading && contexts.length === 0 ? (
                  <div className="flex items-center justify-center py-12 text-text-tertiary">
                    <RefreshCw className="w-6 h-6 animate-spin mr-2" />
                    <span>Loading contexts...</span>
                  </div>
                ) : filteredContexts.length === 0 ? (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="flex flex-col items-center justify-center py-12 text-text-tertiary"
                  >
                    <Database className="w-12 h-12 mb-3 opacity-50" />
                    <p className="text-sm">
                      {hasActiveFilters
                        ? 'No contexts match your filters'
                        : 'No contexts found'}
                    </p>
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
                  filteredContexts.map((context) => (
                    <ContextCard
                      key={context.id}
                      context={context}
                      isSelected={selectedContext?.id === context.id}
                      onClick={() =>
                        selectContext(
                          selectedContext?.id === context.id ? null : context
                        )
                      }
                      onTagClick={setTagFilter}
                    />
                  ))
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* Detail Panel */}
          <AnimatePresence>
            {selectedContext && (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="w-[450px] shrink-0"
              >
                <ContextDetailPanel
                  context={selectedContext}
                  onClose={() => selectContext(null)}
                  onTagClick={setTagFilter}
                />
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
  color?: string;
  onClick: () => void;
  active: boolean;
}

function StatCard({ label, value, color, onClick, active }: StatCardProps) {
  return (
    <button
      onClick={onClick}
      className={`
        p-2 rounded-lg border transition-all text-left
        ${active
          ? 'bg-surface-2 border-accent-primary/50'
          : 'bg-surface-1 border-border-subtle hover:border-border-default'
        }
      `}
    >
      <div className="flex items-center gap-2">
        <span className={`text-xl font-semibold ${color ? color.split(' ')[1] : 'text-text-primary'}`}>
          {value}
        </span>
      </div>
      <p className="text-xs text-text-tertiary truncate">{label}</p>
    </button>
  );
}

// Context Card Component
interface ContextCardProps {
  context: MandrelContext;
  isSelected: boolean;
  onClick: () => void;
  onTagClick: (tag: string) => void;
}

function ContextCard({ context, isSelected, onClick, onTagClick }: ContextCardProps) {
  const typeColor = CONTEXT_TYPE_COLORS[context.type] || 'bg-gray-500/20 text-gray-400';

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      onClick={onClick}
      className={`
        bg-surface-1 rounded-lg p-4 border cursor-pointer transition-all
        hover:bg-surface-2
        ${isSelected ? 'border-accent-primary' : 'border-border-subtle'}
      `}
    >
      <div className="flex items-start gap-3">
        {/* Type Icon */}
        <div className="shrink-0 mt-0.5">
          <FileText className="w-4 h-4 text-text-tertiary" />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Type Badge & Time */}
          <div className="flex items-center gap-2 mb-2">
            <span className={`text-xs px-2 py-0.5 rounded-full ${typeColor}`}>
              {CONTEXT_TYPE_LABELS[context.type]}
            </span>
            <span className="text-xs text-text-tertiary flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {formatDate(context.createdAt)}
            </span>
            {context.relevance !== undefined && (
              <span className="text-xs text-text-tertiary">
                {Math.round(context.relevance * 100)}% match
              </span>
            )}
          </div>

          {/* Content Preview */}
          <p className="text-sm text-text-secondary line-clamp-3">
            {context.content}
          </p>

          {/* Tags */}
          {context.tags.length > 0 && (
            <div className="flex items-center gap-1 mt-2 flex-wrap">
              {context.tags.slice(0, 5).map((tag) => (
                <button
                  key={tag}
                  onClick={(e) => {
                    e.stopPropagation();
                    onTagClick(tag);
                  }}
                  className="text-xs px-1.5 py-0.5 bg-surface-3 text-text-tertiary rounded hover:text-text-primary transition-colors"
                >
                  #{tag}
                </button>
              ))}
              {context.tags.length > 5 && (
                <span className="text-xs text-text-tertiary">
                  +{context.tags.length - 5} more
                </span>
              )}
            </div>
          )}
        </div>

        {/* Expand Icon */}
        <ChevronRight className={`w-4 h-4 text-text-tertiary transition-transform ${isSelected ? 'rotate-90' : ''}`} />
      </div>
    </motion.div>
  );
}

// Context Detail Panel Component
interface ContextDetailPanelProps {
  context: MandrelContext;
  onClose: () => void;
  onTagClick: (tag: string) => void;
}

function ContextDetailPanel({ context, onClose, onTagClick }: ContextDetailPanelProps) {
  const typeColor = CONTEXT_TYPE_COLORS[context.type] || 'bg-gray-500/20 text-gray-400';

  return (
    <Panel
      title="Context Details"
      headerActions={
        <button onClick={onClose} className="p-1 hover:bg-surface-2 rounded transition-colors">
          <X className="w-4 h-4 text-text-tertiary" />
        </button>
      }
      className="h-full overflow-auto"
    >
      <div className="space-y-4">
        {/* Type & Time */}
        <div className="flex items-center justify-between">
          <span className={`text-sm px-3 py-1 rounded-full ${typeColor}`}>
            {CONTEXT_TYPE_LABELS[context.type]}
          </span>
          <span className="text-xs text-text-tertiary flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {formatDate(context.createdAt)}
          </span>
        </div>

        {/* ID */}
        <div>
          <p className="text-xs text-text-tertiary uppercase tracking-wide mb-1">Context ID</p>
          <p className="text-xs font-mono text-text-secondary bg-surface-2 px-2 py-1 rounded">
            {context.id}
          </p>
        </div>

        {/* Relevance (if search result) */}
        {context.relevance !== undefined && (
          <div>
            <p className="text-xs text-text-tertiary uppercase tracking-wide mb-1">
              Search Relevance
            </p>
            <div className="flex items-center gap-2">
              <div className="flex-1 h-2 bg-surface-3 rounded-full overflow-hidden">
                <div
                  className="h-full bg-accent-primary transition-all"
                  style={{ width: `${context.relevance * 100}%` }}
                />
              </div>
              <span className="text-xs text-text-secondary">
                {Math.round(context.relevance * 100)}%
              </span>
            </div>
          </div>
        )}

        {/* Tags */}
        {context.tags.length > 0 && (
          <div>
            <p className="text-xs text-text-tertiary uppercase tracking-wide mb-2">Tags</p>
            <div className="flex flex-wrap gap-1">
              {context.tags.map((tag) => (
                <button
                  key={tag}
                  onClick={() => onTagClick(tag)}
                  className="text-xs px-2 py-1 bg-surface-2 text-text-secondary rounded-full hover:bg-surface-3 hover:text-text-primary transition-colors"
                >
                  #{tag}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Content */}
        <div>
          <p className="text-xs text-text-tertiary uppercase tracking-wide mb-2">Content</p>
          <div className="bg-surface-2 rounded-lg p-4 max-h-[400px] overflow-auto">
            <pre className="text-sm text-text-secondary whitespace-pre-wrap font-sans">
              {context.content}
            </pre>
          </div>
        </div>
      </div>
    </Panel>
  );
}

// Date formatting helper
function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return 'Unknown';

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
  });
}
