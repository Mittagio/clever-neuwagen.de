/**
 * Clever Customer Intake – Wunschübergabe-CTA und Exit-Helfer (keine neue Wahrheit).
 */

function prettyModelKey(key = '') {
  const raw = String(key ?? '').trim();
  if (!raw) return null;
  if (/^ev\d/i.test(raw)) return raw.toUpperCase().replace(/[^A-Z0-9-]/g, '');
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

/**
 * Bestätigtes Kundenmodell aus Notizzettel / needProfile – nicht aus AI-Directions.
 * @param {{ notepadLabels?: string[], needProfile?: object }} session
 * @returns {string|null}
 */
export function resolveConfirmedWishModelLabel(session = {}) {
  const profile = session.needProfile ?? {};
  const labels = session.notepadLabels ?? [];

  if (profile.selectedModelKey) {
    return prettyModelKey(profile.selectedModelKey);
  }

  const interesting = labels.find((label) => /interessant/i.test(String(label)));
  if (interesting) {
    const match = String(interesting).match(/\b(EV\d[\w-]*)\b/i)
      || String(interesting).match(/\b(Sportage|Sorento|Stonic|Carnival|Ceed|Niro|Picanto)\b/i);
    if (match) return prettyModelKey(match[1]);
  }

  const modelChip = labels.find((label) => /^EV\d/i.test(String(label))
    || /^(Sportage|Sorento|Stonic|Carnival)$/i.test(String(label)));
  if (modelChip && profile.modelHint) {
    return prettyModelKey(String(modelChip).replace(/\s+interessant$/i, ''));
  }

  return null;
}

/**
 * Expliziter Angebotswunsch des Kunden (nicht Clever-Ableitung).
 * @param {{ notepadLabels?: string[], needProfile?: object, offerRequested?: boolean }} session
 */
export function hasExplicitOfferIntent(session = {}) {
  if (session.offerRequested === true) return true;
  const messages = session.needProfile?.rawMessages ?? [];
  const blob = [...messages, ...(session.notepadLabels ?? [])].join(' ').toLowerCase();
  return /\b(angebot|angebots|kostenvoranschlag)\b/.test(blob)
    || /schicken sie mir ein angebot|möchte ein angebot|will ein angebot|was würde .+ kosten|was kostet/.test(blob);
}

/**
 * @param {object} needProfile
 */
export function hasSubstantialLeasingData(needProfile = {}) {
  const budget = needProfile.budget ?? {};
  const leasingHint = budget.paymentType === 'leasing';
  const hasKm = Boolean(needProfile.annualKm);
  const hasTerm = Boolean(needProfile.leaseDurationMonths);
  const hasRate = Boolean(budget.maxMonthlyRate);
  const params = [hasKm, hasTerm, hasRate].filter(Boolean).length;
  return leasingHint && params >= 2;
}

/**
 * Primärer öffentlicher CTA – Wunschübergabe.
 * @param {{ notepadLabels?: string[], needProfile?: object, offerRequested?: boolean }} session
 * @returns {string}
 */
export function buildWishHandoffExitLabel(session = {}) {
  if (hasExplicitOfferIntent(session)) {
    return 'Für Angebot übergeben';
  }

  if (hasSubstantialLeasingData(session.needProfile ?? {})) {
    return 'Wünsche & Leasingdaten übergeben';
  }

  const model = resolveConfirmedWishModelLabel(session);
  if (model) {
    return `Meine ${model}-Wünsche übergeben`;
  }

  return 'Meine Wünsche übergeben';
}

/**
 * @deprecated Prefer buildWishHandoffExitLabel – bleibt als Alias für ältere Imports.
 */
export function buildOfferExitLabel(session = {}) {
  return buildWishHandoffExitLabel(session);
}

/**
 * @deprecated Öffentlicher Standard ist Wunschübergabe – kein „Verkäufer kontaktieren“.
 */
export function buildContactExitLabel(session = {}) {
  return buildWishHandoffExitLabel(session);
}

/**
 * Optionaler Zweit-CTA nur bei erkennbarem Angebotswunsch.
 * @returns {string|null}
 */
export function buildWishHandoffSecondaryLabel(session = {}) {
  if (!hasExplicitOfferIntent(session)) return null;
  const profile = session.needProfile ?? {};
  if (profile.budget?.paymentType === 'leasing' && !hasSubstantialLeasingData(profile)) {
    return 'Leasingdaten ergänzen';
  }
  return null;
}

/**
 * Copy für unvollständigen Angebots-Handoff / Inline.
 */
export function buildIncompleteOfferHandoffCopy() {
  return {
    title: 'Wünsche für Angebot',
    body: 'Gerne. Ihre bisherigen Wünsche habe ich bereits aufgenommen. Sie können noch ein paar Angebotsdaten ergänzen oder wir geben den aktuellen Stand direkt weiter.',
    primaryLabel: 'Für Angebot übergeben',
    secondaryLabel: 'Leasingdaten ergänzen',
  };
}
