/**
 * Tool: prepare_offer (und optional confirm Persist)
 * Wiederverwendet Magic Offer. Persist nur bei confirm=true.
 */
import {
  prepareMagicOffer,
  applyMagicOfferCorrection,
  resolveMagicModelKey,
} from '../../dealer/magicOfferService.js';
import { enrichOfferTextWithCustomerWish } from '../../dealer/sellerOfferAssistFlow.js';
import {
  finalizeLeadWithOfferDraft,
  offerDraftToVehicleCard,
  offerDraftToVehicleConfiguration,
} from '../../dealerAiOfferCreate.js';
import { buildCleverCustomerContext } from '../cleverContextBuilder.js';
import {
  resolveSellerEquipmentMentions,
  resolveSellerColorMention,
} from '../resolveSellerMentions.js';

function formatKm(km) {
  if (km == null) return null;
  return `${Number(km).toLocaleString('de-DE')} km`;
}

function buildSellerOfferText(lead, args = {}, context = {}) {
  const parts = [];
  const interest = context.currentInterest || {};
  const conditions = context.conditions || {};
  const selected = context.selectedOffer || {};

  const modelHint = args.modelKey
    || args.modelLabel
    || interest.vehicleLabel
    || selected.modelName
    || lead?.vehicle?.label
    || lead?.vehicle?.model
    || null;
  if (modelHint) parts.push(String(modelHint));

  if (args.trimLabel) parts.push(String(args.trimLabel));
  if (args.colorLabel || args.color) parts.push(String(args.colorLabel || args.color));
  if (Array.isArray(args.equipment) && args.equipment.length) {
    parts.push(args.equipment.map((e) => (typeof e === 'string' ? e : e.rawExpression || e.key)).join(' '));
  }

  const payment = args.paymentType
    || conditions.contractType
    || selected.paymentType
    || 'leasing';
  if (payment === 'cash' || payment === 'purchase') parts.push('Kauf');
  else if (payment === 'financing') parts.push('Finanzierung');
  else parts.push('Leasing');

  const term = args.durationMonths ?? args.termMonths
    ?? conditions.durationMonths
    ?? selected.termMonths;
  if (term) parts.push(`${term} Monate`);

  const km = args.mileagePerYear ?? args.mileage
    ?? conditions.mileage
    ?? selected.mileagePerYear;
  if (km != null) parts.push(`${formatKm(km)}/Jahr`);

  const down = args.downPayment ?? conditions.downPayment ?? selected.downPayment;
  if (down != null && String(down).trim() !== '') {
    parts.push(Number(down) === 0 ? 'keine Anzahlung' : `${Number(down).toLocaleString('de-DE')} € Anzahlung`);
  }

  // Capture-then-Offer: Wunsch-Budget / Katalog-Selected-Rate nie still als Offer-Monatsrate injecten.
  // Nur explizite Tool-Args (Seller/PDF) gelten als autoritative Rate.
  const rate = args.monthlyRate != null ? args.monthlyRate : null;
  if (rate != null) parts.push(`${Number(rate).toLocaleString('de-DE')} €/Monat`);

  if (args.discountPercent != null) parts.push(`${args.discountPercent} % Rabatt`);
  if (args.instruction) parts.push(String(args.instruction));

  parts.push('Angebot erstellen');
  return enrichOfferTextWithCustomerWish(lead, parts.filter(Boolean).join(', '));
}

