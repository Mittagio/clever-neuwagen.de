/**
 * Clever Diktat – Spracheingabe → sauberer Kundentext (regelbasiert)
 */
import {
  buildCleverGreeting,
  generateCleverAntwortText,
  refineCleverAntwortText,
} from './cleverAntworten.js';

export const DIKTAT_TONES = [
  { id: 'kurz', label: 'Kurz' },
  { id: 'freundlich', label: 'Freundlich' },
  { id: 'verbindlich', label: 'Verbindlich' },
  { id: 'locker', label: 'Locker' },
  { id: 'professionell', label: 'Professionell' },
  { id: 'nachfassen', label: 'Nachfassen' },
  { id: 'abschluss', label: 'Abschlussorientiert' },
];

export const DIKTAT_CHANNELS = [
  { id: 'whatsapp', label: 'WhatsApp' },
  { id: 'email', label: 'E-Mail' },
  { id: 'sms', label: 'SMS / Kurz' },
];

export const CLEVER_DIKTAT_HISTORY = {
  created: 'Clever Diktat erstellt',
  copied: 'Nachfass-Text kopiert',
  whatsapp: 'Antwort per WhatsApp vorbereitet',
  email: 'Antwort per E-Mail vorbereitet',
  note_saved: 'Nachricht als Notiz gespeichert',
  refined: 'Diktat-Text neu formuliert',
};

const MODEL_ALIASES = [
  { keys: ['ev3', 'ev 3'], label: 'EV3' },
  { keys: ['ev2', 'ev 2'], label: 'EV2' },
  { keys: ['ev4', 'ev 4'], label: 'EV4' },
  { keys: ['sportage'], label: 'Sportage' },
  { keys: ['xceed', 'xc ed'], label: 'XCeed' },
  { keys: ['ceed'], label: 'Ceed' },
  { keys: ['picanto'], label: 'Picanto' },
  { keys: ['niro'], label: 'Niro' },
  { keys: ['sorento'], label: 'Sorento' },
];

const INTENT_RULES = [
  { id: 'unterlagen', score: 10, patterns: [/selbstauskunft/i, /unterlagen/i, /hochladen/i, /link.*unterlagen/i] },
  { id: 'nachfassen', score: 9, patterns: [/geöffnet/i, /angeschaut/i, /reingeschaut/i, /nachfass/i, /passt.*(oder|anpass)/i] },
  { id: 'angebot_angepasst', score: 8, patterns: [/angepasst/i, /neue variante/i, /aktualisiert/i] },
  { id: 'rueckfrage', score: 7, patterns: [/frag.*(ihn|sie|ob)/i, /rückfrage/i, /leasing.*kauf/i, /kauf.*leasing/i, /kilometer|km pro jahr/i, /reichen/i] },
  { id: 'angebot_senden', score: 6, patterns: [/angebot.*(schick|send|kommt)/i, /schick.*angebot/i, /heute nachmittag/i] },
  { id: 'probefahrt', score: 5, patterns: [/probefahrt/i, /probe fahrt/i] },
  { id: 'termin', score: 5, patterns: [/termin/i, /treffen/i, /vormittag|nachmittag/i] },
  { id: 'nicht_erreicht', score: 5, patterns: [/nicht erreicht/i, /nicht rangekommen/i] },
  { id: 'danke', score: 3, patterns: [/danke.*anfrage/i, /melde mich/i] },
];

export function supportsBrowserSpeechRecognition() {
  if (typeof window === 'undefined') return false;
  return Boolean(window.SpeechRecognition || window.webkitSpeechRecognition);
}

