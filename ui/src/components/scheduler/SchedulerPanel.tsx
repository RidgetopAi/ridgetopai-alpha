/**
 * SchedulerPanel - Main view for scheduler management
 *
 * Provides CRUD UI for scheduled tasks that trigger orchestration
 * sessions on cron patterns.
 */

import { useEffect, useState } from 'react';
import { Plus, RefreshCw } from 'lucide-react';
import { useSchedulerStore } from '../../stores/scheduler-store';
import { ScheduleList } from './ScheduleList';
import { ScheduleForm } from './ScheduleForm';
import { SchedulerStats } from './SchedulerStats';
import type { CreateScheduleRequest, UpdateScheduleRequest, ScheduleStatus } from '../../lib/types/scheduler';

export function SchedulerPanel() {
  const {
    schedules,
    stats,
    selectedSchedule,
    isLoading,
    error,
    loadSchedules,
    createSchedule,
    updateSchedule,
    deleteSchedule,
    triggerSchedule,
    selectSchedule,
    clearError,
  } = useSchedulerStore();

  const [showForm, setShowForm] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  // Load schedules on mount
  useEffect(() => {
    loadSchedules();
  }, [loadSchedules]);

  const handleCreateClick = () => {
    selectSchedule(null);
    setIsEditing(false);
    setShowForm(true);
  };

  const handleEditClick = () => {
    if (selectedSchedule) {
      setIsEditing(true);
      setShowForm(true);
    }
  };

  const handleFormSubmit = async (data: CreateScheduleRequest) => {
    let success: boolean;

    if (isEditing && selectedSchedule) {
      // Convert to UpdateScheduleRequest (same fields)
      const updates: UpdateScheduleRequest = data;
      success = await updateSchedule(selectedSchedule.id, updates);
    } else {
      success = await createSchedule(data);
    }

    if (success) {
      setShowForm(false);
      selectSchedule(null);
    }
  };

  const handleFormCancel = () => {
    setShowForm(false);
    selectSchedule(null);
  };

  const handleToggleStatus = async (id: string, status: ScheduleStatus) => {
    await updateSchedule(id, { status });
  };

  const handleTrigger = async (id: string) => {
    const sessionId = await triggerSchedule(id);
    if (sessionId) {
      // Could navigate to orchestration view with this session
      console.log('[SchedulerPanel] Triggered schedule, session:', sessionId);
    }
  };

  const handleDelete = async (id: string) => {
    await deleteSchedule(id);
  };

  return (
    <main className="flex-1 p-6 overflow-y-auto">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">Scheduler</h1>
            <p className="text-sm text-gray-400 mt-1">
              Automate orchestration with cron-based schedules
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => loadSchedules()}
              disabled={isLoading}
              className="p-2 rounded-md text-gray-400 hover:text-white hover:bg-gray-700/50 transition-colors"
              title="Refresh"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={handleCreateClick}
              className="flex items-center gap-2 px-4 py-2 bg-cyan-600 text-white rounded-md hover:bg-cyan-500 transition-colors"
            >
              <Plus className="w-4 h-4" />
              New Schedule
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
        <SchedulerStats stats={stats} />

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Schedule List */}
          <div className="lg:col-span-2">
            <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-4">
              <h2 className="text-lg font-medium text-white mb-4">Scheduled Tasks</h2>
              <ScheduleList
                schedules={schedules}
                selectedId={selectedSchedule?.id || null}
                onSelect={(id) => {
                  selectSchedule(id);
                  if (showForm) {
                    setIsEditing(true);
                  }
                }}
                onTrigger={handleTrigger}
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
                <ScheduleForm
                  schedule={isEditing ? selectedSchedule : null}
                  onSubmit={handleFormSubmit}
                  onCancel={handleFormCancel}
                  isLoading={isLoading}
                />
              </div>
            ) : selectedSchedule ? (
              <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-medium text-white">Schedule Details</h3>
                  <button
                    onClick={handleEditClick}
                    className="text-sm text-cyan-400 hover:text-cyan-300"
                  >
                    Edit
                  </button>
                </div>

                <div className="space-y-3">
                  <div>
                    <span className="text-xs text-gray-500 uppercase">Name</span>
                    <p className="text-white">{selectedSchedule.name}</p>
                  </div>
                  {selectedSchedule.description && (
                    <div>
                      <span className="text-xs text-gray-500 uppercase">Description</span>
                      <p className="text-gray-300">{selectedSchedule.description}</p>
                    </div>
                  )}
                  <div>
                    <span className="text-xs text-gray-500 uppercase">Cron Pattern</span>
                    <p className="text-white font-mono">{selectedSchedule.cronPattern}</p>
                  </div>
                  <div>
                    <span className="text-xs text-gray-500 uppercase">Intent</span>
                    <p className="text-gray-300 text-sm">{selectedSchedule.intentTemplate}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <span className="text-xs text-gray-500 uppercase">Status</span>
                      <p className="text-white capitalize">{selectedSchedule.status}</p>
                    </div>
                    <div>
                      <span className="text-xs text-gray-500 uppercase">Run Count</span>
                      <p className="text-white">{selectedSchedule.runCount}</p>
                    </div>
                  </div>
                  {selectedSchedule.lastRunAt && (
                    <div>
                      <span className="text-xs text-gray-500 uppercase">Last Run</span>
                      <p className="text-gray-300 text-sm">
                        {new Date(selectedSchedule.lastRunAt).toLocaleString()} -{' '}
                        <span
                          className={
                            selectedSchedule.lastResult === 'success'
                              ? 'text-green-400'
                              : selectedSchedule.lastResult === 'failure'
                              ? 'text-red-400'
                              : 'text-yellow-400'
                          }
                        >
                          {selectedSchedule.lastResult || 'unknown'}
                        </span>
                      </p>
                    </div>
                  )}
                  {selectedSchedule.nextRunAt && (
                    <div>
                      <span className="text-xs text-gray-500 uppercase">Next Run</span>
                      <p className="text-gray-300 text-sm">
                        {new Date(selectedSchedule.nextRunAt).toLocaleString()}
                      </p>
                    </div>
                  )}
                </div>

                <div className="pt-4 border-t border-gray-700">
                  <button
                    onClick={() => handleTrigger(selectedSchedule.id)}
                    disabled={isLoading}
                    className="w-full px-4 py-2 bg-cyan-600 text-white rounded-md hover:bg-cyan-500 disabled:opacity-50 transition-colors"
                  >
                    Run Now
                  </button>
                </div>
              </div>
            ) : (
              <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-8 text-center text-gray-500">
                <p>Select a schedule to view details</p>
                <p className="text-sm mt-2">or create a new one</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
