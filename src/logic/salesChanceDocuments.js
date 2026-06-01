const HOURS_48 = 48 * 60 * 60 * 1000;

function seedDocsForLead(lead) {
  const now = Date.now();
  const base = [
    { type: 'selbstauskunft', fileName: 'Selbstauskunft.pdf' },
    { type: 'ausweis', fileName: 'Personalausweis.pdf' },
    { type: 'fuehrerschein', fileName: 'Fuehrerschein.pdf' },
  ];

  if (lead.status !== 'neu') {
    base.push({ type: 'voucher', fileName: 'Corporate-Voucher.jpg' });
  }

  return base.map((d, i) => ({
    id: `doc-${lead.id}-${d.type}`,
    ...d,
    uploadedAt: new Date(now - (i + 1) * 3600000).toISOString(),
    expiresAt: new Date(now + HOURS_48 - i * 3600000).toISOString(),
  }));
}

export function getDocumentsForLead(lead) {
  const stored = lead.documents;
  if (Array.isArray(stored) && stored.length) return stored;
  return seedDocsForLead(lead);
}

export function formatExpiryCountdown(expiresAt) {
  const diff = new Date(expiresAt).getTime() - Date.now();
  if (diff <= 0) return 'Abgelaufen';
  const h = Math.floor(diff / 3600000);
  if (h < 24) return `${h} Std. verbleibend`;
  const d = Math.floor(h / 24);
  return `${d} Tag${d !== 1 ? 'e' : ''} · 48h-Tresor`;
}
