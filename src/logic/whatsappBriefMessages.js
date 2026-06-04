/**
 * Feinschliff – WhatsApp-Nachrichten im Berater-Format (Sprint 40+)
 */

function formatMatchLine(match, index) {
  const medals = ['🥇', '🥈', '🥉'];
  const medal = medals[index] ?? `${index + 1}.`;
  const title = match.model ?? match.title ?? match.vehicle?.model ?? 'Fahrzeug';
  const pct = match.cleverQuote?.percent ?? match.score ?? null;
  const rate = match.bestOffer?.monthlyRate ?? match.vehicle?.monthlyRate ?? match.monthlyRate;
  const rateStr = rate != null ? `${Math.round(rate)} €/Monat` : '';

  let line = `${medal} ${title}`;
  if (pct != null) line += ` – ${pct} % CleverQuote`;
  if (rateStr) line += ` – ${rateStr}`;
  return line;
}

/**
 * Verkäufermodus: 3 beste Treffer + Wünsche + Link
 */
export function buildSalesAdvisorWhatsAppMessage({
  customerName = 'Kunde',
  sellerName = 'Ihr Verkaufsberater',
  dealerName = 'Autohaus',
  matches = [],
  shareUrl = '',
  wishLabels = [],
  budgetMax = null,
}) {
  const top = matches.slice(0, 3);
  const lines = [
    `Hallo ${customerName},`,
    '',
    `wir haben ${matches.length || top.length} Fahrzeuge geprüft – diese ${top.length} passen am besten:`,
    '',
  ];

  if (wishLabels.length) {
    lines.push('Ihre Wünsche:');
    wishLabels.slice(0, 6).forEach((w) => lines.push(`✓ ${w}`));
    lines.push('');
  }

  if (budgetMax) {
    lines.push(`Budget: bis ${budgetMax} €/Monat`);
    lines.push('');
  }

  top.forEach((m, i) => lines.push(formatMatchLine(m, i)));

  if (shareUrl) {
    lines.push('', 'Alle Details & Vergleich:', shareUrl);
  }

  lines.push('', 'Viele Grüße', sellerName, dealerName);
  return lines.join('\n');
}

/**
 * Händler antwortet auf strukturierte Kundenanfrage
 */
export function buildInquiryBriefWhatsAppMessage({ brief, sellerName = 'Ihr Ansprechpartner', dealerName = '' }) {
  if (!brief) {
    return `Hallo, vielen Dank für Ihre Anfrage. Wir melden uns in Kürze.\n\n${sellerName}\n${dealerName}`.trim();
  }

  const name = brief.customerName || 'Hallo';
  const greeting = brief.customerName ? `Hallo ${brief.customerName},` : 'Hallo,';

  const lines = [
    greeting,
    '',
    'vielen Dank für Ihre Anfrage – ich habe alles vorbereitet:',
    '',
  ];

  if (brief.cleverQuotePercent != null) {
    lines.push(`${brief.cleverQuotePercent} % CleverQuote zu Ihren Wünschen`);
  }
  if (brief.recommended?.title) {
    lines.push(`Empfohlen: ${brief.recommended.title}`);
  }
  if (brief.variant?.priceLabel) {
    lines.push(`Ihre Variante: ${brief.variant.priceLabel}`);
  }
  if (brief.deliveryLabel) {
    lines.push(brief.deliveryLabel);
  }

  lines.push('', 'Ich melde mich persönlich bei Ihnen.', '', sellerName, dealerName);
  return lines.filter(Boolean).join('\n');
}

export function buildSalesWhatsAppUrl({ phone, message }) {
  const digits = String(phone ?? '').replace(/\D/g, '');
  const base = digits ? `https://wa.me/${digits}` : 'https://wa.me/';
  return `${base}?text=${encodeURIComponent(message)}`;
}
