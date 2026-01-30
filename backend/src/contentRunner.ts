/**
 * ContentRunner - Executes content generation tasks via Claude CLI
 * Instance 12 - First GROW capability
 *
 * Design principles:
 * - Uses claude CLI (like taskRunner) for full generation capability
 * - Structured prompts for different content formats
 * - Returns structured content for UI parsing
 * - Supports refinement based on human feedback
 */

import { spawn, type ChildProcess } from 'child_process';
import type {
  ContentBrief,
  ContentGenerationResult,
  ContentGenerationResultWithImages,
  ContentRefinementResult,
  GeneratedContent,
  ImagePromptSuggestion,
  ImageStyle,
  TaskResult,
  Confidence,
} from './types.js';
import { getContextForContentGeneration, storeWorkflowCompletion, type WorkflowCompletion } from './mandrelClient.js';

export interface ContentRunnerConfig {
  timeoutMs: number;
  brandContext?: string;
}

const DEFAULT_CONFIG: ContentRunnerConfig = {
  timeoutMs: 590000, // 9m50s - slightly less than nginx 600s to avoid race condition
};

// Format-specific guidance
const FORMAT_GUIDANCE: Record<string, string> = {
  blog_post: `
- Write an engaging introduction that hooks the reader
- Use clear section headers (H2, H3)
- Include practical examples and code snippets if relevant
- Write a conclusion with a clear takeaway
- Keep paragraphs short (3-4 sentences max)
- Aim for 800-1500 words unless specified otherwise`,

  tweet_thread: `
- First tweet should be a hook that stands alone
- Each tweet should be under 280 characters
- Use numbered tweets (1/, 2/, etc.)
- End with a call to action
- Aim for 5-10 tweets unless specified
- Make each tweet valuable on its own`,

  documentation: `
- Start with a clear purpose statement
- Include prerequisites if applicable
- Use step-by-step instructions
- Include code examples with comments
- Add troubleshooting tips
- Keep language precise and technical`,

  email: `
- Clear, actionable subject line suggestion
- Brief, focused body (under 200 words ideal)
- One clear call to action
- Professional but warm tone
- Easy to scan with short paragraphs`,

  announcement: `
- Lead with the news/value proposition
- Explain why it matters to the reader
- Include key details (dates, links, etc.)
- Clear call to action
- Keep concise but complete`,

  case_study: `
- Start with the challenge/problem
- Describe the solution implemented
- Include measurable results
- Add quotes if context available
- Structure: Challenge → Solution → Results → Conclusion`,
};

// Audience-specific guidance
const AUDIENCE_GUIDANCE: Record<string, string> = {
  developers: 'Use technical terminology, include code examples, be precise about implementations.',
  business: 'Focus on outcomes and ROI, avoid jargon, use metrics and business language.',
  general: 'Use accessible language, explain concepts simply, avoid assumptions about background.',
  internal: 'Be direct and efficient, reference internal context, skip external marketing polish.',
};

// Tone-specific guidance
const TONE_GUIDANCE: Record<string, string> = {
  professional: 'Maintain formal language, cite sources where applicable, be authoritative.',
  conversational: 'Use "you" and "we", write like talking to a friend, include personality.',
  technical: 'Be precise, use correct terminology, include detailed specifications.',
  educational: 'Explain concepts step-by-step, use analogies, check understanding with examples.',
};

/**
 * Build the content generation prompt
 * Instance 13: Added mandrelContext parameter for institutional memory
 */
