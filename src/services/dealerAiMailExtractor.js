/**
 * Mail-spezifische Extraktion – echte Kundenmails & Weiterleitungen (Outlook/Gmail/Apple)
 */
import {
  parseBatteryKwhFromText,
  batteryLabelFromKwh,
  parseCustomerEmail,
  parseCustomerPhone,
} from './dealerAiParser.js';

const MONTH_NAMES = [
  'januar', 'februar', 'märz', 'maerz', 'april', 'mai', 'juni',
  'juli', 'august', 'september', 'oktober', 'november', 'dezember',
];

const MONTH_LABELS = {
  januar: 'Januar',
  februar: 'Februar',
  märz: 'März',
  maerz: 'März',
  april: 'April',
  mai: 'Mai',
  juni: 'Juni',
  juli: 'Juli',
  august: 'August',
  september: 'September',
  oktober: 'Oktober',
  november: 'November',
  dezember: 'Dezember',
};

const FORWARD_START_PATTERNS = [
  /^-{2,}\s*Ursprüngliche Nachricht\s*-{2,}\s*$/i,
  /^-{2,}\s*Original Message\s*-{2,}\s*$/i,
  /^Weitergeleitete Nachricht\s*$/i,
  /^Begin forwarded message:\s*$/i,
  /^-{2,}\s*Forwarded message\s*-{2,}\s*$/i,
  /^Anfang der weitergeleiteten Nachricht:\s*$/i,
];

const THREAD_CUT_PATTERNS = [
  /^-{2,}\s*Ursprüngliche Nachricht/i,
  /^-{2,}\s*Original Message/i,
  /^Am .+ schrieb .+:\s*$/i,
  /^On .+ wrote:\s*$/i,
  /^Weitergeleitete Nachricht/i,
  /^Begin forwarded message:/i,
  /^-{2,}\s*Forwarded message/i,
  /^Anfang der weitergeleiteten Nachricht:/i,
];

const SIGNATURE_START_PATTERNS = [
  /^Mit freundlichen Grüßen/i,
  /^Mit freundlichen Gruessen/i,
  /^Freundliche Grüße/i,
  /^Freundliche Gruesse/i,
  /^Viele Grüße/i,
  /^Beste Grüße/i,
  /^Herzliche Grüße/i,
  /^Vielen Dank und (?:freundliche|herzliche) Grüße/i,
  /^LG,?\s*$/i,
  /^MfG,?\s*$/i,
];

const SIGNATURE_BOILERPLATE_PATTERNS = [
  /Impressum/i,
  /Geschäftsführer/i,
  /Amtsgericht/i,
  /USt-IdNr/i,
  /Umsatzsteuer/i,
  /Datenschutz/i,
  /Diese E-Mail enthält vertrauliche/i,
  /Sent from my iPhone/i,
  /Sent from my iPad/i,
  /Von meinem iPhone gesendet/i,
  /www\.[a-z0-9.-]+\.[a-z]{2,}/i,
];

const DEALER_EMAIL_HINTS = [
  'autohaus', 'kia.de', 'clever-neuwagen', 'trinkle', 'vertrieb@',
  'sales@', 'info@', 'leasing@', 'anfrage@', 'kontakt@',
];

function monthPattern() {
  return MONTH_NAMES.join('|');
}

function capitalizeMonth(raw) {
  const key = raw.toLowerCase().replace('maerz', 'märz');
  return MONTH_LABELS[key] ?? raw.charAt(0).toUpperCase() + raw.slice(1);
}

function linesOf(text) {
  return String(text ?? '').split(/\r?\n/).map((l) => l.replace(/\s+$/, ''));
}

/** HTML-Artefakte und Outlook-Müll bereinigen */
export function cleanMailHtmlArtifacts(raw) {
  let text = String(raw ?? '');
  text = text
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<\/tr>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\t/g, ' ')
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/ {2,}/g, ' ');
  return text.trim();
}

export function isLikelyDealerEmail(email) {
  if (!email) return false;
  const lower = email.toLowerCase();
  return DEALER_EMAIL_HINTS.some((hint) => lower.includes(hint));
}

