/**
 * Welt 3 – Persönliche Übergabe (kein Kontaktformular).
 * Nutzt NeedProfile, Lead, Journey, mailFlowService – keine neue Datenstruktur.
 */
import { LEAD_SOURCES } from '../../data/leadTypes.js';
import { DEALER_SELLERS, CONTACT_PREFERENCES } from '../../data/salesChanceTypes.js';
import {
  buildConsultationHandoffSummary,
  createConsultationLeadExtras,
} from '../dealer/cleverSalesAdvisor.js';
import { SOURCE_MODES } from '../dealer/dealerSourceMode.js';
import { evaluateJourney } from '../journey/journeyEngine.js';
import { JOURNEY_PHASE } from '../journey/journeyTypes.js';
import { buildAdvisorInitials } from '../crm/customerPortalAdvisorService.js';
import { mergeNeedProfileIntoLead } from './needProfileService.js';
import { CLEVER_WORLD } from './consultationWorlds.js';

export const OFFER_CONVERSATION_PHASE = {
  OFFER_HANDOFF: 'offer_handoff',
  OFFER_COMPLETE: 'offer_complete',
};

export const OFFER_TURN_TYPE = {
  PERSONAL_HANDOFF: 'personal_handoff',
  HANDOFF_COMPLETE: 'handoff_complete',
};

export const CONTACT_TIMING_OPTIONS = [
  { id: 'today', label: 'Heute' },
  { id: 'tomorrow', label: 'Morgen' },
  { id: 'this_week', label: 'Diese Woche' },
  { id: 'relaxed', label: 'Ganz in Ruhe' },
];

export const CONTACT_TIMING_LABELS = Object.fromEntries(
  CONTACT_TIMING_OPTIONS.map((o) => [o.id, o.label]),
);

export { CONTACT_PREFERENCES };

