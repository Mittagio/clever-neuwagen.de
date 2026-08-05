/**
 * Gemeinsame Review für Multi-Source Intake (Dump + Altvertrag + Trade-in).
 */
import {
  extractPersonNameFromDump,
  formatTradeInCaptureLabel,
  normalizeDumpPersonName,
} from './buildMultiSourceIntake.js';
import {
  buildMultiSourceProgressLines,
  formatWishLabel,
  hasMultiSourceDocumentContext,
} from './buildMultiSourceProgressLines.js';

/**
 * @param {object} intake – buildMultiSourceIntake result
 * @param {object} [turn]
 */
export function buildMultiSourceIntakeReviewModel(intake = {}, turn = {}) {
  if (!intake?.detected) return null;

  const groups = [];
  const c = resolveCustomerForReview(intake, turn);
  if (c?.fullName) {
    groups.push({
      id: 'customer',
      title: 'KUNDE',
      line: c.fullName,
      chips: [
        c.fullName,
        c.missingContact ? 'Kontakt offen' : null,
      ].filter(Boolean),
      items: [
        { label: c.fullName },
        c.missingContact ? { label: 'E-Mail/Telefon noch offen', tone: 'open' } : null,
      ].filter(Boolean),
    });
  }

  const wish = enrichWishForReview(intake.currentVehicleInterest, turn);
  const wishLabel = formatWishLabel(wish);
  if (wish) {
    const wishChips = [
      [wish.make, wish.model].filter(Boolean).join(' ') || null,
      wish.trim || null,
      wish.color || null,
      ...(wish.requestedEquipment || []),
    ].filter(Boolean);
    groups.push({
      id: 'wish',
      title: 'NEUER WUNSCH',
      line: wishLabel || wishChips.join(' · '),
      chips: wishChips,
      items: wishChips.map((label) => ({ label })),
    });
  }

  const commercial = intake.commercialScenario;
  if (commercial) {
    const commercialChips = [
      commercial.termMonths != null ? `${commercial.termMonths} Mon.` : null,
      commercial.annualMileage != null
        ? `${Number(commercial.annualMileage).toLocaleString('de-DE')} km/J`
        : null,
    ].filter(Boolean);
    groups.push({
      id: 'commercial',
      title: 'KONDITIONEN',
      line: commercial.label || commercialChips.join(' · '),
      chips: commercialChips.length ? commercialChips : [commercial.label].filter(Boolean),
      items: [
        commercial.termMonths != null ? { label: `${commercial.termMonths} Monate` } : null,
        commercial.annualMileage != null
          ? { label: `${Number(commercial.annualMileage).toLocaleString('de-DE')} km/Jahr` }
          : null,
      ].filter(Boolean),
    });
  }

  const household = intake.currentHouseholdFacts;
  if (household) {
    const householdChips = [
      household.childrenCount != null ? `${household.childrenCount} Kinder` : null,
      household.housingType === 'own_house' ? 'Haus' : null,
    ].filter(Boolean);
    groups.push({
      id: 'household',
      title: 'AKTUELL',
      line: household.label || householdChips.join(' · '),
      chips: householdChips,
      items: householdChips.map((label) => ({ label })),
    });
  }

  const trade = intake.tradeInCandidate;
  if (trade) {
    groups.push({
      id: 'tradein',
      title: 'INZAHLUNGNAHME',
      line: trade.label,
      chips: [trade.label].filter(Boolean),
      items: [{ label: trade.label }],
    });
  }

  const hist = intake.historicalContract;
  if (hist) {
    const histChips = [
      hist.contractTypeLabel || hist.contractKindLabel || hist.contractType || null,
      hist.vehicle || null,
      hist.monthlyRate != null ? `${formatMoney(hist.monthlyRate)}/Mon.` : null,
      hist.statusLabel || null,
    ].filter(Boolean);
    groups.push({
      id: 'contract',
      title: 'ALTVERTRAG',
      line: [
        hist.contractTypeLabel || hist.contractKindLabel || hist.contractType,
        hist.vehicle,
      ].filter(Boolean).join(' · '),
      chips: histChips,
      items: [
        hist.contractTypeLabel || hist.contractKindLabel
          ? { label: hist.contractTypeLabel || hist.contractKindLabel }
          : null,
        hist.vehicle ? { label: hist.vehicle } : null,
        hist.monthlyRate != null
          ? { label: `${formatMoney(hist.monthlyRate)} monatlich` }
          : null,
        hist.finalPayment != null
          ? { label: `${formatMoney(hist.finalPayment)} Schlussrate` }
          : null,
        hist.totalMileage != null || hist.annualMileage != null
          ? { label: `${Number(hist.totalMileage ?? hist.annualMileage).toLocaleString('de-DE')} km` }
          : null,
        hist.contractEndDate
          ? { label: `Vertragsende ${formatDeDate(hist.contractEndDate)}` }
          : null,
        hist.statusLabel ? { label: hist.statusLabel, tone: 'open' } : null,
      ].filter(Boolean),
    });
  }

  for (const conflict of intake.conflicts || []) {
    groups.push({
      id: `conflict-${conflict.id}`,
      title: 'ABWEICHUNG',
      line: conflict.label,
      chips: null,
      items: [{ label: conflict.label, tone: 'open' }],
    });
  }

  const missing = intake.missingInformation || [];
  if (missing.length) {
    groups.push({
      id: 'missing',
      title: 'NOCH OFFEN',
      line: missing.map((m) => m.label).join(' · '),
      chips: missing.slice(0, 3).map((m) => m.label),
      items: missing.map((m) => ({ label: m.label, tone: 'open' })),
    });
  }

  const tradeAction = (intake.preparedActions || []).find((a) => a.id === 'create_trade_in_candidate');
  const tradeCaptureLabel = formatTradeInCaptureLabel(trade)
    || tradeAction?.label
    || null;

  const otherPrepared = (intake.preparedActions || [])
    .filter((a) => a.id !== 'create_trade_in_candidate')
    .slice(0, 3)
    .map((a) => ({
      id: a.id,
      label: a.label,
      action: a.id,
      preparedActionId: a.id,
      tone: 'compact',
    }));

  const primaryActions = [
    {
      id: 'accept_all',
      label: 'Alles übernehmen',
      action: 'accept_multi_source_intake',
      tone: 'primary',
    },
    ...(trade || tradeAction ? [{
      id: tradeAction?.id || 'create_trade_in_candidate',
      label: tradeCaptureLabel || 'GW erfassen',
      action: tradeAction?.id || 'create_trade_in_candidate',
      preparedActionId: tradeAction?.id || 'create_trade_in_candidate',
      tone: 'secondary',
    }] : []),
    ...otherPrepared,
  ];

  // Body nur als Fallback behalten (z. B. Text-Export / ältere Surfaces ohne groups)
  const body = groups.length
    ? null
    : [
      c?.fullName ? `KUNDE\n${c.fullName}` : null,
      wishLabel ? `NEUER WUNSCH\n${wishLabel}` : null,
      trade ? `INZAHLUNGNAHME\n${trade.label}` : null,
    ].filter(Boolean).join('\n\n') || null;

  const reviewIntake = {
    ...intake,
    resolvedCustomerCandidate: c || intake.resolvedCustomerCandidate,
    currentVehicleInterest: wish || intake.currentVehicleInterest,
  };

  const progressLines = buildMultiSourceProgressLines(reviewIntake, {
    attachmentCount: Number(turn?.interpreterDiagnostics?.attachmentCount)
      || (intake.sources?.attachmentIds || []).length
      || 0,
    hasContractExtract: hasMultiSourceDocumentContext(intake, turn),
  });

  const heroName = c?.fullName || null;
  const isNewCustomerCandidate = Boolean(heroName && !turn?.resolvedCustomer?.id);

  return {
    title: 'Clever hat einen Beratungsfall erkannt',
    groups,
    body,
    hero: {
      name: heroName,
      eyebrow: isNewCustomerCandidate ? 'Neuer Kunde' : (heroName ? 'Kunde' : 'Beratungsfall'),
      subtitle: wishLabel || trade?.label || null,
    },
    summaryLine: [
      heroName,
      wish?.model,
      trade?.label ? `GW ${trade.label}` : null,
      hist ? 'Altvertrag' : null,
    ].filter(Boolean).join(' · '),
    missingLine: missing[0]?.label || (intake.conflicts?.[0]?.label) || null,
    primaryCta: 'Alles übernehmen',
    secondaryCta: tradeCaptureLabel || 'Werte bearbeiten',
    reviewType: 'customer_contract_tradein_intake_review',
    kind: 'multi_source_intake',
    compactUi: true,
    actionSections: [{
      id: 'customer_contract_tradein_intake_review',
      kind: 'customer_contract_tradein_intake_review',
      title: 'Beratungsfall',
      headline: heroName || wishLabel || 'Beratungsfall',
      body,
      primaryActions,
      secondaryActions: [
        { id: 'edit_values', label: 'Werte bearbeiten', action: 'dismiss', tone: 'compact' },
        { id: 'discard', label: 'Verwerfen', action: 'discard', tone: 'compact' },
      ],
      multiSourceIntake: reviewIntake,
    }],
    multiSourceIntake: reviewIntake,
    progressLines,
    factCount: groups.reduce((n, g) => n + (g.items?.length || 0), 0)
      || (turn.extractedFacts || []).length,
  };
}