export function extractMailSubject(text) {
  const lines = linesOf(text);
  for (const line of lines.slice(0, 12)) {
    const m = line.match(/^(?:Betreff|Subject)\s*:\s*(.+)$/i);
    if (m?.[1]) return m[1].trim();
  }
  const inline = text.match(/^(?:Betreff|Subject)\s*:\s*(.+)$/im);
  return inline?.[1]?.trim() ?? null;
}

function parseFromHeaderLine(line) {
  const m = line.match(/^(?:Von|From)\s*:\s*(.+)$/i);
  if (!m) return null;
  const rest = m[1].trim();
  const emailMatch = rest.match(/<([^>]+@[^>]+)>/)
    ?? rest.match(/\b([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})\b/);
  const email = emailMatch?.[1]?.toLowerCase() ?? null;
  let name = rest
    .replace(/<[^>]+>/g, '')
    .replace(/\b[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}\b/g, '')
    .replace(/["']/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (name.includes(',')) {
    name = name.split(',')[0].trim();
  }
  return { name: name || null, email };
}

function findForwardStartIndex(lines) {
  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    if (FORWARD_START_PATTERNS.some((re) => re.test(trimmed))) return i;
  }
  return -1;
}

/** Outlook / Gmail / Apple Weiterleitungskopf parsen */
export function parseForwardBlock(text) {
  const lines = linesOf(text);
  const startIdx = findForwardStartIndex(lines);
  if (startIdx < 0) return null;

  const forward = {
    startIdx,
    fromName: null,
    fromEmail: null,
    sent: null,
    to: null,
    subject: null,
    bodyStartIdx: startIdx + 1,
  };

  let i = startIdx + 1;
  let sawHeader = false;

  while (i < lines.length && i < startIdx + 12) {
    const line = lines[i].trim();
    if (!line) {
      if (sawHeader) {
        forward.bodyStartIdx = i + 1;
        break;
      }
      i += 1;
      continue;
    }

    if (/^(Von|From)\s*:/i.test(line)) {
      const from = parseFromHeaderLine(line);
      forward.fromName = from?.name ?? null;
      forward.fromEmail = from?.email ?? null;
      sawHeader = true;
      i += 1;
      continue;
    }
    if (/^(Gesendet|Sent|Datum|Date)\s*:/i.test(line)) {
      forward.sent = line.replace(/^(?:Gesendet|Sent|Datum|Date)\s*:\s*/i, '').trim();
      sawHeader = true;
      i += 1;
      continue;
    }
    if (/^(An|To)\s*:/i.test(line)) {
      forward.to = line.replace(/^(?:An|To)\s*:\s*/i, '').trim();
      sawHeader = true;
      i += 1;
      continue;
    }
    if (/^(Betreff|Subject)\s*:/i.test(line)) {
      forward.subject = line.replace(/^(?:Betreff|Subject)\s*:\s*/i, '').trim();
      forward.bodyStartIdx = i + 1;
      sawHeader = true;
      i += 1;
      break;
    }

    if (sawHeader) {
      forward.bodyStartIdx = i;
      break;
    }
    i += 1;
  }

  return forward;
}

function findSignatureStartIndex(lines, fromIdx = 0) {
  for (let i = fromIdx; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    if (SIGNATURE_START_PATTERNS.some((re) => re.test(trimmed))) return i;
  }
  return -1;
}

function findThreadCutIndex(lines, fromIdx = 0) {
  for (let i = fromIdx; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    if (THREAD_CUT_PATTERNS.some((re) => re.test(trimmed))) return i;
    if (/^>{1,}\s*\S/.test(trimmed)) return i;
  }
  return -1;
}

function isBoilerplateLine(line) {
  return SIGNATURE_BOILERPLATE_PATTERNS.some((re) => re.test(line));
}

