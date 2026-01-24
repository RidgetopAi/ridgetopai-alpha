/**
 * ImageService - Gemini-powered image generation
 * GROW capability enhancement for content workflow
 *
 * Uses Google's Gemini API to generate images from prompts.
 * Follows existing service patterns (mandrelClient.ts).
 *
 * Design:
 * - Graceful degradation: Returns errors instead of throwing
 * - Sequential generation: Avoids rate limiting
 * - Local storage: Saves to configurable filesystem path
 */

import { GoogleGenAI } from '@google/genai';
import { randomUUID } from 'crypto';
import * as fs from 'fs/promises';
import * as path from 'path';
import type {
  ImageStyle,
  ImagePlacement,
  ImagePromptSuggestion,
  GeneratedImage,
  ImageGenerationError,
  TaskResult,
} from './types.js';

// ============================================
// Configuration from Environment
// ============================================

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const IMAGE_STORAGE_PATH = process.env.IMAGE_STORAGE_PATH || '/var/lib/ridgetopai/images';
const IMAGE_PUBLIC_URL_BASE = process.env.IMAGE_PUBLIC_URL_BASE || 'http://localhost:3002/images';

// Gemini model for native image generation
const GEMINI_IMAGE_MODEL = 'gemini-3-pro-image-preview';

// ============================================
// Style Modifiers for Prompts
// ============================================

const STYLE_MODIFIERS: Record<ImageStyle, string> = {
  photorealistic: 'photorealistic, high quality photograph, professional lighting, sharp focus',
  illustration: 'digital illustration, clean lines, vibrant colors, modern design',
  digital_art: 'digital art, modern aesthetic, high detail, artistic composition',
  watercolor: 'watercolor painting style, soft edges, artistic, flowing colors',
  sketch: 'pencil sketch, hand-drawn style, artistic, detailed linework',
  minimalist: 'minimalist design, simple shapes, clean composition, negative space',
  corporate: 'professional corporate style, clean, business appropriate, polished',
  tech: 'technology themed, modern, digital aesthetic, futuristic elements',
};

// ============================================
// Service Configuration
// ============================================

export interface ImageServiceConfig {
  timeoutMs: number;
  retryAttempts: number;
}

const DEFAULT_CONFIG: ImageServiceConfig = {
  timeoutMs: 60000,  // 1 minute per image
  retryAttempts: 2,
};

// ============================================
// Gemini Client Management
// ============================================

let geminiClient: GoogleGenAI | null = null;

/**
 * Get or create the Gemini client
 */
function getGeminiClient(): GoogleGenAI | null {
  if (!GEMINI_API_KEY) {
    console.error('[ImageService] GEMINI_API_KEY not configured');
    return null;
  }

  if (!geminiClient) {
    geminiClient = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
    console.log('[ImageService] Gemini client initialized');
  }

  return geminiClient;
}

/**
 * Check if image generation is available
 */
export function isImageGenerationAvailable(): boolean {
  return !!GEMINI_API_KEY;
}

// ============================================
// Storage Management
// ============================================

/**
 * Ensure the storage directory exists
 */
async function ensureStorageDirectory(): Promise<boolean> {
  try {
    await fs.mkdir(IMAGE_STORAGE_PATH, { recursive: true });
    return true;
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[ImageService] Failed to create storage directory: ${msg}`);
    return false;
  }
}

/**
 * Save image buffer to filesystem
 */
async function saveImage(
  imageId: string,
  buffer: Buffer,
  mimeType: string
): Promise<{ filePath: string; publicUrl: string } | null> {
  try {
    const extension = mimeType.includes('png') ? 'png' : 'jpg';
    const fileName = `${imageId}.${extension}`;
    const filePath = path.join(IMAGE_STORAGE_PATH, fileName);

    await fs.writeFile(filePath, buffer);

    return {
      filePath,
      publicUrl: `${IMAGE_PUBLIC_URL_BASE}/${fileName}`,
    };
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[ImageService] Failed to save image: ${msg}`);
    return null;
  }
}

// ============================================
// Prompt Building
// ============================================

/**
 * Build the full prompt with style modifiers
 */
function buildImagePrompt(
  suggestion: ImagePromptSuggestion,
  defaultStyle: ImageStyle
): string {
  const style = suggestion.style || defaultStyle;
  const styleModifier = STYLE_MODIFIERS[style];

  // Combine description with style for optimal generation
  return `${suggestion.description}. Style: ${styleModifier}. High quality, detailed, visually appealing.`;
}

// ============================================
// Image Generation
// ============================================

/**
 * Generate a single image using Gemini
 */
