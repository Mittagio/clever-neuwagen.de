/**
 * F) Minimaler Kontext für OpenAI Message Writer – kein Full-Lead.
 */

/**
 * @param {object} params
 */
export function buildMinimalMessageContext(params = {}) {
  const {
    recipient = 'Kunde',
    rawSellerInstruction = '',
    relevantCustomerNeeds = [],
    vehicleIdentity = null,
    sellerFacts = [],
    verifiedPackageFacts = null,
    verifiedEquipmentFacts = null,
    offerFacts = null,
    tone = 'freundlich',
  } = params;

  const safeNeeds = (Array.isArray(relevantCustomerNeeds) ? relevantCustomerNeeds : [])
    .map((n) => String(n ?? '').trim())
    .filter(Boolean)
    .slice(0, 8);

  // AHK / sensible Needs nicht ungefragt mitschicken – Caller filtert bereits
  return {
    recipient: String(recipient || 'Kunde').slice(0, 120),
    rawSellerInstruction: String(rawSellerInstruction || '').slice(0, 2000),
    relevantCustomerNeeds: safeNeeds,
    vehicleIdentity: vehicleIdentity
      ? {
        modelKey: vehicleIdentity.modelKey ?? null,
        trimId: vehicleIdentity.trimId ?? null,
        modelLabel: vehicleIdentity.modelLabel || vehicleIdentity.label || null,
        trimLabel: vehicleIdentity.trimLabel ?? null,
        color: vehicleIdentity.color ?? null,
      }
      : null,
    sellerFacts: (sellerFacts || []).map((f) => ({
      type: f.type,
      value: String(f.value ?? ''),
      source: 'seller_input',
    })),
    verifiedPackageFacts: verifiedPackageFacts
      ? {
        id: verifiedPackageFacts.id,
        label: verifiedPackageFacts.label,
        items: (verifiedPackageFacts.items || []).slice(0, 12),
        evidenceId: verifiedPackageFacts.evidenceId,
      }
      : null,
    verifiedEquipmentFacts: verifiedEquipmentFacts
      ? {
        items: (verifiedEquipmentFacts.items || []).slice(0, 12),
        evidenceId: verifiedEquipmentFacts.evidenceId,
      }
      : null,
    offerFacts: offerFacts
      ? {
        offerId: offerFacts.offerId,
        title: offerFacts.title,
        monthlyRate: offerFacts.monthlyRate,
        termMonths: offerFacts.termMonths,
        mileagePerYear: offerFacts.mileagePerYear,
        paymentType: offerFacts.paymentType,
        summary: offerFacts.summary ? String(offerFacts.summary).slice(0, 240) : null,
      }
      : null,
    tone: tone || 'freundlich',
    rules: [
      'Schreibe nur mit den gelieferten Fakten.',
      'Erfinde keine Paketinhalte, Ausstattungen, Preise, Lieferzeiten oder Verfügbarkeit.',
      'Seller Facts und verified Facts getrennt behandeln.',
      'Verfügbarkeit nur nennen, wenn als seller_input vorhanden.',
      'Keine IBAN, Ausweis-, Gehalts- oder Selbstauskunftsdaten verwenden.',
    ],
  };
}

/**
 * Customer needs für Message – irrelevante Wünsche (z. B. AHK bei Unterlagen) weglassen.
 */
export function selectRelevantCustomerNeeds({ lead = null, docsOnly = false, mentionedAhk = false } = {}) {
  if (docsOnly && !mentionedAhk) return [];
  const needs = [];
  const profile = lead?.crm?.needProfile ?? {};
  if (profile.fuel) needs.push(`Antrieb: ${profile.fuel}`);
  if (profile.bodyType) needs.push(`Karosserie: ${profile.bodyType}`);
  if (profile.towCapacityKg && mentionedAhk) {
    needs.push(`AHK / Zuglast: ${profile.towCapacityKg} kg`);
  }
  if (profile.budget) needs.push(`Budget: ${profile.budget}`);
  return needs;
}
