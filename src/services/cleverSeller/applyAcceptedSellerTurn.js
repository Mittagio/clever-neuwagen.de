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
import { SELLER_FACT_CLASS, SELLER_FACT_SOURCE, SELLER_TURN_INTENTS } from './sellerFactTypes.js';
import { postCleverAssistFeedCard, sendSellerWorkspacePackage } from '../crm/sharedWorkspaceService.js';
import {
  appointmentTypeLabel,
  applyAppointmentCrmPatch,
  buildCrmPatchFromAppointment,
} from '../dealer/sellerAppointmentAssistFlow.js';
import { mapSellerFactsToTrackFeedback } from './mapSellerFactsToTrackFeedback.js';
import {
  applyTrackFeedbackFacts,
  ensureMultiVehicleInterestTracksOnLead,
  focusVehicleInterestOnLead,
  listCustomerVehicleTracks,
  patchVehicleTrackOnLead,
  sortTracksForOverview,
  VEHICLE_TRACK_STATUS,
} from '../crm/vehicleTrack.js';
import { applyHomepageInquiryToLead } from '../crm/homepageCommercialInquiry.js';
import { answerDeliveryTimeOnLead } from '../crm/deliveryTimeQuestion.js';
import { applyScenarioOfferFeedbackFacts } from '../crm/scenarioOfferFeedback.js';
import { persistConfirmedCustomerContract } from '../crm/customerContracts.js';
import { buildInboundLeadDraft } from './inboundLeadIntake.js';
import { isPrepareSuccessionOfferCue } from './prepareSuccessionOfferFromLead.js';
import { applyConfirmedMultiSourceIntakePlan } from './multiSource/applyConfirmedMultiSourceIntakePlan.js';
import { mergeOfferCommercialIntoWish } from '../sales/wishConditionsSync.js';
import {
  buildContactPayloadFromIdentity,
  deriveContactIdentity,
} from '../dealer/customerContactIdentity.js';
import { ensureConceptOfferDraftFromCapture } from './ensureConceptOfferDraftFromCapture.js';
import {
  classifySnapshotNoteLabel,
  isSnapshotContactIdentityLabel,
  isSnapshotSystemNoiseLabel,
} from '../dealer/buildCustomerSnapshotModel.js';
import {
  isPlaceholderCustomerName,
  isPlausibleCustomerName,
  sanitizeCustomerNameCandidate,
} from './resolveAssistantContext.js';
import { normalizeFactDisplayLabel } from './normalizeFactDisplayLabel.js';
import {
  upsertOfferDraftOnLead,
  upsertMessageDraftOnLead,
  ensureOfferDraftBundleFromPayload,
} from './cleverWorkingDraft.js';
import {
  normalizeBatchModelKey,
  setRecentVehicleTracksOnLead,
  ensureTracksForBatchModelKeys,
} from './batchOfferTrackScope.js';

/** Kontakt-/Identity-Felder → Header, nicht Soft-Insights. */
const INSIGHT_SKIP_FIELDS = new Set([
  'customerName',
  'email',
  'phone',
  'mobile',
  'salutation',
  'firstName',
  'lastName',
  // Modell/Spur → Track/Header, nicht Soft-Chip
  'vehicleInterest',
  'vehicleInterestMulti',
]);

function scoreCustomerNameCandidate(name = '') {
  const text = String(name || '').trim();
  if (!text || isPlaceholderCustomerName(text)) return -1;
  if (!isPlausibleCustomerName(text)) return -1;
  const parts = text.replace(/^(?:herr|frau|hr\.|fr\.|familie)\s+/i, '').trim().split(/\s+/).filter(Boolean);
  return parts.length * 10 + Math.min(text.length, 40);
}

function pickBestCustomerName(facts = [], inboundContact = null) {
  const candidates = [];
  if (inboundContact?.fullName) candidates.push(String(inboundContact.fullName).trim());
  if (inboundContact?.firstName || inboundContact?.lastName) {
    candidates.push(
      [inboundContact.firstName, inboundContact.lastName].filter(Boolean).join(' ').trim(),
    );
  }
  for (const fact of facts) {
    if (fact?.field !== 'customerName') continue;
    const name = String(fact.value || fact.label || '').trim();
    if (name) candidates.push(name);
  }
  let best = '';
  let bestScore = -1;
  for (const name of candidates) {
    const cleaned = sanitizeCustomerNameCandidate(name) || name;
    const score = scoreCustomerNameCandidate(cleaned);
    if (score > bestScore) {
      best = cleaned;
      bestScore = score;
    }
  }
  return bestScore >= 0 ? best : '';
}

function shouldPersistSellerInsightLabel(fact = {}, lead = {}) {
  const field = String(fact?.field || '');
  if (INSIGHT_SKIP_FIELDS.has(field)) return false;
  const label = normalizeFactDisplayLabel(fact?.label, fact?.value)
    || String(fact?.value?.text || '').trim();
  if (!label || label === '[object Object]') return false;
  if (isSnapshotSystemNoiseLabel(label)) return false;
  if (isSnapshotContactIdentityLabel(label, lead)) return false;
  // Mail-/Formular-Reste als unresolvedNote nie Soft
  if (field === 'unresolvedNote' || fact?.preserveAsNote) {
    if (/quelle\s*:|https?:\/\/|kontaktanfrage|kontaktformular|urspr[uü]ngliche nachricht/i.test(label)) {
      return false;
    }
    // Lange Mail-Dumps ohne klaren Kundenfakt
    if (label.length > 96 && /@(?:[^\s]+)|telefon|e-?mail|betreff/i.test(label)) {
      return false;
    }
  }
  return true;
}

function pushUnique(list, item) {
  const text = normalizeFactDisplayLabel(item, null) || (typeof item === 'string' ? item.trim() : '');
  if (!text || text === '[object Object]') return list;
  if (list.includes(text)) return list;
  return [...list, text];
}

