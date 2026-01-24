/**
 * ScheduleForm - Create/Edit form for scheduled tasks
 */

import { useState, useEffect } from 'react';
import { X, Calendar, Clock, Zap } from 'lucide-react';
import type { ScheduledTask, CreateScheduleRequest, ScheduleStatus } from '../../lib/types/scheduler';
import { COMMON_CRON_PATTERNS } from '../../lib/types/scheduler';

interface ScheduleFormProps {
  schedule?: ScheduledTask | null;
  onSubmit: (data: CreateScheduleRequest) => void;
  onCancel: () => void;
  isLoading?: boolean;
}

export function ScheduleForm({ schedule, onSubmit, onCancel, isLoading }: ScheduleFormProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [cronPattern, setCronPattern] = useState('0 9 * * *');
  const [intentTemplate, setIntentTemplate] = useState('');
  const [autoDispatch, setAutoDispatch] = useState(true);
  const [status, setStatus] = useState<ScheduleStatus>('active');
  const [focusContext, setFocusContext] = useState('');
  const [urgency, setUrgency] = useState<'low' | 'medium' | 'high'>('medium');
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Populate form when editing
  useEffect(() => {
    if (schedule) {
      setName(schedule.name);
      setDescription(schedule.description || '');
      setCronPattern(schedule.cronPattern);
      setIntentTemplate(schedule.intentTemplate);
      setAutoDispatch(schedule.autoDispatch);
      setStatus(schedule.status);
      setFocusContext(schedule.context?.focus || '');
      setUrgency(schedule.context?.urgency || 'medium');
      setShowAdvanced(!!schedule.context?.focus || schedule.context?.urgency !== 'medium');
    }
  }, [schedule]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const data: CreateScheduleRequest = {
      name,
      description: description || undefined,
      cronPattern,
      intentTemplate,
      autoDispatch,
      status,
      context: showAdvanced
        ? {
            focus: focusContext || undefined,
            urgency,
          }
        : undefined,
    };

    onSubmit(data);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-gray-700">
        <h3 className="text-lg font-medium text-white flex items-center gap-2">
          <Calendar className="w-5 h-5 text-cyan-400" />
          {schedule ? 'Edit Schedule' : 'New Schedule'}
        </h3>
        <button
          type="button"
          onClick={onCancel}
          className="p-1.5 rounded-md text-gray-400 hover:text-white hover:bg-gray-700/50"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Name */}
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-1">Name</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Daily report generation"
          className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-md text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500"
          required
        />
      </div>

      {/* Description */}
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-1">Description (optional)</label>
        <input
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Generates daily metrics report and emails team"
          className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-md text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500"
        />
      </div>

      {/* Cron Pattern */}
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-1 flex items-center gap-2">
          <Clock className="w-4 h-4" />
          Schedule (Cron Pattern)
        </label>
        <input
          type="text"
          value={cronPattern}
          onChange={(e) => setCronPattern(e.target.value)}
          placeholder="0 9 * * *"
          className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-md text-white font-mono placeholder-gray-500 focus:outline-none focus:border-cyan-500 mb-2"
          required
        />
        <div className="flex flex-wrap gap-2">
          {COMMON_CRON_PATTERNS.map((preset) => (
            <button
              key={preset.pattern}
              type="button"
              onClick={() => setCronPattern(preset.pattern)}
              className={`px-2 py-1 text-xs rounded-md transition-colors ${
                cronPattern === preset.pattern
                  ? 'bg-cyan-600 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              {preset.label}
            </button>
          ))}
        </div>
      </div>

      {/* Intent Template */}
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-1 flex items-center gap-2">
          <Zap className="w-4 h-4" />
          Intent (What to do)
        </label>
        <textarea
          value={intentTemplate}
          onChange={(e) => setIntentTemplate(e.target.value)}
          placeholder="Generate a daily metrics report including user signups, revenue, and error rates. Email the summary to the team."
          className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-md text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500 min-h-[100px]"
          required
        />
        <p className="text-xs text-gray-500 mt-1">
          This will be sent to the orchestrator as a natural language intent
        </p>
      </div>

      {/* Options */}
      <div className="flex items-center gap-6">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={autoDispatch}
            onChange={(e) => setAutoDispatch(e.target.checked)}
            className="w-4 h-4 rounded border-gray-600 bg-gray-800 text-cyan-500 focus:ring-cyan-500 focus:ring-offset-gray-900"
          />
          <span className="text-sm text-gray-300">Auto-dispatch tasks</span>
        </label>

        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-300">Status:</span>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as ScheduleStatus)}
            className="px-2 py-1 bg-gray-800 border border-gray-700 rounded-md text-white text-sm focus:outline-none focus:border-cyan-500"
          >
            <option value="active">Active</option>
            <option value="paused">Paused</option>
            <option value="disabled">Disabled</option>
          </select>
        </div>
      </div>

      {/* Advanced Options Toggle */}
      <button
        type="button"
        onClick={() => setShowAdvanced(!showAdvanced)}
        className="text-sm text-cyan-400 hover:text-cyan-300"
      >
        {showAdvanced ? '- Hide advanced options' : '+ Show advanced options'}
      </button>

      {/* Advanced Options */}
      {showAdvanced && (
        <div className="space-y-4 pt-2 pl-4 border-l-2 border-gray-700">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Focus area (optional)</label>
            <input
              type="text"
              value={focusContext}
              onChange={(e) => setFocusContext(e.target.value)}
              placeholder="e.g., reporting, analytics, deployment"
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-md text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Urgency</label>
            <div className="flex gap-2">
              {(['low', 'medium', 'high'] as const).map((u) => (
                <button
                  key={u}
                  type="button"
                  onClick={() => setUrgency(u)}
                  className={`px-3 py-1 text-sm rounded-md capitalize transition-colors ${
                    urgency === u
                      ? u === 'high'
                        ? 'bg-red-600 text-white'
                        : u === 'medium'
                        ? 'bg-yellow-600 text-white'
                        : 'bg-green-600 text-white'
                      : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  }`}
                >
                  {u}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-700">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 text-sm text-gray-300 hover:text-white transition-colors"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isLoading || !name || !cronPattern || !intentTemplate}
          className="px-4 py-2 text-sm bg-cyan-600 text-white rounded-md hover:bg-cyan-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isLoading ? 'Saving...' : schedule ? 'Update Schedule' : 'Create Schedule'}
        </button>
      </div>
    </form>
  );
}
