/**
 * Verkaufschance erst bei aktiver Kundenanfrage (Sprint 16)
 */

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

const ACTION_STATUS = {
  inquiry: 'neu',
  testdrive: 'probefahrt',
  contact: 'interessiert',
};

/**
 * @param {object} vehicle – MARKETPLACE_VEHICLES Eintrag
 * @param {'inquiry'|'testdrive'|'contact'} action
 * @param {{ name: string, email: string, phone?: string, message?: string }} contact
 */
export function createLeadFromMarketplaceVehicle(vehicle, action, contact) {
  const actionLabels = {
    inquiry: 'Anfrage gestartet',
    testdrive: 'Probefahrt angefragt',
    contact: 'Händler kontaktiert',
  };

  return {
    id: uid(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    status: ACTION_STATUS[action] ?? 'neu',
    source: 'marketplace',
    dealerId: vehicle.dealerSlug ?? 'autohaus-trinkle',
    marketplaceSlug: vehicle.slug,
    contact: {
      name: contact.name?.trim() ?? '',
      phone: contact.phone?.trim() ?? '',
      email: contact.email?.trim() ?? '',
    },
    vehicle: {
      brand: vehicle.brand,
      model: vehicle.model,
      label: vehicle.title,
    },
    paymentType: 'leasing',
    desiredRate: vehicle.monthlyRate,
    currentRate: vehicle.monthlyRate,
    notes: `${actionLabels[action] ?? 'Anfrage'} · ${vehicle.title} (${vehicle.slug})`,
    history: [
      historyEntry(`Kundenanfrage über Fahrzeugseite /fahrzeug/${vehicle.slug}`),
      historyEntry(actionLabels[action] ?? 'Anfrage', 'note'),
      ...(contact.message
        ? [historyEntry(`Nachricht: ${contact.message}`, 'note')]
        : []),
    ],
  };
}
