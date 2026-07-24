/**
 * Clever KI-Check → direkt Kundenakte (ohne Pflicht-Bestätigungsformular)
 */
import { generateOfferNumber } from '../logic/offerService.js';
import { normalizeLead } from '../logic/leadNormalization.js';
import { joinKundenhelferNotes, parseKundenhelferNotes } from './cleverKundenhelfer.js';
import { appendSellerInsightsFromTexts, SELLER_INSIGHT_CONTEXT } from './dealer/sellerInsights.js';
import { buildDefaultCrm, buildLeadSubline, mapSuggestedModelToReserved } from './dealerAiLeadCrm.js';
import { createCustomerId } from './dealerAiCustomer.js';
import {
  applyRecognitionInsightToParsed,
  buildCustomerRecognitionInsight,
} from './dealerAiRecognitionInsight.js';

function collectReferenceCodes(getExistingCodes, leads = []) {
  const codes = [];
  const existing = getExistingCodes?.();
  if (existing) {
    for (const code of existing) codes.push({ code });
  }
  for (const lead of leads) {
    if (lead.referenceCode) codes.push({ code: lead.referenceCode });
    if (lead.offerCode) codes.push({ code: lead.offerCode });
  }
  return codes;
}

function normalizeModelToken(value = '') {
  return String(value).toLowerCase().replace(/[^a-z0-9]/g, '');
}

export function mergeKundenhelferChipLists(existingNotes = '', additions = []) {
  const merged = joinKundenhelferNotes([
    ...parseKundenhelferNotes(existingNotes),
    ...additions,
  ]);
  return merged;
}

export function mergeReservedModels(existing = [], incoming = []) {
  const next = [...existing];
  const duplicates = [];

  for (const model of incoming) {
    const token = normalizeModelToken(model.modelKey ?? model.name);
    const duplicate = next.find((item) => normalizeModelToken(item.modelKey ?? item.name) === token);
    if (duplicate) {
      duplicates.push(model);
      continue;
    }
    next.push(model);
  }

  return { models: next, duplicates };
}

export function buildReservedModelFromInsight(insight = {}, enriched = {}) {
  const recommendation = insight.recommendation;
  const vehicleWish = insight.vehicleWish ?? {};
  const modelKey = recommendation?.modelKey ?? vehicleWish.modelKey ?? null;
  const modelLabel = recommendation?.modelLabel
    ?? vehicleWish.modelLabel
    ?? (vehicleWish.modelHint ? `Kia ${vehicleWish.modelHint}` : null);

  if (!modelKey && !modelLabel) return [];

  const fields = enriched?.fields ?? {};
  const paymentType = fields.paymentType ?? insight.paymentWish?.paymentType ?? 'unknown';

  const reserved = mapSuggestedModelToReserved({
    id: modelKey ?? normalizeModelToken(modelLabel),
    name: modelLabel?.replace(/^Kia\s+/i, 'Kia ') ?? 'Kia',
    modelKey: modelKey ?? normalizeModelToken(modelLabel),
    bodyType: vehicleWish.bodyType ?? 'suv',
    badge: recommendation?.status === 'prüfen' ? 'Vorschlag / prüfen' : 'Vorschlag / prüfen',
    reason: recommendation?.reasonBullets?.[0] ?? null,
    trimLabel: fields.trimLabel ?? null,
    priceHint: vehicleWish.budget
      ? `Budget bis ${Number(vehicleWish.budget).toLocaleString('de-DE')} €`
      : null,
    paymentType,
    colorPreference: vehicleWish.colorPreference ?? null,
    batteryLabel: vehicleWish.batteryLabel ?? null,
    desiredDate: vehicleWish.desiredDate ?? null,
    vehicleType: vehicleWish.vehicleType ?? null,
  }, 0);

  return [{ ...reserved, badge: 'Vorschlag / prüfen', isPrimary: true }];
}

