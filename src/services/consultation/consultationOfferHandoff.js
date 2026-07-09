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
import { getFuelCategory, isElectricOrPhevProfile } from './conversationPlanner.js';

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
 * Copy für „Mit einem Berater sprechen“.
 * @param {number} labelCount
 * @param {'opening'|'engaged'|'handoff'} [variant]
 */
export function buildAdvisorContactPrompt(labelCount = 0, variant = 'engaged') {
  if (variant === 'opening') {
    return {
      level: 'opening',
      hint: null,
      optionalNote:
        'Ihr Berater kann Sie auch direkt kontaktieren, '
        + 'ohne dass Sie vorher etwas erzählen müssen.',
    };
  }

  if (variant === 'handoff') {
    return {
      level: 'handoff',
      hint:
        'Wir haben bereits ein gutes Bild Ihres Wunsches.\n\n'
        + 'Ihr Berater kann direkt ins Gespräch einsteigen '
        + 'und muss nicht bei null beginnen.',
    };
  }

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

/** Kontaktphase – optionale Chips, Texte für mergeTextIntoNeedProfile. */
export const QUICK_HANDOFF_ENRICHMENT_CHIPS = [
  { id: 'twoChildren', label: '2 Kinder', text: 'Familie mit zwei Kindern.' },
  { id: 'childSeats', label: 'Kindersitze', text: 'Kindersitze sind wichtig.' },
  { id: 'dog', label: 'Hund', text: 'Hund fährt mit.' },
  { id: 'stroller', label: 'Kinderwagen', text: 'Kinderwagen muss mit.' },
  { id: 'bigSpace', label: 'viel Platz', text: 'Viel Platz im Auto ist wichtig.' },
  { id: 'towbar', label: 'Anhängerkupplung', text: 'Anhängerkupplung ist wichtig.' },
  { id: 'bigTrunk', label: 'großer Kofferraum', text: 'Großer Kofferraum ist wichtig.' },
  { id: 'color', label: 'Wunschfarbe', text: 'Wunschfarbe ist wichtig.' },
  { id: 'fastDelivery', label: 'schnell lieferbar', text: 'Schnelle Lieferung ist wichtig.' },
  { id: 'tradeIn', label: 'Inzahlungnahme', text: 'Inzahlungnahme ist wichtig.' },
  { id: 'leaseEnd', label: 'Leasing läuft aus', text: 'Leasing läuft bald aus.' },
  { id: 'rearCamera', label: 'Rückfahrkamera', text: 'Rückfahrkamera ist wichtig.' },
  { id: 'frontSensors', label: 'Parksensoren vorne', text: 'Parksensoren vorne sind wichtig.' },
  { id: 'camera360', label: '360° Kamera', text: '360° Kamera ist wichtig.' },
  { id: 'hud', label: 'Head-up-Display', text: 'Head-up-Display ist wichtig.' },
  { id: 'navi', label: 'Navi', text: 'Navigation ist wichtig.' },
  { id: 'powerTailgate', label: 'elektrische Heckklappe', text: 'Elektrische Heckklappe ist wichtig.' },
  { id: 'fastCharge', label: 'schnelle Ladezeit', text: 'Schnelle Ladezeit ist wichtig.' },
  { id: 'wallbox', label: 'Wallbox vorhanden', text: 'Wallbox zu Hause ist vorhanden.' },
  { id: 'publicCharging', label: 'öffentlich laden', text: 'Öffentliches Laden ist wichtig.' },
  { id: 'v2l', label: 'V2L', text: 'Vehicle-to-Load ist wichtig.' },
  { id: 'heatPump', label: 'Wärmepumpe', text: 'Wärmepumpe ist wichtig.' },
  { id: 'range', label: 'Reichweite wichtig', text: 'Große Reichweite ist wichtig.' },
  { id: 'budget300', label: 'bis 300 €/Monat', text: 'Budget bis 300 Euro im Monat.' },
  { id: 'budget400', label: 'bis 400 €/Monat', text: 'Budget bis 400 Euro im Monat.' },
  { id: 'budget500', label: 'bis 500 €/Monat', text: 'Budget bis 500 Euro im Monat.' },
  { id: 'downPayment', label: 'Anzahlung möglich', text: 'Anzahlung ist möglich.' },
  { id: 'noDownPayment', label: 'ohne Anzahlung', text: 'Ohne Anzahlung bevorzugt.' },
  { id: 'leasing', label: 'Leasing', text: 'Leasing ist bevorzugt.' },
  { id: 'financing', label: 'Finanzierung', text: 'Finanzierung ist bevorzugt.' },
  { id: 'caravan', label: 'Wohnwagen', text: 'Wohnwagen ist wichtig.' },
  { id: 'roofTent', label: 'Dachzelt', text: 'Dachzelt ist wichtig.' },
  { id: 'bikeRack', label: 'Fahrradträger', text: 'Fahrradträger ist wichtig.' },
  { id: 'camping', label: 'Camping', text: 'Camping ist wichtig.' },
  { id: 'ski', label: 'Ski', text: 'Ski-Transport ist wichtig.' },
  { id: 'commuter', label: 'Pendler', text: 'Pendeln ist wichtig.' },
];

export const QUICK_HANDOFF_CATEGORIES = [
  {
    id: 'family',
    label: 'Familie',
    icon: '👨‍👩‍👧',
    chipIds: ['twoChildren', 'childSeats', 'dog', 'stroller', 'bigSpace'],
  },
  {
    id: 'car',
    label: 'Auto',
    icon: '🚗',
    chipIds: ['towbar', 'bigTrunk', 'color', 'fastDelivery', 'tradeIn', 'leaseEnd'],
  },
  {
    id: 'tech',
    label: 'Technik',
    icon: '⚙️',
    chipIds: ['rearCamera', 'frontSensors', 'camera360', 'hud', 'navi', 'powerTailgate'],
  },
  {
    id: 'elektro',
    label: 'Elektro',
    icon: '🔌',
    chipIds: ['fastCharge', 'wallbox', 'publicCharging', 'v2l', 'heatPump', 'range'],
    requiresElektro: true,
  },
  {
    id: 'budget',
    label: 'Budget',
    icon: '💶',
    chipIds: ['budget300', 'budget400', 'budget500', 'downPayment', 'noDownPayment', 'leasing', 'financing'],
  },
  {
    id: 'hobby',
    label: 'Hobby / Alltag',
    icon: '🏕️',
    chipIds: ['caravan', 'roofTent', 'bikeRack', 'camping', 'ski', 'commuter'],
  },
];

export const QUICK_HANDOFF_COPY = {
  sectionLabel: 'Optional – keine Pflicht',
  title: 'Falls Sie möchten: Was sollte Ihr Berater noch wissen?',
  subtitle: 'Keine Pflicht.',
  freetextPlaceholder:
    'Zum Beispiel: Mein Kuga läuft im November aus, meine Frau fährt überwiegend, '
    + 'Lieferzeit ist wichtiger als Rate.',
};

const QUICK_HANDOFF_CHIP_MAP = Object.fromEntries(
  QUICK_HANDOFF_ENRICHMENT_CHIPS.map((chip) => [chip.id, chip]),
);

export function getQuickHandoffChip(chipId) {
  return QUICK_HANDOFF_CHIP_MAP[chipId] ?? null;
}

function labelBlob(session = {}) {
  return [
    ...(session.needProfile?.understoodLabels ?? []),
    ...(session.notepadLabels ?? []),
    ...(session.vehicleNotepadLabels ?? []),
  ].join(' ').toLowerCase();
}

/**
 * Smarte Vorbelegung aus bestehendem needProfile – keine zweite Wahrheit.
 * @param {object} session
 */
export function inferPrefilledHandoffChipIds(session = {}) {
  const needProfile = session.needProfile ?? {};
  const blob = labelBlob(session);
  const ids = new Set();

  if (needProfile.children === 2 || /\b2 kinder\b/i.test(blob)) ids.add('twoChildren');
  if (/kindersitz/i.test(blob)) ids.add('childSeats');
  if (needProfile.dog || /\bhund\b/i.test(blob)) ids.add('dog');
  if (/kinderwagen/i.test(blob)) ids.add('stroller');
  if (/viel platz|großer kofferraum|grosser kofferraum/i.test(blob)) {
    ids.add('bigSpace');
    ids.add('bigTrunk');
  }

  if (needProfile.towing || /anhäng|ahk|kupplung|anhaenger/i.test(blob)) ids.add('towbar');
  if (needProfile.colorHint || /\bfarbe\b/i.test(blob)) ids.add('color');
  if (/liefer|schnell liefer/i.test(blob)) ids.add('fastDelivery');
  if (/inzahlung|restwert/i.test(blob)) ids.add('tradeIn');
  if (/leasing|fahrzeugwechsel|läuft aus|laeuft aus/i.test(blob)) {
    ids.add('leaseEnd');
    ids.add('leasing');
  }

  if (/rückfahr|rueckfahr/i.test(blob)) ids.add('rearCamera');
  if (/parksensor|einpark/i.test(blob)) ids.add('frontSensors');
  if (/360|kamera/i.test(blob)) ids.add('camera360');
  if (/head-up|hud/i.test(blob)) ids.add('hud');
  if (/navi|navigation/i.test(blob)) ids.add('navi');
  if (/heckklappe/i.test(blob)) ids.add('powerTailgate');

  if (isElectricOrPhevProfile(needProfile)) {
    if (/schnell.*lad|dc.?lad/i.test(blob)) ids.add('fastCharge');
    if (needProfile.chargingAtHome === 'yes' || /wallbox|laden zuhause/i.test(blob)) {
      ids.add('wallbox');
    }
    if (/öffentlich|oeffentlich.*lad/i.test(blob)) ids.add('publicCharging');
    if (/\bv2l\b/i.test(blob)) ids.add('v2l');
    if (/wärme|waerme|pumpe/i.test(blob)) ids.add('heatPump');
    if (/reichweite/i.test(blob) || needProfile.priorities?.includes('range')) ids.add('range');
  }

  const rate = needProfile.budget?.maxMonthlyRate;
  if (rate) {
    if (rate <= 300) ids.add('budget300');
    else if (rate <= 400) ids.add('budget400');
    else if (rate <= 500) ids.add('budget500');
    else ids.add('budget500');
  }
  if (needProfile.budget?.paymentType === 'leasing' || /leasing/i.test(blob)) ids.add('leasing');
  if (needProfile.budget?.paymentType === 'finance' || /finanzierung/i.test(blob)) ids.add('financing');
  if (/anzahlung/i.test(blob)) ids.add('downPayment');
  if (/ohne anzahlung/i.test(blob)) ids.add('noDownPayment');

  if (/wohnwagen|caravan/i.test(blob)) ids.add('caravan');
  if (/dachzelt/i.test(blob)) ids.add('roofTent');
  if (/fahrrad/i.test(blob)) ids.add('bikeRack');
  if (/camping/i.test(blob)) ids.add('camping');
  if (/ski/i.test(blob)) ids.add('ski');
  if (/pendl/i.test(blob)) ids.add('commuter');

  return [...ids];
}

/**
 * Nur neue Chip-Auswahl mergen – bereits verstandenes nicht doppelt schreiben.
 */
export function filterNewHandoffChipIds(session = {}, selectedChipIds = []) {
  const understood = new Set(inferPrefilledHandoffChipIds(session));
  return selectedChipIds.filter((id) => !understood.has(id));
}

/**
 * Kategorien für Kontaktphase – Elektro nur bei EV/Hybrid-Kontext.
 */
export function getVisibleHandoffCategories(needProfile = {}) {
  const showElektro = isElectricOrPhevProfile(needProfile)
    || getFuelCategory(needProfile) === 'electric';
  return QUICK_HANDOFF_CATEGORIES.filter(
    (category) => !category.requiresElektro || showElektro,
  );
}

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