/** Signatur für Kontaktdaten behalten, aus Anfragetext entfernen */
export function splitInquiryAndSignature(text, startIdx = 0) {
  const lines = linesOf(text);
  const sigIdx = findSignatureStartIndex(lines, startIdx);
  const threadIdx = findThreadCutIndex(lines, startIdx);
  let cutIdx = lines.length;

  if (sigIdx >= 0) cutIdx = Math.min(cutIdx, sigIdx);
  if (threadIdx >= 0) cutIdx = Math.min(cutIdx, threadIdx);

  const inquiryLines = [];
  for (let i = startIdx; i < cutIdx; i++) {
    const line = lines[i];
    if (isBoilerplateLine(line)) break;
    inquiryLines.push(line);
  }

  const signatureLines = sigIdx >= 0
    ? lines.slice(sigIdx).filter((l) => !isBoilerplateLine(l) || /@/.test(l) || /\d{5,}/.test(l))
    : lines.slice(cutIdx).slice(0, 8);

  return {
    inquiryText: inquiryLines.join('\n').trim(),
    signatureBlock: signatureLines.join('\n').trim(),
  };
}

export function parseOnBehalfOf(text) {
  const patterns = [
    /(?:schreib\w*|anfrage(?:\s+stelle\s+ich)?)\s+im\s+Auftrag\s+(?:von|meines|meiner)\s+(?:meines\s+|meiner\s+)?(?:(?:bruders|vaters|sohnes|mannes|mutter|vater|frau)\s+)?([A-ZÄÖÜ][a-zäöüß]+(?:\s+[A-ZÄÖÜ][a-zäöüß]+)+)/i,
    /im\s+Auftrag\s+(?:von|meines|meiner)\s+(?:(?:bruders|vaters|sohnes|mannes|mutter|vater|frau)\s+)?([A-ZÄÖÜ][a-zäöüß]+(?:\s+[A-ZÄÖÜ][a-zäöüß]+)+)/i,
  ];
  for (const re of patterns) {
    const m = text.match(re);
    if (m?.[1]) return m[1].trim();
  }
  return null;
}

function findAllEmails(text) {
  const emails = [...text.matchAll(/\b([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})\b/g)]
    .map((m) => m[1].toLowerCase());
  return [...new Set(emails)];
}

function pickCustomerEmail(text, preferredEmail = null) {
  if (preferredEmail && !isLikelyDealerEmail(preferredEmail)) return preferredEmail;
  const emails = findAllEmails(text);
  const customer = emails.find((e) => !isLikelyDealerEmail(e));
  return customer ?? preferredEmail ?? null;
}

/** Betreffzeile als ergänzende Fahrzeughinweise (niedrigere Priorität als Body) */
export function parseSubjectVehicleHints(subject) {
  if (!subject) return {};
  const hints = {};
  const lower = subject.toLowerCase();

  if (/ev\s*4|ev4\b/i.test(subject)) {
    hints.brand = 'Kia';
    hints.model = 'EV4';
    hints.modelId = 'ev4';
  } else if (/ev\s*3|ev3\b/i.test(subject)) {
    hints.brand = 'Kia';
    hints.model = 'EV3';
    hints.modelId = 'ev3';
  } else if (/sportage/i.test(subject)) {
    hints.brand = 'Kia';
    hints.model = 'Sportage';
    hints.modelId = 'sportage';
  }

  if (/\bearth\b/i.test(subject)) hints.trimLabel = 'Earth';
  if (/\bgt[\s-]?line\b/i.test(subject)) hints.trimLabel = 'GT-Line';

  const kwh = parseBatteryKwhFromText(subject);
  if (kwh != null) {
    hints.batteryKwh = kwh;
    hints.batteryLabel = batteryLabelFromKwh(kwh);
    if (kwh >= 75) hints.engineId = 'ev-long';
    else if (kwh <= 60) hints.engineId = 'ev-std';
  }

  if (/\bangebot\b/i.test(lower)) hints.actionHint = 'offer';
  return hints;
}

export function mergeSubjectHints(fields, subject) {
  if (!subject) return fields;
  const hints = parseSubjectVehicleHints(subject);
  const next = { ...fields };
  if (!next.modelId && hints.modelId) {
    next.modelId = hints.modelId;
    next.model = hints.model ?? next.model;
    next.brand = hints.brand ?? next.brand;
  }
  if (!next.trimLabel && hints.trimLabel) next.trimLabel = hints.trimLabel;
  if (next.batteryKwh == null && hints.batteryKwh != null) {
    next.batteryKwh = hints.batteryKwh;
    next.batteryLabel = hints.batteryLabel;
    next.engineId = next.engineId ?? hints.engineId;
  }
  return next;
}

