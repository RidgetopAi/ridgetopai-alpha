/**
 * TriggerForm - Create/Edit form for event triggers
 */

import { useState, useEffect } from 'react';
import { X, Zap, Plus, Trash2 } from 'lucide-react';
import type {
  EventTrigger,
  CreateEventTriggerRequest,
  TriggerStatus,
  EventSource,
  TriggerCondition,
  ConditionOperator,
} from '../../lib/types/event-triggers';
import {
  EVENT_SOURCE_LABELS,
  COMMON_EVENT_TYPES,
} from '../../lib/types/event-triggers';

interface TriggerFormProps {
  trigger?: EventTrigger | null;
  onSubmit: (data: CreateEventTriggerRequest) => void;
  onCancel: () => void;
  isLoading?: boolean;
}

export function TriggerForm({ trigger, onSubmit, onCancel, isLoading }: TriggerFormProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [source, setSource] = useState<EventSource>('github');
  const [eventType, setEventType] = useState('push');
  const [intentTemplate, setIntentTemplate] = useState('');
  const [autoDispatch, setAutoDispatch] = useState(true);
  const [status, setStatus] = useState<TriggerStatus>('active');
  const [conditions, setConditions] = useState<TriggerCondition[]>([]);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [contextFocus, setContextFocus] = useState('');
  const [contextUrgency, setContextUrgency] = useState('');

  // Populate form when editing
  useEffect(() => {
    if (trigger) {
      setName(trigger.name);
      setDescription(trigger.description || '');
      setSource(trigger.source);
      setEventType(trigger.eventType);
      setIntentTemplate(trigger.intentTemplate);
      setAutoDispatch(trigger.autoDispatch);
      setStatus(trigger.status);
      setConditions(trigger.conditions || []);
      if (trigger.contextMapping) {
        setContextFocus(trigger.contextMapping.focus || '');
        setContextUrgency(trigger.contextMapping.urgency || '');
        setShowAdvanced(true);
      }
    }
  }, [trigger]);

  // Update available event types when source changes
  const availableEventTypes = COMMON_EVENT_TYPES[source] || [{ label: 'Any', type: '*' }];

  const handleSourceChange = (newSource: EventSource) => {
    setSource(newSource);
    // Reset event type to first available for new source
    const types = COMMON_EVENT_TYPES[newSource] || [{ label: 'Any', type: '*' }];
    setEventType(types[0].type);
  };

  const handleAddCondition = () => {
    setConditions([...conditions, { field: '', operator: 'equals', value: '' }]);
  };

  const handleRemoveCondition = (index: number) => {
    setConditions(conditions.filter((_, i) => i !== index));
  };

  const handleConditionChange = (
    index: number,
    field: keyof TriggerCondition,
    value: string
  ) => {
    setConditions(
      conditions.map((c, i) =>
        i === index ? { ...c, [field]: value } : c
      )
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const data: CreateEventTriggerRequest = {
      name,
      description: description || undefined,
      source,
      eventType,
      intentTemplate,
      autoDispatch,
      status,
      conditions: conditions.length > 0 ? conditions : undefined,
      contextMapping: showAdvanced && (contextFocus || contextUrgency)
        ? {
            ...(contextFocus && { focus: contextFocus }),
            ...(contextUrgency && { urgency: contextUrgency }),
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
          <Zap className="w-5 h-5 text-purple-400" />
          {trigger ? 'Edit Trigger' : 'New Event Trigger'}
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
          placeholder="GitHub PR opened trigger"
          className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-md text-white placeholder-gray-500 focus:outline-none focus:border-purple-500"
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
          placeholder="Triggers code review workflow on new PRs"
          className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-md text-white placeholder-gray-500 focus:outline-none focus:border-purple-500"
        />
      </div>

      {/* Source */}
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-1">Event Source</label>
        <div className="flex flex-wrap gap-2">
          {(Object.entries(EVENT_SOURCE_LABELS) as [EventSource, string][]).map(([src, label]) => (
            <button
              key={src}
              type="button"
              onClick={() => handleSourceChange(src)}
              className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                source === src
                  ? 'bg-purple-600 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Event Type */}
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-1">Event Type</label>
        <div className="flex flex-wrap gap-2 mb-2">
          {availableEventTypes.map((preset) => (
            <button
              key={preset.type}
              type="button"
              onClick={() => setEventType(preset.type)}
              className={`px-2 py-1 text-xs rounded-md transition-colors ${
                eventType === preset.type
                  ? 'bg-purple-600 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              {preset.label}
            </button>
          ))}
        </div>
        <input
          type="text"
          value={eventType}
          onChange={(e) => setEventType(e.target.value)}
          placeholder="push"
          className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-md text-white font-mono placeholder-gray-500 focus:outline-none focus:border-purple-500"
          required
        />
      </div>

      {/* Conditions */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-sm font-medium text-gray-300">Conditions (optional)</label>
          <button
            type="button"
            onClick={handleAddCondition}
            className="text-sm text-purple-400 hover:text-purple-300 flex items-center gap-1"
          >
            <Plus className="w-3 h-3" />
            Add condition
          </button>
        </div>
        {conditions.length > 0 && (
          <div className="space-y-2">
            {conditions.map((condition, index) => (
              <div key={index} className="flex items-center gap-2">
                <input
                  type="text"
                  value={condition.field || ''}
                  onChange={(e) => handleConditionChange(index, 'field', e.target.value)}
                  placeholder="action"
                  className="flex-1 px-2 py-1.5 bg-gray-800 border border-gray-700 rounded text-white text-sm placeholder-gray-500 focus:outline-none focus:border-purple-500"
                />
                <select
                  value={condition.operator || 'equals'}
                  onChange={(e) => handleConditionChange(index, 'operator', e.target.value as ConditionOperator)}
                  className="px-2 py-1.5 bg-gray-800 border border-gray-700 rounded text-white text-sm focus:outline-none focus:border-purple-500"
                >
                  <option value="equals">=</option>
                  <option value="contains">contains</option>
                  <option value="regex">regex</option>
                  <option value="exists">exists</option>
                  <option value="gt">&gt;</option>
                  <option value="lt">&lt;</option>
                </select>
                <input
                  type="text"
                  value={condition.value || ''}
                  onChange={(e) => handleConditionChange(index, 'value', e.target.value)}
                  placeholder="opened"
                  className="flex-1 px-2 py-1.5 bg-gray-800 border border-gray-700 rounded text-white text-sm placeholder-gray-500 focus:outline-none focus:border-purple-500"
                />
                <button
                  type="button"
                  onClick={() => handleRemoveCondition(index)}
                  className="p-1 text-red-400 hover:text-red-300"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
        <p className="text-xs text-gray-500 mt-1">
          Filter events based on payload fields (e.g., action = opened)
        </p>
      </div>

      {/* Intent Template */}
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-1">Intent Template</label>
        <textarea
          value={intentTemplate}
          onChange={(e) => setIntentTemplate(e.target.value)}
          placeholder="Review pull request #{{number}} in {{repository.name}}: {{pull_request.title}}"
          className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-md text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 min-h-[100px]"
          required
        />
        <p className="text-xs text-gray-500 mt-1">
          Use {'{{field.path}}'} to inject values from the event payload
        </p>
      </div>

      {/* Options */}
      <div className="flex items-center gap-6">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={autoDispatch}
            onChange={(e) => setAutoDispatch(e.target.checked)}
            className="w-4 h-4 rounded border-gray-600 bg-gray-800 text-purple-500 focus:ring-purple-500 focus:ring-offset-gray-900"
          />
          <span className="text-sm text-gray-300">Auto-dispatch tasks</span>
        </label>

        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-300">Status:</span>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as TriggerStatus)}
            className="px-2 py-1 bg-gray-800 border border-gray-700 rounded-md text-white text-sm focus:outline-none focus:border-purple-500"
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
        className="text-sm text-purple-400 hover:text-purple-300"
      >
        {showAdvanced ? '- Hide advanced options' : '+ Show advanced options'}
      </button>

      {/* Advanced Options */}
      {showAdvanced && (
        <div className="space-y-4 pt-2 pl-4 border-l-2 border-gray-700">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Context Focus Mapping (optional)
            </label>
            <input
              type="text"
              value={contextFocus}
              onChange={(e) => setContextFocus(e.target.value)}
              placeholder="repository.name"
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-md text-white placeholder-gray-500 focus:outline-none focus:border-purple-500"
            />
            <p className="text-xs text-gray-500 mt-1">
              Field path from event to use as focus context
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Context Urgency Mapping (optional)
            </label>
            <input
              type="text"
              value={contextUrgency}
              onChange={(e) => setContextUrgency(e.target.value)}
              placeholder="priority"
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-md text-white placeholder-gray-500 focus:outline-none focus:border-purple-500"
            />
            <p className="text-xs text-gray-500 mt-1">
              Field path for urgency (should map to low/normal/high)
            </p>
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
          disabled={isLoading || !name || !eventType || !intentTemplate}
          className="px-4 py-2 text-sm bg-purple-600 text-white rounded-md hover:bg-purple-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isLoading ? 'Saving...' : trigger ? 'Update Trigger' : 'Create Trigger'}
        </button>
      </div>
    </form>
  );
}