function buildOfferDraftFromMagic(lead, preparation, extras = {}) {
  const g = preparation.grounded || {};
  const c = preparation.intent?.commercialInput || {};
  const paymentType = preparation.paymentType === 'unknown'
    ? (preparation.intent?.offerType === 'purchase' ? 'cash' : 'leasing')
    : (preparation.paymentType || 'leasing');

  const monthlyRate = c.monthlyRate
    ?? (paymentType === 'cash' ? preparation.calculation?.endPrice : null)
    ?? null;

  const model = g.model || g.modelLabel || lead?.vehicle?.model || 'Fahrzeug';
  const modelKey = g.modelKey
    || resolveMagicModelKey(model)
    || lead?.vehicle?.modelKey
    || null;

  const colorLabel = extras.color?.label
    || g.colorLabel
    || (extras.color?.canonicalValue === 'white' ? 'Weiß' : null);

  return {
    customerId: lead?.customerId || lead?.id || null,
    opportunityId: lead?.id || null,
    customer: {
      salutation: lead?.contact?.salutation || null,
      firstName: lead?.contact?.firstName || null,
      lastName: lead?.contact?.lastName || null,
      name: lead?.contact?.name || 'Kunde (offen)',
      phone: lead?.contact?.phone || '',
      email: lead?.contact?.email || '',
      mailNote: null,
    },
    vehicle: {
      brand: 'Kia',
      model,
      modelKey,
      trimId: g.trimId || extras.trimId || null,
      trimLabel: g.trimLabel || extras.trimLabel || null,
      battery: g.batteryLabel || null,
      engineId: g.engineId || null,
      color: colorLabel,
      colorId: extras.color?.canonicalValue || g.colorId || null,
      selectedPackages: g.packageIds || [],
      selectedEquipmentFeatures: (extras.equipment || [])
        .filter((e) => e.availability === 'standard' || e.availability === 'package')
        .map((e) => e.key),
      uvpConfigurationPrice: g.basePrice || c.listPrice || null,
    },
    payment: {
      type: paymentType,
      termMonths: c.durationMonths ?? null,
      mileagePerYear: c.annualMileageKm ?? null,
      downPayment: c.downPayment ?? c.specialPayment ?? 0,
      budget: null,
      calculatedRate: monthlyRate,
      listPrice: g.basePrice || c.listPrice || null,
      discountPercent: c.discountPercent ?? preparation.calculation?.discountPercent ?? null,
      discountAmount: c.discountAmount ?? preparation.calculation?.discountAmount ?? null,
      finalRate: c.finalPayment ?? null,
      transferCost: c.transferCost ?? preparation.calculation?.transferCost ?? 990,
      maintenance: false,
      insurance: false,
      winterWheels: false,
      towBar: (extras.equipment || []).some((e) => e.key === 'towbar'),
    },
    timing: {
      desiredDeliveryDate: null,
      leasingEnd: null,
      vehicleChangePlanned: false,
      urgentNeed: false,
    },
    source: {
      createdFrom: 'clever_agent',
      originalText: preparation.intent?.rawText || '',
      parsedFields: {},
      originalPdf: preparation.originalPdf || null,
    },
  };
}

export const prepareOfferToolDef = {
  name: 'prepare_offer',
  kind: 'write',
  description:
    'Bereitet ein Angebot vor (Prepared Action). Persistiert NICHT ohne confirm=true. '
    + 'Nutzt Kundenkonditionen aus dem Kontext. Erfindet keine Raten. '
    + 'Bei „das gleiche mit X km“: baseOnCurrentOffer=true und nur Overrides setzen.',
  parameters: {
    type: 'object',
    additionalProperties: false,
    properties: {
      modelKey: { type: ['string', 'null'] },
      modelLabel: { type: ['string', 'null'] },
      trimLabel: { type: ['string', 'null'] },
      color: { type: ['string', 'null'] },
      equipment: {
        type: ['array', 'null'],
        items: { type: 'string' },
        description: 'z. B. heat_pump oder WP',
      },
      paymentType: { type: ['string', 'null'] },
      durationMonths: { type: ['integer', 'null'] },
      mileagePerYear: { type: ['integer', 'null'] },
      downPayment: { type: ['number', 'null'] },
      monthlyRate: { type: ['number', 'null'] },
      discountPercent: { type: ['number', 'null'] },
      baseOnCurrentOffer: { type: ['boolean', 'null'] },
      instruction: { type: ['string', 'null'] },
      confirm: {
        type: ['boolean', 'null'],
        description: 'true nur wenn Verkäufer Persist explizit bestätigt hat. Default false = Prepared Action.',
      },
    },
  },
};

