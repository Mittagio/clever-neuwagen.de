import './loadEnv.js';
import express from 'express';
import cors from 'cors';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import intelligenceRoutes from './intelligenceRoutes.js';
import sprint5Routes from './sprint5Routes.js';
import googlePlacesRoutes from './googlePlacesRoutes.js';
import pilotLeadsRoutes from './pilotLeadsRoutes.js';
import customerOfferLinkRoutes from './customerOfferLinkRoutes.js';
import customerOfferPortfolioRoutes from './customerOfferPortfolioRoutes.js';
import cleverCustomerQueryRoutes from './cleverCustomerQueryRoutes.js';
import advisorRoutes from './advisorRoutes.js';
import customerRecordsRoutes from './customerRecordsRoutes.js';
import customerInquiryRoutes from './customerInquiryRoutes.js';
import stammdatenRoutes from './stammdatenRoutes.js';
import configuratorFoundationRoutes from './configuratorFoundationRoutes.js';
import technicalSyncRoutes from './technicalSyncRoutes.js';
import { startDocumentCleanupInterval } from './documentStore.js';
import { resolvePilotDataDir, ensureDataDir } from './jsonStore.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIST_DIR = path.join(__dirname, '..', 'dist');
const PORT = Number(process.env.PORT) || 3001;
const HOST = process.env.HOST || '0.0.0.0';

function getLanAddresses() {
  const ips = new Set();
  for (const nets of Object.values(os.networkInterfaces())) {
    for (const net of nets ?? []) {
      if (net.family === 'IPv4' && !net.internal && net.address) {
        ips.add(net.address);
      }
    }
  }
  return [...ips];
}

function logServerUrls(host, port) {
  const localUrl = `http://localhost:${port}`;
  console.log(`Clever-Neuwagen Server: ${localUrl}`);
  if (host === '0.0.0.0') {
    const lanIps = getLanAddresses();
    if (lanIps.length) {
      console.log('WLAN (gleiches Netz):');
      for (const ip of lanIps) {
        console.log(`  http://${ip}:${port}`);
      }
    }
  } else if (host !== '127.0.0.1' && host !== 'localhost') {
    console.log(`Netzwerk: http://${host}:${port}`);
  }
}

const ROBOTS_PUBLIC = 'User-agent: *\nAllow: /\n';
const ROBOTS_TEST = 'User-agent: *\nDisallow: /\n';

function isInternalTestEnv() {
  return process.env.VITE_INTERNAL_TEST_ENV === 'true'
    || process.env.INTERNAL_TEST_ENV === 'true';
}

const app = express();

if (process.env.NODE_ENV === 'production') {
  app.set('trust proxy', 1);
}

app.use(cors({
  origin: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'Accept',
    'X-File-Type',
    'X-File-Name',
    'X-Lead-Id',
    'X-Seller-Id',
    'X-Seller-Name',
  ],
}));

app.use(express.json({ limit: '1mb' }));
app.use('/api/v1', sprint5Routes);
app.use('/api/v1', pilotLeadsRoutes);
app.use('/api/v1', customerOfferLinkRoutes);
app.use('/api/v1', customerOfferPortfolioRoutes);
app.use('/api/v1', cleverCustomerQueryRoutes);
app.use('/api/v1', advisorRoutes);
app.use('/api/v1', customerRecordsRoutes);
app.use('/api/v1', customerInquiryRoutes);
app.use('/api/v1', stammdatenRoutes);
app.use('/api/v1', configuratorFoundationRoutes);
app.use('/api/v1', technicalSyncRoutes);
app.use('/api/v1', googlePlacesRoutes);
app.use('/api', intelligenceRoutes);

startDocumentCleanupInterval();
ensureDataDir();

app.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'clever-neuwagen', ts: new Date().toISOString() });
});

app.get('/robots.txt', (_req, res) => {
  res.type('text/plain').send(isInternalTestEnv() ? ROBOTS_TEST : ROBOTS_PUBLIC);
});

app.get('/sitemap.xml', (_req, res) => {
  if (isInternalTestEnv()) {
    res.status(404).type('text/plain').send('Not found');
    return;
  }
  res.status(404).type('text/plain').send('Not found');
});

if (process.env.NODE_ENV === 'production' && fs.existsSync(DIST_DIR)) {
  app.use(express.static(DIST_DIR, {
    setHeaders(res, filePath) {
      if (filePath.endsWith(`${path.sep}index.html`)) {
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      }
    },
  }));
  app.get(/^(?!\/api).*/, (_req, res) => {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.sendFile(path.join(DIST_DIR, 'index.html'));
  });
}

const server = app.listen(PORT, HOST, () => {
  logServerUrls(HOST, PORT);
  console.log(`Pilot-Daten (JSON): ${resolvePilotDataDir()}`);
  console.log(`Intelligence API: http://localhost:${PORT}/api/v1/intelligence/overview?period=7d`);
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`Port ${PORT} ist belegt. Alten Prozess beenden oder PORT setzen.`);
  } else {
    console.error('Server-Fehler:', err.message);
  }
  process.exit(1);
});
