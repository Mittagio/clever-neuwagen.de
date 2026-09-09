/**
 * Missing-Information Resolver – nur was für die aktuelle Aufgabe fehlt.
 */
import { SELLER_FACT_CLASS, SELLER_FACT_SOURCE, SELLER_TURN_INTENTS } from './sellerFactTypes.js';
import { getNeedProfileFromLead } from '../consultation/needProfileService.js';
import {
  isBareMonthlyRateCue,
  MONTHLY_RATE_CLARIFY_PROMPT,
} from './commercialOfferNl.js';
import {
  CLARIFY_VEHICLE_FOR_OFFER_PROMPT,
  OFFER_VEHICLE_TARGET_STATUS,
  listOfferIdentityColorChoices,
  resolveOfferVehicleTarget,
} from './offerVehicleIdentity.js';
import { resolveConfigureModel } from '../configuration/configureModelBridge.js';

/**
 * @param {object} params
 */
export function resolveMissingInformation({
  intents = [],
  facts = [],
  lead = {},
  currentOfferContext = null,
  workingContext = null,
  sellerInput = '',
} = {}) {
  const missing = [];
  const profile = getNeedProfileFromLead(lead) || {};
  const has = (factClass, field = null) => facts.some((f) => (
    f.factClass === factClass && (!field || f.field === field)
  ));

  const wantsTradeIn = intents.some((i) => i.type === SELLER_TURN_INTENTS.PREPARE_TRADE_IN)
    || has(SELLER_FACT_CLASS.TRADE_IN_FACT);
  if (wantsTradeIn) {
    if (!has(SELLER_FACT_CLASS.EXISTING_VEHICLE) && !lead?.crm?.tradeIn?.vehicle) {
      missing.push({
        id: 'trade_in_vehicle',
        forIntent: SELLER_TURN_INTENTS.PREPARE_TRADE_IN,
        label: 'Welches Fahrzeug soll in Zahlung genommen werden?',
        field: 'existingVehicle',
      });
    }
    const hasMileage = has(SELLER_FACT_CLASS.EXISTING_VEHICLE) === false
      ? false
      : facts.some((f) => f.field === 'mileage' || f.field === 'odometer');
    if (!hasMileage && !lead?.crm?.tradeIn?.mileage) {
      missing.push({
        id: 'trade_in_mileage',
        forIntent: SELLER_TURN_INTENTS.PREPARE_TRADE_IN,
        label: 'Kilometerstand des Inzahlungnahme-Fahrzeugs',
        field: 'mileage',
      });
    }
    if (!/\bfahrzeugschein\b/i.test(JSON.stringify(facts)) && !lead?.crm?.tradeIn?.registrationDocument) {
      missing.push({
        id: 'trade_in_registration',
        forIntent: SELLER_TURN_INTENTS.PREPARE_TRADE_IN,
        label: 'Fahrzeugschein',
        field: 'vehicle_registration',
      });
    }
  }

  const wantsOffer = intents.some((i) => i.type === SELLER_TURN_INTENTS.PREPARE_OFFER);
  if (wantsOffer) {
    const offerTarget = resolveOfferVehicleTarget({
      lead,
      sellerInput,
      facts,
      currentOfferContext,
      workingContext,
    });
    if (offerTarget.status === OFFER_VEHICLE_TARGET_STATUS.NEEDS_CLARIFICATION) {
      missing.push({
        id: 'clarify_vehicle_for_offer',
        forIntent: SELLER_TURN_INTENTS.PREPARE_OFFER,
        label: offerTarget.question || CLARIFY_VEHICLE_FOR_OFFER_PROMPT,
        field: 'vehicleInterest',
        choices: offerTarget.choices || [],
      });
    } else if (offerTarget.status === OFFER_VEHICLE_TARGET_STATUS.UNRESOLVED) {
      const hasAttachedOffer = Boolean(
        currentOfferContext?.offerId
        || currentOfferContext?.title
        || currentOfferContext?.summary,
      );
      const hasVehicle = hasAttachedOffer
        || has(SELLER_FACT_CLASS.VEHICLE_INTEREST)
        || profile?.preferredModelKey
        || lead?.wish?.modelKey;
      if (!hasVehicle) {
        missing.push({
          id: 'offer_vehicle',
          forIntent: SELLER_TURN_INTENTS.PREPARE_OFFER,
          label: offerTarget.question || 'Welches Modell soll angeboten werden?',
          field: 'vehicleInterest',
        });
      }
    } else if (offerTarget.status === OFFER_VEHICLE_TARGET_STATUS.RESOLVED) {
      const modelKey = String(offerTarget.modelKey || '').toLowerCase();
      const modelData = modelKey ? resolveConfigureModel(modelKey)?.data : null;
      const trimHint = String(
        offerTarget.trim
        || facts.find((f) => f.field === 'trimPreference')?.value?.trim
        || facts.find((f) => f.field === 'trimPreference')?.label
        || '',
      ).toLowerCase();
      const trim = trimHint
        ? (modelData?.trims || []).find((t) => (
          String(t.id || '').toLowerCase() === trimHint
          || String(t.name || '').toLowerCase() === trimHint
        ))
        : null;

      // Capture-then-Continue Vision:
      // Wenn der Verkäufer im ersten Schritt explizit nur Modell/Trim nennt ("EV3 Earth"),
      // dann machen wir hier erstmal "nur Aufnahme" und stellen noch keine weiteren
      // (Motor/Pakete/Farbe/Rate) Rückfragen. Das wird im nächsten Schritt im Angebotstool ergänzt.
      const modelTrimCaptureOnly = (
        offerTarget.source === 'explicit_model'
        && Boolean(trim?.id || offerTarget.trim)
        && !currentOfferContext?.offerId
      );
      if (modelTrimCaptureOnly) {
        // Modell/Trim ist angekommen → keine Missing-Identity und keine Commercial-Fragen
        // (Rate/Konditionen kommen erst später).
        return missing;
      }

      const hasColor = facts.some((f) => f.field === 'colorPreference')
        || Boolean(currentOfferContext?.color)
        || Boolean(workingContext?.attachedVehicle?.color)
        || Boolean(offerTarget.color);
      if (!hasColor && modelKey) {
        const colors = listOfferIdentityColorChoices(modelKey).slice(0, 8);
        missing.push({
          id: 'offer_color',
          forIntent: SELLER_TURN_INTENTS.PREPARE_OFFER,
          label: 'Welche Farbe soll ins Angebot?',
          field: 'colorPreference',
          choices: colors.map((c) => ({
            id: c.id,
            label: c.label,
            insertText: c.label,
          })),
        });
      }

      const hasPackage = facts.some((f) => (
        f.field === 'equipmentWish'
        && /paket|p\d+/i.test(String(f.label || f.value?.label || f.value?.code || ''))
      )) || facts.some((f) => (
        f.field === 'vehicleInterest' && Boolean(f.value?.package || f.value?.equipmentPackage)
      ));
      // PDF-Angebot mit echter Rate: keine Katalog-Package-/Motor-Choices als Missing erzwingen
      const pdfOfferComplete = facts.some((f) => f.source === SELLER_FACT_SOURCE.OFFER_PDF)
        && facts.some((f) => f.field === 'monthlyBudget')
        && facts.some((f) => f.field === 'vehicleInterest');
      if (!hasPackage && modelData?.packages?.length && !pdfOfferComplete) {
        const packageChoices = modelData.packages
          .filter((pkg) => !trim?.id || !pkg.availableTrims?.length || pkg.availableTrims.includes(trim.id))
          .slice(0, 8)
          .map((pkg) => ({
            id: pkg.code || pkg.id,
            label: pkg.name,
            insertText: pkg.code ? `${pkg.code} ${pkg.name}` : pkg.name,
          }));
        if (packageChoices.length) {
          missing.push({
            id: 'offer_packages',
            forIntent: SELLER_TURN_INTENTS.PREPARE_OFFER,
            label: 'Welche Pakete soll ich berücksichtigen?',
            field: 'equipmentWish',
            choices: packageChoices,
          });
        }
      }

      const hasMotor = facts.some((f) => (
        f.field === 'equipmentWish'
        && /kwh|kw|range|awd|motor/i.test(String(f.label || f.value?.label || ''))
      )) || Boolean(currentOfferContext?.engineLabel)
        || Boolean(workingContext?.attachedVehicle?.engineId);
      if (!hasMotor && modelData?.engines?.length && !pdfOfferComplete) {
        const matchingVariants = (modelData.variants || []).filter((v) => (
          !trim?.id || v.trimId === trim.id
        ));
        const engineIds = new Set(
          (matchingVariants.length ? matchingVariants : (modelData.variants || []))
            .map((v) => v.engineId)
            .filter(Boolean),
        );
        const engineChoices = (modelData.engines || [])
          .filter((e) => engineIds.size === 0 || engineIds.has(e.id))
          .slice(0, 6)
          .map((e) => ({
            id: e.id,
            label: e.name,
            insertText: e.name,
          }));
        if (engineChoices.length > 1) {
          missing.push({
            id: 'offer_motor',
            forIntent: SELLER_TURN_INTENTS.PREPARE_OFFER,
            label: 'Welche Motorisierung soll angeboten werden?',
            field: 'equipmentWish',
            choices: engineChoices,
          });
        }
      }
    }

    // Leasing-Kontext + Kaufpreis-Zahl → echte Ambiguity einmal nachfragen
    const purchasePrice = facts.find((f) => f.field === 'purchasePrice');
    const leadLeasing = String(lead?.paymentType || lead?.wish?.paymentType || profile?.paymentType || '')
      .toLowerCase()
      .includes('leasing');
    if (purchasePrice && leadLeasing) {
      missing.push({
        id: 'clarify_purchase_vs_leasing',
        forIntent: SELLER_TURN_INTENTS.PREPARE_OFFER,
        label: `Soll ich ein Kaufangebot über ${Number(purchasePrice.value).toLocaleString('de-DE')} € erstellen oder dienen die ${Number(purchasePrice.value).toLocaleString('de-DE')} € als Fahrzeugpreis für eine Leasingberechnung?`,
        field: 'paymentType',
      });
    }

    const hasRate = facts.some((f) => (
      f.field === 'desiredRate'
      || f.field === 'monthlyBudget'
      || f.field === 'monthlyLeasingRate'
    )) || currentOfferContext?.monthlyRate != null;
    const explicitCash = facts.some((f) => (
      f.field === 'paymentType' && /purchase|cash|kauf/i.test(String(f.value || ''))
    ));
    if (leadLeasing && !hasRate && !purchasePrice && !explicitCash) {
      missing.push({
        id: 'monthly_leasing_rate',
        forIntent: SELLER_TURN_INTENTS.PREPARE_OFFER,
        label: MONTHLY_RATE_CLARIFY_PROMPT,
        field: 'monthlyLeasingRate',
      });
    }
  }

  // „Monatsrate“ ohne Betrag → eine klare Rückfrage (auch ohne Lead-Leasing-Flag)
  if (
    isBareMonthlyRateCue(sellerInput)
    && !facts.some((f) => (
      f.field === 'desiredRate'
      || f.field === 'monthlyBudget'
      || f.field === 'monthlyLeasingRate'
    ))
    && !missing.some((m) => m.id === 'monthly_leasing_rate')
  ) {
    missing.push({
      id: 'monthly_leasing_rate',
      forIntent: SELLER_TURN_INTENTS.PREPARE_OFFER,
      label: MONTHLY_RATE_CLARIFY_PROMPT,
      field: 'monthlyLeasingRate',
    });
  }

  const ambiguousMoney = facts.find((f) => (
    f.field === 'monthlyBudget' && f.needsConfirmation
  ));
  if (ambiguousMoney) {
    missing.push({
      id: 'clarify_money',
      forIntent: SELLER_TURN_INTENTS.UPDATE_CUSTOMER_CONTEXT,
      label: `Sind die ${ambiguousMoney.value} € die gewünschte Monatsrate?`,
      field: 'monthlyBudget',
    });
  }

  return missing;
}
