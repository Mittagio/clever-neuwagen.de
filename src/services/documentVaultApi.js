const API_BASE = '/api/v1';

async function parseJson(res) {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error ?? `API-Fehler ${res.status}`);
  }
  return data;
}

export async function fetchDocuments({ includeDeleted = false } = {}) {
  const q = includeDeleted ? '?includeDeleted=1' : '';
  const data = await parseJson(await fetch(`${API_BASE}/documents${q}`));
  return data.documents ?? [];
}

export async function uploadDocument({
  file,
  fileType,
  leadId,
  sellerId,
  sellerName,
}) {
  const res = await fetch(`${API_BASE}/documents`, {
    method: 'POST',
    headers: {
      'Content-Type': file.type || 'application/octet-stream',
      'X-File-Type': fileType,
      'X-File-Name': encodeURIComponent(file.name),
      'X-Lead-Id': leadId ?? '',
      'X-Seller-Id': sellerId ?? 'seller-demo',
      'X-Seller-Name': encodeURIComponent(sellerName ?? 'Verkäufer'),
    },
    body: file,
  });
  return parseJson(res);
}

export function getDocumentDownloadUrl(id) {
  return `${API_BASE}/documents/${id}/download`;
}

export async function deleteDocument(id) {
  return parseJson(await fetch(`${API_BASE}/documents/${id}`, { method: 'DELETE' }));
}

export async function submitSelbstauskunft(payload) {
  const res = await fetch(`${API_BASE}/selbstauskunft`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return parseJson(res);
}

export async function fetchSelbstauskunftList() {
  const data = await parseJson(await fetch(`${API_BASE}/selbstauskunft`));
  return data.items ?? [];
}
