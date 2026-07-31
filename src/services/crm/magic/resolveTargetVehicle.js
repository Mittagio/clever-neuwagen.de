/**
 * B) Ziel-Fahrzeug aus Working Context / Offer / Seller Facts / Lead.
 */

function normalizeTrim(value = '') {
  return String(value).toLowerCase().replace(/\s+/g, '-').replace(/gt.?line/, 'gt-line');
}

function normalizeModelKey(value = '') {
  return String(value)
    .toLowerCase()
    .replace(/^kia\s+/, '')
    .replace(/\s+/g, '-')
    .replace(/picanto.*/, 'picanto')
    .replace(/sportage.*hybrid/, 'sportage-hybrid')
    .replace(/sportage.*/, 'sportage')
    .replace(/x[-\s]?ceed.*/, 'xceed')
    .replace(/ceed.*/, 'ceed')
    .replace(/tivoli.*/, 'tivoli')
    .replace(/ev\s?([2-9])/, 'ev$1');
}

function fromOfferCard(card = {}) {
  const modelKey = normalizeModelKey(
    card.modelKey || card.model || card.title || card.name || '',
  );
  const trimId = normalizeTrim(card.trimId || card.trim || card.line || '');
  const color = card.color || card.exteriorColor || null;
  const label = card.shortLabel || card.label || card.title || [modelKey, trimId].filter(Boolean).join(' ');
  return {
    modelKey: modelKey || null,
    trimId: trimId || null,
    color,
    label,
    source: 'offer_attachment',
    offerId: card.offerId || card.id || null,
  };
}

/**
 * @param {object} params
 * @param {object} [params.workingContext]
 * @param {object} [params.offerContext]
 * @param {object[]} [params.sellerFacts]
 * @param {object} [params.lead]
 * @param {object[]} [params.openVehicles]
 * @param {string} [params.rawSellerInput]
 */
export function resolveTargetVehicle(params = {}) {
  const working = params.workingContext || {};
  const offer = params.offerContext || {};
  const sellerFacts = Array.isArray(params.sellerFacts) ? params.sellerFacts : [];
  const openVehicles = Array.isArray(params.openVehicles) ? params.openVehicles : [];
  const raw = String(params.rawSellerInput || '').toLowerCase();

  // 0) Explizites Modell im Freitext schlägt falschen Anhang
  const mentioned = raw.match(/\b(xceed|tivoli|sportage|picanto|niro|sorento|stonic|ceed|ev\s?[2-9])\b/i)?.[1];
  if (mentioned) {
    const want = normalizeModelKey(mentioned);
    const hit = openVehicles.find((v) => {
      const key = normalizeModelKey(v.modelKey || v.model || v.label || '');
      return key && (key === want || key.includes(want) || want.includes(key));
    });
    if (hit) {
      return {
        ok: true,
        vehicle: {
          modelKey: normalizeModelKey(hit.modelKey || hit.model || want),
          trimId: normalizeTrim(hit.trimId || hit.trim || ''),
          color: hit.color || null,
          label: hit.label || hit.shortLabel || want,
          source: 'seller_input_model',
          offerId: hit.offerId || hit.id || null,
          monthlyRate: hit.monthlyRate ?? null,
          termMonths: hit.termMonths ?? null,
          mileagePerYear: hit.mileagePerYear ?? null,
          paymentType: hit.paymentType ?? null,
          summary: hit.summary || hit.shortLabel || null,
          shortLabel: hit.shortLabel || null,
        },
        ambiguity: null,
      };
    }
    return {
      ok: true,
      vehicle: {
        modelKey: want,
        trimId: null,
        color: null,
        label: want,
        source: 'seller_input_model',
        offerId: null,
      },
      ambiguity: null,
    };
  }

  // 1) Angehängtes Angebot / Working Context
  if (working.card || working.offerId || working.modelKey || working.shortLabel) {
    const fromCard = fromOfferCard({
      ...working.card,
      ...working,
      offerId: working.offerId,
    });
    if (fromCard.modelKey || fromCard.label) {
      return { ok: true, vehicle: fromCard, ambiguity: null };
    }
  }

  if (offer.offerId || offer.title) {
    const fromOffer = fromOfferCard(offer);
    if (fromOffer.modelKey || fromOffer.label) {
      return { ok: true, vehicle: { ...fromOffer, source: 'offer_context' }, ambiguity: null };
    }
  }

  const modelFact = sellerFacts.find((f) => f.type === 'model');
  const trimFact = sellerFacts.find((f) => f.type === 'trim');
  const colorFact = sellerFacts.find((f) => f.type === 'color');

  // 2) Seller Facts + Lead wish
  const leadModel = normalizeModelKey(
    params.lead?.wish?.model
    || params.lead?.vehicle?.model
    || params.lead?.crm?.needProfile?.selectedModelKey
    || params.lead?.crm?.needProfile?.modelHint
    || '',
  );
  const leadTrim = normalizeTrim(
    params.lead?.wish?.trim || params.lead?.vehicle?.trim || '',
  );

  const modelKey = normalizeModelKey(modelFact?.value || leadModel || '');
  const trimId = normalizeTrim(trimFact?.value || leadTrim || '');

  if (modelKey) {
    return {
      ok: true,
      vehicle: {
        modelKey,
        trimId: trimId || null,
        color: colorFact?.value || null,
        label: ['Kia', modelKey, trimId].filter(Boolean).join(' '),
        source: modelFact ? 'seller_facts' : 'lead_wish',
        offerId: null,
      },
      ambiguity: null,
    };
  }

  // 3) Mehrere offene Fahrzeuge ohne Attachment
  if (openVehicles.length > 1) {
    const labels = openVehicles
      .map((v) => v.label || [v.modelKey, v.trimId].filter(Boolean).join(' '))
      .filter(Boolean);
    return {
      ok: false,
      vehicle: null,
      ambiguity: {
        type: 'multiple_vehicles',
        question: labels.length >= 2
          ? `Meinen Sie den ${labels[0]} oder den ${labels[1]}?`
          : 'Welches Fahrzeug meinen Sie?',
        candidates: openVehicles,
      },
    };
  }

  if (openVehicles.length === 1) {
    const only = openVehicles[0];
    return {
      ok: true,
      vehicle: {
        modelKey: normalizeModelKey(only.modelKey || only.model || ''),
        trimId: normalizeTrim(only.trimId || only.trim || ''),
        color: only.color || null,
        label: only.label || null,
        source: 'open_vehicle',
        offerId: only.offerId || only.id || null,
        monthlyRate: only.monthlyRate ?? null,
        termMonths: only.termMonths ?? null,
        mileagePerYear: only.mileagePerYear ?? null,
        paymentType: only.paymentType ?? null,
        summary: only.summary || only.shortLabel || null,
        shortLabel: only.shortLabel || null,
      },
      ambiguity: null,
    };
  }

  return {
    ok: false,
    vehicle: null,
    ambiguity: {
      type: 'vehicle_unknown',
      question: 'Welches Fahrzeug meinen Sie?',
      candidates: [],
    },
  };
}
