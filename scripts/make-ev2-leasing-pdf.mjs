/**
 * Minimal text-extractable leasing PDF fixtures for Offer Tool browser/node E2E.
 * Usage: node scripts/make-ev2-leasing-pdf.mjs
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = join(__dirname, '..', 'tests', 'fixtures');

function escapePdfText(s) {
  return String(s).replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}

function buildSimplePdf(lines) {
  const contentLines = ['BT', '/F1 11 Tf', '50 760 Td', '14 TL'];
  lines.forEach((line, i) => {
    if (i === 0) contentLines.push(`(${escapePdfText(line)}) Tj`);
    else contentLines.push(`T* (${escapePdfText(line)}) Tj`);
  });
  contentLines.push('ET');
  const stream = contentLines.join('\n');
  const objects = [];
  objects.push('1 0 obj<< /Type /Catalog /Pages 2 0 R >>endobj\n');
  objects.push('2 0 obj<< /Type /Pages /Kids [3 0 R] /Count 1 >>endobj\n');
  objects.push(
    '3 0 obj<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] '
    + '/Contents 4 0 R /Resources<< /Font<< /F1 5 0 R >> >> >>endobj\n',
  );
  objects.push(`4 0 obj<< /Length ${stream.length} >>stream\n${stream}\nendstream\nendobj\n`);
  objects.push('5 0 obj<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>endobj\n');

  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  for (const obj of objects) {
    offsets.push(Buffer.byteLength(pdf, 'utf8'));
    pdf += obj;
  }
  const xrefStart = Buffer.byteLength(pdf, 'utf8');
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += '0000000000 65535 f \n';
  for (let i = 1; i < offsets.length; i += 1) {
    pdf += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
  }
  pdf += `trailer<< /Size ${objects.length + 1} /Root 1 0 R >>\n`;
  pdf += `startxref\n${xrefStart}\n%%EOF\n`;
  return Buffer.from(pdf, 'utf8');
}

const earthLines = [
  'KIA Leasing Kalkulation',
  'Kia EV2 Earth 64 kWh Frontantrieb',
  'Lackierung: Aurora Black Pearl',
  'Business-Paket',
  'Monatliche Gesamtrate 289,00 EUR',
  'Monatsrate Finanzleasing 289,00 EUR',
  'Anzahlung 0,00 EUR',
  'Ueberfuehrung 990,00 EUR',
  'Laufzeit 48 Monate',
  'Laufleistung / Jahr 15.000 km',
];

// Draft typisch Earth (nach 289-PDF) → dieser PDF liefert Air → Trim-Konflikt
const airConflictLines = [
  'KIA Leasing Kalkulation',
  'Kia EV2 Air 64 kWh Frontantrieb',
  'Lackierung: Clear White',
  'Monatliche Gesamtrate 301,50 EUR',
  'Monatsrate Finanzleasing 301,50 EUR',
  'Anzahlung 1000,00 EUR',
  'Ueberfuehrung 990,00 EUR',
  'Laufzeit 36 Monate',
  'Laufleistung / Jahr 10.000 km',
];

const replaceLines = [
  'KIA Leasing Kalkulation KORRIGIERT',
  'Kia EV2 Earth 64 kWh Frontantrieb',
  'Lackierung: Aurora Black Pearl',
  'Monatliche Gesamtrate 275,00 EUR',
  'Monatsrate Finanzleasing 275,00 EUR',
  'Anzahlung 0,00 EUR',
  'Ueberfuehrung 890,00 EUR',
  'Laufzeit 48 Monate',
  'Laufleistung / Jahr 15.000 km',
];

mkdirSync(outDir, { recursive: true });
const files = [
  ['EV2_Earth_Leasing_289.pdf', earthLines],
  ['EV2_Earth_vs_Air_Conflict.pdf', airConflictLines],
  ['EV2_Earth_Leasing_275_replace.pdf', replaceLines],
];

for (const [name, lines] of files) {
  const path = join(outDir, name);
  writeFileSync(path, buildSimplePdf(lines));
  console.log('wrote', path);
}
