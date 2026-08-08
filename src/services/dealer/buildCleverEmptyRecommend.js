/**
 * Clever-Mitte: immer der aktuell sinnvollste nächste Schritt.
 * Kein generischer Idle („wartet auf …“) mit doppelten Ghost-CTAs.
 */

function hasPreparedOffer(lead = {}, workingContextItems = []) {
  if ((workingContextItems || []).some((item) => (
    item?.kind === 'offer' || item?.card?.monthlyRate != null || item?.card?.termMonths != null
  ))) {
    return true;
  }
  const configs = lead?.crm?.vehicleConfigurations ?? [];
  return configs.some((c) => (
    c?.monthlyRate != null
    || c?.vehicleOffer?.monthlyRate != null
    || /magic_offer|offer_pdf/i.test(String(c?.source?.createdFrom ?? c?.source ?? ''))
  ));
}

function offerLabel(lead = {}, workingContextItems = []) {
  const offerItem = (workingContextItems || []).find((item) => item?.kind === 'offer' || item?.card);
  if (offerItem) {
    const raw = String(offerItem.shortLabel || offerItem.label || '')
      .replace(/\s*·.*$/, '')
      .replace(/\s*Angebot$/i, '')
      .trim();
    if (raw) return /angebot/i.test(raw) ? raw : `${raw}-Angebot`;
  }
  const config = (lead?.crm?.vehicleConfigurations ?? []).find((c) => (
    c?.monthlyRate != null || c?.vehicleOffer || c?.model
  ));
  const model = String(config?.modelName || config?.model || config?.modelKey || '')
    .replace(/^Kia\s+/i, '')
    .trim();
  if (model) return `${model}-Angebot`;
  return 'Angebot';
}

function collectHintLabels(lead = {}, options = {}) {
  const fromOptions = (options.hintLabels || [])
    .map((l) => String(l || '').trim())
    .filter(Boolean);
  if (fromOptions.length) return fromOptions;

  const labels = [];
  for (const insight of lead?.crm?.sellerInsights ?? []) {
    const text = String(insight?.text || '').trim();
    if (text) labels.push(text);
    for (const lab of insight?.understoodLabels ?? []) {
      const t = String(lab || '').trim();
      if (t) labels.push(t);
    }
  }
  for (const note of lead?.crm?.kundenhelfer?.notes ?? []) {
    const t = String(typeof note === 'string' ? note : note?.text || '').trim();
    if (t) labels.push(t);
  }
  const delivery = lead?.wish?.desiredDeliveryDate || lead?.crm?.needProfile?.desiredDeliveryDate;
  if (delivery) labels.push(`Lieferzeit ${delivery}`);
  return labels;
}

function pickSalesHints(labels = [], max = 3) {
  const ranked = [];
  const rest = [];
  for (const label of labels) {
    if (/sofort|unfall|ersatz|dringend|eilig|asap/i.test(label)) ranked.push(label);
    else rest.push(label);
  }
  return [...ranked, ...rest]
    .filter((l, i, arr) => arr.findIndex((x) => x.toLowerCase() === l.toLowerCase()) === i)
    .slice(0, max);
}

function vehicleShort(lead = {}) {
  const model = String(
    lead?.wish?.model
    || lead?.crm?.needProfile?.model
    || lead?.vehicleInterest?.model
    || '',
  ).replace(/^Kia\s+/i, '').trim();
  return model || null;
}

/**
 * @param {object} lead
 * @param {{
 *   phone?: string,
 *   workingContextItems?: object[],
 *   hintLabels?: string[],
 * }} [options]
 * @returns {{
 *   mode: 'recommend',
 *   title: string,
 *   summary: string,
 *   actions: { id: string, label: string, action: string, draftSeed?: string }[],
 *   suggestions: [],
 * }}
 */
export function buildCleverEmptyRecommend(lead = {}, options = {}) {
  const phone = String(options.phone ?? lead?.contact?.phone ?? '').trim();
  const working = options.workingContextItems ?? [];
  const name = String(lead?.name || 'den Kunden').trim() || 'den Kunden';
  const him = name === 'den Kunden' ? 'ihm' : name;
  const hints = pickSalesHints(collectHintLabels(lead, options));
  const hintLine = hints.length ? hints.join(' · ') : '';
  const vehicle = vehicleShort(lead);

  if (!phone) {
    return {
      mode: 'recommend',
      title: 'Clever empfiehlt',
      summary: hintLine
        ? `${hintLine} – Telefon fehlt noch.`
        : 'Telefonnummer fehlt – ohne Kontakt kein Nachfassen.',
      actions: [{
        id: 'contact',
        label: 'Kontaktdaten ergänzen',
        action: 'open_contact',
      }],
      suggestions: [],
    };
  }

  if (hasPreparedOffer(lead, working)) {
    return {
      mode: 'recommend',
      title: 'Clever empfiehlt',
      summary: hintLine
        ? `${offerLabel(lead, working)} liegt bereit · ${hintLine}`
        : `${offerLabel(lead, working)} ist vorbereitet – prüfen und senden.`,
      actions: [{
        id: 'offer',
        label: 'Angebot prüfen',
        action: 'check_offer',
      }],
      suggestions: [],
    };
  }

  if (hints.length) {
    const focus = vehicle ? `${vehicle}: ${hintLine}` : hintLine;
    return {
      mode: 'recommend',
      title: 'Clever empfiehlt',
      summary: `${focus} – als Nächstes ein Angebot vorbereiten.`,
      actions: [{
        id: 'prepare_offer',
        label: 'Angebot vorbereiten',
        action: 'prepare_offer',
        draftSeed: `Bereite ein Angebot für ${name} vor${hintLine ? ` (${hintLine})` : ''}.`,
      }],
      suggestions: [],
    };
  }

  if (vehicle) {
    return {
      mode: 'recommend',
      title: 'Clever empfiehlt',
      summary: `${vehicle} ist klar – Konditionen stehen. Angebot vorbereiten.`,
      actions: [{
        id: 'prepare_offer',
        label: 'Angebot vorbereiten',
        action: 'prepare_offer',
        draftSeed: `Bereite ein Angebot für ${name} (${vehicle}) vor.`,
      }],
      suggestions: [],
    };
  }

  return {
    mode: 'recommend',
    title: 'Clever empfiehlt',
    summary: 'Kurz nachfassen oder erstes Angebot skizzieren.',
    actions: [{
      id: 'follow_up',
      label: 'Nachfassen',
      action: 'seed_draft',
      draftSeed: `Schreib ${him} eine kurze Nachfassnachricht.`,
    }],
    suggestions: [],
  };
}