export function resolveTargetLeadForDirectAkte(deps = {}) {
  const { addVehicleContext, leads = [], carryCustomer, result } = deps;
  const leadId = addVehicleContext?.opportunityId
    ?? addVehicleContext?.leadId
    ?? result?.leadId
    ?? null;
  if (leadId) return leads.find((lead) => lead.id === leadId) ?? null;

  if (carryCustomer?.customerId) {
    const matches = leads.filter((lead) => lead.customerId === carryCustomer.customerId);
    if (!matches.length) return null;
    return [...matches].sort((a, b) => new Date(b.updatedAt ?? b.createdAt) - new Date(a.updatedAt ?? a.createdAt))[0];
  }

  return null;
}

import {
  addressToStorageFields,
  normalizeAddressResult,
} from './location/customerAddressModel.js';

function buildContactFromFields(fields = {}, existing = {}, carryCustomer = null) {
  const carryContact = carryCustomer?.contact ?? {};
  const addressStorage = fields.customerAddress
    ? addressToStorageFields(normalizeAddressResult({
      street: fields.addressStreet,
      houseNumber: fields.addressHouseNumber,
      postalCode: fields.addressPostalCode,
      city: fields.addressCity,
      formattedAddress: fields.customerAddress,
    }))
    : addressToStorageFields({ formattedAddress: fields.customerAddress ?? existing.address ?? carryContact.address ?? '' });
  const address = addressStorage.address;
  return {
    name: fields.customerName || existing.name || carryContact.name || 'Kunde (offen)',
    phone: fields.customerPhone || existing.phone || carryContact.phone || '',
    email: fields.customerEmail || existing.email || carryContact.email || '',
    address,
    preferredContact: existing.preferredContact ?? 'phone',
  };
}

function buildAddressCrmFields(fields = {}) {
  if (!fields.customerAddress && !fields.addressStreet) return {};
  return addressToStorageFields(normalizeAddressResult({
    street: fields.addressStreet,
    houseNumber: fields.addressHouseNumber,
    postalCode: fields.addressPostalCode,
    city: fields.addressCity,
    formattedAddress: fields.customerAddress,
  }));
}

function appendSourceTextNote(existingNotes = '', sourceText = '') {
  const trimmed = String(sourceText ?? '').trim();
  if (!trimmed) return existingNotes;
  const marker = 'KI-Quelle:';
  if (String(existingNotes).includes(marker)) return existingNotes;
  const block = `${marker}\n${trimmed.slice(0, 1200)}`;
  return existingNotes?.trim() ? `${existingNotes.trim()}\n\n${block}` : block;
}

