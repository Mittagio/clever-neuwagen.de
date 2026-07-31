/**
 * Action Planner – verbindet Intents mit Tool Registry (bestehende CRM-Services).
 * EXECUTE passiert erst nach Seller-Bestätigung.
 */
import { SELLER_FACT_CLASS, SELLER_INPUT_MODE, SELLER_TURN_INTENTS } from './sellerFactTypes.js';
import { runTool } from './toolRegistry.js';
import { buildCustomerUnderstanding } from '../dealer/customerUnderstanding.js';
import { validateCustomerMessageNotSellerCommand } from './validateSellerCommandMessage.js';

function salutationName(customerName, facts, lead) {
  const name = customerName
    || facts.find((f) => f.field === 'customerName')?.value
    || lead?.contact?.name
    || 'Kunde';
  const salutation = String(lead?.contact?.salutation || '').toLowerCase();
  if (/^(herr|frau)\b/i.test(name)) return name;
  if (salutation === 'frau') return `Frau ${name}`;
  return `Herr ${name}`;
}

function buildOfferMessageDraft({
  lead,
  sellerInput,
  facts,
  customerName,
  offerPayload = null,
}) {
  void sellerInput;
  const purchase = facts.find((f) => f.field === 'purchasePrice');
  const vehicle = facts.find((f) => f.field === 'vehicleInterest');
  const transmission = facts.find((f) => f.field === 'transmissionPreference');
  const discount = facts.find((f) => f.field === 'discountPercent');
  const vehicleLabel = offerPayload?.vehicleLabel
    || vehicle?.label
    || 'das gewünschte Fahrzeug';
  const priceLabel = purchase
    ? `${Number(purchase.value).toLocaleString('de-DE')} €`
    : (offerPayload?.monthlyRate != null
      ? `${Number(offerPayload.monthlyRate).toLocaleString('de-DE')} €/Monat`
      : null);

  const labels = [];
  try {
    const u = buildCustomerUnderstanding(lead);
    for (const l of (u?.verstaendnis?.labels ?? []).slice(0, 4)) {
      if (l) labels.push(String(l));
    }
  } catch {
    /* ignore */
  }

  const detailBits = [];
  if (transmission?.label || /automatik/i.test(vehicleLabel)) {
    detailBits.push(transmission?.label || 'Automatik');
  }
  if (discount?.label) detailBits.push(discount.label);

  const lines = [
    `Hallo ${salutationName(customerName, facts, lead)},`,
    '',
    `anbei erhalten Sie das gewünschte Angebot für den ${vehicleLabel}`
      + (detailBits.length ? ` (${detailBits.join(', ')})` : '')
      + '.',
  ];
  if (priceLabel) {
    lines.push('', `Die Kondition: ${priceLabel}.`);
  }
  const term = lead?.wish?.termMonths;
  const km = lead?.wish?.mileagePerYear;
  const down = lead?.wish?.downPayment;
  if (term || km != null || down != null) {
    const cond = [
      term ? `${term} Monate` : null,
      km != null ? `${Number(km).toLocaleString('de-DE')} km/Jahr` : null,
      down != null ? `${Number(down) === 0 ? '0 €' : `${Number(down).toLocaleString('de-DE')} €`} AZ` : null,
    ].filter(Boolean);
    if (cond.length) lines.push('', `Basis: ${cond.join(' · ')}.`);
  }
  if (labels.some((l) => /hund/i.test(l))) {
    lines.push(
      '',
      'Da Ihnen auch ausreichend Platz für Ihren Hund wichtig ist, können wir uns das Fahrzeug gerne gemeinsam vor Ort ansehen und prüfen, ob es für Ihre Anforderungen gut passt.',
    );
  } else if (labels.length) {
    lines.push(
      '',
      `Dabei berücksichtige ich, was uns wichtig war: ${labels.slice(0, 3).join(', ')}.`,
    );
  }
  lines.push('', 'Viele Grüße');
  return lines.join('\n');
}

