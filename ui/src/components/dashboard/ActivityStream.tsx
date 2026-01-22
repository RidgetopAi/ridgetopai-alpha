import { useEffect, useRef } from 'react';
import { useActivityStore } from '../../stores/activity-store';
import { useSpindlesStream } from '../../hooks/useSpindlesStream';
import type { ActivityRecord, ActivityMessage } from '../../lib/types/activity';

export function ActivityStream() {
  const activities = useActivityStore((state) => state.activities);
  const currentSession = useActivityStore((state) => state.currentSession);
  const { isConnected, connectionError, connect, disconnect, clearActivities } = useSpindlesStream({
    debug: import.meta.env.DEV,
  });

  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new activities arrive
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [activities.length]);

  return (
    <div className="flex flex-col h-full bg-surface-1 rounded-lg overflow-hidden border border-surface-3">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-surface-3 bg-surface-2">
        <div className="flex items-center gap-3">
          <h3 className="text-sm font-medium text-text-primary">Activity Stream</h3>
          <ConnectionIndicator isConnected={isConnected} error={connectionError} />
        </div>

        <div className="flex items-center gap-2">
          {currentSession && (
            <SessionBadge session={currentSession} />
          )}
          <button
            onClick={() => clearActivities()}
            className="text-xs text-text-tertiary hover:text-text-secondary transition-colors"
            title="Clear activities"
          >
            Clear
          </button>
          <button
            onClick={() => (isConnected ? disconnect() : connect())}
            className={`text-xs px-2 py-1 rounded transition-colors ${
              isConnected
                ? 'text-status-error hover:bg-status-error/10'
                : 'text-status-complete hover:bg-status-complete/10'
            }`}
          >
            {isConnected ? 'Disconnect' : 'Connect'}
          </button>
        </div>
      </div>

      {/* Activity List */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-2 space-y-1">
        {activities.length === 0 ? (
          <EmptyState isConnected={isConnected} error={connectionError} />
        ) : (
          activities.map((record) => (
            <ActivityItem key={record.id} record={record} />
          ))
        )}
      </div>

      {/* Footer stats */}
      <div className="px-4 py-2 border-t border-surface-3 bg-surface-2">
        <div className="flex items-center justify-between text-xs text-text-tertiary">
          <span>{activities.length} activities</span>
          {currentSession && (
            <span>
              Instance {currentSession.instanceNumber}/{currentSession.totalInstances}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function ConnectionIndicator({ isConnected, error }: { isConnected: boolean; error: string | null }) {
  if (error) {
    return (
      <span className="flex items-center gap-1 text-xs text-status-error">
        <span className="w-2 h-2 rounded-full bg-status-error" />
        Error
      </span>
    );
  }

  return (
    <span className={`flex items-center gap-1 text-xs ${isConnected ? 'text-status-complete' : 'text-text-tertiary'}`}>
      <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-status-complete animate-pulse' : 'bg-surface-3'}`} />
      {isConnected ? 'Live' : 'Disconnected'}
    </span>
  );
}

function SessionBadge({ session }: { session: { runName: string; project: string } }) {
  return (
    <span className="px-2 py-0.5 text-xs rounded bg-accent-primary/20 text-accent-primary truncate max-w-[150px]">
      {session.runName}
    </span>
  );
}

function EmptyState({ isConnected, error }: { isConnected: boolean; error: string | null }) {
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-32 text-center">
        <span className="text-2xl mb-2">!</span>
        <p className="text-sm text-status-error">{error}</p>
        <p className="text-xs text-text-tertiary mt-1">Check if Spindles-Proxy is running</p>
      </div>
    );
  }

  if (!isConnected) {
    return (
      <div className="flex flex-col items-center justify-center h-32 text-center">
        <span className="text-2xl mb-2 opacity-50">~</span>
        <p className="text-sm text-text-tertiary">Not connected</p>
        <p className="text-xs text-text-tertiary mt-1">Click Connect to start streaming</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center h-32 text-center">
      <span className="text-2xl mb-2 opacity-50">...</span>
      <p className="text-sm text-text-tertiary">Waiting for activity</p>
      <p className="text-xs text-text-tertiary mt-1">Start a SIRK run to see live updates</p>
    </div>
  );
}

function ActivityItem({ record }: { record: ActivityRecord }) {
  const { activity, receivedAt } = record;

  return (
    <div className="flex items-start gap-2 p-2 rounded bg-surface-2 hover:bg-surface-3 transition-colors">
      <ActivityIcon activity={activity} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 text-xs text-text-tertiary mb-0.5">
          <span className="font-mono">{activity.type}</span>
          {activity.session && (
            <>
              <span>|</span>
              <span>#{activity.session.instanceNumber}</span>
            </>
          )}
          <span className="ml-auto">{formatTime(receivedAt)}</span>
        </div>
        <div className="text-sm text-text-primary break-words">
          <ActivityContent activity={activity} />
        </div>
      </div>
    </div>
  );
}

function ActivityIcon({ activity }: { activity: ActivityMessage }) {
  const iconClasses = 'w-5 h-5 flex items-center justify-center rounded text-xs flex-shrink-0';

  switch (activity.type) {
    case 'thinking':
      return <span className={`${iconClasses} bg-purple-500/20 text-purple-400`}>T</span>;
    case 'tool_call':
      return <span className={`${iconClasses} bg-blue-500/20 text-blue-400`}>C</span>;
    case 'tool_result':
      return (
        <span className={`${iconClasses} ${activity.isError ? 'bg-red-500/20 text-red-400' : 'bg-green-500/20 text-green-400'}`}>
          {activity.isError ? 'E' : 'R'}
        </span>
      );
    case 'text':
      return <span className={`${iconClasses} bg-gray-500/20 text-gray-400`}>$</span>;
    case 'error':
      return <span className={`${iconClasses} bg-red-500/20 text-red-400`}>!</span>;
    default:
      return <span className={`${iconClasses} bg-gray-500/20 text-gray-400`}>?</span>;
  }
}

function ActivityContent({ activity }: { activity: ActivityMessage }) {
  switch (activity.type) {
    case 'thinking':
      return <span className="italic text-text-secondary">{truncate(activity.content, 200)}</span>;

    case 'tool_call': {
      const inputStr = activity.input != null ? JSON.stringify(activity.input) : '';
      return (
        <span>
          <code className="text-accent-primary">{activity.toolName}</code>
          {inputStr && (
            <span className="text-text-tertiary ml-2 text-xs">
              {truncate(inputStr, 100)}
            </span>
          )}
        </span>
      );
    }

    case 'tool_result':
      return (
        <span className={activity.isError ? 'text-status-error' : ''}>
          {typeof activity.content === 'string'
            ? truncate(activity.content, 150)
            : truncate(JSON.stringify(activity.content), 150)}
        </span>
      );

    case 'text':
      return <span>{truncate(activity.content, 200)}</span>;

    case 'error':
      return (
        <span className="text-status-error">
          {activity.code && <code className="mr-2">[{activity.code}]</code>}
          {activity.message}
        </span>
      );

    default:
      return <span className="text-text-tertiary">Unknown activity type</span>;
  }
}

function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength) + '...';
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString('en-US', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}