function buildContentGenerationPrompt(brief: ContentBrief, brandContext?: string, mandrelContext?: string): string {
  const formatGuide = FORMAT_GUIDANCE[brief.format] || '';
  const audienceGuide = AUDIENCE_GUIDANCE[brief.audience] || '';
  const toneGuide = TONE_GUIDANCE[brief.tone] || '';

  const keyPointsSection = brief.keyPoints && brief.keyPoints.length > 0
    ? `**Key Points to Cover:**\n${brief.keyPoints.map((p, i) => `${i + 1}. ${p}`).join('\n')}\n`
    : '';

  const keywordsSection = brief.keywords && brief.keywords.length > 0
    ? `**Target Keywords:** ${brief.keywords.join(', ')}\n`
    : '';

  const wordCountSection = brief.wordCount
    ? `**Target Word Count:** ${brief.wordCount} words\n`
    : '';

  const brandSection = brandContext
    ? `**Brand Voice Guidelines:**\n${brandContext}\n`
    : '';

  // Instance 13: Add Mandrel context section
  const mandrelSection = mandrelContext || '';

  return `You are a professional content creator generating high-quality content.
${mandrelSection}

## Content Brief

**Title/Topic:** ${brief.title}

**Subject:** ${brief.topic}

**Format:** ${brief.format.replace('_', ' ')}

**Target Audience:** ${brief.audience}

**Tone:** ${brief.tone}

${keyPointsSection}
${keywordsSection}
${wordCountSection}
${brief.additionalContext ? `**Additional Context:**\n${brief.additionalContext}\n` : ''}
${brandSection}

## Format Guidelines
${formatGuide}

## Audience Guidelines
${audienceGuide}

## Tone Guidelines
${toneGuide}

## Your Task

1. Generate complete, ready-to-use content based on this brief
2. Match the specified format, audience, and tone
3. Make the content engaging and valuable
4. Include all key points if specified
${brief.generateImages ? `5. Suggest ${brief.maxImages || 3} images to enhance the content (see Image Suggestions section)` : ''}
${brief.generateImages ? `
## Image Suggestions

Since images are requested for this content, suggest compelling images that would enhance reader engagement.

For each image, provide:
1. A detailed description that can be used as a prompt for AI image generation (50-100 words, be specific about composition, subjects, colors, mood)
2. Placement: where in the content the image should appear (hero, section-1, section-2, section-3, callout, or conclusion)
3. Purpose: why this image enhances the content (e.g., "illustrates the main concept", "breaks up text", "adds visual interest")
${brief.imageStyle ? `4. Use the "${brief.imageStyle}" style for all images` : '4. Suggest an appropriate style for each image'}

Make image descriptions vivid and specific - they will be used to generate actual images via AI.
` : ''}
## Output Format

You MUST respond with a JSON object in this exact format (and nothing else):

\`\`\`json
{
  "content": {
    "title": "The polished title for the content",
    "body": "The complete content body in markdown format",
    "summary": "A 1-2 sentence summary (optional)",
    "callToAction": "Clear call to action if applicable (optional)",
    "metadata": {
      "wordCount": <number>,
      "readTime": <estimated minutes>,
      "targetKeywords": ["keywords", "used"]
    }
  },
  "confidence": "high" | "medium" | "low",
  "suggestions": ["Optional suggestions for improving or repurposing this content"],
  "alternatives": [
    {
      "title": "Alternative title or angle",
      "approach": "Brief description of the alternative approach"
    }
  ]${brief.generateImages ? `,
  "imagePrompts": [
    {
      "description": "Detailed description for AI image generation (50-100 words)",
      "placement": "hero" | "section-1" | "section-2" | "section-3" | "callout" | "conclusion",
      "purpose": "Why this image enhances the content",
      "style": "photorealistic" | "illustration" | "digital_art" | "watercolor" | "sketch" | "minimalist" | "corporate" | "tech"
    }
  ]` : ''}
}
\`\`\`

Important:
- Generate complete, publish-ready content
- Use markdown formatting in the body
- Be creative but stay within the brief parameters
- If the brief is unclear or incomplete, do your best and note it in suggestions${brief.generateImages ? `
- Image descriptions should be detailed enough for AI image generation
- Place the hero image at the top, other images to break up long sections` : ''}`;
}