/**
 * Haupt-Preprocessing: Weiterleitung, Signatur, Thread, HTML
 */
export function preprocessCustomerMail(rawText) {
  const cleaned = cleanMailHtmlArtifacts(rawText);
  const forward = parseForwardBlock(cleaned);
  const subjectFromTop = extractMailSubject(cleaned);
  const subject = forward?.subject ?? subjectFromTop ?? null;

  let inquiryText = cleaned;
  let signatureBlock = '';
  let customerName = null;
  let customerEmail = null;

  if (forward) {
    const { inquiryText: body, signatureBlock: sig } = splitInquiryAndSignature(
      cleaned,
      forward.bodyStartIdx,
    );
    inquiryText = body;
    signatureBlock = sig;
    customerName = forward.fromName;
    customerEmail = pickCustomerEmail(`${body}\n${sig}`, forward.fromEmail);
  } else {
    const { inquiryText: body, signatureBlock: sig } = splitInquiryAndSignature(cleaned, 0);
    inquiryText = body;
    signatureBlock = sig;
    customerEmail = pickCustomerEmail(`${body}\n${sig}`);
  }

  const onBehalfOf = parseOnBehalfOf(inquiryText);
  const customerMailNote = onBehalfOf
    ? `Sucht im Auftrag von ${onBehalfOf}.`
    : null;

  if (!customerName) {
    customerName = parseCustomerNameFromMail(inquiryText, signatureBlock);
  }

  return {
    raw: rawText,
    cleaned,
    subject,
    inquiryText,
    signatureBlock,
    forward,
    isForwarded: Boolean(forward),
    customerName,
    customerEmail,
    onBehalfOf,
    customerMailNote,
  };
}

export function isLikelyCustomerMail(text) {
  const raw = String(text ?? '');
  return /\b[^\s@]+@[^\s@]+\.[^\s@]+\b/.test(raw)
    || /mit freundlichen grüßen|beste grüße|viele grüße|sent from my iphone/i.test(raw)
    || /-----Ursprüngliche Nachricht-----|Forwarded message|Weitergeleitete Nachricht/i.test(raw)
    || /\b(0\s*1[567]\d[\s\-/]?\d{3,4}[\s\-/]?\d{4,6})\b/.test(raw)
    || raw.split('\n').length >= 4;
}

export function extractMailSignatureBlock(text) {
  const { signatureBlock } = splitInquiryAndSignature(text, 0);
  return signatureBlock || linesOf(text).slice(-8).join('\n');
}

export function splitCustomerName(fullName) {
  if (!fullName) return { salutation: null, firstName: null, lastName: null, fullName: null };
  const trimmed = fullName.trim();
  const parts = trimmed.split(/\s+/);
  let idx = 0;
  let salutation = null;

  if (/^(herr|frau|hr\.|fr\.)$/i.test(parts[0]) && parts[1]) {
    salutation = parts[0].replace(/\.$/, '');
    idx = 1;
  }

  const nameParts = parts.slice(idx);
  if (!nameParts.length) {
    return { salutation, firstName: null, lastName: null, fullName: trimmed };
  }
  if (nameParts.length === 1) {
    return { salutation, firstName: nameParts[0], lastName: null, fullName: trimmed };
  }
  return {
    salutation,
    firstName: nameParts[0],
    lastName: nameParts.slice(1).join(' '),
    fullName: trimmed,
  };
}

