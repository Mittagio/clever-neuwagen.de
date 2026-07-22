/**
 * Clever Customer Intake – CTA-Copy und Exit-Helfer (keine neue Wahrheit).
 */

/**
 * @param {{ notepadLabels?: string[], needProfile?: object, cleverVehicleDirections?: object[], offerModelKeys?: string[] }} session
 * @returns {string}
 */
export function buildOfferExitLabel(session = {}) {
  const labels = session.notepadLabels ?? [];
  const profile = session.needProfile ?? {};
  const directions = session.cleverVehicleDirections ?? [];
  const offerKeys = session.offerModelKeys ?? [];

  const interesting = [
    ...offerKeys,
    ...directions
      .filter((d) => d.status === 'candidate' || d.status === 'interesting')
      .map((d) => d.modelKey),
  ].filter(Boolean);

  const uniqueModels = [...new Set(interesting.map((k) => String(k).toLowerCase()))];
  if (uniqueModels.length >= 2) {
    return `Angebote für ${uniqueModels.length} Fahrzeuge anfordern`;
  }
  if (uniqueModels.length === 1) {
    const key = uniqueModels[0];
    const name = /^ev\d$/.test(key) ? key.toUpperCase() : (profile.modelHint || key);
    const pretty = String(name).toUpperCase().startsWith('EV')
      ? String(name).toUpperCase()
      : String(name);
    return `${pretty}-Angebot anfordern`;
  }

  const modelLabel = labels.find((label) => /^EV\d$/i.test(String(label)))
    || (profile.selectedModelKey ? String(profile.selectedModelKey).toUpperCase() : null)
    || (profile.modelHint && /^ev/i.test(String(profile.modelHint))
      ? String(profile.modelHint).toUpperCase()
      : null);

  if (modelLabel) {
    return `${modelLabel}-Angebot anfordern`;
  }

  if (labels.length > 0) {
    return 'Angebot mit meinen Wünschen anfordern';
  }

  return 'Angebot anfordern';
}

export function buildContactExitLabel() {
  return 'Verkäufer kontaktieren';
}

/**
 * Copy für unvollständigen Angebots-Handoff.
 */
export function buildIncompleteOfferHandoffCopy() {
  return {
    title: 'Angebot vorbereiten',
    body: 'Gerne. Ihre bisherigen Wünsche nehmen wir direkt mit. Sie können die Leasingdaten noch ergänzen oder der Verkäufer klärt den Rest mit Ihnen.',
    primaryLabel: 'Jetzt anfragen',
    secondaryLabel: 'Leasingdaten ergänzen',
  };
}
