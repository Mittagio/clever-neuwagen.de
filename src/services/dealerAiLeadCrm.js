import { PAYMENT_TYPE_LABELS } from './dealerAiParser.js';
import { formatBudgetSummaryForWish } from './dealerAiBudget.js';
import { getMatchVariantLabel } from '../logic/discoveryDisplay.js';

export function mapSuggestedModelToReserved(model, index = 0) {
  const trimLabel = model.primaryMatch ? getMatchVariantLabel(model.primaryMatch) : model.trimLabel ?? null;
  return {
    id: model.id,
    name: model.name,
    modelKey: model.modelKey ?? model.id,
    bodyType: model.bodyType ?? 'suv',
    badge: model.badge ?? null,
    trimLabel,
    priceHint: model.priceHint ?? null,
    reason: model.reason ?? null,
    isPrimary: index === 0,
  };
}

export function formatReservedModelBadge(model, index = 0) {
  if (model?.isPrimary || index === 0) return 'Empfehlung';
  const raw = model?.badge;
  if (!raw) return 'Alternative';
  const labels = {
    'Clever Empfehlung': 'Empfehlung',
    'passt sehr gut': 'Preislich passend',
    'gute Alternative': 'Alternative',
    'beliebte Alternative': 'Alternative',
  };
  return labels[raw] ?? raw;
}

export function formatReservedModelName(name = '') {
  const trimmed = name.trim();
  if (!trimmed) return 'Kia';
  return /^kia\b/i.test(trimmed) ? trimmed.replace(/^kia\s*/i, 'Kia ') : `Kia ${trimmed}`;
}

export const CRM_PIPELINE_STATUS = [
  { id: 'neu', label: 'Neu', leadStatus: 'neu' },
  { id: 'kontakt', label: 'Kontakt aufnehmen', leadStatus: 'inBearbeitung' },
  { id: 'angebot_erstellt', label: 'Angebot erstellt', leadStatus: 'inBearbeitung' },
  { id: 'angebot_gesendet', label: 'Angebot gesendet', leadStatus: 'angebotVersendet' },
  { id: 'nachfassen', label: 'Nachfassen', leadStatus: 'inBearbeitung' },
  { id: 'probefahrt', label: 'Probefahrt', leadStatus: 'probefahrt' },
  { id: 'abschluss', label: 'Abschluss offen', leadStatus: 'bestellung' },
  { id: 'gewonnen', label: 'Gewonnen', leadStatus: 'ausgeliefert' },
  { id: 'verloren', label: 'Verloren', leadStatus: 'verloren' },
];

export const FOLLOW_UP_CHIPS = [
  { id: 'call_today', label: 'Heute anrufen', coachTitle: 'Heute heiß 🔥' },
  { id: 'call_tomorrow', label: 'Morgen anrufen', default: true },
  { id: 'call_3days', label: 'In 3 Tagen' },
  { id: 'send_offer', label: 'Angebot senden' },
  { id: 'test_drive', label: 'Probefahrt anbieten' },
  { id: 'reminder', label: 'Nachfassen planen' },
];

export const OFFER_STATUS_LABELS = {
  draft: 'Angebot steht',
  sent: 'Gesendet',
  opened: 'Geöffnet',
  accepted: 'Angenommen',
  rejected: 'Abgelehnt',
};

export const CALL_OUTCOME_CHIPS = [
  { id: 'not_reached', label: 'Nicht erreicht', statusId: 'nachfassen' },
  { id: 'interested', label: 'Interessiert', statusId: 'kontakt' },
  { id: 'offer_wanted', label: 'Angebot gewünscht', statusId: 'angebot_erstellt' },
  { id: 'test_drive', label: 'Probefahrt', statusId: 'probefahrt' },
  { id: 'too_expensive', label: 'Zu teuer', statusId: 'nachfassen' },
  { id: 'callback', label: 'Rückruf vereinbart', statusId: 'nachfassen' },
  { id: 'won', label: 'Gekauft', statusId: 'gewonnen' },
  { id: 'lost', label: 'Verloren', statusId: 'verloren' },
];

