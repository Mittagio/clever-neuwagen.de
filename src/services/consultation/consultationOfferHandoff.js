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
import { isElectricOrPhevProfile } from './conversationPlanner.js';

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

const WISH_PROFILE_MODEL_LABELS = {
  ev3: 'EV3',
  ev4: 'EV4',
  'ev4-fastback': 'EV4',
  ev5: 'EV5',
  ev6: 'EV6',
  ev9: 'EV9',
  sportage: 'Sportage',
  sorento: 'Sorento',
  stonic: 'Stonic',
  carnival: 'Carnival',
};

/**
 * Kompakte Profil-Darstellung aus bestehendem Verständnis – nur Präsentation.
 * @param {object} [needProfile]
 * @param {string[]} [labels]
 */
export function buildWishProfilePresentation(needProfile = {}, labels = []) {
  const sourceLabels = labels.length ? [...labels] : [...(needProfile.understoodLabels ?? [])];
  const consumed = new Set();
  const lines = [];

  const take = (regex) => {
    const idx = sourceLabels.findIndex((label, i) => !consumed.has(i) && regex.test(label));
    if (idx === -1) return null;
    consumed.add(idx);
    return sourceLabels[idx];
  };

  const fuelFromProfile = needProfile.fuel === 'electric'
    ? 'Elektro'
    : (needProfile.fuel === 'hybrid' || needProfile.fuel === 'phev' ? 'Hybrid' : null);
  const fuelLabel = take(/^elektro$|^hybrid$|^plug-in/i) || fuelFromProfile;
  const bodyLabel = take(/^suv$|^kombi$|^van$|^limousine$/i)
    || (needProfile.bodyType === 'suv' ? 'SUV' : null);
  if (fuelLabel && bodyLabel) {
    lines.push({ icon: '⚡', text: `${fuelLabel} ${bodyLabel}` });
  } else if (fuelLabel) {
    lines.push({ icon: '⚡', text: fuelLabel });
  }

  const modelKey = needProfile.selectedModelKey ?? needProfile.modelHint;
  const modelPart = modelKey
    ? (WISH_PROFILE_MODEL_LABELS[modelKey] ?? String(modelKey).toUpperCase())
    : take(/^ev\d|^sportage|^sorento|^stonic|^carnival/i);
  const trimPart = take(/^earth$|^gt-?line$|^spirit$|^premium$/i)
    || (needProfile.trimHint === 'earth' ? 'Earth' : null);
  if (modelPart) {
    const vehicleText = trimPart && !String(modelPart).toLowerCase().includes(String(trimPart).toLowerCase())
      ? `Kia ${modelPart} ${trimPart}`
      : (String(modelPart).startsWith('Kia') ? modelPart : `Kia ${modelPart}`);
    lines.push({ icon: '🚗', text: vehicleText });
  }

  const leasingLabel = take(/^leasing$/i);
  const budgetLabel = take(/budget|€\/monat|euro.*monat/i);
  const budgetFromProfile = needProfile.budget?.maxMonthlyRate
    ? `Leasing bis ${needProfile.budget.maxMonthlyRate} €/Monat`
    : null;
  if (budgetFromProfile) {
    lines.push({ icon: '💶', text: budgetFromProfile });
  } else if (budgetLabel) {
    const text = leasingLabel
      ? budgetLabel.replace(/^budget\s*/i, 'Leasing bis ')
      : budgetLabel;
    lines.push({ icon: '💶', text });
  } else if (leasingLabel) {
    lines.push({ icon: '💶', text: leasingLabel });
  }

  const months = take(/\d+\s*monate/i)
    || (needProfile.leaseDurationMonths ? `${needProfile.leaseDurationMonths} Monate` : null);
  const km = take(/\d+[\d.]*\s*km/i)
    || (needProfile.annualKm
      ? `${needProfile.annualKm.toLocaleString('de-DE')} km/Jahr`
      : null);
  if (months && km) {
    lines.push({ icon: '📅', text: `${months} · ${km}` });
  } else if (months) {
    lines.push({ icon: '📅', text: months });
  } else if (km) {
    lines.push({ icon: '📅', text: km });
  }

  const tow = take(/anhäng|ahk|kupplung/i) || (needProfile.towing ? 'Anhängerkupplung' : null);
  if (tow) {
    lines.push({ icon: '🔗', text: /anhäng|ahk|kupplung/i.test(tow) ? tow : 'Anhängerkupplung' });
  }

  const color = needProfile.colorHint || take(/^blau$|^rot$|^weiß$|^schwarz$|^grün$/i);
  if (color) {
    lines.push({ icon: '🎨', text: color });
  }

  const family = take(/familie|\d+\s*kinder/i)
    || (needProfile.children ? `${needProfile.children} Kinder` : null);
  if (family && lines.length < 7) {
    lines.push({ icon: '👨‍👩‍👧', text: family });
  }

  for (let i = 0; i < sourceLabels.length && lines.length < 7; i += 1) {
    if (consumed.has(i)) continue;
    const label = sourceLabels[i];
    if (/^elektro$|^suv$|^earth$|^leasing$|^ev\d$/i.test(label)) continue;
    lines.push({ icon: '·', text: label });
    consumed.add(i);
  }

  if (!lines.length) {
    sourceLabels.slice(0, 5).forEach((label) => lines.push({ icon: '·', text: label }));
  }

  return {
    title: 'Ihr Wunschprofil',
    lines: lines.slice(0, 7),
    footer: 'Ihr Berater muss nicht bei null anfangen.',
  };
}

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
    role: 'Kia Spezialist aus Schorndorf',
    tagline: 'Seit über 14 Jahren im Kia Vertrieb.',
    experience: 'Seit über 14 Jahren im Kia Vertrieb.',
    initials: buildAdvisorInitials(name),
    phone: seller?.phone ?? dealerConditions?.contact?.phone ?? null,
    email: seller?.email ?? dealerConditions?.contact?.email ?? null,
    message:
      'Ich schaue mir Ihren Wunsch persönlich an '
      + 'und melde mich mit einer passenden Lösung.',
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
    wishProfile: buildWishProfilePresentation(session.needProfile ?? {}, session.notepadLabels ?? []),
    wishLabels: session.notepadLabels ?? [],
    vehicleLabels: session.vehicleNotepadLabels ?? [],
    directionLine: session.vehicleMiniRecommendation?.batteryLine ?? null,
    trimLine: session.vehicleMiniRecommendation?.trimLine ?? null,
    advisor: defaultAdvisor(dealerConditions),
    hasRate: false,
    hasOffer: false,
  };
}