function resolveColorOrTrimTrackId(lead = {}, patch = {}) {
  const normalizeKey = (raw) => String(raw || '')
    .toLowerCase()
    .replace(/^kia\s+/i, '')
    .replace(/\s+/g, '')
    .trim();
  if (patch.modelKey) {
    const key = normalizeKey(patch.modelKey);
    const hit = listCustomerVehicleTracks(lead).find((t) => (
      normalizeKey(t.config?.modelKey || t.modelLabel) === key
    ));
    if (hit?.id) return hit.id;
  }
  if (patch.bindToFocus || patch.targetScope === 'offer_vehicle') {
    if (lead?.crm?.focusedVehicleTrackId) return lead.crm.focusedVehicleTrackId;
  }
  if (patch.trackId) return patch.trackId;
  return lead?.crm?.focusedVehicleTrackId || null;
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
  let paymentType = next.paymentType ?? wish.paymentType ?? null;
  let profile = { ...(getNeedProfileFromLead(next) || createEmptyNeedProfile()) };
  let touchedWish = false;
  let touchedContact = false;
  let touchedProfile = false;
  let appointmentValue = null;
  let vehicleInterestFocus = null;
  let multiVehicleInterests = null;
  let pendingMotorLabel = null;
  const sharedTrackRequirements = [];
  const removeTrackRequirements = [];
  const nextLeadColorPatches = [];
  const nextLeadTrimPatches = [];

  for (const fact of facts) {
    if (!fact || fact.needsConfirmation) continue;
    const field = fact.field;
    const value = fact.value;

    if (field === 'monthlyBudget' && value != null) {
      const amount = typeof value === 'object'
        ? (value.amount ?? value.value ?? null)
        : value;
      const basis = typeof value === 'object' ? value.basis : null;
      if (amount == null || !Number.isFinite(Number(amount))) continue;
      // Netto-Rate nie still als Brutto-Wunschrate übernehmen
      if (basis === 'net' && value?.acceptNetAsGross !== true) {
        profile.finance = {
          ...(profile.finance ?? {}),
          monthlyRateNet: Number(amount),
        };
        touchedProfile = true;
        continue;
      }
      desiredRate = Number(amount);
      wish.desiredRate = desiredRate;
      if (basis === 'gross') {
        wish.desiredRateBasis = 'gross';
      }
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

    if (field === 'paymentType' && value) {
      // Dual-Szenario: nicht auf einzelnes paymentType kollabieren
      if (facts.some((f) => f.field === 'commercialScenarios')) continue;
      paymentType = String(value);
      wish.paymentType = paymentType;
      profile.budget = {
        ...(profile.budget ?? {}),
        paymentType,
      };
      touchedWish = true;
      touchedProfile = true;
    }

    if (field === 'downPayment' && value != null && value !== '') {
      const down = Number(value);
      if (Number.isFinite(down)) {
        wish.downPayment = down;
        profile.budget = {
          ...(profile.budget ?? {}),
          downPayment: down,
        };
        touchedWish = true;
        touchedProfile = true;
      }
    }

    if (field === 'phone') {
      const phone = String(fact.label || value || '').trim();
      if (phone) {
        contact.phone = phone;
        touchedContact = true;
      }
    }

    if (field === 'email') {
      const email = String(fact.label || value || '').trim();
      if (email && email.includes('@')) {
        contact.email = email;
        touchedContact = true;
      }
    }

    if (field === 'customerName') {
      // Bewusst leer lassen – Preferenz über pickBestCustomerName nach der Schleife
      continue;
    }

    if (field === 'customerPlace') {
      const place = String(value || fact.label || '').trim();
      if (place) {
        contact.city = place;
        touchedContact = true;
      }
    }

    if (field === 'street' || field === 'postalCode' || field === 'zip' || field === 'city' || field === 'address') {
      // Adresse aus Dump → contact + crm.customerAddress (klar strukturiert)
      const patch = {};
      if (field === 'street') {
        if (typeof value === 'object' && value) {
          patch.street = String(value.street || '').trim() || null;
          patch.houseNumber = String(value.houseNumber || '').trim() || null;
        } else {
          const line = String(fact.label || value || '').trim();
          const m = line.match(/^(.+?)\s+(\d+[a-zA-Z]?(?:[/-]\d+[a-zA-Z]?)?)$/);
          if (m) {
            patch.street = m[1].trim();
            patch.houseNumber = m[2];
          } else if (line) {
            patch.street = line;
          }
        }
      }
      if (field === 'postalCode' || field === 'zip') {
        patch.postalCode = String(value || fact.label || '').replace(/\D/g, '').slice(0, 5) || null;
      }
      if (field === 'city') {
        if (typeof value === 'object' && value) {
          patch.city = String(value.city || fact.label || '').trim() || null;
          if (value.postalCode || value.zip) {
            patch.postalCode = String(value.postalCode || value.zip).replace(/\D/g, '').slice(0, 5) || null;
          }
        } else {
          patch.city = String(value || fact.label || '').trim() || null;
        }
      }
      if (field === 'address' && typeof value === 'object' && value) {
        patch.street = value.street ?? patch.street;
        patch.houseNumber = value.houseNumber ?? patch.houseNumber;
        patch.postalCode = value.postalCode || value.zip || patch.postalCode;
        patch.city = value.city ?? patch.city;
      }
      const prevAddr = {
        street: contact.street || next?.crm?.customerAddress?.street || '',
        houseNumber: contact.houseNumber || next?.crm?.customerAddress?.houseNumber || '',
        postalCode: contact.postalCode || contact.zip || next?.crm?.customerAddress?.postalCode || '',
        city: contact.city || next?.crm?.customerAddress?.city || '',
      };
      const merged = {
        street: patch.street ?? prevAddr.street,
        houseNumber: patch.houseNumber ?? prevAddr.houseNumber,
        postalCode: patch.postalCode ?? prevAddr.postalCode,
        city: patch.city ?? prevAddr.city,
      };
      if (merged.street) contact.street = merged.street;
      if (merged.houseNumber) contact.houseNumber = merged.houseNumber;
      if (merged.postalCode) {
        contact.postalCode = merged.postalCode;
        contact.zip = merged.postalCode;
      }
      if (merged.city) contact.city = merged.city;
      const line1 = [merged.street, merged.houseNumber].filter(Boolean).join(' ');
      const line2 = [merged.postalCode, merged.city].filter(Boolean).join(' ');
      const formatted = [line1, line2].filter(Boolean).join(' · ');
      if (formatted) contact.address = formatted;
      touchedContact = true;
      next = {
        ...next,
        crm: {
          ...(next.crm || {}),
          address: formatted || next.crm?.address,
          customerAddress: {
            ...(next.crm?.customerAddress || {}),
            street: merged.street || null,
            houseNumber: merged.houseNumber || null,
            postalCode: merged.postalCode || null,
            city: merged.city || null,
            country: next.crm?.customerAddress?.country || 'Deutschland',
            formattedAddress: formatted || null,
          },
        },
      };
    }

    if (field === 'towHitchRequired') {
      const removeAhk = value === false
        || value?.remove === true
        || /entfernen|raus|ohne|nicht/i.test(String(fact.label || ''));
      if (removeAhk) {
        profile.towbar = false;
        profile.priorities = (profile.priorities || []).filter((p) => (
          !/tow|ahk|anhänger/i.test(String(p))
        ));
        profile.equipmentWishes = (profile.equipmentWishes || []).filter((w) => (
          !/^(?:towbar|ahk|anhängerkupplung)$/i.test(String(w))
        ));
        removeTrackRequirements.push('AHK wichtig', 'AHK', 'towbar', 'Anhängerkupplung');
        touchedProfile = true;
      } else if (value) {
        profile.towbar = true;
        profile.priorities = pushUnique(profile.priorities ?? [], 'towing');
        profile.equipmentWishes = pushUnique(profile.equipmentWishes ?? [], 'towbar');
        sharedTrackRequirements.push('AHK wichtig');
        touchedProfile = true;
      }
    }

    if (field === 'decisionPartner') {
      const role = value?.role || 'partner';
      profile.household = {
        ...(profile.household ?? {}),
        decidesWith: role,
      };
      if (fact.label) {
        profile.understoodLabels = pushUnique(profile.understoodLabels ?? [], fact.label);
      }
      touchedProfile = true;
    }

    if (field === 'openCustomerQuestion') {
      // Offene Kosten-/Förderfragen: nur Label merken, nie Beträge erfinden
      const label = String(fact.label || value?.question || value?.topic || '').trim();
      if (label) {
        profile.understoodLabels = pushUnique(profile.understoodLabels ?? [], label);
        touchedProfile = true;
      }
    }

    if (field === 'colorPreference' && (value || fact.label)) {
      const colorRaw = typeof value === 'object' && value
        ? (value.color || fact.label)
        : (value || fact.label);
      profile.colorPreference = String(colorRaw || '').toLowerCase();
      touchedProfile = true;
      const interestModelKey = facts.find((f) => (
        f.field === 'vehicleInterest' && f.value?.modelKey && !f.needsConfirmation
      ))?.value?.modelKey || null;
      const modelKey = (typeof value === 'object' && value?.modelKey)
        || interestModelKey
        || null;
      const trackId = (typeof value === 'object' && value?.vehicleTrackId)
        || null;
      const bindToFocus = Boolean(
        modelKey
        || (typeof value === 'object' && value?.targetScope === 'offer_vehicle')
        || interestModelKey
        || lead?.crm?.focusedVehicleTrackId,
      );
      if (colorRaw) {
        nextLeadColorPatches.push({
          trackId: modelKey ? null : trackId,
          modelKey,
          preferredColor: String(colorRaw),
          bindToFocus,
          targetScope: typeof value === 'object' ? value?.targetScope : null,
        });
      }
    }

    if (field === 'transmissionPreference' && value) {
      profile.transmission = String(value);
      touchedProfile = true;
    }

    if (field === 'fuelPreference' && value) {
      profile.fuel = String(value) === 'electric' || String(value) === 'elektro'
        ? 'electric'
        : String(value);
      touchedProfile = true;
    }

    // Powertrain / Batterie – nur wenn explizit genannt (nie raten)
    if ((field === 'motorPreference' || field === 'batteryPreference') && (value || fact.label)) {
      const motorLabel = String(
        (typeof value === 'object' && value
          ? (value.label || value.hint || fact.label)
          : (value || fact.label)) || '',
      ).trim();
      if (motorLabel) {
        pendingMotorLabel = motorLabel;
        profile.motorPreference = motorLabel;
        profile.understoodLabels = pushUnique(profile.understoodLabels ?? [], motorLabel);
        sharedTrackRequirements.push(motorLabel);
        touchedProfile = true;
      }
    }

    if (field === 'equipmentWish') {
      const wishLabel = String(value?.label || fact.label || '')
        .replace(/\s*[·|]\s*(muss|wichtig|nice)\s*$/i, '')
        .replace(/\s+entfernen\s*$/i, '')
        .trim();
      const wishId = String(value?.id || wishLabel || '').trim();
      if (value?.remove === true || /entfernen/i.test(String(fact.label || ''))) {
        const strip = (list = []) => (list || []).filter((item) => {
          const s = String(item || '');
          return s !== wishId
            && s !== wishLabel
            && !new RegExp(wishLabel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i').test(s)
            && !(wishId === 'winter' && /winter/i.test(s));
        });
        profile.equipmentWishes = strip(profile.equipmentWishes);
        if (profile.equipmentWishPriorities) {
          const nextPri = { ...profile.equipmentWishPriorities };
          for (const key of Object.keys(nextPri)) {
            if (
              key === wishId
              || key === wishLabel
              || (wishId === 'winter' && /winter/i.test(key))
              || new RegExp(wishLabel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i').test(key)
            ) {
              delete nextPri[key];
            }
          }
          profile.equipmentWishPriorities = nextPri;
        }
        if (wishLabel) removeTrackRequirements.push(wishLabel);
        if (wishId === 'winter') removeTrackRequirements.push('Winterpaket');
        touchedProfile = true;
        continue;
      }
      const priority = value?.priority || 'preferred';
      if (wishId) {
        profile.equipmentWishes = pushUnique(profile.equipmentWishes ?? [], wishId);
        profile.equipmentWishPriorities = {
          ...(profile.equipmentWishPriorities ?? {}),
          [wishId]: priority,
          ...(wishLabel && wishLabel !== wishId ? { [wishLabel]: priority } : {}),
        };
        if (wishLabel) sharedTrackRequirements.push(wishLabel);
        touchedProfile = true;
      }
    }

    if (field === 'sunroofRequired' && value) {
      profile.equipmentWishes = pushUnique(profile.equipmentWishes ?? [], 'Schiebedach');
      profile.priorities = pushUnique(profile.priorities ?? [], 'technology');
      touchedProfile = true;
    }

    if (field === 'trimPreference') {
      const trims = Array.isArray(value)
        ? value
        : (value?.trims || (value?.trim ? [value.trim] : [value || fact.label]));
      const interestModelKey = facts.find((f) => (
        f.field === 'vehicleInterest' && f.value?.modelKey && !f.needsConfirmation
      ))?.value?.modelKey || null;
      const modelKey = (typeof value === 'object' && !Array.isArray(value) && value?.modelKey)
        || interestModelKey
        || null;
      const trackId = (typeof value === 'object' && !Array.isArray(value) && value?.vehicleTrackId)
        || null;
      const bindToFocus = Boolean(
        modelKey
        || (typeof value === 'object' && !Array.isArray(value) && value?.targetScope === 'offer_vehicle')
        || interestModelKey
        || lead?.crm?.focusedVehicleTrackId,
      );
      for (const trim of trims) {
        const label = String(trim ?? '').trim();
        if (!label) continue;
        if (modelKey || trackId || bindToFocus) {
          nextLeadTrimPatches.push({
            trackId: modelKey ? null : trackId,
            modelKey,
            trimLabel: label,
            bindToFocus,
            targetScope: typeof value === 'object' && !Array.isArray(value)
              ? value?.targetScope
              : null,
          });
        } else {
          profile.equipmentWishes = pushUnique(profile.equipmentWishes ?? [], label);
        }
      }
      touchedProfile = true;
    }

    if (field === 'discountPercent' && value != null) {
      const pct = Number(value);
      if (Number.isFinite(pct) && pct >= 0 && pct <= 100) {
        wish.customDiscountPercent = pct;
        wish.customerGroup = 'custom';
        touchedWish = true;
      }
    }
    if (field === 'customerType' && value) {
      const normalized = String(value).toLowerCase() === 'business'
        || String(value).toLowerCase() === 'gewerbe'
        || String(value).toLowerCase() === 'gewerblich'
        ? 'business'
        : String(value).toLowerCase() === 'private' || String(value).toLowerCase() === 'privat'
          ? 'private'
          : String(value);
      wish.customerType = normalized;
      touchedWish = true;
    }
    if (field === 'discountPercentInvalid') {
      continue;
    }

    if (field === 'existingContractEnd') {
      if (value?.endDate) {
        wish.leasingEndDate = value.endDate;
        touchedWish = true;
      }
      if (value?.type === 'leasing' || value?.type === 'financing' || value?.type === 'cash') {
        paymentType = value.type;
        wish.paymentType = value.type;
        touchedWish = true;
      }
    }

    if (field === 'deliveryDeadline' && value?.endDate) {
      wish.desiredDeliveryDate = value.endDate;
      if (value.important) wish.deliveryImportant = true;
      touchedWish = true;
    }

    if (field === 'deliveryEstimateMonths' && value != null) {
      const months = typeof value === 'object'
        ? (value.months ?? value.value ?? null)
        : value;
      if (months != null) {
        wish.deliveryEstimateMonths = Number(months);
        touchedWish = true;
      }
    }

    if (field === 'vehicleInterest' && value?.modelKey) {
      // PDF-Modell ≠ aktives Akte-Modell: Fokus nur nach explizitem Switch
      if (value.conflictWithActive || value.preserveActiveFocus) {
        if (value.acceptModelSwitch !== true) {
          continue;
        }
      }
      profile.selectedModelKey = value.modelKey;
      profile.modelHint = value.modelKey;
      if (String(value.modelKey).toLowerCase().startsWith('ev')) {
        profile.fuel = 'electric';
      }
      vehicleInterestFocus = {
        modelKey: value.modelKey,
        model: value.model || value.modelKey,
        trim: value.trim || null,
        make: value.make || 'Kia',
        label: normalizeFactDisplayLabel(fact.label, value) || null,
        color: value.color || value.preferredColor || null,
        package: value.package || value.equipmentPackage || pendingMotorLabel || null,
      };
      touchedProfile = true;
    }

    if (field === 'vehicleInterestMulti') {
      const entries = Array.isArray(value) ? value : [];
      const normalized = entries
        .map((entry) => {
          if (typeof entry === 'string') {
            const key = String(entry).toLowerCase().replace(/^kia\s+/i, '').trim();
            if (!key) return null;
            const model = /^(?:ev|pv)\d$/i.test(key) ? key.toUpperCase() : key;
            return { modelKey: key, model, make: 'Kia', label: `Kia ${model}` };
          }
          const key = String(entry?.modelKey || entry?.model || '')
            .toLowerCase()
            .replace(/^kia\s+/i, '')
            .trim();
          if (!key) return null;
          const model = /^(?:ev|pv)\d$/i.test(key)
            ? key.toUpperCase()
            : (entry.model || key);
          return {
            modelKey: key,
            model,
            trim: entry.trim || null,
            color: entry.color || entry.preferredColor || null,
            package: entry.package || entry.equipmentPackage || null,
            make: entry.make || 'Kia',
            label: entry.label
              || [entry.make || 'Kia', model, entry.trim].filter(Boolean).join(' '),
          };
        })
        .filter(Boolean);
      const keys = normalized.map((e) => e.modelKey).filter(Boolean);
      if (keys.length) {
        profile.modelCandidates = keys;
        multiVehicleInterests = normalized;
      }
      if (fact.label) {
        profile.understoodLabels = pushUnique(profile.understoodLabels ?? [], fact.label);
      }
      // kein selectedModelKey – Mehrdeutigkeit bewusst offen lassen (Tracks werden unten angelegt)
      touchedProfile = true;
    }

    if (field === 'appointment' && value?.startAt) {
      appointmentValue = value;
    }

    if (field === 'maritalStatus' || field === 'childrenCount') {
      profile.household = {
        ...(profile.household ?? {}),
        ...(field === 'maritalStatus' ? { maritalStatus: value } : {}),
        ...(field === 'childrenCount' ? { childrenCount: value } : {}),
      };
      if (field === 'childrenCount' && value != null) {
        profile.children = value;
      }
      touchedProfile = true;
    }

    if (field === 'pet' || field === 'hasPet') {
      const hasPetFlag = typeof value === 'object' && value && 'hasPet' in value
        ? Boolean(value.hasPet)
        : value !== false && value !== 'false' && value != null;
      if (!hasPetFlag) {
        profile.dog = false;
        touchedProfile = true;
        continue;
      }
      const petType = value?.type
        || (typeof value === 'string' ? value : null)
        || (/hund/i.test(String(fact.label || '')) ? 'dog' : null);
      if (petType === 'dog' || petType === 'hund') {
        profile.dog = true;
        touchedProfile = true;
      }
    }

    if (field === 'monthlyNetIncome' && value != null) {
      profile.finance = {
        ...(profile.finance ?? {}),
        monthlyNetIncome: Number(value),
      };
      touchedProfile = true;
    }
  }

  if (touchedWish || desiredRate != null || paymentType) {
    next = {
      ...next,
      desiredRate: desiredRate ?? next.desiredRate,
      paymentType: paymentType ?? next.paymentType,
      wish: {
        ...wish,
        desiredRate: desiredRate ?? wish.desiredRate,
        paymentType: paymentType ?? wish.paymentType,
      },
    };
  }

  const bestName = pickBestCustomerName(facts);
  if (bestName) {
    const currentDisplay = String(contact.name || next.name || '').trim();
    const nameForIdentity = isPlaceholderCustomerName(currentDisplay)
      ? bestName
      : (currentDisplay || bestName);
    const identity = deriveContactIdentity(
      {
        ...contact,
        name: nameForIdentity,
        // Placeholder-Kontakt darf first/last nicht leer halten und bestName verdrängen
        firstName: isPlaceholderCustomerName(currentDisplay) ? '' : contact.firstName,
        lastName: isPlaceholderCustomerName(currentDisplay) ? '' : contact.lastName,
        salutation: contact.salutation,
      },
      bestName,
    );
    const nextPayload = buildContactPayloadFromIdentity(identity, {
      phone: contact.phone || '',
      email: contact.email || '',
      address: contact.address,
    });
    const currentIsPlaceholder = isPlaceholderCustomerName(currentDisplay);
    const shouldReplaceName = currentIsPlaceholder
      || !currentDisplay
      || scoreCustomerNameCandidate(nextPayload.name) >= scoreCustomerNameCandidate(currentDisplay);
    if (shouldReplaceName && nextPayload.name && !isPlaceholderCustomerName(nextPayload.name)) {
      Object.assign(contact, {
        name: nextPayload.name,
        firstName: nextPayload.firstName,
        lastName: nextPayload.lastName,
        salutation: nextPayload.salutation,
        kind: nextPayload.kind,
        companyName: nextPayload.companyName,
      });
      touchedContact = true;
    }
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

  if (multiVehicleInterests?.length) {
    const multi = ensureMultiVehicleInterestTracksOnLead(next, multiVehicleInterests, {
      sharedRequirements: [...new Set(sharedTrackRequirements)],
    });
    next = multi.lead;
    const modelKeys = multiVehicleInterests
      .map((e) => normalizeBatchModelKey(e.modelKey || e.model))
      .filter(Boolean);
    next = setRecentVehicleTracksOnLead(next, multi.trackIds || [], modelKeys);
  } else if (vehicleInterestFocus?.modelKey) {
    if (pendingMotorLabel && !vehicleInterestFocus.package) {
      vehicleInterestFocus = {
        ...vehicleInterestFocus,
        package: pendingMotorLabel,
      };
    }
    const focused = focusVehicleInterestOnLead(next, vehicleInterestFocus);
    next = focused.lead;
    if (sharedTrackRequirements.length && focused.trackId) {
      const meta = (next.crm?.vehicleConfigurations || [])
        .find((c) => c?.id === focused.trackId);
      const prevReqs = meta?.vehicleTrack?.customerRequirements || [];
      next = patchVehicleTrackOnLead(next, focused.trackId, {
        customerRequirements: [...new Set([...prevReqs, ...sharedTrackRequirements])],
      });
    }
  } else if (sharedTrackRequirements.length) {
    // Soft-Wünsche (AHK / Winterpaket) auf alle offenen/aktiven Spuren spiegeln
    const tracks = listCustomerVehicleTracks(next).filter((t) => (
      t.status === VEHICLE_TRACK_STATUS.OPEN
      || t.status === VEHICLE_TRACK_STATUS.ACTIVE
      || t.status === VEHICLE_TRACK_STATUS.FAVORITE
    ));
    for (const track of tracks) {
      const prev = track.customerRequirements || [];
      next = patchVehicleTrackOnLead(next, track.id, {
        customerRequirements: [...new Set([...prev, ...sharedTrackRequirements])],
      });
    }
  }

  if (removeTrackRequirements.length) {
    const removeKeys = new Set(
      removeTrackRequirements.map((r) => String(r || '').toLowerCase()).filter(Boolean),
    );
    const tracks = listCustomerVehicleTracks(next);
    for (const track of tracks) {
      const prev = track.customerRequirements || [];
      const filtered = prev.filter((req) => {
        const key = String(req || '').toLowerCase();
        if (removeKeys.has(key)) return false;
        if ([...removeKeys].some((r) => key.includes(r) || r.includes(key))) return false;
        return true;
      });
      if (filtered.length !== prev.length) {
        next = patchVehicleTrackOnLead(next, track.id, {
          customerRequirements: filtered,
        });
      }
    }
  }

  // Farbe/Trim nach Fokus auflösen – nie still auf alter Primary-Spur kleben
  for (const patch of nextLeadTrimPatches) {
    const trackId = resolveColorOrTrimTrackId(next, patch);
    if (!trackId || !patch.trimLabel) continue;
    const configs = next?.crm?.vehicleConfigurations ?? [];
    next = {
      ...next,
      crm: {
        ...(next.crm || {}),
        vehicleConfigurations: configs.map((config) => (
          config?.id === trackId
            ? {
              ...config,
              trimLabel: patch.trimLabel,
              updatedAt: new Date().toISOString(),
            }
            : config
        )),
      },
    };
  }
  for (const patch of nextLeadColorPatches) {
    const trackId = resolveColorOrTrimTrackId(next, patch);
    if (!trackId || !patch.preferredColor) continue;
    next = patchVehicleTrackOnLead(next, trackId, {
      preferredColor: patch.preferredColor,
    });
    const configs = next?.crm?.vehicleConfigurations ?? [];
    next = {
      ...next,
      crm: {
        ...(next.crm || {}),
        vehicleConfigurations: configs.map((config) => (
          config?.id === trackId
            ? {
              ...config,
              colorLabel: patch.preferredColor,
              updatedAt: new Date().toISOString(),
            }
            : config
        )),
      },
    };
  }

  if (appointmentValue?.startAt) {
    const appointment = {
      id: `appt-review-${Date.now()}`,
      type: appointmentValue.type,
      typeLabel: appointmentTypeLabel(appointmentValue.type),
      startAt: appointmentValue.startAt,
      status: appointmentValue.status,
    };
    next = applyAppointmentCrmPatch(
      next,
      buildCrmPatchFromAppointment(appointment, { markProposed: true }),
    );
  }

  return next;
}

/**
 * @param {object} lead
 * @param {object} turn – CleverSellerTurnResult
 * @param {{ sellerId?: string, sellerName?: string, postFeedCard?: boolean }} [options]
 */
function hasPreparedCustomerFollowThrough(turn = {}) {
  return (turn.preparedActions ?? []).some((a) => (
    (
      a.type === SELLER_TURN_INTENTS.DRAFT_MESSAGE
      || a.type === SELLER_TURN_INTENTS.SEND_PORTFOLIO
      || a.type === SELLER_TURN_INTENTS.PROPOSE_APPOINTMENT
      || a.type === SELLER_TURN_INTENTS.IMPORT_CUSTOMER_CONTRACT
      || a.type === SELLER_TURN_INTENTS.REQUEST_DOCUMENTS
      || a.type === SELLER_TURN_INTENTS.INBOUND_LEAD
      || a.type === SELLER_TURN_INTENTS.CUSTOMER_REPLY
      || a.type === SELLER_TURN_INTENTS.UPDATE_CUSTOMER_CONTEXT
      || (
        a.type === SELLER_TURN_INTENTS.PREPARE_OFFER
        && a.payload?.batch === true
        && Array.isArray(a.payload?.trackIds)
        && a.payload.trackIds.length >= 2
      )
    )
    && a.status === 'prepared'
  ));
}

function applyBatchOfferOrdersIfPresent(lead, turn) {
  const batchOfferAction = (turn.preparedActions ?? []).find((a) => (
    a.type === SELLER_TURN_INTENTS.PREPARE_OFFER
    && a.status === 'prepared'
    && a.payload?.batch === true
    && Array.isArray(a.payload?.trackIds)
    && a.payload.trackIds.length >= 2
  ));
  if (!batchOfferAction) {
    return { lead, applied: false, labels: [] };
  }
  let nextLead = lead;
  const ensuredConfigs = batchOfferAction.payload?.ensuredVehicleConfigurations;
  if (Array.isArray(ensuredConfigs) && ensuredConfigs.length) {
    const prev = nextLead.crm?.vehicleConfigurations || [];
    const byId = new Map(prev.map((c) => [c.id, c]));
    for (const cfg of ensuredConfigs) {
      if (cfg?.id) byId.set(cfg.id, { ...(byId.get(cfg.id) || {}), ...cfg });
    }
    nextLead = {
      ...nextLead,
      crm: {
        ...(nextLead.crm || {}),
        vehicleConfigurations: [...byId.values()],
      },
    };
  } else if (Array.isArray(batchOfferAction.payload?.batchModelKeys)
    && batchOfferAction.payload.batchModelKeys.length >= 2) {
    const ensured = ensureTracksForBatchModelKeys(
      nextLead,
      batchOfferAction.payload.batchModelKeys,
    );
    nextLead = ensured.lead;
  }
  const modelKeys = (batchOfferAction.payload.batchModelKeys || [])
    .map(normalizeBatchModelKey)
    .filter(Boolean);
  if (modelKeys.length >= 2) {
    nextLead = setRecentVehicleTracksOnLead(
      nextLead,
      batchOfferAction.payload.trackIds || [],
      modelKeys,
    );
  }

  const nowIso = new Date().toISOString();
  const existingOrders = Array.isArray(nextLead.crm?.openOfferOrders)
    ? nextLead.crm.openOfferOrders
    : [];
  const models = Array.isArray(batchOfferAction.payload.models)
    ? batchOfferAction.payload.models
    : [];
  const batchOrders = batchOfferAction.payload.trackIds.map((trackId, index) => {
    const modelMeta = models.find((m) => m?.trackId === trackId) || {};
    const track = listCustomerVehicleTracks(nextLead).find((t) => t.id === trackId);
    const displayName = modelMeta.displayName
      || track?.displayName
      || modelMeta.modelKey
      || 'Fahrzeug';
    return {
      id: `oor-batch-${trackId}-${index}`,
      offerId: null,
      trackId,
      model: modelMeta.modelKey || track?.modelLabel || null,
      trim: track?.config?.trimLabel || null,
      status: 'prepared',
      label: `Angebotsauftrag ${displayName}`,
      createdAt: nowIso,
      source: 'seller_batch_offers',
    };
  });
  const kept = existingOrders.filter((o) => (
    !batchOfferAction.payload.trackIds.includes(o?.trackId)
    || o?.source !== 'seller_batch_offers'
  ));
  return {
    lead: {
      ...nextLead,
      crm: {
        ...(nextLead.crm || {}),
        openOfferOrders: [...batchOrders, ...kept],
      },
    },
    applied: true,
    labels: [`${batchOrders.length} Angebotsaufträge vorbereitet`],
  };
}

function applyDocumentsPackageIfPresent(lead, turn, options = {}) {
  if (options.sendDocumentsPackage === false) {
    return { applied: false, lead, uploadUrl: null };
  }
  const docsAction = (turn.preparedActions ?? []).find((a) => (
    a.type === SELLER_TURN_INTENTS.REQUEST_DOCUMENTS
    && a.status === 'prepared'
    && !a.payload?.complete
  ));
  if (!docsAction) return { applied: false, lead, uploadUrl: null };

  const pkg = docsAction.legacy
    || docsAction.payload?.workspacePackage
    || null;
  const body = pkg?.body
    || docsAction.payload?.messageDraft
    || turn.messageDraft
    || '';
  const actions = Array.isArray(pkg?.actions) ? pkg.actions : [];
  if (!lead?.id || (!String(body).trim() && !actions.length)) {
    return { applied: false, lead, uploadUrl: null };
  }

  const sent = sendSellerWorkspacePackage({
    lead,
    body,
    actions,
    createdByName: options.sellerName || 'Verkäufer',
    threadId: options.threadId || null,
    relatedOfferId: options.relatedOfferId || null,
    relatedQuestionId: options.relatedQuestionId || null,
  });
  return {
    applied: Boolean(sent.ok),
    lead: sent.lead || lead,
    uploadUrl: sent.uploadUrl || null,
    messages: sent.messages || [],
    error: sent.error || null,
  };
}

function applyContractImportIfPresent(lead, turn, options = {}) {
  const contractAction = (turn.preparedActions ?? []).find((a) => (
    a.type === SELLER_TURN_INTENTS.IMPORT_CUSTOMER_CONTRACT
    && a.status === 'prepared'
  ));
  const draft = contractAction?.payload?.contractDraft || turn.contractDraft || null;
  if (!draft || !lead?.id) {
    return { applied: false, lead, contract: null, duplicate: false };
  }
  const persisted = persistConfirmedCustomerContract(lead, draft, {
    activityText: 'Altvertrag erfasst',
  });
  let nextLead = persisted.lead || lead;
  if (options.postFeedCard !== false && persisted.ok && !persisted.duplicate) {
    const posted = postCleverAssistFeedCard({
      lead: nextLead,
      title: '✨ Altvertrag erfasst',
      text: [
        draft.vehicle?.label || draft.contractType || 'Vertrag',
        draft.contractEndDate ? `Ende ${draft.contractEndDate}` : null,
        draft.monthlyRate != null ? `${draft.monthlyRate} € / Monat` : null,
      ].filter(Boolean).join(' · '),
      visibleToCustomer: false,
    });
    if (posted.message) nextLead = posted.lead;
  }
  return {
    applied: persisted.ok,
    lead: nextLead,
    contract: persisted.contract,
    duplicate: persisted.duplicate,
  };
}

export function applyAcceptedSellerTurn(lead = {}, turn = {}, options = {}) {
  // Multi-Source: dedizierter Confirm-Apply (validierter Intake, kein OpenAI-Direktpersist)
  if (turn?.multiSourceIntake?.detected) {
    return applyConfirmedMultiSourceIntakePlan(lead, turn, {
      ...options,
      allowCreateCustomer: options.allowCreateCustomer === true,
      leadsSnapshot: options.leadsSnapshot || [],
      selectedLeadId: options.selectedLeadId || null,
    });
  }

  const rawFacts = turn.extractedFacts ?? [];
  const hasCustomerActions = hasPreparedCustomerFollowThrough(turn);
  const inbound = turn.inboundLead || null;

  // Inbound: neuen Kunden nur nach Accept anlegen (kein Auto-Persist vorher)
  let workingLead = lead;
  let createdFromInbound = false;
  if (
    inbound?.proposeCreateCustomer
    && !lead?.id
    && options.allowCreateCustomer !== false
  ) {
    workingLead = buildInboundLeadDraft(inbound.contact || {}, {
      dealerId: options.dealerId,
    });
    createdFromInbound = true;
  }

  if (!workingLead?.id || (!rawFacts.length && !hasCustomerActions && !createdFromInbound)) {
    return { ok: false, lead: workingLead, acceptedLabels: [], created: false };
  }

  // Contract Import zuerst – keine Contract Facts als Customer Truth
  const contractResult = applyContractImportIfPresent(workingLead, turn, options);
  if (contractResult.applied && !rawFacts.length) {
    // Unterlagen ggf. im selben Accept (ohne weitere Facts)
    const docsAfterContract = applyDocumentsPackageIfPresent(contractResult.lead, turn, options);
    if (docsAfterContract.applied) {
      let nextLead = docsAfterContract.lead;
      if (options.postFeedCard !== false) {
        const summary = (turn.preparedActions ?? [])
          .find((a) => a.type === SELLER_TURN_INTENTS.REQUEST_DOCUMENTS)
          ?.payload?.sellerSummary
          || 'Sicheren Upload-Link gesendet';
        const posted = postCleverAssistFeedCard({
          lead: nextLead,
          title: '✨ Unterlagen-Link gesendet',
          text: summary,
          visibleToCustomer: false,
        });
        if (posted.message) nextLead = posted.lead;
      }
      return {
        ok: true,
        lead: nextLead,
        acceptedLabels: [
          contractResult.duplicate ? 'Vertrag bereits vorhanden' : 'Altvertrag erfasst',
          'Sicheren Upload-Link gesendet',
        ],
        contract: contractResult.contract,
        duplicateContract: contractResult.duplicate,
        documentsPackageSent: true,
        uploadUrl: docsAfterContract.uploadUrl || null,
        created: createdFromInbound,
      };
    }
    return {
      ok: true,
      lead: contractResult.lead,
      acceptedLabels: contractResult.duplicate
        ? ['Vertrag bereits vorhanden']
        : ['Altvertrag erfasst'],
      contract: contractResult.contract,
      duplicateContract: contractResult.duplicate,
    };
  }

  // Unterlagen-Paket allein: erst nach Confirm senden (Propose → Confirm → Action)
  if (!rawFacts.length) {
    const docsResult = applyDocumentsPackageIfPresent(
      contractResult.applied ? contractResult.lead : workingLead,
      turn,
      options,
    );
    if (docsResult.applied) {
      let nextLead = docsResult.lead;
      if (options.postFeedCard !== false) {
        const summary = (turn.preparedActions ?? [])
          .find((a) => a.type === SELLER_TURN_INTENTS.REQUEST_DOCUMENTS)
          ?.payload?.sellerSummary
          || 'Sicheren Upload-Link gesendet';
        const posted = postCleverAssistFeedCard({
          lead: nextLead,
          title: '✨ Unterlagen-Link gesendet',
          text: summary,
          visibleToCustomer: false,
        });
        if (posted.message) nextLead = posted.lead;
      }
      return {
        ok: true,
        lead: nextLead,
        acceptedLabels: ['Sicheren Upload-Link gesendet'],
        documentsPackageSent: true,
        uploadUrl: docsResult.uploadUrl || null,
        created: createdFromInbound,
      };
    }

    let nextLead = contractResult.applied ? contractResult.lead : workingLead;
    const batchOnly = applyBatchOfferOrdersIfPresent(nextLead, turn);
    if (batchOnly.applied) {
      nextLead = batchOnly.lead;
      const batchAction = (turn.preparedActions || []).find((a) => (
        a.type === SELLER_TURN_INTENTS.PREPARE_OFFER && a.payload?.batch
      ));
      if (Array.isArray(batchAction?.payload?.offers)) {
        for (const od of batchAction.payload.offers) {
          if (!od?.offerDraftId) continue;
          nextLead = upsertOfferDraftOnLead(nextLead, od);
        }
      }
      if (options.postFeedCard !== false) {
        const posted = postCleverAssistFeedCard({
          lead: nextLead,
          title: '✨ Clever hat vorbereitet',
          text: batchOnly.labels.join(' · ') || 'Angebotsaufträge vorbereitet',
          visibleToCustomer: false,
        });
        if (posted.message) nextLead = posted.lead;
      }
      return {
        ok: true,
        lead: nextLead,
        acceptedLabels: batchOnly.labels,
        created: createdFromInbound,
      };
    }

    if (options.postFeedCard !== false) {
      const preparedLabels = (turn.preparedActions ?? [])
        .filter((a) => a.status === 'prepared')
        .map((a) => a.label || a.type)
        .filter(Boolean)
        .slice(0, 4);
      const text = preparedLabels.length
        ? `Vorbereitet: ${preparedLabels.join(' · ')}`
        : (String(turn.messageDraft ?? turn.assistantReply ?? '').trim() || 'Clever hat vorbereitet');
      if (String(text).trim()) {
        const posted = postCleverAssistFeedCard({
          lead: nextLead,
          title: '✨ Clever hat vorbereitet',
          text,
          visibleToCustomer: false,
        });
        if (posted.message) nextLead = posted.lead;
      }
    }
    return {
      ok: true,
      lead: nextLead,
      acceptedLabels: createdFromInbound ? ['Kunde aus Anfrage angelegt'] : [],
      created: createdFromInbound,
    };
  }

  // „Übernehmen“ = Seller bestätigt die Review inkl. unsicherer Facts
  // Bei Contract-Import: keine Wish-/Truth-Mutation aus Contract-Paste-Facts
  const skipTruthFromContract = Boolean(contractResult.applied);
  const facts = (skipTruthFromContract ? [] : rawFacts).map((f) => (
    f?.needsConfirmation ? { ...f, needsConfirmation: false } : f
  ));

  if (skipTruthFromContract && !facts.length) {
    return {
      ok: true,
      lead: contractResult.lead,
      acceptedLabels: contractResult.duplicate
        ? ['Vertrag bereits vorhanden']
        : ['Altvertrag erfasst'],
      contract: contractResult.contract,
      duplicateContract: contractResult.duplicate,
      created: createdFromInbound,
    };
  }

  const labels = facts
    .filter((f) => shouldPersistSellerInsightLabel(f, workingLead))
    .map((f) => normalizeFactDisplayLabel(f.label, f.value))
    .filter(Boolean);
  // Inbound-/Extraktions-Accept → Clever-Quelle (nicht Merken/Picker)
  const insightSource = inbound?.detected ? 'clever' : 'seller';
  let nextLead = workingLead;
  for (const fact of facts) {
    if (!shouldPersistSellerInsightLabel(fact, nextLead)) continue;
    const label = normalizeFactDisplayLabel(fact.label, fact.value);
    if (!label) continue;
    const understoodLabels = fact.field === 'serviceInclusionWish'
      || classifySnapshotNoteLabel(label).slot === 'serviceWish'
      ? [label]
      : undefined;
    nextLead = appendSellerInsightsFromTexts(nextLead, [label], {
      context: 'universal_review',
      sellerId: options.sellerId,
      sellerName: options.sellerName,
      source: insightSource,
      ...(understoodLabels ? { understoodLabels } : {}),
    });
  }

  // Inbound-Kontakt: voller Name vor Fact-Apply (nicht nur „Marcel“)
  if (inbound?.detected && inbound?.contact) {
    const bestInboundName = pickBestCustomerName(facts, inbound.contact);
    if (bestInboundName) {
      const identity = deriveContactIdentity(
        {
          ...(nextLead.contact || {}),
          firstName: inbound.contact.firstName,
          lastName: inbound.contact.lastName,
          salutation: inbound.contact.salutation,
        },
        bestInboundName,
      );
      const payload = buildContactPayloadFromIdentity(identity, {
        phone: inbound.contact.phone || nextLead.contact?.phone || '',
        email: inbound.contact.email || nextLead.contact?.email || '',
        address: nextLead.contact?.address,
      });
      nextLead = {
        ...nextLead,
        name: payload.name || nextLead.name,
        contact: {
          ...(nextLead.contact || {}),
          ...payload,
        },
      };
    }
  }

  // Epic 2: Dual commercial scenarios → eine Spur + zwei Offer-Slots
  const homepageDraft = turn.homepageInquiry?.hasDualScenarios
    ? turn.homepageInquiry
    : null;
  const scenarioFact = facts.find((f) => f.field === 'commercialScenarios');
  if (homepageDraft || (Array.isArray(scenarioFact?.value) && scenarioFact.value.length >= 2)) {
    const draft = homepageDraft || {
      model: facts.find((f) => f.field === 'vehicleInterest')?.value?.model
        || facts.find((f) => f.field === 'vehicleInterest')?.label
        || workingLead.vehicle?.model
        || null,
      modelKey: facts.find((f) => f.field === 'vehicleInterest')?.value?.modelKey || null,
      configurationAttached: facts.some((f) => f.field === 'configurationAttached'),
      customerType: facts.find((f) => f.field === 'customerType')?.value || 'private',
      commercialScenarios: scenarioFact.value,
      openQuestions: facts
        .filter((f) => f.field === 'deliveryTime')
        .map((f) => ({
          id: 'delivery_time',
          field: 'deliveryTime',
          label: f.label || 'Lieferzeit beantworten',
          question: f.value?.question || 'Wie ist die Lieferzeit?',
        })),
      hasDualScenarios: true,
    };
    const appliedHome = applyHomepageInquiryToLead(nextLead, draft, { createOfferShells: true });
    if (appliedHome.ok) {
      nextLead = appliedHome.lead;
    }
  }

  nextLead = applyStructuredFactsToLead(nextLead, facts);

  // Offer-/PDF-Konditionen → Wish/Konditionen-Strip (nur konkrete Werte, behutsam mergen)
  const offerCommercialFacts = facts.filter((f) => (
    f?.source === SELLER_FACT_SOURCE.OFFER_PDF
    || f?.field === 'termMonths'
    || f?.field === 'durationMonths'
    || f?.field === 'annualMileage'
    || f?.field === 'downPayment'
    || f?.field === 'paymentType'
  ));
  if (offerCommercialFacts.length) {
    const commercial = {};
    for (const fact of offerCommercialFacts) {
      if (fact.field === 'paymentType' && fact.value) commercial.paymentType = fact.value;
      if ((fact.field === 'termMonths' || fact.field === 'durationMonths') && fact.value != null) {
        commercial.termMonths = typeof fact.value === 'object' ? fact.value.value : fact.value;
      }
      if (fact.field === 'annualMileage' && fact.value != null) {
        commercial.mileagePerYear = fact.value;
      }
      if (fact.field === 'downPayment' && fact.value != null && fact.value !== '') {
        commercial.downPayment = fact.value;
      }
      if (fact.field === 'existingContractEnd' && fact.value?.endDate) {
        commercial.leasingEndDate = fact.value.endDate;
      }
    }
    const fromOfferPdf = offerCommercialFacts.some((f) => f.source === SELLER_FACT_SOURCE.OFFER_PDF);
    const mergedWish = mergeOfferCommercialIntoWish(nextLead.wish, commercial, {
      forceFromActiveOffer: fromOfferPdf,
    });
    nextLead = {
      ...nextLead,
      wish: mergedWish,
      paymentType: mergedWish.paymentType ?? nextLead.paymentType,
    };
  }

  // Epic 3: Lieferzeit-Antwort schließt offene Kundenfrage + Portal-Text
  const deliveryAnswerFact = facts.find((f) => (
    f.field === 'deliveryTimeAnswer' && f.value?.answerText && !f.needsConfirmation
  ));
  if (deliveryAnswerFact) {
    nextLead = answerDeliveryTimeOnLead(nextLead, {
      answerText: deliveryAnswerFact.value.answerText,
      weeksMin: deliveryAnswerFact.value.weeksMin ?? null,
      weeksMax: deliveryAnswerFact.value.weeksMax ?? null,
      months: deliveryAnswerFact.value.months ?? null,
      approximate: deliveryAnswerFact.value.approximate !== false,
      source: deliveryAnswerFact.value.source
        || deliveryAnswerFact.source
        || SELLER_FACT_SOURCE.SELLER_INPUT,
      answeredBy: options.sellerId || options.sellerName || null,
    });
  } else {
    const monthsFact = facts.find((f) => (
      f.field === 'deliveryEstimateMonths' && !f.needsConfirmation
    ));
    if (monthsFact) {
      const months = typeof monthsFact.value === 'object'
        ? (monthsFact.value.months ?? monthsFact.value.value)
        : monthsFact.value;
      if (months != null) {
        nextLead = answerDeliveryTimeOnLead(nextLead, {
          answerText: `${Number(months)} Monate`,
          months: Number(months),
          approximate: true,
          source: monthsFact.source || SELLER_FACT_SOURCE.SELLER_INPUT,
          answeredBy: options.sellerId || options.sellerName || null,
        });
      }
    }
  }

  const trackFeedback = mapSellerFactsToTrackFeedback(facts, nextLead);
  if (trackFeedback.length) {
    nextLead = applyTrackFeedbackFacts(nextLead, trackFeedback);
  }

  const batchApplied = applyBatchOfferOrdersIfPresent(nextLead, turn);
  if (batchApplied.applied) {
    nextLead = batchApplied.lead;
    for (const label of batchApplied.labels) {
      if (!labels.includes(label)) labels.push(label);
    }
  }

  // Slice 18: Nach Confirm Nachfolgeangebot auf Favoriten-Spur markieren (kein Auto-Send)
  const successionCue = isPrepareSuccessionOfferCue(
    turn?.interpretedInput?.normalized || turn?.interpretedInput?.raw || '',
  );
  const successionFact = facts.some((f) => (
    f.field === 'paymentType' && /nachfolge/i.test(String(f.label || ''))
  ));
  if (successionCue || successionFact) {
    const tracks = sortTracksForOverview(listCustomerVehicleTracks(nextLead));
    const favorite = tracks.find((t) => t.status === VEHICLE_TRACK_STATUS.FAVORITE);
    if (favorite?.id) {
      nextLead = patchVehicleTrackOnLead(nextLead, favorite.id, {
        successionOfferPreparedAt: new Date().toISOString(),
      });
      if (!labels.includes('Nachfolgeangebot vorbereitet')) {
        labels.push('Nachfolgeangebot vorbereitet');
      }
    }
  }

  // Epic 4: Varianten-Feedback (commercialScenarioId) – Spur bleibt eine
  const scenarioFeedbackFacts = facts
    .filter((f) => f.field === 'scenarioOfferFeedback' && f.value?.commercialScenarioId && !f.needsConfirmation)
    .map((f) => f.value);
  if (scenarioFeedbackFacts.length) {
    nextLead = applyScenarioOfferFeedbackFacts(nextLead, scenarioFeedbackFacts);
  }

  const tradeInRequestedFact = facts.find((f) => f.field === 'tradeInRequested');
  const tradeInVehicleFact = facts.find((f) => (
    f.field === 'tradeInVehicle' && !f.needsConfirmation
  ));
  const existingVehicle = facts.find((f) => (
    f.field === 'existingVehicle' && !f.needsConfirmation
  ));
  const tradeInRequested = Boolean(tradeInRequestedFact)
    || facts.some((f) => f.factClass === SELLER_FACT_CLASS.TRADE_IN_FACT && f.field === 'tradeInVehicle');

  // Bestandfahrzeug ohne Inzahlungnahme-Cue → crm.existingVehicle (nicht tradeIn)
  if (existingVehicle && !tradeInRequested && !tradeInVehicleFact) {
    const v = existingVehicle.value || {};
    const label = v.model
      ? [v.make, v.model].filter(Boolean).join(' ')
      : String(existingVehicle.label || '').replace(/\s*·\s*.*$/, '').trim();
    nextLead = {
      ...nextLead,
      crm: {
        ...(nextLead.crm ?? {}),
        existingVehicle: {
          ...(nextLead.crm?.existingVehicle || {}),
          make: v.make || nextLead.crm?.existingVehicle?.make || null,
          model: v.model || nextLead.crm?.existingVehicle?.model || null,
          color: v.color || nextLead.crm?.existingVehicle?.color || null,
          transmission: v.transmission || nextLead.crm?.existingVehicle?.transmission || null,
          label: label || nextLead.crm?.existingVehicle?.label || null,
          role: 'existing_vehicle',
          tradeInCandidate: false,
          source: 'seller_input',
          updatedAt: new Date().toISOString(),
        },
      },
    };
    if (label) labels.push(`Aktuelles Fahrzeug: ${label}`);
  }

  if (tradeInRequested || tradeInVehicleFact) {
    const current = getTradeIn(nextLead);
    const vehicleFact = tradeInVehicleFact || (tradeInRequested ? existingVehicle : null);
    const vehicleLabel = vehicleFact?.value?.model
      ? [vehicleFact.value.make, vehicleFact.value.model].filter(Boolean).join(' ')
      : (vehicleFact?.label
        ? String(vehicleFact.label).replace(/^Inzahlungnahme:\s*/i, '')
        : current.vehicle);
    const year = vehicleFact?.value?.year ?? null;
    const mileageKm = vehicleFact?.value?.mileageKm ?? null;
    const mileageApprox = Boolean(vehicleFact?.value?.mileageApproximate);
    const possible = tradeInRequestedFact?.value?.status === 'possible'
      || /eventuell/i.test(String(tradeInRequestedFact?.label || ''));
    const detailParts = [];
    if (year) detailParts.push(String(year));
    if (mileageKm != null) {
      detailParts.push(
        `${mileageApprox ? 'ca. ' : ''}${Number(mileageKm).toLocaleString('de-DE')} km`,
      );
    }
    if (possible) detailParts.push('Inzahlungnahme eventuell');
    else if (tradeInRequested) detailParts.push('Inzahlungnahme gewünscht');
    nextLead = {
      ...nextLead,
      crm: {
        ...(nextLead.crm ?? {}),
        tradeIn: patchTradeIn(current, {
          vehicle: vehicleLabel || current.vehicle,
          notes: [
            current.notes,
            detailParts.join(' · '),
          ].filter(Boolean).join(' · '),
        }),
        ...(existingVehicle ? {
          existingVehicle: {
            ...(nextLead.crm?.existingVehicle || {}),
            make: existingVehicle.value?.make || null,
            model: existingVehicle.value?.model || null,
            color: existingVehicle.value?.color || null,
            label: vehicleLabel || null,
            role: 'existing_vehicle',
            tradeInCandidate: true,
            source: 'seller_input',
            updatedAt: new Date().toISOString(),
          },
        } : {}),
      },
    };
  }

  if (options.postFeedCard !== false) {
    const lines = labels.slice(0, 8);
    const preparedLabels = (turn.preparedActions ?? [])
      .filter((a) => a.status === 'prepared')
      .map((a) => a.label || a.type)
      .filter(Boolean)
      .slice(0, 4);
    const text = lines.length
      ? `${lines.join(' · ')}\n\n${labels.length} Angabe${labels.length === 1 ? '' : 'n'} übernommen`
      : (preparedLabels.length
        ? `Vorbereitet: ${preparedLabels.join(' · ')}`
        : (String(turn.messageDraft ?? turn.assistantReply ?? '').trim() || 'Clever hat vorbereitet'));
    if (String(text).trim()) {
      const isHomepageDual = Boolean(turn.homepageInquiry?.hasDualScenarios)
        || facts.some((f) => f.field === 'commercialScenarios');
      const isCustomerReply = Boolean(turn.customerReply?.detected);
      const reviewType = turn.reviewModel?.reviewType || turn.reviewType || null;
      const isInbound = Boolean(turn.inboundLead?.detected)
        || reviewType === 'customer_intake_review'
        || reviewType === 'inbound_lead_review';
      const posted = postCleverAssistFeedCard({
        lead: nextLead,
        title: isCustomerReply
          ? 'Kundenantwort übernommen'
          : isInbound
            ? 'Anfrage übernommen'
            : isHomepageDual
              ? 'Anfrage übernommen'
              : 'Übernommen',
        text,
        visibleToCustomer: false,
      });
      if (posted.message) nextLead = posted.lead;
    }
  }

  // Facts + Unterlagen-Paket in einem Accept
  const docsWithFacts = applyDocumentsPackageIfPresent(nextLead, turn, options);
  if (docsWithFacts.applied) {
    nextLead = docsWithFacts.lead;
    labels.push('Sicheren Upload-Link gesendet');
  }

  // Persistent Working Drafts auf Lead (Reload / Handoff by ID)
  const offerAction = (turn.preparedActions || []).find((a) => (
    a.type === SELLER_TURN_INTENTS.PREPARE_OFFER
    && (a.payload?.offerDraftId || a.payload?.batch)
  ));
  if (offerAction?.payload?.batch && Array.isArray(offerAction.payload.offers)) {
    for (const od of offerAction.payload.offers) {
      if (!od?.offerDraftId) continue;
      nextLead = upsertOfferDraftOnLead(nextLead, od, {
        changedFields: [],
      });
    }
  } else if (offerAction?.payload?.offerDraftId) {
    const bundle = ensureOfferDraftBundleFromPayload(offerAction.payload, {
      lead: nextLead,
      sellerInput: turn.sellerInput || '',
    });
    if (bundle?.offerDraft) {
      nextLead = upsertOfferDraftOnLead(nextLead, {
        ...bundle.offerDraft,
        vehicleIdentityDraft: bundle.vehicleIdentityDraft,
      }, {
        changedFields: offerAction.payload.lastChangedFields || [],
      });
    }
  } else if (
    // Clever Agent V1: Capture mit genug Identity/Konditionen → Concept-Draft (rate null)
    facts.some((f) => f.field === 'vehicleInterest' && f.value?.modelKey && !f.needsConfirmation)
    && facts.some((f) => (
      !f?.needsConfirmation && (
        f.field === 'termMonths'
        || f.field === 'durationMonths'
        || f.field === 'annualMileage'
        || f.field === 'colorPreference'
        || f.field === 'motorPreference'
      )
    ))
  ) {
    const ensured = ensureConceptOfferDraftFromCapture(nextLead, facts, {
      sellerInput: turn.sellerInput || '',
      createNewAlternative: true,
    });
    nextLead = ensured.lead;
  }
  const msgAction = (turn.preparedActions || []).find((a) => (
    a.type === SELLER_TURN_INTENTS.DRAFT_MESSAGE && a.payload?.messageDraft
  ));
  if (msgAction?.payload?.messageDraftId) {
    nextLead = upsertMessageDraftOnLead(nextLead, {
      messageDraftId: msgAction.payload.messageDraftId,
      body: msgAction.payload.messageDraft,
      intendSend: Boolean(msgAction.payload.intendSend),
      customerId: nextLead.id,
      status: msgAction.payload.intendSend ? 'pending_send' : 'draft',
    });
  }

  return {
    ok: true,
    lead: nextLead,
    acceptedLabels: labels,
    created: createdFromInbound,
    documentsPackageSent: Boolean(docsWithFacts.applied),
    uploadUrl: docsWithFacts.uploadUrl || null,
  };
}
