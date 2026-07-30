/**
 * Deterministische Interpretation von Seller Universal Input.
 * Keine Persistenz – nur Extraktion + Intent-Ranking.
 */
import {
  SELLER_FACT_CLASS,
  SELLER_FACT_SOURCE,
  SELLER_INPUT_MODE,
  SELLER_TURN_INTENTS,
} from './sellerFactTypes.js';
import { createExtractedFact } from './cleverSellerTurnResultSchema.js';
import {
  SELLER_ACTION_INTENTS,
  detectSellerActionIntent,
  extractSellerFactsFromInput,
} from '../dealer/sellerActionIntent.js';
import {
  APPOINTMENT_TYPES,
  appointmentTypeLabel,
  detectAppointmentType,
  formatAppointmentWhen,
  parseAppointmentDateTime,
} from '../dealer/sellerAppointmentAssistFlow.js';
import {
  extractSellerFactsFromOfferPdfText,
  mergeOfferPdfFactsIntoSellerFacts,
  shouldEnrichSellerInputFromOfferPdf,
} from './mapMagicOfferIntentToSellerFacts.js';
import {
  REJECTION_REASON,
  VEHICLE_TRACK_STATUS,
} from '../crm/vehicleTrack.js';

const MONTH_MAP = {
  januar: '01', jan: '01',
  februar: '02', feb: '02',
  märz: '03', maerz: '03', mar: '03',
  april: '04', apr: '04',
  mai: '05',
  juni: '06', jun: '06',
  juli: '07', jul: '07',
  august: '08', aug: '08',
  september: '09', sep: '09', sept: '09',
  oktober: '10', okt: '10',
  november: '11', nov: '11',
  dezember: '12', dez: '12',
};

/** Kia-Modelle, die als Neuwagen-Interesse gelten (nicht als aktuelles Fzg.). */
const KIA_INTEREST_MODEL_RE = 'EV[2-9]|Sportage|Sorento|Ceed|XCeed|Niro|Picanto|Seltos|K4|Stonic|Rio|Proceed|Soul|Carnival|Tivoli';
const KIA_INTEREST_TRIM_RE = 'SW|GT-?Line|X-?Line(?:\\s*\\d+)?|Spirit|Earth|Vision|Air|DriveWise';
const EXISTING_MAKE_RE = 'ford|vw|volkswagen|opel|bmw|audi|mercedes|toyota|hyundai|kia|skoda|škoda|seat|renault|peugeot|mini|mazda|nissan|cupra|dacia';
const NAME_STOP = /^(kia|ford|vw|volkswagen|skoda|škoda|bmw|audi|mercedes|hyundai|opel|seat|toyota|interesse|probefahrt|termin|automatik|schalter|kunde|hat|der|die|das|ein|eine|einer|eines|mit|von|zum|zur|und|oder|auch|noch|schon|will|möchte|moechte|irgendwie|irgendwas|neues|neuen|neuem|auto|wagen|fahrzeug|leasing|finanzierung|angebot|nachricht|heute|morgen|bitte|sehr|gerne)$/i;

function titleCaseToken(token = '') {
  const s = String(token).trim();
  if (/^EV\d$/i.test(s) || /^K\d$/i.test(s)) return s.toUpperCase();
  if (/^SW$/i.test(s)) return 'SW';
  if (/^GT-?\s*Line$/i.test(s)) return 'GT-Line';
  if (/^X-?\s*Line(?:\s*\d+)?$/i.test(s)) {
    const num = s.match(/\d+/);
    return num ? `X-Line ${num[0]}` : 'X-Line';
  }
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}

function formatPhoneLabel(raw = '') {
  const digits = String(raw).replace(/\D/g, '');
  if (digits.length === 11 && digits.startsWith('0')) {
    return `${digits.slice(0, 4)} ${digits.slice(4)}`;
  }
  if (digits.length === 12 && digits.startsWith('49')) {
    return `0${digits.slice(2, 5)} ${digits.slice(5)}`;
  }
  return String(raw).replace(/\s+/g, ' ').trim();
}

function pushFact(list, fact) {
  if (!fact?.label) return;
  const key = `${fact.factClass}:${fact.field}:${String(fact.label).toLowerCase()}`;
  if (list.some((f) => `${f.factClass}:${f.field}:${String(f.label).toLowerCase()}` === key)) {
    return;
  }
  list.push(fact);
}

