/**
 * Kompakte Empty-State-Empfehlungen für den Clever-Akte-Pane.
 * Max. 2 Aktionen / Vorschläge – kein Dashboard.
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

/**
 * @param {object} lead
 * @param {{
 *   phone?: string,
 *   workingContextItems?: object[],
 * }} [options]
 * @returns {{
 *   mode: 'recommend'|'idle',
 *   title: string,
 *   summary: string,
 *   actions: { id: string, label: string, action: string }[],
 *   suggestions: { id: string, label: string, draftSeed: string }[],
 * }}
 */
export function buildCleverEmptyRecommend(lead = {}, options = {}) {
  const phone = String(options.phone ?? lead?.contact?.phone ?? '').trim();
  const working = options.workingContextItems ?? [];
  const name = String(lead?.name || 'den Kunden').trim() || 'den Kunden';
  const him = name === 'den Kunden' ? 'ihm' : name;

  const actions = [];
  const lines = [];

  if (!phone) {
    lines.push('Telefonnummer fehlt.');
    actions.push({
      id: 'contact',
      label: 'Kontaktdaten ergänzen',
      action: 'open_contact',
    });
  }

  if (hasPreparedOffer(lead, working)) {
    lines.push(`${offerLabel(lead, working)} ist vorbereitet.`);
    actions.push({
      id: 'offer',
      label: 'Angebot prüfen',
      action: 'check_offer',
    });
  }

  if (lines.length || actions.length) {
    return {
      mode: 'recommend',
      title: 'Clever empfiehlt',
      summary: lines.join(' · '),
      actions: actions.slice(0, 2),
      suggestions: [],
    };
  }

  return {
    mode: 'idle',
    title: '',
    summary: 'Clever wartet auf deinen nächsten Auftrag.',
    actions: [],
    suggestions: [
      {
        id: 'sug_nachfassen',
        label: 'Nachfassen',
        draftSeed: `Schreib ${him} eine kurze Nachfassnachricht.`,
      },
      {
        id: 'sug_angebot',
        label: 'Angebot vorbereiten',
        draftSeed: `Bereite ein Angebot für ${name} vor.`,
      },
    ].slice(0, 2),
  };
}