export const CONTACT_CHANNEL_OPTIONS = [
  { id: 'phone', label: 'Telefon' },
  { id: 'email', label: 'E-Mail' },
  { id: 'whatsapp', label: 'WhatsApp' },
];

function startOfDay(date) {
  const d = new Date(date);
  d.setHours(9, 0, 0, 0);
  return d;
}

export function computeFollowUpAt(chipId) {
  const now = new Date();
  switch (chipId) {
    case 'call_today':
      return startOfDay(now).toISOString();
    case 'call_tomorrow': {
      const d = new Date(now);
      d.setDate(d.getDate() + 1);
      return startOfDay(d).toISOString();
    }
    case 'call_3days': {
      const d = new Date(now);
      d.setDate(d.getDate() + 3);
      return startOfDay(d).toISOString();
    }
    case 'send_offer':
    case 'test_drive':
    case 'reminder': {
      const d = new Date(now);
      d.setDate(d.getDate() + 1);
      return startOfDay(d).toISOString();
    }
    default:
      return startOfDay(now).toISOString();
  }
}

export function getDefaultFollowUpChipId() {
  return FOLLOW_UP_CHIPS.find((c) => c.default)?.id ?? 'call_tomorrow';
}

export function buildLeadSubline(fields = {}) {
  const parts = [];
  const vehicle = [fields.brand, fields.model, fields.trimLabel].filter(Boolean).join(' ').trim();
  if (vehicle) parts.push(vehicle);
  const payment = PAYMENT_TYPE_LABELS[fields.paymentType];
  if (payment) parts.push(payment);
  if (fields.paymentType === 'cash' && fields.desiredPrice) {
    parts.push(`ca. ${fields.desiredPrice.toLocaleString('de-DE')} €`);
  } else if (fields.desiredRate) {
    parts.push(`ca. ${fields.desiredRate} €/Monat`);
  }
  return parts.join(' · ') || 'Kundenwunsch erfasst';
}

