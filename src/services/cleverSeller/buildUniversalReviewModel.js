/**
 * Review-Model für „Clever hat verstanden“ (Display only).
 */
import { SELLER_FACT_CLASS, SELLER_INPUT_MODE, SELLER_TURN_INTENTS } from './sellerFactTypes.js';
import { INLINE_RESULT_TYPES } from '../dealer/sellerInlineComposerAssist.js';
import { buildHomepageInquiryReviewModel } from '../crm/homepageCommercialInquiry.js';
import { buildInboundLeadReviewModel } from './inboundLeadIntake.js';
import { buildCustomerReplyReviewModel } from './customerReplyIntake.js';
import { buildMultiSourceIntakeReviewModel } from './multiSource/buildMultiSourceIntakeReview.js';
import { calendarAvailabilityLabel } from './checkCalendarAvailability.js';

const GROUP_ORDER = [
  { id: 'customer', title: 'Kunde', classes: [SELLER_FACT_CLASS.CUSTOMER_FACT] },
  {
    id: 'appointment',
    title: 'Termin',
    classes: [SELLER_FACT_CLASS.APPOINTMENT_FACT],
  },
  {
    id: 'wish',
    title: 'Interesse',
    classes: [
      SELLER_FACT_CLASS.VEHICLE_INTEREST,
      SELLER_FACT_CLASS.VEHICLE_REQUIREMENT,
      SELLER_FACT_CLASS.CUSTOMER_NEED,
    ],
  },
  {
    id: 'vehicle_current',
    title: 'Aktuelles Fahrzeug',
    classes: [SELLER_FACT_CLASS.EXISTING_VEHICLE, SELLER_FACT_CLASS.TRADE_IN_FACT],
  },
  {
    id: 'finance',
    title: 'Finanziell',
    classes: [SELLER_FACT_CLASS.SELF_DISCLOSURE_FACT, SELLER_FACT_CLASS.FINANCE_FACT, SELLER_FACT_CLASS.COMMERCIAL_PREFERENCE],
  },
  { id: 'contract', title: 'Vertrag', classes: [SELLER_FACT_CLASS.CONTRACT_FACT] },
  {
    id: 'offer',
    title: 'Angebot',
    classes: [SELLER_FACT_CLASS.OFFER_INSTRUCTION],
  },
  {
    id: 'other',
    title: 'Weiteres',
    classes: [
      SELLER_FACT_CLASS.DOCUMENT_FACT,
      SELLER_FACT_CLASS.SELLER_FACT,
      SELLER_FACT_CLASS.SELLER_NOTE,
      SELLER_FACT_CLASS.PROCESS_INSTRUCTION,
      SELLER_FACT_CLASS.MESSAGE_INSTRUCTION,
      SELLER_FACT_CLASS.VEHICLE_FACT_REQUEST,
    ],
  },
];

function formatKm(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return `${n.toLocaleString('de-DE')} km/Jahr`;
}

/**
 * Offer-Delta + Nachrichten-Entwurf aus Turn ableiten.
 * @param {object} turn
 */
