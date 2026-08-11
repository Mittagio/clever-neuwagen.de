/**
 * Dashboard „Clever empfiehlt heute“ → Clever-Fortsetzung statt nackter Akte-Navigation.
 *
 * Fallback: Akte nur wenn kein klarer Composer-/Prepare-Pfad existiert.
 */

function isTelHref(href) {
  return Boolean(href && /^tel:/i.test(String(href)));
}

function blobOf(item = {}) {
  return [
    item.actionId,
    item.ctaLabel,
    item.headline,
  ].map((v) => String(v || '')).join(' ').toLowerCase();
}

/**
 * @param {object} [item]
 * @returns {{
 *   kind: 'tel'|'run_turn'|'fallback_akte',
 *   href?: string,
 *   leadId?: string|null,
 *   sellerInput?: string,
 *   fallbackReason?: string,
 * }}
 */
export function resolveEmpfiehltCleverAction(item = {}) {
  if (isTelHref(item.ctaHref)) {
    return { kind: 'tel', href: item.ctaHref, leadId: item.leadId || null };
  }

  const leadId = item.leadId || null;
  if (!leadId) {
    return {
      kind: 'fallback_akte',
      leadId: null,
      fallbackReason: 'missing_lead',
    };
  }

  const name = String(item.customerName || '').trim() || 'dem Kunden';
  const blob = blobOf(item);
  const actionId = String(item.actionId || '').toLowerCase();

  if (
    actionId === 'selection_send'
    || /auswahl\s*senden|ev\d[\w-]*[- ]?auswahl|ev\d.*senden/.test(blob)
  ) {
    return {
      kind: 'run_turn',
      leadId,
      sellerInput: `Bereite für ${name} die Auswahl zum Senden vor.`,
    };
  }

  if (
    actionId === 'offer_send'
    || actionId === 'offer_created_send'
    || actionId === 'portal_link_send'
    || /angebot.*senden|kundenlink\s*senden|prüfen und senden/.test(blob)
  ) {
    return {
      kind: 'run_turn',
      leadId,
      sellerInput: `Bereite für ${name} Angebot und Nachricht zum Senden vor.`,
    };
  }

  if (
    actionId === 'documents_missing'
    || actionId === 'documents_inbox_check'
    || /unterlagen/.test(blob)
  ) {
    return {
      kind: 'run_turn',
      leadId,
      sellerInput: `Bereite für ${name} eine Nachricht wegen fehlender Unterlagen vor.`,
    };
  }

  if (
    actionId === 'prepare_succession_offer'
    || /nachfolgeangebot/.test(blob)
  ) {
    return {
      kind: 'run_turn',
      leadId,
      sellerInput: 'Bereite ein Nachfolgeangebot vor.',
    };
  }

  if (
    actionId === 'offer_followup'
    || actionId === 'offer_interest_followup'
    || /nachfassen|heute nachfassen/.test(blob)
  ) {
    return {
      kind: 'run_turn',
      leadId,
      sellerInput: `Was ist der nächste Schritt für ${name}? Bereite die Nachfassung vor.`,
    };
  }

  return {
    kind: 'fallback_akte',
    leadId,
    fallbackReason: 'no_action_path',
  };
}

/** Home-Chip „Angebot vorbereiten“ → Composer-Task (kein Queue-Jump). */
export function buildHomePrepareOfferComposerTask() {
  return {
    id: 'prepare_offer_task',
    intentChipId: 'angebot',
    composerTitle: 'ANGEBOT VORBEREITEN',
    placeholder: 'Für welchen Kunden oder welches Fahrzeug?',
    draft: '',
  };
}
