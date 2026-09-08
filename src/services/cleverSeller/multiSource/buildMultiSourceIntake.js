/**
 * Multi-Source Intake: Seller-Dump + Attachments → ein gemeinsamer Arbeitsplan.
 * Erweiterbar für weitere Vertragsarten über contractKindRegistry.
 */
import { SELLER_FACT_CLASS, SELLER_FACT_SOURCE, SELLER_TURN_INTENTS } from '../sellerFactTypes.js';
import { createExtractedFact } from '../cleverSellerTurnResultSchema.js';
import {
  extractCustomerContractFromText,
  classifyContractDocument,
} from '../extractCustomerContractFromText.js';
import { enrichContractDraftByKind } from './contractKindRegistry.js';
import { resolveContractTemporalStatus } from './resolveContractTemporalStatus.js';
import { extractTradeInCandidates, hasTradeInCue } from '../detectTradeInFromSellerInput.js';
import { resolveContractIntakeText } from '../resolveContractIntakeText.js';
import { isInboundLeadPaste } from '../inboundLeadIntake.js';
import { isCustomerReplyPaste } from '../customerReplyIntake.js';
import { isCustomerContractIntakeText } from '../extractCustomerContractFromText.js';
import {
  isCustomerNameStopToken,
  isPlausibleCustomerName,
  sanitizeCustomerNameCandidate,
} from '../resolveAssistantContext.js';

const SENSITIVE_FIELD_BLOCKLIST = new Set([
  'iban', 'accountNumber', 'idNumber', 'ausweisnummer', 'income', 'employer',
  'street', 'address', 'signature', 'gehalt', 'arbeitgeber',
]);

/**
 * Erkennt, ob Text+Attachments einen Multi-Source-Beratungsfall bilden.
 * Eng: Abgleich-Cue oder (Wunsch + GW + Vertrags-Attachment).
 * Kein Diebstahl von Inbound-/Reply-/reinem Contract-Import.
 * @param {{ sellerInput?: string, attachments?: object[], facts?: object[] }} params
 */
export function shouldBuildMultiSourceIntake(params = {}) {
  const text = String(params.sellerInput || '').trim();
  if (!text) return false;
  if (isCustomerReplyPaste(text)) return false;
  // Reine Kundenanfrage-Mails bleiben Intake – außer expliziter Abgleich
  if (isInboundLeadPaste(text) && !/\babgleich\b/i.test(text)) return false;

  const attachments = Array.isArray(params.attachments) ? params.attachments : [];
  const hasContractAtt = attachments.some((a) => (
    a?.kind === 'contract_pdf'
    || a?.sourceType === 'contract_pdf'
    || a?.sourceType === 'contract_pdf_ocr'
    || /vertrag|contract|finanz|leasing|bank/i.test(a?.fileName || '')
  ));

  const hasTrade = hasTradeInCue(text) || extractTradeInCandidates(text).length > 0;
  const hasWish = /\b(?:ev\s*\d|sportage|xceed|ceed|niro|sorento|ahk|\bair\b|vision|gt[-\s]?line)\b/i.test(text)
    || (params.facts || []).some((f) => f.factClass === 'vehicle_interest');

  const explicitAbgleich = /\babgleich\b|\baltvertrag\b|\bvertrag\s*\+\s*dump\b|\bmulti[-\s]?source\b/i.test(text);

  // Reiner Vertrags-Paste ohne Wunsch/GW → Contract-Import belassen
  if (!explicitAbgleich && !hasTrade && isCustomerContractIntakeText(text) && !hasContractAtt) {
    return false;
  }
  if (!explicitAbgleich && hasContractAtt && !hasWish && !hasTrade) {
    return false;
  }

  if (explicitAbgleich && (hasWish || hasTrade || hasContractAtt)) return true;
  // Klassischer Händler-Wurf: Wunsch + GW + Vertrags-PDF
  if (hasWish && hasTrade && hasContractAtt) return true;
  // Wunsch + GW + Abgleich-Stichworte auch ohne PDF (PDF folgt / OCR)
  if (explicitAbgleich && hasWish && hasTrade) return true;

  return false;
}

