import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const projectRoot = process.cwd();
const sourceRoot = join(projectRoot, 'src');
const publicRoot = join(projectRoot, 'public');
const maxBytes = 250 * 1024;
const allowedExtensions = new Set(['.webp', '.avif', '.svg', '.jpg', '.jpeg']);

function sourceFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? sourceFiles(path) : [path];
  });
}

const referencedImages = new Set();
for (const file of sourceFiles(sourceRoot)) {
  const text = readFileSync(file, 'utf8');
  for (const match of text.matchAll(/\/images\/([A-Za-z0-9._-]+)/g)) referencedImages.add(`/images/${match[1]}`);
}

const errors = [];
for (const imageUrl of referencedImages) {
  const extension = imageUrl.slice(imageUrl.lastIndexOf('.')).toLowerCase();
  const assetPath = join(publicRoot, imageUrl.slice(1));
  if (!existsSync(assetPath)) {
    errors.push(`${imageUrl} is referenced but missing from public/.`);
    continue;
  }
  if (!allowedExtensions.has(extension)) errors.push(`${imageUrl} should use WebP, AVIF, SVG or a compressed JPEG—not ${extension}.`);
  const bytes = statSync(assetPath).size;
  if (bytes > maxBytes) errors.push(`${imageUrl} is ${(bytes / 1024).toFixed(0)} KB; keep referenced images at or below 250 KB.`);
}

if (errors.length) {
  console.error('Image performance check failed:\n- ' + errors.join('\n- '));
  process.exit(1);
}

console.log(`Image performance check passed for ${referencedImages.size} referenced assets (≤250 KB).`);
