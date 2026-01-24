/**
 * ImageCleanup - Automated cleanup of old generated images
 *
 * This script is designed to run as a cron job to delete images
 * older than the configured retention period.
 *
 * Usage:
 *   npm run cleanup:images
 *   # or via cron:
 *   0 3 * * * cd /path/to/backend && npm run cleanup:images
 *
 * Environment Variables:
 *   IMAGE_STORAGE_PATH - Directory containing generated images
 *   IMAGE_RETENTION_DAYS - Number of days to retain images (default: 60)
 */

import * as fs from 'fs/promises';
import * as path from 'path';

// Configuration from environment
const IMAGE_STORAGE_PATH = process.env.IMAGE_STORAGE_PATH || '/var/lib/ridgetopai/images';
const RETENTION_DAYS = parseInt(process.env.IMAGE_RETENTION_DAYS || '60', 10);

/**
 * Clean up images older than retention period
 */
async function cleanupOldImages(): Promise<void> {
  const startTime = Date.now();
  console.log(`[ImageCleanup] Starting cleanup at ${new Date().toISOString()}`);
  console.log(`[ImageCleanup] Storage path: ${IMAGE_STORAGE_PATH}`);
  console.log(`[ImageCleanup] Retention period: ${RETENTION_DAYS} days`);

  try {
    // Check if directory exists
    try {
      await fs.access(IMAGE_STORAGE_PATH);
    } catch {
      console.log('[ImageCleanup] Storage directory does not exist, nothing to clean');
      return;
    }

    // Read all files in the directory
    const files = await fs.readdir(IMAGE_STORAGE_PATH);
    console.log(`[ImageCleanup] Found ${files.length} files in storage directory`);

    if (files.length === 0) {
      console.log('[ImageCleanup] No files to process');
      return;
    }

    const now = Date.now();
    const retentionMs = RETENTION_DAYS * 24 * 60 * 60 * 1000;
    const cutoffDate = new Date(now - retentionMs);

    console.log(`[ImageCleanup] Deleting files older than ${cutoffDate.toISOString()}`);

    let deletedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;
    let totalBytesDeleted = 0;

    for (const file of files) {
      const filePath = path.join(IMAGE_STORAGE_PATH, file);

      try {
        const stats = await fs.stat(filePath);

        // Skip directories
        if (stats.isDirectory()) {
          skippedCount++;
          continue;
        }

        // Check if file is older than retention period
        if (now - stats.mtimeMs > retentionMs) {
          await fs.unlink(filePath);
          deletedCount++;
          totalBytesDeleted += stats.size;
          console.log(`[ImageCleanup] Deleted: ${file} (${formatBytes(stats.size)}, modified ${stats.mtime.toISOString()})`);
        } else {
          skippedCount++;
        }
      } catch (error) {
        errorCount++;
        const msg = error instanceof Error ? error.message : 'Unknown error';
        console.error(`[ImageCleanup] Error processing ${file}: ${msg}`);
      }
    }

    const duration = Date.now() - startTime;
    console.log(`[ImageCleanup] Cleanup complete in ${duration}ms`);
    console.log(`[ImageCleanup] Summary: ${deletedCount} deleted, ${skippedCount} retained, ${errorCount} errors`);
    console.log(`[ImageCleanup] Space recovered: ${formatBytes(totalBytesDeleted)}`);

  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[ImageCleanup] Fatal error: ${msg}`);
    process.exit(1);
  }
}

/**
 * Format bytes to human readable string
 */
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

// Run the cleanup
cleanupOldImages()
  .then(() => {
    console.log('[ImageCleanup] Cleanup job finished successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('[ImageCleanup] Cleanup job failed:', error);
    process.exit(1);
  });
