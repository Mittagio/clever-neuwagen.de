import express from 'express';
import cors from 'cors';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import intelligenceRoutes from './intelligenceRoutes.js';
import sprint5Routes from './sprint5Routes.js';
import googlePlacesRoutes from './googlePlacesRoutes.js';
import pilotLeadsRoutes from './pilotLeadsRoutes.js';
import advisorRoutes from './advisorRoutes.js';
import customerRecordsRoutes from './customerRecordsRoutes.js';
import stammdatenRoutes from './stammdatenRoutes.js';
import { startDocumentCleanupInterval } from './documentStore.js';
import { resolvePilotDataDir, ensureDataDir } from './jsonStore.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIST_DIR = path.join(__dirname, '..', 'dist');
const PORT = Number(process.env.PORT) || 3001;
const HOST = process.env.HOST
  || (process.env.NODE_ENV === 'production' ? '127.0.0.1' : '0.0.0.0');

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
app.use('/api/v1', advisorRoutes);
app.use('/api/v1', customerRecordsRoutes);
app.use('/api/v1', stammdatenRoutes);
app.use('/api/v1', googlePlacesRoutes);
app.use('/api', intelligenceRoutes);

startDocumentCleanupInterval();
ensureDataDir();

app.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'clever-neuwagen', ts: new Date().toISOString() });
});

if (process.env.NODE_ENV === 'production' && fs.existsSync(DIST_DIR)) {
  app.use(express.static(DIST_DIR));
  app.get(/^(?!\/api).*/, (_req, res) => {
    res.sendFile(path.join(DIST_DIR, 'index.html'));
  });
}

const server = app.listen(PORT, HOST, () => {
  console.log(`Clever-Neuwagen Server: http://${HOST === '0.0.0.0' ? 'localhost' : HOST}:${PORT}`);
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