/**
 * @param {{
 *   sellerInput?: string,
 *   attachments?: object[],
 *   facts?: object[],
 *   lead?: object,
 *   now?: Date|number,
 * }} params
 */
export function buildMultiSourceIntake(params = {}) {
  const sellerInput = String(params.sellerInput || '');
  const attachments = Array.isArray(params.attachments) ? params.attachments : [];
  const facts = Array.isArray(params.facts) ? params.facts : [];
  const now = params.now || Date.now();
  const observedAt = new Date(now instanceof Date ? now : now).toISOString().slice(0, 10);

  const contractResolved = resolveContractIntakeText({
    sellerInput,
    attachments,
  });
  const contractText = contractResolved?.text || '';
  const rawExtract = contractText
    ? extractCustomerContractFromText(contractText, {
      sourceType: contractResolved?.sourceType || 'contract_pdf',
      sourceId: contractResolved?.sourceId || attachments[0]?.id || null,
    })
    : null;

  const documentKind = contractText
    ? classifyContractDocument(contractText)
    : null;
  const enriched = rawExtract?.ok
    ? enrichContractDraftByKind({
      ...rawExtract,
      documentClassification: documentKind,
      fields: rawExtract.fields || {},
      evidence: rawExtract.evidence || [],
    }, contractText)
    : null;

  const fields = sanitizeContractFields(enriched?.fields || {});
  const temporal = resolveContractTemporalStatus(fields.contractEndDate, now);

  const tradeIns = extractTradeInCandidates(sellerInput);
  if (!tradeIns.length && fields.vehicleMake && fields.vehicleModel) {
    // Vertrag + Dump ohne explizites GW: Fahrzeug aus Vertrag als Trade-in-Kandidat vorschlagen
    if (/\bgw\b|\bpicanto\b|\binzahlung|\babgleich\b/i.test(sellerInput) || temporal.status.startsWith('historical')) {
      tradeIns.push({
        make: fields.vehicleMake,
        model: fields.vehicleModel,
        label: `${fields.vehicleMake} ${fields.vehicleModel}`,
        cue: 'contract_vehicle',
        span: null,
        ambiguous: !/\bgw\b|inzahlung/i.test(sellerInput),
      });
    }
  }

  const nameFact = facts.find((f) => f.field === 'customerName');
  const resolvedCustomerCandidate = buildCustomerCandidate({
    sellerInput,
    nameFact,
    contractName: fields.customerNameHint || null,
    facts,
  });

  const currentVehicleInterest = buildVehicleInterest(facts, sellerInput);
  const commercialScenario = buildCommercialScenario(facts);
  const currentHouseholdFacts = buildHouseholdFacts(facts, observedAt);
  const historicalHousehold = extractHistoricalHousehold(contractText, fields, enriched?.evidence);

  const conflicts = [];
  if (
    historicalHousehold?.childrenCount != null
    && currentHouseholdFacts?.childrenCount != null
    && Number(historicalHousehold.childrenCount) !== Number(currentHouseholdFacts.childrenCount)
  ) {
    conflicts.push({
      id: 'children_count_temporal',
      field: 'childrenCount',
      label: `Im Altvertrag von ${historicalHousehold.observedAt || 'früher'} war ${historicalHousehold.childrenCount} Kind angegeben. Aktuell haben Sie ${currentHouseholdFacts.childrenCount} Kinder genannt.`,
      historical: historicalHousehold,
      current: currentHouseholdFacts,
      suggestedAction: 'prefer_current',
    });
  }

  const missingInformation = [];
  if (resolvedCustomerCandidate && !resolvedCustomerCandidate.email) {
    missingInformation.push({
      id: 'customer_email',
      field: 'email',
      label: 'E-Mail für Kundenakte / Nachrichten',
      forIntent: SELLER_TURN_INTENTS.INBOUND_LEAD,
    });
  }
  if (resolvedCustomerCandidate && !resolvedCustomerCandidate.phone) {
    missingInformation.push({
      id: 'customer_phone',
      field: 'phone',
      label: 'Telefonnummer für Kundenakte / Rückruf',
      forIntent: SELLER_TURN_INTENTS.INBOUND_LEAD,
    });
  }
  if (tradeIns[0]) {
    missingInformation.push({
      id: 'trade_in_mileage',
      field: 'tradeInMileage',
      label: 'Aktueller Kilometerstand Picanto / Inzahlungnahme',
      forIntent: SELLER_TURN_INTENTS.PREPARE_TRADE_IN,
    });
    if (temporal.status === 'historical_or_ended' || temporal.status === 'status_needs_confirmation') {
      missingInformation.push({
        id: 'trade_in_status',
        field: 'tradeInStatus',
        label: 'Ist das Fahrzeug noch beim Kunden oder bereits zurückgegeben/übernommen?',
        forIntent: SELLER_TURN_INTENTS.PREPARE_TRADE_IN,
      });
    }
  }

  const historicalContract = enriched?.fields
    ? {
      contractType: fields.contractSubtype || fields.contractType || null,
      contractTypeLabel: fields.contractTypeLabel
        || (fields.contractSubtype === 'three_way_financing' ? '3-Wege-Finanzierung' : null)
        || null,
      vehicle: [fields.vehicleMake, fields.vehicleModel].filter(Boolean).join(' ') || null,
      monthlyRate: fields.monthlyRate ?? null,
      finalPayment: fields.finalPayment ?? null,
      contractEndDate: fields.contractEndDate ?? null,
      contractStartDate: fields.contractStartDate ?? null,
      totalMileage: fields.totalMileage ?? fields.annualMileage ?? null,
      annualMileage: fields.annualMileage ?? null,
      excessMileageRate: fields.excessMileageRate ?? null,
      underMileageRate: fields.underMileageRate ?? null,
      status: temporal.status,
      statusLabel: temporal.label,
      contractKindId: enriched.contractKindId || null,
      contractKindLabel: enriched.contractKindLabel || null,
      source: ['contract_pdf'],
      evidence: (enriched.evidence || []).filter((e) => !SENSITIVE_FIELD_BLOCKLIST.has(e.field)),
    }
    : null;

  const preparedActions = [
    resolvedCustomerCandidate ? {
      id: 'create_customer_candidate',
      type: 'create_customer_candidate',
      label: 'Kundenakte vorbereiten',
      persistOnAccept: true,
      mutatesCustomer: false,
    } : null,
    historicalContract ? {
      id: 'import_historical_contract',
      type: SELLER_TURN_INTENTS.IMPORT_CUSTOMER_CONTRACT,
      label: 'Altvertrag übernehmen',
      persistOnAccept: true,
      mutatesCustomer: false,
    } : null,
    tradeIns[0] ? {
      id: 'create_trade_in_candidate',
      type: SELLER_TURN_INTENTS.PREPARE_TRADE_IN,
      label: formatTradeInCaptureLabel(tradeIns[0]),
      persistOnAccept: true,
      mutatesCustomer: false,
    } : null,
    (currentHouseholdFacts || currentVehicleInterest) ? {
      id: 'update_current_customer_facts',
      type: SELLER_TURN_INTENTS.UPDATE_CUSTOMER_CONTEXT,
      label: 'Aktuelle Angaben übernehmen',
      persistOnAccept: true,
      mutatesCustomer: false,
    } : null,
    currentVehicleInterest ? {
      id: 'create_vehicle_interest',
      type: SELLER_TURN_INTENTS.RESOLVE_VEHICLE,
      label: 'Fahrzeugwunsch übernehmen',
      persistOnAccept: true,
      mutatesCustomer: false,
    } : null,
    commercialScenario ? {
      id: 'create_commercial_scenario',
      type: SELLER_TURN_INTENTS.UPDATE_CUSTOMER_CONTEXT,
      label: 'Konditionen übernehmen',
      persistOnAccept: true,
      mutatesCustomer: false,
    } : null,
    currentVehicleInterest ? {
      id: 'prepare_new_offer',
      type: SELLER_TURN_INTENTS.PREPARE_OFFER,
      label: 'Neues Angebot vorbereiten',
      persistOnAccept: false,
      mutatesCustomer: false,
    } : null,
  ].filter(Boolean);

  return {
    detected: true,
    reviewType: 'customer_contract_tradein_intake_review',
    resolvedCustomerCandidate,
    currentVehicleInterest,
    commercialScenario,
    currentHouseholdFacts,
    tradeInCandidate: tradeIns[0] || null,
    tradeInCandidates: tradeIns,
    historicalContract,
    historicalHousehold,
    conflicts,
    missingInformation,
    preparedActions,
    contractDraft: enriched ? {
      ...enriched,
      fields,
      temporalStatus: temporal,
      mutatesCustomer: false,
      persistOnAccept: true,
    } : null,
    sources: {
      sellerInput: Boolean(sellerInput.trim()),
      contractPdf: Boolean(contractText),
      attachmentIds: attachments.map((a) => a.id || a.fileName).filter(Boolean),
    },
    observedAt,
  };
}

