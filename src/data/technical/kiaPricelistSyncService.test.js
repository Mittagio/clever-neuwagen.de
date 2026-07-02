import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  buildKiaTechnicalSyncReport,
  compareKiaTowingFromText,
  summarizeKiaSyncReport,
} from './kiaPricelistSyncService.js';
import { KIA_PDF_SOURCE_CATALOG, buildKiaPdfDownloadUrl } from './brands/kia/pdfSourceCatalog.js';
import { matchVerifiedVariants, parseVariantHintsFromQuery } from './verifiedTechnicalDataRegistry.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const EXTRACT_DIR = path.resolve(__dirname, '../../../scripts/pdf-extract');

assert.ok(KIA_PDF_SOURCE_CATALOG.every((entry) => entry.downloadUrl?.includes('kia.com')));
assert.equal(
  buildKiaPdfDownloadUrl('Kia-Germany-EV5-Preisliste'),
  'https://www.kia.com/content/dam/kwcms/kme/de/de/assets/contents/utility/Preisliste/Kia-Germany-EV5-Preisliste.pdf',
);

const ev5Entry = KIA_PDF_SOURCE_CATALOG.find((e) => e.modelKey === 'ev5');
const ev5Text = await fs.readFile(path.join(EXTRACT_DIR, ev5Entry.file), 'utf8');
const ev5Row = compareKiaTowingFromText(ev5Entry, { text: ev5Text });
assert.equal(ev5Row.status, 'ok');
assert.ok(ev5Row.profileBrakedKg.includes(1200));

const textByFile = Object.fromEntries(
  await Promise.all(
    KIA_PDF_SOURCE_CATALOG.map(async (entry) => [
      entry.file,
      await fs.readFile(path.join(EXTRACT_DIR, entry.file), 'utf8').catch(() => ''),
    ]),
  ),
);
const report = buildKiaTechnicalSyncReport(textByFile);
assert.equal(report.brandKey, 'kia');
assert.ok(report.summary.ok >= 15);
assert.ok(report.pending.length >= 3);

const headline = summarizeKiaSyncReport(report);
assert.ok(headline.headline);
assert.ok(['success', 'warning', 'danger'].includes(headline.tone));

const hintsKw = parseVariantHintsFromQuery('anhängelast kia ev5 160 kw');
assert.equal(hintsKw.powerKw, 160);
const ev5KwMatch = matchVerifiedVariants('ev5', hintsKw);
assert.equal(ev5KwMatch.matched.length, 1);
assert.equal(ev5KwMatch.matched[0].towing?.brakedKg, 1200);

const hints204 = parseVariantHintsFromQuery('anhängelast kia ev5 204 ps');
const ev5Ps204 = matchVerifiedVariants('ev5', hints204);
assert.equal(ev5Ps204.powerPsMismatch, true);

const hints218 = parseVariantHintsFromQuery('anhängelast kia ev5 218 ps');
const ev5Ps218 = matchVerifiedVariants('ev5', hints218);
assert.equal(ev5Ps218.matched.length, 1);

console.log('kiaPricelistSyncService.test.js: ok');