export function buildUniversalActionSections(turn = {}) {
  const sections = [];
  const facts = turn.extractedFacts ?? [];
  const offerCtx = turn.currentOfferContext
    || turn.relevantCustomerContext?.currentOffer
    || null;
  const prepared = turn.preparedActions ?? [];

  const todayAction = prepared.find((a) => a.type === SELLER_TURN_INTENTS.GET_TODAY_OVERVIEW);
  const todayOverview = turn.todayOverview || todayAction?.payload?.todayOverview;
  if (todayOverview) {
    const items = Array.isArray(todayOverview.items) ? todayOverview.items : [];
    const successionItem = items.find((i) => (
      i.actionId === 'prepare_succession_offer'
      || i.composerAction === 'prepare_followup_offer'
    ));
    sections.push({
      id: 'today_overview',
      kind: 'today_overview',
      title: 'Heute wichtig',
      headline: items.length
        ? `${items.length} Vorgang${items.length === 1 ? '' : 'e'} heute`
        : 'Keine fälligen Vorgänge',
      line: items.slice(0, 3).map((i) => i.customerName).filter(Boolean).join(' · ') || null,
      items: items.map((item) => ({
        leadId: item.leadId,
        customerName: item.customerName,
        headline: item.headline,
        detail: item.detail,
        reasons: item.reasons || [],
        overdue: item.overdue,
        dueToday: item.dueToday,
        actionId: item.actionId || null,
        composerAction: item.composerAction || null,
        primaryCtaLabel: item.primaryCtaLabel || null,
      })),
      primaryActions: successionItem?.leadId
        ? [
          {
            id: 'prepare_followup_offer',
            label: successionItem.primaryCtaLabel || 'Nachfolgeangebot vorbereiten',
            leadId: successionItem.leadId,
            action: 'prepare_followup_offer',
          },
          {
            id: 'open_first',
            label: `${successionItem.customerName} öffnen`,
            leadId: successionItem.leadId,
          },
        ]
        : (items[0]?.leadId
          ? [
            { id: 'open_first', label: `${items[0].customerName} öffnen`, leadId: items[0].leadId },
            { id: 'show_list', label: 'Tagesliste anzeigen' },
          ]
          : [{ id: 'show_list', label: 'Tagesliste anzeigen' }]),
    });
  }

  const knowledge = turn.knowledgeResult
    || prepared.find((a) => a.type === SELLER_TURN_INTENTS.LOOKUP_VEHICLE_FACT)?.payload?.knowledgeResult;
  if (knowledge) {
    const modelLabel = knowledge.modelLabel
      || (knowledge.modelKey ? `Kia ${knowledge.modelKey}` : 'Fahrzeug');
    const factLines = Array.isArray(knowledge.facts) && knowledge.facts.length
      ? knowledge.facts.map((f) => `${f.label}: ${f.value}`).join('\n')
      : null;
    const advisoryBody = knowledge.body || knowledge.message || null;
    // body enthält bei Advisory oft schon die Facts – nicht doppelt anhängen
    const okBody = advisoryBody
      || factLines
      || null;
    sections.push({
      id: 'knowledge_result',
      kind: 'knowledge_result',
      title: knowledge.status === 'advisory'
        ? (knowledge.factLabel || modelLabel)
        : `${modelLabel} · ${knowledge.factLabel || 'Fakt'}`,
      headline: knowledge.ok
        ? (knowledge.displayValue || knowledge.factLabel || 'Antwort')
        : (knowledge.message || 'Nicht verifiziert'),
      line: knowledge.sourceLabel || null,
      body: knowledge.ok
        ? okBody
        : (knowledge.message || 'Diesen Wert habe ich noch nicht eindeutig verifiziert.'),
      knowledgeResult: knowledge,
      primaryActions: [{ id: 'more_details', label: 'Mehr Details' }],
    });
  }

  const customerSearchAction = prepared.find((a) => (
    a.type === SELLER_TURN_INTENTS.FIND_CUSTOMER
    || a.type === SELLER_TURN_INTENTS.OPEN_CUSTOMER
    || a.type === SELLER_TURN_INTENTS.CUSTOMER_LOOKUP
  ));
  const customerSearch = customerSearchAction
    ? (turn.customerSearchResults || customerSearchAction.payload?.customerSearchResults)
    : null;
  if (Array.isArray(customerSearch) && customerSearch.length && !turn.customerSummary) {
    const unique = customerSearch.length === 1;
    const top = customerSearch[0];
    sections.push({
      id: 'customer_search_results',
      kind: 'customer_search_results',
      title: unique ? 'Kunde gefunden' : 'Mehrere Kunden gefunden',
      headline: unique
        ? (top.customerName || 'Kunde')
        : `${customerSearch.length} Treffer`,
      line: null,
      body: null,
      results: customerSearch.map((r) => ({
        leadId: r.leadId || r.customerId,
        customerName: r.customerName,
        vehicleLabel: null,
        matchReason: null,
        matchReasons: [],
        card: r.card || null,
      })),
      primaryActions: customerSearch.slice(0, 4).map((r) => ({
        id: `open-${r.leadId || r.customerId}`,
        label: `${r.customerName || 'Kunde'} öffnen`,
        leadId: r.leadId || r.customerId,
        action: 'open_customer',
      })),
    });
  }

  const summary = turn.customerSummary
    || prepared.find((a) => a.type === SELLER_TURN_INTENTS.SUMMARIZE_CUSTOMER_CONTEXT)
      ?.payload?.customerSummary;
  if (summary) {
    sections.push({
      id: 'customer_summary',
      kind: 'customer_summary',
      title: summary.customerName || 'Kundenkontext',
      headline: summary.favorite || summary.paymentLabel || null,
      body: (summary.lines || []).join('\n'),
      line: summary.important?.length
        ? `Wichtig: ${summary.important.join(' · ')}`
        : null,
      summary,
      primaryActions: [
        {
          id: 'open_customer',
          label: 'Kundenakte öffnen',
          leadId: summary.customerId,
          action: 'open_customer',
        },
      ],
    });
  }

  const historyResults = turn.historySearchResults
    || prepared.find((a) => (
      a.type === SELLER_TURN_INTENTS.SEARCH_CUSTOMER_HISTORY
      || a.type === SELLER_TURN_INTENTS.SEARCH_CUSTOMER_MESSAGES
      || a.type === SELLER_TURN_INTENTS.SEARCH_CUSTOMER_OFFERS
      || a.type === SELLER_TURN_INTENTS.SEARCH_CUSTOMER_ACTIVITIES
    ))?.payload?.historySearchResults;

  if (Array.isArray(historyResults)) {
    const offerHistory = historyResults.some((h) => (
      h.sourceType === 'offer_event' || h.kind === 'offer_event'
    ));
    if (!historyResults.length) {
      sections.push({
        id: 'no_search_result',
        kind: 'no_search_result',
        title: 'Nichts gefunden',
        headline: 'Keine Treffer in der Historie',
        body: prepared.find((a) => a.payload?.message)?.payload?.message
          || 'Ich habe dazu in der Kundenhistorie nichts gefunden.',
      });
    } else if (offerHistory && historyResults[0]?.sourceType === 'offer_event') {
      const top = historyResults[0];
      sections.push({
        id: 'offer_history_result',
        kind: 'offer_history_result',
        title: 'Angebot gefunden',
        headline: top.whenLabel || top.title,
        body: [
          top.vehicleLabel ? `Fahrzeug: ${top.vehicleLabel}` : null,
          top.version ? `Version: ${top.version}` : null,
          top.sourceLabel ? `Quelle: ${top.sourceLabel}` : null,
        ].filter(Boolean).join('\n'),
        line: top.matchedText || null,
        hit: top,
        results: historyResults,
        primaryActions: top.offerId
          ? [{
            id: 'open_offer',
            label: 'Angebot öffnen',
            leadId: top.customerId,
            offerId: top.offerId,
            action: 'open_offer',
          }]
          : [],
      });
    } else {
      const top = historyResults[0];
      sections.push({
        id: 'history_search_results',
        kind: 'history_search_results',
        title: historyResults.length === 1 ? 'Gefunden' : `${historyResults.length} Treffer`,
        headline: top.whenLabel || top.title || 'Treffer',
        body: top.matchedText || top.snippet || null,
        line: top.sourceLabel ? `Quelle: ${top.sourceLabel}` : null,
        hit: top,
        results: historyResults,
        hitCount: historyResults.length,
        primaryActions: [
          top.messageId || top.sourceId
            ? {
              id: 'open_history',
              label: 'Im Verlauf öffnen',
              leadId: top.customerId,
              messageId: top.messageId || top.sourceId,
              action: 'open_history',
            }
            : null,
        ].filter(Boolean),
      });
    }
  }

  const offerUpdate = prepared.find((a) => (
    a.type === SELLER_TURN_INTENTS.PREPARE_OFFER
    && a.status === 'prepared'
    && a.payload?.updateOnly
  ));
  const commercialFacts = facts.filter(
    (f) => f.factClass === SELLER_FACT_CLASS.COMMERCIAL_PREFERENCE,
  );

  if (offerCtx && (offerUpdate || commercialFacts.length)) {
    const changes = [];
    const mileageFact = commercialFacts.find((f) => f.field === 'annualMileage');
    const termFact = commercialFacts.find((f) => (
      f.field === 'termMonths' || f.field === 'durationMonths'
    ));
    const rateFact = commercialFacts.find((f) => (
      f.field === 'monthlyBudget' || f.field === 'desiredRate'
    ));
    const downFact = commercialFacts.find((f) => f.field === 'downPayment');

    if (mileageFact && offerCtx.mileagePerYear != null) {
      changes.push({
        id: 'mileage',
        label: 'Fahrleistung',
        from: formatKm(offerCtx.mileagePerYear),
        to: formatKm(mileageFact.value) || mileageFact.label,
      });
    } else if (mileageFact) {
      changes.push({
        id: 'mileage',
        label: 'Fahrleistung',
        from: null,
        to: formatKm(mileageFact.value) || mileageFact.label,
      });
    }

    if (termFact && offerCtx.termMonths != null) {
      changes.push({
        id: 'term',
        label: 'Laufzeit',
        from: `${offerCtx.termMonths} Monate`,
        to: termFact.value != null ? `${termFact.value} Monate` : termFact.label,
      });
    }

    if (rateFact) {
      changes.push({
        id: 'rate',
        label: 'Rate',
        from: offerCtx.monthlyRate != null
          ? `${Number(offerCtx.monthlyRate).toLocaleString('de-DE')} €/Monat`
          : null,
        to: rateFact.label,
      });
    }

    if (downFact) {
      changes.push({
        id: 'down',
        label: 'Sonderzahlung',
        from: null,
        to: downFact.label,
      });
    }

    if (!changes.length && commercialFacts.length) {
      changes.push({
        id: 'commercial',
        label: 'Konditionen',
        from: offerCtx.summary || null,
        to: commercialFacts.map((f) => f.label).join(' · '),
      });
    }

    if (changes.length) {
      sections.push({
        id: 'offer_change',
        kind: 'offer_change',
        title: 'Angebot',
        headline: offerCtx.title || offerCtx.summary || 'Aktives Angebot',
        changes,
        line: changes
          .map((c) => (c.from && c.to ? `${c.from} → ${c.to}` : c.to))
          .filter(Boolean)
          .join(' · '),
      });
    }
  }

  const docsActionEarly = prepared.find((a) => (
    a.type === SELLER_TURN_INTENTS.REQUEST_DOCUMENTS && a.status === 'prepared'
  ));
  const docsPackageBody = docsActionEarly?.payload?.messageDraft
    || docsActionEarly?.legacy?.body
    || null;

  const draftAction = prepared.find((a) => (
    a.type === SELLER_TURN_INTENTS.DRAFT_MESSAGE && a.status === 'prepared'
  ));
  const draftResult = draftAction?.legacy?.results?.find(
    (r) => r.type === INLINE_RESULT_TYPES.MESSAGE_DRAFT,
  ) || draftAction?.legacy?.results?.[0] || null;
  const draftBody = turn.messageDraft
    || draftAction?.payload?.messageDraft
    || draftResult?.draft?.body
    || draftResult?.body
    || null;
  const interimOnly = Boolean(draftAction?.payload?.interimOnly);
  const draftCoveredByDocs = Boolean(
    docsActionEarly
    && docsPackageBody
    && draftBody
    && String(draftBody).trim() === String(docsPackageBody).trim(),
  );
  if (draftBody && !interimOnly && !draftCoveredByDocs) {
    sections.push({
      id: 'message_draft',
      kind: 'message_draft',
      title: 'Nachricht',
      body: String(draftBody).trim(),
    });
  } else if (draftBody && interimOnly) {
    sections.push({
      id: 'message_interim',
      kind: 'message_interim',
      title: 'Zwischenentwurf (optional)',
      body: String(draftBody).trim(),
    });
  }

  const docsAction = docsActionEarly;
  if (docsAction) {
    const pkg = docsAction.legacy || docsAction.payload?.workspacePackage || {};
    const slots = Array.isArray(docsAction.payload?.slots)
      ? docsAction.payload.slots
      : (pkg.slots || []);
    const complete = Boolean(docsAction.payload?.complete) || slots.length === 0;
    const sellerSummary = docsAction.payload?.sellerSummary
      || pkg.sellerSummary
      || null;
    const messageBody = docsAction.payload?.messageDraft
      || pkg.body
      || null;
    const missingLabels = (docsAction.payload?.missingLabels
      || slots.map((s) => s.label).filter(Boolean));
    sections.push({
      id: 'request_documents',
      kind: 'request_documents',
      title: complete ? 'Unterlagen vollständig' : 'Fehlende Unterlagen',
      headline: sellerSummary || (complete
        ? 'Alles erledigt'
        : `${slots.length} Unterlage${slots.length === 1 ? '' : 'n'} offen`),
      line: missingLabels.length ? missingLabels.join(' · ') : null,
      body: [
        sellerSummary,
        messageBody ? `\n${String(messageBody).trim()}` : null,
      ].filter(Boolean).join('\n').trim() || sellerSummary,
      slots,
      messageDraft: messageBody,
      sellerSummary,
      complete,
      primaryActions: complete
        ? []
        : [
          {
            id: 'send_upload_link',
            label: docsAction.payload?.ctaLabel || 'Sicheren Upload-Link senden',
            leadId: turn.resolvedCustomer?.id || null,
            action: 'send_documents_package',
          },
          {
            id: 'edit_documents_message',
            label: 'Nachricht bearbeiten',
            leadId: turn.resolvedCustomer?.id || null,
            action: 'edit_message',
          },
          {
            id: 'discard_documents',
            label: 'Verwerfen',
            action: 'discard',
          },
        ],
    });
  }

  const offerPrep = prepared.find((a) => (
    a.type === SELLER_TURN_INTENTS.PREPARE_OFFER
    && a.status === 'prepared'
    && !a.payload?.updateOnly
  ));
  const offerBlockedIncomplete = !offerPrep && prepared.find((a) => (
    a.type === SELLER_TURN_INTENTS.PREPARE_OFFER
    && a.status === 'blocked'
    && !a.payload?.updateOnly
    && (
      a.payload?.canCreateOffer === false
      || a.payload?.missingRate
      || (turn.missingInformation || []).some((m) => m.id === 'monthly_leasing_rate')
    )
    && !(
      a.payload?.needsClarification
      || (turn.missingInformation || []).some((m) => m.id === 'clarify_purchase_vs_leasing')
    )
  ));
  const offerClarify = !offerPrep && !offerBlockedIncomplete && prepared.find((a) => (
    a.type === SELLER_TURN_INTENTS.PREPARE_OFFER
    && a.status === 'blocked'
    && (
      a.payload?.needsClarification
      || (turn.missingInformation || []).some((m) => m.id === 'clarify_purchase_vs_leasing')
    )
  ));
  const offerSectionSource = offerPrep || offerBlockedIncomplete;
  if (offerSectionSource && !sections.some((s) => s.kind === 'offer_change')) {
    const purchase = facts.find((f) => f.field === 'purchasePrice');
    const vehicle = facts.find((f) => f.field === 'vehicleInterest');
    const discount = facts.find((f) => f.field === 'discountPercent');
    const incomplete = offerSectionSource.payload?.canCreateOffer === false
      || offerSectionSource.payload?.missingRate
      || (turn.missingInformation || []).some((m) => m.id === 'monthly_leasing_rate')
      || offerSectionSource.status === 'blocked';
    const wish = turn.usedCustomerContext || {};
    const inherited = [
      wish.termMonths != null ? `${wish.termMonths} Monate` : null,
      wish.annualMileage != null || wish.mileagePerYear != null
        ? `${Number(wish.annualMileage ?? wish.mileagePerYear).toLocaleString('de-DE')} km/Jahr`
        : null,
      wish.downPayment != null ? `${Number(wish.downPayment) === 0 ? '0 €' : `${Number(wish.downPayment).toLocaleString('de-DE')} €`} AZ` : null,
    ].filter(Boolean);
    const lineParts = [];
    if (discount?.label) lineParts.push(discount.label);
    if (offerSectionSource.payload?.listPrice != null) {
      lineParts.push(`UPE ${Number(offerSectionSource.payload.listPrice).toLocaleString('de-DE')} €`);
    }
    if (incomplete) {
      lineParts.push('Noch offen: Leasingrate / Bank-PDF');
    } else if (purchase?.label) {
      lineParts.push(purchase.label);
    } else if (offerSectionSource.payload?.monthlyRate != null) {
      lineParts.push(`${Number(offerSectionSource.payload.monthlyRate).toLocaleString('de-DE')} €/Monat`);
    }
    sections.unshift({
      id: 'offer_prepare',
      kind: incomplete ? 'offer_incomplete' : 'offer_prepare',
      title: incomplete ? 'Angebot prüfen' : 'Angebot',
      headline: offerSectionSource.payload?.vehicleLabel || vehicle?.label || 'Kaufangebot',
      line: lineParts.join(' · ') || (incomplete ? 'Angebot unvollständig' : 'Angebot vorbereitet'),
      inheritedLine: inherited.length ? `Übernommen: ${inherited.join(' · ')}` : null,
      changes: [
        purchase ? {
          id: 'price',
          label: 'Kaufpreis',
          from: null,
          to: purchase.label,
        } : null,
        discount ? {
          id: 'discount',
          label: 'Rabatt',
          from: null,
          to: discount.label,
        } : null,
      ].filter(Boolean),
      primaryActions: incomplete
        ? [
          { id: 'upload_pdf', label: 'PDF hochladen' },
          { id: 'enter_rate', label: 'Monatsrate eingeben' },
          { id: 'calc_cash', label: 'Als Barkauf berechnen' },
        ]
        : null,
    });
  } else if (offerClarify && !sections.some((s) => s.kind === 'offer_change')) {
    const purchase = facts.find((f) => f.field === 'purchasePrice');
    const vehicle = facts.find((f) => f.field === 'vehicleInterest');
    const clarify = (turn.missingInformation || []).find((m) => m.id === 'clarify_purchase_vs_leasing');
    sections.unshift({
      id: 'offer_prepare',
      kind: 'offer_incomplete',
      title: 'Angebot – Klärung nötig',
      headline: vehicle?.label || offerClarify.payload?.vehicleLabel || 'Angebot',
      line: purchase?.label
        || (purchase?.value != null
          ? `Kaufpreis: ${Number(purchase.value).toLocaleString('de-DE')} €`
          : null)
        || 'Kauf vs. Leasing klären',
      body: clarify?.label || null,
      needsClarification: true,
      primaryActions: [
        { id: 'clarify_cash', label: 'Als Kaufangebot' },
        { id: 'clarify_leasing', label: 'Als Leasingpreis' },
      ],
    });
  }

  const appointmentAction = prepared.find((a) => (
    a.type === SELLER_TURN_INTENTS.PROPOSE_APPOINTMENT && a.status === 'prepared'
  ));
  const appointmentFact = facts.find((f) => f.factClass === SELLER_FACT_CLASS.APPOINTMENT_FACT);
  if (appointmentAction || appointmentFact) {
    const preparedAppt = appointmentAction?.payload?.preparedAppointment || null;
    const appt = preparedAppt
      || appointmentAction?.legacy?.appointment
      || appointmentAction?.legacy?.results?.[0]?.appointment
      || null;
    const whenLabel = preparedAppt?.whenLabel
      || [preparedAppt?.dateLabel, preparedAppt?.timeLabel].filter(Boolean).join(' · ')
      || appointmentFact?.label
      || (appt
        ? [appt.typeLabel, appt.whenLabel, appt.timeLabel].filter(Boolean).join(' · ')
        : 'Termin vorbereitet');
    sections.push({
      id: 'appointment_propose',
      kind: 'appointment_propose',
      title: 'Terminvorschlag',
      headline: whenLabel,
      line: preparedAppt?.vehicleContext?.label
        || appt?.vehicleLabel
        || appt?.vehicleContext
        || turn.resolvedCustomer?.name
        || null,
      body: appointmentAction?.payload?.messageDraft
        || appointmentAction?.legacy?.results?.[0]?.draft?.body
        || appointmentAction?.legacy?.messageDraft
        || null,
      preparedAppointment: preparedAppt,
      availabilityStatus: appointmentAction?.payload?.availabilityStatus || 'not_checked',
    });
  }

  const contractImportAction = prepared.find((a) => (
    a.type === SELLER_TURN_INTENTS.IMPORT_CUSTOMER_CONTRACT
    && (a.status === 'prepared' || a.status === 'blocked')
  ));
  if (contractImportAction?.payload?.contractDraft || turn.contractDraft) {
    const draft = contractImportAction?.payload?.contractDraft || turn.contractDraft;
    sections.push({
      id: 'contract_import',
      kind: 'contract_import',
      title: 'Vertrag erkannt',
      headline: draft?.vehicle?.label || draft?.contractType || 'Altvertrag',
      line: draft?.contractEndDate
        ? `Ende ${draft.contractEndDate}`
        : null,
      body: contractImportAction?.payload?.reviewBody || null,
      contractDraft: draft,
      missingInformation: contractImportAction?.payload?.missingInformation || [],
      evidence: contractImportAction?.payload?.evidence || turn.evidence || [],
    });
  }

  const contractSearchAction = prepared.find((a) => (
    a.type === SELLER_TURN_INTENTS.SEARCH_CUSTOMER_CONTRACTS
  ));
  if (contractSearchAction || turn.contractMemoryResult) {
    const result = contractSearchAction?.payload?.contractMemoryResult
      || turn.contractMemoryResult
      || null;
    const status = contractSearchAction?.payload?.status || (result ? 'found' : 'no_contract');
    sections.push({
      id: 'contract_memory_result',
      kind: 'contract_memory_result',
      title: status === 'found' || status === 'projection_only'
        ? 'Vertrag'
        : (status === 'no_contract' ? 'Kein Vertrag' : 'Vertrag nachschlagen'),
      headline: result?.customerName
        ? `Vertrag ${result.customerName}`
        : (contractSearchAction?.payload?.message || 'Altvertrag'),
      line: result?.answerLabel && result?.answerValue
        ? `${result.answerLabel}: ${result.answerValue}`
        : null,
      body: result?.body || contractSearchAction?.payload?.message || null,
      contractMemoryResult: result,
      status,
      evidence: result?.evidence || [],
      primaryActions: result?.contractId || result?.customerId
        ? [
          {
            id: 'open_contract',
            label: 'Vertrag öffnen',
            leadId: result.customerId || null,
            contractId: result.contractId || null,
            action: 'open_contract',
          },
          {
            id: 'prepare_followup_offer',
            label: 'Nachfolgeangebot vorbereiten',
            leadId: result.customerId || null,
            action: 'prepare_followup_offer',
          },
        ]
        : [
          {
            id: 'discard',
            label: 'Verwerfen',
            action: 'discard',
          },
        ],
    });
  }

  const contractCompareAction = prepared.find((a) => (
    a.type === SELLER_TURN_INTENTS.COMPARE_CONTRACT_WITH_OFFER
  ));
  if (contractCompareAction || turn.contractOfferCompareResult) {
    const result = contractCompareAction?.payload?.contractOfferCompareResult
      || turn.contractOfferCompareResult
      || null;
    const status = contractCompareAction?.payload?.status || (result ? 'compared' : 'no_contract');
    const rateRow = result?.rows?.find((r) => r.field === 'monthlyRate');
    sections.push({
      id: 'contract_offer_compare_result',
      kind: 'contract_offer_compare_result',
      title: status === 'compared'
        ? 'Vergleich'
        : (status === 'no_offer'
          ? 'Kein Angebot'
          : (status === 'no_contract' ? 'Kein Vertrag' : 'Vertragsvergleich')),
      headline: result?.customerName
        ? `Vergleich ${result.customerName}`
        : (contractCompareAction?.payload?.message || 'Vertrag ↔ Angebot'),
      line: rateRow?.status === 'changed'
        ? `Rate ${rateRow.contractDisplay} → ${rateRow.offerDisplay}`
        : (rateRow?.status === 'same'
          ? `Rate ${rateRow.contractDisplay} (gleich)`
          : null),
      body: result?.body || contractCompareAction?.payload?.message || null,
      contractOfferCompareResult: result,
      status,
      evidence: result?.evidence || [],
      primaryActions: result?.contractId || result?.customerId
        ? [
          {
            id: 'open_contract',
            label: 'Vertrag öffnen',
            leadId: result.customerId || null,
            contractId: result.contractId || null,
            action: 'open_contract',
          },
          {
            id: 'prepare_followup_offer',
            label: 'Nachfolgeangebot vorbereiten',
            leadId: result.customerId || null,
            action: 'prepare_followup_offer',
          },
          {
            id: 'discard',
            label: 'Verwerfen',
            action: 'discard',
          },
        ]
        : [
          {
            id: 'discard',
            label: 'Verwerfen',
            action: 'discard',
          },
        ],
    });
  }

  const historyAction = prepared.find((a) => (
    a.type === SELLER_TURN_INTENTS.SEARCH_CUSTOMER_HISTORY
    || a.type === SELLER_TURN_INTENTS.SEARCH_CUSTOMER_MESSAGES
  ));
  // Legacy INLINE_RESULT shape nur wenn noch keine history_search_results Section
  if (historyAction && !sections.some((s) => (
    s.kind === 'history_search_results'
    || s.kind === 'offer_history_result'
    || s.kind === 'no_search_result'
  ))) {
    const legacyHits = historyAction.legacy?.results ?? [];
    const top = legacyHits[0] || null;
    const inlineHits = top?.hits || [];
    sections.push({
      id: 'history_search',
      kind: 'history_search',
      title: inlineHits.length || legacyHits.length ? '✨ Gefunden' : 'Verlauf',
      headline: top?.whenLabel || top?.title || (legacyHits.length ? `${legacyHits.length} Treffer` : 'Kein Treffer'),
      body: top?.snippet || top?.body || top?.preview || null,
      line: legacyHits.length > 1 ? `${legacyHits.length} Treffer im Verlauf` : null,
      hit: top,
      hitCount: legacyHits.length,
    });
  }

  const nextStep = prepared.find((a) => a.type === SELLER_TURN_INTENTS.RECOMMEND_NEXT_STEP);
  const moment = nextStep?.payload?.goldenMoment || turn.goldenMoment || null;
  if (moment && (nextStep || !sections.some((s) => s.kind === 'track_feedback'))) {
    const successionCta = moment.recommendedAction === 'prepare_succession_offer'
      || moment.type === 'contract_succession_follow_up';
    sections.push({
      id: 'golden_moment',
      kind: 'golden_moment',
      title: '✨ Clever',
      headline: moment.headline || moment.primaryLabel || 'Nächster Schritt',
      body: [moment.body, ...(moment.bodyLines || []).slice(1)].filter(Boolean).join('\n')
        || (moment.reasons || []).join('\n'),
      line: (moment.reasons || []).slice(0, 3).join(' · ') || null,
      primaryLabel: moment.primaryLabel || 'Angebot anpassen',
      recommendedAction: moment.recommendedAction || null,
      vehicleTrackId: moment.vehicleTrackId || null,
      primaryActions: successionCta
        ? [
          {
            id: 'prepare_followup_offer',
            label: moment.primaryLabel || 'Nachfolgeangebot vorbereiten',
            leadId: moment.customerId || turn.resolvedCustomer?.id || null,
            action: 'prepare_followup_offer',
          },
          {
            id: 'open_contract',
            label: 'Vertrag öffnen',
            leadId: moment.customerId || turn.resolvedCustomer?.id || null,
            contractId: moment.contractId || null,
            action: 'open_contract',
          },
        ]
        : null,
    });
  }

  const trackFacts = facts.filter((f) => f.field === 'vehicleTrackFeedback' && f.label);
  if (trackFacts.length) {
    const deferred = trackFacts.filter((f) => f.value?.status === 'deferred');
    const favorites = trackFacts.filter((f) => f.value?.status === 'favorite');
    const wishFacts = facts.filter((f) => (
      f.field === 'towHitchRequired'
      || f.field === 'colorPreference'
      || f.field === 'deliveryTimeImportance'
      || (f.factClass === SELLER_FACT_CLASS.CUSTOMER_NEED && /lieferzeit|ahk|rot/i.test(f.label || ''))
      || (f.factClass === SELLER_FACT_CLASS.VEHICLE_REQUIREMENT)
    ));
    const revise = prepared.find((a) => a.payload?.reviseFavoriteOffer);
    sections.push({
      id: 'track_feedback',
      kind: 'track_feedback',
      title: 'Fahrzeugspuren',
      headline: [
        ...deferred.map((f) => `${f.label} · zurückgestellt`),
        ...favorites.map((f) => `${f.label}`),
      ].join(' · ') || trackFacts.map((f) => f.label).join(' · '),
      line: wishFacts.length
        ? `Neue Wünsche: ${wishFacts.map((f) => f.label).join(' · ')}`
        : null,
      changes: [
        ...deferred.map((f) => ({
          id: `def-${f.value?.modelKey || f.label}`,
          label: f.value?.modelKey || 'Fahrzeug',
          from: null,
          to: 'zurückgestellt · zu teuer',
        })),
        ...favorites.map((f) => ({
          id: `fav-${f.value?.modelKey || f.label}`,
          label: f.value?.modelKey || 'Fahrzeug',
          from: null,
          to: 'Favorit',
        })),
      ],
      body: wishFacts.length
        ? `Neue Wünsche: ${wishFacts.map((f) => f.label).join(' · ')}`
        : null,
      reviseOfferLabel: revise?.label || null,
    });
  }

  return sections;
}

