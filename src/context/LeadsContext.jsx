import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { DEMO_LEADS, PILOT_DEMO_LEAD, PILOT_LEAD_ID } from '../data/demoLeads.js';
import { LEAD_STATUS } from '../data/leadTypes.js';
import { loadPartnersFromStorage } from './VoucherPartnersContext.jsx';
import { recordIntelligenceSale } from '../services/intelligenceAnalytics.js';
import {
  runDeliveryConfirmationFlow,
  runDeliveryConfirmResponse,
  runVoucherSelectionFlow,
  retryDeliveryConfirmationEmail,
  retryVoucherEmail,
} from '../services/delivery/deliveryWorkflow.js';

const STORAGE_KEY = 'clever-neuwagen-leads';

const LeadsContext = createContext(null);

function clonePilotLead() {
  return JSON.parse(JSON.stringify(PILOT_DEMO_LEAD));
}

function ensurePilotLead(leads) {
  if (leads.some((l) => l.id === PILOT_LEAD_ID)) return leads;
  return [clonePilotLead(), ...leads];
}

function loadLeads() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length) return ensurePilotLead(parsed);
    }
  } catch {
    /* Fallback */
  }
  return [...DEMO_LEADS];
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
  };
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

export function LeadsProvider({ children }) {
  const [leads, setLeads] = useState(loadLeads);

  useEffect(() => {
    saveLeads(leads);
  }, [leads]);

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
      return lead;
    },

    updateLead(id, partial) {
      setLeads((prev) =>
        prev.map((lead) =>
          lead.id === id
            ? { ...lead, ...partial, updatedAt: new Date().toISOString() }
            : lead,
        ),
      );
    },

    updateContact(id, contact) {
      setLeads((prev) =>
        prev.map((lead) =>
          lead.id === id
            ? {
                ...lead,
                contact: { ...lead.contact, ...contact },
                updatedAt: new Date().toISOString(),
              }
            : lead,
        ),
      );
    },

    updateNotes(id, notes) {
      setLeads((prev) =>
        prev.map((lead) =>
          lead.id === id
            ? { ...lead, notes, updatedAt: new Date().toISOString() }
            : lead,
        ),
      );
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
      setLeads((prev) =>
        prev.map((lead) =>
          lead.id === id
            ? {
                ...lead,
                updatedAt: new Date().toISOString(),
                history: [...(lead.history ?? []), historyEntry(text, type, meta)],
              }
            : lead,
        ),
      );
    },

    getLead(id) {
      return leads.find((l) => l.id === id) ?? null;
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
