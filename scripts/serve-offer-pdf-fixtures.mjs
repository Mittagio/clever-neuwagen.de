/**
 * Serve PDF fixtures for browser E2E file injection.
 * Usage: node scripts/serve-offer-pdf-fixtures.mjs
 */
import http from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixturesDir = join(__dirname, '..', 'tests', 'fixtures');
const port = Number(process.env.PDF_FIXTURE_PORT || 3457);

const server = http.createServer((req, res) => {
  const name = basename(decodeURIComponent((req.url || '/').split('?')[0]));
  if (!name || name === '/' || name.includes('..')) {
    res.writeHead(404);
    res.end('not found');
    return;
  }
  const path = join(fixturesDir, name);
  if (!existsSync(path) || !name.toLowerCase().endsWith('.pdf')) {
    res.writeHead(404);
    res.end('not found');
    return;
  }
  const buf = readFileSync(path);
  res.writeHead(200, {
    'Content-Type': 'application/pdf',
    'Access-Control-Allow-Origin': '*',
    'Content-Length': buf.length,
  });
  res.end(buf);
});

server.listen(port, '127.0.0.1', () => {
  console.log(`pdf-fixtures http://127.0.0.1:${port}/EV2_Earth_Leasing_289.pdf`);
});