/**
 * Build the content refinement prompt
 */
function buildContentRefinementPrompt(
  original: GeneratedContent,
  feedback: string,
  specificEdits?: string[]
): string {
  const editsSection = specificEdits && specificEdits.length > 0
    ? `**Specific Edits Requested:**\n${specificEdits.map((e, i) => `${i + 1}. ${e}`).join('\n')}\n`
    : '';

  return `You are refining existing content based on human feedback.

## Original Content

**Title:** ${original.title}

**Body:**
${original.body}

${original.summary ? `**Summary:** ${original.summary}\n` : ''}
${original.callToAction ? `**Call to Action:** ${original.callToAction}\n` : ''}

## Feedback to Address

${feedback}

${editsSection}

## Your Task

1. Revise the content based on the feedback
2. Apply specific edits if requested
3. Maintain the original structure unless changes are needed
4. Document what changes you made

## Output Format

You MUST respond with a JSON object in this exact format (and nothing else):

\`\`\`json
{
  "content": {
    "title": "The revised title",
    "body": "The complete revised content in markdown format",
    "summary": "Revised summary if applicable",
    "callToAction": "Revised call to action if applicable",
    "metadata": {
      "wordCount": <number>,
      "readTime": <estimated minutes>
    }
  },
  "changesApplied": [
    "List of specific changes you made",
    "Each change as a separate string"
  ]
}
\`\`\`

Important:
- Only make changes that address the feedback
- Don't add new content unless requested
- Preserve the original tone and style
- Be specific about what you changed`;
}

/**
 * Attempt to repair malformed JSON (common issues from LLM output)
 * - Escapes literal newlines inside string values
 * - Fixes trailing commas
 * - Handles unescaped backslashes
 */
function repairJson(jsonStr: string): string {
  // Strategy: Find string values and escape newlines within them
  // This regex-based approach handles most common cases
  let repaired = jsonStr;

  // Escape literal newlines inside strings (but not \n which is already escaped)
  // Match strings and process their contents
  repaired = repaired.replace(/"([^"\\]|\\.)*"/g, (match) => {
    // Inside the string, replace actual newlines with \n
    return match.replace(/\n/g, '\\n').replace(/\r/g, '\\r').replace(/\t/g, '\\t');
  });

  // Remove trailing commas before } or ]
  repaired = repaired.replace(/,(\s*[}\]])/g, '$1');

  return repaired;
}

/**
 * Try to extract content from malformed/truncated JSON by finding key fields
 */
