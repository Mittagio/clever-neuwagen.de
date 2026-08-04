/**
 * Gemeinsame Review für Multi-Source Intake (Dump + Altvertrag + Trade-in).
 */

/**
 * @param {object} intake – buildMultiSourceIntake result
 * @param {object} [turn]
 */
export function buildMultiSourceIntakeReviewModel(intake = {}, turn = {}) {
  if (!intake?.detected) return null;

  const groups = [];
  const c = intake.resolvedCustomerCandidate;
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

  const wish = intake.currentVehicleInterest;
  if (wish) {
    groups.push({
      id: 'wish',
      title: 'NEUER WUNSCH',
      line: wish.label || [wish.make, wish.model, wish.trim].filter(Boolean).join(' '),
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
    wish ? `NEUER WUNSCH\n${wish.label}` : null,
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
      headline: c?.fullName || wish?.label || 'Beratungsfall',
      body,
      primaryActions,
      secondaryActions: [
        { id: 'edit_values', label: 'Werte bearbeiten', action: 'dismiss' },
        { id: 'discard', label: 'Verwerfen', action: 'discard' },
      ],
      multiSourceIntake: intake,
    }],
    multiSourceIntake: intake,
    progressLines: turn.uiEffects?.progressLines || [
      '✓ Seller-Dump und Dokument zusammengeführt',
      c?.fullName ? `✓ Kunde: ${c.fullName}` : null,
      wish ? `✓ Wunsch: ${wish.label}` : null,
      trade ? `✓ Inzahlungnahme: ${trade.label}` : null,
      hist ? `✓ Altvertrag: ${hist.statusLabel || hist.contractTypeLabel || 'erkannt'}` : null,
      missing.length ? `○ ${missing.length} Punkte noch offen` : null,
    ].filter(Boolean),
    factCount: (turn.extractedFacts || []).length,
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