function sanitizeContractFields(fields = {}) {
  const out = { ...fields };
  for (const key of SENSITIVE_FIELD_BLOCKLIST) {
    delete out[key];
  }
  return out;
}

function buildCustomerCandidate({ sellerInput, nameFact, contractName, facts }) {
  let fullName = nameFact?.value || nameFact?.label || null;
  if (!fullName) {
    fullName = extractPersonNameFromDump(sellerInput);
  }
  if (!fullName && contractName) fullName = contractName;
  if (!fullName) return null;

  fullName = normalizeDumpPersonName(String(fullName).trim());
  if (!fullName) return null;

  const parts = fullName.split(/\s+/);
  const sources = [];
  if (nameFact || extractPersonNameFromDump(sellerInput)) sources.push('seller_input');
  if (contractName) sources.push('contract_pdf');

  const email = facts.find((f) => f.field === 'email')?.value || null;
  const phone = facts.find((f) => f.field === 'phone')?.value || null;

  return {
    fullName,
    firstName: parts.length >= 2 ? parts[0] : null,
    lastName: parts.length >= 2 ? parts.slice(1).join(' ') : parts[0],
    email,
    phone,
    source: sources,
    missingContact: !email && !phone,
  };
}

/**
 * „Mazzei Sandro“ / „Sandro Mazzei“ – Name-Zeile ohne Fahrzeug-Tokens.
 * Funktioniert zeilenweise und als Inline-Fallback (auch ohne Newlines).
 */
