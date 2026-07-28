/**
 * Seller bestätigt Review → Persistenz nur über bestehende Adapter.
 * Kein Blind-Auto-Apply; ausdrücklich nach „Übernehmen“.
 */
import { appendSellerInsightsFromTexts } from '../dealer/sellerInsights.js';
import { getTradeIn, patchTradeIn } from '../customerAkteTradeIn.js';
import {
  createEmptyNeedProfile,
  getNeedProfileFromLead,
  mergeNeedProfileIntoLead,
} from '../consultation/needProfileService.js';
import { SELLER_FACT_CLASS } from './sellerFactTypes.js';
import { postCleverAssistFeedCard } from '../crm/sharedWorkspaceService.js';

function pushUnique(list, item) {
  if (!item) return list;
  if (list.includes(item)) return list;
  return [...list, item];
}

/**
 * Strukturierte Felder aus bestätigten Facts (nach Review).
 * @param {object} lead
 * @param {object[]} facts
 */
export function applyStructuredFactsToLead(lead = {}, facts = []) {
  let next = lead;
  const wish = { ...(next.wish ?? {}) };
  const contact = { ...(next.contact ?? {}) };
  let desiredRate = next.desiredRate ?? wish.desiredRate ?? null;
  let profile = { ...(getNeedProfileFromLead(next) || createEmptyNeedProfile()) };
  let touchedWish = false;
  let touchedContact = false;
  let touchedProfile = false;

  for (const fact of facts) {
    if (!fact || fact.needsConfirmation) continue;
    const field = fact.field;
    const value = fact.value;

    if (field === 'monthlyBudget' && value != null) {
      desiredRate = Number(value);
      wish.desiredRate = desiredRate;
      profile.budget = {
        ...(profile.budget ?? {}),
        maxMonthlyRate: desiredRate,
      };
      touchedWish = true;
      touchedProfile = true;
    }

    if (field === 'annualMileage' && value != null) {
      wish.mileagePerYear = Number(value);
      profile.annualKm = Number(value);
      touchedWish = true;
      touchedProfile = true;
    }

    if ((field === 'termMonths' || field === 'durationMonths') && value != null) {
      const months = typeof value === 'object' ? value.value : value;
      if (months) {
        wish.termMonths = Number(months);
        touchedWish = true;
      }
    }

    if (field === 'phone') {
      const phone = String(fact.label || value || '').trim();
      if (phone) {
        contact.phone = phone;
        touchedContact = true;
      }
    }

    if (field === 'customerName') {
      const name = String(value || fact.label || '').trim();
      if (name && !String(contact.name || next.name || '').trim()) {
        contact.name = name;
        touchedContact = true;
      }
    }

    if (field === 'customerPlace') {
      const place = String(value || fact.label || '').trim();
      if (place) {
        contact.city = place;
        touchedContact = true;
      }
    }

    if (field === 'towHitchRequired' && value) {
      profile.towbar = true;
      profile.priorities = pushUnique(profile.priorities ?? [], 'towing');
      touchedProfile = true;
    }

    if (field === 'colorPreference' && (value || fact.label)) {
      profile.colorPreference = String(value || fact.label).toLowerCase();
      touchedProfile = true;
    }

    if (field === 'vehicleInterest' && value?.modelKey) {
      profile.selectedModelKey = value.modelKey;
      profile.modelHint = value.modelKey;
      touchedProfile = true;
    }

    if (field === 'maritalStatus' || field === 'childrenCount') {
      profile.household = {
        ...(profile.household ?? {}),
        ...(field === 'maritalStatus' ? { maritalStatus: value } : {}),
        ...(field === 'childrenCount' ? { childrenCount: value } : {}),
      };
      touchedProfile = true;
    }

    if (field === 'monthlyNetIncome' && value != null) {
      profile.finance = {
        ...(profile.finance ?? {}),
        monthlyNetIncome: Number(value),
      };
      touchedProfile = true;
    }
  }

  if (touchedWish || desiredRate != null) {
    next = {
      ...next,
      desiredRate: desiredRate ?? next.desiredRate,
      wish: {
        ...wish,
        desiredRate: desiredRate ?? wish.desiredRate,
      },
    };
  }

  if (touchedContact) {
    next = {
      ...next,
      contact: {
        ...(next.contact ?? {}),
        ...contact,
      },
      name: contact.name || next.name,
    };
  }

  if (touchedProfile) {
    next = mergeNeedProfileIntoLead(next, profile);
  }

  return next;
}

/**
 * @param {object} lead
 * @param {object} turn – CleverSellerTurnResult
 * @param {{ sellerId?: string, sellerName?: string, postFeedCard?: boolean }} [options]
 */
export function applyAcceptedSellerTurn(lead = {}, turn = {}, options = {}) {
  const facts = turn.extractedFacts ?? [];
  if (!lead?.id || !facts.length) {
    return { ok: false, lead, acceptedLabels: [] };
  }

  const labels = facts.map((f) => String(f.label ?? '').trim()).filter(Boolean);
  let nextLead = appendSellerInsightsFromTexts(lead, labels, {
    context: 'universal_review',
    sellerId: options.sellerId,
    sellerName: options.sellerName,
  });

  nextLead = applyStructuredFactsToLead(nextLead, facts);

  const tradeInRequested = facts.some((f) => f.factClass === SELLER_FACT_CLASS.TRADE_IN_FACT);
  const existingVehicle = facts.find((f) => f.factClass === SELLER_FACT_CLASS.EXISTING_VEHICLE);
  if (tradeInRequested || existingVehicle) {
    const current = getTradeIn(nextLead);
    const vehicleLabel = existingVehicle?.label
      || (existingVehicle?.value
        ? `${existingVehicle.value.make ?? ''} ${existingVehicle.value.model ?? ''}`.trim()
        : current.vehicle);
    nextLead = {
      ...nextLead,
      crm: {
        ...(nextLead.crm ?? {}),
        tradeIn: patchTradeIn(current, {
          vehicle: vehicleLabel || current.vehicle,
          notes: tradeInRequested
            ? [current.notes, 'Inzahlungnahme gewünscht'].filter(Boolean).join(' · ')
            : current.notes,
        }),
      },
    };
  }

  if (options.postFeedCard !== false) {
    const lines = labels.slice(0, 8);
    const posted = postCleverAssistFeedCard({
      lead: nextLead,
      title: '✨ Clever hat verstanden',
      text: `${lines.join(' · ')}\n\n${labels.length} Angabe${labels.length === 1 ? '' : 'n'} übernommen`,
      visibleToCustomer: false,
    });
    if (posted.message) nextLead = posted.lead;
  }

  return {
    ok: true,
    lead: nextLead,
    acceptedLabels: labels,
  };
}
