/**
 * Clever Antworten – Textentwürfe aus Kundenkontext (regelbasiert)
 */
import { buildCleverGreeting } from './cleverAntworten.js';
import { getAnswerIntentLabel, resolveIntentGenerator } from './cleverAnswerIntentCatalog.js';
import {
  applySelectedContextHints,
  buildSelectableContextHints,
} from './selectableContextHints.js';

export const CLEVER_ANSWER_TYPES = [
  { id: 'angebot_senden', label: 'Angebot senden' },
  { id: 'nachfassen', label: 'Angebot nachfassen' },
  { id: 'kundenfrage', label: 'Kundenfrage beantworten' },
  { id: 'auswahl_erklaeren', label: 'Auswahl erklären' },
  { id: 'bar_leasing_vergleichen', label: 'Bar / Leasing vergleichen' },
  { id: 'unterlagen', label: 'Unterlagen anfordern' },
  { id: 'probefahrt', label: 'Probefahrt vorschlagen' },
  { id: 'frei', label: 'Freier Text / Diktat' },
];

export const CLEVER_ANSWER_TONES = [
  { id: 'kurz', label: 'Kurz' },
  { id: 'freundlich', label: 'Freundlich' },
  { id: 'verbindlich', label: 'Verbindlich' },
  { id: 'locker', label: 'Locker' },
  { id: 'professionell', label: 'Professionell' },
  { id: 'nachfassen', label: 'Nachfassen' },
  { id: 'abschluss', label: 'Abschlussorientiert' },
];

export const CLEVER_ANSWER_CHANNELS = [
  { id: 'clever', label: 'Clever' },
  { id: 'whatsapp', label: 'WhatsApp' },
  { id: 'email', label: 'E-Mail' },
  { id: 'sms', label: 'SMS / Kurz' },
];

const TRIM_HINTS = {
  air: 'preisbewusste Variante mit sinnvoller Basisausstattung',
  vision: 'preisbewusste Variante mit sinnvoller Basisausstattung',
  earth: 'ausgewogene Variante mit guter Preis-Leistung',
  spirit: 'Komfort-Variante mit mehr Ausstattung für den Alltag',
  'gt-line': 'sportliche Top-Ausstattung',
  platinum: 'Premium-Ausstattung mit Komfort-Extras',
  elite: 'höchste Ausstattung',
};

function closing(context = {}, channel = 'whatsapp') {
  const seller = context.sellerName?.trim();
  if (channel === 'sms') {
    return seller && seller !== 'Ihr Verkaufsteam' ? `\n\nGrüße\n${seller}` : '\n\nGrüße';
  }
  if (seller && seller !== 'Ihr Verkaufsteam') {
    return `\n\nViele Grüße\n${seller}`;
  }
  return '\n\nViele Grüße';
}

function greeting(context = {}) {
  return buildCleverGreeting(context.customer?.name ?? context.legacy?.customerName, context.customer?.salutation ?? context.legacy?.salutation);
}

function joinParagraphs(parts = []) {
  return parts.filter(Boolean).join('\n\n');
}

function trimHint(trimLabel = '') {
  const key = String(trimLabel ?? '').toLowerCase().replace(/\s+/g, '-');
  for (const [id, hint] of Object.entries(TRIM_HINTS)) {
    if (key.includes(id)) return hint;
  }
  return 'passende Ausstattungsvariante';
}

function formatRatePending(channel = 'whatsapp') {
  if (channel === 'sms') return 'Die genauen Konditionen bereite ich gerade final vor.';
  return 'Ich bereite die genauen Raten und Konditionen gerade noch final vor und melde mich gleich mit den Details.';
}

function applyTone(text = '', tone = 'freundlich') {
  if (tone === 'kurz') return shortenForChannel(text, 'sms');
  if (tone === 'freundlich') {
    return text
      .replace(/ich habe Ihnen (?!gerne)/gi, 'ich habe Ihnen gerne ')
      .replace(/ich bereite Ihnen (?!gerne)/gi, 'ich bereite Ihnen gerne ')
      .replace(/ich wollte kurz nachfragen/gi, 'ich wollte mich freundlich kurz melden');
  }
  if (tone === 'verbindlich') {
    return `${text.trim()}\n\nBitte geben Sie mir kurz Bescheid, wie wir fortfahren sollen.`;
  }
  if (tone === 'locker') {
    return text
      .replace(/\bSie\b/g, 'du')
      .replace(/\bIhnen\b/g, 'dir')
      .replace(/\bIhre\b/g, 'deine')
      .replace(/\bIhr\b/g, 'dein');
  }
  if (tone === 'nachfassen') {
    return text.replace(/ich wollte kurz nachfragen/gi, 'ich wollte mich freundlich kurz melden');
  }
  if (tone === 'abschluss') {
    return `${text.trim()}\n\nWenn es für Sie passt, können wir den nächsten Schritt gerne direkt einleiten.`;
  }
  return text;
}