/** Neutraler Zwischenentwurf – nur wenn Angebot noch unvollständig (Rate fehlt). */
function buildOfferPendingInterimDraft({ lead, facts, customerName, offerPayload = null }) {
  const vehicle = facts.find((f) => f.field === 'vehicleInterest');
  const vehicleLabel = offerPayload?.vehicleLabel || vehicle?.label || 'Ihr Wunschfahrzeug';
  return [
    `Hallo ${salutationName(customerName, facts, lead)},`,
    '',
    `ich bereite das gewünschte Angebot für den ${vehicleLabel} aktuell für Sie vor`,
    'und sende es Ihnen, sobald die Kalkulation vollständig ist.',
    '',
    'Viele Grüße',
  ].join('\n');
}

/** Kundennachricht bei Anpassung eines angehängten Angebots (km, Laufzeit, Rate, …). */
function buildOfferUpdateMessageDraft({
  lead,
  facts = [],
  customerName,
  currentOfferContext = null,
}) {
  const offerLabel = currentOfferContext?.title
    || currentOfferContext?.summary
    || 'Ihr Angebot';
  const changeBits = facts
    .filter((f) => (
      f.field === 'annualMileage'
      || f.field === 'termMonths'
      || f.field === 'desiredRate'
      || f.field === 'downPayment'
      || f.factClass === SELLER_FACT_CLASS.COMMERCIAL_PREFERENCE
      || f.factClass === SELLER_FACT_CLASS.OFFER_INSTRUCTION
    ))
    .map((f) => String(f.label || '').trim())
    .filter(Boolean);

  const lines = [
    `Hallo ${salutationName(customerName, facts, lead)},`,
    '',
    `wie besprochen habe ich das Angebot (${offerLabel}) angepasst.`,
  ];
  if (changeBits.length) {
    lines.push('', `Konkret: ${changeBits.slice(0, 4).join(', ')}.`);
  }
  lines.push(
    '',
    'Schauen Sie gerne noch einmal rein – bei Fragen melde ich mich gerne.',
    '',
    'Viele Grüße',
  );
  return lines.join('\n');
}

/** Kundennachricht: angehängtes Angebot kurz als Mail zusammenfassen. */
function buildAttachedOfferSummaryMessageDraft({
  lead,
  customerName,
  currentOfferContext = null,
}) {
  const offerLabel = currentOfferContext?.title
    || currentOfferContext?.summary
    || 'Ihr Angebot';
  const bits = [];
  if (currentOfferContext?.termMonths) bits.push(`${currentOfferContext.termMonths} Monate`);
  if (currentOfferContext?.mileagePerYear) {
    bits.push(`${Number(currentOfferContext.mileagePerYear).toLocaleString('de-DE')} km/Jahr`);
  }
  if (currentOfferContext?.monthlyRate != null) {
    bits.push(`${Number(currentOfferContext.monthlyRate).toLocaleString('de-DE')} €/Monat`);
  }
  const payment = currentOfferContext?.paymentType;
  const paymentLabel = payment === 'leasing'
    ? 'Leasing'
    : payment === 'financing' || payment === 'threeWayFinancing'
      ? 'Finanzierung'
      : payment === 'cash'
        ? 'Barkauf'
        : null;

  const lines = [
    `Hallo ${salutationName(customerName, [], lead)},`,
    '',
    `anbei die Kurzfassung zu Ihrem Angebot (${offerLabel}).`,
  ];
  if (paymentLabel || bits.length) {
    lines.push(
      '',
      [paymentLabel, bits.length ? bits.join(' · ') : null].filter(Boolean).join(' – '),
    );
  }
  lines.push(
    '',
    'Wenn Sie möchten, schicke ich Ihnen gerne den Kundenlink oder wir sprechen die Details kurz durch.',
    '',
    'Viele Grüße',
  );
  return lines.join('\n');
}

/**
 * @param {object} params
 */
