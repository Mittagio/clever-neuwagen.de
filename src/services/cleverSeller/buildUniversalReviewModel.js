/**
 * Review-Model für „Clever hat verstanden“ (Display only).
 */
import { SELLER_FACT_CLASS, SELLER_INPUT_MODE, SELLER_TURN_INTENTS } from './sellerFactTypes.js';
import { INLINE_RESULT_TYPES } from '../dealer/sellerInlineComposerAssist.js';
import { buildHomepageInquiryReviewModel } from '../crm/homepageCommercialInquiry.js';

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
      })),
      primaryActions: items[0]?.leadId
        ? [
          { id: 'open_first', label: `${items[0].customerName} öffnen`, leadId: items[0].leadId },
          { id: 'show_list', label: 'Tagesliste anzeigen' },
        ]
        : [{ id: 'show_list', label: 'Tagesliste anzeigen' }],
    });
  }

  const knowledge = turn.knowledgeResult
    || prepared.find((a) => a.type === SELLER_TURN_INTENTS.LOOKUP_VEHICLE_FACT)?.payload?.knowledgeResult;
  if (knowledge) {
    const modelLabel = knowledge.modelLabel
      || (knowledge.modelKey ? `Kia ${knowledge.modelKey}` : 'Fahrzeug');
    sections.push({
      id: 'knowledge_result',
      kind: 'knowledge_result',
      title: `${modelLabel} · ${knowledge.factLabel || 'Fakt'}`,
      headline: knowledge.ok
        ? knowledge.displayValue
        : (knowledge.message || 'Nicht verifiziert'),
      line: knowledge.sourceLabel || null,
      body: knowledge.ok
        ? null
        : (knowledge.message || 'Diesen Wert habe ich noch nicht eindeutig verifiziert.'),
      knowledgeResult: knowledge,
      primaryActions: [{ id: 'more_details', label: 'Mehr Details' }],
    });
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
  if (draftBody && !interimOnly) {
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

  const offerPrep = prepared.find((a) => (
    a.type === SELLER_TURN_INTENTS.PREPARE_OFFER
    && a.status === 'prepared'
    && !a.payload?.updateOnly
  ));
  if (offerPrep && !sections.some((s) => s.kind === 'offer_change')) {
    const purchase = facts.find((f) => f.field === 'purchasePrice');
    const vehicle = facts.find((f) => f.field === 'vehicleInterest');
    const discount = facts.find((f) => f.field === 'discountPercent');
    const incomplete = offerPrep.payload?.canCreateOffer === false
      || offerPrep.payload?.missingRate
      || (turn.missingInformation || []).some((m) => m.id === 'monthly_leasing_rate');
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
    if (offerPrep.payload?.listPrice != null) {
      lineParts.push(`UPE ${Number(offerPrep.payload.listPrice).toLocaleString('de-DE')} €`);
    }
    if (incomplete) {
      lineParts.push('Noch offen: Leasingrate / Bank-PDF');
    } else if (purchase?.label) {
      lineParts.push(purchase.label);
    } else if (offerPrep.payload?.monthlyRate != null) {
      lineParts.push(`${Number(offerPrep.payload.monthlyRate).toLocaleString('de-DE')} €/Monat`);
    }
    sections.unshift({
      id: 'offer_prepare',
      kind: incomplete ? 'offer_incomplete' : 'offer_prepare',
      title: incomplete ? 'Angebot prüfen' : 'Angebot',
      headline: offerPrep.payload?.vehicleLabel || vehicle?.label || 'Kaufangebot',
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
  }

  const appointmentAction = prepared.find((a) => (
    a.type === SELLER_TURN_INTENTS.PROPOSE_APPOINTMENT && a.status === 'prepared'
  ));
  const appointmentFact = facts.find((f) => f.factClass === SELLER_FACT_CLASS.APPOINTMENT_FACT);
  if (appointmentAction || appointmentFact) {
    const appt = appointmentAction?.legacy?.appointment
      || appointmentAction?.legacy?.results?.[0]?.appointment
      || null;
    sections.push({
      id: 'appointment_propose',
      kind: 'appointment_propose',
      title: 'Terminvorschlag',
      headline: appointmentFact?.label
        || (appt
          ? [appt.typeLabel, appt.whenLabel, appt.timeLabel].filter(Boolean).join(' · ')
          : 'Termin vorbereitet'),
      line: appt?.vehicleLabel || turn.resolvedCustomer?.name || null,
      body: appointmentAction?.legacy?.results?.[0]?.draft?.body
        || appointmentAction?.legacy?.messageDraft
        || null,
    });
  }

  const historyAction = prepared.find((a) => (
    a.type === SELLER_TURN_INTENTS.SEARCH_CUSTOMER_HISTORY
  ));
  if (historyAction) {
    const hits = historyAction.legacy?.results ?? [];
    const top = hits[0] || null;
    sections.push({
      id: 'history_search',
      kind: 'history_search',
      title: hits.length ? '✨ Gefunden' : 'Verlauf',
      headline: top?.whenLabel || top?.title || (hits.length ? `${hits.length} Treffer` : 'Kein Treffer'),
      body: top?.snippet || top?.body || top?.preview || null,
      line: hits.length > 1 ? `${hits.length} Treffer im Verlauf` : null,
      hit: top,
      hitCount: hits.length,
    });
  }

  const nextStep = prepared.find((a) => a.type === SELLER_TURN_INTENTS.RECOMMEND_NEXT_STEP);
  const moment = nextStep?.payload?.goldenMoment || turn.goldenMoment || null;
  if (moment && (nextStep || !sections.some((s) => s.kind === 'track_feedback'))) {
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
  const multiAction = actionSections.length > 1;
  const historyOnly = actionSections.some((s) => s.kind === 'history_search') && !facts.length;
  const appointmentPrep = actionSections.some((s) => s.kind === 'appointment_propose');
  const trackFeedback = actionSections.some((s) => s.kind === 'track_feedback');
  const goldenOnly = actionSections.some((s) => s.kind === 'golden_moment')
    && !trackFeedback
    && !appointmentPrep
    && !actionSections.some((s) => (
      s.kind === 'offer_prepare'
      || s.kind === 'offer_incomplete'
      || s.kind === 'message_draft'
      || s.kind === 'today_overview'
      || s.kind === 'knowledge_result'
    ));

  return {
    title: historyOnly
      ? '✨ Gefunden'
      : trackFeedback
        ? '✨ Clever hat einsortiert'
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
    summaryLine: historyOnly
      ? (actionSections[0]?.headline || 'Treffer im Verlauf')
      : trackFeedback
        ? 'Fahrzeugspuren und Wünsche aktualisiert'
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
    primaryCta: historyOnly
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
    secondaryCta: trackFeedback
      ? (actionSections.find((s) => s.kind === 'track_feedback')?.reviseOfferLabel || 'Verwerfen')
      : 'Verwerfen',
    reviseOfferCta: trackFeedback
      ? (actionSections.find((s) => s.kind === 'track_feedback')?.reviseOfferLabel || null)
      : null,
    progressLines: turn.uiEffects?.progressLines ?? [],
    messageDraft: turn.messageDraft ?? null,
    resolvedCustomer: turn.resolvedCustomer ?? null,
    goldenMoment: turn.goldenMoment ?? null,
  };
}

/**
 * Wann die Universal-Review Vorrang vor Offer/Inline hat.
 * @param {object} turn
 */
export function shouldShowUniversalReview(turn = {}) {
  if (turn.homepageInquiry?.hasDualScenarios) return true;
  if ((turn.extractedFacts ?? []).some((f) => f.field === 'commercialScenarios')) return true;

  const prepared = turn.preparedActions ?? [];
  if (prepared.some((a) => a.type === SELLER_TURN_INTENTS.GET_TODAY_OVERVIEW)) return true;
  if (prepared.some((a) => a.type === SELLER_TURN_INTENTS.LOOKUP_VEHICLE_FACT)) return true;
  if (turn.todayOverview || turn.knowledgeResult) return true;

  const hasHistory = prepared.some((a) => a.type === SELLER_TURN_INTENTS.SEARCH_CUSTOMER_HISTORY);
  if (hasHistory) return true;

  if (prepared.some((a) => a.type === SELLER_TURN_INTENTS.RECOMMEND_NEXT_STEP)) return true;

  const hasAppointmentPrep = prepared.some((a) => (
    a.type === SELLER_TURN_INTENTS.PROPOSE_APPOINTMENT && a.status === 'prepared'
  ));
  if (hasAppointmentPrep) return true;

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
