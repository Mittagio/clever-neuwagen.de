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
  hasExplicitAppointmentSellerCue,
  isOfferPdfDropContext,
  mergeOfferPdfFactsIntoSellerFacts,
  shouldEnrichSellerInputFromOfferPdf,
} from './mapMagicOfferIntentToSellerFacts.js';
import {
  INVALID_DISCOUNT_WARNING,
  validateDiscountPercent,
} from './validateDiscountPercent.js';
import { formatContractEndLabel } from './formatContractEndLabel.js';
import { detectInterestTrimConflict } from './detectVehicleTrimConflict.js';
import { normalizeVehicleDisplayLabel } from './normalizeVehicleDisplayLabel.js';
import {
  buildInboundContactFacts,
  extractInboundContact,
  isInboundLeadPaste,
  isSellerFreestyleCaptureDump,
} from './inboundLeadIntake.js';
import {
  isCustomerReplyPaste,
  proposeCustomerReplyNextActions,
} from './customerReplyIntake.js';
import {
  extractPurchasePriceUnitAware,
  parseTermAndMileageShorthand,
} from './normalizeSellerUnits.js';
import {
  hasCommercialOfferSlots,
  isBareMonthlyRateCue,
  isBareOrGenericOfferCue,
  isBatchOfferCue,
  looksLikeMonthlyBudgetAmount,
  parseCommercialDownPayment,
  parseCommercialMonthlyRate,
  parseImplicitDownPayment,
  parseOfferIdentityFollowUp,
  shouldBindIdentityToOpenOffer,
  validateOfferVehicleIdentity,
  validateOfferPackageAgainstCatalog,
  validateOfferPowerAgainstCatalog,
  validateOfferEquipmentAgainstCatalog,
} from './commercialOfferNl.js';
import {
  findSellerAliasesInText,
  findSellerPowerMentions,
  parseSellerCommercialAliasShorthand,
} from './sellerAliasRegistry.js';
import { resolveRelativeDateTime } from './resolveRelativeDateTime.js';
import {
  formatCustomerAddressLine,
  parseCustomerAddressFromText,
} from '../dealerAiParser.js';
import {
  extractTradeInCandidates,
  hasTradeInCue,
  isSecondVehicleInterestCue,
  tradeInModelKeys,
} from './detectTradeInFromSellerInput.js';
import {
  ensureZeroLossCoverage,
  resolveSellerModelAlias,
} from './zeroLossIntake.js';
import { enrichFactsForMultiSource } from './multiSource/buildMultiSourceIntake.js';
import {
  REJECTION_REASON,
  VEHICLE_TRACK_STATUS,
} from '../crm/vehicleTrack.js';
import {
  parseHomepageCommercialInquiry,
} from '../crm/homepageCommercialInquiry.js';
import {
  formatCommercialScenarioChip,
  formatCustomerTypeLabel,
  COMMERCIAL_CUSTOMER_TYPE,
} from '../crm/commercialScenarios.js';
import { extractNamedCustomerFromInput } from './resolveAssistantContext.js';
import { isCustomerContractIntakeText } from './extractCustomerContractFromText.js';
import { isCustomerContractQuery } from './searchCustomerContracts.js';
import { isContractOfferCompareQuery } from './compareContractWithOffer.js';
import { isContractCompareMessageCue } from './draftContractCompareCustomerMessage.js';
import { resolveContractIntakeText } from './resolveContractIntakeText.js';
import { isPrepareSuccessionOfferCue } from './prepareSuccessionOfferFromLead.js';
import {
  parseDeliveryTimeAnswerFromText,
} from '../crm/deliveryTimeQuestion.js';
import {
  formatScenarioOfferFeedbackChip,
  parseScenarioOfferFeedbackFromText,
} from '../crm/scenarioOfferFeedback.js';

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
const KIA_INTEREST_MODEL_RE = 'EV[2-9]|EQ[2-9]|PV[2-9]|Sportage|Sorento|Ceed|XCeed|Niro|Picanto|Seltos|K4|Stonic|Rio|Proceed|Soul|Carnival|Tivoli';
const KIA_INTEREST_TRIM_RE = 'SW|GT-?Line|X-?Line(?:\\s*\\d+)?|Spirit|Earth|Vision|Air|DriveWise|Core|COR|Elite';
const KIA_INTEREST_PACKAGE_RE = 'Upgrade|Heat\\s*Pump|W(?:ä|ae)rmepumpe|WP|Winterpaket|Winter\\s*paket';
const KIA_INTEREST_COLOR_RE = 'wolfsgrau(?:\\s*metallic)?|schwarz\\w*|wei[sß]{1,2}\\w*|\\bwei\\b|terracotta|blau\\w*|grau\\w*(?:\\s*metallic)?|silber\\w*|rot\\w*|gr[uü]n\\w*';

/** Word-boundary-safe match (ß/ä ist in JS ohne `u` kein \\w). */
function matchColorToken(text = '') {
  return String(text || '').match(
    new RegExp(`(?:^|[^A-Za-z0-9_])(${KIA_INTEREST_COLOR_RE})(?![A-Za-z0-9_])`, 'i'),
  );
}
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
 * „Dezember dieses Jahres“ / „für Dezember“ → YYYY-MM (kein Tag).
 * @param {string} text
 * @param {Date|string|number|null} [now]
 * @returns {string|null}
 */
function parseRelativeMonthYear(text = '', now = null) {
  const t = String(text || '');
  const monthRe = '(januar|jan|februar|feb|märz|maerz|mar|april|apr|mai|juni|jun|juli|jul|august|aug|september|sep|sept|oktober|okt|november|nov|dezember|dez)';
  const rel = t.match(new RegExp(
    `\\b${monthRe}\\.?\\s+(dieses\\s+jahres|diesen\\s+jahres|dieses\\s+jahr|n(?:ä|ae)chsten?\\s+jahres|n(?:ä|ae)chstes\\s+jahr)\\b`,
    'i',
  )) || t.match(new RegExp(
    `\\b(?:plant|planung|liefern|lieferung|bereit|ab|für|zum|im)\\s+(?:das\\s+neue\\s+fahrzeug\\s+)?(?:er\\s+|sie\\s+)?(?:für\\s+|im\\s+|ab\\s+|zum\\s+)?${monthRe}\\.?(?:\\s+(dieses\\s+jahres|diesen\\s+jahres|dieses\\s+jahr|n(?:ä|ae)chsten?\\s+jahres|n(?:ä|ae)chstes\\s+jahr|20\\d{2}|\\d{2}))?\\b`,
    'i',
  )) || t.match(new RegExp(
    // „ungefähr im Dezember benötigen“ / „im Dezember brauche ich …“
    `\\b(?:ungefähr|ungefaehr|etwa|ca\\.?)?\\s*(?:im|in)\\s+${monthRe}\\.?\\s+(?:benötig\\w*|brauch\\w*)`,
    'i',
  ));
  if (!rel) return null;
  const monthToken = String(rel[1] || '').toLowerCase();
  const month = MONTH_MAP[monthToken];
  if (!month) return null;
  const relPhrase = String(rel[2] || '').toLowerCase();
  const base = now != null ? new Date(now) : new Date();
  const baseYear = Number.isFinite(base.getFullYear()) ? base.getFullYear() : new Date().getFullYear();
  let year = baseYear;
  if (/^20\d{2}$/.test(relPhrase)) {
    year = Number(relPhrase);
  } else if (/^\d{2}$/.test(relPhrase)) {
    year = 2000 + Number(relPhrase);
  } else if (/n(?:ä|ae)chst/.test(relPhrase)) {
    year = baseYear + 1;
  } else if (/dieses|diesen/.test(relPhrase) || !relPhrase) {
    // „für Dezember“ ohne Jahr: nach dem Monat im Kalenderjahr, sonst nächstes Jahr
    const monthNum = Number(month);
    if (!relPhrase && monthNum < (base.getMonth() + 1)) {
      year = baseYear + 1;
    } else {
      year = baseYear;
    }
  }
  return `${year}-${month}`;
}

/**
 * Multi-Fact Extraktion aus natürlichem Seller-Input.
 * @param {string} text
 * @param {{ lead?: object, currentOfferContext?: object|null, workingContext?: object|null }} [options]
 */
