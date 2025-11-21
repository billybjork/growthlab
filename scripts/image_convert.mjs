#!/usr/bin/env node

/**
 * Image Converter for GrowthLab Viewer
 *
 * Converts raw images from media_raw/session-XX/ to optimized WebP images
 * in media/session-XX/ using the sharp library.
 *
 * Usage:
 *   node scripts/image_convert.mjs session-02
 *
 * Prerequisites:
 *   npm install sharp
 */

import fs from 'fs';
import path from 'path';
import sharp from 'sharp';

const RAW_ROOT = 'media_raw';
const OUT_ROOT = 'media';
const MAX_WIDTH = 1600;
const QUALITY = 75;

/**
 * Process all images in a session directory
 */
async function processDir(sessionId) {
  const inputDir = path.join(RAW_ROOT, sessionId);
  const outputDir = path.join(OUT_ROOT, sessionId);

  // Check if input directory exists
  if (!fs.existsSync(inputDir)) {
    console.error(`Error: Directory not found: ${inputDir}`);
    process.exit(1);
  }

  // Create output directory if it doesn't exist
  fs.mkdirSync(outputDir, { recursive: true });

  const files = fs.readdirSync(inputDir);
  const supportedExts = ['.png', '.jpg', '.jpeg', '.gif'];

  console.log(`Processing images from ${inputDir}...`);

  for (const file of files) {
    const ext = path.extname(file).toLowerCase();

    // Skip unsupported file types
    if (!supportedExts.includes(ext)) {
      console.log(`⊘ Skipping: ${file} (unsupported format)`);
      continue;
    }

    const inPath = path.join(inputDir, file);
    const base = path.basename(file, ext);

    try {
      // Convert all images to WebP format
      const outPath = path.join(outputDir, `${base}.webp`);

      await sharp(inPath)
        .resize({ width: MAX_WIDTH, withoutEnlargement: true })
        .webp({ quality: QUALITY })
        .toFile(outPath);

      const inSize = fs.statSync(inPath).size;
      const outSize = fs.statSync(outPath).size;
      const saved = (((inSize - outSize) / inSize) * 100).toFixed(1);

      console.log(`✓ ${file} → ${base}.webp (saved ${saved}%)`);
    } catch (error) {
      console.error(`✗ Error converting ${file}: ${error.message}`);
    }
  }

  console.log(`\nConversion complete! Check ${outputDir}/`);
}

/**
 * Main entry point
 */
const sessionId = process.argv[2];

if (!sessionId) {
  console.error('Usage: node scripts/image_convert.mjs SESSION_ID');
  console.error('Example: node scripts/image_convert.mjs session-02');
  process.exit(1);
}

processDir(sessionId).catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