export function planSellerActions({
  lead = {},
  sellerInput = '',
  intents = [],
  inputMode = SELLER_INPUT_MODE.CLEVER_WORK_INPUT,
  facts = [],
  missingInformation = [],
  currentOfferContext = null,
  resolvedCustomer = null,
  workingContext = null,
  goldenMoment = null,
  attachments = [],
} = {}) {
  const actions = [];
  const intentTypes = new Set(intents.map((i) => i.type));
  const customerName = resolvedCustomer?.name
    || resolvedCustomer?.namedInInput
    || lead?.contact?.name
    || '';

  const moment = goldenMoment
    || runTool('build_golden_moment', { lead }).result
    || null;

  if (intentTypes.has(SELLER_TURN_INTENTS.RECOMMEND_NEXT_STEP) && moment) {
    actions.push({
      id: 'recommend_next_step',
      type: SELLER_TURN_INTENTS.RECOMMEND_NEXT_STEP,
      label: moment.primaryLabel || 'Nächster Schritt',
      needsSellerConfirmation: true,
      status: 'prepared',
      toolId: 'build_golden_moment',
      payload: {
        goldenMoment: moment,
        recommendedAction: moment.recommendedAction,
      },
    });
  }

  if (intentTypes.has(SELLER_TURN_INTENTS.SEARCH_CUSTOMER_HISTORY)) {
    const { result: search } = runTool('search_customer_history', {
      lead,
      sellerInput,
      customerName,
    });
    actions.push({
      id: 'search_customer_history',
      type: SELLER_TURN_INTENTS.SEARCH_CUSTOMER_HISTORY,
      label: 'Verlauf durchsuchen',
      needsSellerConfirmation: false,
      status: search?.ok ? 'prepared' : 'blocked',
      toolId: 'search_customer_history',
      legacy: search ?? null,
      payload: {
        hitCount: search?.results?.length ?? 0,
      },
    });
  }

  if (intentTypes.has(SELLER_TURN_INTENTS.UPDATE_CUSTOMER_CONTEXT)) {
    actions.push({
      id: 'update_customer_context',
      type: SELLER_TURN_INTENTS.UPDATE_CUSTOMER_CONTEXT,
      label: 'Kundendaten einsortieren',
      needsSellerConfirmation: false,
      status: 'prepared',
      payload: {
        factCount: facts.filter((f) => f.factClass !== 'offer_instruction').length,
      },
    });
  }

  const trackFeedbackFacts = facts.filter((f) => f.field === 'vehicleTrackFeedback' && f.value);
  const favoriteFeedback = trackFeedbackFacts.find(
    (f) => f.value?.status === 'favorite',
  );
  if (favoriteFeedback || trackFeedbackFacts.some((f) => f.value?.status === 'deferred')) {
    const favoriteLabel = favoriteFeedback?.label
      || favoriteFeedback?.value?.modelKey
      || 'Favorit';
    const modelKey = favoriteFeedback?.value?.modelKey || null;
    actions.push({
      id: 'revise_favorite_offer',
      type: SELLER_TURN_INTENTS.PREPARE_OFFER,
      label: modelKey
        ? `${String(modelKey).replace(/^./, (c) => c.toUpperCase())}-Angebot anpassen`
        : 'Angebot anpassen',
      needsSellerConfirmation: true,
      status: 'prepared',
      toolId: 'prepare_offer',
      payload: {
        reviseFavoriteOffer: true,
        modelKey,
        favoriteLabel,
        trackFeedback: trackFeedbackFacts.map((f) => ({
          modelKey: f.value?.modelKey,
          status: f.value?.status,
          label: f.label,
        })),
        goldenMoment: moment || null,
      },
    });
  }

  if (intentTypes.has(SELLER_TURN_INTENTS.PREPARE_TRADE_IN)) {
    actions.push({
      id: 'prepare_trade_in',
      type: SELLER_TURN_INTENTS.PREPARE_TRADE_IN,
      label: 'Inzahlungnahme vorbereiten',
      needsSellerConfirmation: true,
      status: 'prepared',
      payload: {
        missing: missingInformation.filter((m) => m.forIntent === SELLER_TURN_INTENTS.PREPARE_TRADE_IN),
      },
    });
  }

  if (intentTypes.has(SELLER_TURN_INTENTS.PREPARE_OFFER)) {
    const blockedByClarify = missingInformation.some((m) => m.id === 'clarify_purchase_vs_leasing');
    const commercialOnly = facts.length > 0
      && facts.every((f) => (
        f.factClass === SELLER_FACT_CLASS.COMMERCIAL_PREFERENCE
        || f.factClass === SELLER_FACT_CLASS.MESSAGE_INSTRUCTION
        || f.factClass === SELLER_FACT_CLASS.SELLER_NOTE
        || f.factClass === SELLER_FACT_CLASS.OFFER_INSTRUCTION
        || f.factClass === SELLER_FACT_CLASS.VEHICLE_INTEREST
        || f.factClass === SELLER_FACT_CLASS.CUSTOMER_FACT
      ));
    if (blockedByClarify) {
      actions.push({
        id: 'prepare_offer',
        type: SELLER_TURN_INTENTS.PREPARE_OFFER,
        label: 'Angebot – Klärung nötig',
        needsSellerConfirmation: true,
        status: 'blocked',
        payload: {
          needsClarification: true,
        },
      });
    } else if (currentOfferContext?.offerId && commercialOnly && !facts.some((f) => f.field === 'purchasePrice')) {
      actions.push({
        id: 'update_offer_context',
        type: SELLER_TURN_INTENTS.PREPARE_OFFER,
        label: 'Angebot anpassen',
        needsSellerConfirmation: true,
        status: 'prepared',
        toolId: 'modify_offer',
        payload: {
          updateOnly: true,
          offerId: currentOfferContext.offerId,
          offerSummary: currentOfferContext.summary || currentOfferContext.title || null,
        },
      });
    } else {
      const { result: offer } = runTool('prepare_offer', {
        lead,
        sellerInput,
        currentOfferContext,
        facts,
        attachments,
      });
      const purchase = facts.find((f) => f.field === 'purchasePrice');
      const magic = offer?.results?.[0]?.magic || null;
      const grounded = magic?.grounded || null;
      const vehicleFromFacts = facts.find((f) => f.field === 'vehicleInterest');
      const vehicleLabel = [
        grounded?.model ? `Kia ${grounded.model}` : null,
        grounded?.trimLabel || null,
        /automatik|dct/i.test(grounded?.engineLabel || '') ? 'Automatik' : null,
      ].filter(Boolean).join(' ')
        || vehicleFromFacts?.label
        || null;
      const canCreate = Boolean(magic?.canCreateOffer) || Boolean(purchase);
      actions.push({
        id: 'prepare_offer',
        type: SELLER_TURN_INTENTS.PREPARE_OFFER,
        label: canCreate ? 'Angebot vorbereiten' : 'Angebot prüfen',
        needsSellerConfirmation: true,
        status: offer?.ok || purchase ? 'prepared' : 'blocked',
        toolId: 'prepare_offer',
        legacy: offer ?? null,
        payload: {
          canCreateOffer: canCreate,
          purchasePrice: purchase?.value ?? magic?.calculation?.endPrice ?? grounded?.basePrice ?? null,
          paymentType: facts.find((f) => f.field === 'paymentType')?.value
            || magic?.paymentType
            || null,
          vehicleLabel,
          monthlyRate: magic?.calculation?.monthlyRate
            ?? magic?.intent?.commercialInput?.monthlyRate
            ?? null,
          discountPercent: magic?.intent?.commercialInput?.discountPercent ?? null,
          listPrice: grounded?.basePrice ?? null,
          engineLabel: grounded?.engineLabel ?? null,
          variantId: grounded?.variantId ?? null,
          decisionAction: magic?.decision?.action ?? null,
          missingRate: magic?.decision?.action === 'ask_rate',
          attachWorkingContext: true,
        },
      });
    }
  }

  if (intentTypes.has(SELLER_TURN_INTENTS.SEND_PORTFOLIO)) {
    actions.push({
      id: 'send_portfolio',
      type: SELLER_TURN_INTENTS.SEND_PORTFOLIO,
      label: 'Kundenlink senden',
      needsSellerConfirmation: true,
      status: 'prepared',
      payload: {
        cta: 'Kundenlink senden',
      },
    });
  }

  if (intentTypes.has(SELLER_TURN_INTENTS.REQUEST_DOCUMENTS)) {
    const { result: pkg } = runTool('request_documents', { lead, sellerInput });
    actions.push({
      id: 'request_documents',
      type: SELLER_TURN_INTENTS.REQUEST_DOCUMENTS,
      label: 'Unterlagen anfordern',
      needsSellerConfirmation: true,
      status: 'prepared',
      toolId: 'request_documents',
      legacy: pkg,
      payload: {
        actionCount: pkg?.actions?.length ?? 0,
      },
    });
  }

  if (intentTypes.has(SELLER_TURN_INTENTS.PROPOSE_APPOINTMENT)
    || intentTypes.has(SELLER_TURN_INTENTS.PREPARE_CALLBACK)) {
    const { result: appointment } = runTool('propose_appointment', {
      lead,
      sellerInput,
      resolvedCustomer,
    });
    const appointmentMessage = appointment?.results?.[0]?.messageBody
      || appointment?.results?.[0]?.draft?.body
      || null;
    actions.push({
      id: 'propose_appointment',
      type: SELLER_TURN_INTENTS.PROPOSE_APPOINTMENT,
      label: 'Termin vorbereiten',
      needsSellerConfirmation: true,
      status: appointment?.ok ? 'prepared' : 'blocked',
      toolId: 'propose_appointment',
      legacy: appointment ?? null,
      payload: {
        messageDraft: appointmentMessage,
        when: appointment?.appointment?.startAt || null,
      },
    });
    if (appointmentMessage && !intentTypes.has(SELLER_TURN_INTENTS.SEARCH_CUSTOMER_HISTORY)) {
      actions.push({
        id: 'draft_message',
        type: SELLER_TURN_INTENTS.DRAFT_MESSAGE,
        label: 'Nachricht vorbereiten',
        needsSellerConfirmation: true,
        status: 'prepared',
        toolId: 'draft_customer_message',
        payload: { messageDraft: appointmentMessage },
      });
    }
  }

  if (intentTypes.has(SELLER_TURN_INTENTS.LOOKUP_VEHICLE_FACT)) {
    const interpretation = runTool('interpret_message_instruction', { sellerInput }).result
      || { sellerFacts: [] };
    const modelFact = facts.find((f) => f.field === 'vehicleInterest');
    const modelKey = modelFact?.value?.modelKey || workingContext?.attachedVehicle?.modelKey;
    const trimId = modelFact?.value?.trim || workingContext?.attachedVehicle?.trimId;
    let retrieved = null;
    if (modelKey) {
      const variant = runTool('lookup_vehicle_variant', { modelKey, trim: trimId }).result;
      const pkgName = interpretation.sellerFacts?.find((f) => f.type === 'package_present')?.value;
      const pkg = pkgName
        ? runTool('lookup_package_contents', {
          modelKey,
          trim: trimId,
          packageName: pkgName,
        }).result
        : null;
      const eq = trimId
        ? runTool('lookup_vehicle_equipment', { modelKey, trim: trimId }).result
        : null;
      retrieved = { variant, package: pkg, equipment: eq };
    }
    const inline = runTool('draft_customer_message', {
      lead,
      sellerInput,
      currentOfferContext,
    }).result;
    actions.push({
      id: 'lookup_vehicle_fact',
      type: SELLER_TURN_INTENTS.LOOKUP_VEHICLE_FACT,
      label: 'Fahrzeugfakt prüfen',
      needsSellerConfirmation: false,
      status: inline?.ok || retrieved ? 'prepared' : 'blocked',
      toolId: 'lookup_vehicle_variant',
      legacy: inline ?? null,
      payload: { retrieved },
    });
  }

  const offerAction = actions.find((a) => a.type === SELLER_TURN_INTENTS.PREPARE_OFFER);
  const offerIncomplete = Boolean(
    offerAction
    && offerAction.payload
    && offerAction.payload.canCreateOffer === false,
  );

  // „Angebot“ allein ist kein Message-Intent – erst verstehen/vorbereiten, dann formulieren.
  const explicitWrite = /\b(schreib|sag(?:e|en)?\s+ihm|mail\b|nachricht|danke|lieferzeit|verf(?:ue|u|ü)gbar|nachfass|kundenlink)\b/i.test(sellerInput);
  const wantsCustomerMessage = inputMode === SELLER_INPUT_MODE.CUSTOMER_MESSAGE
    || intentTypes.has(SELLER_TURN_INTENTS.DRAFT_MESSAGE)
    || (explicitWrite && !intentTypes.has(SELLER_TURN_INTENTS.PREPARE_OFFER))
    || (explicitWrite && intentTypes.has(SELLER_TURN_INTENTS.PREPARE_OFFER) && !offerIncomplete)
    || (intentTypes.has(SELLER_TURN_INTENTS.PREPARE_OFFER) && offerAction?.payload?.canCreateOffer);

  if (
    !intentTypes.has(SELLER_TURN_INTENTS.SEND_PORTFOLIO)
    && !intentTypes.has(SELLER_TURN_INTENTS.SEARCH_CUSTOMER_HISTORY)
    && !actions.some((a) => a.type === SELLER_TURN_INTENTS.DRAFT_MESSAGE)
    && (wantsCustomerMessage || (offerIncomplete && intentTypes.has(SELLER_TURN_INTENTS.PREPARE_OFFER)))
  ) {
    const inline = runTool('draft_customer_message', {
      lead,
      sellerInput,
      currentOfferContext,
      customerName,
      workingContext,
    }).result;
    let messageDraft = null;
    const offerUpdateAction = actions.find((a) => (
      a.type === SELLER_TURN_INTENTS.PREPARE_OFFER && a.payload?.updateOnly
    ));

    if (offerIncomplete && intentTypes.has(SELLER_TURN_INTENTS.PREPARE_OFFER) && !explicitWrite) {
      // Primär: Angebot vervollständigen – nur neutraler Zwischenentwurf (sekundär)
      messageDraft = buildOfferPendingInterimDraft({
        lead,
        facts,
        customerName,
        offerPayload: offerAction?.payload,
      });
    } else if (intentTypes.has(SELLER_TURN_INTENTS.PREPARE_OFFER)
      && offerAction?.payload?.canCreateOffer
      && facts.some((f) => f.field === 'purchasePrice' || f.field === 'vehicleInterest')) {
      messageDraft = buildOfferMessageDraft({
        lead,
        sellerInput,
        facts,
        customerName,
        offerPayload: offerAction?.payload,
      });
    } else if (offerUpdateAction || (
      intentTypes.has(SELLER_TURN_INTENTS.PREPARE_OFFER)
      && currentOfferContext?.offerId
      && facts.some((f) => (
        f.field === 'annualMileage'
        || f.field === 'termMonths'
        || f.field === 'desiredRate'
        || f.field === 'downPayment'
      ))
    )) {
      messageDraft = buildOfferUpdateMessageDraft({
        lead,
        facts,
        customerName,
        currentOfferContext,
      });
    } else if (intentTypes.has(SELLER_TURN_INTENTS.DRAFT_MESSAGE)
      && currentOfferContext?.offerId
      && /\b(fass(?:e|en)?|zusammenfass|erkl[aä]r|angehängten?\s+angebot|kurz(?:e)?\s+zusammenfassung)\b/i.test(sellerInput)
    ) {
      messageDraft = buildAttachedOfferSummaryMessageDraft({
        lead,
        customerName,
        currentOfferContext,
      });
    } else if (wantsCustomerMessage && !offerIncomplete) {
      const instruction = runTool('interpret_message_instruction', { sellerInput }).result;
      const offerFacts = currentOfferContext?.offerId
        ? {
          offerId: currentOfferContext.offerId,
          title: currentOfferContext.title || currentOfferContext.summary || currentOfferContext.shortLabel || null,
          monthlyRate: currentOfferContext.monthlyRate ?? null,
          termMonths: currentOfferContext.termMonths ?? null,
          mileagePerYear: currentOfferContext.mileagePerYear ?? null,
          paymentType: currentOfferContext.paymentType ?? null,
          summary: currentOfferContext.summary || currentOfferContext.shortLabel || null,
        }
        : null;
      const vehicleIdentity = workingContext?.attachedVehicle
        || (currentOfferContext
          ? {
            modelKey: currentOfferContext.modelKey || null,
            modelLabel: currentOfferContext.title || currentOfferContext.modelKey || null,
            trimId: currentOfferContext.trimId || null,
            color: currentOfferContext.color || null,
          }
          : null);
      const ctx = runTool('build_minimal_message_context', {
        recipient: customerName || 'Kunde',
        rawSellerInstruction: sellerInput,
        vehicleIdentity,
        sellerFacts: instruction?.sellerFacts || [],
        offerFacts,
        tone: 'freundlich',
      }).result;
      messageDraft = runTool('write_grounded_message', {
        minimalContext: ctx || {},
        options: {},
      }).result?.body || null;
    }

    if (messageDraft && !validateCustomerMessageNotSellerCommand(messageDraft).ok) {
      messageDraft = offerIncomplete
        ? buildOfferPendingInterimDraft({
          lead,
          facts,
          customerName,
          offerPayload: offerAction?.payload,
        })
        : buildOfferMessageDraft({
          lead,
          sellerInput,
          facts,
          customerName,
          offerPayload: offerAction?.payload,
        });
      if (!validateCustomerMessageNotSellerCommand(messageDraft).ok) {
        messageDraft = null;
      }
    }

    if (messageDraft || inline) {
      actions.push({
        id: 'draft_message',
        type: SELLER_TURN_INTENTS.DRAFT_MESSAGE,
        label: offerIncomplete ? 'Zwischenentwurf' : 'Nachricht vorbereiten',
        needsSellerConfirmation: true,
        status: 'prepared',
        toolId: 'draft_customer_message',
        legacy: inline ?? null,
        payload: {
          messageDraft,
          interimOnly: offerIncomplete,
        },
      });
    }
  }

  return actions;
}