function shortenForChannel(text = '', channel = 'whatsapp') {
  const lines = text.split('\n').map((line) => line.trim()).filter(Boolean);
  if (channel !== 'sms') return text;

  const greetingLine = lines[0] ?? '';
  const body = lines.slice(1, -2).join(' ');
  const shortBody = body.length > 120 ? `${body.slice(0, 117).trim()}…` : body;
  const closingLine = lines.slice(-2).join('\n');
  return [greetingLine, '', shortBody, '', closingLine].join('\n').trim();
}

function adaptForChannel(text = '', channel = 'whatsapp') {
  if (channel === 'email') {
    const body = text.trim();
    if (!body.includes('\n\n')) return body;
    return body;
  }
  if (channel === 'sms') return shortenForChannel(text, 'sms');
  return shortenForChannel(text, 'whatsapp');
}

function appendDictationNote(text = '', dictation = '') {
  const extra = String(dictation ?? '').trim();
  if (!extra) return text;
  const lines = text.split('\n');
  const closingIndex = lines.findIndex((line, index) => index > 0 && /^Viele Grüße|^Grüße/i.test(line));
  const insertAt = closingIndex > 0 ? closingIndex : lines.length;
  lines.splice(insertAt, 0, '', extra);
  return lines.join('\n').trim();
}

function draftAngebotSenden(context = {}, channel = 'whatsapp') {
  const group = context.board?.primarySelectionGroup;
  const legacy = context.legacy ?? {};
  const lines = [greeting(context), ''];

  if (group?.variantCount > 0) {
    const trimPart = group.trimLabels.length
      ? group.trimLabels.join(', ')
      : group.trimLine;
    lines.push(`ich habe Ihnen die ${group.modelLabel}-Auswahl vorbereitet.`);
    if (trimPart) {
      lines.push(`Es sind ${group.variantCount} Varianten dabei: ${trimPart}.`);
    }
    if (context.wishConditionsLine) {
      lines.push(`Die Konditionen sind auf ${context.wishConditionsLine} gerechnet.`);
    }
    if (group.hasCalculatedRates && group.rateRange) {
      lines.push(`Die Raten liegen je nach Variante bei ${group.rateRange}.`);
    } else {
      lines.push(formatRatePending(channel));
    }
    if (group.customerLink) {
      lines.push('Den Link zur Auswahl sende ich Ihnen gleich mit.');
    } else {
      lines.push('Ich schicke Ihnen den Link gleich mit – sagen Sie mir gerne, welche Variante für Sie am interessantesten ist.');
    }
  } else if (legacy.offerUrl && legacy.vehicleTitle) {
    lines.push(`ich habe Ihnen ein passendes Angebot zum ${legacy.vehicleTitle} vorbereitet.`);
    lines.push(`Sie können es hier online ansehen: ${legacy.offerUrl}`);
    if (legacy.priceLine) lines.push(`Kondition: ${legacy.priceLine}`);
  } else if (legacy.vehicleTitle) {
    lines.push(`ich bereite Ihnen gerade ein passendes Angebot zum ${legacy.vehicleTitle} vor und sende es Ihnen anschließend zu.`);
    lines.push(formatRatePending(channel));
  } else {
    lines.push('ich bereite Ihnen das passende Angebot gerade vor und sende es Ihnen anschließend zu.');
    lines.push(formatRatePending(channel));
  }

  lines.push(closing(context, channel));
  return joinParagraphs(lines);
}

