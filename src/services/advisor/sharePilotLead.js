/**
 * Share-Session → Pilot-Lead (Verkäufer-Inbox)
 * Wird server- und clientseitig genutzt.
 */

const SELLERS = [
  { id: 'mike-quach', name: 'Mike Quach' },
  { id: 'andreas', name: 'Andreas' },
  { id: 'lisa', name: 'Lisa' },
  { id: 'thomas', name: 'Thomas' },
];

function historyEntry(text, type = 'system') {
  return {
    id: `hist-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    at: new Date().toISOString(),
    type,
    text,
  };
}

export function shareSessionLeadId(token) {
  return `lead-share-${String(token ?? '').toLowerCase()}`;
}

function resolveOwner(sellerName = '') {
  const normalized = sellerName.trim().toLowerCase();
  if (!normalized) return { ownerId: null, ownerName: null };
  const match = SELLERS.find((s) => s.name.toLowerCase() === normalized);
  return { ownerId: match?.id ?? null, ownerName: match?.name ?? sellerName };
}

function pickTopMatch(session) {
  const fromGroups = session.modelLineGroups?.[0]?.primaryMatch;
  return session.matches?.[0] ?? fromGroups ?? null;
}

function buildVehicleSummary(session) {
  const rows = session.matches ?? [];
  if (!rows.length && session.modelLineGroups?.length) {
    return session.modelLineGroups
      .map((g) => {
        const m = g.primaryMatch;
        if (!m) return g.label;
        return m.trimLabel ? `${m.title ?? g.label} (${m.trimLabel})` : (m.title ?? g.label);
      })
      .join(', ');
  }
  return rows
    .map((m) => (m.trimLabel ? `${m.title} (${m.trimLabel})` : m.title))
    .join(', ');
}

/**
 * @param {object} session – Share-Session (Server-Snapshot)
 * @param {object|null} existingLead
 * @param {'created'|'viewed'|'inquiry_confirmed'} event
 */
export function buildPilotLeadFromShareSession(session, existingLead = null, event = 'created') {
  const token = session.token;
  const now = new Date().toISOString();
  const top = pickTopMatch(session);
  const { ownerId, ownerName } = resolveOwner(session.sellerName);
  const summary = buildVehicleSummary(session);
  const history = [...(existingLead?.history ?? [])];

  const hasCreatedEntry = history.some((h) => /Vergleichslink erstellt/i.test(h.text ?? ''));
  const hasInquiryEntry = history.some((h) => /Anfrage über Vergleichslink bestätigt/i.test(h.text ?? ''));

  if (event === 'created' && !hasCreatedEntry) {
    history.push(historyEntry(
      `Vergleichslink erstellt · ${session.matches?.length ?? 0} Fahrzeuge`,
    ));
    if (summary) {
      history.push(historyEntry(`Empfehlung: ${summary}`, 'offer'));
    }
  }

  if (event === 'inquiry_confirmed' && !hasInquiryEntry) {
    history.push(historyEntry('✅ Kunde hat Anfrage über Vergleichslink bestätigt', 'note'));
  }

  const inquiryConfirmed = Boolean(session.inquiryConfirmed ?? event === 'inquiry_confirmed');
  let status = existingLead?.status ?? 'angebotVersendet';
  if (inquiryConfirmed) status = 'neu';
  else if (event === 'created') status = 'angebotVersendet';

  const vehicleBrand = top?.vehicle?.brand ?? 'Kia';
  const vehicleTitle = top?.title ?? top?.model ?? summary.split(',')[0] ?? '—';

  return {
    ...(existingLead ?? {}),
    id: shareSessionLeadId(token),
    shareToken: token,
    createdAt: existingLead?.createdAt ?? now,
    updatedAt: now,
    status,
    source: 'gespraech',
    dealerId: session.dealerSlug ?? 'autohaus-trinkle',
    ownerId: existingLead?.ownerId ?? ownerId,
    ownerName: existingLead?.ownerName ?? ownerName ?? session.sellerName ?? null,
    assignedAt: existingLead?.assignedAt ?? (ownerId ? now : null),
    contact: {
      plz: existingLead?.contact?.plz ?? '',
      preferredContact: session.customer?.email ? 'email' : 'phone',
      name: session.customer?.name ?? existingLead?.contact?.name ?? '',
      phone: session.customer?.phone ?? existingLead?.contact?.phone ?? '',
      email: session.customer?.email ?? existingLead?.contact?.email ?? '',
    },
    vehicle: {
      brand: vehicleBrand,
      model: vehicleTitle,
      trim: top?.trimLabel ?? '',
      label: vehicleTitle,
    },
    paymentType: existingLead?.paymentType ?? 'leasing',
    desiredRate: top?.monthlyRate ?? existingLead?.desiredRate ?? null,
    currentRate: top?.monthlyRate ?? existingLead?.currentRate ?? null,
    cleverQuotePercent: top?.cleverQuote?.percent ?? existingLead?.cleverQuotePercent ?? null,
    shareUrl: `/vergleich/${encodeURIComponent(token)}`,
    wishLabels: session.wishLabels ?? existingLead?.wishLabels ?? [],
    chipIds: session.chipIds ?? existingLead?.chipIds ?? [],
    advisorShare: true,
    compareCount: session.matches?.length ?? existingLead?.compareCount ?? 0,
    viewCount: session.viewCount ?? existingLead?.viewCount ?? 0,
    inquiryConfirmed,
    inquiryConfirmedAt: session.inquiryConfirmedAt ?? existingLead?.inquiryConfirmedAt ?? null,
    notes: existingLead?.notes ?? (summary ? `Beratungsvergleich: ${summary}` : 'Beratungsvergleich'),
    history,
  };
}
