#!/usr/bin/env node
/** Schreibt manual-supplements.json aus ocrPdfCanonical.js (+ ev5-gt) */
import { writeFileSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { OCR_PDF_SUPPLEMENTS } from '../src/data/kia/ocrPdfCanonical.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outPath = join(root, 'src/data/kia/pricelist-imports/manual-supplements.json');

const existing = JSON.parse(readFileSync(outPath, 'utf8'));
const merged = { ...existing, ...OCR_PDF_SUPPLEMENTS };

writeFileSync(outPath, `${JSON.stringify(merged, null, 2)}\n`, 'utf8');
console.log('manual-supplements.json synced:', Object.keys(OCR_PDF_SUPPLEMENTS).join(', '));