function draftNachfassen(context = {}, channel = 'whatsapp') {
  const group = context.board?.primarySelectionGroup;
  const legacy = context.legacy ?? {};
  const lines = [greeting(context), ''];

  if (context.reactions?.offerOpened || legacy.offerOpened) {
    const subject = group?.modelLabel ?? legacy.vehicleTitle ?? 'das Angebot';
    lines.push(`ich wollte kurz nachfragen, ob Sie zur ${subject}-Auswahl schon Fragen haben oder ob ich noch etwas anpassen darf.`);
  } else if (legacy.offerSent) {
    lines.push('ich wollte kurz nachfragen, ob mein Angebot bei Ihnen angekommen ist und ob ich noch etwas anpassen darf.');
    if (legacy.offerUrl) lines.push(legacy.offerUrl);
  } else {
    lines.push('ich wollte kurz nachfragen, ob Sie noch Fragen haben oder ob ich Ihnen bei der Entscheidung helfen kann.');
  }

  lines.push(closing(context, channel));
  return joinParagraphs(lines);
}

function draftStockVehicleRequest(context = {}, channel = 'whatsapp') {
  const stock = context.legacy?.requestedStockVehicle
    ?? context.board?.requestedStockVehicle
    ?? {};
  const vehicle = stock.vehicleTitle ?? context.legacy?.vehicleTitle ?? 'das angefragte Fahrzeug';
  const price = stock.price != null
    ? `${Number(stock.price).toLocaleString('de-DE')} €`
    : null;
  const priceLine = price ? `Das Fahrzeug ist laut Inserat aktuell mit ${price} inseriert.` : 'Das Fahrzeug ist laut Inserat aktuell angefragt.';
  return joinParagraphs([
    greeting(context),
    '',
    `vielen Dank für Ihre Anfrage zum ${vehicle}.`,
    priceLine,
    'Gerne erstelle ich Ihnen ein passendes Angebot. Möchten Sie das Fahrzeug kaufen, finanzieren oder leasen?',
    closing(context, channel),
  ]);
}

function draftKundenfrage(context = {}, channel = 'whatsapp', dictation = '') {
  const question = context.primaryOpenQuestion;
  const lines = [greeting(context), ''];

  if (question?.text) {
    const topic = question.text.replace(/\?$/, '').trim();
    lines.push(`zu Ihrer Frage „${topic}“:`);
  } else {
    lines.push('zu Ihrer Frage:');
  }

  const dictationText = String(dictation ?? '').trim();
  if (dictationText) {
    lines.push(dictationText.endsWith('.') ? dictationText : `${dictationText}.`);
  } else {
    lines.push('Ich prüfe das gerne für Sie und melde mich mit einer passenden Antwort.');
  }

  lines.push(closing(context, channel));
  return joinParagraphs(lines);
}

function draftAuswahlErklaeren(context = {}, channel = 'whatsapp') {
  const group = context.board?.primarySelectionGroup;
  const lines = [greeting(context), ''];

  if (!group?.variantCount) {
    lines.push('kurz erklärt: Ich stelle Ihnen gleich die passenden Varianten gegenüber und sage Ihnen, welche Ausstattung sich für welchen Bedarf eignet.');
    lines.push(closing(context, channel));
    return joinParagraphs(lines);
  }

  lines.push(`kurz erklärt zur ${group.modelLabel}-Auswahl:`);
  const explanations = (group.trimLabels ?? []).slice(0, 3).map((trimLabel) => (
    `${trimLabel} ist die ${trimHint(trimLabel)}.`
  ));
  if (explanations.length) {
    lines.push(explanations.join(' '));
  }
  lines.push('Welche Variante am besten passt, hängt vor allem von Komfort, Ausstattung und Budget ab – ich helfe Ihnen gerne bei der Einordnung.');
  lines.push(closing(context, channel));
  return joinParagraphs(lines);
}

function draftBarLeasingVergleichen(context = {}, channel = 'whatsapp') {
  const lines = [greeting(context), ''];
  const group = context.board?.primarySelectionGroup;

  if (group?.variantCount) {
    lines.push(`ich habe Ihnen für den ${group.modelLabel} sowohl die Leasing- als auch die Kaufoption gegenübergestellt.`);
  } else {
    lines.push('ich habe Ihnen beide Möglichkeiten – Kauf und Leasing/Finanzierung – gegenübergestellt.');
  }

  if (context.wishConditionsLine) {
    lines.push(`Die Leasing-Variante ist auf ${context.wishConditionsLine} gerechnet.`);
  }

  const hasRates = group?.hasCalculatedRates || context.legacy?.priceLine;
  if (hasRates) {
    lines.push('So sehen Sie auf einen Blick, welche Option monatlich leichter fällt und welche langfristig für Sie passt.');
  } else {
    lines.push(formatRatePending(channel));
  }

  lines.push('Sagen Sie mir gerne, ob Sie eher monatlich planen oder direkt kaufen möchten.');
  lines.push(closing(context, channel));
  return joinParagraphs(lines);
}

