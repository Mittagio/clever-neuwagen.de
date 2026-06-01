import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, 'data');
const FILES_DIR = path.join(DATA_DIR, 'documents');
const META_PATH = path.join(DATA_DIR, 'documents-meta.json');

export const DOCUMENT_TTL_MS = 48 * 60 * 60 * 1000;

function ensureDirs() {
  fs.mkdirSync(FILES_DIR, { recursive: true });
}

function loadMeta() {
  ensureDirs();
  if (!fs.existsSync(META_PATH)) return [];
  try {
    const parsed = JSON.parse(fs.readFileSync(META_PATH, 'utf8'));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveMeta(records) {
  ensureDirs();
  fs.writeFileSync(META_PATH, JSON.stringify(records, null, 2), 'utf8');
}

function getEncryptionKey() {
  const key = process.env.DOCUMENT_ENCRYPTION_KEY;
  if (!key || key.length < 32) return null;
  return crypto.createHash('sha256').update(key).digest();
}

function encryptBuffer(buffer) {
  const key = getEncryptionKey();
  if (!key) return { data: buffer, encrypted: false };
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(buffer), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    data: Buffer.concat([iv, tag, encrypted]),
    encrypted: true,
  };
}

function decryptBuffer(buffer, meta) {
  if (!meta.encrypted) return buffer;
  const key = getEncryptionKey();
  if (!key) throw new Error('Verschlüsselung aktiv, aber DOCUMENT_ENCRYPTION_KEY fehlt');
  const iv = buffer.subarray(0, 12);
  const tag = buffer.subarray(12, 28);
  const data = buffer.subarray(28);
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]);
}

function filePath(id) {
  return path.join(FILES_DIR, `${id}.bin`);
}

export function purgeExpiredDocuments() {
  const now = Date.now();
  const records = loadMeta();
  let purged = 0;

  const next = records.map((rec) => {
    if (rec.deletedAt) return rec;
    if (new Date(rec.expiresAt).getTime() > now) return rec;

    const fp = filePath(rec.id);
    if (fs.existsSync(fp)) {
      fs.unlinkSync(fp);
      purged += 1;
    }

    return {
      ...rec,
      deletedAt: new Date().toISOString(),
      deletedAutomatically: true,
      filePresent: false,
    };
  });

  saveMeta(next);
  return purged;
}

export function listDocuments({ includeDeleted = false } = {}) {
  purgeExpiredDocuments();
  const records = loadMeta();
  return records
    .filter((r) => includeDeleted || !r.deletedAt)
    .sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt));
}

export function getDocumentMeta(id) {
  return loadMeta().find((r) => r.id === id) ?? null;
}

export function createDocument({
  leadId,
  fileType,
  fileName,
  mimeType,
  sellerId,
  sellerName,
  buffer,
}) {
  purgeExpiredDocuments();

  const id = `doc-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
  const uploadedAt = new Date().toISOString();
  const expiresAt = new Date(Date.now() + DOCUMENT_TTL_MS).toISOString();

  const { data, encrypted } = encryptBuffer(buffer);
  fs.writeFileSync(filePath(id), data);

  const record = {
    id,
    leadId: leadId ?? null,
    fileName,
    fileType,
    mimeType: mimeType ?? 'application/octet-stream',
    uploadedAt,
    expiresAt,
    deletedAt: null,
    deletedAutomatically: false,
    sellerId: sellerId ?? 'seller-demo',
    sellerName: sellerName ?? 'Verkäufer',
    encrypted,
    filePresent: true,
  };

  const records = loadMeta();
  records.unshift(record);
  saveMeta(records);

  return record;
}

export function readDocumentFile(id) {
  const meta = getDocumentMeta(id);
  if (!meta || meta.deletedAt || !meta.filePresent) return null;
  const fp = filePath(id);
  if (!fs.existsSync(fp)) return null;
  const raw = fs.readFileSync(fp);
  return { meta, buffer: decryptBuffer(raw, meta) };
}

export function deleteDocument(id, { automatic = false } = {}) {
  const records = loadMeta();
  const idx = records.findIndex((r) => r.id === id);
  if (idx === -1) return null;

  const rec = records[idx];
  const fp = filePath(id);
  if (fs.existsSync(fp)) fs.unlinkSync(fp);

  const updated = {
    ...rec,
    deletedAt: new Date().toISOString(),
    deletedAutomatically: automatic,
    filePresent: false,
  };

  records[idx] = updated;
  saveMeta(records);
  return updated;
}

export function startDocumentCleanupInterval() {
  const intervalMs = Number(process.env.DOCUMENT_PURGE_INTERVAL_MS) || 15 * 60 * 1000;
  setInterval(() => {
    try {
      const n = purgeExpiredDocuments();
      if (n > 0) console.log(`[documents] ${n} abgelaufene Datei(en) gelöscht`);
    } catch (err) {
      console.error('[documents] Purge-Fehler:', err.message);
    }
  }, intervalMs).unref?.();
}