function uid(prefix = 'lead') {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function historyEntry(text, type = 'system') {
  return {
    id: uid('hist'),
    at: new Date().toISOString(),
    type,
    text,
  };
}

function defaultAdvisor(dealerConditions = {}) {
  const seller = DEALER_SELLERS.find((s) => s.id === 'mike-quach') ?? DEALER_SELLERS[0];
  const name = dealerConditions?.contact?.name?.trim() || seller?.name || 'Ihr Berater';
  return {
    userId: seller?.id ?? 'mike-quach',
    name,
    role: 'Kia-Spezialist',
    experience: '14 Jahre Erfahrung',
    initials: buildAdvisorInitials(name),
    phone: seller?.phone ?? dealerConditions?.contact?.phone ?? null,
    email: seller?.email ?? dealerConditions?.contact?.email ?? null,
    message:
      'Ich schaue mir Ihren Wunsch persönlich an und prüfe, '
      + 'welche Variante wirklich am besten zu Ihnen passt.',
  };
}

function buildConsultationProfileFromSession(session = {}) {
  const vehicleAnswers = session.vehicleProfile?.answers ?? {};
  const answers = { ...(session.consultationProfile?.answers ?? {}) };
  const equipment = vehicleAnswers.ev3Equipment;
  if (equipment === 'heatPump') answers.heatPump = 'yes';
  if (equipment === 'hud') answers.hud = 'yes';
  if (equipment === 'towbar') answers.towCapacity = 'light';

  return {
    initialWish: session.needProfile?.initialWish ?? '',
    answers,
    openQuestions: [],
  };
}

function buildRecommendationFromSession(session = {}) {
  const mini = session.vehicleMiniRecommendation;
  if (!mini?.ready) return null;
  return {
    ready: true,
    vehicleTitle: mini.batteryLine ?? 'Kia EV3',
    modelKey: session.selectedModelKey ?? 'ev3',
    modelLabel: 'EV3',
    whyLines: mini.whyLines ?? [],
    trimLine: mini.trimLine ?? null,
  };
}

export function buildPreparedSummaryItems(session = {}) {
  const items = [
    'Ihr Wunschprofil',
    'Passendes Fahrzeug',
  ];
  if ((session.vehicleNotepadLabels ?? []).length) {
    items.push('Wichtige Ausstattungswünsche');
  }
  items.push('Offene Fragen');
  items.push('Alles, was Ihr Berater für den nächsten Schritt braucht');
  return items;
}

/**
 * Screen 5 – Ansichtsdaten für persönliche Übergabe.
 */
export function buildPersonalHandoffView(session = {}, dealerConditions = {}) {
  return {
    title: 'Ihr Wunsch ist vorbereitet.',
    preparedIntro: 'Das habe ich für Ihren Berater vorbereitet.',
    preparedItems: buildPreparedSummaryItems(session),
    wishLabels: session.notepadLabels ?? [],
    vehicleLabels: session.vehicleNotepadLabels ?? [],
    directionLine: session.vehicleMiniRecommendation?.batteryLine ?? null,
    trimLine: session.vehicleMiniRecommendation?.trimLine ?? null,
    advisor: defaultAdvisor(dealerConditions),
    hasRate: false,
    hasOffer: false,
  };
}

/**
 * Copy für „Mit einem Berater sprechen“ – abhängig vom erkannten Verständnis.
 * @param {number} labelCount
 */
export function buildAdvisorContactPrompt(labelCount = 0) {
  if (labelCount <= 0) return null;
  if (labelCount <= 3) {
    return {
      level: 'early',
      hint:
        'Schon einiges verstanden. '
        + 'Ihr Berater kann jederzeit nahtlos ins Gespräch einsteigen.',
    };
  }
  if (labelCount <= 5) {
    return {
      level: 'medium',
      hint:
        'Wir haben bereits ein gutes Bild Ihres Wunsches. '
        + 'Ihr Berater kann direkt ins Gespräch einsteigen.',
    };
  }
  return {
    level: 'strong',
    hint:
      'Wir haben bereits sehr gut verstanden, wonach Sie suchen. '
      + 'Ihr Berater kann direkt übernehmen – ohne von vorn anzufangen.',
  };
}

/** Optionale Schnellaufnahme vor Beraterkontakt – Texte für mergeTextIntoNeedProfile. */
export const QUICK_HANDOFF_ENRICHMENT_CHIPS = [
  { id: 'towbar', label: 'Anhängerkupplung wichtig', text: 'Anhängerkupplung ist wichtig.' },
  { id: 'family', label: 'Familie / Kinder', text: 'Familie mit Kindern.' },
  { id: 'fuelOpen', label: 'Elektro oder Hybrid noch offen', text: 'Elektro oder Hybrid noch offen.' },
  { id: 'sportDesign', label: 'Sportliches Design', text: 'Sportliches Design ist wichtig.' },
  { id: 'range', label: 'Große Reichweite wichtig', text: 'Große Reichweite ist wichtig.' },
  { id: 'delivery', label: 'Lieferzeit wichtiger als Rate', text: 'Lieferzeit ist wichtiger als die Rate.' },
  { id: 'leaseEnd', label: 'Fahrzeugwechsel läuft bald aus', text: 'Fahrzeugwechsel läuft bald aus.' },
  { id: 'testDrive', label: 'Probefahrt gewünscht', text: 'Probefahrt gewünscht.' },
];

export const QUICK_HANDOFF_COPY = {
  expandLabel: 'Optional — Berater vorbereiten',
  collapseLabel: 'Weniger anzeigen',
  title: 'Was sollten wir Ihrem Berater noch mitgeben?',
  subtitle:
    'Optional — Ihr Berater freut sich über jedes Detail, '
    + 'kann Sie aber auch direkt kontaktieren.',
  freetextPlaceholder:
    'Zum Beispiel: Dachzelt, Hund, Ford Kuga läuft aus, Farbe Grün oder Restwertübernahme.',
};

export function countSessionUnderstandingLabels(session = {}) {
  const merged = new Set([
    ...(session.needProfile?.understoodLabels ?? []),
    ...(session.notepadLabels ?? []),
    ...(session.vehicleNotepadLabels ?? []),
  ]);
  return merged.size;
}

export function buildHandoffCompleteView() {
  return {
    title: 'Vielen Dank.',
    headline: 'Ihr Wunsch wurde vorbereitet.',
    intro: 'Ihr Berater prüft jetzt:',
    checklist: [
      'Fahrzeug',
      'Ausstattung',
      'Verfügbarkeit',
      'passende Konditionen',
    ],
    outro: 'Anschließend meldet er sich persönlich bei Ihnen.',
    reassurance:
      'Ihre bisherigen Angaben bleiben gespeichert. '
      + 'Sie müssen Ihrem Berater nichts noch einmal erklären.',
  };
}

function formatContactName(form = {}) {
  const first = String(form.firstName ?? '').trim();
  const last = String(form.lastName ?? '').trim();
  return [first, last].filter(Boolean).join(' ');
}

function buildHandoffDossierLines(session = {}, form = {}) {
  const lines = [];
  if (session.notepadLabels?.length) {
    lines.push(`Wunschprofil: ${session.notepadLabels.join(', ')}`);
  }
  if (session.vehicleMiniRecommendation?.batteryLine) {
    lines.push(`EV3-Richtung: ${session.vehicleMiniRecommendation.batteryLine}`);
  }
  if (session.vehicleMiniRecommendation?.trimLine) {
    lines.push(session.vehicleMiniRecommendation.trimLine);
  }
  if (session.vehicleNotepadLabels?.length) {
    lines.push(`Ausstattung: ${session.vehicleNotepadLabels.join(', ')}`);
  }
  if (form.contactTiming) {
    lines.push(`Rückruf: ${CONTACT_TIMING_LABELS[form.contactTiming] ?? form.contactTiming}`);
  }
  if (form.contactPreference) {
    const pref = CONTACT_PREFERENCES.find((p) => p.id === form.contactPreference)?.label;
    if (pref) lines.push(`Kontakt bevorzugt per: ${pref}`);
  }
  if (form.advisorNote?.trim()) {
    lines.push(`Hinweis: ${form.advisorNote.trim()}`);
  }
  return lines;
}

/**
 * Lead aus Happy-Path-Session – bestehende CRM-Strukturen.
 */
export function createLeadFromConsultationHappyPath({
  session = {},
  handoffForm = {},
  dealerConditions = {},
} = {}) {
  const consultationProfile = buildConsultationProfileFromSession(session);
  const recommendation = buildRecommendationFromSession(session);
  const handoffSummary = buildConsultationHandoffSummary(consultationProfile, recommendation);

  for (const line of buildHandoffDossierLines(session, handoffForm)) {
    const [label, ...rest] = line.split(':');
    if (rest.length) {
      handoffSummary.lines.push({ label: label.trim(), value: rest.join(':').trim() });
    }
  }

  const consultationExtras = createConsultationLeadExtras({
    profile: consultationProfile,
    recommendation,
    handoffSummary,
    sourceMode: SOURCE_MODES.ADVISOR,
    sourceModelKey: session.selectedModelKey ?? 'ev3',
    entryMode: 'clever',
  });

  const contactName = formatContactName(handoffForm);
  const needProfile = {
    ...session.needProfile,
    world: CLEVER_WORLD.OFFER,
    selectedModelKey: session.selectedModelKey ?? 'ev3',
    understoodLabels: session.notepadLabels ?? [],
    vehicleNotes: session.vehicleNotepadLabels ?? [],
    handoff: {
      contactPreference: handoffForm.contactPreference ?? null,
      contactTiming: handoffForm.contactTiming ?? null,
      advisorNote: handoffForm.advisorNote?.trim() || null,
      submittedAt: new Date().toISOString(),
    },
  };

  const vehicleTitle = recommendation?.vehicleTitle ?? 'Kia EV3';
  const dossierLines = [
    `Kunde: ${contactName}`,
    `Fahrzeug-Richtung: ${vehicleTitle}`,
    ...buildHandoffDossierLines(session, handoffForm),
    'Status: Persönliche Beratung angefordert',
  ];

  let lead = {
    id: uid(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    status: 'neu',
    source: 'dealerJourney',
    advisorStatus: 'Persönliche Beratung angefordert',
    dealerId: dealerConditions?.dealerId ?? dealerConditions?.slug ?? 'autohaus-trinkle',
    ownerId: defaultAdvisor(dealerConditions).userId,
    ownerName: defaultAdvisor(dealerConditions).name,
    contact: {
      name: contactName,
      phone: handoffForm.phone?.trim() ?? '',
      email: handoffForm.email?.trim() ?? '',
    },
    vehicle: {
      brand: 'Kia',
      model: 'EV3',
      trim: session.vehicleMiniRecommendation?.trimLine?.replace(/^Ausstattung:\s*/i, '') ?? '',
      label: vehicleTitle,
    },
    inquiryBrief: {
      customerName: contactName,
      searchQuery: session.needProfile?.initialWish ?? null,
      recommended: {
        title: vehicleTitle,
        modelKey: session.selectedModelKey ?? 'ev3',
      },
      customerWishSummary: [
        ...(session.notepadLabels ?? []),
        ...(session.vehicleNotepadLabels ?? []),
      ].join(' · '),
    },
    sonderwuensche: {
      consultation: consultationExtras,
    },
    crm: {
      sourceMode: SOURCE_MODES.ADVISOR,
      sourceModelKey: session.selectedModelKey ?? 'ev3',
      advisor: defaultAdvisor(dealerConditions),
      journeyPhase: JOURNEY_PHASE.NEW_INQUIRY,
      contactPreference: handoffForm.contactPreference ?? null,
      contactTiming: handoffForm.contactTiming ?? null,
    },
    notes: dossierLines.join('\n'),
    history: [
      historyEntry(`Anfrage über ${LEAD_SOURCES.dealerJourney}`),
      historyEntry('Clever Beratung → EV3-Richtung → persönliche Übergabe'),
      ...dossierLines.map((line) => historyEntry(line, 'note')),
    ],
  };

  lead = mergeNeedProfileIntoLead(lead, needProfile);
  lead.crm.needProfile.world = CLEVER_WORLD.OFFER;
  lead.crm.journeyPhase = JOURNEY_PHASE.NEW_INQUIRY;

  return lead;
}

/**
 * Welt 2 → Welt 3 – Screen 5 anzeigen.
 */
export function beginOfferHandoff(session, dealerConditions = {}) {
  const handoffView = buildPersonalHandoffView(session, dealerConditions);
  return {
    ...session,
    phase: OFFER_CONVERSATION_PHASE.OFFER_HANDOFF,
    handoffView,
    needProfile: {
      ...session.needProfile,
      world: CLEVER_WORLD.OFFER,
    },
    pendingQuestion: null,
    turns: [
      ...session.turns,
      {
        type: OFFER_TURN_TYPE.PERSONAL_HANDOFF,
        id: `personal-handoff-${Date.now()}`,
        handoffView,
      },
    ],
  };
}

/**
 * Persönliche Beratung anfordern – Lead + Journey Welt 3.
 */
export function submitPersonalHandoff(session, handoffForm = {}, dealerConditions = {}) {
  const lead = createLeadFromConsultationHappyPath({
    session,
    handoffForm,
    dealerConditions,
  });
  const journey = evaluateJourney(lead);
  const completeView = buildHandoffCompleteView();

  return {
    session: {
      ...session,
      phase: OFFER_CONVERSATION_PHASE.OFFER_COMPLETE,
      needProfile: {
        ...session.needProfile,
        world: CLEVER_WORLD.OFFER,
      },
      submittedLead: lead,
      journeySnapshot: { phase: journey?.phase ?? JOURNEY_PHASE.NEW_INQUIRY },
      handoffForm,
      turns: [
        ...session.turns,
        {
          type: OFFER_TURN_TYPE.HANDOFF_COMPLETE,
          id: `handoff-complete-${Date.now()}`,
          completeView,
        },
      ],
    },
    lead,
    journey,
  };
}

export function validateHandoffForm(form = {}) {
  const errors = {};
  if (!String(form.firstName ?? '').trim()) {
    errors.firstName = 'Wie darf Ihr Berater Sie ansprechen?';
  }
  if (!String(form.lastName ?? '').trim()) {
    errors.lastName = 'Wie darf Ihr Berater Sie ansprechen?';
  }
  if (!String(form.email ?? '').trim()) {
    errors.email = 'Wohin darf Ihr Berater die Bestätigung senden?';
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
    errors.email = 'Das sieht noch nicht nach einer E-Mail aus – wo dürfen wir Sie erreichen?';
  }
  return { valid: Object.keys(errors).length === 0, errors };
}

export function isInOfferWorld(session) {
  return session.phase === OFFER_CONVERSATION_PHASE.OFFER_HANDOFF
    || session.phase === OFFER_CONVERSATION_PHASE.OFFER_COMPLETE
    || session.needProfile?.world === CLEVER_WORLD.OFFER;
}
