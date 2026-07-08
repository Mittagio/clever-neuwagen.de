/**
 * Spracheingabe → Chips, Kunde, Kilometer für Gesprächsmodus
 */
import { matchFeaturesFromText } from '../wish/wishParser.js';
import { ALL_SALES_ADVISOR_CHIPS } from '../../data/salesAdvisorChips.js';

const FEATURE_TO_CHIP = {
  heated_seats: 'heated_seats',
  towbar: 'towbar',
  camera_360: 'camera_360',
  rear_camera: 'rear_camera',
  parking_front: 'parking_front',
  parking_rear: 'parking_rear',
  blind_spot: 'blind_spot',
  heat_pump: 'heat_pump',
  panorama_roof: 'panorama_roof',
  power_tailgate: 'power_tailgate',
  harman_kardon: 'harman_kardon',
  steering_heat: 'steering_heat',
  ventilated_seats: 'ventilated_seats',
  range_400: 'range_400',
  family_suv: 'type_suv',
  large_trunk: 'large_trunk',
  seats_7: 'type_familie',
  elektro: 'fuel_elektro',
  benzin: 'fuel_benzin',
};

function extractCustomerName(text) {
  const patterns = [
    /(?:herr|frau)\s+([A-ZÄÖÜ][a-zäöüß]+)/i,
    /([A-ZÄÖÜ][a-zäöüß]+)\s+sucht/i,
    /kunde\s+(?:heißt\s+)?(?:herr|frau)?\s*([A-ZÄÖÜ][a-zäöüß]+)/i,
  ];
  for (const re of patterns) {
    const m = text.match(re);
    if (m?.[1]) {
      const raw = m[1];
      const prefix = /frau/i.test(text.slice(0, m.index + 20)) ? 'Frau' : 'Herr';
      return `${prefix} ${raw}`;
    }
  }
  return null;
}

function extractBudget(text) {
  const m = text.match(/(?:maximal|bis|höchstens|max\.?)\s*(\d{2,3})\s*(?:€|euro)/i)
    ?? text.match(/(\d{2,3})\s*(?:€|euro)\s*(?:pro\s*monat|\/monat|monatlich)/i);
  if (!m) return null;
  const val = Number(m[1]);
  if (val <= 250) return 'budget_250';
  if (val <= 300) return 'budget_300';
  if (val <= 400) return 'budget_400';
  if (val <= 500) return 'budget_500';
  return 'budget_600';
}

function extractMileage(text) {
  const dotted = text.match(/(\d{1,2})\s*\.\s*000\s*(?:km|kilometer)/i);
  if (dotted) {
    const val = Number(dotted[1]) * 1000;
    if (val <= 10000) return { chipId: 'km_10000', value: 10000 };
    if (val <= 15000) return { chipId: 'km_15000', value: 15000 };
    if (val <= 20000) return { chipId: 'km_20000', value: 20000 };
    if (val <= 25000) return { chipId: 'km_25000', value: 25000 };
    return { chipId: 'km_30000', value: 30000 };
  }

  const m = text.match(/(\d{4,5})\s*(?:km|kilometer)/i);
  if (!m) return null;
  const val = Number(m[1]);
  if (val <= 10000) return { chipId: 'km_10000', value: 10000 };
  if (val <= 15000) return { chipId: 'km_15000', value: 15000 };
  if (val <= 20000) return { chipId: 'km_20000', value: 20000 };
  if (val <= 25000) return { chipId: 'km_25000', value: 25000 };
  return { chipId: 'km_30000', value: 30000 };
}

function extractBodyType(text) {
  const lower = text.toLowerCase();
  if (/suv|geländewagen/i.test(lower)) return 'type_suv';
  if (/kombi/i.test(lower)) return 'type_kombi';
  if (/limousine|limo/i.test(lower)) return 'type_limousine';
  if (/kleinwagen|city/i.test(lower)) return 'type_kleinwagen';
  if (/van|bus|multivan/i.test(lower)) return 'type_van';
  if (/familien/i.test(lower)) return 'type_familie';
  return null;
}

function extractPowertrain(text) {
  const lower = text.toLowerCase();
  if (/elektro|e-auto|ev\b|stromer/i.test(lower)) return 'fuel_elektro';
  if (/plug.?in|phev/i.test(lower)) return 'fuel_phev';
  if (/diesel/i.test(lower)) return 'fuel_diesel';
  if (/hybrid/i.test(lower) && !/plug/i.test(lower)) return 'fuel_hybrid';
  if (/benzin|verbrenner/i.test(lower)) return 'fuel_benzin';
  return null;
}