function draftUnterlagen(context = {}, channel = 'whatsapp') {
  const lines = [greeting(context), ''];
  const openLabels = context.unterlagen?.openLabels ?? [];

  lines.push('für die weitere Bearbeitung benötigen wir noch kurz folgende Unterlagen:');

  if (openLabels.length) {
    lines.push('', ...openLabels.map((label) => `- ${label}`));
  } else {
    lines.push('', '- Ausweis', '- Gehaltsnachweis', '- Selbstauskunft');
  }

  if (context.unterlagen?.uploadUrl) {
    lines.push('', `Sie können uns diese gerne über den Upload-Link senden: ${context.unterlagen.uploadUrl}`);
  } else {
    lines.push('', 'Sie können uns diese gerne per E-Mail oder über den Upload-Link senden.');
  }

  lines.push(closing(context, channel));
  return joinParagraphs(lines);
}

function draftFrei(context = {}, channel = 'whatsapp', dictation = '') {
  const dictationText = String(dictation ?? '').trim();
  if (dictationText) {
    const vehicleBit = context.board?.primarySelectionGroup?.modelLabel
      ?? context.legacy?.vehicleTitle
      ?? '';
    const intro = vehicleBit
      ? `bezüglich ${vehicleBit}`
      : 'bezüglich Ihrer Anfrage';
    return joinParagraphs([
      greeting(context),
      '',
      `${intro}: ${dictationText}`,
      closing(context, channel),
    ]);
  }

  const vehicleBit = context.legacy?.vehicleTitle ? ` zum ${context.legacy.vehicleTitle}` : '';
  return joinParagraphs([
    greeting(context),
    '',
    `bezüglich Ihrer Anfrage${vehicleBit} melde ich mich gerne bei Ihnen.`,
    closing(context, channel),
  ]);
}

function draftProbefahrt(context = {}, channel = 'whatsapp') {
  const model = context.board?.primarySelectionGroup?.modelLabel
    ?? context.legacy?.vehicleTitle
    ?? 'Wunschfahrzeug';
  const lines = [
    greeting(context),
    '',
    `wenn Sie möchten, können wir gerne eine Probefahrt mit dem ${model} vereinbaren. Wann würde es Ihnen zeitlich passen?`,
    closing(context, channel),
  ];
  return joinParagraphs(lines);
}

function draftOfferOpenedFollowup(context = {}, channel = 'whatsapp') {
  const subject = context.board?.primarySelectionGroup?.modelLabel
    ?? context.legacy?.vehicleTitle
    ?? 'Angebot';
  return joinParagraphs([
    greeting(context),
    '',
    `ich habe gesehen, dass Sie sich ${subject} angeschaut haben. Passt das grundsätzlich für Sie oder soll ich noch etwas an Laufzeit, Kilometer oder Anzahlung anpassen?`,
    closing(context, channel),
  ]);
}

function draftOfferInterestedFollowup(context = {}, channel = 'whatsapp') {
  const subject = context.board?.primarySelectionGroup?.modelLabel
    ?? context.legacy?.vehicleTitle
    ?? 'das Angebot';
  return joinParagraphs([
    greeting(context),
    '',
    `schön, dass ${subject} Ihr Interesse geweckt hat. Sollen wir den nächsten Schritt gemeinsam planen oder möchten Sie noch eine Variante vergleichen?`,
    closing(context, channel),
  ]);
}

function draftNoResponseFollowup(context = {}, channel = 'whatsapp') {
  return joinParagraphs([
    greeting(context),
    '',
    'ich habe Sie telefonisch leider nicht erreicht. Melden Sie sich gerne kurz, wann es Ihnen passt – oder schreiben Sie mir einfach hier.',
    closing(context, channel),
  ]);
}

function draftShortFollowup(context = {}, channel = 'whatsapp') {
  return joinParagraphs([
    greeting(context),
    '',
    'ich wollte mich kurz melden – passt alles soweit oder darf ich noch etwas für Sie prüfen?',
    closing(context, channel),
  ]);
}

