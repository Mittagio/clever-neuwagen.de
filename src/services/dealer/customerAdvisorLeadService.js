/**
 * Lead aus Kunden-Beratung (Wünsche + Richtung, unverbindlich).
 */
import { LEAD_SOURCES } from '../../data/leadTypes.js';

function uid(prefix = 'lead') {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function historyEntry(text, type = 'system') {
  return {
    id: uid('hist'),
    at: new Date().toISOString(),
    type,
    text,
  };
}

/**
 * @param {object} params
 */
export function createLeadFromCustomerAdvisor({
  contact,
  customerWish,
  dealerConditions,
  message = '',
  wantTestDrive = false,
}) {
  const modelLabel = customerWish?.modelLabel ?? 'Fahrzeug';
  const trimPart = customerWish?.reservedTrim ? ` – Richtung ${customerWish.reservedTrim}` : '';
  const vehicleTitle = `${modelLabel}${trimPart}`.trim();

  const dossierLines = [
    `Kunde: ${contact.name?.trim() ?? ''}`,
    `Modell: ${modelLabel}`,
    customerWish?.priorities?.length
      ? `Beratungsrichtungen: ${customerWish.priorities.join(', ')}`
      : null,
    customerWish?.usage?.length
      ? `Nutzung: ${customerWish.usage.join(', ')}`
      : null,
    customerWish?.equipment?.length
      ? `Ausstattungswünsche: ${customerWish.equipment.join(', ')}`
      : null,
    customerWish?.possibleDirection
      ? `Mögliche Richtung: ${customerWish.possibleDirection}`
      : null,
    customerWish?.possibleTrims?.length
      ? `Varianten prüfen: ${customerWish.possibleTrims.join(' / ')}`
      : null,
    customerWish?.summaryLines?.length
      ? `Zusammenfassung: ${customerWish.summaryLines.join(' · ')}`
      : null,
    customerWish?.searchTerms?.length
      ? `Freitextwünsche: ${customerWish.searchTerms.join(', ')}`
      : null,
    customerWish?.openCheckpoints?.length
      ? `Offene Prüfpunkte: ${customerWish.openCheckpoints.join('; ')}`
      : null,
    'Status: Beratung angefragt',
    customerWish?.nextStepHint ? `Nächster Schritt: ${customerWish.nextStepHint}` : 'Nächster Schritt: Expertenkontakt aufnehmen',
  ].filter(Boolean);

  return {
    id: uid(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    status: wantTestDrive ? 'probefahrt' : 'neu',
    source: 'customerAdvisor',
    advisorStatus: 'Beratung angefragt',
    dealerId: dealerConditions?.dealerId ?? dealerConditions?.slug ?? 'autohaus-trinkle',
    contact: {
      name: contact.name?.trim() ?? '',
      phone: contact.phone?.trim() ?? '',
      email: contact.email?.trim() ?? '',
    },
    vehicle: {
      brand: 'Kia',
      model: modelLabel.replace(/^Kia\s+/i, ''),
      trim: customerWish?.reservedTrim ?? '',
      label: vehicleTitle,
    },
    customerWish,
    inquiryBrief: {
      customerName: contact.name?.trim() ?? '',
      recommended: {
        title: vehicleTitle,
        modelKey: customerWish?.modelKey ?? null,
      },
      customerWishSummary: customerWish?.summaryLines?.join(' · ')
        ?? customerWish?.selectedChips?.join(', ')
        ?? '',
    },
    notes: dossierLines.join('\n'),
    wantTestDrive: Boolean(wantTestDrive),
    history: [
      historyEntry(`Anfrage über ${LEAD_SOURCES.customerAdvisor ?? 'Kunden-Beratung'}`),
      historyEntry('Kunde wünscht Expertenkontakt nach Vorberatung'),
      ...dossierLines.map((line) => historyEntry(line, 'note')),
      ...(message ? [historyEntry(`Nachricht: ${message}`, 'note')] : []),
    ],
  };
}
