/**
 * Zentraler Apply-Pfad für Kundenwissen: Click-Mini-Editor und Composer
 * mutieren denselben NeedProfile-/Track-State über applyStructuredFactsToLead.
 *
 * „Klick und Sprache führen auf denselben State.“
 */
import { getNeedProfileFromLead, mergeNeedProfileIntoLead } from '../consultation/needProfileService.js';
import { appendSellerInsightsFromTexts } from '../dealer/sellerInsights.js';
import { SNAPSHOT_MINI_EDITOR } from '../dealer/buildCustomerSnapshotModel.js';
import { applyStructuredFactsToLead } from './applyAcceptedSellerTurn.js';
import { createExtractedFact } from './cleverSellerTurnResultSchema.js';
import { SELLER_FACT_CLASS, SELLER_FACT_SOURCE } from './sellerFactTypes.js';

export const CUSTOMER_KNOWLEDGE_KIND = Object.freeze({
  CHILDREN: 'children',
  DOG: 'dog',
  COLOR: 'color',
  FUEL: 'fuel',
  DRIVE: 'drive',
  MODEL: 'model',
  EQUIPMENT: 'equipment',
  FREE_NOTE: 'freeNote',
  DESIRED_RATE: 'desiredRate',
  TERM_MONTHS: 'termMonths',
  MILEAGE: 'mileagePerYear',
  DOWN_PAYMENT: 'downPayment',
  PAYMENT_TYPE: 'paymentType',
  DELIVERY: 'delivery',
});

const FUEL_VALUES = {
  electric: 'electric',
  elektro: 'electric',
  hybrid: 'hybrid',
  phev: 'phev',
  'plug-in-hybrid': 'phev',
  'plug-in': 'phev',
  benzin: 'benzin',
  benziner: 'benzin',
  diesel: 'diesel',
};

const DRIVE_VALUES = {
  allrad: 'awd',
  awd: 'awd',
  frontantrieb: 'fwd',
  fwd: 'fwd',
  heckantrieb: 'rwd',
  rwd: 'rwd',
  offen: null,
};

/**
 * @param {string} editorKey
 * @returns {string|null}
 */
export function knowledgeKindFromMiniEditor(editorKey) {
  const map = {
    [SNAPSHOT_MINI_EDITOR.CHILDREN]: CUSTOMER_KNOWLEDGE_KIND.CHILDREN,
    [SNAPSHOT_MINI_EDITOR.DOG]: CUSTOMER_KNOWLEDGE_KIND.DOG,
    [SNAPSHOT_MINI_EDITOR.COLOR]: CUSTOMER_KNOWLEDGE_KIND.COLOR,
    [SNAPSHOT_MINI_EDITOR.FUEL]: CUSTOMER_KNOWLEDGE_KIND.FUEL,
    [SNAPSHOT_MINI_EDITOR.DRIVE]: CUSTOMER_KNOWLEDGE_KIND.DRIVE,
    [SNAPSHOT_MINI_EDITOR.MODEL]: CUSTOMER_KNOWLEDGE_KIND.MODEL,
    [SNAPSHOT_MINI_EDITOR.EQUIPMENT]: CUSTOMER_KNOWLEDGE_KIND.EQUIPMENT,
    [SNAPSHOT_MINI_EDITOR.FREE_NOTE]: CUSTOMER_KNOWLEDGE_KIND.FREE_NOTE,
    [SNAPSHOT_MINI_EDITOR.DESIRED_RATE]: CUSTOMER_KNOWLEDGE_KIND.DESIRED_RATE,
    [SNAPSHOT_MINI_EDITOR.TERM_MONTHS]: CUSTOMER_KNOWLEDGE_KIND.TERM_MONTHS,
    [SNAPSHOT_MINI_EDITOR.MILEAGE]: CUSTOMER_KNOWLEDGE_KIND.MILEAGE,
    [SNAPSHOT_MINI_EDITOR.DOWN_PAYMENT]: CUSTOMER_KNOWLEDGE_KIND.DOWN_PAYMENT,
    [SNAPSHOT_MINI_EDITOR.PAYMENT_TYPE]: CUSTOMER_KNOWLEDGE_KIND.PAYMENT_TYPE,
    [SNAPSHOT_MINI_EDITOR.PRIORITY_DELIVERY]: CUSTOMER_KNOWLEDGE_KIND.DELIVERY,
  };
  return map[editorKey] || null;
}

function fact(field, value, label, extra = {}) {
  return createExtractedFact({
    factClass: extra.factClass || SELLER_FACT_CLASS.CUSTOMER_FACT,
    field,
    value,
    label,
    source: extra.source || SELLER_FACT_SOURCE.MANUAL_EDIT,
    confidence: 1,
    needsConfirmation: false,
    previousValue: extra.previousValue ?? null,
    correctionSource: extra.correctionSource || 'seller_correction',
  });
}