function extractContentFromBrokenJson(jsonStr: string): { title?: string; body?: string } | null {
  // Try to extract title
  const titleMatch = jsonStr.match(/"title"\s*:\s*"([^"]+)"/);

  // Try to extract body - handle truncated JSON where closing quote may be missing
  // Look for "body": " and extract everything reasonable after it
  const bodyStartMatch = jsonStr.match(/"body"\s*:\s*"/);
  if (!bodyStartMatch) return titleMatch ? { title: titleMatch[1] } : null;

  const bodyStart = bodyStartMatch.index! + bodyStartMatch[0].length;
  let bodyEnd = jsonStr.length; // Default to end if no closing quote found
  let escaped = false;
  let foundClose = false;

  // Find the end of the body string, handling escapes
  for (let i = bodyStart; i < jsonStr.length; i++) {
    const char = jsonStr[i];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (char === '\\') {
      escaped = true;
      continue;
    }
    if (char === '"') {
      bodyEnd = i;
      foundClose = true;
      break;
    }
  }

  // If no closing quote found (truncated), try to find a reasonable end point
  // Look for common JSON patterns that indicate body ended
  if (!foundClose) {
    // Try to find where the body likely ends - before ",\n  " or similar patterns
    const possibleEnds = [
      jsonStr.lastIndexOf('",'),
      jsonStr.lastIndexOf('"\n'),
      jsonStr.lastIndexOf('"}'),
    ].filter(i => i > bodyStart);

    if (possibleEnds.length > 0) {
      bodyEnd = Math.max(...possibleEnds);
    }
    console.log(`[ContentRunner] Body extraction: truncated JSON, using best-effort end at position ${bodyEnd}`);
  }

  let body = jsonStr.slice(bodyStart, bodyEnd);

  // Unescape JSON string escapes
  body = body
    .replace(/\\n/g, '\n')
    .replace(/\\r/g, '\r')
    .replace(/\\t/g, '\t')
    .replace(/\\"/g, '"')
    .replace(/\\\\/g, '\\');

  console.log(`[ContentRunner] Extracted body length: ${body.length} chars`);

  return {
    title: titleMatch ? titleMatch[1] : undefined,
    body: body || undefined,
  };
}

/**
 * Parse content generation output
 * Updated to extract imagePrompts for image generation
 * Enhanced with robust JSON repair for LLM output
 */
function parseContentGenerationOutput(output: string): ContentGenerationResultWithImages {
  // Try to find JSON in the output
  const jsonMatch = output.match(/```json\s*([\s\S]*?)\s*```/);

  const jsonStr = jsonMatch ? jsonMatch[1] : output.trim();

  // Strategy 1: Try direct parse
  try {
    const parsed = JSON.parse(jsonStr);
    console.log('[ContentRunner] JSON parsed successfully (direct)');
    return buildResult(parsed, output, 'medium');
  } catch (e1) {
    console.log('[ContentRunner] Direct parse failed, trying repair...');

    // Strategy 2: Try with JSON repair
    try {
      const repaired = repairJson(jsonStr);
      const parsed = JSON.parse(repaired);
      console.log('[ContentRunner] JSON parsed successfully (repaired)');
      return buildResult(parsed, output, 'medium');
    } catch (e2) {
      console.log('[ContentRunner] Repair parse failed, trying extraction...');

      // Strategy 3: Extract key fields from broken JSON
      const extracted = extractContentFromBrokenJson(jsonStr);
      if (extracted && (extracted.title || extracted.body)) {
        console.log('[ContentRunner] Extracted content from broken JSON');
        return {
          content: {
            title: extracted.title || 'Generated Content',
            body: extracted.body || '',
            metadata: {
              wordCount: (extracted.body || '').split(/\s+/).length,
            },
          },
          confidence: 'low',
          rawOutput: output,
        };
      }

      // Strategy 4: Final fallback - return raw output
      console.error('[ContentRunner] All parse strategies failed');
      return {
        content: {
          title: 'Generated Content',
          body: output,
          metadata: {
            wordCount: output.split(/\s+/).length,
          },
        },
        confidence: 'low',
        rawOutput: output,
      };
    }
  }
}

/**
 * Helper to build result from parsed JSON
 */
function buildResult(
  parsed: Record<string, unknown>,
  rawOutput: string,
  defaultConfidence: Confidence
): ContentGenerationResultWithImages {
  const content = parsed.content as Record<string, unknown> | undefined;
  const bodyText = (content?.body as string) || '';
  const meta = content?.metadata as { wordCount?: number; readTime?: number; targetKeywords?: string[] } | undefined;

  return {
    content: {
      title: (content?.title as string) || 'Untitled',
      body: bodyText,
      summary: content?.summary as string | undefined,
      callToAction: content?.callToAction as string | undefined,
      metadata: {
        wordCount: meta?.wordCount ?? bodyText.split(/\s+/).length,
        readTime: meta?.readTime,
        targetKeywords: meta?.targetKeywords,
      },
    },
    confidence: (parsed.confidence as Confidence) || defaultConfidence,
    suggestions: parsed.suggestions as string[] | undefined,
    alternatives: parsed.alternatives as { title: string; approach: string }[] | undefined,
    imagePrompts: parsed.imagePrompts as ImagePromptSuggestion[] | undefined,
    rawOutput,
  };
}

/**
 * Parse content refinement output
 */
function parseContentRefinementOutput(output: string): ContentRefinementResult {
  const jsonMatch = output.match(/```json\s*([\s\S]*?)\s*```/);

  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[1]);
      return {
        content: {
          title: parsed.content?.title || 'Untitled',
          body: parsed.content?.body || '',
          summary: parsed.content?.summary,
          callToAction: parsed.content?.callToAction,
          metadata: parsed.content?.metadata,
        },
        changesApplied: parsed.changesApplied || [],
        rawOutput: output,
      };
    } catch (e) {
      console.error('[ContentRunner] Failed to parse refinement JSON:', e);
    }
  }

  // Fallback
  try {
    const parsed = JSON.parse(output.trim());
    return {
      content: parsed.content || { title: 'Refined Content', body: output },
      changesApplied: parsed.changesApplied || ['Unknown changes applied'],
      rawOutput: output,
    };
  } catch {
    return {
      content: {
        title: 'Refined Content',
        body: output,
        metadata: {
          wordCount: output.split(/\s+/).length,
        },
      },
      changesApplied: ['Unable to parse changes'],
      rawOutput: output,
    };
  }
}