export function extractPersonNameFromDump(text = '') {
  const raw = String(text || '').replace(/\r\n/g, '\n');
  const lines = raw.split('\n').map((l) => l.trim()).filter(Boolean);
  for (const line of lines) {
    if (/^(?:test|abgleich|gw|name)\b/i.test(line)) continue;
    if (/\bangebote?\s+für\b/i.test(line)) continue;
    if (/\b(?:ev\s*\d|ahk|km|kinder|haus|(?:privat)?leasing|finanz|weiß|weiss|schwarz|wunsch\s*konditionen|überführung|einmalkosten|förderung|foerderung)\b/i.test(line)
      && !/^familie\b/i.test(line)
      && !/^(?:herr|frau)\b/i.test(line)
      && !/\bhei(?:ss|ß)t\b/i.test(line)) {
      continue;
    }
    if (/\d/.test(line) && !/^familie\b/i.test(line)) continue;

    const familyLine = line.match(/^familie\s+([A-Za-zÄÖÜäöüß-]{2,40})\b/i);
    if (familyLine) {
      const cleaned = sanitizeCustomerNameCandidate(`Familie ${familyLine[1]}`);
      if (cleaned) return cleaned;
    }

    if (/^[A-ZÄÖÜ][a-zäöüß'-]+(?:\s+[A-ZÄÖÜ][a-zäöüß'-]+){1,2}$/.test(line)) {
      const cleaned = sanitizeCustomerNameCandidate(line.split(/\s+/).join(' '));
      if (cleaned) return cleaned;
    }
  }
  // Inline „Mazzei Sandro EV4“ / einzeiliger Dump – nie „Angebote für EV2“ / „Privatleasing … EV4“
  const inline = raw.match(
    /\b([A-ZÄÖÜ][a-zäöüß'-]+)\s+([A-ZÄÖÜ][a-zäöüß'-]+)\s+(?:EV\s*\d|Kia|Sportage|Picanto|XCeed|Ceed|Niro)/,
  );
  if (
    inline
    && !isCustomerNameStopToken(inline[1])
    && !isCustomerNameStopToken(inline[2])
    && !/\b(?:privat)?leasing\b/i.test(`${inline[1]} ${inline[2]}`)
  ) {
    const cleaned = sanitizeCustomerNameCandidate(`${inline[1]} ${inline[2]}`);
    if (cleaned) return cleaned;
  }

  // Letzter Versuch: Name vor GW-/Wunsch-Cue im Fließtext (kein /i – Großschreibung = Name)
  const beforeCue = raw.match(
    /\b([A-ZÄÖÜ][a-zäöüß'-]+)\s+([A-ZÄÖÜ][a-zäöüß'-]+)\s+(?=(?:GW\b|Inzahlung|EV\s*\d))/,
  );
  if (
    beforeCue
    && !isCustomerNameStopToken(beforeCue[1])
    && !isCustomerNameStopToken(beforeCue[2])
    && !/\b(?:privat)?leasing\b/i.test(`${beforeCue[1]} ${beforeCue[2]}`)
  ) {
    const cleaned = sanitizeCustomerNameCandidate(`${beforeCue[1]} ${beforeCue[2]}`);
    if (cleaned) return cleaned;
  }

  // „Familie Müller, …“ irgendwo im Dump
  const familyAnywhere = raw.match(/\bfamilie\s+([A-Za-zÄÖÜäöüß-]{2,40})\b/i);
  if (familyAnywhere) {
    const cleaned = sanitizeCustomerNameCandidate(`Familie ${familyAnywhere[1]}`);
    if (cleaned) return cleaned;
  }

  // „Kunde heißt X“
  const heisst = raw.match(
    /\b(?:kunde\s+)?(?:hei(?:ss|ß)t|namens)\s+(?:der\s+|die\s+)?((?:familie\s+|herrn?\s+|frau\s+)?[A-Za-zÄÖÜäöüß-]{2,40}(?:\s+[A-Za-zÄÖÜäöüß-]{2,40})?)\b/i,
  );
  if (heisst?.[1]) {
    const cleaned = sanitizeCustomerNameCandidate(heisst[1]);
    if (cleaned) return cleaned;
  }

  return null;
}