/** Mindest-Verständnis (0–100) für frühen Wunsch-CTA. */
export const WISH_HANDOFF_MIN_CONFIDENCE = 45;

/**
 * @param {object} needProfile
 */
export function normalizeNeedProfileConfidence(needProfile = {}) {
  const raw = Number(needProfile?.confidence ?? 0);
  if (!Number.isFinite(raw)) return 0;
  return raw <= 1 ? raw * 100 : raw;
}

/**
 * @param {object} needProfile
 */
export function hasRecognizedModelInProfile(needProfile = {}) {
  return Boolean(needProfile.selectedModelKey || needProfile.modelHint);
}

/**
 * @param {object} needProfile
 */
export function hasRecognizedBudgetInProfile(needProfile = {}) {
  const budget = needProfile.budget ?? {};
  return Boolean(budget.maxMonthlyRate || budget.maxPrice);
}

const USAGE_LABEL_PATTERN = /Familie|Alltag|Zweitwagen|Anhänger|Gewerbe|Arbeit|Kurzstrecke|Langstrecke|Urlaub/i;

/**
 * @param {object} needProfile
 * @param {object} [session]
 */
export function hasRecognizedUsageInProfile(needProfile = {}, session = {}) {
  if ((needProfile.usage?.length ?? 0) > 0) return true;
  if (session.consultationProfile?.answers?.primaryUsage) return true;
  if (needProfile.priorities?.includes('family') || needProfile.children) return true;
  const labels = [
    ...(needProfile.understoodLabels ?? []),
    ...(session.notepadLabels ?? []),
  ];
  return labels.some((label) => USAGE_LABEL_PATTERN.test(label));
}

/**
 * Sticky Wunsch-CTA: Modell, Budget, Nutzung oder ausreichend Verständnis.
 * @param {object} session
 */
export function shouldShowWishHandoffCta(session = {}) {
  const needProfile = session.needProfile ?? {};
  if (hasRecognizedModelInProfile(needProfile)) return true;
  if (hasRecognizedBudgetInProfile(needProfile)) return true;
  if (hasRecognizedUsageInProfile(needProfile, session)) return true;
  if (normalizeNeedProfileConfidence(needProfile) >= WISH_HANDOFF_MIN_CONFIDENCE) return true;
  return false;
}