/**
 * Execute content generation using Claude CLI
 * Instance 13: Added Mandrel context retrieval for institutional memory
 * Image Generation: Added Gemini image generation when brief.generateImages is true
 */
export async function runContentGeneration(
  brief: ContentBrief,
  config: Partial<ContentRunnerConfig> = {}
): Promise<TaskResult<ContentGenerationResultWithImages>> {
  const { timeoutMs, brandContext } = { ...DEFAULT_CONFIG, ...config };
  const startTime = Date.now();

  // Instance 13: Query Mandrel for relevant previous content
  let mandrelContext = '';
  try {
    console.log('[ContentRunner] Querying Mandrel for relevant context...');
    mandrelContext = await getContextForContentGeneration(brief);
    if (mandrelContext) {
      console.log('[ContentRunner] Found relevant content history from Mandrel');
    }
  } catch (error) {
    console.warn('[ContentRunner] Mandrel context retrieval failed (continuing without):', error);
  }

  const prompt = buildContentGenerationPrompt(brief, brandContext, mandrelContext);

  return new Promise((resolve) => {
    let stdout = '';
    let stderr = '';
    let killed = false;
    let timeoutHandle: ReturnType<typeof setTimeout> | null = null;

    console.log(`[ContentRunner] Starting content generation: ${brief.title}`);
    console.log(`[ContentRunner] Format: ${brief.format}, Audience: ${brief.audience}`);
    console.log(`[ContentRunner] Timeout: ${timeoutMs}ms`);

    // Spawn claude CLI - pass prompt via stdin to avoid CLI argument length limits
    const child: ChildProcess = spawn('claude', [
      '--print',
      '--dangerously-skip-permissions',
    ], {
      env: process.env,
      stdio: ['pipe', 'pipe', 'pipe'], // stdin is pipe, not ignore
    });

    // Write prompt to stdin (avoids shell argument truncation for large prompts)
    child.stdin?.write(prompt);
    child.stdin?.end();

    const cleanup = () => {
      if (timeoutHandle) {
        clearTimeout(timeoutHandle);
        timeoutHandle = null;
      }
    };

    child.stdout?.on('data', (data) => {
      const chunk = data.toString();
      stdout += chunk;
      if (stdout.length % 1000 < 100) {
        console.log(`[ContentRunner] Received ${stdout.length} bytes of output...`);
      }
    });

    child.stderr?.on('data', (data) => {
      const chunk = data.toString();
      stderr += chunk;
      if (chunk.includes('error') || chunk.includes('Error')) {
        console.error(`[ContentRunner] stderr: ${chunk}`);
      }
    });

    child.on('error', (err) => {
      cleanup();
      console.error(`[ContentRunner] Spawn error: ${err.message}`);
      resolve({
        success: false,
        error: `Failed to spawn claude CLI: ${err.message}`,
        durationMs: Date.now() - startTime,
      });
    });

    child.on('close', (code) => {
      cleanup();
      const durationMs = Date.now() - startTime;

      if (killed) {
        console.log('[ContentRunner] Process killed due to timeout');
        resolve({
          success: false,
          error: 'Content generation timed out',
          durationMs,
        });
        return;
      }

      console.log(`[ContentRunner] Claude CLI exited with code ${code}`);
      console.log(`[ContentRunner] Generation completed in ${durationMs}ms`);

      if (code !== 0) {
        resolve({
          success: false,
          error: `Claude CLI exited with code ${code}: ${stderr || stdout}`,
          durationMs,
        });
        return;
      }

      // Parse the output
      const result = parseContentGenerationOutput(stdout);

      // Image generation phase (if requested)
      // Wrap in async IIFE since close handler is not async
      (async () => {
        if (brief.generateImages && result.imagePrompts && result.imagePrompts.length > 0) {
          console.log(`[ContentRunner] Image generation requested, found ${result.imagePrompts.length} prompts`);

          try {
            // Dynamic import to avoid circular dependencies and only load when needed
            const { generateImages, isImageGenerationAvailable } = await import('./imageService.js');

            if (isImageGenerationAvailable()) {
              console.log(`[ContentRunner] Generating images with style: ${brief.imageStyle || 'digital_art'}`);

              const imageResult = await generateImages(
                result.imagePrompts,
                brief.imageStyle || 'digital_art'
              );

              result.images = imageResult.images;
              result.imageErrors = imageResult.errors;

              console.log(`[ContentRunner] Image generation complete: ${imageResult.images.length} succeeded, ${imageResult.errors.length} failed`);
            } else {
              console.warn('[ContentRunner] Image generation requested but Gemini API not configured');
              result.imageErrors = result.imagePrompts.map((p) => ({
                prompt: p.description,
                placement: p.placement,
                error: 'Gemini API not configured - set GEMINI_API_KEY environment variable',
                timestamp: new Date(),
              }));
            }
          } catch (imageError) {
            const errorMsg = imageError instanceof Error ? imageError.message : 'Unknown image generation error';
            console.error(`[ContentRunner] Image generation failed: ${errorMsg}`);
            result.imageErrors = result.imagePrompts.map((p) => ({
              prompt: p.description,
              placement: p.placement,
              error: errorMsg,
              timestamp: new Date(),
            }));
          }
        }

        const totalDurationMs = Date.now() - startTime;
        resolve({
          success: true,
          data: result,
          durationMs: totalDurationMs,
        });
      })();
    });

    // Set timeout
    timeoutHandle = setTimeout(() => {
      killed = true;
      console.log(`[ContentRunner] Timeout reached (${timeoutMs}ms), killing process`);
      child.kill('SIGTERM');

      setTimeout(() => {
        if (!child.killed) {
          child.kill('SIGKILL');
        }
      }, 5000);
    }, timeoutMs);
  });
}

