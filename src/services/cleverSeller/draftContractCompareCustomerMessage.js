/**
 * Slice 10: Kundennachricht aus strukturiertem Vertragsvergleich.
 * Nur vorhandene Diff-Zeilen – nichts erfinden. Kein Auto-Send.
 */
import { validateCustomerMessageNotSellerCommand } from './validateSellerCommandMessage.js';

function salutationName(customerName, lead) {
  const name = String(customerName || lead?.contact?.name || lead?.name || '').trim();
  if (!name) return 'Guten Tag,';
  if (/^(herr|frau)\b/i.test(name)) return `Guten Tag ${name},`;
  const salutation = String(lead?.contact?.salutation || '').toLowerCase();
  if (salutation === 'frau') return `Guten Tag Frau ${name},`;
  return `Guten Tag Herr ${name},`;
}

/**
 * Expliziter Auftrag: Nachricht zum Vertragsvergleich schreiben.
 * @param {string} text
 * @returns {boolean}
 */
export function isContractCompareMessageCue(text = '') {
  const t = String(text || '').trim();
  if (t.length < 12) return false;
  if (!/\b(schreib(?:e|en)?|sag(?:e|en)?|informier(?:e|en)?|whatsapp|mail|e-?mail)\b/i.test(t)) {
    return false;
  }
  if (!/\bvergleich\w*\b/i.test(t)) return false;
  return /\b(vertrag|altvertrag|angebot)\b/i.test(t);
}

/**
 * Deterministische Kundennachricht aus Compare-Rows.
 * @param {{
 *   compareResult?: object,
 *   lead?: object,
 *   customerName?: string,
 * }} params
 * @returns {{ messageDraft: string|null, ok: boolean, reason?: string }}
 */
export function draftContractCompareCustomerMessage(params = {}) {
  const compare = params.compareResult || null;
  const rows = Array.isArray(compare?.rows) ? compare.rows : [];
  if (!compare || !rows.length) {
    return { ok: false, messageDraft: null, reason: 'no_compare_rows' };
  }

  const contractSide = compare.contractSide || {};
  const offerSide = compare.offerSide || {};
  const customerLabel = compare.customerName
    || params.customerName
    || params.lead?.contact?.name
    || params.lead?.name
    || null;

  const bulletLines = [];
  for (const row of rows) {
    if (!row || row.status === 'both_missing') continue;
    if (row.status === 'changed' && row.contractDisplay && row.offerDisplay) {
      if (row.field === 'monthlyRate' && row.delta != null) {
        const sign = row.delta > 0 ? '+' : '';
        bulletLines.push(
          `• ${row.label}: ${row.offerDisplay}/Monat (bisher ${row.contractDisplay}, ${sign}${Number(row.delta).toLocaleString('de-DE')} €)`,
        );
      } else {
        bulletLines.push(`• ${row.label}: ${row.offerDisplay} (bisher ${row.contractDisplay})`);
      }
    } else if (row.status === 'same' && row.offerDisplay) {
      bulletLines.push(`• ${row.label}: ${row.offerDisplay} (unverändert)`);
    } else if (row.status === 'missing_contract' && row.offerDisplay) {
      bulletLines.push(`• ${row.label}: ${row.offerDisplay}`);
    }
  }

  if (!bulletLines.length) {
    return { ok: false, messageDraft: null, reason: 'no_usable_deltas' };
  }

  const oldVehicle = contractSide.vehicleLabel || null;
  const newVehicle = offerSide.vehicleLabel || offerSide.label || null;
  const introBits = [];
  if (oldVehicle) {
    introBits.push(`zu Ihrem aktuellen Vertrag (${oldVehicle}`);
    if (contractSide.monthlyRate != null) {
      introBits[0] += `, ${Number(contractSide.monthlyRate).toLocaleString('de-DE')} €/Monat`;
    }
    introBits[0] += ')';
  } else {
    introBits.push('zu Ihrem aktuellen Vertrag');
  }
  introBits.push('habe ich Ihnen ein neues Angebot vorbereitet');
  if (newVehicle) {
    introBits.push(`für den ${newVehicle}`);
  }

  const lines = [
    salutationName(customerLabel, params.lead),
    '',
    `${introBits.join(' ')}:`,
    '',
    ...bulletLines,
    '',
    'Gerne besprechen wir die Details persönlich.',
    '',
    'Viele Grüße',
  ];

  const messageDraft = lines.join('\n').trim();
  const validated = validateCustomerMessageNotSellerCommand(messageDraft);
  if (!validated.ok) {
    return { ok: false, messageDraft: null, reason: validated.reason };
  }

  return {
    ok: true,
    messageDraft,
    autoSend: false,
    handoff: {
      type: 'customer_message_edit',
      messageDraft,
    },
  };
}
