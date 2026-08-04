/**
 * Gemeinsame Review für Multi-Source Intake (Dump + Altvertrag + Trade-in).
 */
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
      items: [
        { label: c.fullName },
        c.missingContact ? { label: 'E-Mail/Telefon noch offen', tone: 'open' } : null,
      ].filter(Boolean),
    });
  }

  const wish = enrichWishForReview(intake.currentVehicleInterest, turn);
  const wishLabel = formatWishLabel(wish);
  if (wish) {
    groups.push({
      id: 'wish',
      title: 'NEUER WUNSCH',
      line: wishLabel || [wish.make, wish.model, wish.trim].filter(Boolean).join(' '),
      items: [
        { label: [wish.make, wish.model, wish.trim].filter(Boolean).join(' ') },
        wish.color ? { label: wish.color } : null,
        ...(wish.requestedEquipment || []).map((e) => ({ label: e })),
      ].filter(Boolean),
    });
  }

  const commercial = intake.commercialScenario;
  if (commercial) {
    groups.push({
      id: 'commercial',
      title: 'KONDITIONEN',
      line: commercial.label,
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
    groups.push({
      id: 'household',
      title: 'AKTUELL',
      line: household.label,
      items: [
        household.childrenCount != null ? { label: `${household.childrenCount} Kinder` } : null,
        household.housingType === 'own_house' ? { label: 'Eigenes Haus' } : null,
      ].filter(Boolean),
    });
  }

  const trade = intake.tradeInCandidate;
  if (trade) {
    groups.push({
      id: 'tradein',
      title: 'INZAHLUNGNAHME',
      line: trade.label,
      items: [{ label: trade.label }],
    });
  }

  const hist = intake.historicalContract;
  if (hist) {
    groups.push({
      id: 'contract',
      title: 'ALTVERTRAG',
      line: [
        hist.contractTypeLabel || hist.contractKindLabel || hist.contractType,
        hist.vehicle,
      ].filter(Boolean).join(' · '),
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
      items: [{ label: conflict.label, tone: 'open' }],
    });
  }

  const missing = intake.missingInformation || [];
  if (missing.length) {
    groups.push({
      id: 'missing',
      title: 'NOCH OFFEN',
      line: missing.map((m) => m.label).join(' · '),
      items: missing.map((m) => ({ label: m.label, tone: 'open' })),
    });
  }

  const primaryActions = [
    { id: 'accept_all', label: 'Alles übernehmen', action: 'accept_multi_source_intake' },
    ...(intake.preparedActions || []).slice(0, 4).map((a) => ({
      id: a.id,
      label: a.label,
      action: a.id,
      preparedActionId: a.id,
    })),
  ];

  const body = [
    c?.fullName ? `KUNDE\n${c.fullName}` : null,
    wishLabel ? `NEUER WUNSCH\n${wishLabel}` : null,
    commercial ? `KONDITIONEN\n${commercial.label}` : null,
    household ? `AKTUELL\n${household.label}` : null,
    trade ? `INZAHLUNGNAHME\n${trade.label}` : null,
    hist ? [
      'ALTVERTRAG',
      hist.contractTypeLabel || hist.contractKindLabel,
      hist.vehicle,
      hist.monthlyRate != null ? `${formatMoney(hist.monthlyRate)} monatlich` : null,
      hist.finalPayment != null ? `${formatMoney(hist.finalPayment)} Schlussrate` : null,
      hist.contractEndDate ? `Ende ${formatDeDate(hist.contractEndDate)}` : null,
      hist.statusLabel,
    ].filter(Boolean).join('\n') : null,
    (intake.conflicts || []).length
      ? `ABWEICHUNG\n${intake.conflicts.map((x) => x.label).join('\n')}`
      : null,
    missing.length
      ? `NOCH OFFEN\n${missing.map((m) => m.label).join('\n')}`
      : null,
  ].filter(Boolean).join('\n\n');

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

  return {
    title: '✨ Clever hat einen Beratungsfall erkannt',
    groups,
    body,
    summaryLine: [
      c?.fullName,
      wish?.model,
      trade?.label ? `GW ${trade.label}` : null,
      hist ? 'Altvertrag' : null,
    ].filter(Boolean).join(' · '),
    missingLine: missing[0]?.label || (intake.conflicts?.[0]?.label) || null,
    primaryCta: 'Alles übernehmen',
    secondaryCta: 'Werte bearbeiten',
    reviewType: 'customer_contract_tradein_intake_review',
    kind: 'multi_source_intake',
    actionSections: [{
      id: 'customer_contract_tradein_intake_review',
      kind: 'customer_contract_tradein_intake_review',
      title: 'Beratungsfall',
      headline: c?.fullName || wishLabel || 'Beratungsfall',
      body,
      primaryActions,
      secondaryActions: [
        { id: 'edit_values', label: 'Werte bearbeiten', action: 'dismiss' },
        { id: 'discard', label: 'Verwerfen', action: 'discard' },
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
  if (intake?.resolvedCustomerCandidate?.fullName) return intake.resolvedCustomerCandidate;
  const nameFact = (turn?.extractedFacts || []).find((f) => f.field === 'customerName');
  const fullName = nameFact?.value || nameFact?.label || null;
  if (!fullName) return intake?.resolvedCustomerCandidate || null;
  return {
    fullName: String(fullName).trim(),
    missingContact: true,
    source: ['extracted_facts'],
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