function draftRueckfrage(context = {}, channel = 'whatsapp') {
  const legacy = context.legacy ?? {};
  const lines = [greeting(context), '', 'damit ich Ihnen direkt das passende Angebot vorbereiten kann, habe ich noch eine kurze Rückfrage:'];

  if (!legacy.paymentLabel || legacy.paymentType === 'unknown') {
    lines.push('', 'Soll es eher Leasing, Finanzierung oder Kauf werden?');
  } else if (context.wishConditions?.termMonths) {
    lines.push('', `Passt ${context.wishConditions.termMonths} Monate Laufzeit für Sie?`);
  } else {
    lines.push('', 'Welche Variante oder Ausstattung ist Ihnen besonders wichtig?');
  }

  lines.push(closing(context, channel));
  return joinParagraphs(lines);
}

function draftTechnicalQuestion(context = {}, channel = 'whatsapp', dictation = '') {
  const question = context.primaryOpenQuestion?.text ?? 'Ihrer technischen Frage';
  const topic = question.replace(/\?$/, '').trim();
  const dictationText = String(dictation ?? '').trim();
  return joinParagraphs([
    greeting(context),
    '',
    `zu Ihrer Frage „${topic}“:`,
    dictationText || 'Ich kläre das technisch sauber für Sie und melde mich mit einer verständlichen Antwort.',
    closing(context, channel),
  ]);
}

function draftSuggestAppointment(context = {}, channel = 'whatsapp') {
  return joinParagraphs([
    greeting(context),
    '',
    'ich kann Ihnen gerne einen kurzen Termin zur Besprechung anbieten. Passt es Ihnen eher vormittags oder nachmittags?',
    closing(context, channel),
  ]);
}

function draftConfirmAppointment(context = {}, channel = 'whatsapp', dictation = '') {
  const when = String(dictation ?? '').trim() || 'wie besprochen';
  return joinParagraphs([
    greeting(context),
    '',
    `hiermit bestätige ich unseren Termin ${when}. Ich freue mich auf Sie.`,
    closing(context, channel),
  ]);
}

function draftOfferCallback(context = {}, channel = 'whatsapp') {
  return joinParagraphs([
    greeting(context),
    '',
    'wann darf ich Sie am besten kurz zurückrufen? Schreiben Sie mir gerne eine passende Zeit – ich melde mich dann persönlich.',
    closing(context, channel),
  ]);
}

function draftThankYou(context = {}, channel = 'whatsapp') {
  const vehicleBit = context.legacy?.vehicleTitle ? ` zu ${context.legacy.vehicleTitle}` : '';
  return joinParagraphs([
    greeting(context),
    '',
    `vielen Dank für Ihre Rückmeldung${vehicleBit}. Ich kümmere mich gerne um den nächsten Schritt.`,
    closing(context, channel),
  ]);
}

function draftMissingDocumentsReminder(context = {}, channel = 'whatsapp') {
  const openLabels = context.unterlagen?.openLabels ?? [];
  const lines = [
    greeting(context),
    '',
    'für die weitere Bearbeitung fehlen uns noch folgende Unterlagen:',
    '',
    ...(openLabels.length ? openLabels.map((label) => `- ${label}`) : ['- Ausweis', '- Selbstauskunft']),
  ];
  if (context.unterlagen?.uploadUrl) {
    lines.push('', `Upload-Link: ${context.unterlagen.uploadUrl}`);
  }
  lines.push(closing(context, channel));
  return joinParagraphs(lines);
}

function draftDocumentsReceived(context = {}, channel = 'whatsapp') {
  return joinParagraphs([
    greeting(context),
    '',
    'vielen Dank – Ihre Unterlagen sind bei uns eingegangen. Ich prüfe alles und melde mich mit dem nächsten Schritt.',
    closing(context, channel),
  ]);
}

function draftPickupRegistration(context = {}, channel = 'whatsapp') {
  const model = context.board?.primarySelectionGroup?.modelLabel
    ?? context.legacy?.vehicleTitle
    ?? 'Ihr Fahrzeug';
  return joinParagraphs([
    greeting(context),
    '',
    `für Zulassung und Abholung von ${model} kläre ich gerne den Ablauf mit Ihnen. Ich melde mich mit Termin und den letzten Details.`,
    closing(context, channel),
  ]);
}

