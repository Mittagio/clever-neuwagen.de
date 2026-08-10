/**
 * Offer-Draft aus bestehender Lead-Karte + vehicleOffer (für Angebot prüfen).
 */
import { buildParsedFromLead } from '../leadAkteEntry.js';
import { buildVehicleConfiguration } from '../configuration/vehicleConfigurationModel.js';
import { buildOfferDraft } from '../dealerAiOfferCreate.js';
import {
  buildConfigureDraftFromStoredConfiguration,
  buildWishFieldsFromLead,
  enrichOfferEditCardFromLead,
  resolveEffectivePaymentType,
} from './offerEditWishMerge.js';

function resolveCardConfiguration(lead, card) {
  const configs = lead?.crm?.vehicleConfigurations ?? [];
  const id = card?.configurationId ?? card?.id;
  if (id) {
    const byId = configs.find((entry) => entry.id === id);
    if (byId) return byId;
  }
  if (card?.modelKey) {
    return configs.find((entry) => entry.modelKey === card.modelKey) ?? null;
  }
  return null;
}

function readStoredVehicleOffer(card = {}, lead = null) {
  const id = card?.configurationId ?? card?.id;
  return card?.vehicleOffer
    ?? (id ? lead?.crm?.vehicleOffers?.[id] : null)
    ?? null;
}

function resolveOriginalPdf(vehicleOffer = null) {
  if (!vehicleOffer) return null;
  const fromSource = vehicleOffer.source?.originalPdf ?? null;
  if (fromSource?.dataUrl || fromSource?.url) return fromSource;
  const pdf = vehicleOffer.pdf ?? null;
  if (pdf?.dataUrl || pdf?.url) {
    return {
      fileName: pdf.fileName ?? pdf.name ?? 'angebot.pdf',
      uploadedAt: pdf.uploadedAt ?? null,
      sizeBytes: pdf.sizeBytes ?? null,
      dataUrl: pdf.dataUrl ?? null,
      url: pdf.url ?? null,
    };
  }
  return null;
}

function buildFallbackConfigureDraft(enriched = {}, wishFields = {}) {
  if (!enriched?.modelKey && !enriched?.modelName) return null;
  const paymentType = resolveEffectivePaymentType(
    enriched.paymentType,
    wishFields.paymentType,
    'leasing',
  );
  const model = String(enriched.modelName ?? '')
    .replace(/^kia\s+/i, '')
    .trim();
  return {
    brand: 'Kia',
    model: model || enriched.modelKey || '',
    modelKey: enriched.modelKey ?? null,
    trimId: enriched.trimId ?? null,
    trimLabel: enriched.trimLabel ?? null,
    paymentType,
    termMonths: enriched.termMonths ?? wishFields.termMonths ?? 48,
    mileagePerYear: enriched.mileagePerYear ?? wishFields.mileagePerYear ?? 15000,
    downPayment: enriched.downPayment ?? wishFields.downPayment ?? 0,
    desiredRate: enriched.calculatedRate
      ?? enriched.desiredRate
      ?? wishFields.desiredRate
      ?? null,
    desiredPrice: enriched.calculatedPrice
      ?? enriched.desiredPrice
      ?? wishFields.desiredPrice
      ?? null,
    preparationFee: enriched.preparationFee ?? null,
  };
}

/**
 * Baut configureDraft + offerDraft für die einheitliche „Angebot prüfen“-Ansicht.
 * @returns {{ offerDraft: object, configureDraft: object, vehicleConfiguration: object, vehicleCardId: string }|null}
 */
