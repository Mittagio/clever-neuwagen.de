/**
 * Notepad Memo/Scan – kompakte UI, Attribution sichtbar
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(join(__dirname, 'CustomerAkteNotepadCapture.jsx'), 'utf8');

assert.ok(source.includes('proposeSellerInsightLabels'), 'Chip-Vorschläge');
assert.ok(source.includes('HANDWRITTEN_NOTE'), 'Scan-Kontext');
assert.ok(source.includes('VOICE_NOTE'), 'Memo-Kontext');
assert.ok(source.includes('sellerInitials'), 'Attribution');
assert.ok(source.includes('aria-label="Memo"'), 'Memo-Icon ohne langen Text');
assert.ok(source.includes('aria-label="Scan"'), 'Scan-Icon ohne langen Text');
assert.ok(!/Was haben Sie gerade vom Kunden gelernt/.test(source), 'kein langer Fließtext');

console.log('CustomerAkteNotepadCapture.test.js: ok');
