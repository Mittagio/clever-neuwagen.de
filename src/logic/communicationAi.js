import { LEAD_STATUS } from '../data/leadTypes.js';
import { buildOfferUrl } from './offerService.js';

function pickScenario(lead, scenarioId) {
  if (scenarioId) return scenarioId;
  const map = {
    neu: 'erstkontakt',
    inBearbeitung: 'erstkontakt',
    angebotVersendet: 'angebot',
    probefahrt: 'probefahrt',
    bestellung: 'vertrag',
    ausgeliefert: 'auslieferung',
    auslieferung_bestaetigt: 'auslieferung',
  };
  return map[lead.status] ?? 'nachfassen';
}

function formatRate(lead) {
  const rate = lead.currentRate ?? lead.desiredRate;
  if (rate == null) return null;
  return `${rate} € / Monat`;
}

const BODIES = {
  erstkontakt: (ctx) =>
    `vielen Dank für Ihre Anfrage zum ${ctx.vehicle}. Ich prüfe die Verfügbarkeit und melde mich zeitnah mit einem passenden Angebot.`,
  angebot: (ctx) =>
    `anbei erhalten Sie Ihr persönliches Angebot zum ${ctx.vehicle}${ctx.rateLine}. Bei Fragen erreichen Sie mich jederzeit.`,
  nachfassen: (ctx) =>
    `ich wollte mich erkundigen, ob Sie noch Fragen zu Ihrem Angebot für den ${ctx.vehicle} haben.`,
  eingetroffen: (ctx) =>
    `gute Nachrichten: Ihr ${ctx.vehicle} ist bei uns eingetroffen. Wir stimmen gerne den nächsten Schritt mit Ihnen ab.`,
  vertrag: (ctx) =>
    `anbei erhalten Sie die Vertragsunterlagen zum ${ctx.vehicle}. Bitte prüfen Sie die Angaben und senden Sie uns die unterschriebenen Dokumente zurück.`,
  auslieferung: (ctx) =>
    `Ihr ${ctx.vehicle} steht zur Übergabe bereit. Bitte melden Sie sich für einen Termin bei uns.`,
  probefahrt: (ctx) =>
    `gerne bestätige ich Ihren Termin zur Probefahrt mit dem ${ctx.vehicle}. Bitte bringen Sie Ihren Führerschein mit.`,
};

export function buildAiReplyContext(lead, offer = null) {
  const name = lead.contact?.name?.trim() || 'Kunde';
  const vehicle = lead.vehicle?.label || 'Ihr Fahrzeug';
  const rate = formatRate(lead) ?? (offer?.pricing?.rate != null ? `${offer.pricing.rate} € / Monat` : null);
  const term = offer?.pricing?.termMonths ?? lead.termMonths ?? 48;
  const mileage = offer?.pricing?.mileagePerYear ?? lead.mileagePerYear ?? 10000;
  const delivery = offer?.deliveryTime ?? lead.deliveryTime ?? 'ca. 4–8 Wochen';

  return {
    name,
    vehicle,
    rate,
    rateLine: rate ? ` (${rate}, ${term} Monate, ${mileage.toLocaleString('de-DE')} km/Jahr)` : '',
    term,
    mileage,
    delivery,
    statusLabel: LEAD_STATUS[lead.status]?.label ?? lead.status,
    offerUrl: lead.offerCode ? buildOfferUrl(lead.offerCode) : null,
    customerGroup: lead.customerGroup ?? offer?.configuration?.config?.customerGroup ?? 'standard',
  };
}

export function generateAiReply(lead, { scenario, offer, dealerName = 'Ihr Autohaus' } = {}) {
  const scenarioId = pickScenario(lead, scenario);
  const ctx = buildAiReplyContext(lead, offer);
  const bodyFn = BODIES[scenarioId] ?? BODIES.nachfassen;
  let text = `Hallo ${ctx.name},\n\n${bodyFn(ctx)}\n\nFreundliche Grüße\n${dealerName}`;

  if (ctx.offerUrl && (scenarioId === 'angebot' || scenarioId === 'nachfassen')) {
    text += `\n\n👉 ${ctx.offerUrl}`;
  }

  return { text, scenario: scenarioId, context: ctx };
}
