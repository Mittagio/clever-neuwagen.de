import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { DEMO_LEADS, PILOT_DEMO_LEAD, PILOT_LEAD_ID } from '../data/demoLeads.js';
import { PILOT_DEALER_ID, PILOT_LIVE } from '../config/pilotLive.js';
import { LEAD_STATUS } from '../data/leadTypes.js';
import { normalizeLead, normalizeLeads } from '../logic/leadNormalization.js';
import { upsertLeadFromOfferAction as buildUpsertFromOffer } from '../logic/offerDialogService.js';
import { DEALER_SELLERS } from '../data/salesChanceTypes.js';
import { loadPartnersFromStorage } from './VoucherPartnersContext.jsx';
import { recordIntelligenceSale } from '../services/intelligenceAnalytics.js';
import {
  runDeliveryConfirmationFlow,
  runDeliveryConfirmResponse,
  runVoucherSelectionFlow,
  retryDeliveryConfirmationEmail,
  retryVoucherEmail,
} from '../services/delivery/deliveryWorkflow.js';
import {
  fetchPilotLeadsFromServer,
  isPersistablePilotLead,
  pushPilotLeadToServer,
} from '../services/pilot/pilotLeadsApi.js';
import { syncCustomerInquiryToBackend } from '../services/customer/customerInquiryApi.js';
import { transferEquipmentWishToLead } from '../services/sales/equipmentOfferTransferService.js';

const CUSTOMER_INQUIRY_SOURCES = new Set([
  'marketplace',
  'offer',
  'berater',
  'equipment',
  'configurator',
  'dealerJourney',
  'dealerSearch',
  'landing',
]);

const STORAGE_KEY = 'clever-neuwagen-leads';

const DEMO_LEAD_IDS = new Set([
  ...DEMO_LEADS.map((l) => l.id),
  PILOT_LEAD_ID,
]);

const LeadsContext = createContext(null);

function clonePilotLead() {
  return JSON.parse(JSON.stringify(PILOT_DEMO_LEAD));
}

function ensurePilotLead(leads) {
  if (leads.some((l) => l.id === PILOT_LEAD_ID)) return leads;
  return [clonePilotLead(), ...leads];
}

function stripDemoLeads(leads) {
  return leads.filter((l) => !DEMO_LEAD_IDS.has(l.id));
}

function loadPilotLeads() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return normalizeLeads(stripDemoLeads(parsed));
      }
    }
  } catch {
    /* leer starten */
  }
  return [];
}

function loadLeads() {
  if (PILOT_LIVE) return loadPilotLeads();

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length) {
        return normalizeLeads(ensurePilotLead(parsed));
      }
    }
  } catch {
    /* Fallback */
  }
  return normalizeLeads([...DEMO_LEADS]);
}

function saveLeads(leads) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(leads));
}