/**
 * Label für Secondary-CTA: „GW Kia Picanto erfassen“.
 * @param {{ label?: string, make?: string, model?: string }|null|undefined} trade
 */
export function formatTradeInCaptureLabel(trade) {
  if (!trade) return 'GW erfassen';
  const base = String(trade.label || [trade.make, trade.model].filter(Boolean).join(' '))
    .trim()
    .replace(/^(?:inzahlungnahme:\s*)/i, '');
  if (!base) return 'GW erfassen';
  const withGw = /^gw\b/i.test(base) ? base : `GW ${base}`;
  return /erfassen$/i.test(withGw) ? withGw : `${withGw} erfassen`;
}

function buildVehicleInterest(facts, sellerInput) {
  const interest = facts.find((f) => f.field === 'vehicleInterest' || f.field === 'vehicleInterestMulti');
  const color = facts.find((f) => f.field === 'colorPreference');
  const ahk = facts.find((f) => f.field === 'towHitchRequired');
  if (!interest && !/\bev\s*\d/i.test(sellerInput)) return null;

  const label = interest?.label || '';
  const ev = label.match(/\bEV\s*(\d)\s*(\w+)?/i)
    || String(sellerInput).match(/\bEV\s*(\d)\s*(\w+)?/i);
  // „weiß“: kein \b nach ß (JS \w kennt ß nicht) – Text-Fallback
  const colorFromText = String(sellerInput).match(
    /(?:^|[\s,;])(schwarz\w*|weiss\w*|weiß\w*|terracotta|blau\w*|grau\w*|silber\w*|rot\w*|gr[uü]n\w*)(?=$|[\s,;.])/i,
  );
  let colorValue = color?.value || null;
  if (!colorValue && colorFromText?.[1]) {
    const lower = colorFromText[1].toLowerCase();
    colorValue = lower.startsWith('weiß') || lower.startsWith('weiss') ? 'weiß' : lower;
  }
  return {
    make: 'Kia',
    model: ev ? `EV${ev[1]}` : (interest?.value?.model || label),
    trim: ev?.[2] || interest?.value?.trim || null,
    color: colorValue,
    requestedEquipment: ahk || /\bahk\b/i.test(sellerInput) ? ['AHK'] : [],
    label: [ev ? `Kia EV${ev[1]}` : label, ev?.[2], colorValue, (ahk || /\bahk\b/i.test(sellerInput)) ? 'AHK' : null]
      .filter(Boolean)
      .join(' · '),
    source: 'seller_input',
  };
}

