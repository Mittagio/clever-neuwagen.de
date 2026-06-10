#!/usr/bin/env node
/**
 * PDF → Text → JSON für Kia-Preislisten (ohne Python).
 * Nutzung: node scripts/import-kia-pricelist-pdfs.mjs [pdf ...]
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { splitSportagePricelist } from '../src/data/kia/splitSportagePricelist.js';

const require = createRequire(import.meta.url);
const { PDFParse } = require('pdf-parse');

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const EXTRACT_DIR = path.join(ROOT, 'scripts', 'pdf-extract');
const OUT_DIR = path.join(ROOT, 'src', 'data', 'kia', 'pricelist-imports');

/** Dateiname → Parser-Stem + Metadaten */
const PDF_ALIASES = {
  'EV4-Fastback-Preisliste.pdf': 'Kia-Germany-EV4-Fastback-Preisliste',
  'Sportage-PHEV-Preisliste.pdf': 'Kia-Germany-Sportage-PHEV-Preisliste',
  'Sportage 29.05.2026.pdf': 'Kia-Germany-Sportage-Preisliste',
  'EV6-GT-Pricelist.pdf': 'Kia-Germany-EV6-GT-Pricelist',
  'EV9-GT-Preisliste.pdf': 'Kia-Germany-EV9-GT-Preisliste',
  'PV5-Cargo-Preisliste.pdf': 'Kia-Germany-PV5-Cargo-Preisliste',
};

const FILE_META = {
  'Kia-Germany-Picanto_Preisliste': { modelKey: 'picanto', model: 'Picanto', variant: 'verbrenner' },
  'Kia-Germany-Stonic-Preisliste': { modelKey: 'stonic', model: 'Stonic', variant: 'verbrenner' },
  'Kia-Germany-XCeed_Pricelist': { modelKey: 'xceed', model: 'XCeed', variant: 'verbrenner' },
  'Kia-Germany-K4-Preisliste': { modelKey: 'k4', model: 'K4', variant: 'verbrenner' },
  'Kia-Germany-K4-Sportswagon-Preisliste': { modelKey: 'k4-sportswagon', model: 'K4 Sportswagon', variant: 'verbrenner' },
  'Kia-Germany-Seltos-Preisliste': { modelKey: 'seltos', model: 'Seltos', variant: 'verbrenner' },
  'Kia-Germany-Sportage-Preisliste': { modelKey: 'sportage', model: 'Sportage', variant: 'verbrenner' },
  'Kia-Germany-Sportage-PHEV-Preisliste': { modelKey: 'sportage-phev', model: 'Sportage Plug-in Hybrid', variant: 'phev' },
  'Kia-Germany-Sorento-pricelist': { modelKey: 'sorento', model: 'Sorento', variant: 'verbrenner' },
  'Kia-Germany-Sorento-Hybrid-pricelist': { modelKey: 'sorento-hybrid', model: 'Sorento Hybrid', variant: 'hybrid' },
  'Kia-Germany-Sorento-PHEV-Preisliste': { modelKey: 'sorento-phev', model: 'Sorento Plug-in Hybrid', variant: 'phev' },
  'Kia-Germany-EV2-Preisliste': { modelKey: 'ev2', model: 'EV2', variant: 'elektro' },
  'Kia-Germany-EV3-Preisliste': { modelKey: 'ev3', model: 'EV3', variant: 'elektro' },
  'Kia-Germany-EV4-Preisliste': { modelKey: 'ev4', model: 'EV4', variant: 'elektro' },
  'Kia-Germany-EV4-Fastback-Preisliste': { modelKey: 'ev4-fastback', model: 'EV4 Fastback', variant: 'elektro' },
  'Kia-Germany-EV5-Preisliste': { modelKey: 'ev5', model: 'EV5', variant: 'elektro' },
  'Kia-Germany-EV5-GT-Preisliste': { modelKey: 'ev5-gt', model: 'EV5 GT', variant: 'elektro-gt' },
  'Kia-Germany-EV6_Pricelist': { modelKey: 'ev6', model: 'EV6', variant: 'elektro' },
  'Kia-Germany-EV6-GT-Pricelist': { modelKey: 'ev6-gt', model: 'EV6 GT', variant: 'elektro-gt' },
  'Kia-Germany-EV9-Preisliste': { modelKey: 'ev9', model: 'EV9', variant: 'elektro' },
  'Kia-Germany-EV9-GT-Preisliste': { modelKey: 'ev9-gt', model: 'EV9 GT', variant: 'elektro-gt' },
  'Kia-Germany-PV5-Passenger-Preisliste': { modelKey: 'pv5-passenger', model: 'PV5 Passenger', variant: 'nutzfahrzeug' },
  'Kia-Germany-PV5-Cargo-Preisliste': { modelKey: 'pv5-cargo-l2h1', model: 'PV5 Cargo L2H1', variant: 'nutzfahrzeug' },
};