export function createDiktatSpeechRecognizer({
  lang = 'de-DE',
  onInterim = () => {},
  onFinal = () => {},
  onError = () => {},
  onEnd = () => {},
} = {}) {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) return null;

  const recognition = new SR();
  recognition.lang = lang;
  recognition.continuous = true;
  recognition.interimResults = true;

  let finalTranscript = '';

  recognition.onresult = (event) => {
    let interim = '';
    for (let i = event.resultIndex; i < event.results.length; i += 1) {
      const part = event.results[i][0]?.transcript ?? '';
      if (event.results[i].isFinal) {
        finalTranscript = `${finalTranscript} ${part}`.trim();
        onFinal(finalTranscript);
      } else {
        interim = `${interim} ${part}`.trim();
      }
    }
    onInterim(interim || finalTranscript);
  };

  recognition.onerror = (event) => {
    onError(event.error ?? 'speech_error');
  };

  recognition.onend = () => {
    onEnd(finalTranscript);
  };

  return {
    start: () => {
      finalTranscript = '';
      recognition.start();
    },
    stop: () => recognition.stop(),
    abort: () => recognition.abort(),
    getTranscript: () => finalTranscript,
  };
}

export function formatDiktatDuration(seconds = 0) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function detectDiktatIntent(transcript = '', context = {}) {
  const t = transcript.toLowerCase();

  if (/geöffnet|angeschaut|reingeschaut/i.test(t) && /nachfrag|passt|anpass/i.test(t)) {
    return 'nachfassen';
  }
  if (/selbstauskunft|unterlagen/i.test(t)) return 'unterlagen';
  if (/leasing|kauf|finanzierung/i.test(t) && /frag|reichen|kilometer|km/i.test(t)) return 'rueckfrage';

  let best = { id: 'frei', score: 0 };

  for (const rule of INTENT_RULES) {
    let score = 0;
    for (const pattern of rule.patterns) {
      if (pattern.test(transcript)) score += rule.score;
    }
    if (score > best.score) best = { id: rule.id, score };
  }

  if (context.offerOpened && /geöffnet|angeschaut|passt/i.test(t)) {
    return 'nachfassen';
  }
  if (/selbstauskunft|unterlagen/i.test(t)) return 'unterlagen';
  if (/leasing|kauf|kilometer|km|reichen|frag/i.test(t)) return 'rueckfrage';

  return best.id;
}

function capitalizeWord(word = '') {
  if (!word) return '';
  return word.charAt(0).toUpperCase() + word.slice(1);
}

export function extractMentionedModels(transcript = '') {
  const t = transcript.toLowerCase();
  const found = [];
  for (const entry of MODEL_ALIASES) {
    if (entry.keys.some((k) => t.includes(k)) && !found.includes(entry.label)) {
      found.push(entry.label);
    }
  }
  return found;
}

function extractRateEuro(transcript = '') {
  const m = transcript.match(/(\d{2,4})\s*(?:euro|€)/i);
  return m ? Number(m[1]) : null;
}

function extractKmFromTranscript(transcript = '') {
  const m10 = transcript.match(/10\.?\s*000\s*(?:km|kilometer)/i);
  if (m10) return '10.000';
  const m15 = transcript.match(/15\.?\s*000\s*(?:km|kilometer)/i);
  if (m15) return '15.000';
  const generic = transcript.match(/(\d{1,2})\.?\s*000\s*(?:km|kilometer)/i);
  if (generic) return `${generic[1]}.000`;
  return null;
}

function buildClosingLines(context = {}, channel = 'whatsapp') {
  const seller = context.sellerName?.trim();
  if (channel === 'whatsapp' || channel === 'sms') {
    if (seller && seller !== 'Ihr Verkaufsteam') return `\n\nViele Grüße\n${seller}`;
    return '\n\nViele Grüße';
  }
  if (seller && seller !== 'Ihr Verkaufsteam') {
    return `\n\nViele Grüße\n${seller}`;
  }
  return '\n\nViele Grüße';
}