function buildCommercialScenario(facts) {
  const term = facts.find((f) => f.field === 'termMonths');
  const mileage = facts.find((f) => f.field === 'annualMileage');
  const payment = facts.find((f) => f.field === 'paymentType');
  if (!term && !mileage) return null;
  return {
    type: payment?.value === 'cash' ? 'cash' : (payment?.value || 'leasing'),
    termMonths: term?.value ?? null,
    annualMileage: mileage?.value ?? null,
    source: 'seller_input',
    label: [
      term ? `${term.value} Monate` : null,
      mileage ? `${Number(mileage.value).toLocaleString('de-DE')} km/Jahr` : null,
    ].filter(Boolean).join(' · '),
  };
}

function buildHouseholdFacts(facts, observedAt) {
  const children = facts.find((f) => f.field === 'childrenCount');
  const housing = facts.find((f) => f.field === 'housingType');
  if (!children && !housing) return null;
  return {
    childrenCount: children?.value ?? null,
    housingType: housing?.value ?? null,
    source: 'seller_input',
    observedAt,
    label: [
      children ? `${children.value} Kinder` : null,
      housing?.label || (housing?.value === 'own_house' ? 'Eigenes Haus' : null),
    ].filter(Boolean).join(' · '),
  };
}

function extractHistoricalHousehold(contractText, fields, evidence) {
  const t = String(contractText || '');
  // Nur belegte Angaben – typische Vertragsformulare
  const childM = t.match(/\b(?:anzahl\s+)?(?:kind(?:er)?|kinderanzahl)\s*[:=\s]*(\d)\b/i)
    || t.match(/\b(\d)\s*kind(?:er)?\b/i);
  if (!childM && !fields.childrenCount) return null;
  const count = fields.childrenCount ?? Number(childM[1]);
  const dateEv = (evidence || []).find((e) => e.field === 'contractStartDate');
  return {
    childrenCount: count,
    observedAt: fields.contractStartDate || dateEv?.value || null,
    source: 'contract_pdf',
  };
}

