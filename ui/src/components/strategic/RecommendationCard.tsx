/**
 * RecommendationCard - Display a single recommendation with actions
 * Phase 4: Recommendation Engine UI
 */

import type { Recommendation } from '../../lib/types/strategic';

interface RecommendationCardProps {
  recommendation: Recommendation;
  onAccept: (id: string) => void;
  onReject: (id: string) => void;
  onDefer: (id: string) => void;
  onViewDetails: (id: string) => void;
}

/**
 * Get priority badge styling
 */
function getPriorityBadge(priority: string) {
  switch (priority) {
    case 'critical':
      return 'bg-red-600 text-white';
    case 'high':
      return 'bg-orange-500 text-white';
    case 'medium':
      return 'bg-blue-500 text-white';
    case 'low':
      return 'bg-gray-500 text-white';
    default:
      return 'bg-gray-400 text-white';
  }
}

/**
 * Get type icon and styling
 */
function getTypeIcon(type: string) {
  switch (type) {
    case 'action':
      return { icon: '⚡', label: 'Action', color: 'text-yellow-400' };
    case 'optimization':
      return { icon: '📈', label: 'Optimization', color: 'text-green-400' };
    case 'warning':
      return { icon: '⚠️', label: 'Warning', color: 'text-red-400' };
    case 'opportunity':
      return { icon: '💡', label: 'Opportunity', color: 'text-blue-400' };
    default:
      return { icon: '📋', label: 'Unknown', color: 'text-gray-400' };
  }
}

/**
 * Format confidence as percentage
 */
function formatConfidence(confidence: number): string {
  return `${Math.round(confidence * 100)}%`;
}

/**
 * Calculate time until expiry
 */
function getExpiryText(expiresAt: string | null): string | null {
  if (!expiresAt) return null;

  const expiryDate = new Date(expiresAt);
  const now = new Date();
  const diffMs = expiryDate.getTime() - now.getTime();

  if (diffMs < 0) return 'Expired';

  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffHours / 24);

  if (diffDays > 0) {
    return `${diffDays}d`;
  }
  return `${diffHours}h`;
}

export function RecommendationCard({
  recommendation,
  onAccept,
  onReject,
  onDefer,
  onViewDetails,
}: RecommendationCardProps) {
  const typeInfo = getTypeIcon(recommendation.recommendation_type);
  const expiryText = getExpiryText(recommendation.expires_at);
  const isExpiringSoon = expiryText && (expiryText.includes('h') || expiryText === 'Expired');

  return (
    <div className="bg-zinc-800 border border-zinc-700 rounded-lg p-4 hover:border-zinc-600 transition-colors">
      {/* Header Row */}
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="flex items-center gap-2">
          {/* Priority Badge */}
          <span
            className={`px-2 py-0.5 text-xs font-semibold rounded uppercase ${getPriorityBadge(
              recommendation.priority
            )}`}
          >
            {recommendation.priority}
          </span>

          {/* Type Badge */}
          <span className={`text-sm ${typeInfo.color}`}>
            {typeInfo.icon} {typeInfo.label}
          </span>
        </div>

        {/* Expiry Warning */}
        {expiryText && (
          <span
            className={`text-xs ${
              isExpiringSoon ? 'text-red-400 font-semibold' : 'text-zinc-500'
            }`}
          >
            {expiryText === 'Expired' ? '⏰ Expired' : `Expires: ${expiryText}`}
          </span>
        )}
      </div>

      {/* Title */}
      <h3 className="text-lg font-medium text-white mb-1">{recommendation.title}</h3>

      {/* Description */}
      <p className="text-sm text-zinc-400 mb-3 line-clamp-2">{recommendation.description}</p>

      {/* Metadata Row */}
      <div className="flex items-center gap-4 text-xs text-zinc-500 mb-3">
        {/* Confidence */}
        <span className="flex items-center gap-1">
          <span className="text-green-400">●</span>
          Confidence: {formatConfidence(recommendation.confidence)}
        </span>

        {/* Pattern Count */}
        {recommendation.source_pattern_ids.length > 0 && (
          <span>Patterns: {recommendation.source_pattern_ids.length}</span>
        )}

        {/* Goal Count */}
        {recommendation.related_goal_ids.length > 0 && (
          <span>Goals: {recommendation.related_goal_ids.length}</span>
        )}
      </div>

      {/* Action Buttons */}
      {recommendation.status === 'pending' && (
        <div className="flex items-center gap-2 pt-2 border-t border-zinc-700">
          <button
            onClick={() => onAccept(recommendation.id)}
            className="px-3 py-1.5 bg-green-600 hover:bg-green-500 text-white text-sm font-medium rounded transition-colors"
          >
            Accept
          </button>
          <button
            onClick={() => onReject(recommendation.id)}
            className="px-3 py-1.5 bg-red-600 hover:bg-red-500 text-white text-sm font-medium rounded transition-colors"
          >
            Reject
          </button>
          <button
            onClick={() => onDefer(recommendation.id)}
            className="px-3 py-1.5 bg-zinc-600 hover:bg-zinc-500 text-white text-sm font-medium rounded transition-colors"
          >
            Defer
          </button>
          <button
            onClick={() => onViewDetails(recommendation.id)}
            className="ml-auto px-3 py-1.5 border border-zinc-600 hover:border-zinc-500 text-zinc-300 text-sm rounded transition-colors"
          >
            Details
          </button>
        </div>
      )}

      {/* Status indicator for non-pending */}
      {recommendation.status !== 'pending' && (
        <div className="flex items-center gap-2 pt-2 border-t border-zinc-700 text-sm">
          <span
            className={`px-2 py-1 rounded ${
              recommendation.status === 'accepted'
                ? 'bg-green-900 text-green-300'
                : recommendation.status === 'rejected'
                  ? 'bg-red-900 text-red-300'
                  : recommendation.status === 'deferred'
                    ? 'bg-yellow-900 text-yellow-300'
                    : 'bg-zinc-900 text-zinc-400'
            }`}
          >
            {recommendation.status.charAt(0).toUpperCase() + recommendation.status.slice(1)}
          </span>
          <button
            onClick={() => onViewDetails(recommendation.id)}
            className="ml-auto px-3 py-1.5 border border-zinc-600 hover:border-zinc-500 text-zinc-300 text-sm rounded transition-colors"
          >
            Details
          </button>
        </div>
      )}
    </div>
  );
}