/** Alias für ältere Prompt-/Test-Namen */
export const createOfferToolDef = {
  ...prepareOfferToolDef,
  name: 'create_offer',
  description: `${prepareOfferToolDef.description} (Alias von prepare_offer)`,
};

/**
 * @param {object} runtime
 * @param {object} args
 */
export function executePrepareOffer(runtime = {}, args = {}) {
  const lead = runtime.lead || {};
  const memory = runtime.workingMemory || {};
  const context = buildCleverCustomerContext(lead, {
    workingContext: runtime.workingContext,
    currentOffer: runtime.currentOffer || memory.currentOffer,
  });

  const instruction = String(args.instruction || runtime.sellerMessage || '').trim();
  const baseOnCurrent = args.baseOnCurrentOffer !== false;
  const previousPreparation = runtime.previousOfferPreparation
    || memory.previousOfferPreparation
    || null;

  let text = args.instruction
    ? enrichOfferTextWithCustomerWish(lead, String(args.instruction))
    : buildSellerOfferText(lead, { ...args, instruction }, context);

  if (args.mileagePerYear != null) {
    text = `${text}, ${Number(args.mileagePerYear).toLocaleString('de-DE')} km/Jahr`;
  }
  if (args.durationMonths != null) text = `${text}, ${args.durationMonths} Monate`;
  if (args.monthlyRate != null) {
    text = `${text}, ${Number(args.monthlyRate).toLocaleString('de-DE')} €/Monat`;
  }
  if (args.downPayment != null) {
    text = `${text}, ${Number(args.downPayment) === 0 ? 'keine' : Number(args.downPayment).toLocaleString('de-DE')} € Anzahlung`;
  }
  if (args.color) text = `${text}, ${args.color}`;
  if (Array.isArray(args.equipment)) text = `${text}, ${args.equipment.join(' ')}`;

  const modelKey = args.modelKey
    || resolveMagicModelKey(args.modelLabel)
    || resolveMagicModelKey(context.currentInterest?.vehicleLabel)
    || resolveMagicModelKey(context.selectedOffer?.modelName)
    || context.currentInterest?.modelKey
    || memory.resolvedVehicle?.modelKey
    || null;

  let preparation;
  const followUp = Boolean(previousPreparation) && (
    baseOnCurrent
    || /gleich|dasselbe|nochmal|lieber|doch/i.test(instruction)
  );

  if (followUp && previousPreparation) {
    preparation = applyMagicOfferCorrection(previousPreparation, text, { modelKey });
  } else {
    preparation = prepareMagicOffer(text, {
      modelKey,
      previousPreparation: baseOnCurrent && context.selectedOffer
        ? {
          intent: {
            offerType: context.selectedOffer.paymentType === 'cash' ? 'purchase' : 'leasing',
            commercialInput: {
              monthlyRate: context.selectedOffer.monthlyRate,
              durationMonths: context.selectedOffer.termMonths,
              annualMileageKm: context.selectedOffer.mileagePerYear,
              downPayment: context.selectedOffer.downPayment,
            },
            vehicleRequest: {
              modelHint: context.selectedOffer.modelName || context.selectedOffer.modelKey,
            },
          },
        }
        : null,
    });
  }

  const groundedModelKey = preparation.grounded?.modelKey || modelKey;
  const trimId = preparation.grounded?.trimId
    || preparation.intent?.vehicleRequest?.trimHint
    || args.trimLabel
    || null;

  const equipment = resolveSellerEquipmentMentions(text, {
    modelKey: groundedModelKey,
    trimId,
  });
  const color = resolveSellerColorMention(text)
    || (args.color
      ? resolveSellerColorMention(String(args.color))
      : null);

  const ambiguities = equipment
    .filter((e) => e.ambiguity && (e.availability === 'unknown' || e.confidence < 0.8))
    .map((e) => e.ambiguity);
  const unavailable = equipment.filter((e) => e.availability === 'unavailable');

  if (unavailable.length) {
    return {
      ok: false,
      status: 'unavailable_equipment',
      confirmationRequired: false,
      message: unavailable.map((u) => u.ambiguity || `${u.label} nicht verfügbar`).join(' '),
      resolvedEquipment: equipment,
      resolvedColor: color,
      previousOfferPreparation: preparation,
    };
  }

  if (ambiguities.length && !args.confirmEquipment) {
    return {
      ok: false,
      status: 'needs_clarification',
      confirmationRequired: false,
      message: ambiguities[0],
      ambiguities,
      resolvedEquipment: equipment,
      resolvedColor: color,
      resolvedVehicle: {
        make: 'Kia',
        model: preparation.grounded?.model || groundedModelKey,
        modelKey: groundedModelKey,
        trim: preparation.grounded?.trimLabel || trimId,
        color: color?.label || null,
      },
      previousOfferPreparation: preparation,
    };
  }

  if (!preparation?.canCreateOffer) {
    const missing = [];
    if (preparation?.decision?.action) missing.push(preparation.decision.action);
    if (preparation?.decision?.message) missing.push(preparation.decision.message);
    if (preparation?.groundingMessage) missing.push(preparation.groundingMessage);

    const hasVehicle = Boolean(preparation?.grounded?.modelKey || groundedModelKey);
    const hasConditions = Boolean(
      context.conditions?.durationMonths
      || context.conditions?.mileage
      || context.selectedOffer?.termMonths,
    );
  // Capture-then-Offer: Wish-Budget ist kein Ersatz für fehlende Offer-Rate
  const needsRate = /ask_rate|missing_rate|rate/i.test(String(preparation?.decision?.action || ''))
      || (preparation?.paymentType === 'leasing' && preparation?.intent?.commercialInput?.monthlyRate == null
        && context.selectedOffer?.monthlyRate == null);

    let message = preparation?.decision?.message
      || preparation?.groundingMessage
      || 'Das Angebot kann noch nicht finalisiert werden.';

    if (hasVehicle && hasConditions && needsRate) {
      message = 'Fahrzeug und Konditionen sind klar. Für die Rate brauche ich noch eine Kalkulation bzw. ein Bankangebot.';
    }

    return {
      ok: false,
      status: 'needs_input',
      canCreateOffer: false,
      confirmationRequired: false,
      message,
      missing: missing.filter(Boolean).slice(0, 5),
      suggestedActions: needsRate
        ? [
          { action: 'import_offer_pdf', label: 'PDF einlesen' },
          { action: 'prepare_offer_without_rate', label: 'Angebot ohne Rate vorbereiten' },
        ]
        : [],
      resolvedEquipment: equipment,
      resolvedColor: color,
      resolvedVehicle: {
        make: 'Kia',
        model: preparation.grounded?.model || groundedModelKey,
        modelKey: groundedModelKey,
        trim: preparation.grounded?.trimLabel || trimId,
        color: color?.label || null,
        equipment,
      },
      preparationSummary: {
        offerType: preparation?.intent?.offerType || null,
        paymentType: preparation?.paymentType || null,
        commercialInput: preparation?.intent?.commercialInput || null,
        usedConditions: context.conditions,
      },
      previousOfferPreparation: preparation,
    };
  }

  const offerDraft = buildOfferDraftFromMagic(lead, preparation, {
    equipment,
    color,
    trimId,
    trimLabel: preparation.grounded?.trimLabel || args.trimLabel,
  });

  const rate = offerDraft.payment.calculatedRate;
  const vehicleLabel = [offerDraft.vehicle.model, offerDraft.vehicle.trimLabel].filter(Boolean).join(' ');
  const equipLabels = equipment.map((e) => e.label).filter(Boolean);
  const colorBit = color?.label ? `, Farbe ${color.label}` : '';
  const equipBit = equipLabels.length ? `, ${equipLabels.join(', ')}` : '';

  const offerSummary = {
    offerId: null,
    modelName: vehicleLabel,
    modelKey: offerDraft.vehicle.modelKey,
    paymentType: offerDraft.payment.type,
    termMonths: offerDraft.payment.termMonths,
    mileagePerYear: offerDraft.payment.mileagePerYear,
    downPayment: offerDraft.payment.downPayment,
    monthlyRate: rate,
    color: color?.label || null,
    equipment: equipLabels,
  };

  const confirm = args.confirm === true;

  if (!confirm) {
    return {
      ok: true,
      status: 'prepared',
      canCreateOffer: true,
      confirmationRequired: true,
      toolKind: 'write',
      offer: offerSummary,
      resolvedEquipment: equipment,
      resolvedColor: color,
      resolvedVehicle: {
        make: 'Kia',
        model: offerDraft.vehicle.model,
        modelKey: offerDraft.vehicle.modelKey,
        trim: offerDraft.vehicle.trimLabel,
        color: color?.label || null,
        equipment,
      },
      mutations: [],
      pendingAction: {
        type: 'prepare_offer',
        status: 'needs_confirmation',
        offerDraft,
        preparation,
      },
      artifacts: [
        {
          type: 'offer_prepare',
          label: 'Angebot prüfen',
          data: { offer: offerSummary, vehicle: offerDraft.vehicle },
        },
      ],
      suggestedActions: [
        { action: 'confirm_offer', label: 'Übernehmen' },
        { action: 'edit_offer', label: 'Anpassen' },
      ],
      previousOfferPreparation: preparation,
      message: rate != null
        ? `Angebot vorbereitet: ${vehicleLabel}${colorBit}${equipBit} · ${offerDraft.payment.termMonths || '–'} Monate · ${
          offerDraft.payment.mileagePerYear != null
            ? `${Number(offerDraft.payment.mileagePerYear).toLocaleString('de-DE')} km`
            : '–'
        } · ${Number(rate).toLocaleString('de-DE')} €/Monat. Noch nicht gespeichert.`
        : `Angebot vorbereitet: ${vehicleLabel}${colorBit}${equipBit}. Rate fehlt noch – bitte prüfen.`,
    };
  }

  const config = offerDraftToVehicleConfiguration(offerDraft);
  const card = offerDraftToVehicleCard(offerDraft, { configId: config.id, cardId: config.id });
  const leadPatch = finalizeLeadWithOfferDraft(lead, offerDraft, {
    config,
    card,
    enrichedParsed: null,
    selectedModelIds: offerDraft.vehicle.modelKey ? [offerDraft.vehicle.modelKey] : [],
  });

  return {
    ok: true,
    status: 'created',
    canCreateOffer: true,
    confirmationRequired: false,
    toolKind: 'write',
    offer: { ...offerSummary, offerId: config.id },
    resolvedEquipment: equipment,
    resolvedColor: color,
    resolvedVehicle: {
      make: 'Kia',
      model: offerDraft.vehicle.model,
      modelKey: offerDraft.vehicle.modelKey,
      trim: offerDraft.vehicle.trimLabel,
      color: color?.label || null,
      equipment,
    },
    mutations: [{ type: 'apply_lead_patch', leadPatch }],
    artifacts: [
      {
        type: 'offer',
        offerId: config.id,
        label: 'Angebot öffnen',
        data: { card, offer: { ...offerSummary, offerId: config.id } },
      },
    ],
    suggestedActions: [
      { action: 'send_offer', label: 'An Kunde senden' },
      { action: 'open_offer', label: 'Angebot öffnen' },
    ],
    previousOfferPreparation: preparation,
    message: rate != null
      ? `Angebot für ${vehicleLabel} gespeichert (${offerDraft.payment.termMonths || '–'} Monate, ${
        offerDraft.payment.mileagePerYear != null
          ? `${Number(offerDraft.payment.mileagePerYear).toLocaleString('de-DE')} km`
          : '–'
      }, ${Number(rate).toLocaleString('de-DE')} €/Monat).`
      : `Angebot für ${vehicleLabel} gespeichert.`,
  };
}

export function executeCreateOffer(runtime, args) {
  return executePrepareOffer(runtime, args);
}