function resolveChildren(profile = {}) {
  const n = profile.children ?? profile.household?.childrenCount;
  return Number.isFinite(Number(n)) ? Number(n) : 0;
}

/**
 * Baut Facts + optionale Direct-Patches für einen Knowledge-Change.
 * @param {object} lead
 * @param {{ kind: string, draft?: object, factId?: string|null, source?: string, actor?: object }} change
 */
export function buildCustomerKnowledgeFacts(lead = {}, change = {}) {
  const kind = change.kind;
  const draft = change.draft || {};
  const profile = getNeedProfileFromLead(lead) || {};
  const source = change.source || SELLER_FACT_SOURCE.MANUAL_EDIT;
  const facts = [];
  const meta = { historyLabel: 'Kundenwissen aktualisiert', undoLabel: null };

  if (kind === CUSTOMER_KNOWLEDGE_KIND.CHILDREN) {
    const prev = resolveChildren(profile);
    const next = Math.max(0, Number(draft.children) || 0);
    facts.push(fact(
      'childrenCount',
      next,
      next === 1 ? '1 Kind' : `${next} Kinder`,
      {
        source,
        previousValue: prev > 0 ? { label: prev === 1 ? '1 Kind' : `${prev} Kinder`, value: prev } : null,
      },
    ));
    meta.historyLabel = 'Kinder aktualisiert';
    meta.undoLabel = next === 1 ? '1 Kind' : `${next} Kinder`;
    return { facts, meta, direct: null };
  }

  if (kind === CUSTOMER_KNOWLEDGE_KIND.DOG) {
    const hasDog = draft.dog !== false && draft.remove !== true;
    facts.push(fact(
      'pet',
      hasDog ? { type: 'dog', hasPet: true } : { type: 'dog', hasPet: false },
      hasDog ? '1 Hund' : 'Kein Hund',
      { source },
    ));
    meta.historyLabel = hasDog ? 'Hund aktualisiert' : 'Hund entfernt';
    meta.undoLabel = hasDog ? '1 Hund' : 'Hund entfernt';
    return { facts, meta, direct: null };
  }

  if (kind === CUSTOMER_KNOWLEDGE_KIND.COLOR) {
    const color = String(draft.preferredColor ?? draft.color ?? '').trim();
    if (!color) return { facts: [], meta, direct: null };
    facts.push(fact(
      'colorPreference',
      { color, targetScope: 'customer_preference' },
      color,
      { source, factClass: SELLER_FACT_CLASS.VEHICLE_REQUIREMENT },
    ));
    meta.historyLabel = 'Farbe aktualisiert';
    meta.undoLabel = `Farbe ${color}`;
    return { facts, meta, direct: null };
  }

  if (kind === CUSTOMER_KNOWLEDGE_KIND.FUEL) {
    const raw = String(draft.fuel ?? '').trim().toLowerCase();
    const fuel = FUEL_VALUES[raw] || raw;
    if (!fuel) return { facts: [], meta, direct: null };
    facts.push(fact(
      'fuelPreference',
      fuel,
      draft.fuelLabel || raw,
      { source, factClass: SELLER_FACT_CLASS.VEHICLE_REQUIREMENT },
    ));
    meta.historyLabel = 'Antrieb aktualisiert';
    meta.undoLabel = String(draft.fuelLabel || draft.fuel || fuel);
    return { facts, meta, direct: null };
  }

  if (kind === CUSTOMER_KNOWLEDGE_KIND.DRIVE) {
    const raw = String(draft.drive ?? '').trim().toLowerCase();
    const drive = Object.prototype.hasOwnProperty.call(DRIVE_VALUES, raw)
      ? DRIVE_VALUES[raw]
      : raw || null;
    meta.historyLabel = 'Traktion aktualisiert';
    meta.undoLabel = String(draft.driveLabel || draft.drive || 'Traktion');
    return {
      facts: [],
      meta,
      direct: { drive, removeDrive: draft.remove === true || raw === 'offen' },
    };
  }

  if (kind === CUSTOMER_KNOWLEDGE_KIND.MODEL) {
    const modelKey = String(draft.modelKey ?? '').trim().toLowerCase();
    if (!modelKey) return { facts: [], meta, direct: null };
    const modelLabel = String(draft.modelLabel || modelKey.toUpperCase());
    facts.push(fact(
      'vehicleInterest',
      { modelKey, model: modelLabel, brand: 'Kia' },
      modelLabel,
      { source, factClass: SELLER_FACT_CLASS.VEHICLE_INTEREST },
    ));
    meta.historyLabel = 'Modellwunsch aktualisiert';
    meta.undoLabel = modelLabel;
    return { facts, meta, direct: null };
  }

  if (kind === CUSTOMER_KNOWLEDGE_KIND.EQUIPMENT) {
    const label = String(draft.equipmentLabel || draft.label || '').trim();
    if (!label) return { facts: [], meta, direct: null };
    if (draft.remove === true || draft.status === 'remove') {
      meta.historyLabel = 'Ausstattung entfernt';
      meta.undoLabel = `${label} entfernt`;
      return { facts: [], meta, direct: { removeEquipment: label } };
    }
    facts.push(fact(
      'equipmentWish',
      { id: label, label, priority: draft.priority || 'preferred' },
      label,
      { source, factClass: SELLER_FACT_CLASS.VEHICLE_REQUIREMENT },
    ));
    meta.historyLabel = 'Ausstattung aktualisiert';
    meta.undoLabel = label;
    return { facts, meta, direct: null };
  }

  if (kind === CUSTOMER_KNOWLEDGE_KIND.FREE_NOTE) {
    const text = String(draft.noteText || draft.label || '').trim();
    if (!text) return { facts: [], meta, direct: null };
    meta.historyLabel = 'Notiz aktualisiert';
    meta.undoLabel = text.slice(0, 40);
    return {
      facts: [],
      meta,
      direct: {
        freeNote: text,
        replaceNote: String(draft.replaceLabel || '').trim() || null,
      },
    };
  }

  if (kind === CUSTOMER_KNOWLEDGE_KIND.DESIRED_RATE) {
    const rate = draft.desiredRate !== '' && draft.desiredRate != null
      ? Number(draft.desiredRate)
      : null;
    if (rate == null || !Number.isFinite(rate)) return { facts: [], meta, direct: null };
    facts.push(fact(
      'monthlyBudget',
      { amount: rate, basis: 'gross' },
      `${rate} €`,
      { source, factClass: SELLER_FACT_CLASS.COMMERCIAL_PREFERENCE },
    ));
    meta.historyLabel = 'Wunschrate aktualisiert';
    meta.undoLabel = `${rate} €`;
    return { facts, meta, direct: { desiredRateMode: draft.desiredRateMode || null } };
  }

  if (kind === CUSTOMER_KNOWLEDGE_KIND.TERM_MONTHS) {
    const months = Number(draft.termMonths);
    if (!Number.isFinite(months) || months <= 0) return { facts: [], meta, direct: null };
    facts.push(fact(
      'termMonths',
      months,
      `${months} Monate`,
      { source, factClass: SELLER_FACT_CLASS.COMMERCIAL_PREFERENCE },
    ));
    meta.historyLabel = 'Laufzeit aktualisiert';
    meta.undoLabel = `${months} Monate`;
    return { facts, meta, direct: null };
  }

  if (kind === CUSTOMER_KNOWLEDGE_KIND.MILEAGE) {
    const km = Number(draft.mileagePerYear);
    if (!Number.isFinite(km) || km <= 0) return { facts: [], meta, direct: null };
    facts.push(fact(
      'annualMileage',
      km,
      `${km.toLocaleString('de-DE')} km`,
      { source, factClass: SELLER_FACT_CLASS.COMMERCIAL_PREFERENCE },
    ));
    meta.historyLabel = 'Kilometer aktualisiert';
    meta.undoLabel = `${km.toLocaleString('de-DE')} km`;
    return { facts, meta, direct: null };
  }

  if (kind === CUSTOMER_KNOWLEDGE_KIND.DOWN_PAYMENT) {
    const down = Number(draft.downPayment);
    if (!Number.isFinite(down) || down < 0) return { facts: [], meta, direct: null };
    facts.push(fact(
      'downPayment',
      down,
      `${down.toLocaleString('de-DE')} € AZ`,
      { source, factClass: SELLER_FACT_CLASS.COMMERCIAL_PREFERENCE },
    ));
    meta.historyLabel = 'Anzahlung aktualisiert';
    meta.undoLabel = `${down.toLocaleString('de-DE')} € AZ`;
    return { facts, meta, direct: null };
  }

  if (kind === CUSTOMER_KNOWLEDGE_KIND.PAYMENT_TYPE) {
    const paymentType = String(draft.paymentType || '').trim();
    if (!paymentType) return { facts: [], meta, direct: null };
    facts.push(fact(
      'paymentType',
      paymentType,
      paymentType,
      { source, factClass: SELLER_FACT_CLASS.COMMERCIAL_PREFERENCE },
    ));
    meta.historyLabel = 'Zahlungsart aktualisiert';
    meta.undoLabel = paymentType;
    return { facts, meta, direct: null };
  }

  if (kind === CUSTOMER_KNOWLEDGE_KIND.DELIVERY) {
    meta.historyLabel = 'Lieferzeit aktualisiert';
    meta.undoLabel = String(draft.delivery || 'Lieferzeit');
    return {
      facts: [],
      meta,
      direct: { delivery: draft.delivery ?? '' },
    };
  }

  return { facts: [], meta, direct: null };
}