export function extractUniversalSellerFacts(text = '', options = {}) {
  const raw = String(text ?? '');
  const t = raw.replace(/\s+/g, ' ').trim();
  const facts = [];
  const lead = options.lead ?? {};
  if (!t) return facts;

  const memoryOfferCtx = (!options.currentOfferContext && options.workingMemory)
    ? (() => {
      try {
        // lazy import avoided — resolve inline from memory fields
        const mem = options.workingMemory;
        const prep = options.previousOfferPreparation || mem?.previousOfferPreparation;
        const offer = mem?.currentOffer;
        const vehicle = mem?.resolvedVehicle;
        const vehicleTrackId = offer?.vehicleTrackId
          || prep?.vehicleTrackId
          || prep?.grounded?.vehicleTrackId
          || prep?.payload?.vehicleTrackId
          || null;
        const modelKey = vehicle?.modelKey || offer?.modelKey || prep?.grounded?.modelKey || null;
        if (!vehicleTrackId && !modelKey && !prep && !offer) return null;
        return {
          offerId: offer?.offerId || offer?.id || (prep ? 'session-offer' : null),
          title: offer?.title || 'Angebot',
          modelKey,
          vehicleTrackId,
          fromWorkingMemory: true,
        };
      } catch {
        return null;
      }
    })()
    : null;
  const currentOfferContext = options.currentOfferContext || memoryOfferCtx;

  const bindToOpenOffer = shouldBindIdentityToOpenOffer({
    sellerInput: t,
    currentOfferContext,
    workingContext: options.workingContext,
  });
  const offerTrackId = currentOfferContext?.vehicleTrackId
    || currentOfferContext?.vehicleCardId
    || options.workingContext?.attachedVehicle?.vehicleTrackId
    || null;
  const offerIdentityMeta = bindToOpenOffer
    ? {
      targetScope: 'offer_vehicle',
      vehicleTrackId: offerTrackId,
    }
    : null;

  const namedCustomer = extractNamedCustomerFromInput(t);
  if (namedCustomer) {
    pushFact(facts, createExtractedFact({
      factClass: SELLER_FACT_CLASS.CUSTOMER_FACT,
      field: 'customerName',
      value: namedCustomer,
      label: namedCustomer,
      // Identity-Capture: ≥0.9 → safe remember (kein Review nur wegen Name)
      confidence: 0.94,
    }));
  }

  // Explizite Zahlungsart-Korrektur schlägt Dual-Szenario („Finanzierung lieber als Leasing“)
  const prefersFinancingOverLeasing = (
    /\bfinanzierung\b.{0,80}\b(?:lieber|statt).{0,40}\bleasing\b/i.test(t)
    || (
      /\blieber.{0,40}\bfinanzierung\b/i.test(t)
      && /\bleasing\b/i.test(t)
      && !/\blieber.{0,40}\bleasing\b/i.test(t)
    )
  );
  const prefersLeasingOverFinancing = (
    /\bleasing\b.{0,80}\b(?:lieber|statt).{0,40}\bfinanzierung\b/i.test(t)
    || (
      /\blieber.{0,40}\bleasing\b/i.test(t)
      && /\bfinanzierung\b/i.test(t)
      && !/\blieber.{0,40}\bfinanzierung\b/i.test(t)
    )
  );

  // Epic 2: Homepage Dual-Szenario zuerst – kein gemischter paymentType
  const homepageDraft = prefersFinancingOverLeasing || prefersLeasingOverFinancing
    ? null
    : parseHomepageCommercialInquiry(raw);
  let skipSinglePaymentType = false;
  if (homepageDraft?.hasDualScenarios) {
    skipSinglePaymentType = true;
    if (homepageDraft.model) {
      pushFact(facts, createExtractedFact({
        factClass: SELLER_FACT_CLASS.VEHICLE_INTEREST,
        field: 'vehicleInterest',
        value: { modelKey: homepageDraft.modelKey, model: homepageDraft.model },
        label: homepageDraft.model,
        source: SELLER_FACT_SOURCE.CUSTOMER_MESSAGE,
        confidence: homepageDraft.confidence,
      }));
    }
    if (homepageDraft.configurationAttached) {
      pushFact(facts, createExtractedFact({
        factClass: SELLER_FACT_CLASS.VEHICLE_REQUIREMENT,
        field: 'configurationAttached',
        value: true,
        label: 'Konfiguration angehängt',
        source: SELLER_FACT_SOURCE.CUSTOMER_MESSAGE,
        confidence: 0.92,
      }));
    }
    pushFact(facts, createExtractedFact({
      factClass: SELLER_FACT_CLASS.COMMERCIAL_PREFERENCE,
      field: 'commercialScenarios',
      value: homepageDraft.commercialScenarios,
      label: homepageDraft.commercialScenarios.map(formatCommercialScenarioChip).join(' · '),
      source: SELLER_FACT_SOURCE.CUSTOMER_MESSAGE,
      confidence: homepageDraft.confidence,
    }));
    // Separate chips for review readability
    for (const scenario of homepageDraft.commercialScenarios) {
      pushFact(facts, createExtractedFact({
        factClass: SELLER_FACT_CLASS.COMMERCIAL_PREFERENCE,
        field: `commercialScenario:${scenario.id}`,
        value: scenario,
        label: formatCommercialScenarioChip(scenario),
        source: SELLER_FACT_SOURCE.CUSTOMER_MESSAGE,
        confidence: homepageDraft.confidence,
      }));
    }
    pushFact(facts, createExtractedFact({
      factClass: SELLER_FACT_CLASS.CUSTOMER_FACT,
      field: 'customerType',
      value: homepageDraft.customerType,
      label: formatCustomerTypeLabel(homepageDraft.customerType),
      source: SELLER_FACT_SOURCE.CUSTOMER_MESSAGE,
      confidence: 0.9,
    }));
    for (const q of homepageDraft.openQuestions ?? []) {
      pushFact(facts, createExtractedFact({
        factClass: SELLER_FACT_CLASS.CUSTOMER_NEED,
        field: q.field,
        value: { open: true, question: q.question },
        label: q.label,
        source: SELLER_FACT_SOURCE.CUSTOMER_MESSAGE,
        confidence: 0.9,
      }));
    }
  }

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
      rawExpression: children[0],
      span: children[0],
    }));
  }

  // Telefon: „entscheidet mit Frau/Partner“ / „Seine Frau entscheidet mit“ → Soft-Fact
  const decidesWith = t.match(
    /\bentscheidet?\s+mit\s+(?:der\s+|seiner\s+|ihrer\s+)?(frau|mann|partner(?:in)?|ehefrau|ehemann|freund(?:in)?)\b/i,
  ) || t.match(
    /\bmit\s+(?:der\s+|seiner\s+|ihrer\s+)?(frau|mann|partner(?:in)?)\s+(?:entscheiden|absprechen|klären|klaeren)\b/i,
  ) || t.match(
    /\b(?:seine|ihre|die)\s+(frau|mann|partner(?:in)?|ehefrau|ehemann|freund(?:in)?)\s+entscheidet?\s+mit\b/i,
  );
  if (decidesWith) {
    const roleRaw = String(decidesWith[1] || 'partner').toLowerCase();
    const role = /frau|ehefrau|partnerin|freundin/.test(roleRaw)
      ? 'partner'
      : /mann|ehemann|freund/.test(roleRaw)
        ? 'partner'
        : 'partner';
    const roleLabel = /frau|ehefrau|partnerin|freundin/.test(roleRaw)
      ? 'Frau'
      : /mann|ehemann/.test(roleRaw)
        ? 'Mann'
        : 'Partner';
    pushFact(facts, createExtractedFact({
      factClass: SELLER_FACT_CLASS.CUSTOMER_FACT,
      field: 'decisionPartner',
      value: { role, raw: roleRaw },
      label: `entscheidet mit ${roleLabel}`,
      confidence: 0.94,
      rawExpression: decidesWith[0],
      span: decidesWith[0],
    }));
  }

  const pet = t.match(/\b(\d)\s*hund(?:e)?\b/i)
    || t.match(/\b(?:einen?\s+)?hund(?:e)?\b/i)
    || t.match(/\b(\d)\s*katzen?\b/i)
    || t.match(/\b(?:eine?\s+)?katze\b/i);
  if (pet) {
    const isDog = /hund/i.test(pet[0]);
    const count = pet[1] ? Number(pet[1]) : 1;
    pushFact(facts, createExtractedFact({
      factClass: SELLER_FACT_CLASS.CUSTOMER_FACT,
      field: 'pet',
      value: { type: isDog ? 'dog' : 'cat', count },
      label: isDog ? (count > 1 ? `${count} Hunde` : '1 Hund') : (count > 1 ? `${count} Katzen` : '1 Katze'),
      confidence: 0.95,
      rawExpression: pet[0],
      span: pet[0],
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

  const emailMatch = t.match(/\b([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})\b/);
  if (emailMatch?.[1] && !facts.some((f) => f.field === 'email')) {
    const email = emailMatch[1].toLowerCase();
    pushFact(facts, createExtractedFact({
      factClass: SELLER_FACT_CLASS.CUSTOMER_FACT,
      field: 'email',
      value: email,
      label: email,
      confidence: 0.94,
    }));
  }

  // DE-Adresse: Straße+Hausnr. · PLZ Ort (klar strukturiert, sonst Note)
  const parsedAddress = parseCustomerAddressFromText(raw);
  if (
    parsedAddress
    && (parsedAddress.street || parsedAddress.postalCode || parsedAddress.city)
    && !facts.some((f) => f.field === 'street' || f.field === 'postalCode' || f.field === 'city')
  ) {
    const streetLine = [parsedAddress.street, parsedAddress.houseNumber].filter(Boolean).join(' ').trim();
    const cityLine = [parsedAddress.postalCode, parsedAddress.city].filter(Boolean).join(' ').trim();
    const clearAddress = Boolean(streetLine && parsedAddress.postalCode && parsedAddress.city);
    if (streetLine) {
      pushFact(facts, createExtractedFact({
        factClass: SELLER_FACT_CLASS.CUSTOMER_FACT,
        field: 'street',
        value: {
          street: parsedAddress.street || streetLine,
          houseNumber: parsedAddress.houseNumber || null,
        },
        label: streetLine,
        confidence: clearAddress ? 0.93 : 0.78,
        needsConfirmation: !clearAddress,
        rawExpression: streetLine,
        span: streetLine,
      }));
    }
    if (parsedAddress.postalCode) {
      pushFact(facts, createExtractedFact({
        factClass: SELLER_FACT_CLASS.CUSTOMER_FACT,
        field: 'postalCode',
        value: parsedAddress.postalCode,
        label: parsedAddress.postalCode,
        confidence: clearAddress ? 0.94 : 0.8,
        needsConfirmation: !clearAddress,
        rawExpression: parsedAddress.postalCode,
        span: parsedAddress.postalCode,
      }));
    }
    if (parsedAddress.city) {
      pushFact(facts, createExtractedFact({
        factClass: SELLER_FACT_CLASS.CUSTOMER_FACT,
        field: 'city',
        value: {
          city: parsedAddress.city,
          postalCode: parsedAddress.postalCode || null,
          zip: parsedAddress.postalCode || null,
        },
        label: cityLine || parsedAddress.city,
        confidence: clearAddress ? 0.93 : 0.78,
        needsConfirmation: !clearAddress,
        rawExpression: cityLine || parsedAddress.city,
        span: cityLine || parsedAddress.city,
      }));
    }
    if (clearAddress) {
      const formatted = parsedAddress.formatted
        || formatCustomerAddressLine(parsedAddress);
      pushFact(facts, createExtractedFact({
        factClass: SELLER_FACT_CLASS.CUSTOMER_FACT,
        field: 'address',
        value: {
          street: parsedAddress.street || null,
          houseNumber: parsedAddress.houseNumber || null,
          postalCode: parsedAddress.postalCode || null,
          zip: parsedAddress.postalCode || null,
          city: parsedAddress.city || null,
          formattedAddress: formatted,
        },
        label: formatted,
        confidence: 0.93,
        rawExpression: formatted,
        span: formatted,
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

  // Vehicle interest (Kia Neuwagen) – Trade-in-Modelle (GW …) ausschließen
  const tradeInKeys = tradeInModelKeys(raw);
  const interestHits = [];
  const interestRe = new RegExp(
    `\\b(?:kia\\s+)?(${KIA_INTEREST_MODEL_RE})(?:\\s+(${KIA_INTEREST_TRIM_RE}))?\\b`,
    'gi',
  );
  const packageTokenRe = new RegExp(`\\b(${KIA_INTEREST_PACKAGE_RE})\\b`, 'i');
  const trimTokenRe = new RegExp(`\\b(${KIA_INTEREST_TRIM_RE})\\b`, 'i');
  let interestMatch = interestRe.exec(t);
  while (interestMatch) {
    const modelRaw = interestMatch[1];
    let trimRaw = interestMatch[2] || null;
    const alias = resolveSellerModelAlias(modelRaw);
    const modelKey = (alias.canonical || modelRaw).toLowerCase();
    // „GW Picanto“ → kein Interesse; „außerdem Picanto“ bleibt Interesse
    if (tradeInKeys.has(modelKey) && !isSecondVehicleInterestCue(raw, modelRaw)) {
      interestMatch = interestRe.exec(t);
      continue;
    }
    const afterStart = interestMatch.index + interestMatch[0].length;
    const nextModelRel = t.slice(afterStart).search(
      new RegExp(`\\b(?:kia\\s+)?(?:${KIA_INTEREST_MODEL_RE})\\b`, 'i'),
    );
    const segmentEnd = nextModelRel >= 0
      ? afterStart + nextModelRel
      : Math.min(t.length, afterStart + 48);
    const segment = t.slice(afterStart, segmentEnd);

    let colorBase = null;
    let packageLabel = null;
    if (!trimRaw) {
      const trimInSeg = segment.match(trimTokenRe);
      if (trimInSeg?.[1]) trimRaw = trimInSeg[1];
    }
    const colorInSeg = matchColorToken(segment);
    if (colorInSeg?.[1]) {
      const lower = String(colorInSeg[1]).toLowerCase();
      colorBase = lower.startsWith('schwarz') ? 'schwarz'
        : /^wei([sß]|$)/.test(lower) ? 'weiß'
        : /wolfsgrau/.test(lower) ? 'wolfsgrau metallic'
        : lower.startsWith('blau') ? 'blau'
        : lower.startsWith('grau') ? (/metallic/.test(lower) ? 'grau metallic' : 'grau')
        : lower.startsWith('silber') ? 'silber'
        : lower.startsWith('rot') ? 'rot'
        : lower.startsWith('grün') || lower.startsWith('gruen') ? 'grün'
        : lower.includes('terracotta') ? 'terracotta'
        : lower;
    }
    const pkgInSeg = segment.match(packageTokenRe);
    if (pkgInSeg?.[1]) {
      const p = String(pkgInSeg[1]).toLowerCase();
      packageLabel = /upgrade/i.test(p) ? 'Upgrade'
        : /heat|wärm|waerm|wp/i.test(p) ? 'Wärmepumpe'
        : /winter/i.test(p) ? 'Winterpaket'
        : titleCaseToken(pkgInSeg[1]);
    }

    const modelLabel = /^ev\d$/i.test(modelKey)
      ? modelKey.toUpperCase()
      : titleCaseToken(modelRaw);
    const trimLabelRaw = trimRaw ? titleCaseToken(trimRaw.replace(/\s+/g, ' ')) : null;
    const trimLabel = trimLabelRaw && /^cor$/i.test(trimLabelRaw) ? 'Core' : trimLabelRaw;
    const trimValue = trimLabel && /^core$/i.test(trimLabel) ? 'core' : trimLabel;
    const existingHit = interestHits.find((h) => h.modelKey === modelKey);
    if (existingHit) {
      // Gleiches Modell anreichern (EV3 → Air → Long Range), kein Sibling
      if (trimValue && !existingHit.trim) {
        existingHit.trim = trimValue;
        existingHit.value = { ...existingHit.value, trim: trimValue };
      }
      if (colorBase && !existingHit.color) {
        existingHit.color = colorBase;
        existingHit.value = {
          ...existingHit.value,
          color: colorBase,
          preferredColor: colorBase,
        };
      }
      if (packageLabel && !existingHit.package) {
        existingHit.package = packageLabel;
        existingHit.value = {
          ...existingHit.value,
          package: packageLabel,
          equipmentPackage: packageLabel,
        };
      }
      const enrichBits = [
        modelLabel,
        existingHit.trim,
        existingHit.color ? titleCaseToken(existingHit.color) : null,
        existingHit.package,
      ].filter(Boolean);
      existingHit.label = normalizeVehicleDisplayLabel({
        make: 'Kia',
        model: modelLabel,
        trim: existingHit.trim,
      }) || `Kia ${enrichBits.join(' ')}`;
      interestMatch = interestRe.exec(t);
      continue;
    }
    const labelBits = [modelLabel, trimLabel, colorBase ? titleCaseToken(colorBase) : null, packageLabel]
      .filter(Boolean);
    const label = normalizeVehicleDisplayLabel({
      make: 'Kia',
      model: modelLabel,
      trim: trimLabel,
    }) || `Kia ${labelBits.join(' ')}`;
    interestHits.push({
      modelKey,
      trim: trimValue,
      color: colorBase,
      package: packageLabel,
      label,
      value: {
        make: 'Kia',
        modelKey,
        trim: trimValue,
        ...(colorBase ? { color: colorBase, preferredColor: colorBase } : {}),
        ...(packageLabel ? { package: packageLabel, equipmentPackage: packageLabel } : {}),
      },
      rawExpression: interestMatch[0],
      span: interestMatch[0],
      matchIndex: interestMatch.index,
      canonicalValue: alias.canonical ? modelKey.toUpperCase() : null,
      aliasAmbiguous: alias.ambiguous && !alias.canonical,
    });
    interestMatch = interestRe.exec(t);
  }

  const interestTrimConflict = detectInterestTrimConflict(interestHits);
  if (interestTrimConflict.conflict) {
    pushFact(facts, createExtractedFact({
      factClass: SELLER_FACT_CLASS.VEHICLE_INTEREST,
      field: 'vehicleTrimConflict',
      value: {
        model: interestTrimConflict.model,
        options: interestTrimConflict.options,
      },
      label: interestTrimConflict.warning,
      confidence: 0.95,
      needsConfirmation: true,
    }));
  } else if (interestHits.length >= 2) {
    pushFact(facts, createExtractedFact({
      factClass: SELLER_FACT_CLASS.VEHICLE_INTEREST,
      field: 'vehicleInterestMulti',
      value: interestHits.map((h) => h.value),
      label: interestHits.map((h) => h.label.replace(/^Kia\s+/i, 'Kia ')).join(' / '),
      confidence: 0.93,
    }));
  } else if (interestHits.length === 1) {
    const hit = interestHits[0];
    pushFact(facts, createExtractedFact({
      factClass: SELLER_FACT_CLASS.VEHICLE_INTEREST,
      field: 'vehicleInterest',
      value: hit.value,
      label: hit.label,
      confidence: hit.canonicalValue ? 0.93 : 0.95,
      needsConfirmation: Boolean(hit.aliasAmbiguous),
      rawExpression: hit.rawExpression || null,
      canonicalValue: hit.canonicalValue || null,
      span: hit.rawExpression || null,
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

  // Powertrain / Batterie (explizit genannt – nie raten)
  if (!facts.some((f) => f.field === 'motorPreference' || f.field === 'batteryPreference')) {
    const longRange = t.match(/\blong\s*range\b/i);
    const standardRange = t.match(/\bstandard\s*range\b/i);
    const kwh = t.match(/\b(\d{2,3}(?:[.,]\d+)?)\s*kwh\b/i);
    if (longRange) {
      pushFact(facts, createExtractedFact({
        factClass: SELLER_FACT_CLASS.VEHICLE_REQUIREMENT,
        field: 'motorPreference',
        value: { id: 'long_range', label: 'Long Range', hint: 'Long Range' },
        label: 'Long Range',
        confidence: 0.93,
        rawExpression: longRange[0],
        span: longRange[0],
      }));
    } else if (standardRange) {
      pushFact(facts, createExtractedFact({
        factClass: SELLER_FACT_CLASS.VEHICLE_REQUIREMENT,
        field: 'motorPreference',
        value: { id: 'standard_range', label: 'Standard Range', hint: 'Standard Range' },
        label: 'Standard Range',
        confidence: 0.93,
        rawExpression: standardRange[0],
        span: standardRange[0],
      }));
    } else if (kwh) {
      const raw = `${kwh[1].replace(',', '.')} kWh`;
      pushFact(facts, createExtractedFact({
        factClass: SELLER_FACT_CLASS.VEHICLE_REQUIREMENT,
        field: 'batteryPreference',
        value: { label: raw, kWh: Number(kwh[1].replace(',', '.')) },
        label: raw,
        confidence: 0.9,
        rawExpression: kwh[0],
        span: kwh[0],
      }));
    }
  }

  const hasInterest = interestHits.length > 0
    || facts.some((f) => f.factClass === SELLER_FACT_CLASS.VEHICLE_INTEREST);

  // Multi-Offer Track-Feedback (Brandes): Modell + Status / Ablehnung
  const trackFeedbackRe = new RegExp(
    `\\b(?:kia\\s+)?(${KIA_INTEREST_MODEL_RE})\\b([^.]{0,60}?)`
    + '(?:\\bzu\\s+teuer\\b|\\bist\\s+(?:ihm|ihr)\\s+zu\\s+teuer\\b|\\bzu\\s+hoch\\b|\\bzur[uü]ckgestellt\\b|\\bpasst\\s+nicht\\b'
    + '|\\bfavorit\\b|\\bgefällt\\b|\\bgefaellt\\b|\\blieblings?\\b|\\bmag\\s+(?:er|sie|kunde)\\b'
    + '|\\bfindet\\s+(?:er|sie|kunde)\\s+gut\\b|\\bfindet\\s+(?:er|sie)\\s+(?:sehr\\s+)?gut\\b'
    + '|\\bgut\\b)',
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
    const favorite = /favorit|gefällt|gefaellt|lieblings?|mag\s+(?:er|sie|kunde)|findet\s+(?:er|sie|kunde)\s+(?:sehr\s+)?gut|(?:^|[^\w])gut(?:$|[^\w])/.test(cue)
      && !deferred;
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
        label: /zu\s+teuer/.test(cue)
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

  // Epic 4: Feedback je commercialScenario (Leasing/Finanzierung getrennt)
  const scenarioFeedbackEntries = parseScenarioOfferFeedbackFromText(t, lead);
  for (const entry of scenarioFeedbackEntries) {
    pushFact(facts, createExtractedFact({
      factClass: SELLER_FACT_CLASS.CUSTOMER_NEED,
      field: 'scenarioOfferFeedback',
      value: entry,
      label: entry.label || formatScenarioOfferFeedbackChip(entry, lead),
      confidence: 0.9,
      needsConfirmation: true,
    }));
  }

  // Trade-in / existing vehicle (Kia-Interesse nicht als Alt-Fzg. werten)
  // hasTradeInCue respektiert Negation („nicht in Zahlung geben“)
  if (hasTradeInCue(raw)) {
    const tentative = /\b(eventuell|vielleicht|ggf\.?|evtl\.?|gegebenenfalls|könnte|koennte)\b/i.test(t);
    pushFact(facts, createExtractedFact({
      factClass: SELLER_FACT_CLASS.TRADE_IN_FACT,
      field: 'tradeInRequested',
      value: tentative
        ? { status: 'possible', requested: true }
        : { status: 'requested', requested: true },
      label: tentative ? 'Inzahlungnahme eventuell' : 'Inzahlungnahme gewünscht',
      confidence: tentative ? 0.9 : 0.96,
    }));
  }

  const existingCandidates = [];
  const existingRe = new RegExp(
    `\\b(?:(schwarz\\w*|wei[sß]{1,2}\\w*|blau\\w*|grau\\w*|silber\\w*|rot\\w*|gr[uü]n\\w*)\\s+)?(${EXISTING_MAKE_RE})\\s+([a-z0-9-]{2,20})(?:\\s+(schalter|automatik|dsg))?\\b`,
    'gi',
  );
  let existingMatch = existingRe.exec(t);
  while (existingMatch) {
    const colorRaw = existingMatch[1] || null;
    const makeRaw = existingMatch[2];
    const modelRaw = existingMatch[3];
    const gearRaw = existingMatch[4] || null;
    const isKiaInterest = /^kia$/i.test(makeRaw)
      && new RegExp(`^(?:${KIA_INTEREST_MODEL_RE})$`, 'i').test(modelRaw);
    if (isKiaInterest) {
      existingMatch = existingRe.exec(t);
      continue;
    }
    const makeNorm = /^volkswagen$/i.test(makeRaw) || /^vw$/i.test(makeRaw)
      ? 'VW'
      : (/^škoda$/i.test(makeRaw) ? 'Skoda' : titleCaseToken(makeRaw));
    const model = titleCaseToken(modelRaw);
    const gear = gearRaw ? titleCaseToken(gearRaw) : null;
    let color = null;
    if (colorRaw) {
      const lower = String(colorRaw).toLowerCase();
      color = lower.startsWith('schwarz') ? 'schwarz'
        : lower.startsWith('weiß') || lower.startsWith('weiss') || /^wei[sß]/.test(lower) ? 'weiß'
        : lower.startsWith('blau') ? 'blau'
        : lower.startsWith('grau') ? 'grau'
        : lower.startsWith('silber') ? 'silber'
        : lower.startsWith('rot') ? 'rot'
        : lower.startsWith('grün') || lower.startsWith('gruen') ? 'grün'
        : lower;
    }
    const label = [makeNorm, model, gear].filter(Boolean).join(' ');
    existingCandidates.push({
      make: makeNorm,
      model,
      gear,
      color,
      label,
      span: existingMatch[0],
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
        color: existingPick.color || null,
      },
      label: existingPick.color
        ? `${existingPick.label} · ${titleCaseToken(existingPick.color)}`
        : existingPick.label,
      confidence: existingPick.gear || existingPick.color ? 0.93 : 0.9,
      rawExpression: existingPick.span,
      span: existingPick.span,
    }));
  }

  // Contract end (kurz) – kein Vollimport; Vollimport = import_customer_contract
  // Nur bei klaren End-Cues – nicht „Gesendet: … September“ + Leasing-Wunsch
  if (!isCustomerContractIntakeText(t)
    && /\bleasing\b/i.test(t)
    && /\b(auslauf|läuft|laeuft|vertragsende|leasingende|endet\b|läuft\s+aus|laeuft\s+aus|bis\s+\d|ende\s+(?:im|am|zum|der|des)?\s*\d|leasing\s+(?:ende|bis))\b/i.test(t)) {
    const endDate = parseMonthYear(t);
    pushFact(facts, createExtractedFact({
      factClass: SELLER_FACT_CLASS.CONTRACT_FACT,
      field: 'existingContractEnd',
      value: endDate ? { type: 'leasing', endDate } : { type: 'leasing' },
      label: endDate
        ? (formatContractEndLabel(endDate, { type: 'leasing' }) || `Leasingende ${endDate}`)
        : 'Leasingvertrag vorhanden',
      confidence: endDate ? 0.93 : 0.8,
      needsConfirmation: !endDate,
    }));
  }

  // Explizite Zahlungsart (nicht bei Dual-Szenario – commercialScenarios ist Wahrheit)
  if (!skipSinglePaymentType) {
  if (prefersFinancingOverLeasing) {
    pushFact(facts, createExtractedFact({
      factClass: SELLER_FACT_CLASS.COMMERCIAL_PREFERENCE,
      field: 'paymentType',
      value: 'financing',
      label: 'Finanzierung',
      confidence: 0.94,
    }));
  } else if (prefersLeasingOverFinancing) {
    pushFact(facts, createExtractedFact({
      factClass: SELLER_FACT_CLASS.COMMERCIAL_PREFERENCE,
      field: 'paymentType',
      value: 'leasing',
      label: 'Leasing',
      confidence: 0.94,
    }));
  } else if (/\b(?:barangebot|barkauf|barzahlung)\b/i.test(t)) {
    pushFact(facts, createExtractedFact({
      factClass: SELLER_FACT_CLASS.COMMERCIAL_PREFERENCE,
      field: 'paymentType',
      value: 'cash',
      label: 'Kauf / Bar',
      confidence: 0.9,
    }));
  } else if (/\bfinanzierung\b/i.test(t) && !/\b(?:privat)?leasing\b/i.test(t)) {
    pushFact(facts, createExtractedFact({
      factClass: SELLER_FACT_CLASS.COMMERCIAL_PREFERENCE,
      field: 'paymentType',
      value: 'financing',
      label: 'Finanzierung',
      confidence: 0.88,
    }));
  } else if (
    /\bprivatleasing\b/i.test(t)
    || /\bleasingangebot\b|\bleasing\s+(?:anbieten|machen|erstellen)\b/i.test(t)
    || /\bleasen\b/i.test(t)
    || (
      /\b(?:privat)?leasing\b/i.test(t)
      && (
        (/\b\d{2}\s*monate?\b/i.test(t) && /\b(?:km|kilometer)\b/i.test(t))
        || /\b(?:\d{1,2}|einem|eine|zwei|drei|vier|fünf|fuenf|sechs)\s+jahre?\b/i.test(t)
        || /\banzahlung|sonderzahlung|anzahlen|anzuzahlen\b/i.test(t)
      )
    )
  ) {
    pushFact(facts, createExtractedFact({
      factClass: SELLER_FACT_CLASS.COMMERCIAL_PREFERENCE,
      field: 'paymentType',
      value: 'leasing',
      label: /\bprivatleasing\b/i.test(t) ? 'Privatleasing' : 'Leasing',
      confidence: 0.92,
    }));
  }
  }

  // Wunschrate / commercial – unit-aware (km ≠ Kaufpreis; Anzahlung ≠ Kaufpreis)
  const purchasePrice = extractPurchasePriceUnitAware(raw);
  if (purchasePrice && !/\b(?:anzahlung|sonderzahlung|az)\b/i.test(t)) {
    pushFact(facts, createExtractedFact({
      factClass: SELLER_FACT_CLASS.OFFER_INSTRUCTION,
      field: 'purchasePrice',
      value: purchasePrice.value,
      label: purchasePrice.label,
      confidence: purchasePrice.confidence,
    }));
    pushFact(facts, createExtractedFact({
      factClass: SELLER_FACT_CLASS.COMMERCIAL_PREFERENCE,
      field: 'paymentType',
      value: 'cash',
      label: 'Kaufangebot',
      confidence: 0.82,
    }));
  }

  const termMileage = parseTermAndMileageShorthand(raw);
  if (termMileage.termMonths != null && !facts.some((f) => f.field === 'termMonths')) {
    pushFact(facts, createExtractedFact({
      factClass: SELLER_FACT_CLASS.COMMERCIAL_PREFERENCE,
      field: 'termMonths',
      value: termMileage.termMonths,
      label: `${termMileage.termMonths} Monate`,
      confidence: 0.92,
      rawExpression: String(termMileage.termMonths),
      span: String(termMileage.termMonths),
    }));
    if (!facts.some((f) => f.field === 'paymentType') && /\b(?:leasing|leasen)\b/i.test(t)) {
      // Nur bei explizitem „Leasing/leasen“ – nie aus Laufzeit/km erfinden
      pushFact(facts, createExtractedFact({
        factClass: SELLER_FACT_CLASS.COMMERCIAL_PREFERENCE,
        field: 'paymentType',
        value: 'leasing',
        label: 'Leasing',
        confidence: 0.9,
      }));
    }
  }

  const commercialRate = parseCommercialMonthlyRate(raw);
  const maxRateMatch = t.match(
    /\b(?:max(?:imal)?\.?|höchstens|hoechstens|bis\s+zu)\s*(\d{2,4})\s*(?:€|euro)?\b/i,
  ) || t.match(
    /\b(\d{2,4})\s*(?:€|euro)?\s*(?:max(?:imal)?\.?|höchstens|hoechstens)\b/i,
  ) || t.match(
    // „Mehr als 350 € … nicht“ / „nicht mehr als 350“ = Wunschbudget, keine Angebotsrate
    /\bmehr\s+als\s*(\d{2,4})\s*(?:€|euro)?(?:\s*im\s+monat)?\b.{0,40}\bnicht\b/i,
  ) || t.match(
    /\bnicht\s+mehr\s+als\s*(\d{2,4})\s*(?:€|euro)?\b/i,
  );
  const maxRateValue = maxRateMatch
    ? Number(String(maxRateMatch[1]).replace(/\D/g, ''))
    : null;
  if (
    maxRateValue != null
    && Number.isFinite(maxRateValue)
    && maxRateValue >= 50
    && maxRateValue <= 5000
    && !facts.some((f) => f.field === 'monthlyBudget' || f.field === 'purchasePrice')
  ) {
    pushFact(facts, createExtractedFact({
      factClass: SELLER_FACT_CLASS.COMMERCIAL_PREFERENCE,
      field: 'monthlyBudget',
      value: maxRateValue,
      label: `max. ${maxRateValue} €`,
      confidence: 0.95,
      rawExpression: maxRateMatch[0],
      span: maxRateMatch[0],
    }));
  } else if (
    commercialRate != null
    && !facts.some((f) => f.field === 'monthlyBudget' || f.field === 'purchasePrice')
  ) {
    const isWunsch = /\bwunschrate\b/i.test(t);
    pushFact(facts, createExtractedFact({
      factClass: SELLER_FACT_CLASS.COMMERCIAL_PREFERENCE,
      field: 'monthlyBudget',
      value: commercialRate,
      label: isWunsch ? `${commercialRate} € Wunschrate` : `${commercialRate} €/Monat`,
      confidence: 0.94,
    }));
  }

  const commercialDown = parseCommercialDownPayment(raw);
  if (commercialDown != null && !facts.some((f) => f.field === 'downPayment')) {
    pushFact(facts, createExtractedFact({
      factClass: SELLER_FACT_CLASS.COMMERCIAL_PREFERENCE,
      field: 'downPayment',
      value: commercialDown,
      label: commercialDown === 0 ? '0 € AZ' : `${commercialDown.toLocaleString('de-DE')} € AZ`,
      confidence: 0.94,
      rawExpression: String(commercialDown),
      span: String(commercialDown),
    }));
  }

  // Freistehender Betrag nach Laufzeit+km ohne Monats-Cue → AZ (Wittig: 5000 €)
  const hasTermFact = facts.some((f) => f.field === 'termMonths')
    || termMileage.termMonths != null;
  const hasMileageFact = facts.some((f) => (
    f.field === 'annualMileage' || f.field === 'mileagePerYear'
  )) || termMileage.annualMileage != null;
  const implicitDown = parseImplicitDownPayment(raw, {
    hasTermMonths: hasTermFact,
    hasAnnualMileage: hasMileageFact,
  });
  if (implicitDown != null && !facts.some((f) => f.field === 'downPayment')) {
    pushFact(facts, createExtractedFact({
      factClass: SELLER_FACT_CLASS.COMMERCIAL_PREFERENCE,
      field: 'downPayment',
      value: implicitDown,
      label: `${implicitDown.toLocaleString('de-DE')} € AZ`,
      confidence: hasTermFact && hasMileageFact ? 0.9 : 0.82,
      rawExpression: `${implicitDown} €`,
      span: `${implicitDown} €`,
    }));
  }

  // Seller-Alias „3k“ → 3000 € AZ (nur wenn noch keine AZ)
  if (!facts.some((f) => f.field === 'downPayment')) {
    const aliasCommercial = parseSellerCommercialAliasShorthand(raw);
    if (aliasCommercial.downPayment != null) {
      pushFact(facts, createExtractedFact({
        factClass: SELLER_FACT_CLASS.COMMERCIAL_PREFERENCE,
        field: 'downPayment',
        value: aliasCommercial.downPayment,
        label: `${aliasCommercial.downPayment.toLocaleString('de-DE')} € AZ`,
        confidence: 0.9,
        rawExpression: aliasCommercial.evidence?.[0] || `${aliasCommercial.downPayment}`,
        span: aliasCommercial.evidence?.[0] || String(aliasCommercial.downPayment),
      }));
    }
  }

  // Freistehende kleine Beträge ohne Cue → unsichere Wunschrate (nicht große AZ)
  if (
    !facts.some((f) => f.field === 'purchasePrice' || f.field === 'monthlyBudget')
    && !net
    && !/\b(rabatt|sonderrabatt|%\b)/i.test(t)
    && !/\banzahlung|az\b|sonderzahlung\b/i.test(t)
  ) {
    const lone = [...t.matchAll(/\b(\d{2,4})\s*(?:€|euro)(?!\w)/gi)]
      .map((m) => ({ raw: m[0], value: Number(m[1]), index: m.index || 0 }))
      .find((m) => looksLikeMonthlyBudgetAmount(m.value, t, m.index, m.raw.length)
        && !facts.some((f) => f.field === 'downPayment' && Number(f.value) === m.value));
    if (lone) {
      pushFact(facts, createExtractedFact({
        factClass: SELLER_FACT_CLASS.COMMERCIAL_PREFERENCE,
        field: 'monthlyBudget',
        value: lone.value,
        label: `${lone.value} €`,
        confidence: 0.55,
        needsConfirmation: true,
        rawExpression: lone.raw,
        span: lone.raw,
      }));
    }
  }

  // Soft-Wunsch: Kundenservice in der Leasingrate (nicht Formular-/Quelle-Blob)
  if (
    /kundenservice.{0,60}(?:in\s+der\s+)?(?:leasing)?rate|(?:service|wartung).{0,40}in\s+der\s+(?:leasing)?rate/i.test(t)
    && !facts.some((f) => f.field === 'serviceInclusionWish')
  ) {
    pushFact(facts, createExtractedFact({
      factClass: SELLER_FACT_CLASS.CUSTOMER_NEED,
      field: 'serviceInclusionWish',
      value: { kind: 'kundenservice_in_rate' },
      label: 'Kundenservice in der Leasingrate',
      source: SELLER_FACT_SOURCE.CUSTOMER_MESSAGE,
      confidence: 0.9,
    }));
  }

  // Nach AZ: freistehende Rate (z. B. „… 0 € Anzahlung, 399 €“) – keine großen AZ-Beträge
  if (
    !facts.some((f) => f.field === 'monthlyBudget' || f.field === 'purchasePrice')
    && (facts.some((f) => f.field === 'downPayment') || facts.some((f) => f.field === 'termMonths'))
  ) {
    const rateAfterCommercial = [...t.matchAll(/\b(\d{2,4})\s*(?:€|euro)(?!\w)/gi)]
      .map((m) => ({ raw: m[0], value: Number(m[1]), index: m.index || 0 }))
      .filter((m) => Number.isFinite(m.value) && m.value >= 50 && m.value <= 5000)
      .filter((m) => looksLikeMonthlyBudgetAmount(m.value, t, m.index, m.raw.length))
      .filter((m) => {
        // „0 € Anzahlung“ / bereits als AZ erkannt ausfiltern
        const after = t.slice(m.index + m.raw.length, m.index + m.raw.length + 16);
        if (/^\s*(?:anzahlung|az|sonderzahlung)\b/i.test(after)) return false;
        if (facts.some((f) => f.field === 'downPayment' && Number(f.value) === m.value)) return false;
        return true;
      });
    const pick = rateAfterCommercial[rateAfterCommercial.length - 1];
    if (pick) {
      pushFact(facts, createExtractedFact({
        factClass: SELLER_FACT_CLASS.COMMERCIAL_PREFERENCE,
        field: 'monthlyBudget',
        value: pick.value,
        label: `${pick.value} €/Monat`,
        confidence: 0.88,
        rawExpression: pick.raw,
        span: pick.raw,
      }));
    }
  }

  if (/\bsofort(?:\s+verfügbar|\s+verfuegbar)?\b/i.test(t) || /\bverfügbar(?:keit)?\s+sofort\b/i.test(t)) {
    pushFact(facts, createExtractedFact({
      factClass: SELLER_FACT_CLASS.VEHICLE_REQUIREMENT,
      field: 'availabilityPreference',
      value: 'immediate',
      label: 'sofort verfügbar',
      confidence: 0.94,
      rawExpression: 'sofort verfügbar',
      span: 'sofort',
    }));
  }

  const isRememberCue = /\bmerk(?:e|en)?\s*dir\b|\bmerken\b|\bnotier(?:e|en)?\b/i.test(t);
  const equipmentPriority = /m[uü]ssen\s+drin|muss\s+drin|pflicht|zwingend/i.test(t)
    ? 'required'
    : /w[äa]re\s+sch[öo]n|nice\s*to\s*have/i.test(t)
      ? 'preferred'
      : /\bwichtig\b|\bpriorit/i.test(t)
        ? 'important'
        : 'preferred';
  const prioritySuffix = equipmentPriority === 'required'
    ? 'muss'
    : equipmentPriority === 'important'
      ? 'wichtig'
      : null;

  const color = matchColorToken(t);
  // Nur bei Multi-Dump mit per-Spur-Farbe kein zusätzliches globales Chip
  const colorAlreadyOnInterest = Boolean(
    color
    && interestHits.length >= 2
    && interestHits.some((h) => h.color),
  );
  if (color && !colorAlreadyOnInterest) {
    const rawColor = color[1];
    const lower = String(rawColor || '').toLowerCase();
    const base = lower.startsWith('schwarz') ? 'schwarz'
      : lower.startsWith('weiß') || lower.startsWith('weiss') || /^wei([sß]|$)/.test(lower) ? 'weiß'
      : /wolfsgrau/.test(lower) ? 'wolfsgrau metallic'
      : lower.startsWith('blau') ? 'blau'
      : lower.startsWith('grau') ? (/metallic/.test(lower) ? 'grau metallic' : 'grau')
      : lower.startsWith('silber') ? 'silber'
      : lower.startsWith('rot') ? 'rot'
      : lower.startsWith('grün') || lower.startsWith('gruen') ? 'grün'
      : lower;
    // Farbe gehört zum Bestandfahrzeug („schwarzen VW Polo“) – kein Wunschfarbe-Chip
    const existingColorOwnsToken = Boolean(
      existingPick?.color
      && existingPick.color === base
      && !hasInterest
      && !bindToOpenOffer,
    );
    if (existingColorOwnsToken) {
      // skip global colorPreference
    } else {
    const label = /\bfarbe\b/i.test(t) && !/^farbe/i.test(rawColor)
      ? `Farbe ${titleCaseToken(base)}`
      : titleCaseToken(base);
    const colorConfidence = bindToOpenOffer || isRememberCue || hasInterest ? 0.94 : 0.82;
    const interestModelKey = interestHits.length === 1 ? interestHits[0].modelKey : null;
    const focusTrackId = offerTrackId
      || (!interestModelKey ? lead?.crm?.focusedVehicleTrackId : null)
      || null;
    const existingColor = lead?.crm?.needProfile?.colorPreference
      || lead?.wish?.preferredColor
      || null;
    const colorCorrectionCue = /\b(?:doch|lieber|statt|nee|nicht\s+mehr|änder|aender)\b/i.test(t);
    const safeColorUpdate = Boolean(
      bindToOpenOffer
      || isRememberCue
      || hasInterest
      || focusTrackId
      || (existingColor && colorCorrectionCue)
      || lead?.crm?.needProfile?.selectedModelKey,
    );
    let colorValue = base;
    if (interestModelKey) {
      // Neue Interesse-Spur: an Modell binden (Track-Id erst nach Focus)
      colorValue = {
        color: base,
        targetScope: 'offer_vehicle',
        modelKey: interestModelKey,
      };
    } else if (bindToOpenOffer || focusTrackId || (existingColor && colorCorrectionCue)) {
      colorValue = {
        color: base,
        targetScope: 'offer_vehicle',
        vehicleTrackId: focusTrackId || offerTrackId,
        ...(offerIdentityMeta || {}),
      };
    }
    pushFact(facts, createExtractedFact({
      factClass: (bindToOpenOffer || isRememberCue || safeColorUpdate)
        ? SELLER_FACT_CLASS.VEHICLE_REQUIREMENT
        : SELLER_FACT_CLASS.VEHICLE_INTEREST,
      field: 'colorPreference',
      value: colorValue,
      label,
      confidence: safeColorUpdate ? Math.max(colorConfidence, 0.92) : colorConfidence,
      needsConfirmation: !safeColorUpdate,
    }));
    }
  }

  const hasAhkToken = /\bahk\b|anhängerkupplung|anhaengerkupplung/i.test(t);
  const ahkListCue = /(?:^|[—–\-,;:/|])\s*ahk\b|\bahk\s*[,;./|—–-]/i.test(t);
  const ahkIntentCue = /\bwichtig|braucht|möchte|moechte|will|mit\b|m[uü]ssen\s+drin|muss\s+drin/i.test(t);
  const ahkRemoveCue = (
    /\bahk\b.{0,40}\b(?:nicht|kein|ohne|raus|weg|entfernen)\b/i.test(t)
    || /\b(?:nicht|kein|ohne|raus|weg).{0,25}\bahk\b/i.test(t)
    || /\b(?:nimm|entferne|streich).{0,30}\bahk\b/i.test(t)
  );
  if (hasAhkToken && ahkRemoveCue) {
    pushFact(facts, createExtractedFact({
      factClass: SELLER_FACT_CLASS.VEHICLE_REQUIREMENT,
      field: 'towHitchRequired',
      value: { remove: true },
      label: 'AHK entfernen',
      confidence: 0.94,
      rawExpression: 'AHK',
      span: 'AHK',
    }));
  } else if (hasAhkToken && (ahkIntentCue || ahkListCue || hasInterest)) {
    pushFact(facts, createExtractedFact({
      factClass: SELLER_FACT_CLASS.VEHICLE_REQUIREMENT,
      field: 'towHitchRequired',
      value: true,
      label: prioritySuffix ? `AHK · ${prioritySuffix}` : 'AHK wichtig',
      confidence: ahkListCue || hasInterest ? 0.95 : 0.94,
      rawExpression: 'AHK',
      span: 'AHK',
    }));
  }

  if (/\blieferzeit\b/i.test(t) && /\bwichtig|priorit|dringend/i.test(t)
    && !facts.some((f) => f.field === 'deliveryDeadline' || f.field === 'deliveryEstimateMonths')) {
    pushFact(facts, createExtractedFact({
      factClass: SELLER_FACT_CLASS.CUSTOMER_NEED,
      field: 'deliveryTimeImportance',
      value: 'high',
      label: 'Lieferzeit wichtig',
      confidence: 0.9,
    }));
  }

  // Ausstattung / Wünsche (Outlook-Bullets etc.)
  if (/\bautomatik\b/i.test(t)) {
    pushFact(facts, createExtractedFact({
      factClass: SELLER_FACT_CLASS.VEHICLE_REQUIREMENT,
      field: 'transmissionPreference',
      value: 'automatic',
      label: 'Automatik',
      confidence: existingPick?.gear && /schalter/i.test(existingPick.gear) ? 0.88 : 0.94,
    }));
  }

  if (/\belektro(?:auto|fahrzeug|wagen)?\b|\belektrisch\b|\bbev\b/i.test(t) && !/\bhybrid\b/i.test(t)) {
    pushFact(facts, createExtractedFact({
      factClass: SELLER_FACT_CLASS.VEHICLE_REQUIREMENT,
      field: 'fuelPreference',
      value: 'electric',
      label: 'Elektroauto',
      confidence: isRememberCue ? 0.94 : 0.92,
    }));
  }

  const equipmentWishRules = [
    { re: /\btotwinkel(?:assistent)?\b/i, label: 'Totwinkelassistent', id: 'blind_spot' },
    { re: /\bspurhalte(?:assistent)?\b/i, label: 'Spurhalteassistent', id: 'lane_assist' },
    { re: /\bverkehrszeichenerkennung\b|\bvze\b/i, label: 'Verkehrszeichenerkennung', id: 'traffic_sign' },
    { re: /\bw[äa]rmepumpe\b|\bwp\b/i, label: 'Wärmepumpe', id: 'heat_pump', validateEquipment: true },
    { re: /\bsitzheizung(?:\s+vorn)?\b/i, label: 'Sitzheizung', id: 'heated_seats' },
    { re: /\blenkradheizung\b/i, label: 'Lenkradheizung', id: 'heated_steering' },
    { re: /\bpanorama(?:dach)?\b/i, label: 'Panoramadach', id: 'panorama_roof' },
    { re: /\bwinter(?:\s*|-)?paket(?:\s*p?\s*\d+)?\b/i, label: 'Winterpaket', id: 'winter' },
    { re: /\bwinterreifen\b/i, label: 'Winterreifen', id: 'winter_tires' },
    { re: /\bwinterradsatz\b|\bwinterr[aä]der(?:satz)?\b/i, label: 'Winterradsatz', id: 'winter_wheel_set' },
    { re: /\bup\s*-?\s*drive\b/i, label: 'Up Drive', id: 'up_drive', validatePackage: true },
  ];
  const isEquipmentRemoveCue = /\b(?:raus|weg|entfernen|ohne)\b/i.test(t)
    || /\b(?:nimm|entferne|streich).{0,40}\b(?:raus|weg|entfernen)\b/i.test(t);
  for (const rule of equipmentWishRules) {
    if (!rule.re.test(t)) continue;
    // Bereits am Interest-Hit → kein zweites Chip, nur wenn nicht schon als package
    if (
      rule.id === 'winter'
      && interestHits.some((h) => /winter/i.test(String(h.package || '')))
      && !isEquipmentRemoveCue
    ) {
      continue;
    }
    const matchedEquip = t.match(rule.re)?.[0] || rule.label;
    let equipLabel = rule.label;
    if (rule.id === 'winter') {
      const p1 = matchedEquip.match(/p\s*(\d+)/i);
      equipLabel = p1 ? `Winter-Paket P${p1[1]}` : 'Winterpaket';
    } else if (rule.id === 'heated_seats' && /vorn/i.test(matchedEquip)) {
      equipLabel = 'Sitzheizung vorn';
    }
    const display = prioritySuffix ? `${equipLabel} · ${prioritySuffix}` : equipLabel;
    const interestModelKey = interestHits.length === 1 ? interestHits[0].modelKey : null;
    const interestTrim = interestHits.length === 1 ? (interestHits[0].trim || null) : null;
    if (isEquipmentRemoveCue) {
      pushFact(facts, createExtractedFact({
        factClass: SELLER_FACT_CLASS.VEHICLE_REQUIREMENT,
        field: 'equipmentWish',
        value: {
          id: rule.id,
          label: equipLabel,
          remove: true,
          ...(interestModelKey ? { modelKey: interestModelKey, targetScope: 'offer_vehicle' } : {}),
        },
        label: `${equipLabel} entfernen`,
        confidence: 0.94,
        rawExpression: equipLabel,
        span: equipLabel,
      }));
      continue;
    }
    let packageValidation = null;
    let equipmentValidation = null;
    if (rule.validatePackage && interestModelKey) {
      packageValidation = validateOfferPackageAgainstCatalog({
        modelKey: interestModelKey,
        packageLabel: equipLabel,
        trim: interestTrim,
      });
    }
    if (rule.validateEquipment && interestModelKey) {
      equipmentValidation = validateOfferEquipmentAgainstCatalog({
        modelKey: interestModelKey,
        equipmentId: rule.id,
        label: equipLabel,
      });
    }
    const packageUnresolved = Boolean(rule.validatePackage && packageValidation && !packageValidation.ok);
    const equipmentUnresolved = Boolean(rule.validateEquipment && equipmentValidation && !equipmentValidation.ok);
    const unresolved = packageUnresolved || equipmentUnresolved;
    pushFact(facts, createExtractedFact({
      factClass: SELLER_FACT_CLASS.VEHICLE_REQUIREMENT,
      field: 'equipmentWish',
      value: {
        id: unresolved
          ? null
          : (packageValidation?.packageId
            || equipmentValidation?.equipmentId
            || rule.id),
        label: packageValidation?.packageLabel
          || equipmentValidation?.equipmentLabel
          || equipLabel,
        priority: equipmentPriority,
        ...(interestModelKey ? { modelKey: interestModelKey, targetScope: 'offer_vehicle' } : {}),
        ...(rule.id === 'winter_wheel_set' ? { alternative: true } : {}),
        ...(unresolved ? {
          validationStatus: 'needs_review',
          validationReason: packageValidation?.reason
            || equipmentValidation?.reason
            || 'unknown_or_ambiguous_package',
        } : {}),
      },
      label: unresolved ? `${equipLabel} prüfen` : display,
      confidence: unresolved
        ? 0.72
        : (isRememberCue || equipmentPriority === 'required' ? 0.95 : 0.9),
      needsConfirmation: unresolved,
      rawExpression: equipLabel,
      span: equipLabel,
    }));
  }

  // Zentrale Seller-Alias-Registry (WP, WIN, DW, LR, …) – Katalog validiert
  const interestModelKeyForAlias = interestHits.length === 1 ? interestHits[0].modelKey : null;
  const interestTrimForAlias = interestHits.length === 1 ? (interestHits[0].trim || null) : null;
  for (const hit of findSellerAliasesInText(raw)) {
    if (hit.kind === 'color') {
      if (facts.some((f) => f.field === 'colorPreference')) continue;
      pushFact(facts, createExtractedFact({
        factClass: SELLER_FACT_CLASS.VEHICLE_REQUIREMENT,
        field: 'colorPreference',
        value: hit.canonicalId || hit.label,
        label: hit.label,
        confidence: 0.93,
        rawExpression: hit.matched,
        span: hit.matched,
      }));
      continue;
    }
    if (hit.kind === 'propulsion') {
      if (facts.some((f) => f.field === 'motorPreference' || f.field === 'batteryPreference')) continue;
      if (hit.canonicalId === 'long_range' || hit.canonicalId === 'standard_range') {
        pushFact(facts, createExtractedFact({
          factClass: SELLER_FACT_CLASS.VEHICLE_REQUIREMENT,
          field: 'motorPreference',
          value: { id: hit.canonicalId, label: hit.label, hint: hit.label },
          label: hit.label,
          confidence: 0.93,
          rawExpression: hit.matched,
          span: hit.matched,
        }));
      } else if (hit.canonicalId === 'awd' || hit.canonicalId === 'rwd') {
        pushFact(facts, createExtractedFact({
          factClass: SELLER_FACT_CLASS.VEHICLE_REQUIREMENT,
          field: 'motorPreference',
          value: { id: hit.canonicalId, label: hit.label, drive: hit.canonicalId },
          label: hit.label,
          confidence: 0.9,
          rawExpression: hit.matched,
          span: hit.matched,
        }));
      }
      continue;
    }
    if (hit.kind === 'trim') {
      // Trim meist schon am Interest; Alias nur wenn fehlend
      if (interestHits.length === 1 && !interestHits[0].trim) {
        interestHits[0].trim = hit.label;
      }
      continue;
    }
    if (hit.field === 'towHitchRequired') {
      if (facts.some((f) => f.field === 'towHitchRequired')) continue;
      pushFact(facts, createExtractedFact({
        factClass: SELLER_FACT_CLASS.VEHICLE_REQUIREMENT,
        field: 'towHitchRequired',
        value: true,
        label: 'AHK · wichtig',
        confidence: 0.95,
        rawExpression: hit.matched,
        span: hit.matched,
      }));
      continue;
    }
    if (hit.kind === 'equipment' || hit.kind === 'package') {
      const already = facts.some((f) => (
        f.field === 'equipmentWish'
        && (
          f.value?.id === hit.canonicalId
          || /wärmepumpe|heat_pump/i.test(String(f.label || '')) && hit.canonicalId === 'heat_pump'
          || /drive\s*wise/i.test(String(f.label || '')) && /drive\s*wise/i.test(hit.label)
          || /^winter/i.test(String(f.label || '')) && hit.canonicalId === 'winter'
        )
      ));
      if (already) continue;

      let packageValidation = null;
      let equipmentValidation = null;
      if (hit.validatePackage && interestModelKeyForAlias) {
        packageValidation = validateOfferPackageAgainstCatalog({
          modelKey: interestModelKeyForAlias,
          packageLabel: hit.label,
          trim: interestTrimForAlias,
        });
      }
      if (hit.validateEquipment && interestModelKeyForAlias) {
        equipmentValidation = validateOfferEquipmentAgainstCatalog({
          modelKey: interestModelKeyForAlias,
          equipmentId: hit.canonicalId,
          label: hit.label,
        });
      }
      const unresolved = (hit.validatePackage && packageValidation && !packageValidation.ok)
        || (hit.validateEquipment && equipmentValidation && !equipmentValidation.ok);
      const resolvedId = packageValidation?.ok
        ? packageValidation.packageId
        : (equipmentValidation?.ok ? (equipmentValidation.equipmentId || hit.canonicalId) : (
          (hit.validatePackage || hit.validateEquipment) ? null : hit.canonicalId
        ));
      const resolvedLabel = packageValidation?.packageLabel
        || equipmentValidation?.equipmentLabel
        || hit.label;
      pushFact(facts, createExtractedFact({
        factClass: SELLER_FACT_CLASS.VEHICLE_REQUIREMENT,
        field: 'equipmentWish',
        value: {
          id: resolvedId,
          label: resolvedLabel,
          ...(interestModelKeyForAlias
            ? { modelKey: interestModelKeyForAlias, targetScope: 'offer_vehicle' }
            : {}),
          ...(unresolved ? {
            validationStatus: 'needs_review',
            validationReason: packageValidation?.reason
              || equipmentValidation?.reason
              || 'unknown_or_ambiguous',
          } : {}),
        },
        label: unresolved ? `${hit.label} prüfen` : resolvedLabel,
        confidence: unresolved ? 0.72 : 0.93,
        needsConfirmation: Boolean(unresolved),
        rawExpression: hit.matched,
        span: hit.matched,
      }));
    }
  }

  // Leistungsangabe „229 PS“ → Katalog-Motor, sonst lokaler Offenpunkt
  if (!facts.some((f) => f.field === 'motorPreference' || f.field === 'batteryPreference')) {
    for (const power of findSellerPowerMentions(raw)) {
      const modelKey = interestModelKeyForAlias
        || interestHits[0]?.modelKey
        || null;
      const validated = modelKey
        ? validateOfferPowerAgainstCatalog({
          modelKey,
          powerPs: power.unit === 'ps' ? power.value : null,
          powerKw: power.unit === 'kw' ? power.value : null,
          raw: power.raw,
        })
        : { ok: false, uncertainty: true, reason: 'missing_model', raw: power.raw };
      if (validated.ok) {
        pushFact(facts, createExtractedFact({
          factClass: SELLER_FACT_CLASS.VEHICLE_REQUIREMENT,
          field: 'motorPreference',
          value: {
            id: validated.engineId,
            label: validated.engineLabel,
            powerPs: validated.powerPs,
            powerKw: validated.powerKw,
            hint: validated.engineLabel,
          },
          label: validated.engineLabel || power.raw,
          confidence: 0.94,
          rawExpression: power.raw,
          span: power.raw,
        }));
      } else {
        pushFact(facts, createExtractedFact({
          factClass: SELLER_FACT_CLASS.VEHICLE_REQUIREMENT,
          field: 'motorPreference',
          value: {
            id: null,
            label: power.raw,
            powerPs: power.unit === 'ps' ? power.value : null,
            powerKw: power.unit === 'kw' ? power.value : null,
            validationStatus: 'needs_review',
            validationReason: validated.reason || 'unknown_power',
          },
          label: `${power.raw} prüfen`,
          confidence: 0.7,
          needsConfirmation: true,
          rawExpression: power.raw,
          span: power.raw,
        }));
      }
      break;
    }
  }

  // „Business“ / „Privatleasing“ → bestehende Kundengruppe
  if (
    /\bbusiness\b/i.test(t)
    && !/\bbusiness\s*-?\s*paket\b/i.test(t)
    && !facts.some((f) => f.field === 'customerType')
  ) {
    pushFact(facts, createExtractedFact({
      factClass: SELLER_FACT_CLASS.CUSTOMER_FACT,
      field: 'customerType',
      value: COMMERCIAL_CUSTOMER_TYPE.BUSINESS,
      label: formatCustomerTypeLabel(COMMERCIAL_CUSTOMER_TYPE.BUSINESS),
      confidence: 0.9,
      rawExpression: 'Business',
      span: 'Business',
    }));
  } else if (
    /\bprivatleasing\b|\bprivatkunde\b|\bals\s+privat\b/i.test(t)
    && !facts.some((f) => f.field === 'customerType')
  ) {
    pushFact(facts, createExtractedFact({
      factClass: SELLER_FACT_CLASS.CUSTOMER_FACT,
      field: 'customerType',
      value: COMMERCIAL_CUSTOMER_TYPE.PRIVATE,
      label: formatCustomerTypeLabel(COMMERCIAL_CUSTOMER_TYPE.PRIVATE),
      confidence: 0.92,
      rawExpression: 'Privat',
      span: 'Privat',
    }));
  }

  if (/\bschiebedach\b/i.test(t)) {
    pushFact(facts, createExtractedFact({
      factClass: SELLER_FACT_CLASS.VEHICLE_REQUIREMENT,
      field: 'sunroofRequired',
      value: true,
      label: prioritySuffix ? `Schiebedach · ${prioritySuffix}` : 'Schiebedach',
      confidence: 0.92,
    }));
  }

  const trimWish = t.match(/\b(GT-?\s*Line|X-?\s*Line(?:\s*\d+)?|Earth|Air|Spirit|Vision|Core|Drive\s*Wise|Elite)\b/gi);
  if (trimWish?.length) {
    const unique = [...new Set(trimWish.map((x) => {
      const cleaned = titleCaseToken(x.replace(/\s+/g, ' '));
      return /^cor$/i.test(cleaned) ? 'Core' : cleaned;
    }))];
    const alreadyOnInterest = interestHits.some((h) => (
      h.trim && unique.some((u) => new RegExp(u.replace(/\s/g, '\\s*'), 'i').test(h.trim))
    ));
    if (!alreadyOnInterest || unique.length > 1 || bindToOpenOffer) {
      const identityFollowUp = parseOfferIdentityFollowUp(t);
      const primaryTrim = identityFollowUp?.trim || unique[0];
      const modelKeyForValidation = currentOfferContext?.modelKey
        || options.workingContext?.attachedVehicle?.modelKey
        || null;
      const validated = modelKeyForValidation
        ? validateOfferVehicleIdentity({ modelKey: modelKeyForValidation, trim: primaryTrim })
        : null;
      pushFact(facts, createExtractedFact({
        factClass: SELLER_FACT_CLASS.VEHICLE_REQUIREMENT,
        field: 'trimPreference',
        value: offerIdentityMeta
          ? {
            trims: unique,
            trim: primaryTrim,
            ...offerIdentityMeta,
            validated: validated?.ok === true,
            uncertainty: validated?.uncertainty === true,
          }
          : unique,
        label: unique.join(' / '),
        confidence: bindToOpenOffer
          ? (validated?.trimOk === false ? 0.7 : 0.93)
          : 0.86,
        needsConfirmation: Boolean(validated?.uncertainty),
      }));
    }
  }

  // Termin aus Outlook (Datum + Uhr + Probefahrt)
  const appointmentType = detectAppointmentType(t);
  const appointmentNow = options.now != null ? new Date(options.now) : new Date();
  let parsedAppt = parseAppointmentDateTime(t, appointmentNow);
  if (
    appointmentType === APPOINTMENT_TYPES.CALLBACK
    && !parsedAppt.startAt
    && parsedAppt.missing === 'time'
    && parsedAppt.partialDate
  ) {
    const resolvedCb = resolveRelativeDateTime(t, { now: appointmentNow });
    if (resolvedCb.ok && resolvedCb.startsAt) {
      parsedAppt = { startAt: resolvedCb.startsAt, missing: null };
    }
  }
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

  // Offer instructions – ungültige %-Werte (z. B. 449) nicht als Rabatt übernehmen
  const discount = t.match(/\b(\d{1,3}(?:[.,]\d+)?)\s*(?:%|prozent)\s*(?:sonder)?rabatt\b/i)
    || t.match(/\b(\d{1,3}(?:[.,]\d+)?)\s*%(?!\d)/)
    || t.match(/\b(\d{1,3}(?:[.,]\d+)?)\s*prozent\b/i);
  if (discount) {
    const hasOfferCue = /\brabatt|angebot|erstell|mach|sonder|leasing|finanz/i.test(t);
    const checked = validateDiscountPercent(discount[1]);
    if (!checked.ok) {
      if (checked.conflict) {
        pushFact(facts, createExtractedFact({
          factClass: SELLER_FACT_CLASS.OFFER_INSTRUCTION,
          field: 'discountPercentInvalid',
          value: { raw: discount[1], conflict: true },
          label: INVALID_DISCOUNT_WARNING,
          confidence: 0.95,
          needsConfirmation: true,
        }));
      }
    } else if (hasOfferCue || checked.value >= 10) {
      // Isolierte %-Zahl nur mit Bestätigung (z. B. „21 %“ ohne Kontext)
      pushFact(facts, createExtractedFact({
        factClass: SELLER_FACT_CLASS.OFFER_INSTRUCTION,
        field: 'discountPercent',
        value: checked.value,
        label: `${checked.value} % Rabatt`,
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
  const plannedMonthYear = parseRelativeMonthYear(t, options.now);
  const deliveryAnswer = parseDeliveryTimeAnswerFromText(t);
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
  } else if (
    plannedMonthYear
    && !facts.some((f) => f.field === 'deliveryDeadline' || f.field === 'existingContractEnd')
    && /\b(?:plant|planung|liefern|lieferung|bereit|fahrzeug\s+für|neues?\s+fahrzeug|wunschtermin|zieltermin|benötig|brauch|fahrzeug)\b/i.test(t)
  ) {
    const [year, month] = plannedMonthYear.split('-');
    const monthNames = {
      '01': 'Januar', '02': 'Februar', '03': 'März', '04': 'April',
      '05': 'Mai', '06': 'Juni', '07': 'Juli', '08': 'August',
      '09': 'September', '10': 'Oktober', '11': 'November', '12': 'Dezember',
    };
    pushFact(facts, createExtractedFact({
      factClass: SELLER_FACT_CLASS.CUSTOMER_NEED,
      field: 'deliveryDeadline',
      value: { endDate: plannedMonthYear, important: false, precision: 'month' },
      label: `Geplant ${monthNames[month] || month} ${year}`,
      confidence: 0.9,
    }));
  } else if (deliveryAnswer) {
    // Epic 3: Seller beantwortet offene Lieferzeitfrage (z. B. „ca. 8–12 Wochen“)
    const verified = /\b(?:hersteller|werk|preislist|verifiziert|stammdaten|offiziell)\b/i.test(t);
    pushFact(facts, createExtractedFact({
      factClass: SELLER_FACT_CLASS.SELLER_FACT,
      field: 'deliveryTimeAnswer',
      value: {
        ...deliveryAnswer,
        open: false,
        source: verified
          ? SELLER_FACT_SOURCE.VERIFIED_VEHICLE_DATA
          : SELLER_FACT_SOURCE.SELLER_INPUT,
      },
      label: `Lieferzeit ca. ${deliveryAnswer.answerText}`,
      confidence: 0.92,
      source: verified
        ? SELLER_FACT_SOURCE.VERIFIED_VEHICLE_DATA
        : SELLER_FACT_SOURCE.SELLER_INPUT,
    }));
  } else if (delivery) {
    const raw = delivery[1];
    const months = WORD_MONTHS[String(raw).toLowerCase()] ?? Number(raw);
    if (months) {
      pushFact(facts, createExtractedFact({
        factClass: SELLER_FACT_CLASS.SELLER_FACT,
        field: 'deliveryTimeAnswer',
        value: {
          answerText: `${months} Monate`,
          months,
          approximate: true,
          open: false,
          source: SELLER_FACT_SOURCE.SELLER_INPUT,
        },
        label: `Lieferzeit ca. ${months} Monate`,
        confidence: 0.85,
        source: SELLER_FACT_SOURCE.SELLER_INPUT,
      }));
      pushFact(facts, createExtractedFact({
        factClass: SELLER_FACT_CLASS.OFFER_INSTRUCTION,
        field: 'deliveryEstimateMonths',
        value: { value: months, unit: 'months', approximate: true },
        label: `Lieferzeit ca. ${months} Monate`,
        confidence: 0.85,
      }));
    }
  }

  // Mileage – nur unit-aware; Shorthand setzt annualMileage ggf. schon
  // Trade-in-Odograph („Sportage von 2021 mit ungefähr 70.000 km“) ≠ Wunsch-Jahreskilometer
  const tradeInOdometerContext = /\bvon\s+20\d{2}\b[\s\S]{0,80}\b(?:ca\.?|circa|ungefähr|ungefaehr|etwa)?\s*\d[\d.]*\s*km\b/i.test(raw)
    || /\b(?:ca\.?|circa|ungefähr|ungefaehr|etwa)\s*\d[\d.]*\s*km\b[\s\S]{0,60}\bin\s*zahlung/i.test(raw);
  const km = t.match(/\b(\d{1,2}(?:\.\d{3})?|\d{4,6})\s*(?:tkm|km|kilometer)\b/i)
    || t.match(/\bdoch\s+(\d{4,6})\s*(?:km|kilometer)\b/i);
  if (
    km
    && !tradeInOdometerContext
    && !facts.some((f) => f.field === 'annualMileage')
  ) {
    const value = Number(String(km[1]).replace(/\./g, '')) * (/tkm/i.test(km[0]) && Number(km[1]) < 100 ? 1000 : 1);
    const normalized = value < 1000 ? value * 1000 : value;
    if (normalized > 0) {
      pushFact(facts, createExtractedFact({
        factClass: SELLER_FACT_CLASS.COMMERCIAL_PREFERENCE,
        field: 'annualMileage',
        value: normalized,
        label: `${normalized.toLocaleString('de-DE')} km`,
        confidence: /\bdoch\b|statt/i.test(t) ? 0.95 : 0.92,
        rawExpression: km[0],
        span: km[0],
      }));
    }
  } else if (
    !tradeInOdometerContext
    && termMileage.annualMileage != null
    && Number(termMileage.annualMileage) > 0
    && !facts.some((f) => f.field === 'annualMileage')
  ) {
    const kmLabel = `${termMileage.annualMileage.toLocaleString('de-DE')} km`;
    pushFact(facts, createExtractedFact({
      factClass: SELLER_FACT_CLASS.COMMERCIAL_PREFERENCE,
      field: 'annualMileage',
      value: termMileage.annualMileage,
      label: kmLabel,
      confidence: 0.9,
      rawExpression: kmLabel,
      span: kmLabel,
    }));
  }

  // Trade-in / Bestandsfahrzeug (Multi-Source vorbereitet)
  for (const ti of extractTradeInCandidates(raw)) {
    const isDriveCue = /faehrt|fährt/i.test(ti.cue || '');
    const factClass = isDriveCue && !hasTradeInCue(raw)
      ? SELLER_FACT_CLASS.EXISTING_VEHICLE
      : SELLER_FACT_CLASS.TRADE_IN_FACT;
    const label = factClass === SELLER_FACT_CLASS.EXISTING_VEHICLE
      ? (ti.label || [ti.make, ti.model].filter(Boolean).join(' '))
      : `Inzahlungnahme: ${ti.label}`;
    pushFact(facts, createExtractedFact({
      factClass,
      field: factClass === SELLER_FACT_CLASS.EXISTING_VEHICLE ? 'existingVehicle' : 'tradeInVehicle',
      value: {
        make: ti.make,
        model: ti.model,
        year: ti.year ?? null,
        mileageKm: ti.mileageKm ?? null,
        mileageApproximate: Boolean(ti.mileageApproximate),
      },
      label,
      confidence: ti.ambiguous ? 0.7 : 0.94,
      needsConfirmation: ti.ambiguous,
      rawExpression: ti.span || ti.label,
      span: ti.span || null,
    }));
  }

  // Offene Kundenfragen / Unsicherheiten – keine erfundenen Beträge
  // Kein \\b vor Umlaut (JS \\w kennt ü/ö/ä nicht)
  const openQuestionSpecs = [];
  if (/überführungskosten|ueberfuehrungskosten|überführung(?:skosten)?/i.test(t)
    && /(?:teilen|mitteilen|bitte|erfahren|wie\s+hoch|welche)/i.test(t)) {
    openQuestionSpecs.push({
      topic: 'transfer_costs',
      label: 'Überführungskosten erfragen',
    });
  }
  if (/einmalkosten/i.test(t)
    && /(?:teilen|mitteilen|bitte|weitere|alle)/i.test(t)) {
    openQuestionSpecs.push({
      topic: 'one_time_costs',
      label: 'weitere Einmalkosten erfragen',
    });
  }
  if (/(?:mögliche(?:n)?\s+)?förderung|foerderung/i.test(t)
    && /(?:möglich|vorbehaltlich|eventuell|falls)/i.test(t)) {
    openQuestionSpecs.push({
      topic: 'subsidy',
      label: 'mögliche Förderung (offen)',
      uncertain: true,
    });
  }
  if (/konditionen\s+auf\s+dieser\s+basis|ausweis\s+der\s+konditionen/i.test(t)) {
    openQuestionSpecs.push({
      topic: 'quote_on_basis',
      label: 'Konditionen auf dieser Basis gewünscht',
    });
  }
  for (const q of openQuestionSpecs) {
    if (facts.some((f) => f.field === 'openCustomerQuestion' && f.value?.topic === q.topic)) continue;
    pushFact(facts, createExtractedFact({
      factClass: SELLER_FACT_CLASS.CUSTOMER_NEED,
      field: 'openCustomerQuestion',
      value: {
        topic: q.topic,
        status: q.uncertain ? 'uncertain' : 'open',
        amount: null,
      },
      label: q.label,
      confidence: 0.93,
      needsConfirmation: Boolean(q.uncertain),
      rawExpression: q.label,
      span: q.label,
    }));
  }

  // Document request / checklist hint
  if (
    (
      /\bfahrzeugschein|gehaltsnachweis|ausweis|selbstauskunft|unterlagen?\b/i.test(t)
      && /\b(frag|anforder|fehl|brauch|schick|welche|upload)\b/i.test(t)
    )
    || /\bwelche\s+unterlagen?\b/i.test(t)
    || /\bsicheren?\s+upload[-\s]?link\b/i.test(t)
  ) {
    pushFact(facts, createExtractedFact({
      factClass: SELLER_FACT_CLASS.DOCUMENT_FACT,
      field: 'documentRequest',
      value: true,
      label: 'Unterlagen prüfen',
      confidence: 0.9,
    }));
  }

  // Legacy seller facts (vehicle/rate/discount) as seller_fact fallback labels
  for (const legacy of extractSellerFactsFromInput(t)) {
    if (facts.some((f) => f.label === legacy.label)) continue;
    if (legacy.key === 'vehicle' && hasInterest) continue;
    if (legacy.key === 'vehicle' && (
      hasTradeInCue(raw)
      || facts.some((f) => f.field === 'tradeInVehicle' || f.field === 'tradeInRequested')
    )) continue;
    if (legacy.key === 'color' && facts.some((f) => f.field === 'colorPreference')) continue;
    if (legacy.key === 'discount' && facts.some((f) => f.field === 'discountPercent')) continue;
    // Budget/AZ ≠ Angebotsrate – kein paralleles Legacy-rate-Fact
    if (legacy.key === 'rate' && (
      facts.some((f) => f.field === 'monthlyBudget' || f.field === 'downPayment')
      || /\b(?:anzahlung|sonderzahlung|az)\b/i.test(t)
      || /\bmehr\s+als\b.{0,30}\bnicht\b/i.test(t)
      || /\bnicht\s+mehr\s+als\b/i.test(t)
    )) continue;
    if (legacy.key === 'termMonths' && facts.some((f) => f.field === 'termMonths')) continue;
    pushFact(facts, createExtractedFact({
      factClass: SELLER_FACT_CLASS.SELLER_FACT,
      field: legacy.key,
      value: legacy.value ?? legacy.label,
      label: legacy.label,
      source: SELLER_FACT_SOURCE.SELLER_INPUT,
      confidence: 0.8,
    }));
  }

  return enrichFactsForMultiSource(facts, raw);
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
  // „optional mail: …“ / „Mail: …“ = Kontaktfeld, kein Schreib-Auftrag
  const withoutContactMail = t.replace(/\b(?:optional\s+)?(?:e-?mail|mail)\s*:[^\n]*/gi, ' ');
  if (/\b(schreib(?:e|en)?|sag(?:e|en)?|informier(?:e|en)?|fass(?:e|en)?|zusammenfass(?:e|en)?|whatsapp|schick(?:e|en)?\s+ihm|schick(?:e|en)?\s+ihr)\b/i.test(withoutContactMail)) {
    return true;
  }
  // Bare „Mail“ nur mit Schreib-/Sende-Cue
  return /\b(?:e-?mail|mail)\b/i.test(withoutContactMail)
    && /\b(schreib|sag|schick|senden|versend|an\s+den|an\s+die)\b/i.test(withoutContactMail);
}

/**
 * Multi-Intent Detection (kein Single-Intent-Zwang).
 * @param {string} text
 * @param {object[]} facts
 * @param {{ attachments?: object[] }} [options]
 */
export function detectSellerTurnIntents(text = '', facts = [], options = {}) {
  const t = String(text ?? '').trim();
  const intents = [];
  const add = (intent, confidence = 0.8) => {
    if (!intents.some((i) => i.type === intent)) {
      intents.push({ type: intent, confidence });
    }
  };

  const explicitMessage = isExplicitCustomerMessageCue(t);
  const isHistoryQuery = /\b(was hatte|was habe|damals|verlauf|historie)\b/i.test(t)
    || /\bwas\b.{0,40}\bgeschrieben\b/i.test(t)
    || /\bwelche[snr]?\s+angebot\b/i.test(t);
  const isOfferSentQuery = /\b(wann\s+habe\s+ich|zuletzt).{0,60}\bangebot\b/i.test(t)
    || /\bangebot\b.{0,40}\b(geschickt|gesendet|versendet)\b/i.test(t);
  // Batch: „mach die 3 Angebote“ / „Angebote für alle“ → PREPARE_OFFER (Shells je Spur)
  const isBatchOfferCommand = isBatchOfferCue(t);
  const isBareOfferCommand = isBareOrGenericOfferCue(t);
  const isCreateOfferCommand = isBatchOfferCommand
    || isBareOfferCommand
    || /(?:^|[^\wäöüÄÖÜß])(?:erstell(?:e|en)?|mach(?:e|en)?)\s+(?:herrn?\s+|frau\s+|\w+\s+)?(?:ein\s+)?(?:leasing)?angebot\b/i.test(t)
    || /\bein\s+(?:leasing)?angebot\s+(?:für|über)\b/i.test(t)
    // „Erstelle Brandes ein XCeed-Angebot …“
    || /(?:erstell(?:e|en)?|mach(?:e|en)?)\b.{0,60}\b(?:ein\s+)?[\wÄÖÜäöüß-]+-?angebot\b/i.test(t)
    // Minimaler Concept-Draft: „Mach erstmal nur einen EV3 Entwurf“
    || (
      /\bentwurf\b/i.test(t)
      && /\b(ev\s*[2-9]|sportage|sorento|ceed|xceed|niro|picanto)\b/i.test(t)
      && !/\b(schreib|sag(?:e|en)?\s+ihm|mail\b|nachricht|whatsapp)\b/i.test(t)
    )
    // Freier Clever-Kurzbefehl: „EV2 Angebot Air in weiß“ / „Ev 2 angebot …“
    || (
      /\b(ev\s*[2-9]|sportage|sorento|ceed|xceed|niro|picanto)\b/i.test(t)
      && /\bangebot\b/i.test(t)
      && !/\b(schreib|sag(?:e|en)?\s+ihm|mail\b|nachricht|whatsapp)\b/i.test(t)
    );
  const isMessageOnlyPrice = /\bschreib(?:e|en)?\b/i.test(t)
    && /\b(?:dass|das)\b/i.test(t)
    && /\b(?:kostet|preis|€|euro)\b/i.test(t)
    && !/\berstell|mach(?:e|en)?\s+.*angebot\b/i.test(t);
  const isAmbiguousOfferOrMessage = !isCreateOfferCommand
    && !isMessageOnlyPrice
    && !/\bschreib|sag|erstell|mach|öffne|finde|was\s+wollte|was\s+hatte|wann\s+habe\b/i.test(t)
    && /\b(picanto|sportage|xceed|ev\s*\d)\b/i.test(t)
    && /\b\d{1,3}(?:\.\d{3})+\s*(?:€|euro)?\b/i.test(t);
  const isOpenCustomer = /(?:^|[^\wäöüÄÖÜß])(?:öffne|zeige|zeig)\s+(?:den\s+|die\s+)?(?:kunden?\s+)?(?:herrn?\s+|frau\s+)?[A-Za-zÄÖÜäöüß-]/i.test(t)
    && !/\banhängelast|reichweite\b/i.test(t)
    && !isCreateOfferCommand;
  const isFindCustomer = /(?:^|[^\wäöüÄÖÜß])(?:finde|suche)\s+(?:den\s+|die\s+)?kunden?\b/i.test(t)
    || (/\bfinde\b/i.test(t) && /\b(sportage|xceed|ahk|rot)\b/i.test(t) && !/\banhängelast\b/i.test(t));
  const isSummarizeCustomer = /\bwas\s+wollte\b/i.test(t)
    || /\bnoch\s+einmal\??\s*$/i.test(t)
    || /\b(?:kundenkontext|zusammenfassung)\b/i.test(t)
    || /\bwie\s+steht.?s\s+(?:bei|mit)\b/i.test(t);
  const isSuccessionOfferPrepare = isPrepareSuccessionOfferCue(t);
  const isNextStepQuery = /\b(?:was\b.{0,40}\bnächste[rsn]?\b|nächste[rsn]?\s+schritt|was\s+jetzt|was\s+soll\s+ich|worauf\s+fokuss|golden\s+moment|wechselchance|rückgabe\s+vorbereiten)\b/i.test(t)
    || (/\bnachfolgeangebot\b/i.test(t) && !isSuccessionOfferPrepare);
  const hasAppointmentFact = facts.some((f) => f.factClass === SELLER_FACT_CLASS.APPOINTMENT_FACT);
  const resolvedIntake = resolveContractIntakeText({
    sellerInput: t,
    attachments: options.attachments,
  });
  const isContractIntake = isCustomerContractIntakeText(resolvedIntake.text)
    || isCustomerContractIntakeText(t)
    || (
      (resolvedIntake.sourceType === 'contract_pdf'
        || resolvedIntake.sourceType === 'contract_pdf_ocr')
      && resolvedIntake.needsManualDescribe
    );
  const isContractCompareMessage = !isContractIntake && isContractCompareMessageCue(t);
  const isContractCompare = !isContractIntake && (
    isContractOfferCompareQuery(t) || isContractCompareMessage
  );
  // Offer-/Konfigurator-PDF: kein Inbound-/Reply-Intake (Bank-/Leasing-Kontakte ≠ Kunde)
  const offerPdfDrop = isOfferPdfDropContext(options.attachments, t);
  const isReplyPaste = !isContractIntake && !isContractCompare && !offerPdfDrop
    && isCustomerReplyPaste(t);
  const isInboundPaste = !isContractIntake && !isContractCompare && !isReplyPaste
    && !offerPdfDrop
    && isInboundLeadPaste(t)
    && !isSellerFreestyleCaptureDump(t);
  const looksLikeContractLookup = isCustomerContractQuery(t)
    && !/\b(kinder|verheiratet|wunschrate|netto|in\s+zahlung|nehmen\s+wir)\b/i.test(t);
  const isContractQuery = !isContractIntake && !isContractCompare && !isInboundPaste && !isReplyPaste
    && looksLikeContractLookup;
  const isInboundLead = isInboundPaste && !isContractQuery;
  const isCustomerReply = isReplyPaste && !isContractQuery;
  const isCaptureDump = isSellerFreestyleCaptureDump(t);
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
  ];
  // Bei „schreib ihm …“ sind Angebots-Fakten im Text oft nur Nachrichtinhalt
  if (!explicitMessage) contextClasses.push(SELLER_FACT_CLASS.OFFER_INSTRUCTION);

  const hasContextFacts = facts.some((f) => contextClasses.includes(f.factClass));

  if (isContractIntake) {
    add(SELLER_TURN_INTENTS.IMPORT_CUSTOMER_CONTRACT, 0.98);
    add(SELLER_TURN_INTENTS.RESOLVE_CUSTOMER_CONTEXT, 0.92);
  }

  if (isCustomerReply) {
    add(SELLER_TURN_INTENTS.CUSTOMER_REPLY, 0.98);
    add(SELLER_TURN_INTENTS.FIND_CUSTOMER, 0.94);
    add(SELLER_TURN_INTENTS.UPDATE_CUSTOMER_CONTEXT, 0.92);
    for (const next of proposeCustomerReplyNextActions({ text: t, facts })) {
      if (next?.intent) add(next.intent, 0.88);
    }
  } else if (isInboundLead) {
    add(SELLER_TURN_INTENTS.INBOUND_LEAD, 0.97);
    add(SELLER_TURN_INTENTS.FIND_CUSTOMER, 0.94);
    add(SELLER_TURN_INTENTS.UPDATE_CUSTOMER_CONTEXT, 0.9);
    // Nächste Aktion nur als Review-Proposal (runCleverSellerTurn) – kein DRAFT/OFFER vor Confirm
  }

  if (isContractCompare) {
    add(SELLER_TURN_INTENTS.COMPARE_CONTRACT_WITH_OFFER, 0.98);
    add(SELLER_TURN_INTENTS.RESOLVE_CUSTOMER_CONTEXT, 0.9);
    if (isContractCompareMessage || explicitMessage) {
      add(SELLER_TURN_INTENTS.DRAFT_MESSAGE, 0.97);
    }
  }

  if (isContractQuery) {
    add(SELLER_TURN_INTENTS.SEARCH_CUSTOMER_CONTRACTS, 0.97);
    add(SELLER_TURN_INTENTS.RESOLVE_CUSTOMER_CONTEXT, 0.9);
  }

  if (isCreateOfferCommand) {
    add(SELLER_TURN_INTENTS.FIND_CUSTOMER, 0.95);
    add(SELLER_TURN_INTENTS.PREPARE_OFFER, 0.97);
    // Nachricht nur bei explizitem Schreib-Cue – nicht weil „Angebot“ im Text steht
    if (explicitMessage) {
      add(SELLER_TURN_INTENTS.DRAFT_MESSAGE, 0.94);
    }
  }

  if (isMessageOnlyPrice) {
    add(SELLER_TURN_INTENTS.FIND_CUSTOMER, 0.9);
    add(SELLER_TURN_INTENTS.DRAFT_MESSAGE, 0.97);
  }

  if (isAmbiguousOfferOrMessage) {
    add(SELLER_TURN_INTENTS.UNKNOWN, 0.55);
  }

  if (isOfferSentQuery) {
    add(SELLER_TURN_INTENTS.SEARCH_CUSTOMER_OFFERS, 0.96);
    add(SELLER_TURN_INTENTS.SEARCH_CUSTOMER_HISTORY, 0.9);
  } else if (isHistoryQuery) {
    add(SELLER_TURN_INTENTS.SEARCH_CUSTOMER_HISTORY, 0.94);
    if (/\bgeschrieben|nachricht\b/i.test(t)) {
      add(SELLER_TURN_INTENTS.SEARCH_CUSTOMER_MESSAGES, 0.92);
    }
  }

  if (isOpenCustomer && !isHistoryQuery && !isOfferSentQuery && !isSummarizeCustomer) {
    add(SELLER_TURN_INTENTS.OPEN_CUSTOMER, 0.97);
    add(SELLER_TURN_INTENTS.CUSTOMER_LOOKUP, 0.9);
  }

  if (isFindCustomer && !isHistoryQuery && !isOfferSentQuery) {
    add(SELLER_TURN_INTENTS.FIND_CUSTOMER, 0.96);
    add(SELLER_TURN_INTENTS.CUSTOMER_LOOKUP, 0.9);
  }

  if (isSummarizeCustomer && !isHistoryQuery && !isOfferSentQuery && !isContractQuery) {
    add(SELLER_TURN_INTENTS.SUMMARIZE_CUSTOMER_CONTEXT, 0.96);
  }

  if (/\b(was liegt heute|heute an\b|tages(?:überblick|ueberblick|übersicht|uebersicht)|was steht heute|heutige vorgänge|heutige vorgaenge)\b/i.test(t)
    || /^was liegt heute an\??$/i.test(t)) {
    add(SELLER_TURN_INTENTS.GET_TODAY_OVERVIEW, 0.96);
  }

  if (isSuccessionOfferPrepare) {
    add(SELLER_TURN_INTENTS.PREPARE_OFFER, 0.98);
    add(SELLER_TURN_INTENTS.RESOLVE_CUSTOMER_CONTEXT, 0.92);
    if (explicitMessage) {
      add(SELLER_TURN_INTENTS.DRAFT_MESSAGE, 0.9);
    }
    add(SELLER_TURN_INTENTS.RECOMMEND_NEXT_STEP, 0.88);
  }

  if (isNextStepQuery) {
    add(SELLER_TURN_INTENTS.RECOMMEND_NEXT_STEP, 0.93);
  }

  const explicitAppointmentCue = hasExplicitAppointmentSellerCue(t);
  // Reiner Offer-/Konfigurator-PDF-Drop: kein Auto-Termin aus Boilerplate
  const allowAppointmentIntent = !offerPdfDrop || explicitAppointmentCue;

  if (offerPdfDrop && !isContractIntake && !isContractQuery && !isContractCompare) {
    add(SELLER_TURN_INTENTS.PREPARE_OFFER, 0.96);
    add(SELLER_TURN_INTENTS.RESOLVE_CUSTOMER_CONTEXT, 0.9);
  }

  if (
    allowAppointmentIntent
    && (hasAppointmentFact
      || detectSellerActionIntent(t) === SELLER_ACTION_INTENTS.PROPOSE_APPOINTMENT)
  ) {
    add(SELLER_TURN_INTENTS.PROPOSE_APPOINTMENT, 0.93);
    add(SELLER_TURN_INTENTS.RESOLVE_CUSTOMER_CONTEXT, 0.9);
    if (/\b(montag|dienstag|mittwoch|donnerstag|freitag|samstag|sonntag|morgen|übermorgen|heute|uhr)\b/i.test(t)
      || /\b\d{1,2}([:.]\d{2})?\s*uhr\b/i.test(t)) {
      add(SELLER_TURN_INTENTS.RESOLVE_RELATIVE_DATETIME, 0.92);
    }
    if (!/\b(trag|trage|eintragen)\b/i.test(t) || /\bvorschlag|vorschlagen|schlag/i.test(t)) {
      add(SELLER_TURN_INTENTS.DRAFT_MESSAGE, 0.9);
    }
  }

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
  // Bei Open/Find/Summary/History/Create-Offer/Inbound/Capture keinen Message-Default aus Primary-Action
  if (isOpenCustomer || isFindCustomer || isSummarizeCustomer || isHistoryQuery || isOfferSentQuery || isCreateOfferCommand || isMessageOnlyPrice || isAmbiguousOfferOrMessage || isContractIntake || isContractCompare || isContractQuery || isInboundLead || isCustomerReply || isCaptureDump) {
    // Navigation / Suche / Angebotsauftrag / Contract Memory / Intake / Capture hat Vorrang vor Message-/Offer-Default
  } else if (map[primary]) {
    const skipMessageDefault = primary === SELLER_ACTION_INTENTS.MESSAGE_CUSTOMER
      && (
        isHistoryQuery
        || isNextStepQuery
        || hasAppointmentFact
        || (hasContextFacts && !explicitMessage)
      );
    // Telefon-Capture: reicher Merken-Dump (Kinder/AHK/…) + schwaches Rate-/Trim-Signal
    // darf nicht still auf PREPARE_OFFER eskalieren (sonst Stuck-Review statt compact).
    const skipWeakOfferDefault = primary === SELLER_ACTION_INTENTS.PREPARE_OFFER
      && hasContextFacts
      && !isCreateOfferCommand
      && !explicitMessage;
    if (!skipMessageDefault && !skipWeakOfferDefault) add(map[primary], 0.85);
  }

  if (explicitMessage && !isHistoryQuery && !isNextStepQuery && !isOfferSentQuery && !isOpenCustomer && !isFindCustomer && !isSummarizeCustomer && !isCreateOfferCommand && !isContractCompare && !isInboundLead && !isCustomerReply && !isCaptureDump) {
    add(SELLER_TURN_INTENTS.DRAFT_MESSAGE, 0.96);
  } else if (
    hasContextFacts
    && !isContractIntake
    && !isContractQuery
    && !isContractCompare
    && !hasAppointmentFact
    && !isFindCustomer
    && !isOpenCustomer
    && !isSummarizeCustomer
    && !isHistoryQuery
    && !isOfferSentQuery
    && !isCreateOfferCommand
    && !isMessageOnlyPrice
    && !isAmbiguousOfferOrMessage
    && !isInboundLead
  ) {
    add(SELLER_TURN_INTENTS.UPDATE_CUSTOMER_CONTEXT, 0.95);
  } else if (hasAppointmentFact && hasContextFacts && !isCreateOfferCommand && !isContractIntake && !isContractQuery && !isContractCompare && !isInboundLead) {
    add(SELLER_TURN_INTENTS.UPDATE_CUSTOMER_CONTEXT, 0.88);
  } else if (isInboundLead && hasContextFacts) {
    add(SELLER_TURN_INTENTS.UPDATE_CUSTOMER_CONTEXT, 0.9);
  } else if (isCaptureDump && hasContextFacts) {
    add(SELLER_TURN_INTENTS.UPDATE_CUSTOMER_CONTEXT, 0.95);
  }

  // Benannter Kunde + Nachricht → Kundensuche (nicht jedes „Schreib …“ mit Großbuchstaben)
  const namedInMessage = facts.some((f) => f.field === 'customerName')
    || /\b(?:herrn?\s+|frau\s+)([A-Za-zÄÖÜäöüß-]{2,40})\b/i.test(t);
  if (
    (explicitMessage || intents.some((i) => i.type === SELLER_TURN_INTENTS.DRAFT_MESSAGE))
    && namedInMessage
    && !isHistoryQuery
    && !isOfferSentQuery
    && !isOpenCustomer
    && !isSummarizeCustomer
  ) {
    add(SELLER_TURN_INTENTS.FIND_CUSTOMER, 0.93);
  }

  // Grounded Vehicle Knowledge + Kundennachricht (Slice 4)
  const wantsPackageExplain = /\b(technologie[-\s]?paket|technik[-\s]?paket)\b/i.test(t)
    && /\b(erklär|erkläre|erklären|umfasst|inhalt|enthalten|was\s+(ist|im)|schreib)\b/i.test(t);
  const wantsEquipmentExplain = /\b(ausstattung|serienausstattung)\b/i.test(t);
  const hasVehicleCue = /\b(picanto|sportage|xceed|ev\s?\d|ceed|niro|sorento|gt[-\s]?line)\b/i.test(t)
    || facts.some((f) => f.field === 'vehicleInterest');
  const hasSellerVehicleFeatures = /\b(technologie[-\s]?paket|technik[-\s]?paket|schiebedach)\b/i.test(t);
  const groundedMessage = (
    wantsPackageExplain
    || wantsEquipmentExplain
    || (explicitMessage && hasSellerVehicleFeatures)
  ) && (hasVehicleCue || wantsPackageExplain);

  if (groundedMessage && !isCreateOfferCommand && !isHistoryQuery) {
    add(SELLER_TURN_INTENTS.DRAFT_MESSAGE, 0.97);
    if (hasVehicleCue || wantsPackageExplain) {
      add(SELLER_TURN_INTENTS.RESOLVE_VEHICLE, 0.94);
    }
    if (wantsPackageExplain || /\btechnologie[-\s]?paket\b/i.test(t)) {
      add(SELLER_TURN_INTENTS.LOOKUP_VEHICLE_PACKAGE, 0.93);
    }
    if (wantsEquipmentExplain) {
      add(SELLER_TURN_INTENTS.LOOKUP_VEHICLE_EQUIPMENT, 0.92);
    }
  }

  // „Erklär Garritano das Technologie-Paket“ ohne klares Fahrzeug → Resolve + Package
  if (wantsPackageExplain && !hasVehicleCue && !isCreateOfferCommand) {
    add(SELLER_TURN_INTENTS.DRAFT_MESSAGE, 0.9);
    add(SELLER_TURN_INTENTS.RESOLVE_VEHICLE, 0.95);
    add(SELLER_TURN_INTENTS.LOOKUP_VEHICLE_PACKAGE, 0.94);
    add(SELLER_TURN_INTENTS.FIND_CUSTOMER, 0.9);
  }

  // „Schreibe X ein Angebot …“ = Angebot + Nachricht
  // Aber „Fasse/Erkläre das angehängte Angebot …“ = nur Nachricht, kein neues Angebot
  if (explicitMessage && /\bangebot\b/i.test(t)) {
    const summarizeExisting = /\b(fass(?:e|en)?|zusammenfass|erkl[aä]r|angehängten?\s+angebot)\b/i.test(t)
      && !/\b(mach|erstell|vorbereiten|anbieten|neu(?:es)?\s+angebot)\b/i.test(t);
    if (!summarizeExisting) {
      add(SELLER_TURN_INTENTS.PREPARE_OFFER, 0.93);
    }
  }

  if (facts.some((f) => f.factClass === SELLER_FACT_CLASS.TRADE_IN_FACT)) {
    add(SELLER_TURN_INTENTS.PREPARE_TRADE_IN, 0.92);
  }
  if (facts.some((f) => f.factClass === SELLER_FACT_CLASS.DOCUMENT_FACT)) {
    add(SELLER_TURN_INTENTS.REQUEST_DOCUMENTS, 0.9);
  }
  // Agent: reine Konditions-Sätze → Angebotspfad (nicht bei gemischtem Understanding-Dump)
  // Capture-first: paymentType-Guess allein → kein Offer-Stuck
  const onlyCommercialSlots = facts.length > 0
    && facts.every((f) => (
      f.factClass === SELLER_FACT_CLASS.COMMERCIAL_PREFERENCE
      || f.factClass === SELLER_FACT_CLASS.OFFER_INSTRUCTION
      || f.factClass === SELLER_FACT_CLASS.MESSAGE_INSTRUCTION
      || f.factClass === SELLER_FACT_CLASS.SELLER_NOTE
    ))
    && hasCommercialOfferSlots(facts);
  const commercialFacts = facts.filter((f) => (
    f.factClass === SELLER_FACT_CLASS.COMMERCIAL_PREFERENCE
    || f.factClass === SELLER_FACT_CLASS.OFFER_INSTRUCTION
  ));
  const paymentTypeOnlyCommercial = commercialFacts.length > 0
    && commercialFacts.every((f) => f.field === 'paymentType');
  if (
    (onlyCommercialSlots || isBareMonthlyRateCue(t))
    && !paymentTypeOnlyCommercial
    && !isInboundLead
    && !isCustomerReply
    && !isFindCustomer
    && !isOpenCustomer
    && !isSummarizeCustomer
    && !isHistoryQuery
    && !isContractIntake
  ) {
    add(SELLER_TURN_INTENTS.PREPARE_OFFER, 0.92);
  }
  if (!explicitMessage && (
    facts.some((f) => f.factClass === SELLER_FACT_CLASS.OFFER_INSTRUCTION)
    || /\b(angebot|erstell|mach).{0,40}\b(angebot|ev\s*\d)\b/i.test(t)
    || /\b(ev\s*\d|sportage|sorento|ceed|xceed|niro|picanto)\b.{0,40}\bangebot\b/i.test(t)
  ) && !isFindCustomer && !isOpenCustomer && !isSummarizeCustomer && !isHistoryQuery && !isOfferSentQuery
    && !isMessageOnlyPrice && !isAmbiguousOfferOrMessage) {
    add(SELLER_TURN_INTENTS.PREPARE_OFFER, 0.9);
  }

  // Orchestrierung: Im freien Clever-Modus gewinnt Arbeitsziel vor Message-Template.
  // DRAFT_MESSAGE nur bei explizitem Schreib-Cue (oder Chip „Nachricht“ via Constraint).
  if (
    intents.some((i) => i.type === SELLER_TURN_INTENTS.PREPARE_OFFER)
    && !explicitMessage
  ) {
    const withoutDraft = intents.filter((i) => i.type !== SELLER_TURN_INTENTS.DRAFT_MESSAGE);
    if (withoutDraft.length) {
      intents.length = 0;
      intents.push(...withoutDraft);
    }
  }

  if (!intents.length) add(SELLER_TURN_INTENTS.UNKNOWN, 0.4);
  // Dedup UNKNOWN if real intents exist
  if (intents.length > 1) {
    const filtered = intents.filter((i) => i.type !== SELLER_TURN_INTENTS.UNKNOWN);
    if (filtered.length) {
      intents.length = 0;
      intents.push(...filtered);
    }
  }
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
  const hasOffer = intents.some((i) => i.type === SELLER_TURN_INTENTS.PREPARE_OFFER);
  const hasHistory = intents.some((i) => (
    i.type === SELLER_TURN_INTENTS.SEARCH_CUSTOMER_HISTORY
    || i.type === SELLER_TURN_INTENTS.SEARCH_CUSTOMER_MESSAGES
    || i.type === SELLER_TURN_INTENTS.SEARCH_CUSTOMER_OFFERS
    || i.type === SELLER_TURN_INTENTS.SEARCH_CUSTOMER_ACTIVITIES
  ));
  const hasCustomerNav = intents.some((i) => (
    i.type === SELLER_TURN_INTENTS.FIND_CUSTOMER
    || i.type === SELLER_TURN_INTENTS.OPEN_CUSTOMER
    || i.type === SELLER_TURN_INTENTS.SUMMARIZE_CUSTOMER_CONTEXT
    || i.type === SELLER_TURN_INTENTS.CUSTOMER_LOOKUP
  ));
  const hasNextStep = intents.some((i) => i.type === SELLER_TURN_INTENTS.RECOMMEND_NEXT_STEP);

  // Angebot + „schreibe“ = Arbeitsauftrag mit Nachricht (kein reiner Message-Mode)
  if (explicitMessage && hasOffer) return SELLER_INPUT_MODE.CLEVER_WORK_INPUT;
  // Explizite Kundennachricht hat Vorrang vor schwachem FIND_CUSTOMER („Schreib …“)
  if (hasHistory || hasNextStep || (hasCustomerNav && !explicitMessage)) {
    return SELLER_INPUT_MODE.CLEVER_WORK_INPUT;
  }
  if (explicitMessage) return SELLER_INPUT_MODE.CUSTOMER_MESSAGE;

  const workHeavy = intents.some((i) => [
    SELLER_TURN_INTENTS.UPDATE_CUSTOMER_CONTEXT,
    SELLER_TURN_INTENTS.PREPARE_TRADE_IN,
    SELLER_TURN_INTENTS.PREPARE_OFFER,
    SELLER_TURN_INTENTS.SEND_PORTFOLIO,
    SELLER_TURN_INTENTS.REQUEST_DOCUMENTS,
    SELLER_TURN_INTENTS.LOOKUP_VEHICLE_FACT,
    SELLER_TURN_INTENTS.SEARCH_CUSTOMER_HISTORY,
    SELLER_TURN_INTENTS.FIND_CUSTOMER,
    SELLER_TURN_INTENTS.OPEN_CUSTOMER,
    SELLER_TURN_INTENTS.SUMMARIZE_CUSTOMER_CONTEXT,
    SELLER_TURN_INTENTS.RECOMMEND_NEXT_STEP,
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
 * @param {{
 *   attachments?: object[],
 *   lead?: object,
 *   customerName?: string,
 *   currentOfferContext?: object|null,
 *   workingContext?: object|null,
 * }} [options]
 */
export function interpretSellerInput(sellerInput = '', options = {}) {
  const raw = String(sellerInput ?? '');
  const normalized = raw.replace(/\r\n/g, '\n').trim();
  let facts = extractUniversalSellerFacts(normalized, {
    lead: options.lead,
    currentOfferContext: options.currentOfferContext,
    workingContext: options.workingContext,
    now: options.now ?? null,
  });

  if (shouldEnrichSellerInputFromOfferPdf(options.attachments, normalized)) {
    facts = mergeOfferPdfFactsIntoSellerFacts(
      facts,
      extractSellerFactsFromOfferPdfText(normalized),
    );
  }

  // Offer-PDF: Gültigkeitsdatum / „Beratung“ / „kommen“ ≠ Terminvorschlag
  if (
    isOfferPdfDropContext(options.attachments, normalized)
    && !hasExplicitAppointmentSellerCue(normalized)
  ) {
    facts = facts.filter((f) => f.factClass !== SELLER_FACT_CLASS.APPOINTMENT_FACT);
  }

  let inboundContact = null;
  // Offer-PDF: Institutionskontakte nicht als Inbound-Kundenfacts extrahieren
  if (
    !isOfferPdfDropContext(options.attachments, normalized)
    && (isCustomerReplyPaste(normalized) || isInboundLeadPaste(normalized))
  ) {
    inboundContact = extractInboundContact(normalized);
    const contactFacts = buildInboundContactFacts(inboundContact);
    for (const fact of contactFacts) {
      const key = `${fact.field}:${String(fact.label).toLowerCase()}`;
      if (!facts.some((f) => `${f.field}:${String(f.label).toLowerCase()}` === key)) {
        facts.push(fact);
      }
    }
    // Voller Inbound-Name schlägt Einzelwort „Marcel“ aus extractNamedCustomerFromInput
    if (inboundContact?.fullName || inboundContact?.lastName) {
      const full = String(
        inboundContact.fullName
        || [inboundContact.firstName, inboundContact.lastName].filter(Boolean).join(' '),
      ).trim();
      facts = facts.filter((f) => {
        if (f.field !== 'customerName') return true;
        const label = String(f.label || f.value || '').trim();
        if (!label) return false;
        if (!/\s/.test(label) && full.toLowerCase().includes(label.toLowerCase())) {
          return false;
        }
        return true;
      });
      if (full && !facts.some((f) => f.field === 'customerName')) {
        facts.push(createExtractedFact({
          factClass: SELLER_FACT_CLASS.CUSTOMER_FACT,
          field: 'customerName',
          value: full,
          label: full,
          source: SELLER_FACT_SOURCE.CUSTOMER_MESSAGE,
          confidence: 0.9,
          needsConfirmation: true,
        }));
      }
    }
  }

  const intents = detectSellerTurnIntents(normalized, facts, { attachments: options.attachments });
  const inputMode = resolveSellerInputMode(normalized, intents, facts);
  const attachmentTypes = (options.attachments ?? [])
    .map((a) => a?.mimeType || a?.type || a?.kind)
    .filter(Boolean);
  const homepageInquiryRaw = parseHomepageCommercialInquiry(normalized);
  const paymentPreferenceSwitch = (
    /\bfinanzierung\b.{0,80}\b(?:lieber|statt).{0,40}\bleasing\b/i.test(normalized)
    || /\bleasing\b.{0,80}\b(?:lieber|statt).{0,40}\bfinanzierung\b/i.test(normalized)
    || (
      /\blieber.{0,40}\bfinanzierung\b/i.test(normalized)
      && /\bleasing\b/i.test(normalized)
    )
    || (
      /\blieber.{0,40}\bleasing\b/i.test(normalized)
      && /\bfinanzierung\b/i.test(normalized)
    )
  );
  const homepageInquiry = (
    homepageInquiryRaw?.hasDualScenarios
    && !paymentPreferenceSwitch
  ) ? homepageInquiryRaw : null;

  const zeroLoss = ensureZeroLossCoverage({
    sellerInput: normalized,
    facts,
    customerName: options.customerName
      || options.lead?.contact?.name
      || options.lead?.name
      || null,
  });

  return {
    raw,
    normalized,
    facts: zeroLoss.facts,
    intents,
    inputMode,
    attachmentTypes,
    homepageInquiry,
    inboundContact,
    zeroLossIntake: {
      unresolvedNotes: zeroLoss.unresolvedNotes,
      unconsumedInputSpans: zeroLoss.unconsumedInputSpans,
      groups: zeroLoss.groups,
      summary: zeroLoss.summary,
      consumedFactCount: zeroLoss.consumedFactCount,
    },
    confidence: zeroLoss.facts.length
      ? Math.min(0.99, zeroLoss.facts.reduce((s, f) => s + (f.confidence || 0), 0) / zeroLoss.facts.length)
      : (intents[0]?.confidence ?? 0.4),
  };
}