export function buildLeadPatchFromDirectAkte(existingLead, enriched, insight) {
  const fields = enriched?.fields ?? {};
  const now = new Date().toISOString();
  const helperNoteTexts = enriched?.customerHelperNotes ?? insight?.customerHelperNotes ?? [];
  const withInsights = helperNoteTexts.length
    ? appendSellerInsightsFromTexts(existingLead ?? { crm: {} }, helperNoteTexts, {
      context: SELLER_INSIGHT_CONTEXT.EMAIL,
    })
    : (existingLead ?? { crm: {} });
  const reservedMerge = mergeReservedModels(
    existingLead?.crm?.reservedModels ?? [],
    buildReservedModelFromInsight(insight, enriched),
  );

  const vehicleLabel = [fields.brand, fields.model, fields.trimLabel].filter(Boolean).join(' ').trim();
  const addressFields = buildAddressCrmFields(fields);

  return {
    contact: buildContactFromFields(fields, existingLead?.contact ?? {}),
    vehicle: vehicleLabel
      ? {
          brand: fields.brand ?? existingLead?.vehicle?.brand ?? 'Kia',
          model: fields.model ?? existingLead?.vehicle?.model ?? '',
          trim: fields.trimLabel ?? existingLead?.vehicle?.trim ?? '',
          engine: fields.motorLabel ?? existingLead?.vehicle?.engine ?? '',
          label: vehicleLabel || existingLead?.vehicle?.label || 'Kia – Modell offen',
        }
      : existingLead?.vehicle,
    paymentType: fields.paymentType && fields.paymentType !== 'unknown'
      ? fields.paymentType
      : existingLead?.paymentType,
    desiredRate: fields.desiredRate ?? existingLead?.desiredRate ?? null,
    wish: {
      ...(existingLead?.wish ?? {}),
      termMonths: fields.termMonths ?? existingLead?.wish?.termMonths ?? null,
      mileagePerYear: fields.mileagePerYear ?? existingLead?.wish?.mileagePerYear ?? null,
      downPayment: fields.downPayment ?? existingLead?.wish?.downPayment ?? 0,
      paymentType: fields.paymentType ?? existingLead?.wish?.paymentType ?? 'unknown',
      desiredPrice: fields.desiredPrice ?? existingLead?.wish?.desiredPrice ?? null,
    },
    deliveryTime: fields.desiredDeliveryDate ?? fields.deliveryTime ?? existingLead?.deliveryTime ?? null,
    notes: appendSourceTextNote(existingLead?.notes ?? '', insight?.sourceText),
    crm: {
      ...(existingLead?.crm ?? {}),
      ...addressFields,
      address: addressFields.address ?? existingLead?.crm?.address ?? existingLead?.contact?.address ?? '',
      sellerInsights: withInsights.crm?.sellerInsights ?? existingLead?.crm?.sellerInsights ?? [],
      kundenhelfer: {
        ...(existingLead?.crm?.kundenhelfer ?? {}),
        voiceMemos: existingLead?.crm?.kundenhelfer?.voiceMemos ?? [],
      },
      reservedModels: reservedMerge.models,
      recognitionStatus: 'applied',
      sourceText: insight?.sourceText ?? existingLead?.crm?.sourceText ?? null,
    },
    history: [
      ...(existingLead?.history ?? []),
      {
        id: `h-${Date.now()}`,
        at: now,
        type: 'system',
        text: reservedMerge.duplicates.length
          ? 'KI-Check: Infos übernommen – Fahrzeugwunsch bereits vorhanden'
          : 'KI-Check: Infos übernommen',
      },
    ],
    updatedAt: now,
  };
}

function buildNewLeadFromDirectAkte(enriched, insight, deps) {
  const { conditions, getExistingCodes, leads = [], carryCustomer } = deps;
  const fields = enriched.fields ?? {};
  const referenceCode = generateOfferNumber(collectReferenceCodes(getExistingCodes, leads));
  const helperNoteTexts = enriched?.customerHelperNotes ?? insight?.customerHelperNotes ?? [];
  const reservedModels = buildReservedModelFromInsight(insight, enriched);
  const crmBase = buildDefaultCrm(enriched, []);
  const addressFields = buildAddressCrmFields(fields);
  const withInsights = helperNoteTexts.length
    ? appendSellerInsightsFromTexts({ crm: crmBase }, helperNoteTexts, {
      context: SELLER_INSIGHT_CONTEXT.EMAIL,
    })
    : { crm: crmBase };
  const crm = {
    ...crmBase,
    ...addressFields,
    address: addressFields.address ?? fields.customerAddress ?? '',
    reservedModels,
    recognitionStatus: 'applied',
    sourceText: insight?.sourceText ?? null,
    sellerInsights: withInsights.crm?.sellerInsights ?? [],
    kundenhelfer: {
      ...(crmBase.kundenhelfer ?? {}),
      voiceMemos: carryCustomer?.kundenhelfer?.voiceMemos ?? crmBase.kundenhelfer?.voiceMemos ?? [],
    },
  };

  const customerId = carryCustomer?.customerId ?? createCustomerId();
  const contact = buildContactFromFields(fields, {}, carryCustomer);
  const vehicleLabel = [fields.brand, fields.model, fields.trimLabel].filter(Boolean).join(' ').trim();
  const now = new Date().toISOString();

  return normalizeLead({
    id: `lead-ai-${Date.now()}`,
    customerId,
    referenceCode,
    createdAt: now,
    updatedAt: now,
    status: 'neu',
    source: 'dealerAi',
    dealerId: conditions.dealerId ?? 'autohaus-trinkle',
    contact,
    vehicle: {
      brand: fields.brand ?? 'Kia',
      model: fields.model ?? '',
      trim: fields.trimLabel ?? '',
      engine: fields.motorLabel ?? '',
      label: vehicleLabel || reservedModels[0]?.name || 'Kia – Modell offen',
    },
    paymentType: fields.paymentType ?? 'unknown',
    desiredRate: fields.desiredRate ?? null,
    wish: {
      termMonths: fields.termMonths ?? null,
      mileagePerYear: fields.mileagePerYear ?? null,
      downPayment: fields.downPayment ?? 0,
      paymentType: fields.paymentType ?? 'unknown',
      desiredPrice: fields.desiredPrice ?? null,
    },
    deliveryTime: fields.desiredDeliveryDate ?? fields.deliveryTime ?? null,
    notes: appendSourceTextNote('', insight?.sourceText),
    crm,
    history: [{
      id: `h-${Date.now()}`,
      at: now,
      type: 'system',
      text: 'Kundenakte aus KI-Check vorbereitet',
    }],
  });
}

