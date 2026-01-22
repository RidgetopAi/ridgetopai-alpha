/**
 * IntentInput - Natural Language Input for Orchestration
 *
 * This is where the human provides direction in natural language.
 * The AI will interpret this and generate specific tasks.
 */

import { useState } from 'react';

interface IntentInputProps {
  onSubmit: (intent: string, context?: { focus?: string; urgency?: 'high' | 'normal' | 'low' }) => void;
  isLoading: boolean;
}

export function IntentInput({ onSubmit, isLoading }: IntentInputProps) {
  const [intent, setIntent] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [focus, setFocus] = useState<string>('');
  const [urgency, setUrgency] = useState<'high' | 'normal' | 'low'>('normal');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!intent.trim() || isLoading) return;

    const context = showAdvanced && (focus || urgency !== 'normal')
      ? { focus: focus || undefined, urgency }
      : undefined;

    onSubmit(intent.trim(), context);
  };

  const examples = [
    'Write a blog post about AI for solo builders',
    'Fix the login button bug and write a changelog entry',
    'Create content announcing our new feature launch',
    'Analyze the authentication system for security issues',
  ];

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Main Intent Input */}
      <div>
        <label htmlFor="intent" className="block text-sm font-medium text-gray-300 mb-2">
          What do you want to accomplish?
        </label>
        <textarea
          id="intent"
          value={intent}
          onChange={(e) => setIntent(e.target.value)}
          placeholder="Describe your goal in natural language..."
          rows={4}
          className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-md text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent resize-none"
          disabled={isLoading}
        />
      </div>

      {/* Example Prompts */}
      <div className="space-y-2">
        <p className="text-xs text-gray-500">Try an example:</p>
        <div className="flex flex-wrap gap-2">
          {examples.map((example, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setIntent(example)}
              className="text-xs px-2 py-1 bg-gray-800 text-gray-400 rounded hover:bg-gray-700 hover:text-gray-300 transition-colors"
            >
              {example.length > 35 ? example.substring(0, 35) + '...' : example}
            </button>
          ))}
        </div>
      </div>

      {/* Advanced Options Toggle */}
      <button
        type="button"
        onClick={() => setShowAdvanced(!showAdvanced)}
        className="text-xs text-gray-500 hover:text-gray-400"
      >
        {showAdvanced ? '▼ Hide options' : '▶ Show options'}
      </button>

      {/* Advanced Options */}
      {showAdvanced && (
        <div className="space-y-3 p-3 bg-gray-800/50 rounded-lg">
          {/* Focus Area */}
          <div>
            <label htmlFor="focus" className="block text-xs font-medium text-gray-400 mb-1">
              Focus Area (optional)
            </label>
            <select
              id="focus"
              value={focus}
              onChange={(e) => setFocus(e.target.value)}
              className="w-full px-2 py-1.5 bg-gray-800 border border-gray-700 rounded text-sm text-white focus:outline-none focus:ring-1 focus:ring-cyan-500"
            >
              <option value="">Auto-detect</option>
              <option value="engineering">Engineering (PRODUCE)</option>
              <option value="marketing">Marketing (GROW)</option>
              <option value="support">Support (OPERATE)</option>
            </select>
          </div>

          {/* Urgency */}
          <div>
            <label htmlFor="urgency" className="block text-xs font-medium text-gray-400 mb-1">
              Urgency
            </label>
            <select
              id="urgency"
              value={urgency}
              onChange={(e) => setUrgency(e.target.value as 'high' | 'normal' | 'low')}
              className="w-full px-2 py-1.5 bg-gray-800 border border-gray-700 rounded text-sm text-white focus:outline-none focus:ring-1 focus:ring-cyan-500"
            >
              <option value="normal">Normal</option>
              <option value="high">High - Prioritize quick wins</option>
              <option value="low">Low - Thorough over fast</option>
            </select>
          </div>
        </div>
      )}

      {/* Submit Button */}
      <button
        type="submit"
        disabled={!intent.trim() || isLoading}
        className="w-full px-4 py-3 bg-cyan-600 text-white rounded-md font-medium hover:bg-cyan-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isLoading ? (
          <span className="flex items-center justify-center gap-2">
            <span className="animate-spin">◌</span>
            Analyzing...
          </span>
        ) : (
          'Analyze & Generate Tasks'
        )}
      </button>
    </form>
  );
}