export function formatHistoryWhen(iso) {
  if (!iso) return '';
  const date = new Date(iso);
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const isTomorrow = date.toDateString() === tomorrow.toDateString();
  const time = date.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
  if (isToday) return `Heute ${time}`;
  if (isTomorrow) return `Morgen ${time}`;
  return date.toLocaleString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function phoneTelHref(phone) {
  if (!phone?.trim()) return null;
  const digits = phone.replace(/[^\d+]/g, '');
  return digits ? `tel:${digits}` : null;
}

export function whatsAppHref(phone) {
  if (!phone?.trim()) return null;
  let digits = phone.replace(/\D/g, '');
  if (digits.startsWith('0')) digits = `49${digits.slice(1)}`;
  return digits ? `https://wa.me/${digits}` : null;
}

export function mailtoHref(email, subject = '') {
  if (!email?.trim()) return null;
  const q = subject ? `?subject=${encodeURIComponent(subject)}` : '';
  return `mailto:${email.trim()}${q}`;
}

export function buildDefaultCrm(parsed, selectedModelIds = null) {
  const chipId = getDefaultFollowUpChipId();
  const chip = FOLLOW_UP_CHIPS.find((c) => c.id === chipId);
  const ids = Array.isArray(selectedModelIds)
    ? selectedModelIds
    : selectedModelIds
      ? [selectedModelIds]
      : [];
  const reserved = (parsed?.suggestedModels ?? [])
    .filter((m) => ids.includes(m.id))
    .map((m, index) => mapSuggestedModelToReserved(m, index));

  return {
    pipelineStatusId: 'neu',
    nextStepId: chipId,
    nextStepLabel: chip?.label ?? 'Morgen anrufen',
    followUpAt: computeFollowUpAt(chipId),
    preferredContact: 'phone',
    company: '',
    contactTimePreference: '',
    reservedModels: reserved,
    offers: [],
  };
}

export function toDatetimeLocalValue(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function buildWishCardSummary(fields = {}) {
  const parts = [];
  const vehicle = [fields.brand, fields.model].filter(Boolean).join(' ').trim();
  if (vehicle) parts.push(vehicle.replace(/^Kia\s+/i, 'Kia '));
  const payment = PAYMENT_TYPE_LABELS[fields.paymentType];
  if (payment && fields.paymentType !== 'unknown') {
    parts.push(payment.replace(' / Barzahlung', '').replace('Kauf / Barzahlung', 'Kauf'));
  }
  const budget = formatBudgetSummaryForWish(fields);
  if (budget) parts.push(budget);
  return parts.join(' · ') || 'Wunsch starten';
}

export function buildCustomerCardSummary(name, phone) {
  const trimmedName = name?.trim();
  const open = !trimmedName || trimmedName === 'Kunde (offen)';
  if (open && !phone?.trim()) return 'Kontakt macht die Chance stärker';
  if (open) return phone.trim();
  if (phone?.trim()) return `${trimmedName} · ${phone.trim()}`;
  return trimmedName;
}

export function buildOfferCardSummary(offers = []) {
  if (!offers.length) return 'Noch kein Angebot';
  if (offers.length > 1) return `${offers.length} Angebote`;
  const offer = offers[0];
  const statusRaw = OFFER_STATUS_LABELS[offer.status] ?? offer.status;
  const status = statusRaw === 'Angebot steht' ? 'Entwurf' : statusRaw;
  const paymentLabel = PAYMENT_TYPE_LABELS[offer.paymentType]
    ?? (typeof offer.paymentType === 'string' ? offer.paymentType : null);
  const payment = paymentLabel?.replace(' / Barzahlung', '') ?? null;
  const vehicle = offer.vehicle ?? offer.name;
  const detail = [vehicle, payment, status].filter(Boolean).join(' · ');
  return detail || '1 Angebot';
}

export function buildOfferCardSubline(offers = []) {
  if (!offers.length) return 'Ein Angebot macht es konkret';
  return null;
}

export function buildOutcomeCardSummary(crm = {}) {
  return crm.lastOutcomeLabel ?? 'Noch kein Ergebnis';
}

export function buildHistoryCardSummary(count = 0) {
  if (count <= 0) return 'Verlauf starten';
  if (count === 1) return '1 Moment';
  return `${count} Momente`;
}

export function buildReservedModelsCardSummary(models = []) {
  if (!models.length) return 'Noch keine Modelle vorgemerkt';
  if (models.length === 1) {
    return formatReservedModelName(models[0].name);
  }
  if (models.length === 2) {
    return models.map((m) => formatReservedModelName(m.name)).join(', ');
  }
  return `${models.length} Modelle vorgemerkt`;
}

export function buildReservedModelsCardSubline(models = []) {
  if (!models.length) return 'Ein Modell bringt die Chance in Fahrt';
  return null;
}

export function buildShortSubline(fields = {}) {
  const vehicle = [fields.brand, fields.model, fields.trimLabel].filter(Boolean).join(' ').trim();
  const payment = PAYMENT_TYPE_LABELS[fields.paymentType];
  const paymentShort = payment
    ? payment.replace(' / Barzahlung', '').replace('Kauf / Barzahlung', 'Kauf')
    : null;
  if (vehicle && paymentShort) return `${vehicle.replace(/^Kia\s+/i, '')} · ${paymentShort}`;
  return vehicle || paymentShort || 'Neu';
}

export function buildLeadHeadSubline(name, options = {}) {
  const { brand = 'Kia', model = '' } = options;
  const trimmed = name?.trim();
  const hasCustomer = trimmed && trimmed !== 'Kunde (offen)';
  const vehicleLabel = model
    ? `${brand} ${model}`.replace(/^Kia\s+Kia/i, 'Kia').trim()
    : brand;

  if (hasCustomer) {
    return `${trimmed} · ${brand}`;
  }
  return vehicleLabel || brand;
}

export function getLeadStatusBadgeLabel(pipelineStatusId) {
  return CRM_PIPELINE_STATUS.find((s) => s.id === pipelineStatusId)?.label ?? 'Neu';
}

export function pipelineToLeadStatus(pipelineStatusId) {
  return CRM_PIPELINE_STATUS.find((s) => s.id === pipelineStatusId)?.leadStatus ?? 'neu';
}
