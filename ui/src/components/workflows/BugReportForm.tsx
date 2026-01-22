/**
 * BugReportForm - Input form for bug fix workflow
 * Instance 09 - First PRODUCE capability
 */

import { useState } from 'react';
import type { BugReport, Severity } from '../../lib/types/workflow';
import { useWorkflowStore } from '../../stores/workflow-store';

interface BugReportFormProps {
  onSubmit?: (workflowId: string) => void;
}

export function BugReportForm({ onSubmit }: BugReportFormProps) {
  const { createWorkflow, submitWorkflow } = useWorkflowStore();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [stepsToReproduce, setStepsToReproduce] = useState('');
  const [expectedBehavior, setExpectedBehavior] = useState('');
  const [actualBehavior, setActualBehavior] = useState('');
  const [severity, setSeverity] = useState<Severity>('major');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!title.trim() || !description.trim()) {
      return;
    }

    setIsSubmitting(true);

    const bugReport: BugReport = {
      title: title.trim(),
      description: description.trim(),
      stepsToReproduce: stepsToReproduce.trim() || undefined,
      expectedBehavior: expectedBehavior.trim() || undefined,
      actualBehavior: actualBehavior.trim() || undefined,
      severity,
    };

    const workflowId = createWorkflow(bugReport);
    submitWorkflow(workflowId);

    // Reset form
    setTitle('');
    setDescription('');
    setStepsToReproduce('');
    setExpectedBehavior('');
    setActualBehavior('');
    setSeverity('major');
    setIsSubmitting(false);

    onSubmit?.(workflowId);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Title */}
      <div>
        <label htmlFor="title" className="block text-sm font-medium text-gray-300 mb-1">
          Bug Title <span className="text-red-400">*</span>
        </label>
        <input
          id="title"
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Brief description of the bug"
          className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-md text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          required
        />
      </div>

      {/* Description */}
      <div>
        <label htmlFor="description" className="block text-sm font-medium text-gray-300 mb-1">
          Description <span className="text-red-400">*</span>
        </label>
        <textarea
          id="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Detailed description of what's wrong..."
          rows={3}
          className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-md text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
          required
        />
      </div>

      {/* Severity */}
      <div>
        <label htmlFor="severity" className="block text-sm font-medium text-gray-300 mb-1">
          Severity
        </label>
        <select
          id="severity"
          value={severity}
          onChange={(e) => setSeverity(e.target.value as Severity)}
          className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          <option value="blocker">Blocker - System unusable</option>
          <option value="major">Major - Significant impact</option>
          <option value="minor">Minor - Low impact</option>
        </select>
      </div>

      {/* Steps to Reproduce (Collapsible) */}
      <details className="group">
        <summary className="cursor-pointer text-sm font-medium text-gray-400 hover:text-gray-300">
          Additional Details (optional)
        </summary>
        <div className="mt-3 space-y-3 pl-2 border-l-2 border-gray-700">
          <div>
            <label htmlFor="steps" className="block text-sm font-medium text-gray-400 mb-1">
              Steps to Reproduce
            </label>
            <textarea
              id="steps"
              value={stepsToReproduce}
              onChange={(e) => setStepsToReproduce(e.target.value)}
              placeholder="1. Go to...\n2. Click on...\n3. See error"
              rows={3}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-md text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none text-sm"
            />
          </div>

          <div>
            <label htmlFor="expected" className="block text-sm font-medium text-gray-400 mb-1">
              Expected Behavior
            </label>
            <input
              id="expected"
              type="text"
              value={expectedBehavior}
              onChange={(e) => setExpectedBehavior(e.target.value)}
              placeholder="What should happen"
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-md text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
            />
          </div>

          <div>
            <label htmlFor="actual" className="block text-sm font-medium text-gray-400 mb-1">
              Actual Behavior
            </label>
            <input
              id="actual"
              type="text"
              value={actualBehavior}
              onChange={(e) => setActualBehavior(e.target.value)}
              placeholder="What actually happens"
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-md text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
            />
          </div>
        </div>
      </details>

      {/* Submit Button */}
      <div className="pt-2">
        <button
          type="submit"
          disabled={isSubmitting || !title.trim() || !description.trim()}
          className={`
            w-full px-4 py-2 rounded-md font-medium transition-colors
            ${
              isSubmitting || !title.trim() || !description.trim()
                ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                : 'bg-blue-600 text-white hover:bg-blue-500'
            }
          `}
        >
          {isSubmitting ? 'Starting Workflow...' : 'Start Bug Fix Workflow'}
        </button>
      </div>
    </form>
  );
}