/**
 * Execute content refinement using Claude CLI
 */
export async function runContentRefinement(
  original: GeneratedContent,
  feedback: string,
  specificEdits?: string[],
  config: Partial<ContentRunnerConfig> = {}
): Promise<TaskResult<ContentRefinementResult>> {
  const { timeoutMs } = { ...DEFAULT_CONFIG, ...config };
  const startTime = Date.now();

  const prompt = buildContentRefinementPrompt(original, feedback, specificEdits);

  return new Promise((resolve) => {
    let stdout = '';
    let stderr = '';
    let killed = false;
    let timeoutHandle: ReturnType<typeof setTimeout> | null = null;

    console.log(`[ContentRunner] Starting content refinement: ${original.title}`);
    console.log(`[ContentRunner] Feedback: ${feedback.substring(0, 50)}...`);
    console.log(`[ContentRunner] Timeout: ${timeoutMs}ms`);

    // Spawn claude CLI - pass prompt via stdin to avoid CLI argument length limits
    const child: ChildProcess = spawn('claude', [
      '--print',
      '--dangerously-skip-permissions',
    ], {
      env: process.env,
      stdio: ['pipe', 'pipe', 'pipe'], // stdin is pipe, not ignore
    });

    // Write prompt to stdin (avoids shell argument truncation for large prompts)
    child.stdin?.write(prompt);
    child.stdin?.end();

    const cleanup = () => {
      if (timeoutHandle) {
        clearTimeout(timeoutHandle);
        timeoutHandle = null;
      }
    };

    child.stdout?.on('data', (data) => {
      const chunk = data.toString();
      stdout += chunk;
      if (stdout.length % 1000 < 100) {
        console.log(`[ContentRunner] Refinement: ${stdout.length} bytes received...`);
      }
    });

    child.stderr?.on('data', (data) => {
      const chunk = data.toString();
      stderr += chunk;
      if (chunk.includes('error') || chunk.includes('Error')) {
        console.error(`[ContentRunner] Refinement stderr: ${chunk}`);
      }
    });

    child.on('error', (err) => {
      cleanup();
      console.error(`[ContentRunner] Refinement spawn error: ${err.message}`);
      resolve({
        success: false,
        error: `Failed to spawn claude CLI: ${err.message}`,
        durationMs: Date.now() - startTime,
      });
    });

    child.on('close', (code) => {
      cleanup();
      const durationMs = Date.now() - startTime;

      if (killed) {
        console.log('[ContentRunner] Refinement killed due to timeout');
        resolve({
          success: false,
          error: 'Content refinement timed out',
          durationMs,
        });
        return;
      }

      console.log(`[ContentRunner] Refinement CLI exited with code ${code}`);
      console.log(`[ContentRunner] Refinement completed in ${durationMs}ms`);

      if (code !== 0) {
        resolve({
          success: false,
          error: `Claude CLI exited with code ${code}: ${stderr || stdout}`,
          durationMs,
        });
        return;
      }

      // Parse the output
      const result = parseContentRefinementOutput(stdout);

      resolve({
        success: true,
        data: result,
        durationMs,
      });
    });

    // Set timeout
    timeoutHandle = setTimeout(() => {
      killed = true;
      console.log(`[ContentRunner] Refinement timeout reached (${timeoutMs}ms), killing process`);
      child.kill('SIGTERM');

      setTimeout(() => {
        if (!child.killed) {
          child.kill('SIGKILL');
        }
      }, 5000);
    }, timeoutMs);
  });
}

/**
 * Store a completed content generation workflow to Mandrel for institutional memory
 * Instance 13: Added for cross-workflow learning
 */
export async function storeContentCompletion(
  workflowId: string,
  brief: ContentBrief,
  generation: ContentGenerationResult,
  review?: { decision: 'approved' | 'rejected' | 'needs_revision'; feedback?: string }
): Promise<boolean> {
  console.log(`[ContentRunner] Storing content completion: ${workflowId}`);

  const completion: WorkflowCompletion = {
    type: 'content',
    capability: 'GROW',
    workflowId,
    input: brief,
    output: generation,
    review: review ? {
      decision: review.decision === 'needs_revision' ? 'changes_requested' : review.decision,
      feedback: review.feedback,
    } : undefined,
    completedAt: new Date(),
  };

  try {
    const stored = await storeWorkflowCompletion(completion);
    if (stored) {
      console.log(`[ContentRunner] Content completion stored to Mandrel`);
    }
    return stored;
  } catch (error) {
    console.warn('[ContentRunner] Failed to store completion to Mandrel:', error);
    return false;
  }
}