async function generateSingleImage(
  suggestion: ImagePromptSuggestion,
  defaultStyle: ImageStyle,
  config: ImageServiceConfig
): Promise<TaskResult<GeneratedImage>> {
  const startTime = Date.now();
  const imageId = randomUUID();
  const client = getGeminiClient();

  if (!client) {
    return {
      success: false,
      error: 'Gemini API not configured - set GEMINI_API_KEY environment variable',
      durationMs: Date.now() - startTime,
    };
  }

  const fullPrompt = buildImagePrompt(suggestion, defaultStyle);
  const truncatedPrompt = fullPrompt.length > 100 ? `${fullPrompt.substring(0, 100)}...` : fullPrompt;

  console.log(`[ImageService] Generating image for placement: ${suggestion.placement}`);
  console.log(`[ImageService] Prompt: ${truncatedPrompt}`);

  try {
    // Call Gemini API
    const response = await client.models.generateContent({
      model: GEMINI_IMAGE_MODEL,
      contents: fullPrompt,
    });

    // Find the image part in the response
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const parts = response.candidates?.[0]?.content?.parts as any[];
    const imagePart = parts?.find(
      (part) => part.inlineData?.mimeType?.startsWith('image/')
    );

    if (!imagePart?.inlineData) {
      // Check if we got text instead (model might not support image generation)
      const textPart = parts?.find((part) => part.text);
      if (textPart) {
        console.log(`[ImageService] Model returned text instead of image: ${textPart.text.substring(0, 100)}`);
      }
      return {
        success: false,
        error: 'No image data in Gemini response - model may not support image generation',
        durationMs: Date.now() - startTime,
      };
    }

    // Decode and save the image
    const imageBuffer = Buffer.from(imagePart.inlineData.data, 'base64');
    const mimeType = imagePart.inlineData.mimeType as string;

    const saveResult = await saveImage(imageId, imageBuffer, mimeType);
    if (!saveResult) {
      return {
        success: false,
        error: 'Failed to save generated image to filesystem',
        durationMs: Date.now() - startTime,
      };
    }

    const generatedImage: GeneratedImage = {
      id: imageId,
      prompt: fullPrompt,
      placement: suggestion.placement,
      purpose: suggestion.purpose,
      filePath: saveResult.filePath,
      publicUrl: saveResult.publicUrl,
      mimeType,
      generatedAt: new Date(),
      style: suggestion.style || defaultStyle,
    };

    console.log(`[ImageService] Image generated successfully: ${saveResult.publicUrl}`);

    return {
      success: true,
      data: generatedImage,
      durationMs: Date.now() - startTime,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[ImageService] Failed to generate image: ${errorMessage}`);

    return {
      success: false,
      error: errorMessage,
      durationMs: Date.now() - startTime,
    };
  }
}

/**
 * Generate multiple images from Claude's suggestions
 * Returns all successful images and error details for failed ones
 */
export async function generateImages(
  suggestions: ImagePromptSuggestion[],
  defaultStyle: ImageStyle = 'digital_art',
  config: Partial<ImageServiceConfig> = {}
): Promise<{
  images: GeneratedImage[];
  errors: ImageGenerationError[];
  totalDurationMs: number;
}> {
  const fullConfig = { ...DEFAULT_CONFIG, ...config };
  const startTime = Date.now();
  const images: GeneratedImage[] = [];
  const errors: ImageGenerationError[] = [];

  // Ensure storage directory exists
  const storageReady = await ensureStorageDirectory();
  if (!storageReady) {
    console.error('[ImageService] Storage directory not available');
    return {
      images: [],
      errors: suggestions.map((s) => ({
        prompt: s.description,
        placement: s.placement,
        error: 'Image storage directory not available',
        timestamp: new Date(),
      })),
      totalDurationMs: Date.now() - startTime,
    };
  }

  console.log(`[ImageService] Generating ${suggestions.length} images with style: ${defaultStyle}`);

  // Generate images sequentially to avoid rate limiting
  for (const suggestion of suggestions) {
    const result = await generateSingleImage(suggestion, defaultStyle, fullConfig);

    if (result.success && result.data) {
      images.push(result.data);
    } else {
      errors.push({
        prompt: suggestion.description,
        placement: suggestion.placement,
        error: result.error || 'Unknown error',
        timestamp: new Date(),
      });
    }

    // Small delay between requests to be respectful of rate limits
    if (suggestions.indexOf(suggestion) < suggestions.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }

  const totalDurationMs = Date.now() - startTime;
  console.log(
    `[ImageService] Generation complete: ${images.length} succeeded, ${errors.length} failed (${totalDurationMs}ms)`
  );

  return {
    images,
    errors,
    totalDurationMs,
  };
}

// ============================================
// Utility Functions
// ============================================

/**
 * Delete an image file (used by cleanup cron)
 */
export async function deleteImage(imageId: string): Promise<boolean> {
  try {
    const files = await fs.readdir(IMAGE_STORAGE_PATH);
    const imageFile = files.find((f) => f.startsWith(imageId));

    if (imageFile) {
      await fs.unlink(path.join(IMAGE_STORAGE_PATH, imageFile));
      console.log(`[ImageService] Deleted image: ${imageFile}`);
      return true;
    }

    console.log(`[ImageService] Image not found for deletion: ${imageId}`);
    return false;
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[ImageService] Failed to delete image ${imageId}: ${msg}`);
    return false;
  }
}

/**
 * Get storage path for external use
 */
export function getStoragePath(): string {
  return IMAGE_STORAGE_PATH;
}

/**
 * Get public URL base for external use
 */
export function getPublicUrlBase(): string {
  return IMAGE_PUBLIC_URL_BASE;
}
