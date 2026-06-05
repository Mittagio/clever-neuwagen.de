/**
 * Share-Sessions ↔ Kundenkonto (/account, /mein-bereich)
 */

const MEDALS = ['🥇', '🥈', '🥉'];

function sessionItems(session) {
  if (session.modelLineGroups?.length) {
    return session.modelLineGroups.map((group, index) => {
      const primary = group.primaryMatch ?? {};
      return {
        id: group.modelLineKey ?? primary.slug ?? `line-${index}`,
        label: group.label ?? primary.title ?? primary.model ?? 'Modell',
        monthlyRate: primary.monthlyRate ?? null,
        rankMedal: MEDALS[index] ?? `${index + 1}.`,
      };
    });
  }
  return (session.matches ?? []).map((match, index) => ({
    id: match.slug ?? `match-${index}`,
    label: match.title ?? match.model ?? 'Fahrzeug',
    monthlyRate: match.monthlyRate ?? null,
    rankMedal: MEDALS[index] ?? `${index + 1}.`,
  }));
}

export function buildShareComparisonAccountEntry(session) {
  const items = sessionItems(session);
  const top = items[0];

  return {
    id: `share-${session.token}`,
    shareToken: session.token,
    date: new Date(session.createdAt ?? Date.now()).toISOString(),
    status: session.inquiryConfirmed ? 'anfrage_bestaetigt' : 'berater_empfehlung',
    items,
    label: top?.label ?? 'Berater-Vergleich',
    dealer: session.dealerName ?? '',
    sellerName: session.sellerName ?? '',
    shareUrl: `/vergleich/${encodeURIComponent(session.token)}`,
    source: 'advisor_share',
    inquiryConfirmed: Boolean(session.inquiryConfirmed),
    wishLabels: session.wishLabels ?? [],
  };
}

export function buildShareInquiryAccountEntry(session) {
  const items = sessionItems(session);
  const summary = items.map((i) => i.label).slice(0, 3).join(', ');

  return {
    id: `inq-share-${session.token}`,
    shareToken: session.token,
    brand: 'Kia',
    model: items[0]?.label ?? 'Berater-Empfehlung',
    label: summary || 'Anfrage über Vergleichslink',
    dealer: session.dealerName ?? '',
    date: new Date(session.inquiryConfirmedAt ?? session.createdAt ?? Date.now()).toISOString(),
    status: 'Anfrage bestätigt',
    contact: session.customer ?? {},
    source: 'advisor_share',
    shareUrl: `/vergleich/${encodeURIComponent(session.token)}`,
  };
}

export function mergeShareSessionsIntoComparisons(existing = [], sessions = []) {
  const known = new Set(existing.map((c) => c.shareToken?.toUpperCase()).filter(Boolean));
  const merged = [...existing];

  for (const session of sessions) {
    const token = session.token?.toUpperCase();
    if (!token || known.has(token)) {
      if (token && known.has(token)) {
        const idx = merged.findIndex((c) => c.shareToken?.toUpperCase() === token);
        if (idx >= 0) merged[idx] = buildShareComparisonAccountEntry(session);
      }
      continue;
    }
    merged.unshift(buildShareComparisonAccountEntry(session));
    known.add(token);
  }

  return merged.sort((a, b) => new Date(b.date) - new Date(a.date));
}

export function mergeShareSessionsIntoInquiries(existing = [], sessions = []) {
  const confirmed = sessions.filter((s) => s.inquiryConfirmed);
  const known = new Set(existing.map((i) => i.shareToken?.toUpperCase()).filter(Boolean));
  const merged = [...existing];

  for (const session of confirmed) {
    const token = session.token?.toUpperCase();
    if (!token || known.has(token)) continue;
    merged.unshift(buildShareInquiryAccountEntry(session));
    known.add(token);
  }

  return merged.sort((a, b) => new Date(b.date) - new Date(a.date));
}

export function addLinkedShareToken(data, token) {
  if (!token) return data;
  const normalized = String(token).toUpperCase();
  const tokens = [...new Set([...(data.linkedShareTokens ?? []), normalized])];
  return { ...data, linkedShareTokens: tokens };
}

export function dedupeShareSessions(sessions = []) {
  const map = new Map();
  for (const session of sessions) {
    const key = session.token?.toUpperCase();
    if (key) map.set(key, session);
  }
  return [...map.values()].sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));
}