function buildRueckfrageFromDiktat(transcript, context) {
  const t = transcript.toLowerCase();
  const questions = [];

  if (/leasing|kauf|finanzierung/i.test(t)) {
    if (/leasing.*kauf|kauf.*leasing/i.test(t)) {
      questions.push('Soll es eher Leasing oder Kauf werden?');
    } else if (/leasing/i.test(t)) {
      questions.push('Soll es Leasing werden oder bevorzugen Sie eine andere Finanzierung?');
    } else if (/kauf/i.test(t)) {
      questions.push('Soll es ein Kauf sein oder bevorzugen Sie Leasing/Finanzierung?');
    }
  }

  const km = extractKmFromTranscript(transcript);
  if (km && /reichen|kilometer|km/i.test(t)) {
    questions.push(`Und reichen Ihnen ${km} km pro Jahr aus?`);
  } else if (/kilometer|km/i.test(t)) {
    questions.push('Welche Kilometerlaufleistung pro Jahr soll ich zugrunde legen?');
  }

  if (/48\s*monat/i.test(t)) {
    questions.push('Soll ich mit 48 Monaten Laufzeit rechnen?');
  }

  if (!questions.length) return null;

  return [
    buildCleverGreeting(context.customerName, context.salutation),
    '',
    'damit ich Ihnen direkt das passende Angebot vorbereiten kann:',
    '',
    ...questions.map((q) => q),
    buildClosingLines(context, 'email'),
  ].join('\n').trim();
}

function buildCustomDiktatParagraphs(transcript, context) {
  const t = transcript.toLowerCase();
  const extras = [];

  const rate = extractRateEuro(transcript);
  const models = extractMentionedModels(transcript);
  const primaryModel = context.vehicleTitle?.replace(/^Kia\s+/i, '') ?? models[0];

  if (/schwierig|wird eng|zu teuer/i.test(t) && (rate || primaryModel)) {
    const modelName = models[0] ?? primaryModel ?? 'Wunschmodell';
    if (rate) {
      extras.push(`Beim ${modelName} bei ${rate.toLocaleString('de-DE')} € monatlich wird es etwas eng – ich prüfe gerade passende Alternativen für Sie.`);
    } else {
      extras.push(`Beim ${modelName} wird es in der gewünschten Kondition etwas schwierig – ich prüfe gerade passende Alternativen für Sie.`);
    }
  }

  const alts = models.filter((m) => !String(primaryModel ?? '').toLowerCase().includes(m.toLowerCase()));
  if (alts.length >= 1 && /prüf|alternative|schau/i.test(t)) {
    const list = alts.length === 1 ? alts[0] : `${alts.slice(0, -1).join(', ')} und ${alts[alts.length - 1]}`;
    extras.push(`Parallel schaue ich mir ${list} als Alternative an.`);
  }

  if (/heute.*nachmittag|nachmittag.*angebot|angebot.*nachmittag/i.test(t)) {
    extras.push('Das Angebot sende ich Ihnen heute Nachmittag zu.');
  }

  if (/48\s*monat/i.test(t) && !/frag|reichen|leasing/i.test(t)) {
    extras.push('Gerne rechne ich auch mit 48 Monaten Laufzeit.');
  }

  return extras;
}

function injectExtras(text, extras = []) {
  if (!extras.length) return text;
  const marker = '\n\nViele Grüße';
  const idx = text.indexOf(marker);
  if (idx > 0) {
    return `${text.slice(0, idx).trim()}\n\n${extras.join('\n\n')}${text.slice(idx)}`;
  }
  return `${text.trim()}\n\n${extras.join('\n\n')}`;
}