/**
 * Copy für „Wunsch an Autohaus senden“.
 * @param {string} [dealerName]
 */
export function buildWishHandoffCta(dealerName = 'Autohaus') {
  const name = String(dealerName || 'Autohaus').trim();
  return {
    buttonTitle: `Wunsch an ${name} senden`,
    subline: 'Ihr persönlicher Ansprechpartner meldet sich mit einer passenden Lösung.',
    stickySubline: 'Ihr Ansprechpartner kann bereits übernehmen.',
    reassurance: 'Ohne Verpflichtung. Sie entscheiden selbst, wie es weitergeht.',
    compactReassurance: 'Ohne Verpflichtung. Kein Rückrufzwang.',
  };
}

/**
 * @deprecated Nutze buildWishHandoffCta
 */
export function buildAdvisorContactPrompt(labelCount = 0, variant = 'engaged') {
  if (variant === 'opening' || labelCount <= 0) return null;
  return {
    level: variant,
    hint: null,
    optionalNote: buildWishHandoffCta().compactReassurance,
  };
}

/** Optionaler Berater-Boost – Chips für mergeTextIntoNeedProfile. */
export const QUICK_HANDOFF_ENRICHMENT_CHIPS = [
  { id: 'seatHeating', label: 'Sitzheizung', text: 'Sitzheizung ist wichtig.' },
  { id: 'steeringWheelHeating', label: 'Lenkradheizung', text: 'Lenkradheizung ist wichtig.' },
  { id: 'powerTailgate', label: 'Elektrische Heckklappe', text: 'Elektrische Heckklappe ist wichtig.' },
  { id: 'panoramicRoof', label: 'Panoramadach', text: 'Panoramadach ist wichtig.' },
  { id: 'seatVentilation', label: 'Sitzbelüftung', text: 'Sitzbelüftung ist wichtig.' },
  { id: 'memorySeats', label: 'Memory-Sitze', text: 'Memory-Sitze sind wichtig.' },
  { id: 'ledLight', label: 'LED-Licht', text: 'LED-Licht ist wichtig.' },
  { id: 'matrixLed', label: 'Matrix-LED', text: 'Matrix-LED ist wichtig.' },
  { id: 'frontParkingSensors', label: 'Parksensoren vorne', text: 'Parksensoren vorne sind wichtig.' },
  { id: 'rearCamera', label: 'Rückfahrkamera', text: 'Rückfahrkamera ist wichtig.' },
  { id: 'camera360', label: '360° Kamera', text: '360° Kamera ist wichtig.' },
  { id: 'hud', label: 'Head-up-Display', text: 'Head-up-Display ist wichtig.' },
  { id: 'navi', label: 'Navi', text: 'Navigation ist wichtig.' },
  { id: 'appleCarPlay', label: 'Apple CarPlay', text: 'Apple CarPlay ist wichtig.' },
  { id: 'androidAuto', label: 'Android Auto', text: 'Android Auto ist wichtig.' },
  { id: 'fastCharging', label: 'Schnelles Laden', text: 'Schnelles Laden ist wichtig.' },
  { id: 'heatPump', label: 'Wärmepumpe', text: 'Wärmepumpe ist wichtig.' },
  { id: 'v2l', label: 'V2L', text: 'Vehicle-to-Load ist wichtig.' },
  { id: 'rangeImportant', label: 'Reichweite wichtig', text: 'Große Reichweite ist wichtig.' },
  { id: 'wallboxAvailable', label: 'Wallbox vorhanden', text: 'Wallbox zu Hause ist vorhanden.' },
  { id: 'publicCharging', label: 'Öffentlich laden', text: 'Öffentliches Laden ist wichtig.' },
  { id: 'towbar', label: 'Anhängerkupplung', text: 'Anhängerkupplung ist wichtig.' },
  { id: 'bigTrunk', label: 'Großer Kofferraum', text: 'Großer Kofferraum ist wichtig.' },
  { id: 'dog', label: 'Hund', text: 'Hund fährt mit.' },
  { id: 'stroller', label: 'Kinderwagen', text: 'Kinderwagen muss mit.' },
  { id: 'colorWish', label: 'Wunschfarbe', text: 'Wunschfarbe ist wichtig.' },
  { id: 'fastDelivery', label: 'Schnell lieferbar', text: 'Schnelle Lieferung ist wichtig.' },
  { id: 'bikeRack', label: 'Fahrradträger', text: 'Fahrradträger ist wichtig.' },
  { id: 'roofBox', label: 'Dachbox', text: 'Dachbox ist wichtig.' },
  { id: 'horseTrailer', label: 'Pferdeanhänger', text: 'Pferdeanhänger muss gezogen werden.' },
  { id: 'tradeIn', label: 'Inzahlungnahme', text: 'Inzahlungnahme ist wichtig.' },
  { id: 'leaseEnding', label: 'Leasing läuft aus', text: 'Leasing läuft bald aus.' },
  { id: 'residualValueTakeover', label: 'Restwertübernahme', text: 'Restwertübernahme ist wichtig.' },
  { id: 'rateImportant', label: 'Rate wichtig', text: 'Die monatliche Rate ist wichtig.' },
  { id: 'noDownPayment', label: 'Ohne Anzahlung', text: 'Ohne Anzahlung bevorzugt.' },
  { id: 'downPaymentPossible', label: 'Anzahlung möglich', text: 'Anzahlung ist möglich.' },
  { id: 'budget300', label: 'bis 300 €/Monat', text: 'Budget bis 300 Euro im Monat.' },
  { id: 'budget400', label: 'bis 400 €/Monat', text: 'Budget bis 400 Euro im Monat.' },
  { id: 'budget500', label: 'bis 500 €/Monat', text: 'Budget bis 500 Euro im Monat.' },
  { id: 'budget600', label: 'bis 600 €/Monat', text: 'Budget bis 600 Euro im Monat.' },
];