export function parseCustomerNameFromMail(inquiryText, signatureBlock = '') {
  const body = inquiryText.replace(/\s+/g, ' ').trim();
  const patterns = [
    /(?:für|an)\s+(?:herrn|frau|hr\.|fr\.)\s+([A-ZÄÖÜ][a-zäöüß]+(?:\s+[A-ZÄÖÜ][a-zäöüß]+)+)/i,
    /(?:für)\s+([A-ZÄÖÜ][a-zäöüß]+(?:\s+[A-ZÄÖÜ][a-zäöüß]+)+)\s+(?:ein|eine|einen|bitte)/i,
    /(?:herr|frau)\s+([A-ZÄÖÜ][a-zäöüß]+(?:\s+[A-ZÄÖÜ][a-zäöüß]+)+)/i,
  ];

  for (const re of patterns) {
    const m = body.match(re);
    if (m?.[1]) return m[1].trim();
  }

  const sigLines = linesOf(signatureBlock);
  for (const line of sigLines) {
    if (/@/.test(line) || /\d{5,}/.test(line) || isBoilerplateLine(line)) continue;
    const nameLine = line.match(/^([A-ZÄÖÜ][a-zäöüß]+(?:\s+[A-ZÄÖÜ][a-zäöüß]+)+)$/);
    if (nameLine) return nameLine[1].trim();
  }

  return null;
}

export function parseLeasingEndFromMail(text) {
  const months = monthPattern();
  const patterns = [
    new RegExp(`leasing\\s+läuft\\s+(?:im|in)\\s+(${months})\\s+aus`, 'i'),
    new RegExp(`leasing\\s+(?:läuft|endet)\\s+(?:im|in|bis)\\s+(${months})(?:\\s+(20\\d{2}))?`, 'i'),
    new RegExp(`leasingvertrag\\s+(?:läuft|endet)[^\\n.]{0,40}(?:im|in|bis)\\s+(${months})(?:\\s+(20\\d{2}))?`, 'i'),
    new RegExp(`leasing(?:ende|vertrag| läuft| endet)[^\\n.]{0,50}(?:im|in|bis)\\s+(${months})(?:\\s+(20\\d{2}))?`, 'i'),
    new RegExp(`vertrag\\s+endet\\s+(?:im|in)\\s+(${months})(?:\\s+(20\\d{2}))?`, 'i'),
    /leasing\s+(?:ende|aus)\s*(20\d{2})/i,
  ];

  for (const re of patterns) {
    const m = text.match(re);
    if (!m) continue;
    const month = capitalizeMonth(m[1].replace(/^maerz$/i, 'märz'));
    const year = m[2] ?? null;
    return year ? `${month} ${year}` : month;
  }
  return null;
}

export function parseUrgentDeliveryNeed(text) {
  return /so\s+schnell\s+wie\s+möglich|schnellstmöglich|schnellstmoeglich|asap|zeitnah|dringend|eilig|sofort\s+bedarf|sofortbedarf|schnell\s+verfügbar/i.test(text);
}

export function parseDesiredDeliveryFromMail(text) {
  const months = monthPattern();

  if (parseUrgentDeliveryNeed(text)) return 'sofort';

  const needed = text.match(new RegExp(`fahrzeug\\s+wird\\s+(?:im|in)\\s+(${months})\\s+benötigt`, 'i'))
    ?? text.match(new RegExp(`(?:benötigt|brauche|brauchen|bedarf)\\s+(?:im|in)\\s+(${months})`, 'i'))
    ?? text.match(new RegExp(`(?:übergabe|lieferung|zulassung|abholung)[^\\n.]{0,30}(?:im|in)\\s+(${months})`, 'i'))
    ?? text.match(new RegExp(`(?:liefertermin|wunschtermin|termin)\\s+(?:im|in)?\\s*(${months})`, 'i'));
  if (needed) return capitalizeMonth(needed[1].replace(/^maerz$/i, 'märz'));

  if (/nächste\s*woche|naechste\s*woche/i.test(text)) return 'nächste Woche';
  if (/diese\s*woche/i.test(text)) return 'diese Woche';
  if (/diesen\s*monat/i.test(text)) return 'diesen Monat';
  if (/nächsten\s*monat/i.test(text)) return 'nächsten Monat';

  return null;
}

export function inferDeliveryBeforeLeasingEnd(leasingEndDate) {
  if (!leasingEndDate) return null;
  const m = leasingEndDate.match(/(januar|februar|märz|maerz|april|mai|juni|juli|august|september|oktober|november|dezember)/i);
  if (!m) return null;
  const key = m[1].toLowerCase().replace('maerz', 'märz');
  return `vor ${MONTH_LABELS[key] ?? capitalizeMonth(m[1])}`;
}