export function buildOfferDraftFromExistingCard({
  lead = null,
  card = null,
  conditions = {},
  carryCustomer = null,
  addVehicleContext = null,
  parsed = null,
} = {}) {
  if (!card || !lead) return null;

  const enriched = enrichOfferEditCardFromLead(card, lead);
  const vehicleCardId = enriched.configurationId ?? enriched.id ?? null;
  if (!vehicleCardId) return null;

  const storedConfig = resolveCardConfiguration(lead, enriched);
  const wishFields = buildWishFieldsFromLead(lead);
  let configureDraft = storedConfig
    ? buildConfigureDraftFromStoredConfiguration(storedConfig, wishFields)
    : buildFallbackConfigureDraft(enriched, wishFields);

  if (!configureDraft) return null;

  if (enriched.calculatedRate != null) {
    configureDraft = {
      ...configureDraft,
      desiredRate: enriched.calculatedRate,
    };
  }
  if (enriched.calculatedPrice != null) {
    configureDraft = {
      ...configureDraft,
      desiredPrice: enriched.calculatedPrice,
    };
  }
  if (enriched.termMonths != null) {
    configureDraft = { ...configureDraft, termMonths: enriched.termMonths };
  }
  if (enriched.mileagePerYear != null) {
    configureDraft = { ...configureDraft, mileagePerYear: enriched.mileagePerYear };
  }
  if (enriched.downPayment != null) {
    configureDraft = { ...configureDraft, downPayment: enriched.downPayment };
  }
  if (enriched.preparationFee != null) {
    configureDraft = { ...configureDraft, preparationFee: enriched.preparationFee };
  }

  const vehicleConfiguration = buildVehicleConfiguration(configureDraft);
  const baseParsed = parsed?.ok ? parsed : buildParsedFromLead(lead);
  const vehicleOffer = readStoredVehicleOffer(enriched, lead);
  const originalPdf = resolveOriginalPdf(vehicleOffer);

  let offerDraft = buildOfferDraft({
    configureDraft,
    vehicleConfiguration,
    parsed: baseParsed,
    conditions,
    carryCustomer,
    addVehicleContext: {
      ...(addVehicleContext ?? {}),
      opportunityId: addVehicleContext?.opportunityId ?? lead.id,
      customerId: addVehicleContext?.customerId ?? lead.customerId ?? lead.id,
      vehicleCardId,
    },
    lead,
  });

  if (!offerDraft) return null;

  const rate = enriched.calculatedRate
    ?? vehicleOffer?.monthlyRate
    ?? vehicleOffer?.boardOffer?.payment?.monthlyRate
    ?? offerDraft.payment?.calculatedRate
    ?? null;
  const isCash = (configureDraft.paymentType ?? offerDraft.payment?.type) === 'cash';
  const cashPrice = enriched.calculatedPrice
    ?? vehicleOffer?.boardOffer?.payment?.cashPrice
    ?? null;

  if (rate != null || cashPrice != null) {
    const value = isCash ? (cashPrice ?? rate) : rate;
    offerDraft = {
      ...offerDraft,
      payment: {
        ...offerDraft.payment,
        calculatedRate: value,
        budget: value,
        termMonths: enriched.termMonths ?? offerDraft.payment.termMonths,
        mileagePerYear: enriched.mileagePerYear ?? offerDraft.payment.mileagePerYear,
        downPayment: enriched.downPayment ?? offerDraft.payment.downPayment ?? 0,
        transferCost: enriched.preparationFee ?? offerDraft.payment.transferCost,
      },
      offerPreview: {
        ...offerDraft.offerPreview,
        monthlyRate: value,
      },
      offerCalculation: {
        ...offerDraft.offerCalculation,
        monthlyRate: value,
        termMonths: enriched.termMonths ?? offerDraft.offerCalculation?.termMonths,
        mileagePerYear: enriched.mileagePerYear ?? offerDraft.offerCalculation?.mileagePerYear,
        downPayment: enriched.downPayment ?? offerDraft.offerCalculation?.downPayment,
      },
    };
  }

  const createdFromPdf = Boolean(originalPdf)
    || vehicleOffer?.source?.createdFrom === 'magic_offer_pdf';

  offerDraft = {
    ...offerDraft,
    vehicleCardId,
    existingVehicleOfferId: vehicleOffer?.id ?? `vo-${vehicleCardId}`,
    version: Number(vehicleOffer?.version) || 1,
    versions: Array.isArray(vehicleOffer?.versions) ? vehicleOffer.versions : [],
    updatedAt: vehicleOffer?.updatedAt ?? null,
    preparedAt: vehicleOffer?.preparedAt ?? null,
    createdAt: vehicleOffer?.createdAt ?? null,
    monthlyRate: vehicleOffer?.monthlyRate
      ?? offerDraft.payment?.calculatedRate
      ?? null,
    source: {
      ...offerDraft.source,
      createdFrom: createdFromPdf
        ? 'magic_offer_pdf'
        : (vehicleOffer?.source?.createdFrom ?? offerDraft.source?.createdFrom ?? 'dealer_ai_mail'),
      originalPdf: originalPdf ?? null,
      previousPdfs: Array.isArray(vehicleOffer?.source?.previousPdfs)
        ? vehicleOffer.source.previousPdfs
        : [],
    },
  };

  return {
    offerDraft,
    configureDraft,
    vehicleConfiguration,
    vehicleCardId,
  };
}
