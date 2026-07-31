/**
 * Magic-Composer: grounded Kunden-Nachricht.
 * Prefer generateGroundedCleverMessage (OpenAI + verified knowledge).
 * Sync composeSellerOutboundMessage bleibt Fallback (Ton / offline).
 */

import {
  buildCleverAntwortenContext,
  refineCleverAntwortText,
} from '../cleverAntworten.js';
import { generateCleverDiktatText } from '../cleverDiktat.js';
import { buildVehicleOpportunityCards } from '../customerAkte.js';
import { generateGroundedCleverMessage } from './magic/generateGroundedCleverMessage.js';

export const OUTBOUND_TONES = Object.freeze([
  { id: 'freundlich', label: 'Freundlich' },
  { id: 'persoenlich', label: 'Persönlich' },
  { id: 'hoeflich', label: 'Höflich' },
]);

const DIKTAT_TONE_MAP = {
  freundlich: 'freundlich',
  persoenlich: 'freundlich',
  hoeflich: 'professionell',
};

function buildContext(lead = null, customerName = '') {
  let vehicleCards = [];
  try {
    vehicleCards = buildVehicleOpportunityCards({
      lead,
      wishFields: lead?.wish ?? {},
    }) ?? [];
  } catch {
    vehicleCards = [];
  }

  return buildCleverAntwortenContext({
    lead,
    customerName: customerName
      || lead?.contact?.name
      || lead?.name
      || '',
    phone: lead?.contact?.phone || '',
    email: lead?.contact?.email || '',
    vehicleCards,
    sellerName: lead?.crm?.sellerName || lead?.ownerName || 'Ihr Verkaufsteam',
    dealerName: lead?.crm?.dealerName || '',
    wishPaymentType: lead?.paymentType || lead?.wish?.paymentType || 'unknown',
  });
}

function polishPersoenlich(text = '', context = {}) {
  let out = String(text ?? '');
  const name = String(context.customerName ?? '').trim();
  const last = name.split(/\s+/).filter(Boolean).slice(-1)[0];
  if (last && /^Guten Tag,/m.test(out)) {
    out = out.replace(/^Guten Tag,/m, `Hallo ${last},`);
  }
  return out
    .replace(/ich wollte kurz nachfragen/gi, 'ich wollte mich kurz persönlich melden')
    .replace(/melde ich mich zeitnah/gi, 'melde ich mich gleich persönlich bei Ihnen')
    .replace(/Bitte geben Sie mir kurz Bescheid/gi, 'Schreiben Sie mir gerne kurz, wie es für Sie aussieht');
}

function polishHoeflich(text = '') {
  return refineCleverAntwortText(
    String(text ?? '')
      .replace(/^Hallo /m, 'Guten Tag, ')
      .replace(/^Hallo,/m, 'Guten Tag,')
      .replace(/!+/g, '.'),
    'verbindlicher',
    {},
    'frei',
  );
}

function applyTonePolish(text, toneId, context) {
  if (toneId === 'persoenlich') return polishPersoenlich(text, context);
  if (toneId === 'hoeflich') return polishHoeflich(text);
  return refineCleverAntwortText(text, 'freundlicher', context, 'frei');
}

/**
 * Grounded Magic (async) – OpenAI + verified Clever knowledge.
 */
export async function composeSellerOutboundMessageAsync({
  draftText = '',
  rawSellerInput = '',
  lead = null,
  customerName = '',
  tone = 'freundlich',
  workingContext = null,
  offerContext = null,
  openVehicles = [],
  allowWithoutPackageDetails = false,
  recipient = '',
  akteContext = null,
  chipIntent = null,
} = {}, deps = {}) {
  const seed = String(rawSellerInput || draftText || '').trim();
  const toneId = OUTBOUND_TONES.some((t) => t.id === tone) ? tone : 'freundlich';

  const grounded = await generateGroundedCleverMessage({
    rawSellerInput: seed,
    lead,
    customerContext: { name: customerName || recipient },
    workingContext,
    offerContext,
    openVehicles,
    tone: toneId,
    recipient: recipient || customerName,
    allowWithoutPackageDetails,
    akteContext,
    chipIntent,
  }, deps);

  if (!grounded?.ok || !grounded.body) {
    return composeSellerOutboundMessage({
      draftText: seed,
      lead,
      customerName,
      tone: toneId,
    });
  }

  const context = buildContext(lead, customerName);
  let text = grounded.body;
  // Ton nur linguistisch nachziehen, Fakten nicht ändern
  if (toneId !== 'freundlich') {
    text = applyTonePolish(text, toneId, context);
  }

  return {
    ok: true,
    text: String(text).trim(),
    changed: String(text).trim() !== seed,
    tone: toneId,
    seed: grounded.seed || seed,
    grounded,
    missingKnowledge: grounded.missingKnowledge || [],
    uiHint: grounded.uiHint || null,
    writer: grounded.writer || null,
  };
}

/**
 * Sync Fallback / Ton-Wechsel ohne Server (Legacy Diktat).
 */
export function composeSellerOutboundMessage({
  draftText = '',
  lead = null,
  customerName = '',
  tone = 'freundlich',
} = {}) {
  const seed = String(draftText ?? '').trim();
  const toneId = OUTBOUND_TONES.some((t) => t.id === tone) ? tone : 'freundlich';
  const context = buildContext(lead, customerName);

  let text = generateCleverDiktatText(seed, context, {
    tone: DIKTAT_TONE_MAP[toneId] || 'freundlich',
    channel: 'whatsapp',
  });

  text = applyTonePolish(text, toneId, context);
  text = String(text ?? '').trim();
  if (!text) {
    return { ok: false, text: '', changed: false, tone: toneId, seed };
  }

  return {
    ok: true,
    text,
    changed: text !== seed,
    tone: toneId,
    seed,
    writer: 'diktat_fallback',
  };
}

export function applyOutboundMessageTone(seedText = '', tone = 'freundlich', options = {}) {
  if (options.useGrounded && options.async) {
    return composeSellerOutboundMessageAsync({
      draftText: seedText,
      tone,
      lead: options.lead,
      customerName: options.customerName,
      workingContext: options.workingContext,
      offerContext: options.offerContext,
      openVehicles: options.openVehicles,
      allowWithoutPackageDetails: options.allowWithoutPackageDetails,
      recipient: options.recipient,
    });
  }
  return composeSellerOutboundMessage({
    draftText: seedText,
    tone,
    lead: options.lead,
    customerName: options.customerName,
  });
}

/** @deprecated Alias */
export function improveSellerOutboundMessage(text = '', options = {}) {
  return composeSellerOutboundMessage({
    draftText: text,
    lead: options.lead,
    customerName: options.customerName,
    tone: options.tone || 'freundlich',
  });
}