/**
 * @param {object} turn – CleverSellerTurnResult
 */
export function buildUniversalReviewModel(turn = {}) {
  if (turn.customerReply?.detected) {
    return buildCustomerReplyReviewModel(turn.customerReply, turn);
  }

  if (turn.inboundLead?.detected) {
    return buildInboundLeadReviewModel(turn.inboundLead, turn);
  }

  if (turn.multiSourceIntake?.detected) {
    return buildMultiSourceIntakeReviewModel(turn.multiSourceIntake, turn);
  }

  if (turn.homepageInquiry?.hasDualScenarios) {
    return buildHomepageInquiryReviewModel(turn.homepageInquiry);
  }

  const scenarioFact = (turn.extractedFacts ?? []).find((f) => f.field === 'commercialScenarios');
  if (scenarioFact && Array.isArray(scenarioFact.value) && scenarioFact.value.length >= 2) {
    const fromFacts = buildHomepageInquiryReviewModel({
      model: (turn.extractedFacts ?? []).find((f) => f.field === 'vehicleInterest')?.label
        || turn.extractedFacts?.find((f) => f.field === 'vehicleInterest')?.value?.model
        || null,
      configurationAttached: (turn.extractedFacts ?? []).some((f) => f.field === 'configurationAttached'),
      customerType: (turn.extractedFacts ?? []).find((f) => f.field === 'customerType')?.value || 'private',
      commercialScenarios: scenarioFact.value,
      openQuestions: (turn.extractedFacts ?? [])
        .filter((f) => f.field === 'deliveryTime')
        .map((f) => ({
          id: 'delivery_time',
          field: 'deliveryTime',
          label: f.label || 'Lieferzeit beantworten',
        })),
      hasDualScenarios: true,
    });
    if (fromFacts) return fromFacts;
  }

  const facts = turn.extractedFacts ?? [];
  const actionSectionsEarly = buildUniversalActionSections(turn);
  if (!facts.length && !actionSectionsEarly.length) return null;

  const used = new Set();
  const groups = [];

  for (const def of GROUP_ORDER) {
    const items = [];
    for (const factClass of def.classes) {
      for (const f of facts) {
        if (f.factClass !== factClass || !f.label) continue;
        const key = `${f.factClass}:${f.field}:${f.label}`;
        if (used.has(key)) continue;
        used.add(key);
        items.push(f);
      }
    }
    if (!items.length) continue;
    groups.push({
      id: def.id,
      title: def.title,
      items: items.map((f) => ({
        label: f.label,
        field: f.field,
        factClass: f.factClass,
        needsConfirmation: Boolean(f.needsConfirmation),
        confidence: f.confidence,
      })),
      line: items.map((f) => f.label).join(' · '),
    });
  }

  if (!groups.length && !actionSectionsEarly.length) return null;

  const openMissing = (turn.missingInformation ?? []).slice(0, 3);
  const actionSections = actionSectionsEarly;

  const hasOfferAndAppointment = actionSections.some((s) => (
    s.kind === 'offer_prepare' || s.kind === 'offer_incomplete'
  ))
    && actionSections.some((s) => s.kind === 'appointment_propose');

  if (hasOfferAndAppointment) {
    const offerSec = actionSections.find((s) => s.kind === 'offer_prepare')
      || actionSections.find((s) => s.kind === 'offer_incomplete');
    const apptSec = actionSections.find((s) => s.kind === 'appointment_propose');
    const msgSec = actionSections.find((s) => s.kind === 'message_draft');
    const preparedAppt = apptSec?.preparedAppointment
      || turn.preparedAppointment
      || null;
    const avail = apptSec?.availabilityStatus
      || preparedAppt?.availabilityStatus
      || 'not_checked';
    const msgBody = msgSec?.body
      || turn.messageDraft
      || preparedAppt?.messageDraft
      || apptSec?.body
      || null;
    const needs = turn.relevantCustomerContext?.customerNeeds
      || turn.usedCustomerContext?.labels
      || [];
    actionSections.unshift({
      id: 'offer_and_appointment_review',
      kind: 'offer_and_appointment_review',
      title: 'Clever hat vorbereitet',
      headline: turn.resolvedCustomer?.name
        || offerSec?.headline
        || preparedAppt?.whenLabel
        || null,
      body: [
        turn.resolvedCustomer?.name ? `KUNDE\n${turn.resolvedCustomer.name}` : null,
        offerSec?.headline || offerSec?.line
          ? `ANGEBOT\n${[offerSec?.headline, offerSec?.line].filter(Boolean).join('\n')}`
          : null,
        needs.length ? `BERÜCKSICHTIGT\n${needs.slice(0, 3).join(' · ')}` : null,
        preparedAppt
          ? `TERMINVORSCHLAG\n${preparedAppt.dateLabel || preparedAppt.whenLabel || ''}\n${preparedAppt.timeLabel ? `${preparedAppt.timeLabel} Uhr` : ''}`
          : (apptSec?.headline ? `TERMINVORSCHLAG\n${apptSec.headline}` : null),
        [
          'ANLASS',
          preparedAppt?.appointmentTypeLabel || 'Beratung im Autohaus',
          preparedAppt?.vehicleContext?.label || offerSec?.headline || null,
        ].filter(Boolean).join('\n'),
        `KALENDER\n${calendarAvailabilityLabel(avail)}`,
        msgBody ? `NACHRICHT\n„${String(msgBody).trim()}“` : null,
      ].filter(Boolean).join('\n\n'),
      offerSection: offerSec,
      appointmentSection: apptSec,
      preparedAppointment: preparedAppt,
      messageSection: msgSec,
      messageDraft: msgBody,
      availabilityStatus: avail,
      primaryActions: [
        ...(offerSec?.kind === 'offer_prepare'
          ? [{
            id: 'accept_both',
            label: 'Angebot & Termin übernehmen',
            leadId: turn.resolvedCustomer?.id || null,
            action: 'accept_offer_and_appointment',
          }]
          : []),
        {
          id: 'review_offer',
          label: 'Angebot prüfen',
          leadId: turn.resolvedCustomer?.id || null,
          action: 'open_offer_handoff',
        },
        {
          id: 'edit_message',
          label: 'Nachricht bearbeiten',
          leadId: turn.resolvedCustomer?.id || null,
          action: 'edit_message',
        },
        {
          id: 'send_proposal',
          label: 'Vorschlag senden',
          leadId: turn.resolvedCustomer?.id || null,
          action: 'send_appointment_proposal',
        },
        {
          id: 'discard',
          label: 'Verwerfen',
          action: 'discard',
        },
      ],
    });
  }

  const hasOfferAndMessage = !hasOfferAndAppointment
    && actionSections.some((s) => s.kind === 'offer_prepare')
    && actionSections.some((s) => s.kind === 'message_draft');

  if (hasOfferAndMessage) {
    const offerSec = actionSections.find((s) => s.kind === 'offer_prepare');
    const msgSec = actionSections.find((s) => s.kind === 'message_draft');
    const needs = turn.relevantCustomerContext?.customerNeeds
      || turn.usedCustomerContext?.labels
      || [];
    actionSections.unshift({
      id: 'offer_and_message_review',
      kind: 'offer_and_message_review',
      title: 'Clever hat vorbereitet',
      headline: turn.resolvedCustomer?.name || offerSec?.headline || null,
      body: [
        turn.resolvedCustomer?.name ? `KUNDE\n${turn.resolvedCustomer.name}` : null,
        offerSec?.headline ? `FAHRZEUG\n${offerSec.headline}` : null,
        offerSec?.line || facts.find((f) => f.field === 'purchasePrice')?.label
          ? `ANGEBOT\n${offerSec?.line || facts.find((f) => f.field === 'purchasePrice')?.label}`
          : null,
        needs.length ? `BERÜCKSICHTIGT\n${needs.slice(0, 3).join(' · ')}` : null,
        msgSec?.body ? `NACHRICHT\n„${String(msgSec.body).trim()}“` : null,
      ].filter(Boolean).join('\n\n'),
      offerSection: offerSec,
      messageSection: msgSec,
      primaryActions: [
        {
          id: 'review_offer',
          label: 'Angebot prüfen',
          leadId: turn.resolvedCustomer?.id || null,
          action: 'open_offer_handoff',
        },
        {
          id: 'edit_message',
          label: 'Nachricht bearbeiten',
          action: 'edit_message',
        },
        {
          id: 'approve_send',
          label: 'Freigeben und senden',
          leadId: turn.resolvedCustomer?.id || null,
          action: 'approve_handoff',
        },
      ],
    });
  }

  const draftAction = (turn.preparedActions || []).find((a) => a.type === SELLER_TURN_INTENTS.DRAFT_MESSAGE);
  const grounded = draftAction?.payload?.knowledgeResult
    || turn.knowledgeResult?.grounded
    || null;

  const hasAppointmentAndMessage = !hasOfferAndAppointment
    && !hasOfferAndMessage
    && actionSections.some((s) => s.kind === 'appointment_propose')
    && (actionSections.some((s) => s.kind === 'message_draft')
      || Boolean(turn.messageDraft)
      || Boolean(turn.preparedAppointment?.startsAt));

  if (hasAppointmentAndMessage) {
    const apptSec = actionSections.find((s) => s.kind === 'appointment_propose');
    const msgSec = actionSections.find((s) => s.kind === 'message_draft');
    const preparedAppt = apptSec?.preparedAppointment
      || turn.preparedAppointment
      || null;
    const avail = apptSec?.availabilityStatus
      || preparedAppt?.availabilityStatus
      || 'not_checked';
    const msgBody = msgSec?.body
      || turn.messageDraft
      || preparedAppt?.messageDraft
      || null;
    actionSections.unshift({
      id: 'appointment_and_message_review',
      kind: 'appointment_and_message_review',
      title: 'Clever hat vorbereitet',
      headline: turn.resolvedCustomer?.name || preparedAppt?.whenLabel || null,
      body: [
        turn.resolvedCustomer?.name ? `KUNDE\n${turn.resolvedCustomer.name}` : null,
        preparedAppt
          ? `TERMINVORSCHLAG\n${preparedAppt.dateLabel || preparedAppt.whenLabel || ''}\n${preparedAppt.timeLabel ? `${preparedAppt.timeLabel} Uhr` : ''}`
          : (apptSec?.headline ? `TERMINVORSCHLAG\n${apptSec.headline}` : null),
        [
          'ANLASS',
          preparedAppt?.appointmentTypeLabel || 'Beratung im Autohaus',
          preparedAppt?.vehicleContext?.label || null,
        ].filter(Boolean).join('\n'),
        `KALENDER\n${calendarAvailabilityLabel(avail)}`,
        msgBody ? `NACHRICHT\n„${String(msgBody).trim()}“` : null,
      ].filter(Boolean).join('\n\n'),
      preparedAppointment: preparedAppt,
      messageSection: msgSec,
      availabilityStatus: avail,
      primaryActions: [
        {
          id: 'check_calendar',
          label: 'Kalender prüfen',
          action: 'check_calendar',
        },
        {
          id: 'edit_message',
          label: 'Nachricht bearbeiten',
          leadId: turn.resolvedCustomer?.id || null,
          action: 'edit_message',
        },
        {
          id: 'send_proposal',
          label: 'Vorschlag senden',
          leadId: turn.resolvedCustomer?.id || null,
          action: 'send_appointment_proposal',
        },
        {
          id: 'discard',
          label: 'Verwerfen',
          action: 'discard',
        },
      ],
    });
  }

  const hasContractImportReview = !hasOfferAndAppointment
    && !hasOfferAndMessage
    && !hasAppointmentAndMessage
    && actionSections.some((s) => s.kind === 'contract_import');

  if (hasContractImportReview) {
    const contractSec = actionSections.find((s) => s.kind === 'contract_import');
    const draft = contractSec?.contractDraft || turn.contractDraft;
    actionSections.unshift({
      id: 'contract_import_review',
      kind: 'contract_import_review',
      title: 'Clever hat den Vertrag erkannt',
      headline: turn.resolvedCustomer?.name || draft?.customerName || draft?.vehicle?.label || null,
      body: contractSec?.body || null,
      contractDraft: draft,
      missingInformation: contractSec?.missingInformation || [],
      evidence: contractSec?.evidence || [],
      primaryActions: [
        {
          id: 'accept_contract',
          label: 'Vertrag übernehmen',
          leadId: turn.resolvedCustomer?.id || draft?.customerId || null,
          action: 'accept_contract_import',
        },
        {
          id: 'edit_contract',
          label: 'Werte bearbeiten',
          action: 'edit_contract_values',
        },
        {
          id: 'view_source',
          label: 'Quelle ansehen',
          action: 'view_contract_source',
        },
        {
          id: 'discard',
          label: 'Verwerfen',
          action: 'discard',
        },
      ],
    });
  }

  const hasContractCompareAndMessage = !hasOfferAndAppointment
    && !hasOfferAndMessage
    && !hasAppointmentAndMessage
    && !hasContractImportReview
    && actionSections.some((s) => s.kind === 'contract_offer_compare_result')
    && (
      actionSections.some((s) => s.kind === 'message_draft')
      || Boolean(turn.messageDraft)
      || (turn.preparedActions || []).some((a) => (
        a.type === SELLER_TURN_INTENTS.DRAFT_MESSAGE
        && a.payload?.contractCompareLinked
        && a.payload?.messageDraft
      ))
    );

  if (hasContractCompareAndMessage) {
    const compareSec = actionSections.find((s) => s.kind === 'contract_offer_compare_result');
    const msgSec = actionSections.find((s) => s.kind === 'message_draft');
    const compareResult = compareSec?.contractOfferCompareResult
      || turn.contractOfferCompareResult
      || null;
    const msgBody = msgSec?.body
      || turn.messageDraft
      || (turn.preparedActions || []).find((a) => (
        a.type === SELLER_TURN_INTENTS.DRAFT_MESSAGE && a.payload?.contractCompareLinked
      ))?.payload?.messageDraft
      || null;
    actionSections.unshift({
      id: 'contract_compare_and_message_review',
      kind: 'contract_compare_and_message_review',
      title: 'Clever hat vorbereitet',
      headline: turn.resolvedCustomer?.name
        || compareResult?.customerName
        || compareSec?.headline
        || null,
      line: compareSec?.line || null,
      body: [
        compareResult?.body || compareSec?.body || null,
        msgBody ? `NACHRICHT\n„${String(msgBody).trim()}“` : null,
      ].filter(Boolean).join('\n\n'),
      contractOfferCompareResult: compareResult,
      messageSection: msgSec,
      messageDraft: msgBody,
      evidence: compareResult?.evidence || compareSec?.evidence || [],
      primaryActions: [
        {
          id: 'edit_message',
          label: 'Nachricht bearbeiten',
          leadId: turn.resolvedCustomer?.id || compareResult?.customerId || null,
          action: 'edit_message',
        },
        {
          id: 'open_contract',
          label: 'Vertrag öffnen',
          leadId: compareResult?.customerId || null,
          contractId: compareResult?.contractId || null,
          action: 'open_contract',
        },
        {
          id: 'discard',
          label: 'Verwerfen',
          action: 'discard',
        },
      ],
    });
  }

  const hasKnowledgeAndMessage = !hasOfferAndAppointment
    && !hasOfferAndMessage
    && !hasAppointmentAndMessage
    && !hasContractImportReview
    && !hasContractCompareAndMessage
    && actionSections.some((s) => s.kind === 'message_draft')
    && (
      Boolean(grounded)
      || (turn.sellerFacts || []).length > 0
      || (turn.intents || []).some((i) => (
        i.type === SELLER_TURN_INTENTS.RESOLVE_VEHICLE
        || i.type === SELLER_TURN_INTENTS.LOOKUP_VEHICLE_PACKAGE
        || i.type === SELLER_TURN_INTENTS.LOOKUP_VEHICLE_EQUIPMENT
      ))
    );

  if (hasKnowledgeAndMessage) {
    const msgSec = actionSections.find((s) => s.kind === 'message_draft');
    const vehicleLabel = [
      grounded?.vehicleIdentity?.modelLabel || grounded?.vehicleIdentity?.modelKey,
      grounded?.vehicleIdentity?.trimLabel || grounded?.vehicleIdentity?.trimId,
      grounded?.vehicleIdentity?.color
        || (turn.sellerFacts || []).find((f) => f.type === 'color')?.value,
    ].filter(Boolean).join(' · ');
    const sellerLines = (turn.sellerFacts || grounded?.sellerFacts || [])
      .filter((f) => ['availability', 'package_present', 'sunroof', 'color'].includes(f.type))
      .map((f) => {
        if (f.type === 'availability') return 'Fahrzeug vorhanden';
        if (f.type === 'package_present') return String(f.value);
        if (f.type === 'sunroof') return String(f.value);
        return null;
      })
      .filter(Boolean);
    const packageHighlights = grounded?.packageHighlights
      || grounded?.verifiedPackageFacts?.items?.slice(0, 5)
      || [];
    const equipmentHighlights = grounded?.equipmentHighlights
      || grounded?.verifiedEquipmentFacts?.items?.slice(0, 5)
      || [];
    const missingPkg = (grounded?.missingKnowledge || []).includes('exact_technology_package_contents')
      || (turn.missingInformation || []).some((m) => m.id === 'exact_technology_package_contents');
    const sources = [
      packageHighlights.length
        ? {
          id: 'package',
          label: 'Technologie-Paket',
          source: grounded?.verifiedPackageFacts?.source || 'verified_vehicle_data',
          evidenceId: grounded?.verifiedPackageFacts?.evidenceId || null,
        }
        : null,
      equipmentHighlights.length
        ? {
          id: 'equipment',
          label: 'GT-Line Ausstattung',
          source: grounded?.verifiedEquipmentFacts?.source || 'verified_vehicle_data',
          evidenceId: grounded?.verifiedEquipmentFacts?.evidenceId || null,
        }
        : null,
      sellerLines.includes('Fahrzeug vorhanden')
        ? { id: 'availability', label: 'Verfügbarkeit', source: 'seller_input' }
        : null,
      sellerLines.some((l) => /schiebedach/i.test(l))
        ? { id: 'sunroof', label: 'Schiebedach', source: 'seller_input' }
        : null,
    ].filter(Boolean);

    actionSections.unshift({
      id: 'knowledge_and_message_review',
      kind: 'knowledge_and_message_review',
      title: missingPkg ? 'Fahrzeug erkannt' : 'Clever hat vorbereitet',
      headline: turn.resolvedCustomer?.name || vehicleLabel || null,
      body: [
        turn.resolvedCustomer?.name ? `KUNDE\n${turn.resolvedCustomer.name}` : null,
        vehicleLabel ? `FAHRZEUG\n${vehicleLabel}` : null,
        sellerLines.length ? `LAUT VERKÄUFER\n${sellerLines.join('\n')}` : null,
        packageHighlights.length
          ? `VERIFIZIERT\nTechnologie-Paket:\n${packageHighlights.join(' · ')}`
          : (missingPkg
            ? 'Noch nicht eindeutig verifiziert:\nInhalt des Technologie-Pakets für diese Variante'
            : null),
        equipmentHighlights.length
          ? `GT-Line:\n${equipmentHighlights.join(' · ')}`
          : null,
        msgSec?.body ? `NACHRICHT\n„${String(msgSec.body).trim()}“` : null,
      ].filter(Boolean).join('\n\n'),
      sources,
      sellerFacts: turn.sellerFacts || grounded?.sellerFacts || [],
      packageHighlights,
      equipmentHighlights,
      messageSection: msgSec,
      knowledgeResult: grounded,
      primaryActions: missingPkg
        ? [
          {
            id: 'write_without_package_details',
            label: 'Ohne Paketdetails schreiben',
            action: 'write_without_package_details',
          },
          {
            id: 'review_vehicle_data',
            label: 'Fahrzeugdaten prüfen',
            action: 'review_data',
          },
        ]
        : [
          {
            id: 'edit_message',
            label: 'Nachricht bearbeiten',
            leadId: turn.resolvedCustomer?.id || null,
            action: 'edit_message',
          },
          {
            id: 'view_sources',
            label: 'Quellen ansehen',
            action: 'view_sources',
          },
          {
            id: 'send_message',
            label: 'Senden',
            leadId: turn.resolvedCustomer?.id || null,
            action: 'send_handoff',
          },
          {
            id: 'discard',
            label: 'Verwerfen',
            action: 'discard',
          },
        ],
    });
  }

  const multiAction = actionSections.length > 1;
  const historyOnly = actionSections.some((s) => (
    s.kind === 'history_search'
    || s.kind === 'history_search_results'
    || s.kind === 'offer_history_result'
    || s.kind === 'no_search_result'
  )) && !facts.length;
  const customerSearchOnly = actionSections.some((s) => s.kind === 'customer_search_results') && !facts.length;
  const customerSummaryOnly = actionSections.some((s) => s.kind === 'customer_summary') && !facts.length;
  const appointmentPrep = actionSections.some((s) => s.kind === 'appointment_propose');
  const trackFeedback = actionSections.some((s) => s.kind === 'track_feedback');
  const offerMessageReview = actionSections.some((s) => s.kind === 'offer_and_message_review');
  const offerAppointmentReview = actionSections.some((s) => s.kind === 'offer_and_appointment_review');
  const knowledgeMessageReview = actionSections.some((s) => s.kind === 'knowledge_and_message_review');
  const appointmentMessageReview = actionSections.some((s) => s.kind === 'appointment_and_message_review');
  const contractImportReview = actionSections.some((s) => s.kind === 'contract_import_review');
  const contractCompareAndMessageReview = actionSections.some((s) => s.kind === 'contract_compare_and_message_review');
  const contractMemorySection = actionSections.find((s) => s.kind === 'contract_memory_result');
  // Leeres „Kein Vertrag“ darf Fakt-Dumps nicht als Contract-Memory-Review überschreiben
  const contractMemoryResult = Boolean(contractMemorySection)
    && !(contractMemorySection.title === 'Kein Vertrag' && facts.length > 0);
  const contractOfferCompareResult = actionSections.some((s) => s.kind === 'contract_offer_compare_result')
    && !contractCompareAndMessageReview;
  const documentsReview = actionSections.some((s) => s.kind === 'request_documents')
    && !offerMessageReview
    && !offerAppointmentReview
    && !appointmentMessageReview
    && !knowledgeMessageReview
    && !contractImportReview
    && !contractCompareAndMessageReview;
  const clarifyGoal = (turn.missingInformation || []).some((m) => m.id === 'clarify_offer_or_message');
  const goldenOnly = actionSections.some((s) => s.kind === 'golden_moment')
    && !trackFeedback
    && !appointmentPrep
    && !offerMessageReview
    && !offerAppointmentReview
    && !knowledgeMessageReview
    && !appointmentMessageReview
    && !contractImportReview
    && !contractCompareAndMessageReview
    && !contractMemoryResult
    && !contractOfferCompareResult
    && !documentsReview
    && !actionSections.some((s) => (
      s.kind === 'offer_prepare'
      || s.kind === 'offer_incomplete'
      || s.kind === 'message_draft'
      || s.kind === 'today_overview'
      || s.kind === 'knowledge_result'
      || s.kind === 'customer_search_results'
      || s.kind === 'customer_summary'
      || s.kind === 'history_search_results'
      || s.kind === 'contract_import'
      || s.kind === 'request_documents'
    ));

  return {
    reviewType: documentsReview
      ? 'request_documents'
      : contractImportReview
      ? 'contract_import_review'
      : contractCompareAndMessageReview
        ? 'contract_compare_and_message_review'
        : contractOfferCompareResult
          ? 'contract_offer_compare_result'
          : contractMemoryResult
            ? 'contract_memory_result'
            : offerAppointmentReview
              ? 'offer_and_appointment_review'
              : appointmentMessageReview
                ? 'appointment_and_message_review'
                : knowledgeMessageReview
                  ? 'knowledge_and_message_review'
                  : offerMessageReview
                    ? 'offer_and_message_review'
                    : (clarifyGoal ? 'clarify_goal' : null),
    title: documentsReview
      ? (actionSections.find((s) => s.kind === 'request_documents')?.complete
        ? '✨ Unterlagen vollständig'
        : '✨ Fehlende Unterlagen')
      : clarifyGoal
      ? '✨ Kurze Rückfrage'
      : contractImportReview
        ? '✨ Clever hat den Vertrag erkannt'
        : contractCompareAndMessageReview
          ? '✨ Clever hat vorbereitet'
          : contractOfferCompareResult
            ? (['Kein Vertrag', 'Kein Angebot'].includes(
              actionSections.find((s) => s.kind === 'contract_offer_compare_result')?.title,
            )
              ? `✨ ${actionSections.find((s) => s.kind === 'contract_offer_compare_result')?.title}`
              : `✨ ${actionSections.find((s) => s.kind === 'contract_offer_compare_result')?.headline || 'Vergleich'}`)
            : contractMemoryResult
              ? (actionSections.find((s) => s.kind === 'contract_memory_result')?.title === 'Kein Vertrag'
                ? '✨ Kein Altvertrag'
                : `✨ ${actionSections.find((s) => s.kind === 'contract_memory_result')?.headline || 'Vertrag'}`)
              : offerAppointmentReview
                ? '✨ Clever hat vorbereitet'
                : appointmentMessageReview
                  ? '✨ Clever hat vorbereitet'
                  : knowledgeMessageReview
                    ? (actionSections.find((s) => s.kind === 'knowledge_and_message_review')?.title === 'Fahrzeug erkannt'
                      ? '✨ Fahrzeug erkannt'
                      : '✨ Clever hat vorbereitet')
                    : trackFeedback
                      ? '✨ Clever hat einsortiert'
                      : offerMessageReview
                        ? '✨ Clever hat vorbereitet'
                        : historyOnly
                          ? (actionSections.some((s) => s.kind === 'no_search_result')
                            ? '✨ Nichts gefunden'
                            : actionSections.some((s) => s.kind === 'offer_history_result')
                              ? '✨ Angebot gefunden'
                              : '✨ Gefunden')
                          : customerSearchOnly
                            ? (actionSections.find((s) => s.kind === 'customer_search_results')?.title === 'Mehrere Kunden gefunden'
                              ? '✨ Mehrere Kunden gefunden'
                              : '✨ Kunde gefunden')
                            : customerSummaryOnly
                              ? `✨ ${actionSections.find((s) => s.kind === 'customer_summary')?.title || 'Kundenkontext'}`
                              : actionSections.some((s) => s.kind === 'today_overview')
                                ? '✨ Heute wichtig'
                                : actionSections.some((s) => s.kind === 'knowledge_result')
                                  ? '✨ Fahrzeugwissen'
                                  : goldenOnly
                                    ? '✨ Clever'
                                    : actionSections.some((s) => s.kind === 'offer_incomplete')
                                      ? '✨ Clever prüft das Angebot'
                                      : (multiAction || appointmentPrep || actionSections.some((s) => s.kind === 'offer_prepare')
                                        ? '✨ Clever hat vorbereitet'
                                        : '✨ Clever hat verstanden'),
    groups,
    actionSections,
    factCount: facts.length,
    summaryLine: clarifyGoal
      ? (openMissing[0]?.label || 'Ziel klären')
      : documentsReview
        ? (actionSections.find((s) => s.kind === 'request_documents')?.headline
          || actionSections.find((s) => s.kind === 'request_documents')?.sellerSummary
          || 'Unterlagen prüfen')
      : contractImportReview
        ? 'Altvertrag strukturiert – bitte prüfen'
        : contractCompareAndMessageReview
          ? (actionSections.find((s) => s.kind === 'contract_compare_and_message_review')?.line
            || 'Vergleich und Nachricht vorbereitet')
          : contractOfferCompareResult
            ? (actionSections.find((s) => s.kind === 'contract_offer_compare_result')?.line
              || actionSections.find((s) => s.kind === 'contract_offer_compare_result')?.headline
              || 'Strukturierter Vergleich')
            : contractMemoryResult
              ? (actionSections.find((s) => s.kind === 'contract_memory_result')?.line
                || actionSections.find((s) => s.kind === 'contract_memory_result')?.headline
                || 'Vertragsangabe')
              : offerAppointmentReview
                ? 'Angebot und Terminvorschlag vorbereitet'
                : appointmentMessageReview
                  ? 'Terminvorschlag und Nachricht vorbereitet'
                  : knowledgeMessageReview
                    ? 'Fahrzeugwissen und Nachricht vorbereitet'
                    : trackFeedback
                      ? 'Fahrzeugspuren und Wünsche aktualisiert'
                      : offerMessageReview
                        ? 'Angebot und Nachricht vorbereitet'
                        : historyOnly
                          ? (actionSections.find((s) => s.kind !== 'offer_and_message_review' && s.kind !== 'offer_and_appointment_review' && s.kind !== 'knowledge_and_message_review' && s.kind !== 'appointment_and_message_review' && s.kind !== 'contract_import_review' && s.kind !== 'contract_memory_result' && s.kind !== 'contract_offer_compare_result' && s.kind !== 'contract_compare_and_message_review')?.headline || 'Treffer im Verlauf')
                          : customerSearchOnly
                            ? (actionSections[0]?.headline || 'Kundentreffer')
                            : customerSummaryOnly
                              ? (actionSections[0]?.body || actionSections[0]?.headline || 'Kundenkontext')
                              : goldenOnly
                                ? (actionSections.find((s) => s.kind === 'golden_moment')?.headline || 'Nächster Verkaufsschritt')
                                : actionSections.some((s) => s.kind === 'offer_incomplete')
                                  ? 'Angebot unvollständig – Rate oder Bank-PDF benötigt'
                                  : multiAction
                                    ? `${actionSections.length} Aktionen vorbereitet`
                                    : `Neu erkannt: ${facts.length} Angabe${facts.length === 1 ? '' : 'n'}`,
    missingLine: openMissing.length
      ? `Noch offen: ${openMissing.map((m) => m.label).join('; ')}`
      : null,
    warnings: turn.warnings ?? [],
    assistantReply: turn.assistantReply ?? null,
    primaryCta: clarifyGoal
      ? 'Angebot vorbereiten'
      : documentsReview
        ? (actionSections.find((s) => s.kind === 'request_documents')?.complete
          ? 'Schließen'
          : (actionSections.find((s) => s.kind === 'request_documents')?.primaryActions?.[0]?.label
            || 'Sicheren Upload-Link senden'))
      : contractImportReview
        ? 'Vertrag übernehmen'
        : contractCompareAndMessageReview
          ? 'Nachricht bearbeiten'
          : contractOfferCompareResult
            ? 'Vertrag öffnen'
            : contractMemoryResult
              ? 'Vertrag öffnen'
              : offerAppointmentReview
                ? 'Angebot prüfen'
                : appointmentMessageReview
                  ? 'Vorschlag senden'
                  : knowledgeMessageReview
                    ? 'Nachricht bearbeiten'
                    : offerMessageReview
                      ? 'Angebot prüfen'
                      : historyOnly
                        ? 'Im Verlauf öffnen'
                        : trackFeedback
                          ? 'Übernehmen'
                          : actionSections.some((s) => s.kind === 'today_overview')
                            ? 'Tagesliste anzeigen'
                            : actionSections.some((s) => s.kind === 'knowledge_result')
                              ? 'Mehr Details'
                              : goldenOnly
                                ? (actionSections.find((s) => s.kind === 'golden_moment')?.primaryLabel || 'Angebot anpassen')
                                : actionSections.some((s) => s.kind === 'offer_incomplete')
                                  ? 'Angebot vervollständigen'
                                  : appointmentPrep && !multiAction
                                    ? 'Vorschlag senden'
                                    : multiAction
                                      ? (actionSections.some((s) => s.kind === 'offer_prepare') && actionSections.some((s) => s.kind === 'message_draft')
                                        ? 'Angebot und Nachricht prüfen'
                                        : 'Änderungen prüfen')
                                      : 'Übernehmen',
    secondaryCta: clarifyGoal
      ? 'Nur Nachricht schreiben'
      : trackFeedback
        ? (actionSections.find((s) => s.kind === 'track_feedback')?.reviseOfferLabel || 'Verwerfen')
        : 'Verwerfen',
    reviseOfferCta: trackFeedback
      ? (actionSections.find((s) => s.kind === 'track_feedback')?.reviseOfferLabel || null)
      : null,
    progressLines: turn.uiEffects?.progressLines ?? [],
    messageDraft: turn.messageDraft
      ?? actionSections.find((s) => s.kind === 'offer_and_appointment_review')?.messageDraft
      ?? actionSections.find((s) => s.kind === 'contract_compare_and_message_review')?.messageDraft
      ?? null,
    resolvedCustomer: turn.resolvedCustomer ?? null,
    goldenMoment: turn.goldenMoment ?? null,
    handoffWorkingContext: turn.handoffWorkingContext ?? null,
    sources: actionSections.find((s) => s.kind === 'knowledge_and_message_review')?.sources
      || actionSections.find((s) => s.kind === 'contract_compare_and_message_review')?.evidence
      || actionSections.find((s) => s.kind === 'contract_memory_result')?.evidence
      || [],
    preparedAppointment: turn.preparedAppointment
      || actionSections.find((s) => s.kind === 'offer_and_appointment_review')?.preparedAppointment
      || actionSections.find((s) => s.kind === 'appointment_and_message_review')?.preparedAppointment
      || null,
    contractDraft: turn.contractDraft
      || actionSections.find((s) => s.kind === 'contract_import_review')?.contractDraft
      || null,
    contractMemoryResult: turn.contractMemoryResult
      || actionSections.find((s) => s.kind === 'contract_memory_result')?.contractMemoryResult
      || null,
    contractOfferCompareResult: turn.contractOfferCompareResult
      || actionSections.find((s) => s.kind === 'contract_compare_and_message_review')?.contractOfferCompareResult
      || actionSections.find((s) => s.kind === 'contract_offer_compare_result')?.contractOfferCompareResult
      || null,
  };
}