export function parseVehicleChangeFromMail(text) {
  return /fahrzeugwechsel|neues\s+auto|leasingerneuerung|leasing[\s-]?erneuerung|auto\s+wechseln|fahrzeug\s+erneuern|nach\s+leasingende|nach\s+leasing\s+auslauf/i.test(text);
}

export function parseImmediateNeedFromMail(text) {
  return /sofort\s+verfügbar|sofort\s+lieferbar|sofort\s+da|auf\s+lager|lagerwagen|sofort\s+möglich|sofortbedarf|sofort\s+bedarf/i.test(text);
}

const SPECIAL_EQUIPMENT_PATTERNS = [
  { re: /\bwärmepumpe|waermepumpe\b/i, label: 'Wärmepumpe' },
  { re: /\b360|rundum|surround\s*view\b/i, label: '360° Kamera' },
  { re: /\bpanorama|glasdach\b/i, label: 'Panoramadach' },
  { re: /\bharman|sound\s*system\b/i, label: 'Harman Kardon' },
  { re: /\bsitzheizung\b/i, label: 'Sitzheizung' },
  { re: /\blenkradheizung\b/i, label: 'Lenkradheizung' },
  { re: /\btotwinkel\b/i, label: 'Totwinkelassistent' },
  { re: /\bhead[\s-]?up|hud\b/i, label: 'Head-Up Display' },
  { re: /\banhänger|anhaenger|ahk\b/i, label: 'Anhängerkupplung' },
  { re: /\bassist|drivewise\b/i, label: 'Assistenzpaket' },
];

export function parseSpecialEquipmentFromMail(text) {
  const hits = SPECIAL_EQUIPMENT_PATTERNS.filter((p) => p.re.test(text)).map((p) => p.label);
  return [...new Set(hits)];
}

export function extractMailExtras(text) {
  const lower = String(text ?? '').toLowerCase();
  const sonderausstattung = parseSpecialEquipmentFromMail(text);
  return {
    ahk: /\bahk\b|anhänger|anhaenger|anhängerkupplung|kupplung\s+gewünscht/i.test(lower),
    winterraeder: /\bwinterreifen|winterräder|winterraeder|winter\s*paket|winterkompletträder/i.test(lower),
    wartung: /\bwartung|service\s*paket|wartungsvertrag|inspektion\s*paket|service\s*vertrag/i.test(lower),
    versicherung: /\bversicherung|vollkasko|teilkasko|kfz-versicherung|versicherungsangebot/i.test(lower),
    sonderausstattung,
    freeText: sonderausstattung.length ? sonderausstattung.join(', ') : '',
  };
}

export function resolveTimingFromMail(text, existing = {}) {
  const leasingEndDate = parseLeasingEndFromMail(text) ?? existing.leasingEndDate ?? null;
  let desiredDeliveryDate = parseDesiredDeliveryFromMail(text) ?? existing.desiredDeliveryDate ?? null;

  if (!desiredDeliveryDate && leasingEndDate) {
    desiredDeliveryDate = inferDeliveryBeforeLeasingEnd(leasingEndDate);
  }

  const immediateAvailability = parseImmediateNeedFromMail(text)
    || parseUrgentDeliveryNeed(text)
    || existing.immediateAvailability
    || false;

  if (immediateAvailability && !desiredDeliveryDate) {
    desiredDeliveryDate = 'sofort';
  }

  return {
    desiredDeliveryDate,
    leasingEndDate,
    vehicleChangeIntent: parseVehicleChangeFromMail(text) || existing.vehicleChangeIntent || false,
    immediateAvailability,
  };
}

