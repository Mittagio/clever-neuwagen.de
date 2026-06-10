#!/usr/bin/env node
/**
 * Kia KMC Mobile-ZIPs → ManufacturerMediaSystem
 *
 *   npm run import:kia-kmc
 *   npm run import:kia-kmc -- "C:/Pfad/zu/KIA BILDER KMC"
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';
import { createCanvas, loadImage } from '@napi-rs/canvas';
import { slugKiaColorId } from '../src/data/kia/kiaModelImages.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const DEFAULT_SOURCE = path.resolve(ROOT, '..', 'KIA BILDER KMC');
const INCOMING = path.join(ROOT, 'public', 'images', 'manufacturers', 'kia', '_incoming');
const TEMP_ROOT = path.join(ROOT, '.tmp-kia-kmc-import');

const HERO_COLOR_PREFERENCE = [
  'deluxewhite',
  'cassawhite',
  'snowwhite',
  'glacierwhite',
  'clearwhite',
  'ivorysilver',
  'ivorysilvermatte',
  'vanillablossom',
  'wolfgray',
  'pentametal',
  'morninghaze',
];

/** @param {string} zipName */
function resolveModelKeyFromZip(zipName) {
  const n = path.basename(zipName, '.zip').toLowerCase().replace(/_/g, '-');
  if (n.includes('ev4-fb') || n.includes('ev4fb')) return 'ev4-fastback';
  if (n.includes('ev5-gtl') || n.includes('ev5gtl')) return 'ev5-gt';
  if (n.startsWith('ev5')) return 'ev5';
  if (n.startsWith('ev4')) return 'ev4';
  if (n.startsWith('ev3')) return 'ev3';
  if (n.startsWith('ev2')) return 'ev2';
  if (n.includes('ev6-gt') && !n.includes('gt-line')) return 'ev6-gt';
  if (n.includes('ev6')) return 'ev6';
  if (n.includes('ev9-gt') && !n.includes('gt-line')) return 'ev9-gt';
  if (n.includes('ev9')) return 'ev9';
  if (n.includes('k4-wagon') || n.includes('k4wagon')) return 'k4-sportswagon';
  if (n.startsWith('k4')) return 'k4';
  if (n.includes('pv5')) return 'pv5-passenger';
  if (n.includes('sorento') && n.includes('phev')) return 'sorento-phev';
  if (n.includes('sportage') && n.includes('plug-in')) return 'sportage-phev';
  if (n.includes('sportage') && n.includes('hybrid')) return 'sportage-hybrid';
  if (n.includes('stonic')) return 'stonic';
  if (n.includes('xceed') || n.includes('x-ceed')) return 'xceed';
  return null;
}

/** @param {string} raw */
function normalizeColorSlug(raw) {
  return slugKiaColorId(String(raw).replace(/_/g, '-')) || null;
}

/** @param {string} folderName */
function extractColorSlug(folderName) {
  const parts = String(folderName).toLowerCase().split('-').filter(Boolean);
  if (parts.length && /^\d+$/.test(parts[parts.length - 1])) parts.pop();
  if (!parts.length) return normalizeColorSlug(folderName);
  const last = parts[parts.length - 1];
  if (parts.length >= 2 && /^[a-z0-9]{2,3}$/i.test(parts[parts.length - 2])) {
    return normalizeColorSlug(last);
  }
  return normalizeColorSlug(last);
}

/** @param {string} stem z. B. kia-ev3-my25-gls-abp-aurorablackpearl-17 */
function extractColorSlugFromStem(stem) {
  const parts = String(stem).toLowerCase().replace(/_/g, '-').split('-').filter(Boolean);
  if (parts.length && /^\d+$/.test(parts[parts.length - 1])) parts.pop();
  const last = parts[parts.length - 1] ?? '';
  if (parts.length >= 2 && /^[a-z0-9]{2,3}$/i.test(parts[parts.length - 2])) {
    return normalizeColorSlug(last);
  }
  return normalizeColorSlug(last);
}