/**
 * Kompakte Assistenten-Antwort (kein JSON im UI).
 */
export function buildSellerAssistantReply({
  facts = [],
  missingInformation = [],
  preparedActions = [],
  inputMode,
} = {}) {
  if (!facts.length && !preparedActions.length) {
    return null;
  }

  const captured = facts
    .filter((f) => !f.needsConfirmation)
    .map((f) => f.label)
    .slice(0, 8);

  const lines = [];
  if (captured.length) {
    lines.push(`Alles klar. Ich habe die Angaben einsortiert: ${captured.join(' · ')}.`);
  } else {
    lines.push('Alles klar – ich habe den Input verstanden.');
  }

  if (missingInformation.length) {
    const labels = missingInformation.slice(0, 2).map((m) => m.label);
    lines.push(`Noch offen: ${labels.join('; ')}.`);
  }

  if (inputMode === SELLER_INPUT_MODE.AMBIGUOUS) {
    lines.push('Soll ich das dem Kunden senden oder nur intern speichern?');
  }

  const confirmActions = preparedActions.filter((a) => a.needsSellerConfirmation);
  if (confirmActions.length) {
    lines.push(`Vorbereitet: ${confirmActions.map((a) => a.label).join(', ')}.`);
  }

  return lines.join('\n\n');
}
