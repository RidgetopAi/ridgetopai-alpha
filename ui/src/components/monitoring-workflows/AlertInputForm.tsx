/**
 * AlertInputForm - Form for entering monitoring alerts
 * Instance 21 - OPERATE capability
 */

import { useState } from 'react';
import type { MonitoringAlert, AlertCategory, AlertSeverity, AlertSource } from '../../lib/types/monitoring-workflow';
import { CATEGORY_LABELS, SEVERITY_LABELS, SOURCE_LABELS } from '../../lib/types/monitoring-workflow';
import { useMonitoringStore } from '../../stores/monitoring-store';

interface AlertInputFormProps {
  onSubmit: (workflowId: string) => void;
}

export function AlertInputForm({ onSubmit }: AlertInputFormProps) {
  const { createWorkflow, submitWorkflow } = useMonitoringStore();

  const [alert, setAlert] = useState<MonitoringAlert>({
    title: '',
    description: '',
    category: 'infrastructure',
    severity: 'medium',
    source: 'manual',
    affectedService: '',
    metricValue: '',
    threshold: '',
  });

  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!alert.title || !alert.description) return;

    setIsSubmitting(true);

    // Create the workflow
    const workflowId = createWorkflow(alert);

    // Submit for analysis
    submitWorkflow(workflowId);

    onSubmit(workflowId);
  };

  const updateAlert = (updates: Partial<MonitoringAlert>) => {
    setAlert((prev) => ({ ...prev, ...updates }));
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Title */}
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-1">
          Alert Title <span className="text-red-400">*</span>
        </label>
        <input
          type="text"
          value={alert.title}
          onChange={(e) => updateAlert({ title: e.target.value })}
          placeholder="e.g., High CPU on prod-api-1"
          className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-md text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
          required
        />
      </div>

      {/* Row: Category + Severity + Source */}
      <div className="grid grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">
            Category
          </label>
          <select
            value={alert.category}
            onChange={(e) => updateAlert({ category: e.target.value as AlertCategory })}
            className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
          >
            {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">
            Severity
          </label>
          <select
            value={alert.severity}
            onChange={(e) => updateAlert({ severity: e.target.value as AlertSeverity })}
            className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
          >
            {Object.entries(SEVERITY_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">
            Source
          </label>
          <select
            value={alert.source}
            onChange={(e) => updateAlert({ source: e.target.value as AlertSource })}
            className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
          >
            {Object.entries(SOURCE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Description */}
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-1">
          Description <span className="text-red-400">*</span>
        </label>
        <textarea
          value={alert.description}
          onChange={(e) => updateAlert({ description: e.target.value })}
          placeholder="Describe the alert in detail..."
          rows={3}
          className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-md text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent resize-none"
          required
        />
      </div>

      {/* Row: Affected Service + Metric Value + Threshold */}
      <div className="grid grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">
            Affected Service
          </label>
          <input
            type="text"
            value={alert.affectedService || ''}
            onChange={(e) => updateAlert({ affectedService: e.target.value })}
            placeholder="e.g., api-gateway"
            className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-md text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">
            Current Value
          </label>
          <input
            type="text"
            value={alert.metricValue || ''}
            onChange={(e) => updateAlert({ metricValue: e.target.value })}
            placeholder="e.g., 95%"
            className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-md text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">
            Threshold
          </label>
          <input
            type="text"
            value={alert.threshold || ''}
            onChange={(e) => updateAlert({ threshold: e.target.value })}
            placeholder="e.g., 80%"
            className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-md text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
          />
        </div>
      </div>

      {/* Raw Payload (optional, collapsible) */}
      <details className="group">
        <summary className="text-sm text-gray-400 cursor-pointer hover:text-gray-300">
          + Add raw alert payload (optional)
        </summary>
        <div className="mt-2">
          <textarea
            value={alert.rawPayload || ''}
            onChange={(e) => updateAlert({ rawPayload: e.target.value })}
            placeholder="Paste raw JSON from monitoring system..."
            rows={4}
            className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-md text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent resize-none font-mono text-xs"
          />
        </div>
      </details>

      {/* Submit */}
      <button
        type="submit"
        disabled={isSubmitting || !alert.title || !alert.description}
        className="w-full px-4 py-2 bg-orange-600 text-white rounded-md font-medium hover:bg-orange-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isSubmitting ? 'Analyzing...' : 'Analyze Alert'}
      </button>
    </form>
  );
}