function parseMonthYear(text = '') {
  const t = String(text);
  const numeric = t.match(/\b(0?[1-9]|1[0-2])[./](20\d{2})\b/);
  if (numeric) {
    return `${numeric[2]}-${String(numeric[1]).padStart(2, '0')}`;
  }
  const short = t.match(/\b(0?[1-9]|1[0-2])\/(\d{2})\b/);
  if (short) {
    return `20${short[2]}-${String(short[1]).padStart(2, '0')}`;
  }
  const named = t.match(
    /\b(januar|jan|februar|feb|märz|maerz|mar|april|apr|mai|juni|jun|juli|jul|august|aug|september|sep|sept|oktober|okt|november|nov|dezember|dez)\.?\s*(20\d{2}|\d{2})\b/i,
  );
  if (named) {
    const month = MONTH_MAP[named[1].toLowerCase()];
    let year = named[2];
    if (year.length === 2) year = `20${year}`;
    return `${year}-${month}`;
  }
  return null;
}

/**
 * Multi-Fact Extraktion aus natürlichem Seller-Input.
 * @param {string} text
 */
export function extractUniversalSellerFacts(text = '') {
  const raw = String(text ?? '');
  const t = raw.replace(/\s+/g, ' ').trim();
  const facts = [];
  if (!t) return facts;

  // Self-disclosure / finance
  const net = t.match(/\b(?:netto|nettoeinkommen|einkommen)\s*(?:ca\.?\s*)?(\d{1,2}(?:[.\s]\d{3})*|\d{3,5})\b/i)
    || t.match(/\b(\d{3,5})\s*(?:€|euro)?\s*netto\b/i);
  if (net) {
    const value = Number(String(net[1]).replace(/[.\s]/g, ''));
    pushFact(facts, createExtractedFact({
      factClass: SELLER_FACT_CLASS.SELF_DISCLOSURE_FACT,
      field: 'monthlyNetIncome',
      value,
      label: `Netto ${value.toLocaleString('de-DE')} €`,
      confidence: 0.95,
    }));
  }

  if (/\bverheiratet\b/i.test(t)) {
    pushFact(facts, createExtractedFact({
      factClass: SELLER_FACT_CLASS.CUSTOMER_FACT,
      field: 'maritalStatus',
      value: 'married',
      label: 'verheiratet',
      confidence: 0.98,
    }));
  }
  if (/\bledig\b/i.test(t)) {
    pushFact(facts, createExtractedFact({
      factClass: SELLER_FACT_CLASS.CUSTOMER_FACT,
      field: 'maritalStatus',
      value: 'single',
      label: 'ledig',
      confidence: 0.95,
    }));
  }

  const children = t.match(/\b(\d)\s*kinder?\b/i) || t.match(/\bzwei\s*kinder\b/i);
  if (children) {
    const value = /zwei/i.test(children[0]) ? 2 : Number(children[1]);
    pushFact(facts, createExtractedFact({
      factClass: SELLER_FACT_CLASS.CUSTOMER_FACT,
      field: 'childrenCount',
      value,
      label: `${value} Kinder`,
      confidence: 0.97,
    }));
  }

  // Kontakt aus Outlook-/Notiz-Dumps (Name · Ort · Telefon)
  const phone = t.match(/\b(\+49[\s/-]?\d{2,5}[\s/-]?\d{3,10}|0\d{2,4}[\s/-]?\d{3,10})\b/);
  if (phone && !/\$|€|euro/i.test(phone[0])) {
    const digits = phone[1].replace(/\D/g, '');
    if (digits.length >= 10 && digits.length <= 13) {
      pushFact(facts, createExtractedFact({
        factClass: SELLER_FACT_CLASS.CUSTOMER_FACT,
        field: 'phone',
        value: digits,
        label: formatPhoneLabel(phone[1]),
        confidence: 0.94,
      }));
    }
  }

  const nameBeforeInterest = t.match(
    /\b([A-Za-zÄÖÜäöüß]+)\s+([A-Za-zÄÖÜäöüß]+)\s+([A-Za-zÄÖÜäöüß]+)\s+(?:interesse|probefahrt|termin)\b/i,
  ) || t.match(
    /\b([A-Za-zÄÖÜäöüß]+)\s+([A-Za-zÄÖÜäöüß]+)\s+(?:interesse|probefahrt|termin)\b/i,
  );
  if (nameBeforeInterest) {
    const parts = [nameBeforeInterest[1], nameBeforeInterest[2], nameBeforeInterest[3]]
      .filter(Boolean)
      .filter((p) => !NAME_STOP.test(p));
    if (parts.length >= 2) {
      let place = null;
      let nameParts = parts;
      if (parts.length >= 3) {
        const candidatePlace = parts[parts.length - 1];
        if (!NAME_STOP.test(candidatePlace) && candidatePlace.length >= 3) {
          place = titleCaseToken(candidatePlace);
          nameParts = parts.slice(0, -1);
        }
      }
      nameParts = nameParts.filter((p) => !NAME_STOP.test(p) && p.length >= 2);
      if (nameParts.length >= 2) {
        const name = nameParts.map(titleCaseToken).join(' ');
        pushFact(facts, createExtractedFact({
          factClass: SELLER_FACT_CLASS.CUSTOMER_FACT,
          field: 'customerName',
          value: name,
          label: name,
          confidence: 0.82,
          needsConfirmation: true,
        }));
        if (place) {
          pushFact(facts, createExtractedFact({
            factClass: SELLER_FACT_CLASS.CUSTOMER_FACT,
            field: 'customerPlace',
            value: place,
            label: place,
            confidence: 0.75,
            needsConfirmation: true,
          }));
        }
      }
    }
  }

  // Vehicle interest (Kia Neuwagen, inkl. Seltos / K4)
  const interestHits = [];
  const interestRe = new RegExp(
    `\\b(?:kia\\s+)?(${KIA_INTEREST_MODEL_RE})(?:\\s+(${KIA_INTEREST_TRIM_RE}))?\\b`,
    'gi',
  );
  let interestMatch = interestRe.exec(t);
  while (interestMatch) {
    const modelRaw = interestMatch[1];
    const trimRaw = interestMatch[2] || null;
    const modelKey = modelRaw.toLowerCase();
    const modelLabel = /^ev\d$/i.test(modelRaw)
      ? modelRaw.toUpperCase()
      : titleCaseToken(modelRaw);
    const trimLabel = trimRaw ? titleCaseToken(trimRaw.replace(/\s+/g, ' ')) : null;
    const label = trimLabel ? `Kia ${modelLabel} ${trimLabel}` : `Kia ${modelLabel}`;
    if (!interestHits.some((h) => h.label === label)) {
      interestHits.push({
        modelKey,
        trim: trimLabel,
        label,
        value: { make: 'Kia', modelKey, trim: trimLabel },
      });
    }
    interestMatch = interestRe.exec(t);
  }

  if (interestHits.length >= 2) {
    pushFact(facts, createExtractedFact({
      factClass: SELLER_FACT_CLASS.VEHICLE_INTEREST,
      field: 'vehicleInterestMulti',
      value: interestHits.map((h) => h.value),
      label: interestHits.map((h) => h.label.replace(/^Kia\s+/i, 'Kia ')).join(' / '),
      confidence: 0.93,
    }));
  } else if (interestHits.length === 1) {
    pushFact(facts, createExtractedFact({
      factClass: SELLER_FACT_CLASS.VEHICLE_INTEREST,
      field: 'vehicleInterest',
      value: interestHits[0].value,
      label: interestHits[0].label,
      confidence: 0.95,
    }));
  } else if (/\bev3\s+oder\s+ev5\b/i.test(t) || /\bev5\s+oder\s+ev3\b/i.test(t)) {
    pushFact(facts, createExtractedFact({
      factClass: SELLER_FACT_CLASS.VEHICLE_INTEREST,
      field: 'vehicleInterestMulti',
      value: ['ev3', 'ev5'],
      label: 'EV3 oder EV5',
      confidence: 0.9,
    }));
  }

  const hasInterest = interestHits.length > 0
    || facts.some((f) => f.factClass === SELLER_FACT_CLASS.VEHICLE_INTEREST);

  // Multi-Offer Track-Feedback (Brandes): Modell + Status / Ablehnung
  const trackFeedbackRe = new RegExp(
    `\\b(?:kia\\s+)?(${KIA_INTEREST_MODEL_RE})\\b([^.]{0,48}?)`
    + '(?:\\bzu\\s+teuer\\b|\\bzu\\s+hoch\\b|\\bzur[uü]ckgestellt\\b|\\bpasst\\s+nicht\\b'
    + '|\\bfavorit\\b|\\bgefällt\\b|\\bgefaellt\\b|\\blieblings?\\b|\\bmag\\s+(?:er|sie|kunde)\\b)',
    'gi',
  );
  let trackMatch = trackFeedbackRe.exec(t);
  while (trackMatch) {
    const modelRaw = trackMatch[1];
    const modelKey = modelRaw.toLowerCase();
    const modelLabel = /^ev\d$/i.test(modelRaw)
      ? modelRaw.toUpperCase()
      : titleCaseToken(modelRaw);
    const cue = trackMatch[0].toLowerCase();
    const deferred = /zu\s+teuer|zu\s+hoch|zur[uü]ckgestellt|passt\s+nicht/.test(cue);
    const favorite = /favorit|gefällt|gefaellt|lieblings?|mag\s+(?:er|sie|kunde)/.test(cue);
    if (deferred) {
      const rateCue = /rate|monat/.test(cue);
      pushFact(facts, createExtractedFact({
        factClass: SELLER_FACT_CLASS.VEHICLE_INTEREST,
        field: 'vehicleTrackFeedback',
        value: {
          modelKey,
          status: VEHICLE_TRACK_STATUS.DEFERRED,
          rejectionReason: rateCue
            ? REJECTION_REASON.RATE_TOO_HIGH
            : REJECTION_REASON.PRICE_TOO_HIGH,
        },
        label: deferred && /zu\s+teuer/.test(cue)
          ? `${modelLabel} zu teuer`
          : `${modelLabel} zurückgestellt`,
        confidence: 0.9,
        needsConfirmation: true,
      }));
    } else if (favorite) {
      pushFact(facts, createExtractedFact({
        factClass: SELLER_FACT_CLASS.VEHICLE_INTEREST,
        field: 'vehicleTrackFeedback',
        value: {
          modelKey,
          status: VEHICLE_TRACK_STATUS.FAVORITE,
        },
        label: `${modelLabel} Favorit`,
        confidence: 0.9,
        needsConfirmation: true,
      }));
    }
    trackMatch = trackFeedbackRe.exec(t);
  }

  // Trade-in / existing vehicle (Kia-Interesse nicht als Alt-Fzg. werten)
  const tradeIn = /\b(in\s*zahlung|inzahlungnahme|nehmen wir in zahlung|nehmen wir mit)\b/i.test(t);
  if (tradeIn) {
    pushFact(facts, createExtractedFact({
      factClass: SELLER_FACT_CLASS.TRADE_IN_FACT,
      field: 'tradeInRequested',
      value: true,
      label: 'Inzahlungnahme gewünscht',
      confidence: 0.96,
    }));
  }

  const existingCandidates = [];
  const existingRe = new RegExp(
    `\\b(${EXISTING_MAKE_RE})\\s+([a-z0-9-]{2,20})(?:\\s+(schalter|automatik|dsg))?\\b`,
    'gi',
  );
  let existingMatch = existingRe.exec(t);
  while (existingMatch) {
    const makeRaw = existingMatch[1];
    const modelRaw = existingMatch[2];
    const gearRaw = existingMatch[3] || null;
    const isKiaInterest = /^kia$/i.test(makeRaw)
      && new RegExp(`^(?:${KIA_INTEREST_MODEL_RE})$`, 'i').test(modelRaw);
    if (isKiaInterest) {
      existingMatch = existingRe.exec(t);
      continue;
    }
    const make = titleCaseToken(makeRaw.replace(/volkswagen/i, 'VW').replace(/škoda/i, 'Skoda'));
    const model = titleCaseToken(modelRaw);
    const gear = gearRaw ? titleCaseToken(gearRaw) : null;
    const label = [make, model, gear].filter(Boolean).join(' ');
    existingCandidates.push({
      make,
      model,
      gear,
      label,
      prefer: !/^kia$/i.test(makeRaw),
    });
    existingMatch = existingRe.exec(t);
  }
  const existingPick = existingCandidates.find((c) => c.prefer)
    || (!hasInterest ? existingCandidates[0] : null)
    || existingCandidates.find((c) => !/^kia$/i.test(c.make))
    || null;
  if (existingPick) {
    pushFact(facts, createExtractedFact({
      factClass: SELLER_FACT_CLASS.EXISTING_VEHICLE,
      field: 'existingVehicle',
      value: {
        make: existingPick.make,
        model: existingPick.model,
        transmission: existingPick.gear || null,
      },
      label: existingPick.label,
      confidence: existingPick.gear ? 0.92 : 0.9,
    }));
  }

  // Contract end
  if (/\bleasing\b/i.test(t) && (/\b(auslauf|läuft|laeuft|ende|bis)\b/i.test(t) || parseMonthYear(t))) {
    const endDate = parseMonthYear(t);
    pushFact(facts, createExtractedFact({
      factClass: SELLER_FACT_CLASS.CONTRACT_FACT,
      field: 'existingContractEnd',
      value: endDate ? { type: 'leasing', endDate } : { type: 'leasing' },
      label: endDate ? `Leasingende ${endDate}` : 'Leasingvertrag vorhanden',
      confidence: endDate ? 0.93 : 0.8,
      needsConfirmation: !endDate,
    }));
  }

  // Explizite Zahlungsart
  if (/\b(?:barangebot|barkauf|barzahlung)\b/i.test(t)) {
    pushFact(facts, createExtractedFact({
      factClass: SELLER_FACT_CLASS.COMMERCIAL_PREFERENCE,
      field: 'paymentType',
      value: 'cash',
      label: 'Kauf / Bar',
      confidence: 0.9,
    }));
  } else if (/\bfinanzierung\b/i.test(t) && !/\bleasing\b/i.test(t)) {
    pushFact(facts, createExtractedFact({
      factClass: SELLER_FACT_CLASS.COMMERCIAL_PREFERENCE,
      field: 'paymentType',
      value: 'financing',
      label: 'Finanzierung',
      confidence: 0.88,
    }));
  } else if (
    /\bleasingangebot\b|\bleasing\s+(?:anbieten|machen|erstellen)\b/i.test(t)
    || (
      /\bleasing\b/i.test(t)
      && (
        (/\b\d{2}\s*monate?\b/i.test(t) && /\b(?:km|kilometer)\b/i.test(t))
        || /\banzahlung|sonderzahlung\b/i.test(t)
      )
    )
  ) {
    pushFact(facts, createExtractedFact({
      factClass: SELLER_FACT_CLASS.COMMERCIAL_PREFERENCE,
      field: 'paymentType',
      value: 'leasing',
      label: 'Leasing',
      confidence: 0.9,
    }));
  }

  // Wunschrate / commercial
  const budget = t.match(/\b(\d{2,4})\s*(?:€|euro)?\s*(?:wunsch)?rate\b/i)
    || t.match(/\bwunschrate\s*(?:ca\.?\s*)?(\d{2,4})\b/i)
    || (/\bwunschrate\b/i.test(t) ? t.match(/\b(\d{2,4})\s*(?:€|euro)\b/i) : null);
  if (budget) {
    const value = Number(budget[1]);
    pushFact(facts, createExtractedFact({
      factClass: SELLER_FACT_CLASS.COMMERCIAL_PREFERENCE,
      field: 'monthlyBudget',
      value,
      label: `${value} € Wunschrate`,
      confidence: 0.92,
    }));
  } else if (/\b(\d{2,4})\s*(?:€|euro)\b/i.test(t) && !net && !/\b(rabatt|sonderrabatt|%\b)/i.test(t)) {
    const lone = t.match(/\b(\d{2,4})\s*(?:€|euro)\b/i);
    if (lone && !/\banzahlung|az\b/i.test(t)) {
      pushFact(facts, createExtractedFact({
        factClass: SELLER_FACT_CLASS.COMMERCIAL_PREFERENCE,
        field: 'monthlyBudget',
        value: Number(lone[1]),
        label: `${lone[1]} €`,
        confidence: 0.55,
        needsConfirmation: true,
      }));
    }
  }

  const color = t.match(/\b(schwarzmetallic|schwarz|weiß|weiss|terracotta|blau|grau|silber|rot|grün|gruen)\b/i);
  if (color) {
    const raw = color[1];
    const label = /\bfarbe\b/i.test(t) && !/^farbe/i.test(raw)
      ? `Farbe ${titleCaseToken(raw)}`
      : titleCaseToken(raw);
    pushFact(facts, createExtractedFact({
      factClass: SELLER_FACT_CLASS.VEHICLE_INTEREST,
      field: 'colorPreference',
      value: raw.toLowerCase(),
      label,
      confidence: hasInterest ? 0.88 : 0.82,
      needsConfirmation: !hasInterest,
    }));
  }

  if (/\bahk\b|anhängerkupplung|anhaengerkupplung/i.test(t) && /\bwichtig|braucht|mit\b/i.test(t)) {
    pushFact(facts, createExtractedFact({
      factClass: SELLER_FACT_CLASS.VEHICLE_REQUIREMENT,
      field: 'towHitchRequired',
      value: true,
      label: 'AHK wichtig',
      confidence: 0.94,
    }));
  }

  // Ausstattung / Wünsche (Outlook-Bullets etc.)
  if (/\bautomatik\b/i.test(t)) {
    pushFact(facts, createExtractedFact({
      factClass: SELLER_FACT_CLASS.VEHICLE_REQUIREMENT,
      field: 'transmissionPreference',
      value: 'automatic',
      label: 'Automatik',
      confidence: existingPick?.gear && /schalter/i.test(existingPick.gear) ? 0.88 : 0.9,
    }));
  }

  if (/\bschiebedach\b/i.test(t)) {
    pushFact(facts, createExtractedFact({
      factClass: SELLER_FACT_CLASS.VEHICLE_REQUIREMENT,
      field: 'sunroofRequired',
      value: true,
      label: 'Schiebedach',
      confidence: 0.92,
    }));
  }

  const trimWish = t.match(/\b(GT-?\s*Line|X-?\s*Line(?:\s*\d+)?)\b/gi);
  if (trimWish?.length) {
    const unique = [...new Set(trimWish.map((x) => titleCaseToken(x.replace(/\s+/g, ' '))))];
    const alreadyOnInterest = interestHits.some((h) => (
      h.trim && unique.some((u) => new RegExp(u.replace(/\s/g, '\\s*'), 'i').test(h.trim))
    ));
    if (!alreadyOnInterest || unique.length > 1) {
      pushFact(facts, createExtractedFact({
        factClass: SELLER_FACT_CLASS.VEHICLE_REQUIREMENT,
        field: 'trimPreference',
        value: unique,
        label: unique.join(' / '),
        confidence: 0.86,
      }));
    }
  }

  // Termin aus Outlook (Datum + Uhr + Probefahrt)
  const appointmentType = detectAppointmentType(t);
  const parsedAppt = parseAppointmentDateTime(t);
  if (appointmentType || parsedAppt.startAt) {
    const type = appointmentType || APPOINTMENT_TYPES.CONSULTATION;
    const typeLabel = appointmentTypeLabel(type);
    let label = typeLabel;
    if (parsedAppt.startAt) {
      label = `${typeLabel} · ${formatAppointmentWhen(parsedAppt.startAt)}`;
    } else if (parsedAppt.missing === 'time' && parsedAppt.partialDate) {
      label = `${typeLabel} · Datum erkannt`;
    } else if (appointmentType) {
      label = typeLabel;
    }
    pushFact(facts, createExtractedFact({
      factClass: SELLER_FACT_CLASS.APPOINTMENT_FACT,
      field: 'appointment',
      value: {
        type,
        startAt: parsedAppt.startAt,
        missing: parsedAppt.missing,
      },
      label,
      confidence: parsedAppt.startAt ? 0.93 : 0.8,
      needsConfirmation: !parsedAppt.startAt,
    }));
  }

  // Offer instructions
  const discount = t.match(/\b(\d{1,2})\s*(?:%|prozent)\s*(?:sonder)?rabatt\b/i)
    || t.match(/\b(\d{1,2})\s*%(?!\d)/)
    || t.match(/\b(\d{1,2})\s*prozent\b/i);
  if (discount) {
    const hasOfferCue = /\brabatt|angebot|erstell|mach|sonder|leasing|finanz/i.test(t);
    const pct = Number(discount[1]);
    // Isolierte %-Zahl nur mit Bestätigung (z. B. „21 %“ ohne Kontext)
    if (hasOfferCue || pct >= 10) {
      pushFact(facts, createExtractedFact({
        factClass: SELLER_FACT_CLASS.OFFER_INSTRUCTION,
        field: 'discountPercent',
        value: pct,
        label: `${discount[1]} % Rabatt`,
        confidence: hasOfferCue ? 0.9 : 0.7,
        needsConfirmation: !hasOfferCue,
      }));
    }
  }

  const WORD_MONTHS = {
    einem: 1, eine: 1, zwei: 2, drei: 3, vier: 4, fünf: 5, fuenf: 5,
    sechs: 6, sieben: 7, acht: 8, neun: 9, zehn: 10, elf: 11, zwölf: 12, zwoelf: 12,
  };
  const deliveryUntil = t.match(
    /\blieferzeit\s*(?:bis\s*)?(?:ca\.?\s*)?(0?[1-9]|1[0-2])[./](20\d{2}|\d{2})\b/i,
  ) || (/\blieferzeit\b/i.test(t) && t.match(/\bbis\s+(0?[1-9]|1[0-2])[./](20\d{2}|\d{2})\b/i));
  const delivery = t.match(/\b(?:lieferzeit|lieferbar)\s*(?:ca\.?\s*|circa\.?\s*)?(\d{1,2})\s*monate?\b/i)
    || t.match(/\bin\s*(?:ca\.?\s*)?(\d{1,2})\s*monaten?\b/i)
    || t.match(/\blieferzeit\s+(?:ca\.?\s*|circa\.?\s*)?(einem|eine|zwei|drei|vier|fünf|fuenf|sechs|sieben|acht|neun|zehn|elf|zwölf|zwoelf)\s+monate?\b/i);
  if (deliveryUntil) {
    const month = String(deliveryUntil[1]).padStart(2, '0');
    let year = deliveryUntil[2];
    if (year.length === 2) year = `20${year}`;
    const important = /\bwichtig|priorit|dringend/i.test(t);
    pushFact(facts, createExtractedFact({
      factClass: important ? SELLER_FACT_CLASS.CUSTOMER_NEED : SELLER_FACT_CLASS.OFFER_INSTRUCTION,
      field: 'deliveryDeadline',
      value: { endDate: `${year}-${month}`, important },
      label: important
        ? `Lieferzeit bis ${month}.${year} wichtig`
        : `Lieferzeit bis ${month}.${year}`,
      confidence: 0.9,
    }));
  } else if (delivery) {
    const raw = delivery[1];
    const months = WORD_MONTHS[String(raw).toLowerCase()] ?? Number(raw);
    if (months) {
      pushFact(facts, createExtractedFact({
        factClass: SELLER_FACT_CLASS.OFFER_INSTRUCTION,
        field: 'deliveryEstimateMonths',
        value: { value: months, unit: 'months', approximate: true },
        label: `Lieferzeit ca. ${months} Monate`,
        confidence: 0.85,
      }));
    }
  }

  // Mileage correction
  const km = t.match(/\b(\d{1,2}(?:\.\d{3})?|\d{4,6})\s*(?:tkm|km)\b/i)
    || t.match(/\bdoch\s+(\d{4,6})\s*km\b/i);
  if (km) {
    const value = Number(String(km[1]).replace(/\./g, '')) * (/tkm/i.test(km[0]) && Number(km[1]) < 100 ? 1000 : 1);
    const normalized = value < 1000 ? value * 1000 : value;
    pushFact(facts, createExtractedFact({
      factClass: SELLER_FACT_CLASS.COMMERCIAL_PREFERENCE,
      field: 'annualMileage',
      value: normalized,
      label: `${normalized.toLocaleString('de-DE')} km`,
      confidence: /\bdoch\b|statt/i.test(t) ? 0.95 : 0.88,
    }));
  }

  // Document request hint
  if (/\bfahrzeugschein|gehaltsnachweis|ausweis|selbstauskunft|unterlagen?\b/i.test(t)
    && /\b(frag|anforder|fehl|brauch|schick)\b/i.test(t)) {
    pushFact(facts, createExtractedFact({
      factClass: SELLER_FACT_CLASS.DOCUMENT_FACT,
      field: 'documentRequest',
      value: true,
      label: 'Unterlage anfordern',
      confidence: 0.9,
    }));
  }

  // Legacy seller facts (vehicle/rate/discount) as seller_fact fallback labels
  for (const legacy of extractSellerFactsFromInput(t)) {
    if (facts.some((f) => f.label === legacy.label)) continue;
    if (legacy.key === 'vehicle' && hasInterest) continue;
    if (legacy.key === 'color' && facts.some((f) => f.field === 'colorPreference')) continue;
    if (legacy.key === 'discount' && facts.some((f) => f.field === 'discountPercent')) continue;
    pushFact(facts, createExtractedFact({
      factClass: SELLER_FACT_CLASS.SELLER_FACT,
      field: legacy.key,
      value: legacy.value ?? legacy.label,
      label: legacy.label,
      source: SELLER_FACT_SOURCE.SELLER_INPUT,
      confidence: 0.8,
    }));
  }

  return facts;
}