function extractDaily(text) {
  const ids = [];
  if (/familie|kinder/i.test(text)) ids.push('daily_family');
  if (/hund/i.test(text)) ids.push('dog');
  if (/sofort|lager/i.test(text)) ids.push('avail_sofort');
  if (/stadtverkehr|pendeln/i.test(text)) ids.push('daily_city');
  if (/lange\s*strecke|autobahn/i.test(text)) ids.push('daily_long');
  if (/gewerbe|einzelunternehmen|gewerbliches/i.test(text)) ids.push('daily_gewerbe');
  return ids;
}

function extractModelHints(text) {
  const ids = [];
  const lower = text.toLowerCase();
  if (/sportage/i.test(lower)) {
    ids.push('type_suv');
    if (!/elektro|e-auto|\bev\d/i.test(lower)) ids.push('fuel_hybrid');
  }
  if (/\bev[23459]\b/i.test(lower) || /ev6/i.test(lower)) ids.push('fuel_elektro');
  return ids;
}

export function parseConversationSpeech(transcript = '') {
  const text = transcript.trim();
  if (!text) return { chipIds: [], customerName: null, mileagePerYear: null, transcript: text };

  const chipIds = new Set();
  const customerName = extractCustomerName(text);

  const budget = extractBudget(text);
  if (budget) chipIds.add(budget);

  const mileage = extractMileage(text);
  if (mileage) chipIds.add(mileage.chipId);

  const body = extractBodyType(text);
  if (body) chipIds.add(body);

  const fuel = extractPowertrain(text);
  if (fuel) chipIds.add(fuel);

  extractDaily(text).forEach((id) => chipIds.add(id));
  extractModelHints(text).forEach((id) => chipIds.add(id));

  const features = matchFeaturesFromText(text);
  for (const fid of features) {
    const chipId = FEATURE_TO_CHIP[fid];
    if (chipId) chipIds.add(chipId);
  }

  if (/anhänger|kupplung|ahk/i.test(text)) chipIds.add('towbar');
  if (/sitzheizung/i.test(text)) chipIds.add('heated_seats');

  return {
    chipIds: [...chipIds],
    customerName,
    mileagePerYear: mileage?.value ?? null,
    transcript: text,
  };
}

export function mergeChipIds(existing = [], incoming = []) {
  return [...new Set([...existing, ...incoming])];
}

export function isSpeechRecognitionSupported() {
  return typeof window !== 'undefined'
    && !!(window.SpeechRecognition || window.webkitSpeechRecognition);
}

/** Web Speech API liefert englische error-Codes – für Verkäufer verständlich machen */
export function mapSpeechRecognitionError(code) {
  const messages = {
    network: 'Spracheingabe braucht Internet (Chrome nutzt Google-Server). Bitte Chips nutzen oder Gespräch eintippen.',
    'not-allowed': 'Mikrofon-Zugriff verweigert. Bitte in den Browser-Einstellungen erlauben.',
    'service-not-allowed': 'Spracheingabe ist hier nicht erlaubt (HTTPS oder Firmen-Netz). Bitte eintippen oder Chips nutzen.',
    'audio-capture': 'Kein Mikrofon gefunden. Bitte Headset prüfen oder eintippen.',
    'no-speech': 'Nichts gehört – bitte nochmal sprechen oder eintippen.',
    aborted: 'Aufnahme abgebrochen.',
  };
  return messages[code] ?? `Spracheingabe fehlgeschlagen (${code}). Bitte eintippen oder Chips nutzen.`;
}

export function startSpeechRecognition({
  onResult,
  onError,
  onEnd,
  interim = true,
  continuous = false,
}) {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) {
    onError?.('Spracheingabe wird in diesem Browser nicht unterstützt.');
    return null;
  }
  const recognition = new SR();
  recognition.lang = 'de-DE';
  recognition.interimResults = interim;
  recognition.maxAlternatives = 1;
  recognition.continuous = continuous;
  recognition.onresult = (event) => {
    let finalText = '';
    let interimText = '';
    for (let i = event.resultIndex; i < event.results.length; i += 1) {
      const part = event.results[i][0]?.transcript ?? '';
      if (event.results[i].isFinal) finalText += part;
      else interimText += part;
    }
    onResult?.({ finalText: finalText.trim(), interimText: interimText.trim(), raw: event });
  };
  recognition.onerror = (e) => onError?.(mapSpeechRecognitionError(e.error ?? 'unknown'));
  recognition.onend = () => onEnd?.();
  recognition.start();
  return recognition;
}
