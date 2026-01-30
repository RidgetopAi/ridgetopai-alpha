/**
 * ContentPanel - Main panel for content generation workflow
 * Instance 12 - First GROW capability
 *
 * This is the primary entry point for the GROW capability.
 * It demonstrates the Inverse Hierarchy model for content:
 * - Human directs (content brief)
 * - AI executes (research, generation)
 * - Human verifies (review, approval)
 */

import { useState } from 'react';
import type { ContentWorkflow, GeneratedImage } from '../../lib/types/content-workflow';
import { CONTENT_STATE_LABELS, FORMAT_LABELS, IMAGE_STYLE_LABELS } from '../../lib/types/content-workflow';
import { useContentWorkflowStore } from '../../stores/content-workflow-store';
import { ContentBriefForm } from './ContentBriefForm';
import { ContentProgress } from './ContentProgress';
import { ContentReview } from './ContentReview';
import { ExpandablePanel } from '../shared/ExpandablePanel';

/**
 * Extract actual content body from potentially JSON-wrapped content
 * Handles cases where Claude output wasn't properly parsed
 */
function extractBody(body: string): string {
  if (!body) return '';

  // Check if body looks like JSON (starts with { or [)
  const trimmed = body.trim();
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try {
      const parsed = JSON.parse(trimmed);
      // If it's a content object, extract the body
      if (parsed.content?.body) {
        return parsed.content.body;
      }
      if (typeof parsed.body === 'string') {
        return parsed.body;
      }
    } catch {
      // Not valid JSON, use as-is
    }
  }

  return body;
}

/**
 * Simple markdown-to-HTML renderer for content preview
 */