const PRICE_PAIR_RE = /(\d{1,3}(?:\.\d{3})*,\d{2})/g;
const KNOWN_TRIMS = /^(Core|Vision|Spirit|Black\s+Edition|GT-Line|GT Line|Air|Earth|Light|Plus|Premium|Motion|Style|Design|Tech|Gravity|Inspiration|Wave|Land|Business|Pro|Active|Standard|Comfort|Premium Plus|GT|Platinum|Gravity)(?:\s|$)/i;
const EV_INLINE_RE = /\b(Air|Earth|GT-Line|Light|Plus|Premium|Gravity|Inspiration|GT)\b\s+(\d{1,3}(?:\.\d{3})*,\d{2})\s+(\d{1,3}(?:\.\d{3})*,\d{2})/gi;
const WLTP_RE = /Kia\s+([^\n:]+):\s*(Kraftstoffverbrauch|Stromverbrauch)[^\n]+/gi;

function slug(s) {
  return s.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '') || 'unknown';
}

function parseEuro(s) {
  let cleaned = s.replace(/\s/g, '');
  if (cleaned.includes(',')) cleaned = cleaned.split(',')[0];
  return parseInt(cleaned.replace(/\./g, ''), 10);
}

function normalizeTrim(name) {
  return name.replace(/\s+/g, ' ').trim();
}

function parsePriceLine(line) {
  const normalized = line.replace(/\t/g, ' ').trim();
  if (!normalized || normalized.startsWith('Doppelkupplungs') || normalized.startsWith('getriebe')) return null;
  const amounts = [...normalized.matchAll(PRICE_PAIR_RE)];
  if (!amounts.length) return null;
  const gross = parseEuro(amounts[amounts.length - 1][1]);
  if (gross < 10000 || gross > 250000) return null;
  const net = amounts.length >= 2 ? parseEuro(amounts[amounts.length - 2][1]) : null;
  const trimEnd = amounts.length >= 2 ? amounts[amounts.length - 2].index : amounts[amounts.length - 1].index;
  let trim = normalized.slice(0, trimEnd).trim().replace(/\s+/g, ' ');
  if (!trim || !KNOWN_TRIMS.test(trim)) return null;
  return [normalizeTrim(trim), net, gross];
}