function applyDirectPatches(lead, direct = null, change = {}) {
  if (!direct) return lead;
  let next = lead;
  let profile = { ...(getNeedProfileFromLead(next) || {}) };
  let touched = false;

  if (Object.prototype.hasOwnProperty.call(direct, 'drive') || direct.removeDrive) {
    if (direct.removeDrive || direct.drive == null) {
      delete profile.drive;
      profile.priorities = (profile.priorities || []).filter((p) => p !== 'awd');
      profile.allradNeed = false;
    } else {
      profile.drive = direct.drive;
      if (direct.drive === 'awd') {
        profile.priorities = [...new Set([...(profile.priorities || []), 'awd'])];
        profile.allradNeed = true;
      } else {
        profile.priorities = (profile.priorities || []).filter((p) => p !== 'awd');
        profile.allradNeed = false;
      }
    }
    touched = true;
  }

  if (direct.removeEquipment) {
    const label = String(direct.removeEquipment).trim();
    const strip = (list) => (list || []).filter((item) => {
      const t = String(item ?? '').trim();
      return t.toLowerCase() !== label.toLowerCase()
        && !t.toLowerCase().startsWith(`${label.toLowerCase()} ·`);
    });
    profile.equipmentWishes = strip(profile.equipmentWishes);
    if (profile.equipmentWishPriorities) {
      const nextPri = { ...profile.equipmentWishPriorities };
      for (const key of Object.keys(nextPri)) {
        if (key.toLowerCase() === label.toLowerCase()) delete nextPri[key];
      }
      profile.equipmentWishPriorities = nextPri;
    }
    touched = true;
  }

  if (direct.desiredRateMode) {
    profile.budget = {
      ...(profile.budget || {}),
      rateMode: direct.desiredRateMode,
    };
    next = {
      ...next,
      wish: {
        ...(next.wish || {}),
        desiredRateMode: direct.desiredRateMode,
      },
    };
    touched = true;
  }

  if (direct.delivery != null) {
    next = {
      ...next,
      wish: {
        ...(next.wish || {}),
        desiredDeliveryDate: direct.delivery === 'wichtig' ? null : (direct.delivery || null),
        delivery: direct.delivery || null,
      },
    };
    if (direct.delivery === 'wichtig') {
      profile.priorities = [...new Set([...(profile.priorities || []), 'delivery'])];
    }
    touched = true;
  }

  if (direct.freeNote) {
    const opts = {
      source: 'seller_correction',
      actorType: change.actor?.type || 'seller',
      actorId: change.actor?.id || null,
      actorName: change.actor?.name || null,
    };
    if (direct.replaceNote) {
      const notes = (next.crm?.sellerInsights || []).filter((n) => {
        const t = String(n?.text || n?.label || n || '').trim().toLowerCase();
        return t !== String(direct.replaceNote).trim().toLowerCase();
      });
      next = {
        ...next,
        crm: {
          ...(next.crm || {}),
          sellerInsights: notes,
        },
      };
    }
    next = appendSellerInsightsFromTexts(next, [direct.freeNote], opts);
  }

  if (touched) {
    next = mergeNeedProfileIntoLead(next, profile);
  }
  return next;
}