export function extractCustomerFromMail(text, existing = {}, mailCtx = null) {
  const ctx = mailCtx ?? preprocessCustomerMail(text);
  const inquiryText = ctx.inquiryText || text;
  const contactSource = `${inquiryText}\n${ctx.signatureBlock}`;

  let fullName = ctx.customerName ?? existing.customerName ?? null;
  let email = ctx.customerEmail ?? existing.customerEmail ?? null;

  if (!fullName && ctx.forward?.fromName) {
    fullName = ctx.forward.fromName;
  }
  if (!fullName) {
    fullName = parseCustomerNameFromMail(inquiryText, ctx.signatureBlock);
  }

  email = pickCustomerEmail(contactSource, email ?? ctx.forward?.fromEmail);
  const phone = parseCustomerPhone(contactSource) ?? existing.customerPhone ?? null;

  const { salutation, firstName, lastName } = splitCustomerName(fullName);

  return {
    customerName: fullName,
    customerSalutation: salutation ?? existing.customerSalutation ?? null,
    customerFirstName: firstName ?? existing.customerFirstName ?? null,
    customerLastName: lastName ?? existing.customerLastName ?? null,
    customerPhone: phone,
    customerEmail: email,
    customerMailNote: ctx.customerMailNote ?? existing.customerMailNote ?? null,
    interestedPartyName: ctx.onBehalfOf ?? existing.interestedPartyName ?? null,
  };
}

/**
 * Mail-Kontext in bestehende Parser-Felder mergen (CRM-Felder bleiben extern höher priorisiert)
 */
export function enrichFieldsFromCustomerMail(text, fields = {}, mailCtx = null) {
  if (!text?.trim()) return fields;

  const ctx = mailCtx ?? preprocessCustomerMail(text);
  const inquiryText = ctx.inquiryText || text;

  const customer = extractCustomerFromMail(text, fields, ctx);
  const timing = resolveTimingFromMail(inquiryText, fields);
  const extras = extractMailExtras(inquiryText);

  const batteryKwh = fields.batteryKwh ?? parseBatteryKwhFromText(inquiryText);
  let next = {
    ...fields,
    ...customer,
    ...timing,
    batteryKwh,
    batteryLabel: fields.batteryLabel ?? (batteryKwh != null ? batteryLabelFromKwh(batteryKwh) : null),
    extrasFromMail: extras,
    mailInquiryText: inquiryText,
    mailSubject: ctx.subject ?? fields.mailSubject ?? null,
    mailIsForwarded: ctx.isForwarded,
  };

  next = mergeSubjectHints(next, ctx.subject);

  if (extras.ahk) {
    next.extrasFromMail = { ...extras, ahk: true };
  }

  if (!next.packageLabels?.length && extras.sonderausstattung?.length) {
    next.specialEquipment = extras.sonderausstattung;
  }

  if (batteryKwh != null) {
    if (batteryKwh >= 75) next.engineId = next.engineId ?? 'ev-long';
    else if (batteryKwh <= 60) next.engineId = next.engineId ?? 'ev-std';
  }

  return next;
}

export function buildDeliveryDateOptions(currentValue = null) {
  const base = [
    'sofort',
    'diese Woche',
    'nächste Woche',
    'diesen Monat',
    'nächsten Monat',
    ...Object.values(MONTH_LABELS),
    ...Object.values(MONTH_LABELS).map((m) => `vor ${m}`),
    'offen',
  ];
  if (currentValue && !base.includes(currentValue)) base.unshift(currentValue);
  return [...new Set(base)];
}

export function buildDownPaymentOptions(currentValue = 0) {
  const base = [0, 1000, 1500, 2000, 2500, 3000, 4000, 5000, 7500, 10000];
  if (currentValue != null && !base.includes(currentValue)) base.push(currentValue);
  return [...new Set(base)].sort((a, b) => a - b);
}

export function buildBudgetRateOptions(currentRate = null) {
  const base = [250, 300, 350, 400, 450, 500, 550, 600, 650, 700, 750, 790, 850, 900, 999];
  if (currentRate != null && !base.includes(currentRate)) base.push(currentRate);
  return [...new Set(base)].sort((a, b) => a - b);
}

export function buildBudgetPriceOptions(currentPrice = null) {
  const base = [20000, 25000, 30000, 35000, 40000, 45000, 50000, 55000, 60000];
  if (currentPrice != null && !base.includes(currentPrice)) base.push(currentPrice);
  return [...new Set(base)].sort((a, b) => a - b);
}