export function applyDirectCustomerAkteFromRecognition(enriched, insight, deps = {}) {
  if (!enriched?.ok || !insight) {
    throw new Error('Erkennung unvollständig');
  }

  const existingLead = resolveTargetLeadForDirectAkte(deps);

  if (existingLead) {
    const patch = buildLeadPatchFromDirectAkte(existingLead, enriched, insight);
    const updated = normalizeLead({ ...existingLead, ...patch });
    deps.updateLead?.(existingLead.id, patch);
    return {
      type: 'lead',
      leadId: existingLead.id,
      leadName: updated.contact?.name,
      leadSubline: buildLeadSubline(enriched.fields ?? {}),
      referenceCode: existingLead.referenceCode ?? null,
      customerId: existingLead.customerId,
      isReturningWish: true,
      extendedExisting: true,
      duplicateVehicle: (patch.crm?.reservedModels?.length ?? 0) === (existingLead.crm?.reservedModels?.length ?? 0)
        && Boolean(insight.recommendation?.modelLabel),
      message: patch.history?.at(-1)?.text ?? 'Kundenakte erweitert – Infos übernommen.',
    };
  }

  const lead = buildNewLeadFromDirectAkte(enriched, insight, deps);
  deps.addLead?.(lead);
  return {
    type: 'lead',
    leadId: lead.id,
    leadName: lead.contact?.name,
    leadSubline: buildLeadSubline(enriched.fields ?? {}),
    referenceCode: lead.referenceCode,
    customerId: lead.customerId,
    isReturningWish: Boolean(deps.carryCustomer),
    extendedExisting: false,
    message: 'Kundenakte vorbereitet – Clever hat alles sortiert.',
  };
}

export function prepareDirectCustomerAkteFromSource(sourceText = '', parsed = {}, enrichFn = (value) => value) {
  const insight = buildCustomerRecognitionInsight(sourceText, parsed);
  const merged = applyRecognitionInsightToParsed(parsed, insight);
  const enriched = enrichFn(merged);
  return { insight, enriched };
}

export const SCHLAYER_SAMPLE_TEXT = `Schlayer Alexander Aalen 'Alexander Schlayer' <S_Alexander1@hotmail.de>
0174 5848458

Aalen
Buchsweg 38
73547

EV3 AIR
November 2026
LEASING
Corporate Benefits
ledig
keine Kinder
Audi A4
48 10.000 km 2000 € Anzahlung`;

export const DIRECT_AKTE_SAMPLE_TEXT = `Peter Schwan
01755 5484877
peterschwan@gmail.com
E-Soul GW 28.07.2026
bis 30.000 €
Keine Förderung
Wohnmobil
50 KW Batterie
Farbe blau`;