async function exists(p) {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

async function rmDirSafe(dir) {
  try {
    await fs.rm(dir, { recursive: true, force: true, maxRetries: 3, retryDelay: 200 });
  } catch (err) {
    if (err?.code !== 'EBUSY' && err?.code !== 'EPERM') throw err;
  }
}

async function pngToJpg(pngPath, jpgPath, { maxWidth = 1200, quality = 0.9 } = {}) {
  const img = await loadImage(pngPath);
  let w = img.width;
  let h = img.height;
  if (w > maxWidth) {
    h = Math.round((h * maxWidth) / w);
    w = maxWidth;
  }
  const canvas = createCanvas(w, h);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#f8fafc';
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(img, 0, 0, w, h);
  await fs.mkdir(path.dirname(jpgPath), { recursive: true });
  await fs.writeFile(jpgPath, canvas.toBuffer('image/jpeg', { quality }));
}

async function pickFrameFile(colorDir) {
  const files = (await fs.readdir(colorDir))
    .filter((f) => f.toLowerCase().endsWith('.png'))
    .sort();
  if (!files.length) return null;
  const preferred = files.find((f) => /_0000\.png$/i.test(f))
    ?? files.find((f) => /_0008\.png$/i.test(f))
    ?? files[0];
  return path.join(colorDir, preferred);
}

async function listPngFiles(dir) {
  const names = await fs.readdir(dir);
  return names.filter((n) => n.toLowerCase().endsWith('.png'));
}

async function scanFlatPngColorGroups(dir) {
  const pngs = await listPngFiles(dir);
  if (pngs.length < 3) return [];

  /** @type {Map<string, string[]>} */
  const groups = new Map();
  for (const png of pngs) {
    const m = png.match(/^(.+)_(\d{4})\.png$/i);
    if (!m) continue;
    const key = m[1];
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(png);
  }

  return [...groups.entries()].map(([stem, files]) => ({
    colorSlug: extractColorSlugFromStem(stem),
    pngPath: path.join(dir, files.sort()[0]),
  })).filter((c) => c.colorSlug && c.pngPath);
}

/**
 * @param {string} extractRoot
 */
async function scanColorFolders(extractRoot) {
  /** @type {{ colorSlug: string, pngPath: string }[]} */
  const colors = [];
  const seen = new Set();

  function addColor(entry) {
    if (!entry.colorSlug || seen.has(entry.colorSlug)) return;
    seen.add(entry.colorSlug);
    colors.push(entry);
  }

  async function walk(dir, depth = 0) {
    if (depth > 5) return;

    const flat = await scanFlatPngColorGroups(dir);
    if (flat.length >= 2) {
      flat.forEach(addColor);
      return;
    }

    const names = await fs.readdir(dir);
    const subdirs = [];
    for (const name of names) {
      try {
        if ((await fs.stat(path.join(dir, name))).isDirectory()) subdirs.push({ name });
      } catch { /* ignore */ }
    }
    const pngs = names.filter((n) => n.toLowerCase().endsWith('.png'));

    if (pngs.length >= 3 && flat.length <= 1) {
      const colorSlug = extractColorSlug(path.basename(dir));
      const frame = await pickFrameFile(dir);
      if (frame && colorSlug) addColor({ colorSlug, pngPath: frame });
      return;
    }

    for (const sub of subdirs) {
      if (sub.name.toLowerCase() === '__macosx') continue;
      await walk(path.join(dir, sub.name), depth + 1);
    }
  }

  await walk(extractRoot);
  return colors;
}

function extractZip(zipPath, destDir) {
  execSync(`tar -xf "${zipPath.replace(/"/g, '\\"')}" -C "${destDir.replace(/"/g, '\\"')}"`, {
    stdio: 'pipe',
    maxBuffer: 64 * 1024 * 1024,
  });
}

async function processZip(zipPath) {
  const modelKey = resolveModelKeyFromZip(zipPath);
  if (!modelKey) {
    console.warn(`  ⚠ Modell nicht erkannt: ${path.basename(zipPath)}`);
    return null;
  }

  const zipBase = path.basename(zipPath, '.zip');
  const tempDir = path.join(TEMP_ROOT, zipBase);
  await rmDirSafe(tempDir);
  await fs.mkdir(tempDir, { recursive: true });

  console.log(`→ ${path.basename(zipPath)} → ${modelKey}`);
  extractZip(zipPath, tempDir);

  const colorEntries = await scanColorFolders(tempDir);
  if (!colorEntries.length) {
    console.warn(`  ⚠ Keine Farbordner in ${path.basename(zipPath)}`);
    await rmDirSafe(tempDir);
    return null;
  }

  const outDir = path.join(INCOMING, modelKey, 'colors');
  await fs.mkdir(outDir, { recursive: true });

  for (const { colorSlug, pngPath } of colorEntries) {
    const outPath = path.join(outDir, `${colorSlug}.jpg`);
    await pngToJpg(pngPath, outPath);
  }

  const heroSlug = HERO_COLOR_PREFERENCE.find((pref) =>
    colorEntries.some((c) => c.colorSlug === pref || c.colorSlug.includes(pref)),
  ) ?? colorEntries[0].colorSlug;

  const heroSource = colorEntries.find((c) => c.colorSlug === heroSlug)?.pngPath
    ?? colorEntries[0].pngPath;

  const modelIncoming = path.join(INCOMING, modelKey);
  await pngToJpg(heroSource, path.join(modelIncoming, 'hero.jpg'), { maxWidth: 1400, quality: 0.92 });
  await pngToJpg(heroSource, path.join(modelIncoming, 'default.jpg'), { maxWidth: 1200, quality: 0.9 });

  await rmDirSafe(tempDir);

  return {
    modelKey,
    colors: colorEntries.length,
    hero: heroSlug,
  };
}

async function main() {
  const sourceDir = process.argv[2] ? path.resolve(process.argv[2]) : DEFAULT_SOURCE;

  if (!(await exists(sourceDir))) {
    console.error(`Quellordner nicht gefunden: ${sourceDir}`);
    process.exit(1);
  }

  const zips = (await fs.readdir(sourceDir))
    .filter((f) => f.toLowerCase().endsWith('.zip'))
    .map((f) => path.join(sourceDir, f))
    .sort();

  console.log(`Kia KMC Import – ${zips.length} ZIP(s) aus\n${sourceDir}\n`);

  await fs.mkdir(INCOMING, { recursive: true });
  await rmDirSafe(TEMP_ROOT);
  await fs.mkdir(TEMP_ROOT, { recursive: true });

  /** @type {Record<string, { colors: number, zips: string[] }>} */
  const summary = {};

  for (const zipPath of zips) {
    try {
      const result = await processZip(zipPath);
      if (!result) continue;
      summary[result.modelKey] ??= { colors: 0, zips: [] };
      summary[result.modelKey].zips.push(path.basename(zipPath));
      summary[result.modelKey].colors = Math.max(summary[result.modelKey].colors, result.colors);
    } catch (err) {
      console.error(`  ✗ Fehler bei ${path.basename(zipPath)}:`, err.message);
    }
  }

  await rmDirSafe(TEMP_ROOT);

  console.log('\n--- Zusammenfassung ---');
  for (const [model, info] of Object.entries(summary).sort()) {
    console.log(`  ${model}: ${info.colors} Farbe(n) (${info.zips.length} ZIP)`);
  }

  console.log('\nRegistry aktualisieren …');
  execSync('node scripts/import-kia-oem-photos.mjs', { cwd: ROOT, stdio: 'inherit' });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
