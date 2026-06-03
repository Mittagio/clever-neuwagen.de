/**
 * KI-Textassistent (regelbasiert) – WhatsApp & E-Mail im Gesprächsmodus
 */

function numberedVehicles(matches = []) {
  return matches.map((m, i) => {
    const title = m.model ?? m.title ?? 'Fahrzeug';
    const pct = m.cleverQuote?.percent ?? m.score ?? '—';
    return `${i + 1}. ${title} – CleverQuote ${pct} %`;
  });
}

export function buildDefaultWhatsAppMessage({
  customerName = 'Kunde',
  sellerName = 'Verkaufsberater',
  dealerName = 'Autohaus',
  matches = [],
  shareUrl = '',
  wishLabels = [],
}) {
  const lines = numberedVehicles(matches);
  return [
    `Hallo ${customerName},`,
    '',
    `wie besprochen habe ich Ihnen ${matches.length} passende Fahrzeuge zusammengestellt.`,
    '',
    ...lines,
    '',
    'Hier können Sie die Fahrzeuge direkt vergleichen:',
    shareUrl,
    '',
    'Viele Grüße',
    sellerName,
    dealerName,
  ].join('\n');
}

export function buildDefaultEmailMessage({
  customerName = 'Kunde',
  sellerName = 'Verkaufsberater',
  dealerName = 'Autohaus',
  matches = [],
  shareUrl = '',
  wishLabels = [],
}) {
  const wishBlock = wishLabels.length
    ? ['Besonders wichtig waren Ihnen:', ...wishLabels.map((w) => `• ${w}`), '']
    : [];

  return [
    `Guten Tag ${customerName},`,
    '',
    'vielen Dank für das angenehme Gespräch.',
    '',
    `Auf Basis Ihrer Wünsche habe ich Ihnen ${matches.length} passende Fahrzeuge zusammengestellt.`,
    ...wishBlock,
    'Die Fahrzeuge können Sie über den folgenden Link direkt vergleichen:',
    shareUrl,
    '',
    'Bei Fragen bin ich jederzeit gerne für Sie da.',
    '',
    'Viele Grüße',
    sellerName,
    dealerName,
  ].join('\n');
}

export function buildEmailSubject(dealerName = 'Autohaus') {
  return `Ihre Fahrzeugvorschläge von ${dealerName}`;
}

/**
 * Passt Text anhand einer Verkäufer-Anweisung an (ohne externes LLM).
 */
export function refineConversationText(currentText, instruction = '', context = {}) {
  const lower = instruction.toLowerCase().trim();
  if (!lower) return currentText;

  const {
    customerName = 'Kunde',
    sellerName = 'Verkaufsberater',
    matches = [],
    shareUrl = '',
    vehicleTitle,
    newRate,
    featureNote,
  } = context;

  if (/locker|whatsapp|freundlich|du/i.test(lower)) {
    return buildDefaultWhatsAppMessage({ ...context, customerName, sellerName, matches, shareUrl });
  }

  if (/professionell|formell|e-mail|email/i.test(lower)) {
    return buildDefaultEmailMessage({ ...context, customerName, sellerName, matches, shareUrl });
  }

  if (/kürzer|kurz|knapp/i.test(lower)) {
    const top = matches.slice(0, 3).map((m, i) => {
      const t = m.model ?? m.title;
      const p = m.cleverQuote?.percent ?? '—';
      return `${i + 1}. ${t} (${p} %)`;
    });
    return [
      `Hallo ${customerName},`,
      '',
      'Ihre Fahrzeugvorschläge:',
      ...top,
      shareUrl,
      '',
      sellerName,
    ].join('\n');
  }

  if (/wärmepumpe|329|rate|ergänzt|aktualisiert/i.test(lower) && vehicleTitle) {
    const rateLine = newRate ? `Die Rate liegt dadurch jetzt bei ${newRate} € monatlich.` : '';
    return [
      `Hallo ${customerName},`,
      '',
      `wie besprochen habe ich den ${vehicleTitle} noch mit Wärmepumpe ergänzt. ${rateLine}`.trim(),
      '',
      'Hier finden Sie das aktualisierte Angebot:',
      shareUrl,
      '',
      'Viele Grüße',
      sellerName,
    ].join('\n');
  }

  if (/anhängelast|kuga/i.test(lower)) {
    return `${currentText}\n\nDer Ford Kuga Hybrid bietet dabei eine besonders hohe Anhängelast für Ihre Anforderungen.`.trim();
  }

  if (/ev3|günstiger|unterhalt/i.test(lower)) {
    return `${currentText}\n\nDer Kia EV3 ist zudem besonders günstig im Unterhalt.`.trim();
  }

  if (featureNote) {
    return `${currentText}\n\n${featureNote}`.trim();
  }

  if (/schreib|text/i.test(lower) && matches.length) {
    return buildDefaultWhatsAppMessage({ ...context, customerName, sellerName, matches, shareUrl });
  }

  return currentText;
}

export function parseCommunicationVoiceInstruction(transcript = '') {
  return transcript.trim();
}
