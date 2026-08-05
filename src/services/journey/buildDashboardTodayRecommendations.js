/**
 * Dashboard „Clever empfiehlt heute“ – echte Arbeit priorisieren,
 * kein Abschluss-% / Sterne-Scoring. Ein Kunde nur einmal.
 */
import { getTodayOverview } from '../cleverSeller/getTodayOverview.js';
import { buildCleverEmpfiehltView } from '../crm/cleverRecommendationPresenter.js';
import { buildVehicleOpportunityCards } from '../customerAkte.js';
import { resolveOfferSelectionGroups } from '../sales/offerSelectionGroup.js';

const CTA_BY_ACTION = {
  offer_send: 'Angebot prüfen und senden',
  offer_created_send: 'Angebot prüfen und senden',
  offer_opened_call: 'Heute anrufen',
  offer_followup: 'Heute nachfassen',
  documents_missing: 'Unterlagen anfordern',
  documents_inbox_check: 'Unterlagen prüfen',
  offer_question_answer: 'Kundenfrage beantworten',
  prepare_succession_offer: 'Nachfolgeangebot vorbereiten',
  portal_link_send: 'Kundenlink senden',
  leasing_ready: 'Leasingantrag starten',
  delivery_ready: 'Übergabe planen',
};

function normalizeText(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9@.+]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizePhone(value) {
  const digits = String(value ?? '').replace(/\D+/g, '');
  if (digits.length >= 10 && digits.startsWith('49')) return digits.slice(2);
  if (digits.length >= 10 && digits.startsWith('0')) return digits.slice(1);
  return digits;
}

/** Alle Identitäts-Schlüssel eines Kunden (E-Mail, Telefon, Name). */
export function customerDedupeKeys(lead = {}, fallbackName = '') {
  const email = normalizeText(lead?.contact?.email || lead?.email);
  const phone = normalizePhone(lead?.contact?.phone || lead?.phone);
  const name = normalizeText(lead?.contact?.name || lead?.name || fallbackName);
  const keys = [];
  if (email) keys.push(`e:${email}`);
  if (phone && phone.length >= 8) keys.push(`p:${phone}`);
  if (name) keys.push(`n:${name}`);
  if (!keys.length && lead?.id) keys.push(`id:${lead.id}`);
  if (!keys.length) keys.push(`n:${fallbackName || 'kunde'}`);
  return keys;
}

/** Primärschlüssel für einfache Vergleiche (Telefon > E-Mail > Name). */
export function customerDedupeKey(lead = {}, fallbackName = '') {
  const keys = customerDedupeKeys(lead, fallbackName);
  const phone = keys.find((k) => k.startsWith('p:'));
  if (phone) return phone;
  return keys[0];
}

function resolveCtaLabel(item = {}, view = null) {
  if (item.primaryCtaLabel) return item.primaryCtaLabel;
  if (view?.ctaLabel) return view.ctaLabel;
  const actionId = item.actionId || view?.actionId;
  if (actionId && CTA_BY_ACTION[actionId]) return CTA_BY_ACTION[actionId];
  if (view?.headline) return view.headline;
  if (item.headline && !/^offener vorgang$/i.test(item.headline)) return item.headline;
  return 'Öffnen und erledigen';
}

function workSortRank(item = {}) {
  if (item.overdue) return 0;
  if (item.dueToday || item.hasAppointmentToday) return 1;
  if (item.hasCustomerReaction) return 2;
  if (item.openSellerAction) return 3;
  return 5;
}

/**
 * @param {object[]} leads
 * @param {{ now?: Date, maxItems?: number }} [options]
 */
