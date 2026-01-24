/**
 * EventTriggersPanel - Main view for event trigger management
 *
 * Provides CRUD UI for event triggers that respond to webhooks
 * and system events to trigger orchestration sessions.
 */

import { useEffect, useState } from 'react';
import { Plus, RefreshCw, Github, AlertTriangle, MessageSquare, Globe, Clock, Zap } from 'lucide-react';
import { useEventTriggersStore } from '../../stores/event-triggers-store';
import { TriggerList } from './TriggerList';
import { TriggerForm } from './TriggerForm';
import { EventTriggersStats } from './EventTriggersStats';
import type { CreateEventTriggerRequest, UpdateEventTriggerRequest, TriggerStatus, EventSource } from '../../lib/types/event-triggers';
import { EVENT_SOURCE_LABELS } from '../../lib/types/event-triggers';

export function EventTriggersPanel() {
  const {
    triggers,
    stats,
    selectedTrigger,
    isLoading,
    error,
    loadTriggers,
    createTrigger,
    updateTrigger,
    deleteTrigger,
    selectTrigger,
    clearError,
  } = useEventTriggersStore();

  const [showForm, setShowForm] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  // Load triggers on mount
  useEffect(() => {
    loadTriggers();
  }, [loadTriggers]);

  const handleCreateClick = () => {
    selectTrigger(null);
    setIsEditing(false);
    setShowForm(true);
  };

  const handleEditClick = () => {
    if (selectedTrigger) {
      setIsEditing(true);
      setShowForm(true);
    }
  };

  const handleFormSubmit = async (data: CreateEventTriggerRequest) => {
    let success: boolean;

    if (isEditing && selectedTrigger) {
      // Convert to UpdateEventTriggerRequest (same fields)
      const updates: UpdateEventTriggerRequest = data;
      success = await updateTrigger(selectedTrigger.id, updates);
    } else {
      success = await createTrigger(data);
    }

    if (success) {
      setShowForm(false);
      selectTrigger(null);
    }
  };

  const handleFormCancel = () => {
    setShowForm(false);
    selectTrigger(null);
  };

  const handleToggleStatus = async (id: string, status: TriggerStatus) => {
    await updateTrigger(id, { status });
  };

  const handleDelete = async (id: string) => {
    await deleteTrigger(id);
  };

  const getSourceIcon = (source: EventSource) => {
    switch (source) {
      case 'github':
        return Github;
      case 'sentry':
        return AlertTriangle;
      case 'slack':
        return MessageSquare;
      case 'cron':
        return Clock;
      default:
        return Globe;
    }
  };

  return (
    <main className="flex-1 p-6 overflow-y-auto">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">Event Triggers</h1>
            <p className="text-sm text-gray-400 mt-1">
              Automate workflows with webhooks and system events
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => loadTriggers()}
              disabled={isLoading}
              className="p-2 rounded-md text-gray-400 hover:text-white hover:bg-gray-700/50 transition-colors"
              title="Refresh"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={handleCreateClick}
              className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-500 transition-colors"
            >
              <Plus className="w-4 h-4" />
              New Trigger
            </button>
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <div className="bg-red-900/30 border border-red-500/30 rounded-lg p-4 flex items-center justify-between">
            <span className="text-red-400">{error}</span>
            <button
              onClick={clearError}
              className="text-red-400 hover:text-red-300 text-sm"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Stats */}
        <EventTriggersStats stats={stats} />

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Trigger List */}
          <div className="lg:col-span-2">
            <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-4">
              <h2 className="text-lg font-medium text-white mb-4">Event Triggers</h2>
              <TriggerList
                triggers={triggers}
                selectedId={selectedTrigger?.id || null}
                onSelect={(id) => {
                  selectTrigger(id);
                  if (showForm) {
                    setIsEditing(true);
                  }
                }}
                onToggleStatus={handleToggleStatus}
                onDelete={handleDelete}
                isLoading={isLoading}
              />
            </div>
          </div>

          {/* Form / Detail Panel */}
          <div className="lg:col-span-1">
            {showForm ? (
              <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-4">
                <TriggerForm
                  trigger={isEditing ? selectedTrigger : null}
                  onSubmit={handleFormSubmit}
                  onCancel={handleFormCancel}
                  isLoading={isLoading}
                />
              </div>
            ) : selectedTrigger ? (
              <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-medium text-white">Trigger Details</h3>
                  <button
                    onClick={handleEditClick}
                    className="text-sm text-purple-400 hover:text-purple-300"
                  >
                    Edit
                  </button>
                </div>

                <div className="space-y-3">
                  <div>
                    <span className="text-xs text-gray-500 uppercase">Name</span>
                    <p className="text-white">{selectedTrigger.name}</p>
                  </div>
                  {selectedTrigger.description && (
                    <div>
                      <span className="text-xs text-gray-500 uppercase">Description</span>
                      <p className="text-gray-300">{selectedTrigger.description}</p>
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <span className="text-xs text-gray-500 uppercase">Source</span>
                      <div className="flex items-center gap-2 text-white">
                        {(() => {
                          const Icon = getSourceIcon(selectedTrigger.source);
                          return <Icon className="w-4 h-4" />;
                        })()}
                        {EVENT_SOURCE_LABELS[selectedTrigger.source]}
                      </div>
                    </div>
                    <div>
                      <span className="text-xs text-gray-500 uppercase">Event Type</span>
                      <p className="text-white font-mono">{selectedTrigger.eventType}</p>
                    </div>
                  </div>
                  <div>
                    <span className="text-xs text-gray-500 uppercase">Intent Template</span>
                    <p className="text-gray-300 text-sm">{selectedTrigger.intentTemplate}</p>
                  </div>
                  {selectedTrigger.conditions && selectedTrigger.conditions.length > 0 && (
                    <div>
                      <span className="text-xs text-gray-500 uppercase">Conditions</span>
                      <div className="space-y-1 mt-1">
                        {selectedTrigger.conditions.map((c, i) => (
                          <p key={i} className="text-gray-400 text-sm font-mono">
                            {c.field} {c.operator} {c.value}
                          </p>
                        ))}
                      </div>
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <span className="text-xs text-gray-500 uppercase">Status</span>
                      <p className="text-white capitalize">{selectedTrigger.status}</p>
                    </div>
                    <div>
                      <span className="text-xs text-gray-500 uppercase">Trigger Count</span>
                      <p className="text-white">{selectedTrigger.triggerCount}</p>
                    </div>
                  </div>
                  {selectedTrigger.lastTriggeredAt && (
                    <div>
                      <span className="text-xs text-gray-500 uppercase">Last Triggered</span>
                      <p className="text-gray-300 text-sm">
                        {new Date(selectedTrigger.lastTriggeredAt).toLocaleString()}
                      </p>
                    </div>
                  )}
                  {selectedTrigger.lastSessionId && (
                    <div>
                      <span className="text-xs text-gray-500 uppercase">Last Session</span>
                      <p className="text-gray-400 text-sm font-mono truncate">
                        {selectedTrigger.lastSessionId}
                      </p>
                    </div>
                  )}
                  {selectedTrigger.webhookSecret && (
                    <div>
                      <span className="text-xs text-gray-500 uppercase">Webhook Secret</span>
                      <p className="text-gray-400 text-sm font-mono truncate">
                        {selectedTrigger.webhookSecret.slice(0, 12)}...
                      </p>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-8 text-center text-gray-500">
                <Zap className="w-8 h-8 mx-auto mb-3 opacity-50" />
                <p>Select a trigger to view details</p>
                <p className="text-sm mt-2">or create a new one</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