function extractVariants(text) {
  const variants = [];
  const lines = text.split(/\r?\n/);
  let inTable = false;
  let currentEngine = '';
  let currentTransmission = '';
  let currentDrive = '';
  let currentPower = '';
  let currentConsumption = '';
  let currentCo2 = '';
  let currentCo2Class = '';

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.includes('EUR inkl') || (line.trim().startsWith('19 % MwSt') && i > 0 && lines[i - 1].includes('EUR'))) {
      inTable = true;
      continue;
    }
    if (!inTable) continue;
    if (line.trim().startsWith('Preise') && lines[i + 1]?.includes('Ausstattung')) break;
    if (/^\d+\s+Kraftstoffverbrauch/.test(line.trim()) || line.trim().startsWith('●\t=')) break;

    const flat = line.replace(/\t/g, ' ').trim();
    if (/Batterie|kW\s*\(|T-GDI|CRDi|Automatik|Schaltgetriebe|DCT|AMT|Frontantrieb|Hybrid|Plug-in|Diesel|Benzin/i.test(flat)) {
      if (!parsePriceLine(line)) {
        if (/Batterie|T-GDI|CRDi|\d+\s*kW/i.test(flat)) currentEngine = flat.slice(0, 140);
        if (/Schaltgetriebe|DCT|Automatik|AMT/i.test(flat)) currentTransmission = flat.slice(0, 100);
        if (flat.includes('2WD')) currentDrive = '2WD';
        else if (flat.includes('AWD')) currentDrive = 'AWD';
        const pm = flat.match(/(\d+)\s*\(\s*(\d+)\s*\)/);
        if (pm) currentPower = `${pm[1]} kW (${pm[2]} PS)`;
        const cons = flat.match(/(\d[\d\s]*,\s*\d)\s+(\d{2,3})\s+([A-G](?:\s*[–-]\s*[A-G])?)/);
        if (cons) {
          currentConsumption = cons[1].replace(/\s/g, '');
          currentCo2 = cons[2];
          currentCo2Class = cons[3].replace(/\s/g, '');
        }
      }
    }

    const parsed = parsePriceLine(line);
    if (parsed) {
      const [trim, net, gross] = parsed;
      variants.push({
        trim,
        trimId: slug(trim),
        priceNet: net,
        priceGross: gross,
        engine: currentEngine,
        transmission: currentTransmission,
        drive: currentDrive,
        power: currentPower,
        consumption: currentConsumption,
        co2: currentCo2,
        co2Class: currentCo2Class,
      });
    }
  }
  return variants;
}

/** GT-PDFs: Motorzeile mit WLTP-Spalten und Netto/Brutto am Zeilenende */
function extractEnginePriceRows(text, defaultTrim = 'GT') {
  const variants = [];
  const re = /(\d+-kWh-Batterie[^\n]+?)\s+([\d,.]+)\s+(\d+)\s+([A-G])\s+(\d+)\s+([\d.]+,\d{2})\s+([\d.]+,\d{2})/gi;
  let m;
  while ((m = re.exec(text)) !== null) {
    const engineLine = m[1].trim().replace(/\s+/g, ' ');
    const powerMatch = engineLine.match(/(\d+)\s*kW\s*\((\d+)\s*PS\)/i);
    variants.push({
      trim: defaultTrim,
      trimId: slug(defaultTrim),
      priceNet: parseEuro(m[6]),
      priceGross: parseEuro(m[7]),
      engine: engineLine,
      transmission: '',
      drive: /allrad/i.test(engineLine) ? 'AWD' : /front/i.test(engineLine) ? 'FWD' : '',
      power: powerMatch ? `${powerMatch[1]} kW (${powerMatch[2]} PS)` : '',
      consumption: m[2].replace(/\s/g, ''),
      co2: m[3],
      co2Class: m[4],
    });
  }
  return variants;
}

