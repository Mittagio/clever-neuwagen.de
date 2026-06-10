#!/usr/bin/env node
/**
 * Kia OEM-Fotos aus _incoming importieren und Registry aktualisieren.
 *
 *   npm run import:kia-photos
 *   npm run import:kia-photos -- --sync-existing
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveKiaModelImageKey } from '../src/data/kia/kiaModelImages.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const KIA_ROOT = path.join(ROOT, 'public', 'images', 'manufacturers', 'kia');
const INCOMING = path.join(KIA_ROOT, '_incoming');
const META_OUT = path.join(ROOT, 'src', 'data', 'kia', 'kiaModelImages.json');

const IMAGE_EXT = new Set(['.jpg', '.jpeg', '.png', '.webp']);

const FOLDER_ALIASES = {
  'ev-2': 'ev2',
  'ev-3': 'ev3',
  'ev-4': 'ev4',
  'ev-5': 'ev5',
  'ev-5-gt': 'ev5-gt',
  'ev-6': 'ev6',
  'ev-9': 'ev9',
  'k4-sw': 'k4-sportswagon',
  'sportage-hybrid': 'sportage',
  'niro-hybrid': 'niro',
  'niro-ev': 'niro',
};

function slugColor(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '');
}

function resolveModelFolder(name) {
  const raw = String(name).trim().toLowerCase();
  return FOLDER_ALIASES[raw] ?? raw;
}

function publicUrl(...parts) {
  return `/images/manufacturers/kia/${parts.join('/')}`;
}

async function exists(p) {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

async function copyFile(src, dest) {
  await fs.mkdir(path.dirname(dest), { recursive: true });
  await fs.copyFile(src, dest);
}

async function listImageFiles(dir) {
  if (!(await exists(dir))) return [];
  const names = await fs.readdir(dir);
  const files = [];
  for (const name of names) {
    if (!IMAGE_EXT.has(path.extname(name).toLowerCase())) continue;
    const full = path.join(dir, name);
    try {
      const stat = await fs.stat(full);
      if (stat.isFile()) files.push(name);
    } catch {
      // OneDrive-Platzhalter: Endung reicht als Heuristik
      files.push(name);
    }
  }
  return files;
}

/**
 * @param {string} modelDir absolute path to model folder in kia root
 * @param {string} modelKey
 */
async function scanModelFolder(modelDir, modelKey) {
  /** @type {{ hero?: string, default?: string, colors: Record<string, string> }} */
  const result = { colors: {} };

  for (const name of ['hero.jpg', 'hero.jpeg', 'hero.webp', 'hero.png']) {
    if (await exists(path.join(modelDir, name))) {
      result.hero = publicUrl(modelKey, name);
      break;
    }
  }

  for (const name of ['default.jpg', 'default.jpeg', 'default.webp', 'default.png']) {
    if (await exists(path.join(modelDir, name))) {
      result.default = publicUrl(modelKey, name);
      break;
    }
  }

  const colorsDir = path.join(modelDir, 'colors');
  for (const file of await listImageFiles(colorsDir)) {
    const ext = path.extname(file);
    const colorKey = slugColor(path.basename(file, ext));
    if (!colorKey) continue;
    result.colors[colorKey] = publicUrl(modelKey, 'colors', file);
  }

  // Farbfotos direkt im Modellordner (außer hero/default)
  for (const file of await listImageFiles(modelDir)) {
    const lower = file.toLowerCase();
    if (lower.startsWith('hero.') || lower.startsWith('default.')) continue;
    const ext = path.extname(file);
    const colorKey = slugColor(path.basename(file, ext));
    if (!colorKey) continue;
    result.colors[colorKey] = publicUrl(modelKey, file);
  }

  return result;
}

async function importIncoming() {
  if (!(await exists(INCOMING))) {
    console.log('Kein _incoming-Ordner – übersprungen.');
    return 0;
  }

  const entries = await fs.readdir(INCOMING, { withFileTypes: true });
  let count = 0;

  for (const entry of entries) {
    if (!entry.isDirectory() || entry.name.startsWith('_') || entry.name === 'README.md') continue;

    const folderName = entry.name;
    const srcDir = path.join(INCOMING, folderName);
    const destDir = path.join(KIA_ROOT, folderName);

    await fs.mkdir(destDir, { recursive: true });

    for (const file of await listImageFiles(srcDir)) {
      const lower = file.toLowerCase();
      if (lower.startsWith('hero.') || lower.startsWith('default.')) {
        await copyFile(path.join(srcDir, file), path.join(destDir, file));
        count += 1;
      }
    }

    const srcColors = path.join(srcDir, 'colors');
    if (await exists(srcColors)) {
      const destColors = path.join(destDir, 'colors');
      await fs.mkdir(destColors, { recursive: true });
      for (const file of await listImageFiles(srcColors)) {
        await copyFile(path.join(srcColors, file), path.join(destColors, file));
        count += 1;
      }
    }

    for (const file of await listImageFiles(srcDir)) {
      const lower = file.toLowerCase();
      if (lower.startsWith('hero.') || lower.startsWith('default.')) continue;
      await copyFile(path.join(srcDir, file), path.join(destDir, file));
      count += 1;
    }

    console.log(`✓ ${entry.name}`);
  }

  return count;
}

async function syncRegistry() {
  const raw = JSON.parse(await fs.readFile(META_OUT, 'utf8'));
  const entries = await fs.readdir(KIA_ROOT, { withFileTypes: true });
  let updated = 0;

  for (const entry of entries) {
    if (!entry.isDirectory() || entry.name.startsWith('_')) continue;

    const modelKey = entry.name;
    const modelDir = path.join(KIA_ROOT, entry.name);
    const scanned = await scanModelFolder(modelDir, modelKey);

    if (!scanned.hero && !scanned.default && !Object.keys(scanned.colors).length) continue;

    const prev = raw[modelKey] ?? raw[entry.name] ?? {};
    const next = { ...prev };

    if (scanned.hero) next.hero = scanned.hero;
    if (scanned.default) next.default = scanned.default;
    if (!next.default && next.hero) next.default = next.hero;
    if (!next.hero && next.default) next.hero = next.default;

    if (Object.keys(scanned.colors).length) {
      next.colors = scanned.colors;
      next.colorsImportedAt = new Date().toISOString().slice(0, 10);
      next.oemPhotoSource = 'kia-press';
      delete next.colorsCleanedAt;
    }

    const changed = JSON.stringify(prev) !== JSON.stringify(next);
    if (changed) {
      raw[modelKey] = next;
      if (entry.name !== modelKey && raw[entry.name]) delete raw[entry.name];
      updated += 1;
      const colorCount = Object.keys(next.colors ?? {}).length;
      console.log(`  Registry: ${modelKey} – ${colorCount} Farbe(n)`);
    }
  }

  await fs.writeFile(META_OUT, `${JSON.stringify(raw, null, 2)}\n`, 'utf8');
  return updated;
}

async function main() {
  const syncOnly = process.argv.includes('--sync-existing');

  console.log('Kia OEM-Foto-Import\n');

  if (!syncOnly) {
    const copied = await importIncoming();
    console.log(`\n${copied} Datei(en) aus _incoming kopiert.\n`);
  }

  const updated = await syncRegistry();
  console.log(`\nFertig – ${updated} Modell(e) in kiaModelImages.json aktualisiert.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