/**
 * Fact-Ergänzungen aus Multi-Source (Trade-in, Housing, Name, termMonths).
 * @param {object[]} facts
 * @param {string} sellerInput
 */
export function enrichFactsForMultiSource(facts = [], sellerInput = '') {
  const list = [...facts];
  const push = (fact) => {
    if (list.some((f) => f.field === fact.field && f.label === fact.label)) return;
    list.push(fact);
  };

  if (!list.some((f) => f.field === 'customerName')) {
    const name = extractPersonNameFromDump(sellerInput);
    if (name && isPlausibleCustomerName(name)) {
      // „Mazzei Sandro“ → Vorname Sandro Nachname Mazzei wenn italienisch/nachname-first üblich
      const normalized = normalizeDumpPersonName(name);
      if (isPlausibleCustomerName(normalized)) {
        push(createExtractedFact({
          factClass: SELLER_FACT_CLASS.CUSTOMER_FACT,
          field: 'customerName',
          value: normalized,
          label: normalized,
          source: SELLER_FACT_SOURCE.SELLER_INPUT,
          confidence: 0.92,
          needsConfirmation: false,
        }));
      }
    }
  }

  if (/\bhaus\b/i.test(sellerInput) && !/\bhaushalt\b/i.test(sellerInput)) {
    push(createExtractedFact({
      factClass: SELLER_FACT_CLASS.CUSTOMER_FACT,
      field: 'housingType',
      value: 'own_house',
      label: 'Eigenes Haus',
      source: SELLER_FACT_SOURCE.SELLER_INPUT,
      confidence: 0.8,
      needsConfirmation: true,
    }));
  }

  for (const ti of extractTradeInCandidates(sellerInput)) {
    if (list.some((f) => f.field === 'tradeInVehicle' || f.field === 'existingVehicle')) {
      continue;
    }
    push(createExtractedFact({
      factClass: SELLER_FACT_CLASS.TRADE_IN_FACT,
      field: 'tradeInVehicle',
      value: {
        make: ti.make,
        model: ti.model,
        year: ti.year ?? null,
        mileageKm: ti.mileageKm ?? null,
        mileageApproximate: Boolean(ti.mileageApproximate),
      },
      label: `Inzahlungnahme: ${ti.label}`,
      source: SELLER_FACT_SOURCE.SELLER_INPUT,
      confidence: ti.ambiguous ? 0.7 : 0.94,
      needsConfirmation: ti.ambiguous,
    }));
  }

  return list;
}

export function normalizeDumpPersonName(name = '') {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '';
  if (parts.length !== 2) return parts.join(' ');
  // Heuristik Nachname Vorname: zweites Token typischer Vorname
  const [a, b] = parts;
  const firstNameLike = /^(?:Sandro|Marco|Luca|Giulia|Anna|Lisa|Thomas|Michael|Andreas|Stefan|Peter|Klaus|Hans|Maria|Julia|Nina|Paul|Max|Tim|Jan|Alexander|Sebastian|Christian|Daniel|Markus|Oliver|Martin|Tobias|Matthias|Johannes|Felix|Lukas|Jonas|Simon|David|Patrick|Robert|Frank|Jürgen|Juergen|Wolfgang|Dieter|Uwe|Ralf|Sven|Nils|Erik|Kevin|Dennis|Marcel|Philipp|Benjamin|Florian|Christina|Sandra|Sabine|Petra|Monika|Andrea|Stefanie|Katharina|Laura|Sarah|Jessica|Melanie|Nicole|Claudia|Birgit|Heike|Susanne|Martina|Anja|Katrin|Elena|Sofia|Chiara|Giovanni|Antonio|Giuseppe|Francesco|Alessandro|Roberto|Paolo)$/i;
  if (firstNameLike.test(b) && !firstNameLike.test(a)) return `${b} ${a}`;
  if (firstNameLike.test(a)) return `${a} ${b}`;
  return `${a} ${b}`;
}