export function buildDashboardTodayRecommendations(leads = [], options = {}) {
  const maxItems = options.maxItems ?? 10;
  const overview = getTodayOverview(leads, { ...options, maxItems: Math.max(40, maxItems * 3) });
  const leadById = new Map((leads || []).filter((l) => l?.id).map((l) => [l.id, l]));
  const byGroup = new Map();
  const keyToGroup = new Map();

  for (const item of overview.items || []) {
    const lead = leadById.get(item.leadId) || null;
    const keys = customerDedupeKeys(lead, item.customerName);
    let groupId = keys.map((k) => keyToGroup.get(k)).find(Boolean);
    if (!groupId) {
      groupId = item.leadId || keys[0];
      byGroup.set(groupId, {
        ...item,
        reasons: [...(item.reasons || [])],
        _rank: workSortRank(item),
      });
    } else {
      const existing = byGroup.get(groupId);
      existing.reasons = [...new Set([
        ...existing.reasons,
        ...(item.reasons || []),
      ])].filter(Boolean).slice(0, 4);
      existing.overdue = existing.overdue || item.overdue;
      existing.dueToday = existing.dueToday || item.dueToday;
      existing.hasAppointmentToday = existing.hasAppointmentToday || item.hasAppointmentToday;
      existing.hasCustomerReaction = existing.hasCustomerReaction || item.hasCustomerReaction;
      existing.openSellerAction = existing.openSellerAction || item.openSellerAction;
      const nextRank = workSortRank(item);
      if (nextRank < existing._rank) {
        existing._rank = nextRank;
        existing.leadId = item.leadId;
        existing.headline = item.headline || existing.headline;
        existing.detail = item.detail || existing.detail;
        existing.actionId = item.actionId || existing.actionId;
        existing.primaryCtaLabel = item.primaryCtaLabel || existing.primaryCtaLabel;
        existing.composerAction = item.composerAction || existing.composerAction;
        existing.customerName = item.customerName || existing.customerName;
      }
    }
    for (const key of keys) keyToGroup.set(key, groupId);
  }

  return [...byGroup.values()]
    .sort((a, b) => {
      if (a._rank !== b._rank) return a._rank - b._rank;
      return String(a.customerName || '').localeCompare(String(b.customerName || ''), 'de');
    })
    .slice(0, maxItems)
    .map((item) => {
      const lead = leadById.get(item.leadId) || null;
      let view = null;
      if (lead) {
        try {
          view = buildCleverEmpfiehltView({
            lead,
            vehicleCards: buildVehicleOpportunityCards({ lead }),
            offerSelectionGroups: resolveOfferSelectionGroups({ lead }),
            customerName: item.customerName,
          });
        } catch {
          view = null;
        }
      }

      const reasons = [...new Set([
        ...(item.reasons || []),
        ...(view?.whyBullets || []).map((b) => b.text),
        view?.whySummary,
        view?.subline,
        item.detail,
      ].filter(Boolean))].slice(0, 3);

      const ctaLabel = resolveCtaLabel(item, view);
      const whySummary = reasons.join(' · ');

      return {
        leadId: item.leadId,
        customerName: item.customerName || 'Kunde',
        headline: view?.headline || item.headline || ctaLabel,
        whySummary,
        reasons,
        ctaLabel,
        actionId: item.actionId || view?.actionId || null,
        dueTodayBadge: item.overdue
          ? 'überfällig'
          : (item.dueToday || item.hasAppointmentToday ? 'fällig heute' : null),
        overdue: Boolean(item.overdue),
        dueToday: Boolean(item.dueToday),
      };
    });
}

/**
 * Dedupliziert eine bereits gebaute Empfehlungsliste nach Kundenidentität.
 * @param {Array<{ leadId?: string, customerName?: string, closureChance?: number, priority?: number }>} items
 * @param {object[]} [leads]
 */
export function dedupeRecommendationsByCustomer(items = [], leads = []) {
  const leadById = new Map((leads || []).filter((l) => l?.id).map((l) => [l.id, l]));
  const byGroup = new Map();
  const keyToGroup = new Map();

  for (const item of items) {
    const lead = leadById.get(item.leadId) || null;
    const keys = customerDedupeKeys(lead, item.customerName);
    let groupId = keys.map((k) => keyToGroup.get(k)).find(Boolean);
    if (!groupId) {
      groupId = item.leadId || keys[0];
      byGroup.set(groupId, { ...item });
    } else {
      const existing = byGroup.get(groupId);
      const existingPriority = existing.priority ?? 99;
      const nextPriority = item.priority ?? 99;
      if (nextPriority < existingPriority) {
        byGroup.set(groupId, {
          ...item,
          whySummary: [item.whySummary, existing.whySummary].filter(Boolean).join(' · '),
        });
      } else if (item.whySummary && existing.whySummary && item.whySummary !== existing.whySummary) {
        existing.whySummary = [existing.whySummary, item.whySummary].filter(Boolean).join(' · ');
      }
    }
    for (const key of keys) keyToGroup.set(key, groupId);
  }

  return [...byGroup.values()];
}
