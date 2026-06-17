import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { AUDIT_ACTIONS, REMINDER_PRESETS } from '../data/communicationTypes.js';
import { useLeads } from './LeadsContext.jsx';
import { useOffers } from './OffersContext.jsx';
import { useDealerConditions } from './DealerConditionsContext.jsx';
import { generateAiReply } from '../logic/communicationAi.js';
import {
  addDays,
  buildDocumentMailBody,
  buildOfferSendMail,
  buildOfferUrl,
  createCommunicationHistoryEntry,
  createOfferFromLead,
  isReminderDueToday,
  sendEmailToLead,
  sendWhatsAppToLead,
} from '../logic/communicationService.js';
import { linkOfferToLead } from '../logic/offerLeadService.js';
import { calculateRateForLead as computeLeadPricing } from '../logic/salesChancePricing.js';
import {
  prepareCounterOfferSend,
} from '../logic/offerDialogService.js';
import { buildCounterOfferMailto } from '../logic/offerAccessToken.js';
import {
  createDocumentRequest,
  buildUnterlagenUrl,
  buildDocumentRequestMailto,
} from '../logic/documentRequestService.js';
import { OFFER_DIALOG_EVENTS } from '../data/offerDialogTypes.js';
import { sendMockEmail } from '../services/mockMailService.js';
import {
  CURRENT_SELLER_STORAGE_KEY,
  DEALER_SELLERS,
  REMINDER_TYPES,
} from '../data/salesChanceTypes.js';

const REMINDERS_KEY = 'clever-neuwagen-comm-reminders';
const AUDIT_KEY = 'clever-neuwagen-comm-audit';

const CommunicationContext = createContext(null);

function uid(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function loadJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {
    /* Fallback */
  }
  return fallback;
}

function saveJson(key, data) {
  localStorage.setItem(key, JSON.stringify(data));
}