function extractEvVariants(text) {
  const variants = [];
  const seen = new Set();
  let m;
  const re = new RegExp(EV_INLINE_RE.source, EV_INLINE_RE.flags);
  while ((m = re.exec(text)) !== null) {
    const trim = normalizeTrim(m[1]);
    const key = `${trim}|${m[3]}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const gross = parseEuro(m[3]);
    if (gross < 10000) continue;
    variants.push({
      trim,
      trimId: slug(trim),
      priceNet: parseEuro(m[2]),
      priceGross: gross,
      engine: '',
      transmission: '',
      drive: '',
      power: '',
      consumption: '',
      co2: '',
      co2Class: '',
    });
  }
  return variants;
}

function extractTrimsFromHighlights(text) {
  const trims = [];
  const re = /\n(Air|Earth|GT-Line|Core|Vision|Spirit|Black Edition|Light|Plus|Premium|Motion|Style|Design|Tech|Gravity|Inspiration|Wave|Land|Business|Pro|Active)\n/gi;
  let m;
  while ((m = re.exec(text)) !== null) {
    const t = normalizeTrim(m[1]);
    if (!trims.includes(t)) trims.push(t);
  }
  return trims;
}

function extractWltp(text) {
  const notes = [];
  const seen = new Set();
  let m;
  const re = new RegExp(WLTP_RE.source, WLTP_RE.flags);
  while ((m = re.exec(text)) !== null) {
    const n = m[0].trim();
    if (!seen.has(n)) {
      seen.add(n);
      notes.push(n);
    }
  }
  return notes.slice(0, 8);
}

function extractTrimPricesAb(text) {
  const results = [];
  const re = /(Core|Vision|Spirit|Black Edition|GT-Line|Air|Earth|Light|Plus|Premium|Motion|Style)\s*\n.*?ab\s*\n€\s*([\d.]+,\d{2})/gis;
  let m;
  while ((m = re.exec(text)) !== null) {
    results.push({ trim: normalizeTrim(m[1]), priceFromGross: parseEuro(m[2]) });
  }
  return results;
}

function parseFile(stem, text) {
  const meta = FILE_META[stem];
  if (!meta) throw new Error(`Kein FILE_META für ${stem}`);
  let variants = extractVariants(text);
  if (['elektro', 'elektro-gt', 'phev', 'nutzfahrzeug'].includes(meta.variant) && variants.length < 2) {
    const evVariants = extractEvVariants(text);
    if (evVariants.length > variants.length) variants = evVariants;
  }
  if (!variants.length) variants = extractEvVariants(text);
  if (!variants.length && meta.variant === 'elektro-gt') {
    variants = extractEnginePriceRows(text, 'GT');
  }
  let trims = extractTrimsFromHighlights(text);
  if (!trims.length && variants.length) {
    trims = [...new Set(variants.map((v) => v.trim))];
  }
  if (!trims.length) {
    trims = [...new Set(variants.map((v) => v.trim))];
  }
  const trimPricesAb = extractTrimPricesAb(text);
  const wltp = extractWltp(text);
  const priceFrom = variants.length ? Math.min(...variants.map((v) => v.priceGross)) : null;

  return {
    brand: 'Kia',
    modelKey: meta.modelKey,
    model: meta.model,
    powertrainVariant: meta.variant,
    sourceFile: `${stem}.pdf`,
    sourcePdfPath: `Kia-Germany/${stem}.pdf`,
    priceListSource: 'Kia Deutschland GmbH – offizielle Preisliste PDF',
    importedAt: new Date().toISOString().slice(0, 10),
    priceFromGross: priceFrom,
    trims: trims.map((t) => ({ id: slug(t), name: t })),
    variants,
    trimPricesFrom: trimPricesAb,
    wltpNotes: wltp,
    variantCount: variants.length,
    ...(variants.length === 0 ? { importNote: 'PDF-Text nicht vollständig parsebar – manuelle Nacharbeit' } : {}),
  };
}

async function extractPdfText(pdfPath) {
  const data = await fs.readFile(pdfPath);
  const parser = new PDFParse({ data });
  const result = await parser.getText();
  return result.text;
}

const CATALOG_SKIP = new Set(['index.json', 'catalog.json', 'manual-supplements.json']);

async function rebuildCatalog() {
  const index = [];
  const catalog = {};
  const files = (await fs.readdir(OUT_DIR)).filter((f) => f.endsWith('.json') && !CATALOG_SKIP.has(f));
  for (const file of files.sort()) {
    const data = JSON.parse(await fs.readFile(path.join(OUT_DIR, file), 'utf8'));
    if (!data?.modelKey) continue;
    index.push({
      modelKey: data.modelKey,
      model: data.model,
      variantCount: data.variantCount,
      priceFromGross: data.priceFromGross,
      file,
    });
    catalog[data.modelKey] = data;
  }
  index.sort((a, b) => a.modelKey.localeCompare(b.modelKey));
  await fs.writeFile(path.join(OUT_DIR, 'index.json'), JSON.stringify({
    importedAt: new Date().toISOString().slice(0, 10),
    sourceDirectory: 'scripts/import-kia-pricelist-pdfs.mjs',
    modelCount: index.length,
    models: index,
  }, null, 2));
  await fs.writeFile(path.join(OUT_DIR, 'catalog.json'), JSON.stringify(catalog, null, 2));
  await fs.writeFile(path.join(OUT_DIR, 'catalog.js'),
    `// Auto-generated by scripts/import-kia-pricelist-pdfs.mjs – do not edit\nexport default ${JSON.stringify(catalog, null, 2)};\n`);
  return index.length;
}

async function importPdf(pdfPath) {
  const base = path.basename(pdfPath);
  const stem = PDF_ALIASES[base];
  if (!stem) throw new Error(`Unbekannte PDF: ${base}`);
  const meta = FILE_META[stem];
  console.log(`→ ${base} als ${meta.modelKey}`);

  const text = await extractPdfText(pdfPath);
  await fs.mkdir(EXTRACT_DIR, { recursive: true });
  await fs.writeFile(path.join(EXTRACT_DIR, `${stem}.txt`), text, 'utf8');

  let data = parseFile(stem, text);
  await fs.mkdir(OUT_DIR, { recursive: true });

  if (meta.modelKey === 'sportage') {
    const { sportage, sportageHybrid } = splitSportagePricelist(data);
    data = sportage;
    await fs.writeFile(path.join(OUT_DIR, 'sportage.json'), JSON.stringify(sportage, null, 2), 'utf8');
    console.log(`  sportage: ${sportage.variantCount} Varianten (Benzin/Diesel), ab ${sportage.priceFromGross} €`);
    if (sportageHybrid) {
      await fs.writeFile(path.join(OUT_DIR, 'sportage-hybrid.json'), JSON.stringify(sportageHybrid, null, 2), 'utf8');
      console.log(`  sportage-hybrid: ${sportageHybrid.variantCount} Varianten, ab ${sportageHybrid.priceFromGross} €`);
    }
  } else {
    await fs.writeFile(path.join(OUT_DIR, `${meta.modelKey}.json`), JSON.stringify(data, null, 2), 'utf8');
    console.log(`  ${data.variantCount} Varianten, ab ${data.priceFromGross} €`);
  }

  if (data.importNote) console.warn(`  ⚠ ${data.importNote}`);
  return data;
}

const defaultPdfs = [
  'G:\\Meine Ablage\\PREISLISTEN\\EV4-Fastback-Preisliste.pdf',
  'G:\\Meine Ablage\\PREISLISTEN\\Sportage-PHEV-Preisliste.pdf',
  'G:\\Meine Ablage\\PREISLISTEN\\Sportage 29.05.2026.pdf',
  'G:\\Meine Ablage\\PREISLISTEN\\EV6-GT-Pricelist.pdf',
  'G:\\Meine Ablage\\PREISLISTEN\\EV9-GT-Preisliste.pdf',
  'G:\\Meine Ablage\\PREISLISTEN\\PV5-Cargo-Preisliste.pdf',
];

const pdfs = process.argv.slice(2).length ? process.argv.slice(2) : defaultPdfs;

for (const pdf of pdfs) {
  await importPdf(pdf);
}
const count = await rebuildCatalog();
console.log(`Katalog aktualisiert: ${count} Modelle`);