function historyEntry(text, type = 'system', meta = {}) {
  return {
    id: `hist-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    at: new Date().toISOString(),
    type,
    text,
    direction: meta.direction ?? null,
    channel: meta.channel ?? null,
    templateId: meta.templateId ?? null,
    offerCode: meta.offerCode ?? null,
    documentType: meta.documentType ?? null,
    subject: meta.subject ?? null,
    eventId: meta.eventId ?? null,
  };
}

function persistLeadSnapshot(lead, meta = {}) {
  if (!isPersistablePilotLead(lead)) return;
  pushPilotLeadToServer(lead);
  if (CUSTOMER_INQUIRY_SOURCES.has(lead.source) || meta.fromCustomer) {
    syncCustomerInquiryToBackend({ type: 'lead', lead });
  }
}

function applyLeadPatch(prev, id, patch, historyText, historyType = 'system') {
  return prev.map((lead) => {
    if (lead.id !== id) return lead;
    const merged = {
      ...lead,
      ...patch,
      updatedAt: new Date().toISOString(),
    };
    if (patch.deliveryConfirmation) {
      merged.deliveryConfirmation = {
        ...(lead.deliveryConfirmation ?? {}),
        ...patch.deliveryConfirmation,
      };
    }
    if (historyText) {
      merged.history = [...(lead.history ?? []), historyEntry(historyText, historyType)];
    }
    return merged;
  });
}

function mergeLeadsById(localLeads, remoteLeads) {
  const map = new Map();
  for (const lead of localLeads) map.set(lead.id, lead);
  for (const lead of remoteLeads) {
    const prev = map.get(lead.id);
    if (!prev) {
      map.set(lead.id, lead);
      continue;
    }
    const prevAt = new Date(prev.updatedAt ?? prev.createdAt ?? 0).getTime();
    const nextAt = new Date(lead.updatedAt ?? lead.createdAt ?? 0).getTime();
    map.set(lead.id, nextAt >= prevAt ? lead : prev);
  }
  return normalizeLeads([...map.values()].sort(
    (a, b) => new Date(b.createdAt ?? 0) - new Date(a.createdAt ?? 0),
  ));
}

export function LeadsProvider({ children }) {
  const [leads, setLeads] = useState(loadLeads);

  useEffect(() => {
    saveLeads(leads);
  }, [leads]);

  useEffect(() => {
    let cancelled = false;

    async function syncFromServer() {
      const remote = await fetchPilotLeadsFromServer(PILOT_DEALER_ID);
      if (cancelled || !remote.length) return;
      setLeads((prev) => mergeLeadsById(
        PILOT_LIVE ? prev : stripDemoLeads(prev),
        remote,
      ));
    }

    syncFromServer();
    const timer = setInterval(syncFromServer, 5000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    function onStorage(event) {
      if (event.key === STORAGE_KEY && event.newValue) {
        try {
          setLeads(JSON.parse(event.newValue));
        } catch {
          /* ignorieren */
        }
      }
    }
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const api = useMemo(() => ({
    leads,

    addLead(lead) {
      setLeads((prev) => [lead, ...prev]);
      persistLeadSnapshot(lead);
      return lead;
    },

    updateLead(id, partial) {
      const updatedAt = new Date().toISOString();
      setLeads((prev) => {
        const next = prev.map((lead) =>
          lead.id === id
            ? { ...lead, ...partial, updatedAt }
            : lead,
        );
        const updated = next.find((l) => l.id === id);
        if (updated) persistLeadSnapshot(updated);
        return next;
      });
    },

    updateContact(id, contact) {
      setLeads((prev) => {
        const next = prev.map((lead) =>
          lead.id === id
            ? normalizeLead({
                ...lead,
                contact: { ...lead.contact, ...contact },
                updatedAt: new Date().toISOString(),
              })
            : lead,
        );
        const updated = next.find((l) => l.id === id);
        if (updated) persistLeadSnapshot(updated);
        return next;
      });
    },

    updateWish(id, wish) {
      setLeads((prev) => {
        const next = prev.map((lead) =>
          lead.id === id
            ? normalizeLead({
                ...lead,
                wish: { ...lead.wish, ...wish },
                paymentType: wish.paymentType ?? lead.paymentType,
                updatedAt: new Date().toISOString(),
              })
            : lead,
        );
        const updated = next.find((l) => l.id === id);
        if (updated) persistLeadSnapshot(updated);
        return next;
      });
    },

    assignOwner(id, ownerId) {
      const seller = DEALER_SELLERS.find((s) => s.id === ownerId);
      const now = new Date().toISOString();
      setLeads((prev) => {
        const next = prev.map((lead) => {
          if (lead.id !== id) return lead;
          const patch = {
            ...lead,
            ownerId: ownerId || null,
            ownerName: seller?.name ?? null,
            assignedAt: ownerId ? now : null,
            updatedAt: now,
          };
          const normalized = normalizeLead(patch);
          return {
            ...normalized,
            history: [
              ...(lead.history ?? []),
              historyEntry(
                ownerId
                  ? `Zuständig: ${seller.name}`
                  : 'Zuweisung entfernt',
                'system',
              ),
            ],
          };
        });
        const updated = next.find((l) => l.id === id);
        if (updated) persistLeadSnapshot(updated);
        return next;
      });
    },

    applyPricingResult(id, { leasingRate, financeRate, cashPrice, listPrice, deliveryTime, complianceStatus }) {
      setLeads((prev) => {
        const next = prev.map((lead) =>
          lead.id === id
            ? normalizeLead({
                ...lead,
                currentRate: leasingRate ?? lead.currentRate,
                listPrice,
                deliveryTime,
                complianceStatus,
                updatedAt: new Date().toISOString(),
              })
            : lead,
        );
        const updated = next.find((l) => l.id === id);
        if (updated) persistLeadSnapshot(updated);
        return next;
      });
    },

    updateNotes(id, notes) {
      setLeads((prev) => {
        const next = prev.map((lead) =>
          lead.id === id
            ? { ...lead, notes, updatedAt: new Date().toISOString() }
            : lead,
        );
        const updated = next.find((l) => l.id === id);
        if (updated) persistLeadSnapshot(updated);
        return next;
      });
    },

    async updateStatus(id, status) {
      const label = LEAD_STATUS[status]?.label ?? status;
      let result = { ok: true };

      setLeads((prev) => {
        const lead = prev.find((l) => l.id === id);
        if (!lead) return prev;

        let next = applyLeadPatch(prev, id, { status }, `Status: ${label}`, 'status');

        if (status === 'bestellung' || status === 'ausgeliefert') {
          const updatedLead = next.find((l) => l.id === id);
          recordIntelligenceSale(updatedLead);
        }

        const updated = next.find((l) => l.id === id);
        if (updated) persistLeadSnapshot(updated);

        return next;
      });

      if (status === 'ausgeliefert') {
        const lead = leads.find((l) => l.id === id);
        if (lead && !lead.deliveryConfirmation?.sentAt) {
          const flow = await runDeliveryConfirmationFlow(lead);
          if (flow.leadPatch) {
            setLeads((prev) => applyLeadPatch(
              prev,
              id,
              flow.leadPatch,
              flow.historyText,
              flow.ok ? 'system' : 'error',
            ));
          }
          result = flow;
        }
      }

      return result;
    },

    async sendDeliveryConfirmation(id) {
      const lead = leads.find((l) => l.id === id);
      if (!lead) return { ok: false, code: 'NOT_FOUND' };

      const flow = await runDeliveryConfirmationFlow(lead);
      if (flow.leadPatch) {
        setLeads((prev) => applyLeadPatch(
          prev,
          id,
          flow.leadPatch,
          flow.historyText,
          flow.ok ? 'system' : 'error',
        ));
      }
      return flow;
    },

    async resendDeliveryConfirmation(id) {
      const lead = leads.find((l) => l.id === id);
      if (!lead) return { ok: false, code: 'NOT_FOUND' };
      const flow = await retryDeliveryConfirmationEmail(lead);
      if (flow.leadPatch) {
        setLeads((prev) => applyLeadPatch(
          prev,
          id,
          flow.leadPatch,
          flow.historyText ?? 'Bestätigungs-E-Mail erneut gesendet',
          flow.ok ? 'system' : 'error',
        ));
      }
      return flow;
    },

    getLeadByDeliveryToken(token) {
      return leads.find(
        (l) => l.deliveryConfirmation?.token?.toUpperCase() === token?.toUpperCase(),
      ) ?? null;
    },

    async confirmDelivery(token, response) {
      const lead = leads.find(
        (l) => l.deliveryConfirmation?.token?.toUpperCase() === token?.toUpperCase(),
      );
      if (!lead) return { ok: false, code: 'INVALID_TOKEN' };

      const partners = loadPartnersFromStorage();
      const flow = runDeliveryConfirmResponse(lead, response, partners);
      if (!flow.ok) return flow;

      setLeads((prev) => applyLeadPatch(
        prev,
        lead.id,
        flow.leadPatch,
        flow.historyText,
        'delivery',
      ));
      return flow;
    },

    async selectVoucherGift(token, partnerId) {
      const lead = leads.find(
        (l) => l.deliveryConfirmation?.token?.toUpperCase() === token?.toUpperCase(),
      );
      if (!lead) return { ok: false, code: 'INVALID_TOKEN' };

      const partners = loadPartnersFromStorage();
      const flow = await runVoucherSelectionFlow(lead, partnerId, partners);
      if (flow.leadPatch) {
        setLeads((prev) => applyLeadPatch(
          prev,
          lead.id,
          flow.leadPatch,
          flow.historyText,
          flow.ok ? 'delivery' : 'error',
        ));
      }
      return flow;
    },

    async resendVoucherEmail(id) {
      const lead = leads.find((l) => l.id === id);
      if (!lead) return { ok: false, code: 'NOT_FOUND' };
      const partners = loadPartnersFromStorage();
      const flow = await retryVoucherEmail(lead, partners);
      if (flow.leadPatch) {
        setLeads((prev) => applyLeadPatch(
          prev,
          id,
          flow.leadPatch,
          flow.historyText,
          flow.ok ? 'delivery' : 'error',
        ));
      }
      return flow;
    },

    addHistory(id, text, type = 'note', meta = {}) {
      setLeads((prev) => {
        const next = prev.map((lead) =>
          lead.id === id
            ? {
                ...lead,
                updatedAt: new Date().toISOString(),
                history: [...(lead.history ?? []), historyEntry(text, type, meta)],
              }
            : lead,
        );
        const updated = next.find((l) => l.id === id);
        if (updated) persistLeadSnapshot(updated);
        return next;
      });
    },

    getLead(id) {
      return leads.find((l) => l.id === id) ?? null;
    },

    transferEquipmentWish(leadId, salesResult, options = {}) {
      const lead = leads.find((l) => l.id === leadId) ?? null;
      const result = transferEquipmentWishToLead(lead, salesResult, options);
      if (!result.ok) return result;

      setLeads((prev) => {
        const next = prev.map((item) => (
          item.id === leadId
            ? normalizeLead({
              ...item,
              equipmentWishes: result.equipmentWishes,
              updatedAt: new Date().toISOString(),
              history: [
                ...(item.history ?? []),
                historyEntry(
                  `Ausstattungswunsch: ${result.wish.featureLabel} (${result.wish.modelLabel})`,
                  'note',
                ),
              ],
            })
            : item
        ));
        const updated = next.find((l) => l.id === leadId);
        if (updated) persistLeadSnapshot(updated);
        return next;
      });

      return result;
    },

    upsertLeadFromOfferAction(params) {
      let result = null;
      setLeads((prev) => {
        result = buildUpsertFromOffer({ ...params, leads: prev });
        if (result.isNew) {
          persistLeadSnapshot(result.lead);
          return [result.lead, ...prev];
        }
        const next = prev.map((lead) => (lead.id === result.leadId ? result.lead : lead));
        persistLeadSnapshot(result.lead);
        return next;
      });
      if (params.offer && result?.lead) {
        syncCustomerInquiryToBackend({
          type: 'offer_action',
          offer: params.offer,
          action: params.action ?? 'inquiry',
          contact: params.contact ?? {},
          message: params.message ?? '',
          sonderwuensche: params.sonderwuensche ?? {},
          lead: result.lead,
        });
      }
      return result;
    },

    countByStatus(status) {
      return leads.filter((l) => l.status === status).length;
    },

    resetPilotLead() {
      const fresh = clonePilotLead();
      setLeads((prev) => {
        const without = prev.filter((l) => l.id !== PILOT_LEAD_ID);
        return [fresh, ...without];
      });
      return fresh;
    },

    getPilotLead() {
      return leads.find((l) => l.id === PILOT_LEAD_ID) ?? null;
    },
  }), [leads]);

  return (
    <LeadsContext.Provider value={api}>
      {children}
    </LeadsContext.Provider>
  );
}

export function useLeads() {
  const ctx = useContext(LeadsContext);
  if (!ctx) {
    throw new Error('useLeads muss innerhalb von LeadsProvider verwendet werden');
  }
  return ctx;
}
