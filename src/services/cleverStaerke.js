/** Clever-Stärke – motivierender Fortschrittswert für Verkaufschancen & Angebote */

function hasCustomerName(name) {
  const trimmed = name?.trim();
  return Boolean(trimmed && trimmed !== 'Kunde (offen)');
}

export function getCleverStaerkeTier(score = 0) {
  const pct = Math.max(0, Math.min(100, Math.round(score)));
  if (pct <= 40) {
    return {
      label: 'Gute Idee',
      text: 'Der Wunsch ist erfasst.',
      shortLabel: 'Gute Idee',
    };
  }
  if (pct <= 70) {
    return {
      label: 'Gute Basis',
      text: 'Ein paar Angaben machen die Chance stärker.',
      shortLabel: 'Gute Basis',
    };
  }
  if (pct <= 90) {
    return {
      label: 'Fast startklar',
      text: 'Nur noch kleine Details und die Chance ist richtig rund.',
      shortLabel: 'Fast startklar',
    };
  }
  return {
    label: 'Abschlussbereit',
    text: 'Alles Wichtige ist vorbereitet.',
    shortLabel: 'Abschlussbereit',
  };
}

export function computeCleverStaerke({
  hasWish = false,
  reservedModelsCount = 0,
  name = '',
  phone = '',
  email = '',
  hasNextStep = true,
  offersCount = 0,
}) {
  let score = 0;
  if (hasWish) score += 25;
  if (reservedModelsCount > 0) score += 20;
  if (hasCustomerName(name)) score += 10;
  if (phone?.trim()) score += 15;
  if (email?.trim()) score += 10;
  if (hasNextStep) score += 10;
  if (offersCount > 0) score += 10;
  return Math.min(100, score);
}

export function computeCustomerCleverStaerke({ name = '', phone = '', email = '', note = '' }) {
  let score = 0;
  if (hasCustomerName(name)) score += 35;
  if (phone?.trim()) score += 35;
  if (email?.trim()) score += 20;
  if (note?.trim()) score += 10;
  return Math.min(100, score);
}

export function computeWishCleverStaerke({
  model = '',
  paymentType = 'unknown',
  desiredRate = null,
  desiredPrice = null,
  delivery = '',
}) {
  let score = 0;
  if (model?.trim()) score += 40;
  if (paymentType && paymentType !== 'unknown') score += 25;
  if (desiredRate || desiredPrice) score += 20;
  if (delivery?.trim()) score += 15;
  return Math.min(100, score);
}

export function computeOfferCleverStaerke({
  model = '',
  paymentType = 'unknown',
  priceOrRate = null,
  hasConditions = false,
  hasCustomer = false,
  hasContact = false,
  delivery = '',
  note = '',
  offersCount = 0,
} = {}) {
  if (offersCount <= 0) return 25;

  let score = 0;
  if (model?.trim()) score += 20;
  if (paymentType && paymentType !== 'unknown') score += 15;
  if (priceOrRate) score += 20;
  if (hasConditions) score += 15;
  if (hasCustomer) score += 10;
  if (hasContact) score += 10;
  if (delivery?.trim()) score += 5;
  if (note?.trim()) score += 5;
  return Math.min(100, score);
}

/** Rückwärtskompatibilität */
export const computeLeadCompletionScore = computeCleverStaerke;
export const computeCustomerCompletionScore = computeCustomerCleverStaerke;
export const computeWishCompletionScore = computeWishCleverStaerke;

export function computeOfferCompletionScore(offersCount = 0, offerData = {}) {
  return computeOfferCleverStaerke({ ...offerData, offersCount });
}

/** Kundenerfassungs-Mini-Flow nach Verkaufschance erstellen */
export function computeCaptureCleverStaerke({
  hasWish = true,
  name = '',
  email = '',
  phone = '',
  note = '',
}) {
  let score = 0;
  if (hasWish) score += 30;
  if (hasCustomerName(name)) score += 20;
  if (email?.trim()) score += 20;
  if (phone?.trim()) score += 20;
  if (note?.trim()) score += 10;
  return Math.min(100, score);
}

/** Motivationstexte für Kundenerfassungs-Mini-Flow */
export function getCaptureFlowMotivation(score = 0, fieldId = null) {
  const pct = Math.max(0, Math.min(100, Math.round(score)));
  if (pct >= 100) {
    return { label: 'Abschlussbereit', text: 'Alles da – die Chance ist startklar.' };
  }
  if (pct >= 71) {
    if (fieldId === 'note') {
      return { label: 'Fast startklar', text: 'Noch eine Notiz – dann ist die Chance richtig rund.' };
    }
    return { label: 'Fast startklar', text: 'Nur noch ein Tüpfelchen – dann hebt die Chance ab.' };
  }
  if (pct >= 51) {
    return { label: 'Gute Basis', text: 'Die Chance wird gerade persönlicher.' };
  }
  if (fieldId === 'email') {
    return { label: 'Gute Basis', text: 'Ein Kontaktweg – und das Angebot kann später direkt raus.' };
  }
  if (fieldId === 'phone') {
    return { label: 'Gute Basis', text: 'Mit Nummer kann der Rückruf direkt starten.' };
  }
  if (fieldId === 'note') {
    return { label: 'Gute Basis', text: 'Was sollte man sich merken? Jede Notiz hilft.' };
  }
  return {
    label: 'Gute Idee',
    text: 'Der Wunsch ist drin. Mit einem Namen bekommt die Chance ein Gesicht.',
  };
}
