/**
 * ContentBriefForm - Form for creating content generation briefs
 * Instance 12 - First GROW capability
 */

import { useState } from 'react';
import type {
  ContentBrief,
  ContentFormat,
  AudienceType,
  ContentTone,
} from '../../lib/types/content-workflow';
import {
  FORMAT_LABELS,
  AUDIENCE_LABELS,
  TONE_LABELS,
} from '../../lib/types/content-workflow';
import { useContentWorkflowStore } from '../../stores/content-workflow-store';

interface ContentBriefFormProps {
  onSubmit: (workflowId: string) => void;
}

export function ContentBriefForm({ onSubmit }: ContentBriefFormProps) {
  const { createWorkflow, submitWorkflow } = useContentWorkflowStore();

  const [formData, setFormData] = useState<ContentBrief>({
    title: '',
    topic: '',
    format: 'blog_post',
    audience: 'developers',
    tone: 'professional',
    keyPoints: [],
    keywords: [],
    wordCount: undefined,
    additionalContext: '',
  });

  const [keyPointInput, setKeyPointInput] = useState('');
  const [keywordInput, setKeywordInput] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title.trim() || !formData.topic.trim()) return;

    setIsSubmitting(true);
    const id = createWorkflow(formData);
    await submitWorkflow(id);
    setIsSubmitting(false);
    onSubmit(id);
  };

  const addKeyPoint = () => {
    if (keyPointInput.trim()) {
      setFormData({
        ...formData,
        keyPoints: [...(formData.keyPoints || []), keyPointInput.trim()],
      });
      setKeyPointInput('');
    }
  };

  const removeKeyPoint = (index: number) => {
    setFormData({
      ...formData,
      keyPoints: formData.keyPoints?.filter((_, i) => i !== index),
    });
  };

  const addKeyword = () => {
    if (keywordInput.trim()) {
      setFormData({
        ...formData,
        keywords: [...(formData.keywords || []), keywordInput.trim()],
      });
      setKeywordInput('');
    }
  };

  const removeKeyword = (index: number) => {
    setFormData({
      ...formData,
      keywords: formData.keywords?.filter((_, i) => i !== index),
    });
  };

  const formatOptions: ContentFormat[] = ['blog_post', 'tweet_thread', 'documentation', 'email', 'announcement', 'case_study'];
  const audienceOptions: AudienceType[] = ['developers', 'business', 'general', 'internal'];
  const toneOptions: ContentTone[] = ['professional', 'conversational', 'technical', 'educational'];

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Title */}
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-1">
          Content Title <span className="text-red-400">*</span>
        </label>
        <input
          type="text"
          value={formData.title}
          onChange={(e) => setFormData({ ...formData, title: e.target.value })}
          placeholder="e.g., 'Getting Started with AI Workflows'"
          className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-md text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
          disabled={isSubmitting}
        />
      </div>

      {/* Topic */}
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-1">
          Topic/Subject <span className="text-red-400">*</span>
        </label>
        <textarea
          value={formData.topic}
          onChange={(e) => setFormData({ ...formData, topic: e.target.value })}
          placeholder="Describe what this content should be about..."
          rows={3}
          className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-md text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent resize-none"
          disabled={isSubmitting}
        />
      </div>

      {/* Format, Audience, Tone */}
      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">Format</label>
          <select
            value={formData.format}
            onChange={(e) => setFormData({ ...formData, format: e.target.value as ContentFormat })}
            className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-green-500"
            disabled={isSubmitting}
          >
            {formatOptions.map((format) => (
              <option key={format} value={format}>
                {FORMAT_LABELS[format]}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">Audience</label>
          <select
            value={formData.audience}
            onChange={(e) => setFormData({ ...formData, audience: e.target.value as AudienceType })}
            className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-green-500"
            disabled={isSubmitting}
          >
            {audienceOptions.map((audience) => (
              <option key={audience} value={audience}>
                {AUDIENCE_LABELS[audience]}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">Tone</label>
          <select
            value={formData.tone}
            onChange={(e) => setFormData({ ...formData, tone: e.target.value as ContentTone })}
            className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-green-500"
            disabled={isSubmitting}
          >
            {toneOptions.map((tone) => (
              <option key={tone} value={tone}>
                {TONE_LABELS[tone]}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Key Points */}
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-1">Key Points to Cover</label>
        <div className="flex gap-2 mb-2">
          <input
            type="text"
            value={keyPointInput}
            onChange={(e) => setKeyPointInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addKeyPoint())}
            placeholder="Add a key point..."
            className="flex-1 px-3 py-2 bg-gray-800 border border-gray-700 rounded-md text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-green-500 text-sm"
            disabled={isSubmitting}
          />
          <button
            type="button"
            onClick={addKeyPoint}
            className="px-3 py-2 bg-gray-700 text-white rounded-md hover:bg-gray-600 text-sm"
            disabled={isSubmitting}
          >
            Add
          </button>
        </div>
        {formData.keyPoints && formData.keyPoints.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {formData.keyPoints.map((point, index) => (
              <span
                key={index}
                className="inline-flex items-center gap-1 px-2 py-1 bg-green-900/30 text-green-400 rounded text-xs"
              >
                {point}
                <button
                  type="button"
                  onClick={() => removeKeyPoint(index)}
                  className="hover:text-green-200"
                  disabled={isSubmitting}
                >
                  x
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Keywords */}
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-1">Target Keywords (SEO)</label>
        <div className="flex gap-2 mb-2">
          <input
            type="text"
            value={keywordInput}
            onChange={(e) => setKeywordInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addKeyword())}
            placeholder="Add a keyword..."
            className="flex-1 px-3 py-2 bg-gray-800 border border-gray-700 rounded-md text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-green-500 text-sm"
            disabled={isSubmitting}
          />
          <button
            type="button"
            onClick={addKeyword}
            className="px-3 py-2 bg-gray-700 text-white rounded-md hover:bg-gray-600 text-sm"
            disabled={isSubmitting}
          >
            Add
          </button>
        </div>
        {formData.keywords && formData.keywords.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {formData.keywords.map((keyword, index) => (
              <span
                key={index}
                className="inline-flex items-center gap-1 px-2 py-1 bg-blue-900/30 text-blue-400 rounded text-xs"
              >
                {keyword}
                <button
                  type="button"
                  onClick={() => removeKeyword(index)}
                  className="hover:text-blue-200"
                  disabled={isSubmitting}
                >
                  x
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Word Count */}
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-1">Target Word Count (optional)</label>
        <input
          type="number"
          value={formData.wordCount || ''}
          onChange={(e) => setFormData({ ...formData, wordCount: e.target.value ? parseInt(e.target.value) : undefined })}
          placeholder="e.g., 1000"
          className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-md text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-green-500"
          disabled={isSubmitting}
        />
      </div>

      {/* Additional Context */}
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-1">Additional Context (optional)</label>
        <textarea
          value={formData.additionalContext}
          onChange={(e) => setFormData({ ...formData, additionalContext: e.target.value })}
          placeholder="Any additional context, references, or specific requirements..."
          rows={2}
          className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-md text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-green-500 resize-none"
          disabled={isSubmitting}
        />
      </div>

      {/* Submit Button */}
      <button
        type="submit"
        disabled={isSubmitting || !formData.title.trim() || !formData.topic.trim()}
        className={`
          w-full px-4 py-2 rounded-md font-medium transition-colors
          ${isSubmitting || !formData.title.trim() || !formData.topic.trim()
            ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
            : 'bg-green-600 text-white hover:bg-green-500'
          }
        `}
      >
        {isSubmitting ? 'Generating Content...' : 'Generate Content'}
      </button>
    </form>
  );
}