function applyChannelFormat(text, channel = 'whatsapp', context = {}) {
  if (channel === 'sms') {
    const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
    const greeting = lines[0] ?? '';
    const body = lines.slice(1).filter((l) => !l.startsWith('Viele Grüße')).join(' ');
    const short = body.length > 140 ? `${body.slice(0, 137).trim()}…` : body;
    return `${greeting} ${short}`.trim();
  }

  if (channel === 'whatsapp') {
    return text
      .replace(/\n{3,}/g, '\n\n')
      .replace(/ich habe Ihnen/g, 'ich hab dir')
      .replace(/Ihnen direkt/g, 'dir direkt')
      .replace(/Sie können/g, 'Du kannst')
      .replace(/\bIhnen\b/g, 'dir')
      .replace(/\bIhre\b/g, 'deine')
      .replace(/\bIhr\b/g, 'dein')
      .replace(/\bSie\b/g, 'du');
  }

  if (channel === 'email') {
    const greeting = buildCleverGreeting(context.customerName, context.salutation);
    const bodyStart = text.indexOf('\n\n');
    const body = bodyStart > 0 ? text.slice(bodyStart).trim() : text;
    const withoutGreeting = body.replace(/^Guten Tag,|^Hallo[^,]*,/m, '').trim();
    return `${greeting}\n\n${withoutGreeting}`.trim();
  }

  return text;
}

function applyToneFormat(text, tone = 'freundlich', context = {}, intent = 'frei') {
  const map = {
    kurz: 'kuerzer',
    freundlich: 'freundlicher',
    verbindlich: 'verbindlicher',
    locker: 'lockerer',
  };

  if (map[tone]) {
    return refineCleverAntwortText(text, map[tone], context, intent);
  }

  if (tone === 'professionell') {
    return text
      .replace(/gerne /gi, '')
      .replace(/kurz /gi, '')
      .replace(/!+/g, '.');
  }

  if (tone === 'nachfassen') {
    if (!/nachfragen|angeschaut|gekommen/i.test(text)) {
      return `${text.replace(/\n\nViele Grüße[\s\S]*$/, '')}\n\nIch freue mich auf Ihre Rückmeldung.${buildClosingLines(context, 'email')}`.trim();
    }
  }

  if (tone === 'abschluss') {
    return `${text.replace(/\n\nViele Grüße[\s\S]*$/, '')}\n\nWenn alles passt, bereite ich gerne die nächsten Schritte zum Abschluss vor.${buildClosingLines(context, 'email')}`.trim();
  }

  return text;
}

export function generateCleverDiktatText(
  transcript = '',
  context = {},
  { tone = 'freundlich', channel = 'whatsapp' } = {},
) {
  const raw = String(transcript).trim();
  if (!raw) {
    return generateCleverAntwortText('frei', context);
  }

  const intent = detectDiktatIntent(raw, context);
  let text;

  const customRueckfrage = intent === 'rueckfrage' ? buildRueckfrageFromDiktat(raw, context) : null;
  if (customRueckfrage) {
    text = customRueckfrage;
  } else if (intent === 'unterlagen' && context.unterlagenUrl) {
    text = [
      buildCleverGreeting(context.customerName, context.salutation),
      '',
      'wenn das Angebot für Sie passt, können Sie die Selbstauskunft und die Unterlagen bequem über diesen Link ausfüllen und hochladen:',
      '',
      context.unterlagenUrl,
      '',
      'Danach kann ich alles für die weitere Bearbeitung vorbereiten.',
      buildClosingLines(context, channel),
    ].join('\n').trim();
  } else {
    text = generateCleverAntwortText(intent, context);
    const extras = buildCustomDiktatParagraphs(raw, context);
    text = injectExtras(text, extras);
  }

  text = applyToneFormat(text, tone, context, intent);
  text = applyChannelFormat(text, channel, context);

  if (tone === 'kurz' || channel === 'sms') {
    text = refineCleverAntwortText(text, 'kuerzer', context, intent);
  }

  return text.trim();
}

export function refineCleverDiktatText(text, variant, transcript, context, options = {}) {
  if (variant === 'neu' || variant === 'neu_formulieren') {
    return generateCleverDiktatText(transcript, context, options);
  }
  const intent = detectDiktatIntent(transcript, context);
  return refineCleverAntwortText(text, variant, context, intent);
}
