/**
 * Result-Review nach bestätigtem Multi-Source Apply.
 */

/**
 * @param {object} applyResult – applyConfirmedMultiSourceIntakePlan result
 * @param {object} [intake]
 */
export function buildMultiSourceApplyResultReview(applyResult = {}, intake = null) {
  const src = intake || applyResult.intake || {};
  const leadId = applyResult.lead?.id || applyResult.createdIds?.leadId || null;
  const partial = Boolean(applyResult.partialFailure)
    || applyResult.status === 'partial'
    || applyResult.status === 'failed';
  const replay = applyResult.status === 'idempotent_replay';
  const needsChoice = Boolean(applyResult.needsSellerChoice);

  const summary = applyResult.summary || { applied: [], prepared: [], open: [] };
  const groups = [];

  if (needsChoice) {
    groups.push({
      id: 'choice',
      title: 'BITTE WÄHLEN',
      line: applyResult.needsSellerChoice?.reason || 'Mögliche Dublette',
      items: (applyResult.needsSellerChoice?.candidates || []).slice(0, 4).map((c) => ({
        label: c.customerName || c.leadId,
        tone: 'open',
      })),
    });
  }

  if (summary.applied?.length) {
    groups.push({
      id: 'applied',
      title: 'ÜBERNOMMEN',
      line: summary.applied.join(' · '),
      items: summary.applied.map((label) => ({ label })),
    });
  }
  if (summary.prepared?.length) {
    groups.push({
      id: 'prepared',
      title: 'VORBEREITET',
      line: summary.prepared.join(' · '),
      items: summary.prepared.map((label) => ({ label })),
    });
  }
  const openItems = [
    ...(summary.open || []),
    ...(applyResult.errors || []),
    ...((src.missingInformation || []).map((m) => m.label).filter(Boolean)),
  ];
  if (openItems.length || partial) {
    groups.push({
      id: 'open',
      title: partial ? 'TEILWEISE OFFEN' : 'NOCH OFFEN',
      line: openItems.slice(0, 4).join(' · ') || 'Bitte prüfen',
      items: openItems.slice(0, 6).map((label) => ({ label, tone: 'open' })),
    });
  }

  if ((applyResult.skippedDuplicates || []).length) {
    groups.push({
      id: 'skipped',
      title: 'BEREITS VORHANDEN',
      line: `${applyResult.skippedDuplicates.length} Dublette(n) übersprungen`,
      items: applyResult.skippedDuplicates.slice(0, 4).map((d) => ({
        label: [d.kind, d.id || d.vehicle || d.key].filter(Boolean).join(': '),
      })),
    });
  }

  const title = needsChoice
    ? '✨ Clever braucht eine Auswahl'
    : partial
      ? '✨ Clever hat den Vorgang teilweise angelegt'
      : replay
        ? '✨ Clever hat denselben Vorgang bereits angelegt'
        : '✨ Clever hat den Vorgang angelegt';

  const bodyLines = [
    groups.map((g) => `${g.title}\n${g.line}`).join('\n\n'),
    (applyResult.warnings || []).length
      ? `Hinweise\n${applyResult.warnings.join('\n')}`
      : null,
  ].filter(Boolean);

  const primaryActions = needsChoice
    ? (applyResult.needsSellerChoice?.candidates || []).slice(0, 4).map((c) => ({
      id: `pick_${c.leadId}`,
      label: c.customerName || 'Kunde wählen',
      action: 'accept_multi_source_intake',
      leadId: c.leadId,
    }))
    : [
      leadId ? {
        id: 'open_customer',
        label: 'Kundenakte öffnen',
        action: 'open_customer',
        leadId,
      } : null,
      leadId ? {
        id: 'create_ev4_offer',
        label: 'EV4-Angebot erstellen',
        action: 'prepare_ev4_offer',
        leadId,
      } : null,
      leadId ? {
        id: 'enrich_tradein',
        label: 'Inzahlungnahme ergänzen',
        action: 'enrich_trade_in',
        leadId,
      } : null,
    ].filter(Boolean);

  return {
    title,
    groups,
    body: bodyLines.join('\n\n'),
    summaryLine: [
      src.resolvedCustomerCandidate?.fullName,
      src.currentVehicleInterest?.model,
      partial ? 'teilweise' : (replay ? 'bereits übernommen' : 'angelegt'),
    ].filter(Boolean).join(' · '),
    missingLine: openItems[0] || null,
    primaryCta: needsChoice ? 'Kunde wählen' : 'Kundenakte öffnen',
    secondaryCta: 'Schließen',
    reviewType: 'multi_source_apply_result',
    kind: 'multi_source_apply_result',
    applyStatus: applyResult.status || null,
    partialFailure: partial,
    applyResult,
    actionSections: [{
      id: 'multi_source_apply_result',
      kind: 'multi_source_apply_result',
      title: 'Ergebnis',
      headline: title.replace(/^✨\s*/, ''),
      body: bodyLines.join('\n\n'),
      primaryActions,
      secondaryActions: [
        { id: 'dismiss', label: 'Schließen', action: 'discard' },
      ],
      leadId,
    }],
    factCount: groups.reduce((n, g) => n + (g.items?.length || 0), 0),
  };
}
