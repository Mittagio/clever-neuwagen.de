/**
 * Persistenz für bestätigte Altverträge – eine Wahrheit unter lead.crm.customerContracts.
 * Vertragswerte ≠ Customer Truth (außer Projektion wish.leasingEndDate für Journey).
 */

function ensureCrm(lead) {
  return {
    ...lead,
    crm: {
      ...(lead?.crm || {}),
    },
  };
}

/**
 * @param {object} lead
 * @returns {object[]}
 */
export function listCustomerContracts(lead = {}) {
  const list = lead?.crm?.customerContracts;
  return Array.isArray(list) ? list : [];
}

/**
 * @param {object} lead
 * @param {object} draft
 */
export function findDuplicateCustomerContract(lead, draft = {}) {
  const list = listCustomerContracts(lead);
  return list.find((c) => {
    if (draft.contractNumber && c.contractNumber
      && String(c.contractNumber) === String(draft.contractNumber)) {
      return true;
    }
    if (draft.sourceDocument?.sourceId && c.sourceDocument?.sourceId
      && draft.sourceDocument.sourceId === c.sourceDocument.sourceId) {
      return true;
    }
    const sameVehicle = draft.vehicle?.model
      && c.vehicle?.model
      && String(draft.vehicle.model).toLowerCase() === String(c.vehicle.model).toLowerCase()
      && String(draft.vehicle?.make || '').toLowerCase() === String(c.vehicle?.make || '').toLowerCase();
    const sameEnd = draft.contractEndDate && c.dates?.contractEndDate === draft.contractEndDate;
    const sameStart = draft.contractStartDate && c.dates?.contractStartDate === draft.contractStartDate;
    return Boolean(sameVehicle && sameEnd && sameStart);
  }) || null;
}

function toContractRecord(draft, { customerId, nowIso }) {
  return {
    id: `contract-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    customerId: customerId || draft.customerId || null,
    contractType: draft.contractType || null,
    contractNumber: draft.contractNumber || null,
    vehicle: draft.vehicle || null,
    commercialTerms: {
      monthlyRate: draft.monthlyRate ?? null,
      downPayment: draft.downPayment ?? null,
      termMonths: draft.termMonths ?? null,
    },
    dates: {
      contractStartDate: draft.contractStartDate || null,
      contractEndDate: draft.contractEndDate || null,
    },
    mileageTerms: {
      annualMileage: draft.annualMileage ?? null,
      excessMileageRate: draft.excessMileageRate ?? null,
      underMileageRate: draft.underMileageRate ?? null,
    },
    provider: {
      bankOrLeasingCompany: draft.bankOrLeasingCompany || null,
    },
    sourceDocument: draft.sourceDocument || null,
    evidence: Array.isArray(draft.evidence) ? draft.evidence : [],
    status: 'confirmed',
    relation: draft.relation || 'original_contract',
    createdAt: nowIso,
    updatedAt: nowIso,
  };
}

/**
 * Speichert bestätigten Vertrag + projiziert wish.leasingEndDate.
 * Schreibt Contract Facts NICHT als Customer Truth (Rate etc.).
 *
 * @param {object} lead
 * @param {object} draft
 * @param {{ now?: Date, activityText?: string }} [options]
 */
export function persistConfirmedCustomerContract(lead = {}, draft = {}, options = {}) {
  if (!lead?.id || !draft) {
    return { ok: false, lead, contract: null, duplicate: false };
  }

  const dup = findDuplicateCustomerContract(lead, draft);
  if (dup) {
    return { ok: true, lead, contract: dup, duplicate: true };
  }

  const nowIso = (options.now || new Date()).toISOString();
  const record = toContractRecord(draft, { customerId: lead.id, nowIso });
  let next = ensureCrm(lead);
  const prev = listCustomerContracts(next);
  next = {
    ...next,
    crm: {
      ...next.crm,
      customerContracts: [...prev, record],
    },
  };

  // Projektion für bestehende Journey-Regel – kein Wish-Rate aus Vertrag
  if (draft.contractEndDate) {
    next = {
      ...next,
      wish: {
        ...(next.wish || {}),
        leasingEndDate: draft.contractEndDate,
      },
    };
  }

  const activityText = options.activityText || 'Altvertrag erfasst';
  const activities = Array.isArray(next.crm.activities) ? next.crm.activities : [];
  next = {
    ...next,
    crm: {
      ...next.crm,
      activities: [
        {
          id: `act-contract-${record.id}`,
          type: 'contract_imported',
          label: activityText,
          contractId: record.id,
          createdAt: nowIso,
          visibleToCustomer: false,
        },
        ...activities,
      ],
    },
  };

  return { ok: true, lead: next, contract: record, duplicate: false };
}