/**
 * Wann die Universal-Review Vorrang vor Offer/Inline hat.
 * @param {object} turn
 */
export function shouldShowUniversalReview(turn = {}) {
  if (turn.customerReply?.detected) return true;
  if (turn.inboundLead?.detected) return true;
  if (turn.multiSourceIntake?.detected) return true;
  if (turn.homepageInquiry?.hasDualScenarios) return true;
  if ((turn.extractedFacts ?? []).some((f) => f.field === 'commercialScenarios')) return true;

  const prepared = turn.preparedActions ?? [];
  if (prepared.some((a) => a.type === SELLER_TURN_INTENTS.GET_TODAY_OVERVIEW)) return true;
  if (prepared.some((a) => a.type === SELLER_TURN_INTENTS.LOOKUP_VEHICLE_FACT)) return true;
  if (turn.todayOverview || turn.knowledgeResult) return true;
  if (turn.customerSearchResults?.length || turn.customerSummary || turn.historySearchResults) return true;

  const hasHistory = prepared.some((a) => (
    a.type === SELLER_TURN_INTENTS.SEARCH_CUSTOMER_HISTORY
    || a.type === SELLER_TURN_INTENTS.SEARCH_CUSTOMER_MESSAGES
    || a.type === SELLER_TURN_INTENTS.SEARCH_CUSTOMER_OFFERS
    || a.type === SELLER_TURN_INTENTS.SEARCH_CUSTOMER_ACTIVITIES
    || a.type === SELLER_TURN_INTENTS.FIND_CUSTOMER
    || a.type === SELLER_TURN_INTENTS.OPEN_CUSTOMER
    || a.type === SELLER_TURN_INTENTS.SUMMARIZE_CUSTOMER_CONTEXT
    || a.type === SELLER_TURN_INTENTS.CUSTOMER_LOOKUP
  ));
  if (hasHistory) return true;

  if (prepared.some((a) => a.type === SELLER_TURN_INTENTS.RECOMMEND_NEXT_STEP)) return true;
  if (prepared.some((a) => (
    a.type === SELLER_TURN_INTENTS.REQUEST_DOCUMENTS && a.status === 'prepared'
  ))) return true;
  if ((turn.missingInformation || []).some((m) => m.id === 'clarify_offer_or_message')) return true;
  if ((turn.missingInformation || []).some((m) => (
    m.id === 'exact_technology_package_contents'
    || m.id === 'clarify_vehicle_for_knowledge'
    || m.id === 'clarify_customer_for_appointment'
    || m.id === 'clarify_customer_for_contract'
  ))) return true;

  const hasGroundedMessage = prepared.some((a) => (
    a.type === SELLER_TURN_INTENTS.DRAFT_MESSAGE
    && a.payload?.knowledgeResult
  )) || prepared.some((a) => (
    a.type === SELLER_TURN_INTENTS.RESOLVE_VEHICLE
    || a.type === SELLER_TURN_INTENTS.LOOKUP_VEHICLE_PACKAGE
    || a.type === SELLER_TURN_INTENTS.LOOKUP_VEHICLE_EQUIPMENT
  ));
  if (hasGroundedMessage) return true;

  const hasAppointmentPrep = prepared.some((a) => (
    a.type === SELLER_TURN_INTENTS.PROPOSE_APPOINTMENT && a.status === 'prepared'
  ));
  if (hasAppointmentPrep) return true;

  const hasContractImport = prepared.some((a) => (
    a.type === SELLER_TURN_INTENTS.IMPORT_CUSTOMER_CONTRACT
  )) || Boolean(turn.contractDraft);
  if (hasContractImport) return true;

  const hasContractSearch = prepared.some((a) => (
    a.type === SELLER_TURN_INTENTS.SEARCH_CUSTOMER_CONTRACTS
  )) || Boolean(turn.contractMemoryResult);
  if (hasContractSearch) return true;

  const hasContractCompare = prepared.some((a) => (
    a.type === SELLER_TURN_INTENTS.COMPARE_CONTRACT_WITH_OFFER
  )) || Boolean(turn.contractOfferCompareResult);
  if (hasContractCompare) return true;

  const hasPreparedMessage = prepared.some((a) => (
    a.type === SELLER_TURN_INTENTS.DRAFT_MESSAGE
    && a.status === 'prepared'
    && Boolean(a.payload?.messageDraft || turn.messageDraft)
  ));
  // Angehängtes Angebot → Zusammenfassungs-Mail: Review ohne CRM-Facts
  if (hasPreparedMessage && turn.currentOfferContext?.offerId) return true;

  const facts = turn.extractedFacts ?? [];
  if (!facts.length) return false;

  const dumpClass = new Set([
    SELLER_FACT_CLASS.CUSTOMER_FACT,
    SELLER_FACT_CLASS.CUSTOMER_NEED,
    SELLER_FACT_CLASS.VEHICLE_INTEREST,
    SELLER_FACT_CLASS.VEHICLE_REQUIREMENT,
    SELLER_FACT_CLASS.COMMERCIAL_PREFERENCE,
    SELLER_FACT_CLASS.OFFER_INSTRUCTION,
    SELLER_FACT_CLASS.EXISTING_VEHICLE,
    SELLER_FACT_CLASS.SELF_DISCLOSURE_FACT,
    SELLER_FACT_CLASS.CONTRACT_FACT,
    SELLER_FACT_CLASS.APPOINTMENT_FACT,
  ]);

  // Reine Kundennachricht ohne CRM-Kontext → kein Review (nur Message-Draft)
  const hasStructuredSellerNote = facts.some((f) => (
    f.factClass === SELLER_FACT_CLASS.SELLER_FACT
    && /delivery|liefer|verfügbar|price|preis/i.test(`${f.field || ''} ${f.label || ''}`)
  ));
  if (turn.inputMode === SELLER_INPUT_MODE.CUSTOMER_MESSAGE) {
    const hasDump = facts.some((f) => dumpClass.has(f.factClass));
    if (!hasDump && !hasStructuredSellerNote) return false;
  }
  // Strukturierte Seller-Notiz (z. B. Lieferzeit) → Review mit Bestätigung
  if (hasStructuredSellerNote) return true;

  const hasOfferPrep = turn.intents?.some((i) => i.type === SELLER_TURN_INTENTS.PREPARE_OFFER)
    && turn.preparedActions?.some((a) => a.type === SELLER_TURN_INTENTS.PREPARE_OFFER);
  const hasDraft = turn.intents?.some((i) => i.type === SELLER_TURN_INTENTS.DRAFT_MESSAGE)
    || Boolean(turn.messageDraft);
  if (hasOfferPrep && (hasDraft || facts.some((f) => f.field === 'purchasePrice'))) {
    return true;
  }

  const hasPortfolio = turn.intents?.some((i) => i.type === 'send_portfolio');
  const hasContextIntent = turn.intents?.some((i) => i.type === 'update_customer_context');
  // Reiner Portfolio-Cue ohne Kontext-Fakten → Inline-CTA (kein Review)
  if (hasPortfolio && !hasContextIntent && facts.length < 2) {
    const portfolioDump = new Set([
      SELLER_FACT_CLASS.CUSTOMER_FACT,
      SELLER_FACT_CLASS.CUSTOMER_NEED,
      SELLER_FACT_CLASS.VEHICLE_INTEREST,
      SELLER_FACT_CLASS.VEHICLE_REQUIREMENT,
      SELLER_FACT_CLASS.COMMERCIAL_PREFERENCE,
      SELLER_FACT_CLASS.EXISTING_VEHICLE,
      SELLER_FACT_CLASS.SELF_DISCLOSURE_FACT,
      SELLER_FACT_CLASS.CONTRACT_FACT,
      SELLER_FACT_CLASS.APPOINTMENT_FACT,
    ]);
    if (!facts.some((f) => portfolioDump.has(f.factClass))) return false;
  }

  // Multi-Aktion (Offer-Update + Nachricht) immer als Review
  if (buildUniversalActionSections(turn).length > 1) return true;

  if (facts.length >= 2) return true;
  if (hasContextIntent) return true;
  return facts.some((f) => dumpClass.has(f.factClass));
}