export const ADVISOR_BOOST_CATEGORIES = [
  {
    id: 'comfort',
    label: 'Komfort',
    chipIds: ['seatHeating', 'steeringWheelHeating', 'powerTailgate', 'panoramicRoof', 'seatVentilation', 'memorySeats'],
  },
  {
    id: 'tech',
    label: 'Technik',
    chipIds: ['ledLight', 'matrixLed', 'frontParkingSensors', 'rearCamera', 'camera360', 'hud', 'navi', 'appleCarPlay', 'androidAuto'],
  },
  {
    id: 'elektro',
    label: 'Elektro',
    requiresElectric: true,
    chipIds: ['fastCharging', 'heatPump', 'v2l', 'rangeImportant', 'wallboxAvailable', 'publicCharging'],
  },
  {
    id: 'daily',
    label: 'Alltag',
    chipIds: ['towbar', 'bigTrunk', 'dog', 'stroller', 'colorWish', 'fastDelivery', 'bikeRack', 'roofBox', 'horseTrailer'],
  },
  {
    id: 'offer',
    label: 'Angebot',
    chipIds: [
      'tradeIn', 'leaseEnding', 'residualValueTakeover', 'rateImportant',
      'noDownPayment', 'downPaymentPossible',
      'budget300', 'budget400', 'budget500', 'budget600',
    ],
  },
];

export const ADVISOR_BOOST_LEASING_BUDGET_CHIP_IDS = [
  'budget300', 'budget400', 'budget500', 'budget600',
];

export const ADVISOR_BOOST_COMPLEMENTARY_CHIP_IDS = [
  'seatHeating', 'heatPump', 'v2l', 'hud', 'bigTrunk', 'stroller',
  'steeringWheelHeating', 'frontParkingSensors', 'rearCamera', 'panoramicRoof',
];

export const ADVISOR_BOOST_HIGHLIGHT_GROUPS = [
  {
    id: 'popular',
    icon: '🔥',
    label: 'Oft zusätzlich wichtig',
    chipIds: ['seatHeating', 'frontParkingSensors', 'rearCamera', 'ledLight'],
  },
  {
    id: 'elektroPopular',
    icon: '⚡',
    label: 'Beim Elektroauto häufig gefragt',
    requiresElectric: true,
    chipIds: ['heatPump', 'v2l', 'fastCharging'],
  },
  {
    id: 'offerPopular',
    icon: '💶',
    label: 'Rund ums Angebot',
    chipIds: ['tradeIn', 'leaseEnding', 'residualValueTakeover'],
  },
];

