#!/usr/bin/env node
/** Aktualisiert picanto-Block in catalog.js aus picanto.json */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import picanto from '../src/data/kia/pricelist-imports/picanto.json' with { type: 'json' };

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const catalogPath = join(root, 'src/data/kia/pricelist-imports/catalog.js');
let src = readFileSync(catalogPath, 'utf8');

const block = JSON.stringify(picanto, null, 2)
  .split('\n')
  .map((line, i) => (i === 0 ? line : `    ${line}`))
  .join('\n');

src = src.replace(/"picanto": \{[\s\S]*?\n  \},/, `"picanto": ${block},`);

writeFileSync(catalogPath, src, 'utf8');
console.log('catalog.js picanto patched');