function renderMarkdown(markdown: string): string {
  if (!markdown) return '';

  return markdown
    // Headers
    .replace(/^### (.+)$/gm, '<h3 class="text-lg font-semibold text-white mt-4 mb-2">$1</h3>')
    .replace(/^## (.+)$/gm, '<h2 class="text-xl font-bold text-white mt-6 mb-3">$1</h2>')
    .replace(/^# (.+)$/gm, '<h1 class="text-2xl font-bold text-white mt-6 mb-4">$1</h1>')
    // Bold
    .replace(/\*\*(.+?)\*\*/g, '<strong class="font-semibold text-white">$1</strong>')
    // Italic
    .replace(/\*(.+?)\*/g, '<em class="italic">$1</em>')
    // Bullet lists
    .replace(/^- (.+)$/gm, '<li class="ml-4 text-gray-300">$1</li>')
    // Code blocks
    .replace(/```(\w+)?\n([\s\S]*?)```/g, '<pre class="bg-gray-800 p-3 rounded-lg overflow-x-auto my-3"><code class="text-green-400 text-sm">$2</code></pre>')
    // Inline code
    .replace(/`([^`]+)`/g, '<code class="bg-gray-800 px-1 rounded text-green-400 text-sm">$1</code>')
    // Paragraphs (lines not starting with HTML tags)
    .replace(/^(?!<[hlupc])(.+)$/gm, '<p class="text-gray-300 mb-3">$1</p>')
    // Wrap consecutive li elements in ul
    .replace(/(<li[^>]*>.*<\/li>\n?)+/g, '<ul class="list-disc my-3">$&</ul>');
}

export function ContentPanel() {
  const { workflows, activeWorkflow, selectWorkflow, deleteWorkflow } = useContentWorkflowStore();
  const [showForm, setShowForm] = useState(true);

  const handleWorkflowSubmit = (workflowId: string) => {
    setShowForm(false);
    selectWorkflow(workflowId);
  };

  const handleNewWorkflow = () => {
    selectWorkflow(null);
    setShowForm(true);
  };

  // Copy content to clipboard
  const handleCopyContent = (workflow: ContentWorkflow) => {
    const content = workflow.finalContent?.content || workflow.generation?.content;
    if (content) {
      const body = extractBody(content.body || '');
      const text = `# ${content.title}\n\n${body}`;
      navigator.clipboard.writeText(text);
    }
  };

  // Download content as file
  const handleDownload = (workflow: ContentWorkflow, format: 'markdown' | 'html' | 'plain') => {
    // Get the GeneratedContent object - handle potential nested structures
    let content = workflow.finalContent?.content || workflow.generation?.content;
    if (!content) return;

    // Safety check: if content has a nested 'content' property, unwrap it
    // This handles cases where the API response structure might be double-wrapped
    if ('content' in content && typeof (content as { content?: unknown }).content === 'object') {
      content = (content as { content: typeof content }).content;
    }

    // Ensure we have title and body - extract from JSON if needed
    const title = content.title || 'Untitled';
    const body = extractBody(content.body || '');

    let fileContent: string;
    let filename: string;
    let mimeType: string;

    const sanitizedTitle = title.replace(/[^a-z0-9]/gi, '-').toLowerCase();

    const callToAction = content.callToAction || '';

    switch (format) {
      case 'markdown':
        fileContent = `# ${title}\n\n${body}`;
        if (callToAction) {
          fileContent += `\n\n---\n\n**${callToAction}**`;
        }
        filename = `${sanitizedTitle}.md`;
        mimeType = 'text/markdown';
        break;

      case 'html':
        // Convert markdown-style content to basic HTML
        const htmlBody = body
          .replace(/^## (.+)$/gm, '<h2>$1</h2>')
          .replace(/^### (.+)$/gm, '<h3>$1</h3>')
          .replace(/^\*\*(.+)\*\*$/gm, '<p><strong>$1</strong></p>')
          .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
          .replace(/^- (.+)$/gm, '<li>$1</li>')
          .replace(/(<li>.*<\/li>\n?)+/g, '<ul>$&</ul>')
          .replace(/\n\n/g, '</p><p>')
          .replace(/^(?!<[huplo])/gm, '<p>')
          .replace(/(?<![>])$/gm, '</p>');

        fileContent = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 800px; margin: 0 auto; padding: 2rem; line-height: 1.6; }
    h1 { color: #1a1a1a; }
    h2, h3 { color: #333; margin-top: 2rem; }
    p { color: #444; }
    ul { padding-left: 1.5rem; }
    .cta { margin-top: 2rem; padding: 1rem; background: #f0f0f0; border-radius: 8px; }
  </style>
</head>
<body>
  <h1>${title}</h1>
  ${htmlBody}
  ${callToAction ? `<div class="cta"><strong>${callToAction}</strong></div>` : ''}
</body>
</html>`;
        filename = `${sanitizedTitle}.html`;
        mimeType = 'text/html';
        break;

      case 'plain':
        // Strip markdown formatting for plain text
        fileContent = `${title.toUpperCase()}\n${'='.repeat(title.length)}\n\n`;
        fileContent += body
          .replace(/^#{1,6}\s+/gm, '')
          .replace(/\*\*(.+?)\*\*/g, '$1')
          .replace(/\*(.+?)\*/g, '$1')
          .replace(/^- /gm, '• ');
        if (callToAction) {
          fileContent += `\n\n---\n\n${callToAction}`;
        }
        filename = `${sanitizedTitle}.txt`;
        mimeType = 'text/plain';
        break;
    }

    // Create and trigger download
    const blob = new Blob([fileContent], { type: `${mimeType};charset=utf-8` });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Render the workflow detail view
  const renderWorkflowDetail = (workflow: ContentWorkflow) => {
    return (
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-lg font-medium text-white">{workflow.brief.title}</h3>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xs px-2 py-0.5 rounded-full bg-green-500/20 text-green-400">
                {FORMAT_LABELS[workflow.brief.format]}
              </span>
              <span className="text-xs text-gray-500">
                Created {workflow.createdAt.toLocaleTimeString()}
              </span>
            </div>
          </div>
          <button
            onClick={handleNewWorkflow}
            className="text-sm text-green-400 hover:text-green-300"
          >
            + New Content
          </button>
        </div>

        {/* Progress */}
        <ContentProgress currentState={workflow.state} />

        {/* State-specific content */}
        <div className="bg-gray-900/50 rounded-lg p-4">
          {/* Draft state - shouldn't happen here but handle it */}
          {workflow.state === 'draft' && (
            <div className="text-gray-400 text-center py-4">
              Preparing workflow...
            </div>
          )}

          {/* Submitted / Research gathering */}
          {workflow.state === 'submitted' && (
            <div className="text-center py-8">
              <div className="animate-pulse text-blue-400 mb-2">Gathering research...</div>
              <p className="text-gray-500 text-sm">
                Collecting relevant context and research for content
              </p>
            </div>
          )}

          {/* Researching */}
          {workflow.state === 'researching' && (
            <div className="text-center py-8">
              <div className="animate-pulse text-purple-400 mb-2">Researching topic...</div>
              <p className="text-gray-500 text-sm">
                Analyzing topic and gathering insights
              </p>
            </div>
          )}

          {/* Generating */}
          {workflow.state === 'generating' && (
            <div className="text-center py-8">
              <div className="animate-pulse text-green-400 mb-2">Generating content...</div>
              <p className="text-gray-500 text-sm">
                AI is creating your {FORMAT_LABELS[workflow.brief.format].toLowerCase()}
              </p>
            </div>
          )}

          {/* Proposed / Reviewing */}
          {(workflow.state === 'proposed' || workflow.state === 'reviewing') && (
            <ContentReview workflow={workflow} />
          )}

          {/* Refining */}
          {workflow.state === 'refining' && (
            <div className="text-center py-8">
              <div className="animate-pulse text-yellow-400 mb-2">Refining content...</div>
              <p className="text-gray-500 text-sm">
                Applying your feedback and requested changes
              </p>
            </div>
          )}

          {/* Completed */}
          {workflow.state === 'completed' && workflow.finalContent && (
            <ExpandablePanel
              title={`Content: ${workflow.finalContent.content.title}`}
              accent="green"
            >
              <div className="space-y-4">
                <div className="bg-green-900/20 rounded-lg p-4 text-center">
                  <div className="text-green-400 text-lg mb-2">Content Ready!</div>
                  <p className="text-gray-400 text-sm">
                    Your {FORMAT_LABELS[workflow.brief.format].toLowerCase()} is ready to use.
                  </p>
                </div>

                {/* Final Content Preview - Rendered Markdown */}
                <div className="bg-gray-800/50 rounded-lg p-4">
                  <h4 className="text-xl font-bold text-white mb-4">{workflow.finalContent.content.title}</h4>
                  <div
                    className="prose prose-invert max-w-none"
                    dangerouslySetInnerHTML={{
                      __html: renderMarkdown(extractBody(workflow.finalContent.content.body))
                    }}
                  />
                </div>

                {/* Generated Images */}
                {workflow.generation?.images && workflow.generation.images.length > 0 && (
                  <div className="bg-cyan-900/20 rounded-lg p-3">
                    <div className="text-xs text-cyan-400 font-medium mb-3">
                      Generated Images ({workflow.generation.images.length})
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      {workflow.generation.images.map((image: GeneratedImage) => (
                        <div key={image.id} className="bg-gray-800/50 rounded-lg overflow-hidden">
                          <a href={image.publicUrl} target="_blank" rel="noopener noreferrer">
                            <img
                              src={image.publicUrl}
                              alt={image.purpose}
                              className="w-full h-32 object-cover hover:opacity-90 transition-opacity"
                            />
                          </a>
                          <div className="p-2 space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="px-1.5 py-0.5 bg-cyan-900/30 text-cyan-400 rounded text-xs">
                                {image.placement}
                              </span>
                              <span className="px-1.5 py-0.5 bg-gray-700 text-gray-400 rounded text-xs">
                                {IMAGE_STYLE_LABELS[image.style]}
                              </span>
                            </div>
                            <p className="text-xs text-gray-500 line-clamp-2">{image.purpose}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Export options */}
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500">
                    {workflow.finalContent.content.metadata?.wordCount || 0} words
                  </span>
                  <div className="flex gap-2">
                    <span className="text-xs text-gray-500">Download:</span>
                    <button
                      onClick={() => handleDownload(workflow, 'markdown')}
                      className="px-2 py-1 bg-gray-700 text-gray-300 rounded text-xs hover:bg-green-600 hover:text-white transition-colors"
                      title="Download as Markdown"
                    >
                      .MD
                    </button>
                    <button
                      onClick={() => handleDownload(workflow, 'html')}
                      className="px-2 py-1 bg-gray-700 text-gray-300 rounded text-xs hover:bg-green-600 hover:text-white transition-colors"
                      title="Download as HTML"
                    >
                      .HTML
                    </button>
                    <button
                      onClick={() => handleDownload(workflow, 'plain')}
                      className="px-2 py-1 bg-gray-700 text-gray-300 rounded text-xs hover:bg-green-600 hover:text-white transition-colors"
                      title="Download as Plain Text"
                    >
                      .TXT
                    </button>
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => handleCopyContent(workflow)}
                    className="flex-1 px-4 py-2 bg-green-600 text-white rounded-md font-medium hover:bg-green-500 transition-colors"
                  >
                    Copy to Clipboard
                  </button>
                  <button
                    onClick={handleNewWorkflow}
                    className="px-4 py-2 bg-gray-700 text-white rounded-md font-medium hover:bg-gray-600 transition-colors"
                  >
                    New Content
                  </button>
                </div>
              </div>
            </ExpandablePanel>
          )}

          {/* Failed */}
          {workflow.state === 'failed' && workflow.error && (
            <div className="space-y-4">
              <div className="bg-red-900/20 rounded-lg p-4 text-center">
                <div className="text-red-400 text-lg mb-2">Generation Failed</div>
                <p className="text-gray-400 text-sm">{workflow.error.message}</p>
                <p className="text-gray-500 text-xs mt-1">
                  Failed at: {CONTENT_STATE_LABELS[workflow.error.step]}
                </p>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={handleNewWorkflow}
                  className="flex-1 px-4 py-2 bg-green-600 text-white rounded-md font-medium hover:bg-green-500 transition-colors"
                >
                  Try Again
                </button>
                <button
                  onClick={() => deleteWorkflow(workflow.id)}
                  className="px-4 py-2 bg-gray-700 text-gray-300 rounded-md font-medium hover:bg-gray-600 transition-colors"
                >
                  Delete
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="bg-gray-900 rounded-lg border border-gray-800 overflow-hidden h-full flex flex-col">
      {/* Panel Header */}
      <div className="px-4 py-3 border-b border-gray-800 bg-gray-900/50">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium text-white">Content Generation</h2>
          <span className="text-xs px-2 py-0.5 rounded-full bg-green-500/20 text-green-400">
            GROW
          </span>
        </div>
      </div>

      {/* Panel Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {/* Show form if no active workflow or explicitly showing form */}
        {showForm && !activeWorkflow ? (
          <div className="space-y-4">
            <p className="text-sm text-gray-400">
              Create content with AI assistance. Describe what you need and review the generated content before publishing.
            </p>
            <ContentBriefForm onSubmit={handleWorkflowSubmit} />
          </div>
        ) : activeWorkflow ? (
          renderWorkflowDetail(activeWorkflow)
        ) : (
          // Fallback - show recent workflows or empty state
          <div className="text-center py-8">
            {workflows.length > 0 ? (
              <div className="space-y-4">
                <p className="text-gray-400">Select a workflow or start a new one.</p>
                <button
                  onClick={handleNewWorkflow}
                  className="px-4 py-2 bg-green-600 text-white rounded-md font-medium hover:bg-green-500 transition-colors"
                >
                  New Content
                </button>
                <div className="mt-4 space-y-2">
                  {workflows.slice(-5).map((workflow) => (
                    <button
                      key={workflow.id}
                      onClick={() => {
                        selectWorkflow(workflow.id);
                        setShowForm(false);
                      }}
                      className="w-full text-left px-3 py-2 bg-gray-800 rounded-md hover:bg-gray-700 transition-colors"
                    >
                      <div className="text-sm text-white">{workflow.brief.title}</div>
                      <div className="text-xs text-gray-500">
                        {CONTENT_STATE_LABELS[workflow.state]} • {FORMAT_LABELS[workflow.brief.format]}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-gray-400">No content workflows yet.</p>
                <button
                  onClick={handleNewWorkflow}
                  className="px-4 py-2 bg-green-600 text-white rounded-md font-medium hover:bg-green-500 transition-colors"
                >
                  Create Content
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
