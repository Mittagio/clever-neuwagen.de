import { shareSessionLeadId } from '../advisor/sharePilotLead.js';

export function buildCustomerRecordId({ shareToken = null, customer = null } = {}) {
  if (shareToken) return `beratung-${String(shareToken).toLowerCase()}`;
  const key = customer?.email || customer?.phone || customer?.name;
  if (key) {
    return `beratung-${String(key).toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40)}-${Date.now()}`;
  }
  return `beratung-${Date.now()}`;
}

export function buildCustomerRecordPayload({
  customer,
  chipIds = [],
  wishLabels = [],
  selectedMatches = [],
  sentVia = [],
  shareUrl = '',
  shareToken = null,
  sellerName = '',
  dealerName = '',
  dealerSlug = null,
  nextStep = 'Rückmeldung abwarten',
  modelLineGroups = [],
}) {
  const token = shareToken ?? (shareUrl ? shareUrl.split('/').pop()?.split('?')[0] : null);
  const leadId = token ? shareSessionLeadId(token) : null;

  return {
    id: buildCustomerRecordId({ shareToken: token, customer }),
    customer,
    chipIds,
    wishLabels,
    selectedVehicles: selectedMatches.map((m) => ({
      title: m.model ?? m.title,
      slug: m.slug,
      trimLabel: m.trimLabel ?? m.vehicle?.trim,
      cleverQuote: m.cleverQuote?.percent,
    })),
    modelLineSummary: modelLineGroups.map((g) => ({
      modelLineKey: g.modelLineKey,
      label: g.label,
      primarySlug: g.primaryMatch?.slug,
      trimLabel: g.primaryMatch?.trimLabel ?? g.primaryMatch?.vehicle?.trim,
      variantCount: g.variantCount,
    })),
    sentVia,
    shareUrl,
    shareToken: token,
    leadId,
    sellerName,
    dealerName,
    dealerSlug,
    nextStep,
  };
}

export function customerRecordIdForShareToken(token) {
  return buildCustomerRecordId({ shareToken: token });
}
