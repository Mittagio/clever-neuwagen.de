import { Router } from 'express';
import express from 'express';
import {
  createDocument,
  deleteDocument,
  listDocuments,
  readDocumentFile,
  purgeExpiredDocuments,
} from './documentStore.js';

const router = Router();

router.get('/documents', (_req, res) => {
  const includeDeleted = _req.query.includeDeleted === '1';
  res.json({ documents: listDocuments({ includeDeleted }) });
});

router.post('/documents/purge', (_req, res) => {
  const count = purgeExpiredDocuments();
  res.json({ ok: true, purged: count });
});

router.post(
  '/documents',
  express.raw({ type: () => true, limit: '12mb' }),
  (req, res) => {
    const fileType = req.headers['x-file-type'];
    const fileName = req.headers['x-file-name'] ?? 'upload.bin';
    const leadId = req.headers['x-lead-id'] ?? null;
    const sellerId = req.headers['x-seller-id'] ?? 'seller-demo';
    const sellerName = req.headers['x-seller-name'] ?? 'Verkäufer';

    if (!fileType) {
      res.status(400).json({ error: 'X-File-Type Header fehlt' });
      return;
    }
    if (!req.body?.length) {
      res.status(400).json({ error: 'Dateiinhalt fehlt' });
      return;
    }

    const record = createDocument({
      leadId,
      fileType,
      fileName: decodeURIComponent(String(fileName)),
      mimeType: req.headers['content-type'],
      sellerId,
      sellerName,
      buffer: Buffer.from(req.body),
    });

    res.status(201).json({ document: record });
  },
);

router.get('/documents/:id/download', (req, res) => {
  const file = readDocumentFile(req.params.id);
  if (!file) {
    res.status(404).json({ error: 'Dokument nicht verfügbar oder bereits gelöscht' });
    return;
  }

  res.setHeader('Content-Type', file.meta.mimeType);
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="${encodeURIComponent(file.meta.fileName)}"`,
  );
  res.send(file.buffer);
});

router.delete('/documents/:id', (req, res) => {
  const deleted = deleteDocument(req.params.id, { automatic: false });
  if (!deleted) {
    res.status(404).json({ error: 'Dokument nicht gefunden' });
    return;
  }
  res.json({ document: deleted });
});

export default router;