export function CommunicationProvider({ children }) {
  const leadsApi = useLeads();
  const { offers, addOffer, markSent, applyOfferPatch } = useOffers();
  const { conditions } = useDealerConditions();
  const [reminders, setReminders] = useState(() => loadJson(REMINDERS_KEY, []));
  const [auditLog, setAuditLog] = useState(() => loadJson(AUDIT_KEY, []));
  const [currentSellerId, setCurrentSellerId] = useState(() => {
    try {
      return localStorage.getItem(CURRENT_SELLER_STORAGE_KEY) ?? 'mike-quach';
    } catch {
      return 'mike-quach';
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(CURRENT_SELLER_STORAGE_KEY, currentSellerId);
    } catch {
      /* ignorieren */
    }
  }, [currentSellerId]);

  useEffect(() => {
    saveJson(REMINDERS_KEY, reminders);
  }, [reminders]);

  useEffect(() => {
    saveJson(AUDIT_KEY, auditLog);
  }, [auditLog]);

  const api = useMemo(() => {
    function recordAudit(action, leadId, detail = '') {
      const entry = {
        id: uid('audit'),
        at: new Date().toISOString(),
        action,
        leadId,
        detail,
        sellerId: 'default',
      };
      setAuditLog((prev) => [entry, ...prev].slice(0, 500));
      return entry;
    }

    function appendHistory(leadId, text, meta = {}) {
      leadsApi.addHistory(leadId, text, meta.type ?? 'communication', meta);
    }

    return {
      reminders,
      auditLog,

      getLead(id) {
        return leadsApi.getLead(id);
      },

      leads: leadsApi.leads,

      recordAudit,

      appendHistory,

      generateAiReply(lead, options = {}) {
        const offer = lead.offerCode
          ? offers.find((o) => o.code.toUpperCase() === lead.offerCode.toUpperCase())
          : null;
        const result = generateAiReply(lead, {
          ...options,
          offer,
          dealerName: conditions.dealerName,
        });
        recordAudit(AUDIT_ACTIONS.AI_GENERATED, lead.id, result.scenario);
        return result;
      },

      currentSellerId,
      setCurrentSellerId,
      dealers: DEALER_SELLERS,

      getCurrentSeller() {
        return DEALER_SELLERS.find((s) => s.id === currentSellerId) ?? DEALER_SELLERS[0];
      },

      assignOwner: leadsApi.assignOwner,
      updateWish: leadsApi.updateWish,
      updateLead: leadsApi.updateLead,
      applyPricingResult: leadsApi.applyPricingResult,

      getPricingPreview(leadId) {
        const lead = leadsApi.getLead(leadId);
        if (!lead) return null;
        return computeLeadPricing(lead, conditions);
      },

      updateRateForLead(leadId) {
        const lead = leadsApi.getLead(leadId);
        if (!lead) return { ok: false };
        const result = computeLeadPricing(lead, conditions);
        leadsApi.applyPricingResult(leadId, result);
        leadsApi.addHistory(
          leadId,
          `Rate aktualisiert: ${result.leasingRate ?? '—'} €/Monat`,
          'offer',
        );
        return { ok: true, result };
      },

      async sendEmail(leadId, { message, subject, templateId, useMailto = false }) {
        const lead = leadsApi.getLead(leadId);
        if (!lead?.contact?.email) return { ok: false, code: 'NO_EMAIL' };

        const sub = subject ?? `Ihre Anfrage – ${lead.vehicle?.label ?? 'Fahrzeug'}`;

        if (useMailto) {
          sendEmailToLead(lead, message, conditions.dealerName, sub);
        } else {
          await sendMockEmail({
            to: lead.contact.email,
            subject: sub,
            body: message,
            leadId,
            templateId,
          });
        }

        appendHistory(leadId, 'E-Mail gesendet', {
          channel: 'email',
          direction: 'outbound',
          templateId,
          subject: sub,
          type: 'communication',
        });
        recordAudit(AUDIT_ACTIONS.EMAIL_SENT, leadId, sub);
        return { ok: true };
      },

      sendWhatsApp(leadId, message, { templateId, offerCode } = {}) {
        const lead = leadsApi.getLead(leadId);
        if (!lead?.contact?.phone) return { ok: false, code: 'NO_PHONE' };

        const offerUrl = offerCode ? buildOfferUrl(offerCode) : (lead.offerCode ? buildOfferUrl(lead.offerCode) : null);
        sendWhatsAppToLead(lead, message, offerUrl);
        appendHistory(leadId, 'WhatsApp-Nachricht erstellt', {
          channel: 'whatsapp',
          direction: 'outbound',
          templateId,
          offerCode: offerCode ?? lead.offerCode,
          type: 'communication',
        });
        recordAudit(AUDIT_ACTIONS.WHATSAPP_CREATED, leadId);
        return { ok: true };
      },

      sendOffer(leadId) {
        const lead = leadsApi.getLead(leadId);
        if (!lead) return { ok: false, code: 'NOT_FOUND' };

        let offer = lead.offerCode
          ? offers.find((o) => o.code.toUpperCase() === lead.offerCode.toUpperCase())
          : null;

        if (!offer) {
          offer = createOfferFromLead(lead, conditions, offers);
          addOffer(offer);
          const linked = linkOfferToLead(offer, { ...lead, offerCode: offer.code });
          leadsApi.updateLead(leadId, {
            offerCode: offer.code,
            status: linked.status,
            currentRate: linked.currentRate ?? lead.currentRate,
          });
        }

        const url = buildOfferUrl(offer.code);
        const { mailto } = buildOfferSendMail(offer, url);

        if (lead.contact?.email) {
          window.location.href = mailto;
        }

        appendHistory(leadId, `Angebot versendet (${offer.code})`, {
          channel: 'offer',
          offerCode: offer.code,
          type: 'offer',
        });

        if (lead.status === 'neu' || lead.status === 'inBearbeitung') {
          leadsApi.updateStatus(leadId, 'angebotVersendet');
        }

        markSent(offer.code);
        recordAudit(AUDIT_ACTIONS.OFFER_SENT, leadId, offer.code);
        return { ok: true, offer, url };
      },

      sendCounterOffer(leadId, { accessoriesNote = '', dealerMessage = '' } = {}) {
        const lead = leadsApi.getLead(leadId);
        if (!lead) return { ok: false, code: 'NOT_FOUND' };

        let offer = lead.offerCode
          ? offers.find((o) => o.code.toUpperCase() === lead.offerCode.toUpperCase())
          : null;

        if (!offer) {
          offer = createOfferFromLead(lead, conditions, offers);
          addOffer(offer);
          const linked = linkOfferToLead(offer, { ...lead, offerCode: offer.code });
          leadsApi.updateLead(leadId, {
            offerCode: offer.code,
            status: linked.status,
            currentRate: linked.currentRate ?? lead.currentRate,
          });
        }

        const pricingPreview = computeLeadPricing(lead, conditions);
        const prepared = prepareCounterOfferSend({
          offer,
          lead,
          pricingPreview,
          accessoriesNote,
          dealerMessage,
        });

        applyOfferPatch(offer.code, prepared.offerPatch);

        leadsApi.addHistory(leadId, prepared.historyText, 'offer_dialog', {
          channel: 'offer',
          direction: 'outbound',
          offerCode: offer.code,
          type: 'offer_dialog',
          eventId: 'dealer_counter_offer',
        });

        leadsApi.applyPricingResult(leadId, pricingPreview);
        leadsApi.updateLead(leadId, {
          currentRate: pricingPreview.leasingRate ?? lead.currentRate,
        });

        if (lead.status === 'neu' || lead.status === 'inBearbeitung' || lead.status === 'rueckfrageOffen') {
          leadsApi.updateStatus(leadId, 'angebotVersendet');
        }

        const mailto = buildCounterOfferMailto(
          { ...offer, pricing: prepared.offerPatch.pricing },
          prepared.magicUrl,
          prepared.counterOffer,
        );
        if (lead.contact?.email) {
          window.location.href = mailto;
        }

        markSent(offer.code);
        recordAudit(AUDIT_ACTIONS.OFFER_SENT, leadId, `${offer.code} (Gegenangebot)`);
        return {
          ok: true,
          offer: { ...offer, ...prepared.offerPatch },
          url: prepared.magicUrl,
          counterOffer: prepared.counterOffer,
        };
      },

      requestDocuments(leadId, { slotTypes = [], message = '' } = {}) {
        const lead = leadsApi.getLead(leadId);
        if (!lead) return { ok: false, code: 'NOT_FOUND' };
        if (!slotTypes.length) return { ok: false, code: 'NO_SLOTS' };

        let offerCode = lead.offerCode;
        if (!offerCode) {
          const created = createOfferFromLead(lead, conditions, offers);
          addOffer(created);
          offerCode = created.code;
          leadsApi.updateLead(leadId, { offerCode });
        }

        const request = createDocumentRequest({
          leadId,
          offerCode,
          customerEmail: lead.contact?.email,
          customerName: lead.contact?.name,
          slotTypes,
          dealerMessage: message,
        });

        const url = buildUnterlagenUrl(request.id, request.accessToken);
        const slotLabels = request.slots.map((s) => s.label).join(', ');
        const historyText = `${OFFER_DIALOG_EVENTS.documents_requested.label}: ${slotLabels}`;

        leadsApi.addHistory(leadId, historyText, 'offer_dialog', {
          channel: 'offer',
          direction: 'outbound',
          offerCode,
          eventId: 'documents_requested',
          requestId: request.id,
        });

        leadsApi.updateLead(leadId, {
          activeDocumentRequestId: request.id,
        });

        if (lead.contact?.email) {
          window.location.href = buildDocumentRequestMailto(request, url);
        }

        recordAudit(AUDIT_ACTIONS.DOCUMENT_SENT, leadId, request.id);
        return { ok: true, request, url };
      },

      sendDocument(leadId, documentType) {
        const lead = leadsApi.getLead(leadId);
        if (!lead) return { ok: false, code: 'NOT_FOUND' };

        const body = buildDocumentMailBody(lead, documentType, conditions.dealerName);
        if (lead.contact?.email) {
          sendEmailToLead(lead, body, conditions.dealerName, `Dokument: ${documentType}`);
        }

        appendHistory(leadId, `Dokument versendet: ${documentType}`, {
          channel: 'document',
          documentType,
          type: 'communication',
        });
        recordAudit(AUDIT_ACTIONS.DOCUMENT_SENT, leadId, documentType);
        return { ok: true, body };
      },

      setReminder(leadId, presetId) {
        const preset = REMINDER_PRESETS.find((p) => p.id === presetId);
        if (!preset) return null;

        const reminder = {
          id: uid('rem'),
          leadId,
          label: preset.label,
          dueAt: addDays(preset.days),
          createdAt: new Date().toISOString(),
          done: false,
          type: 'other',
        };
        setReminders((prev) => [reminder, ...prev]);
        appendHistory(leadId, `Nachfassen geplant: ${preset.label}`, {
          channel: 'system',
          type: 'system',
        });
        recordAudit(AUDIT_ACTIONS.REMINDER_SET, leadId, preset.label);
        return reminder;
      },

      setDetailedReminder(leadId, { date, time, note, type }) {
        const typeLabel = REMINDER_TYPES.find((t) => t.id === type)?.label ?? type;
        const dueAt = new Date(`${date}T${time || '09:00'}:00`).toISOString();
        const reminder = {
          id: uid('rem'),
          leadId,
          label: note || `${typeLabel} – ${new Date(dueAt).toLocaleDateString('de-DE')}`,
          dueAt,
          note,
          type,
          createdAt: new Date().toISOString(),
          done: false,
        };
        setReminders((prev) => [reminder, ...prev]);
        appendHistory(leadId, `Nachfassen geplant: ${reminder.label}`, {
          channel: 'system',
          type: 'system',
        });
        recordAudit(AUDIT_ACTIONS.REMINDER_SET, leadId, reminder.label);
        return reminder;
      },

      completeReminder(reminderId) {
        setReminders((prev) =>
          prev.map((r) => (r.id === reminderId ? { ...r, done: true } : r)),
        );
      },

      getRemindersForLead(leadId) {
        return reminders.filter((r) => r.leadId === leadId && !r.done);
      },

      getDueToday() {
        return reminders.filter((r) => isReminderDueToday(r));
      },

      getKpis() {
        const counts = {
          emailsSent: 0,
          whatsappsSent: 0,
          offersSent: 0,
          repliesReceived: 0,
        };

        for (const entry of auditLog) {
          if (entry.action === AUDIT_ACTIONS.EMAIL_SENT) counts.emailsSent += 1;
          if (entry.action === AUDIT_ACTIONS.WHATSAPP_CREATED) counts.whatsappsSent += 1;
          if (entry.action === AUDIT_ACTIONS.OFFER_SENT) counts.offersSent += 1;
        }

        for (const lead of leadsApi.leads) {
          for (const h of lead.history ?? []) {
            if (h.direction === 'inbound') counts.repliesReceived += 1;
          }
        }

        const outbound = counts.emailsSent + counts.whatsappsSent + counts.offersSent;
        const conversionRate = outbound
          ? Math.round((leadsApi.countByStatus('bestellung') + leadsApi.countByStatus('ausgeliefert')) / Math.max(leadsApi.leads.length, 1) * 100)
          : 0;

        return { ...counts, conversionRate };
      },

      updateLeadStatus: leadsApi.updateStatus,
      updateContact: leadsApi.updateContact,
      addHistory: leadsApi.addHistory,
    };
  }, [leadsApi, offers, conditions, reminders, auditLog, addOffer, markSent, applyOfferPatch, currentSellerId]);

  return (
    <CommunicationContext.Provider value={api}>
      {children}
    </CommunicationContext.Provider>
  );
}

export function useCommunication() {
  const ctx = useContext(CommunicationContext);
  if (!ctx) {
    throw new Error('useCommunication muss innerhalb von CommunicationProvider verwendet werden');
  }
  return ctx;
}