function resolveCustomerForReview(intake, turn) {
  if (intake?.resolvedCustomerCandidate?.fullName) {
    return {
      ...intake.resolvedCustomerCandidate,
      fullName: normalizeDumpPersonName(intake.resolvedCustomerCandidate.fullName),
    };
  }

  const nameFact = (turn?.extractedFacts || turn?.sellerFacts || [])
    .find((f) => f.field === 'customerName');
  const fromFact = nameFact?.value || nameFact?.label || null;
  const sellerInput = turn?.sellerInput
    || turn?.interpretedInput?.normalized
    || turn?.interpretedInput?.raw
    || turn?.interpreted?.normalized
    || turn?.interpreted?.raw
    || '';
  const fromDump = extractPersonNameFromDump(sellerInput);
  const fullName = normalizeDumpPersonName(fromFact || fromDump || '');
  if (!fullName) return intake?.resolvedCustomerCandidate || null;

  return {
    fullName,
    missingContact: true,
    source: fromFact ? ['extracted_facts'] : ['seller_input'],
  };
}

function enrichWishForReview(wish, turn) {
  if (!wish && !(turn?.extractedFacts || []).length) return wish || null;
  const facts = turn?.extractedFacts || [];
  const ahkFact = facts.find((f) => f.field === 'towHitchRequired');
  const equipment = [
    ...(wish?.requestedEquipment || []),
    ...(ahkFact ? ['AHK'] : []),
  ].filter((v, i, arr) => v && arr.indexOf(v) === i);

  if (!wish) {
    const interest = facts.find((f) => f.field === 'vehicleInterest' || f.field === 'vehicleInterestMulti');
    if (!interest && !equipment.length) return null;
    return {
      make: 'Kia',
      model: interest?.value?.model || interest?.label || null,
      trim: interest?.value?.trim || null,
      color: facts.find((f) => f.field === 'colorPreference')?.value || null,
      requestedEquipment: equipment,
      label: [interest?.label, ...equipment].filter(Boolean).join(' · '),
    };
  }

  if (!equipment.length) return wish;
  return {
    ...wish,
    requestedEquipment: equipment,
    label: formatWishLabel({ ...wish, requestedEquipment: equipment }) || wish.label,
  };
}

function formatMoney(n) {
  return `${Number(n).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
}

function formatDeDate(iso) {
  const m = String(iso || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return iso;
  return `${m[3]}.${m[2]}.${m[1]}`;
}