function draftExplainRate(context = {}, channel = 'whatsapp') {
  const group = context.board?.primarySelectionGroup;
  const lines = [greeting(context), '', 'kurz zur Rate:'];
  if (group?.hasCalculatedRates && group.rateRange) {
    lines.push(`Die monatlichen Raten liegen je nach Variante bei ${group.rateRange}.`);
  } else if (context.legacy?.priceLine) {
    lines.push(`Aktuell rechne ich mit: ${context.legacy.priceLine}.`);
  } else {
    lines.push(formatRatePending(channel));
  }
  if (context.wishConditionsLine) {
    lines.push(`Grundlage: ${context.wishConditionsLine}.`);
  }
  lines.push('Gerne erkläre ich Ihnen auch, wie sich Laufzeit, Anzahlung oder Kilometer auf die Rate auswirken.');
  lines.push(closing(context, channel));
  return joinParagraphs(lines);
}

function draftExplainCash(context = {}, channel = 'whatsapp') {
  const price = context.legacy?.priceLine ?? 'den Kaufpreis';
  return joinParagraphs([
    greeting(context),
    '',
    `zum Barangebot: ${price} – inklusive der besprochenen Ausstattung. Gerne gehe ich mit Ihnen durch, was enthalten ist und welche Optionen noch sinnvoll wären.`,
    closing(context, channel),
  ]);
}

function draftExplainLeasing(context = {}, channel = 'whatsapp') {
  const cond = context.wishConditionsLine || 'Ihre Wunschkonditionen';
  return joinParagraphs([
    greeting(context),
    '',
    `zum Leasing: ${cond}. So behalten Sie die monatliche Belastung planbar und sind flexibel.`,
    closing(context, channel),
  ]);
}

function draftExplainFinancing(context = {}, channel = 'whatsapp') {
  const cond = context.wishConditionsLine || 'Ihre Wunschkonditionen';
  return joinParagraphs([
    greeting(context),
    '',
    `zur Finanzierung: ${cond}. Am Ende gehört das Fahrzeug Ihnen – ich erkläre Ihnen gerne die monatliche Belastung im Detail.`,
    closing(context, channel),
  ]);
}

function draftSuggestAlternative(context = {}, channel = 'whatsapp') {
  const model = context.board?.primarySelectionGroup?.modelLabel
    ?? context.legacy?.vehicleTitle
    ?? 'eine passende Alternative';
  return joinParagraphs([
    greeting(context),
    '',
    `ich habe mir ${model} angesehen und prüfe gerade eine passende Alternative mit ähnlichen Konditionen. Ich melde mich gleich mit einem konkreten Vorschlag.`,
    closing(context, channel),
  ]);
}

function draftSoftClose(context = {}, channel = 'whatsapp') {
  const subject = context.board?.primarySelectionGroup?.modelLabel
    ?? context.legacy?.vehicleTitle
    ?? 'Ihr Wunschfahrzeug';
  return joinParagraphs([
    greeting(context),
    '',
    `wenn ${subject} für Sie passt, können wir den nächsten Schritt gerne entspannt angehen. Sagen Sie mir einfach Bescheid – ich begleite Sie dabei.`,
    closing(context, channel),
  ]);
}

const GENERATORS = {
  angebot_senden: draftAngebotSenden,
  nachfassen: draftNachfassen,
  offer_opened_followup: draftOfferOpenedFollowup,
  offer_interested_followup: draftOfferInterestedFollowup,
  no_response_followup: draftNoResponseFollowup,
  short_followup: draftShortFollowup,
  kundenfrage: draftKundenfrage,
  stock_vehicle_request: draftStockVehicleRequest,
  rueckfrage: draftRueckfrage,
  technical_question: draftTechnicalQuestion,
  auswahl_erklaeren: draftAuswahlErklaeren,
  bar_leasing_vergleichen: draftBarLeasingVergleichen,
  explain_rate: draftExplainRate,
  explain_cash_offer: draftExplainCash,
  explain_leasing: draftExplainLeasing,
  explain_financing: draftExplainFinancing,
  suggest_alternative: draftSuggestAlternative,
  soft_close: draftSoftClose,
  unterlagen: draftUnterlagen,
  missing_documents_reminder: draftMissingDocumentsReminder,
  documents_received_confirm: draftDocumentsReceived,
  pickup_registration_explain: draftPickupRegistration,
  suggest_appointment: draftSuggestAppointment,
  confirm_appointment: draftConfirmAppointment,
  offer_callback: draftOfferCallback,
  thank_you: draftThankYou,
  probefahrt: draftProbefahrt,
  frei: draftFrei,
};