export const ADVISOR_COLLECT_COPY = {
  sectionLabel: 'Optional — keine Pflicht',
  title: 'Was sollten wir Ihrem Berater noch mitgeben?',
  subtitle: 'Keine Pflicht.',
  reassurance: 'Ihr Berater kann bereits übernehmen.',
  intro: 'Falls Sie möchten, können Sie ihm noch etwas mitgeben.',
  freetextLabel: 'Gibt es noch etwas, das Ihr Verkäufer wissen sollte?',
  freetextPlaceholder:
    'Meine Frau fährt überwiegend.\n'
    + 'Blau wäre schön.\n'
    + 'Dachreling wäre wichtig.\n'
    + 'Mein Leasing läuft im November aus.',
  submitLabel: 'Kontakt senden',
};

export const QUICK_HANDOFF_COPY = {
  expandLabel: 'Optional ▾',
  collapseLabel: 'Optional ▴',
  sectionLabel: 'Optional — keine Pflicht',
  reassurance: 'Ihr Berater kann bereits übernehmen.',
  intro: 'Falls Sie möchten, können Sie ihm noch etwas mitgeben.',
  showMoreLabel: 'Mehr anzeigen ▾',
  showLessLabel: 'Weniger anzeigen ▴',
  suggestionsLabel: 'Vielleicht noch interessant:',
  freetextLabel: 'Gibt es noch etwas, das Ihr Verkäufer wissen sollte?',
  freetextPlaceholder:
    'Mein Kuga läuft im November aus.\n'
    + 'Meine Frau fährt überwiegend.\n'
    + 'Lieferzeit ist wichtiger als die Rate.\n'
    + 'Ein Pferdeanhänger muss gezogen werden.\n'
    + 'Sitzheizung und PDC vorne wären schön.',
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

function isLeasingContext(needProfile = {}, blob = '') {
  return needProfile.budget?.paymentType === 'leasing'
    || /\bleasing\b/i.test(blob)
    || /\d+\s*€?\s*(im monat|\/monat|pro monat)/i.test(blob);
}

/**
 * Bereits erkannte Wünsche – diese Chips werden nicht erneut angeboten.
 * @param {object} session
 */
export function inferRecognizedBoostChipIds(session = {}) {
  const needProfile = session.needProfile ?? {};
  const blob = labelBlob(session);
  const ids = new Set();

  if (/sitzheiz/i.test(blob)) ids.add('seatHeating');
  if (/lenkradheiz/i.test(blob)) ids.add('steeringWheelHeating');
  if (/heckklappe/i.test(blob)) ids.add('powerTailgate');
  if (/panorama/i.test(blob)) ids.add('panoramicRoof');
  if (/sitzbelüft|sitzbelueft/i.test(blob)) ids.add('seatVentilation');
  if (/memory/i.test(blob)) ids.add('memorySeats');

  if (/\bled\b/i.test(blob) && !/matrix/i.test(blob)) ids.add('ledLight');
  if (/matrix.?led/i.test(blob)) ids.add('matrixLed');
  if (/parksensor|pdc|einpark/i.test(blob)) ids.add('frontParkingSensors');
  if (/rückfahr|rueckfahr/i.test(blob)) ids.add('rearCamera');
  if (/360|umgebung/i.test(blob)) ids.add('camera360');
  if (/head-up|hud/i.test(blob)) ids.add('hud');
  if (/navi|navigation/i.test(blob)) ids.add('navi');
  if (/carplay/i.test(blob)) ids.add('appleCarPlay');
  if (/android auto/i.test(blob)) ids.add('androidAuto');

  if (/schnell.*lad|dc.?lad/i.test(blob)) ids.add('fastCharging');
  if (/wärme|waerme|pumpe/i.test(blob) || needProfile.priorities?.includes('heatPump')) {
    ids.add('heatPump');
  }
  if (/\bv2l\b/i.test(blob)) ids.add('v2l');
  if (/reichweite/i.test(blob) || needProfile.priorities?.includes('range')) ids.add('rangeImportant');
  if (needProfile.chargingAtHome === 'yes' || /wallbox|laden zuhause/i.test(blob)) {
    ids.add('wallboxAvailable');
  }
  if (/öffentlich|oeffentlich.*lad/i.test(blob)) ids.add('publicCharging');

  if (needProfile.towing || /anhäng|ahk|kupplung|anhaenger/i.test(blob)) ids.add('towbar');
  if (/großer kofferraum|grosser kofferraum|viel platz/i.test(blob)) ids.add('bigTrunk');
  if (needProfile.dog || /\bhund\b/i.test(blob)) ids.add('dog');
  if (/kinderwagen/i.test(blob)) ids.add('stroller');
  if (needProfile.colorHint || /\bfarbe\b|wunschfarbe/i.test(blob)) ids.add('colorWish');
  if (/liefer|schnell liefer|schnell verfüg|schnell verfueg/i.test(blob)) ids.add('fastDelivery');
  if (/fahrrad/i.test(blob)) ids.add('bikeRack');
  if (/dachbox/i.test(blob)) ids.add('roofBox');
  if (/pferde/i.test(blob)) ids.add('horseTrailer');

  if (/inzahlung|restwert/i.test(blob)) ids.add('tradeIn');
  if (/leasing.*aus|läuft aus|laeuft aus|fahrzeugwechsel/i.test(blob)) ids.add('leaseEnding');
  if (/restwertübernahme|restwertuebernahme/i.test(blob)) ids.add('residualValueTakeover');
  if (/rate wichtig|monatliche rate/i.test(blob) || needProfile.priorities?.includes('rate')) {
    ids.add('rateImportant');
  }
  if (/ohne anzahlung/i.test(blob)) ids.add('noDownPayment');
  if (/anzahlung/i.test(blob)) ids.add('downPaymentPossible');

  const rate = needProfile.budget?.maxMonthlyRate;
  if (rate) {
    if (rate <= 300) ids.add('budget300');
    else if (rate <= 400) ids.add('budget400');
    else if (rate <= 500) ids.add('budget500');
    else ids.add('budget600');
  }

  return [...ids];
}

/** @deprecated Alias – erkannte Chips, keine Vorbelegung. */
export const inferPrefilledHandoffChipIds = inferRecognizedBoostChipIds;

/**
 * Nur neue Chip-Auswahl mergen – bereits verstandenes nicht doppelt schreiben.
 */
export function filterNewHandoffChipIds(session = {}, selectedChipIds = []) {
  const understood = new Set(inferRecognizedBoostChipIds(session));
  return selectedChipIds.filter((id) => !understood.has(id));
}

/**
 * Kategorien und Entdeckungs-Chips für den optionalen Berater-Boost.
 */
export function buildAdvisorBoostView(session = {}) {
  const needProfile = session.needProfile ?? {};
  const blob = labelBlob(session);
  const recognized = new Set(inferRecognizedBoostChipIds(session));
  const isElectric = isElectricOrPhevProfile(needProfile);
  const isLeasing = isLeasingContext(needProfile, blob);

  const highlights = ADVISOR_BOOST_HIGHLIGHT_GROUPS
    .filter((group) => !group.requiresElectric || isElectric)
    .map((group) => ({
      id: group.id,
      icon: group.icon,
      label: group.label,
      chips: group.chipIds
        .filter((chipId) => !recognized.has(chipId))
        .map((chipId) => getQuickHandoffChip(chipId))
        .filter(Boolean),
    }))
    .filter((group) => group.chips.length > 0);

  const categories = ADVISOR_BOOST_CATEGORIES
    .filter((category) => !category.requiresElectric || isElectric)
    .map((category) => ({
      id: category.id,
      label: category.label,
      chips: category.chipIds
        .filter((chipId) => {
          if (!isLeasing && ADVISOR_BOOST_LEASING_BUDGET_CHIP_IDS.includes(chipId)) return false;
          return !recognized.has(chipId);
        })
        .map((chipId) => getQuickHandoffChip(chipId))
        .filter(Boolean),
    }))
    .filter((category) => category.chips.length > 0);

  const suggestions = ADVISOR_BOOST_COMPLEMENTARY_CHIP_IDS
    .filter((chipId) => !recognized.has(chipId))
    .map((chipId) => getQuickHandoffChip(chipId))
    .filter(Boolean)
    .slice(0, 6);

  return {
    highlights,
    categories,
    suggestions,
    showSuggestions: false,
    copy: QUICK_HANDOFF_COPY,
  };
}

/** @deprecated Nutze buildAdvisorBoostView. */
export function getVisibleHandoffChips(needProfile = {}) {
  return buildAdvisorBoostView({ needProfile }).categories.flatMap((c) => c.chips);
}

/** @deprecated */
export function getVisibleHandoffCategories(needProfile = {}) {
  return buildAdvisorBoostView({ needProfile }).categories.map((category) => ({
    id: category.id,
    label: category.label,
    chipIds: category.chips.map((chip) => chip.id),
  }));
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
