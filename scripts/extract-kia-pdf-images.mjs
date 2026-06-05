#!/usr/bin/env node
/**
 * Kia Preislisten-Bilder extrahieren (Sorento-Stil: Fahrzeugbild von Seite 1).
 * Fallback: größtes eingebettetes Bild im Dokument, dann Titelseiten-Render.
 *
 * Ausführung: npm run extract:kia-images
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createCanvas } from '@napi-rs/canvas';
import { getDocument, OPS } from 'pdfjs-dist/legacy/build/pdf.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const OUT_ROOT = path.join(ROOT, 'public', 'images', 'manufacturers', 'kia');
const META_OUT = path.join(ROOT, 'src', 'data', 'kia', 'kiaModelImages.json');

const BASE_URL = 'https://www.kia.com/content/dam/kwcms/kme/de/de/assets/contents/utility/Preisliste/';

const PDF_TO_FOLDER = {
  'Kia-Germany-Picanto_Preisliste.pdf': 'picanto',
  'Kia-Germany-Stonic-Preisliste.pdf': 'stonic',
  'Kia-Germany-XCeed_Pricelist.pdf': 'xceed',
  'Kia-Germany-Ceed-Preisliste.pdf': 'ceed',
  'Kia-Germany-K4-Preisliste.pdf': 'k4',
  'Kia-Germany-K4-Sportswagon-Preisliste.pdf': 'k4-sportswagon',
  'Kia-Germany-Seltos-Preisliste.pdf': 'seltos',
  'Kia-Germany-Sportage-Preisliste.pdf': 'sportage',
  'Kia-Germany-Sportage-PHEV-Preisliste.pdf': 'sportage-phev',
  'Kia-Germany-Sorento-pricelist.pdf': 'sorento',
  'Kia-Germany-Sorento-Hybrid-pricelist.pdf': 'sorento-hybrid',
  'Kia-Germany-Sorento-PHEV-Preisliste.pdf': 'sorento-phev',
  'Kia-Germany-Niro-HEV-Preisliste.pdf': 'niro',
  'Kia-Germany-EV2-Preisliste.pdf': 'ev2',
  'Kia-Germany-EV3-Preisliste.pdf': 'ev3',
  'Kia-Germany-EV4-Preisliste.pdf': 'ev4',
  'Kia-Germany-EV5-Preisliste.pdf': 'ev5',
  'Kia-Germany-EV5-GT-Preisliste.pdf': 'ev5-gt',
  'Kia-Germany-EV6_Pricelist.pdf': 'ev6',
  'Kia-Germany-EV9-Preisliste.pdf': 'ev9',
  'Kia-Germany-PV5-Passenger-Preisliste.pdf': 'pv5-passenger',
};

function scoreImage(pageNum, width, height) {
  const area = width * height;
  const ratio = width / height || 0;
  if (height < 280) return area * 0.15;
  if (pageNum === 1 && ratio < 1.05 && area > 700_000) return area * 4;
  if (pageNum === 1 && ratio >= 1.15 && width >= 900) return area * 3.5;
  if (ratio >= 1.4 && ratio <= 3.8 && width >= 1000 && height >= 350) return area * 3;
  if (ratio >= 1.15 && width >= 800 && height >= 400) return area * 2;
  return area;
}

async function downloadPdf(filename) {
  const url = BASE_URL + filename;
  const res = await fetch(url, { headers: { 'User-Agent': 'Clever-Neuwagen/1.0' } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

function toRgba(img) {
  const { width, height, data, kind } = img;
  const rgba = new Uint8ClampedArray(width * height * 4);
  if (kind === 2) {
    for (let i = 0, j = 0; i < data.length; i += 3, j += 4) {
      rgba[j] = data[i];
      rgba[j + 1] = data[i + 1];
      rgba[j + 2] = data[i + 2];
      rgba[j + 3] = 255;
    }
    return rgba;
  }
  if (kind === 1) {
    for (let i = 0, j = 0; i < data.length; i += 1, j += 4) {
      rgba[j] = data[i];
      rgba[j + 1] = data[i];
      rgba[j + 2] = data[i];
      rgba[j + 3] = 255;
    }
    return rgba;
  }
  return new Uint8ClampedArray(data);
}

function embeddedToJpeg(img) {
  const canvas = createCanvas(img.width, img.height);
  const ctx = canvas.getContext('2d');
  const imageData = ctx.createImageData(img.width, img.height);
  imageData.data.set(toRgba(img));
  ctx.putImageData(imageData, 0, 0);
  return canvas.toBuffer('image/jpeg', { quality: 0.88 });
}

async function bestEmbeddedOnPage(page, pageNum) {
  const ops = await page.getOperatorList();
  let best = null;
  for (let i = 0; i < ops.fnArray.length; i += 1) {
    const fn = ops.fnArray[i];
    if (fn !== OPS.paintImageXObject && fn !== OPS.paintInlineImageXObject) continue;
    const name = ops.argsArray[i][0];
    try {
      const img = await page.objs.get(name);
      if (!img?.data || !img.width || !img.height) continue;
      const scored = scoreImage(pageNum, img.width, img.height);
      if (!best || scored > best.scored) {
        best = { img, scored };
      }
    } catch {
      // ignore broken xref
    }
  }
  return best;
}

async function pickEmbeddedImage(doc) {
  let best = null;
  for (let pageNum = 1; pageNum <= doc.numPages; pageNum += 1) {
    const page = await doc.getPage(pageNum);
    const candidate = await bestEmbeddedOnPage(page, pageNum);
    if (!candidate) continue;
    if (!best || candidate.scored > best.scored) {
      best = { ...candidate, page: pageNum };
    }
  }
  if (!best) return null;
  return {
    buffer: embeddedToJpeg(best.img),
    width: best.img.width,
    height: best.img.height,
    page: best.page,
    mode: 'embedded',
  };
}

async function renderCoverPage(doc, pageNumber = 1, scale = 2) {
  const page = await doc.getPage(pageNumber);
  const viewport = page.getViewport({ scale });
  const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
  const ctx = canvas.getContext('2d');
  await page.render({ canvasContext: ctx, viewport }).promise;
  return {
    buffer: canvas.toBuffer('image/jpeg', { quality: 0.88 }),
    width: Math.ceil(viewport.width),
    height: Math.ceil(viewport.height),
    page: pageNumber,
    mode: 'cover-render',
  };
}

async function pickBestVisual(doc) {
  const page1 = await doc.getPage(1);
  const coverEmbedded = await bestEmbeddedOnPage(page1, 1);
  if (coverEmbedded && coverEmbedded.scored > 500_000) {
    return {
      buffer: embeddedToJpeg(coverEmbedded.img),
      width: coverEmbedded.img.width,
      height: coverEmbedded.img.height,
      page: 1,
      mode: 'embedded-cover',
    };
  }

  const embedded = await pickEmbeddedImage(doc);
  if (embedded) return embedded;

  try {
    return await renderCoverPage(doc, 1, 2);
  } catch {
    return null;
  }
}

async function saveJpeg(folder, buffer) {
  const outDir = path.join(OUT_ROOT, folder);
  await fs.mkdir(outDir, { recursive: true });
  for (const name of ['hero.jpg', 'default.jpg']) {
    await fs.writeFile(path.join(outDir, name), buffer);
  }
}

async function loadExistingMeta() {
  try {
    const raw = await fs.readFile(META_OUT, 'utf8');
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

async function main() {
  const meta = {};
  const folderBest = {};

  for (const [pdfName, folder] of Object.entries(PDF_TO_FOLDER)) {
    process.stdout.write(`Fetching ${pdfName} -> ${folder} ... `);
    try {
      const data = await downloadPdf(pdfName);
      const doc = await getDocument({ data: new Uint8Array(data) }).promise;
      const picked = await pickBestVisual(doc);
      if (!picked) {
        console.log('SKIP no suitable image');
        continue;
      }
      const score = picked.width * picked.height;
      if (folderBest[folder] != null && score <= folderBest[folder]) {
        console.log(`skip (existing better) ${picked.width}x${picked.height}`);
        continue;
      }
      await saveJpeg(folder, picked.buffer);
      folderBest[folder] = score;
      meta[folder] = {
        sourcePdf: pdfName,
        sourceUrl: BASE_URL + pdfName,
        page: picked.page,
        width: picked.width,
        height: picked.height,
        extractedAt: new Date().toISOString().slice(0, 10),
        extractMode: picked.mode,
        hero: `/images/manufacturers/kia/${folder}/hero.jpg`,
        default: `/images/manufacturers/kia/${folder}/default.jpg`,
      };
      console.log(`OK ${picked.mode} p${picked.page} ${picked.width}x${picked.height}`);
    } catch (err) {
      console.log(`SKIP ${err.message}`);
    }
  }

  await fs.writeFile(META_OUT, `${JSON.stringify(meta, null, 2)}\n`, 'utf8');
  console.log(`\nWrote ${Object.keys(meta).length} model folders -> ${META_OUT}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
