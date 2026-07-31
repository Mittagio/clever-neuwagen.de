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
    akteContext = null,
    chipIntent = null,
  } = params;

  const safeNeeds = (Array.isArray(relevantCustomerNeeds) ? relevantCustomerNeeds : [])
    .map((n) => String(n ?? '').trim())
    .filter(Boolean)
    .slice(0, 8);

  const akte = akteContext && typeof akteContext === 'object'
    ? {
      chipIntent: akteContext.chipIntent || chipIntent || null,
      cleverSummary: akteContext.cleverSummary
        ? String(akteContext.cleverSummary).slice(0, 600)
        : null,
      customerNotes: (akteContext.customerNotes || [])
        .map((n) => String(n ?? '').trim())
        .filter(Boolean)
        .slice(0, 4),
      inclination: akteContext.inclination
        ? {
          modelKey: akteContext.inclination.modelKey || null,
          modelLabel: akteContext.inclination.modelLabel || null,
          source: akteContext.inclination.source || null,
        }
        : null,
      vehicleTracks: (akteContext.vehicleTracks || []).slice(0, 8).map((t) => ({
        modelKey: t.modelKey || null,
        modelLabel: t.modelLabel || null,
        status: t.status || null,
        statusLabel: t.statusLabel || null,
      })),
      selectedWorkingChip: akteContext.selectedWorkingChip
        ? {
          shortLabel: akteContext.selectedWorkingChip.shortLabel || null,
          label: akteContext.selectedWorkingChip.label || null,
          modelKey: akteContext.selectedWorkingChip.modelKey || null,
        }
        : null,
    }
    : {
      chipIntent: chipIntent || null,
      cleverSummary: null,
      customerNotes: [],
      inclination: null,
      vehicleTracks: [],
      selectedWorkingChip: null,
    };

  // AHK / sensible Needs nicht ungefragt mitschicken – Caller filtert bereits
  return {
    recipient: String(recipient || 'Kunde').slice(0, 120),
    rawSellerInstruction: String(rawSellerInstruction || '').slice(0, 2000),
    relevantCustomerNeeds: safeNeeds,
    chipIntent: akte.chipIntent,
    akteContext: akte,
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
      'Kein Boilerplate wie „kurze Rückfrage“ ohne echte Frage.',
      'Konditionen nur einmal nennen (nicht doppelt aus Summary und Einzelwerten).',
      'Modellname korrekt: Chip/Working-Context vor generischem Kia-Kontext; Akte-Neigung (z. B. XCeed) erwähnen wenn sinnvoll.',
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