export function getCleverAnswerTypeLabel(typeOrIntentId = '') {
  const intentLabel = getAnswerIntentLabel(typeOrIntentId);
  if (intentLabel !== 'Antwort') return intentLabel;
  return CLEVER_ANSWER_TYPES.find((entry) => entry.id === typeOrIntentId)?.label ?? 'Antwort';
}

export function generateCleverAnswerDraft({
  typeId = 'angebot_senden',
  intentId = null,
  context = {},
  tone = 'freundlich',
  channel = 'whatsapp',
  dictation = '',
  selectedHints = [],
} = {}) {
  const resolvedIntent = intentId ?? typeId;
  const generatorId = resolveIntentGenerator(resolvedIntent) || typeId;
  const generator = GENERATORS[generatorId] ?? GENERATORS.angebot_senden;
  let text = generator(context, channel, dictation);
  text = applyTone(text, tone);
  text = adaptForChannel(text, channel);

  const skipDictationAppend = ['kundenfrage', 'technical_question', 'frei', 'confirm_appointment', 'stock_vehicle_request'].includes(generatorId);
  if (!skipDictationAppend) {
    text = appendDictationNote(text, dictation);
  }

  const hints = buildSelectableContextHints(context);
  text = applySelectedContextHints(text, selectedHints, hints);

  return text.trim();
}

export function buildCleverAnswerEmailSubject(context = {}, typeOrIntentId = 'offer_send') {
  const dealer = context.dealerName?.trim();
  const vehicle = context.board?.primarySelectionGroup?.modelLabel
    ?? context.legacy?.vehicleTitle?.replace(/^Kia\s+/i, '').trim();
  const generatorId = resolveIntentGenerator(typeOrIntentId) || typeOrIntentId;

  if (['unterlagen', 'missing_documents_reminder'].includes(generatorId)) {
    return dealer ? `Unterlagen für Ihre Anfrage · ${dealer}` : 'Unterlagen für Ihre Anfrage';
  }
  if (['kundenfrage', 'technical_question'].includes(generatorId)) {
    return dealer ? `Antwort auf Ihre Frage · ${dealer}` : 'Antwort auf Ihre Frage';
  }
  if (vehicle && dealer) return `Ihr Angebot: ${vehicle} · ${dealer}`;
  if (vehicle) return `Ihr Angebot: ${vehicle}`;
  if (dealer) return `Ihre Anfrage bei ${dealer}`;
  return 'Ihre Fahrzeuganfrage';
}

function refineWithHint(text = '', hintId = '', context = {}) {
  const hints = buildSelectableContextHints(context);
  const hint = hints.find((entry) => entry.id === hintId.replace('_erwaehnen', ''));
  if (!hint?.snippet) return text;
  return applySelectedContextHints(text, [hint.id], hints);
}

export function refineCleverAnswerDraft(text = '', variant = '', context = {}, options = {}) {
  const {
    typeId = 'angebot_senden',
    intentId = null,
    tone = 'freundlich',
    channel = 'whatsapp',
    dictation = '',
    selectedHints = [],
  } = options;

  if (variant === 'neu' || variant === 'neu_formulieren') {
    return generateCleverAnswerDraft({
      intentId: intentId ?? typeId,
      context,
      tone,
      channel,
      dictation,
      selectedHints,
    });
  }
  if (variant === 'kuerzer' || variant === 'kürzer') return adaptForChannel(text, 'sms');
  if (variant === 'freundlicher') return applyTone(text, 'freundlich');
  if (variant === 'verbindlicher') return applyTone(text, 'verbindlich');
  if (variant === 'lockerer') return applyTone(text, 'locker');
  if (variant === 'mehr_beratung') {
    return `${text.trim()}\n\nGerne gehe ich mit Ihnen in Ruhe durch, welche Variante am besten zu Ihrem Alltag passt.`;
  }
  if (variant === 'preis_hervorheben') {
    const rate = context.board?.primarySelectionGroup?.rateRange ?? context.legacy?.priceLine;
    if (rate) return `${text.trim()}\n\nBesonders interessant: ${rate}.`;
    return text;
  }
  if (variant === 'ahk_erwaehnen') return refineWithHint(text, 'ahk', context);
  if (variant === 'familie_erwaehnen') return refineWithHint(text, 'familie', context);
  return text;
}