/**
 * Expliziter Kunden-Nachrichten-Cue („schreib ihm …“).
 * Portfolio-/Link-Versand zählt nicht als Nachrichtentext.
 */
export function isExplicitCustomerMessageCue(text = '') {
  const t = String(text ?? '');
  if (detectSellerActionIntent(t) === SELLER_ACTION_INTENTS.SEND_PORTFOLIO) {
    return false;
  }
  return /\b(schreib|sag|informier|whatsapp|mail|schick ihm|schick ihr)\b/i.test(t);
}

/**
 * Multi-Intent Detection (kein Single-Intent-Zwang).
 * @param {string} text
 * @param {object[]} facts
 */
export function detectSellerTurnIntents(text = '', facts = []) {
  const t = String(text ?? '').trim();
  const intents = [];
  const add = (intent, confidence = 0.8) => {
    if (!intents.some((i) => i.type === intent)) {
      intents.push({ type: intent, confidence });
    }
  };

  const explicitMessage = isExplicitCustomerMessageCue(t);
  const contextClasses = [
    SELLER_FACT_CLASS.CUSTOMER_FACT,
    SELLER_FACT_CLASS.CUSTOMER_NEED,
    SELLER_FACT_CLASS.SELF_DISCLOSURE_FACT,
    SELLER_FACT_CLASS.EXISTING_VEHICLE,
    SELLER_FACT_CLASS.CONTRACT_FACT,
    SELLER_FACT_CLASS.COMMERCIAL_PREFERENCE,
    SELLER_FACT_CLASS.VEHICLE_INTEREST,
    SELLER_FACT_CLASS.VEHICLE_REQUIREMENT,
    SELLER_FACT_CLASS.TRADE_IN_FACT,
    SELLER_FACT_CLASS.APPOINTMENT_FACT,
  ];
  // Bei „schreib ihm …“ sind Angebots-Fakten im Text oft nur Nachrichtinhalt
  if (!explicitMessage) contextClasses.push(SELLER_FACT_CLASS.OFFER_INSTRUCTION);

  const hasContextFacts = facts.some((f) => contextClasses.includes(f.factClass));

  const primary = detectSellerActionIntent(t);
  const map = {
    [SELLER_ACTION_INTENTS.PREPARE_OFFER]: SELLER_TURN_INTENTS.PREPARE_OFFER,
    [SELLER_ACTION_INTENTS.SEND_PORTFOLIO]: SELLER_TURN_INTENTS.SEND_PORTFOLIO,
    [SELLER_ACTION_INTENTS.MESSAGE_CUSTOMER]: SELLER_TURN_INTENTS.DRAFT_MESSAGE,
    [SELLER_ACTION_INTENTS.REQUEST_DOCUMENTS]: SELLER_TURN_INTENTS.REQUEST_DOCUMENTS,
    [SELLER_ACTION_INTENTS.PROPOSE_APPOINTMENT]: SELLER_TURN_INTENTS.PROPOSE_APPOINTMENT,
    [SELLER_ACTION_INTENTS.PREPARE_CALLBACK]: SELLER_TURN_INTENTS.PREPARE_CALLBACK,
    [SELLER_ACTION_INTENTS.ADD_NOTE]: SELLER_TURN_INTENTS.ADD_NOTE,
    [SELLER_ACTION_INTENTS.LOOKUP_FACT]: SELLER_TURN_INTENTS.LOOKUP_VEHICLE_FACT,
  };
  if (map[primary]) {
    const skipMessageDefault = primary === SELLER_ACTION_INTENTS.MESSAGE_CUSTOMER
      && hasContextFacts
      && !explicitMessage;
    if (!skipMessageDefault) add(map[primary], 0.85);
  }

  if (explicitMessage) {
    add(SELLER_TURN_INTENTS.DRAFT_MESSAGE, 0.96);
  } else if (hasContextFacts) {
    add(SELLER_TURN_INTENTS.UPDATE_CUSTOMER_CONTEXT, 0.95);
  }

  if (facts.some((f) => f.factClass === SELLER_FACT_CLASS.TRADE_IN_FACT)) {
    add(SELLER_TURN_INTENTS.PREPARE_TRADE_IN, 0.92);
  }
  if (facts.some((f) => f.factClass === SELLER_FACT_CLASS.DOCUMENT_FACT)) {
    add(SELLER_TURN_INTENTS.REQUEST_DOCUMENTS, 0.9);
  }
  if (!explicitMessage && (
    facts.some((f) => f.factClass === SELLER_FACT_CLASS.OFFER_INSTRUCTION)
    || /\b(angebot|erstell|mach).{0,40}\b(angebot|ev\d)/i.test(t)
  )) {
    add(SELLER_TURN_INTENTS.PREPARE_OFFER, 0.9);
  }

  if (!intents.length) add(SELLER_TURN_INTENTS.UNKNOWN, 0.4);
  return intents.sort((a, b) => b.confidence - a.confidence);
}