/**
 * @param {object} lead
 * @param {{ kind: string, draft?: object, factId?: string|null, source?: string, actor?: object }} change
 * @returns {{ lead: object, meta: { historyLabel: string, undoLabel: string|null }, applied: boolean }}
 */
export function applyCustomerKnowledgeChange(lead = {}, change = {}) {
  const { facts, meta, direct } = buildCustomerKnowledgeFacts(lead, change);
  let next = lead;
  if (facts.length) {
    next = applyStructuredFactsToLead(next, facts);
  }
  next = applyDirectPatches(next, direct, change);

  // Kinder: family priority wie bisheriger Click-Pfad (Composer setzt sie nicht)
  if (change.kind === CUSTOMER_KNOWLEDGE_KIND.CHILDREN) {
    const profile = { ...(getNeedProfileFromLead(next) || {}) };
    const n = resolveChildren(profile);
    if (n > 0 && !(profile.priorities || []).includes('family')) {
      profile.priorities = [...(profile.priorities || []), 'family'];
      next = mergeNeedProfileIntoLead(next, profile);
    }
    if (n === 0) {
      profile.priorities = (profile.priorities || []).filter((p) => p !== 'family');
      next = mergeNeedProfileIntoLead(next, profile);
    }
  }

  const applied = facts.length > 0 || Boolean(direct);
  return { lead: next, meta, applied };
}
