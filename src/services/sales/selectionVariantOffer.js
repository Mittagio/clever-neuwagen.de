/**
 * Angebot & PDF pro Clever-Auswahl-Variante.
 */
import { attachPdfToOffer } from '../vehicleOffer.js';

export const VARIANT_OFFER_STATUS = {
  DRAFT: 'draft',
  PDF_UPLOADED: 'pdf_uploaded',
  READY: 'ready',
};

export const VARIANT_OFFER_BUTTON_LABEL = 'Angebot & PDF';

/**
 * @param {object|null} variant
 */
export function readVariantOfferPdf(variant) {
  return variant?.offerPdf ?? null;
}

export function variantHasOfferPdf(variant) {
  return Boolean(readVariantOfferPdf(variant)?.fileName);
}

export function formatVariantOfferBadge(variant) {
  const pdf = readVariantOfferPdf(variant);
  if (pdf?.fileName) return 'PDF hinterlegt';
  return 'Noch kein PDF';
}

/**
 * @param {object} variant
 * @param {File} file
 */
export async function attachPdfToSelectionVariant(variant, file) {
  const base = { id: variant.id, vehicleCardId: variant.id };
  const withPdf = await attachPdfToOffer(base, file);
  return {
    ...variant,
    offerPdf: withPdf.pdf,
    offerStatus: VARIANT_OFFER_STATUS.PDF_UPLOADED,
    updatedAt: new Date().toISOString(),
  };
}

export function removePdfFromSelectionVariant(variant) {
  return {
    ...variant,
    offerPdf: null,
    offerStatus: VARIANT_OFFER_STATUS.DRAFT,
    updatedAt: new Date().toISOString(),
  };
}

export function buildVariantOfferSummaryLine(group, variant) {
  const trim = variant?.trimLabel ?? 'Ausstattung';
  const model = group?.modelLabel ?? 'Fahrzeug';
  return `${model} · ${trim}`;
}