/**
 * Message vs Work Mode.
 * @param {string} text
 * @param {object[]} intents
 * @param {object[]} [facts]
 */
export function resolveSellerInputMode(text = '', intents = [], facts = []) {
  const t = String(text ?? '');
  const explicitMessage = isExplicitCustomerMessageCue(t);
  // Explizite Kundennachricht hat Vorrang vor Work-Dump
  if (explicitMessage) return SELLER_INPUT_MODE.CUSTOMER_MESSAGE;

  const workHeavy = intents.some((i) => [
    SELLER_TURN_INTENTS.UPDATE_CUSTOMER_CONTEXT,
    SELLER_TURN_INTENTS.PREPARE_TRADE_IN,
    SELLER_TURN_INTENTS.PREPARE_OFFER,
    SELLER_TURN_INTENTS.SEND_PORTFOLIO,
    SELLER_TURN_INTENTS.REQUEST_DOCUMENTS,
    SELLER_TURN_INTENTS.LOOKUP_VEHICLE_FACT,
  ].includes(i.type)) || facts.length >= 3;

  const messageLike = intents.some((i) => i.type === SELLER_TURN_INTENTS.DRAFT_MESSAGE);

  if (workHeavy) return SELLER_INPUT_MODE.CLEVER_WORK_INPUT;
  if (messageLike) return SELLER_INPUT_MODE.CUSTOMER_MESSAGE;
  if (/\n/.test(String(text)) || (text.match(/,/g) || []).length >= 2) {
    return SELLER_INPUT_MODE.CLEVER_WORK_INPUT;
  }
  return SELLER_INPUT_MODE.CLEVER_WORK_INPUT;
}

/**
 * @param {string} sellerInput
 * @param {{ attachments?: object[] }} [options]
 */
export function interpretSellerInput(sellerInput = '', options = {}) {
  const raw = String(sellerInput ?? '');
  const normalized = raw.replace(/\r\n/g, '\n').trim();
  let facts = extractUniversalSellerFacts(normalized);

  if (shouldEnrichSellerInputFromOfferPdf(options.attachments, normalized)) {
    facts = mergeOfferPdfFactsIntoSellerFacts(
      facts,
      extractSellerFactsFromOfferPdfText(normalized),
    );
  }

  const intents = detectSellerTurnIntents(normalized, facts);
  const inputMode = resolveSellerInputMode(normalized, intents, facts);
  const attachmentTypes = (options.attachments ?? [])
    .map((a) => a?.mimeType || a?.type || a?.kind)
    .filter(Boolean);

  return {
    raw,
    normalized,
    facts,
    intents,
    inputMode,
    attachmentTypes,
    confidence: facts.length
      ? Math.min(0.99, facts.reduce((s, f) => s + (f.confidence || 0), 0) / facts.length)
      : (intents[0]?.confidence ?? 0.4),
  };
}
