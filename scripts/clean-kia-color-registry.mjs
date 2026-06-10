#!/usr/bin/env node
/**
 * Bereinigt doppelte/fehlerhafte Farb-Slugs in kiaModelImages.json + Dateien.
 *
 *   npm run clean:kia-colors
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { canonicalizeKiaColorSlug } from '../src/data/kia/kiaColorSlugAliases.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const META_PATH = path.join(ROOT, 'src', 'data', 'kia', 'kiaModelImages.json');
const KIA_ROOT = path.join(ROOT, 'public', 'images', 'manufacturers', 'kia');
const INCOMING = path.join(KIA_ROOT, '_incoming');

function publicUrl(modelKey, fileName) {
  return `/images/manufacturers/kia/${modelKey}/colors/${fileName}`;
}

function diskPathFromUrl(url) {
  return path.join(ROOT, 'public', url.replace(/^\//, '').replace(/\//g, path.sep));
}

async function exists(p) {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

/**
 * @param {Record<string, string>} colors
 */
function mergeColorEntries(colors) {
  /** @type {Map<string, { url: string, slug: string, score: number }>} */
  const merged = new Map();

  for (const [slug, url] of Object.entries(colors)) {
    const canonical = canonicalizeKiaColorSlug(slug);
    if (!canonical) continue;

    const score = slug === canonical ? 3 : (slug.includes(canonical) ? 2 : 1);
    const existing = merged.get(canonical);

    if (!existing || score > existing.score) {
      merged.set(canonical, { url, slug, score });
    }
  }

  return merged;
}

async function normalizeModelColors(modelKey, colors) {
  const merged = mergeColorEntries(colors);
  const colorsDir = path.join(KIA_ROOT, modelKey, 'colors');
  await fs.mkdir(colorsDir, { recursive: true });

  const cleaned = {};
  const usedPaths = new Set();

  for (const [canonical, { url }] of merged) {
    const targetFile = `${canonical}.jpg`;
    const targetUrl = publicUrl(modelKey, targetFile);
    const targetPath = path.join(colorsDir, targetFile);
    const sourcePath = diskPathFromUrl(url);

    if (await exists(sourcePath)) {
      if (sourcePath !== targetPath) {
        if (!(await exists(targetPath))) {
          await fs.rename(sourcePath, targetPath);
        } else {
          await fs.unlink(sourcePath);
        }
      }
    }

    cleaned[canonical] = targetUrl;
    usedPaths.add(targetPath);
  }

  if (await exists(colorsDir)) {
    const leftovers = await fs.readdir(colorsDir);
    for (const file of leftovers) {
      if (!file.toLowerCase().endsWith('.jpg')) continue;
      const full = path.join(colorsDir, file);
      if (!usedPaths.has(full)) {
        await fs.unlink(full);
      }
    }
  }

  return cleaned;
}

async function cleanIncomingModel(modelKey) {
  const colorsDir = path.join(INCOMING, modelKey, 'colors');
  if (!(await exists(colorsDir))) return;

  const files = (await fs.readdir(colorsDir)).filter((f) => f.toLowerCase().endsWith('.jpg'));

  for (const file of files) {
    const slug = path.basename(file, '.jpg');
    if (!canonicalizeKiaColorSlug(slug)) {
      await fs.unlink(path.join(colorsDir, file)).catch(() => {});
    }
  }

  const remaining = (await fs.readdir(colorsDir)).filter((f) => f.toLowerCase().endsWith('.jpg'));
  /** @type {Map<string, { path: string, score: number }>} */
  const byCanonical = new Map();

  for (const file of remaining) {
    const slug = path.basename(file, '.jpg');
    const canonical = canonicalizeKiaColorSlug(slug);
    if (!canonical) continue;

    const full = path.join(colorsDir, file);
    const score = slug === canonical ? 3 : 1;
    const existing = byCanonical.get(canonical);

    if (!existing || score > existing.score) {
      if (existing) await fs.unlink(existing.path).catch(() => {});
      byCanonical.set(canonical, { path: full, score });
    } else {
      await fs.unlink(full).catch(() => {});
    }
  }

  for (const [canonical, { path: src }] of byCanonical) {
    const target = path.join(colorsDir, `${canonical}.jpg`);
    if (src !== target) {
      if (!(await exists(target))) await fs.rename(src, target);
      else await fs.unlink(src).catch(() => {});
    }
  }
}

async function main() {
  const raw = JSON.parse(await fs.readFile(META_PATH, 'utf8'));
  let modelsCleaned = 0;
  let beforeCount = 0;
  let afterCount = 0;

  for (const [modelKey, meta] of Object.entries(raw)) {
    if (!meta.colors || typeof meta.colors !== 'object') continue;

    beforeCount += Object.keys(meta.colors).length;
    const cleaned = await normalizeModelColors(modelKey, meta.colors);
    afterCount += Object.keys(cleaned).length;

    if (JSON.stringify(meta.colors) !== JSON.stringify(cleaned)) {
      modelsCleaned += 1;
    }

    raw[modelKey] = {
      ...meta,
      colors: cleaned,
      colorsCleanedAt: new Date().toISOString().slice(0, 10),
    };

    await cleanIncomingModel(modelKey);
  }

  await fs.writeFile(META_PATH, `${JSON.stringify(raw, null, 2)}\n`, 'utf8');

  console.log(`Bereinigt: ${modelsCleaned} Modell(e)`);
  console.log(`Farben: ${beforeCount} → ${afterCount} (−${beforeCount - afterCount} Duplikate/Müll)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
