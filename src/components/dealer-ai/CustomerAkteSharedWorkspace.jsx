import { useEffect, useMemo, useRef, useState } from 'react';
import SharedWorkspaceChat from '../chat/SharedWorkspaceChat.jsx';
import DealerAiInlineMic from './DealerAiInlineMic.jsx';
import SellerInlineAssistCard from './SellerInlineAssistCard.jsx';
import {
  buildSharedWorkspaceTimeline,
  postCleverAssistFeedCard,
  sendSellerWorkspacePackage,
} from '../../services/crm/sharedWorkspaceService.js';
import {
  MESSAGE_KIND,
  sendCleverChannelMessage,
} from '../../services/crm/customerMessageService.js';
import {
  INLINE_RESULT_TYPES,
  insertInlineFactIntoDraft,
  runSellerInlineAssist,
} from '../../services/dealer/sellerInlineComposerAssist.js';
import { runSellerOfferAssist } from '../../services/dealer/sellerOfferAssistFlow.js';
import {
  APPOINTMENT_STATUS,
  applyAppointmentCrmPatch,
  buildCrmPatchFromAppointment,
  buildCustomerAppointmentConfirmResult,
  detectCustomerAppointmentReply,
  formatAppointmentWhen,
  getOpenCleverAppointment,
  runSellerAppointmentAssist,
} from '../../services/dealer/sellerAppointmentAssistFlow.js';
import { formatCustomerDisplayName } from '../../services/dealerAiParser.js';

const DEBOUNCE_MS = 380;

function buildCleverFeedTextFromResult(result = {}) {
  if (result.type === INLINE_RESULT_TYPES.MESSAGE_DRAFT) {
    return [result.headline, result.hint].map((p) => String(p ?? '').trim()).filter(Boolean).join('\n')
      || 'Nachricht vorbereitet';
  }
  return [result.headline, result.body, result.contextLink, result.hint]
    .map((p) => String(p ?? '').trim())
    .filter(Boolean)
    .join('\n\n');
}

function resolveCleverFeedCtaAction(result = {}) {
  if (result.type === INLINE_RESULT_TYPES.OFFER_DRAFT) {
    return result.magic?.canCreateOffer ? 'prepare_offer' : 'complete_offer';
  }
  if (result.type === INLINE_RESULT_TYPES.APPOINTMENT_DRAFT) {
    return result.canScheduleNow || result.primaryCta === 'Termin eintragen'
      ? 'schedule_appointment'
      : 'propose_appointment';
  }
  return null;
}

/**
 * Verkäufer-Sicht: gemeinsamer Conversation-Verlauf + ein Composer (inkl. Clever Inline).
 * Chips / Tab-Leisten leben in der Akte-Shell – hier nur die Arbeitsfläche Chat.
 */
export default function CustomerAkteSharedWorkspace({
  lead,
  customerName = '',
  onPersistLead = null,
  isSaving = false,
  cleverMode = false,
  focusToken = 0,
  compactEmpty = false,
  onOpenOffer = null,
  onPrepareOfferDraft = null,
  onUploadDocument = null,
  onStartSelfDisclosure = null,
  seedDraft = '',
  seedDraftToken = 0,
  feedTopSlot = null,
}) {
  const [draft, setDraft] = useState('');
  const [feedback, setFeedback] = useState('');
  const [sending, setSending] = useState(false);
  const [assist, setAssist] = useState(null);
  const [offerPrep, setOfferPrep] = useState(null);
  const [appointmentDraft, setAppointmentDraft] = useState(null);
  const debounceRef = useRef(null);
  const composerInputRef = useRef(null);
  const offerPrepRef = useRef(null);
  const appointmentDraftRef = useRef(null);

  useEffect(() => {
    offerPrepRef.current = offerPrep;
  }, [offerPrep]);

  useEffect(() => {
    appointmentDraftRef.current = appointmentDraft;
  }, [appointmentDraft]);

  useEffect(() => {
    if (!seedDraftToken || !seedDraft) return;
    setDraft(String(seedDraft));
  }, [seedDraftToken, seedDraft]);

  const timeline = useMemo(
    () => buildSharedWorkspaceTimeline(lead, { role: 'seller' }),
    [lead],
  );

  const displayName = formatCustomerDisplayName(customerName) || 'dem Kunden';

  const placeholder = cleverMode
    ? `Clever fragen oder Nachricht an ${displayName} …`
    : `Nachricht an ${displayName} …`;

  const confirmAssist = useMemo(() => {
    const open = getOpenCleverAppointment(lead);
    if (!open) return null;
    if (open.status === APPOINTMENT_STATUS.CUSTOMER_CONFIRMED) {
      return buildCustomerAppointmentConfirmResult(lead, {
        kind: 'confirm',
        appointment: open,
      });
    }
    if (open.status === APPOINTMENT_STATUS.PROPOSED && open.pendingChangeStartAt) {
      return buildCustomerAppointmentConfirmResult(lead, {
        kind: 'change_request',
        appointment: open,
        proposedStartAt: open.pendingChangeStartAt,
      });
    }
    const lastInbound = [...(timeline.items ?? [])]
      .reverse()
      .find((item) => item.isCustomer && item.text);
    if (!lastInbound || open.status !== APPOINTMENT_STATUS.PROPOSED) return null;
    const reply = detectCustomerAppointmentReply(lastInbound.text, open);
    return buildCustomerAppointmentConfirmResult(lead, reply);
  }, [lead, timeline.items]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const text = String(draft ?? '').trim();
    if (text.length < 3) {
      if (confirmAssist?.ok) {
        setAssist(confirmAssist);
      } else {
        setAssist(null);
      }
      return undefined;
    }
    debounceRef.current = setTimeout(() => {
      const offer = runSellerOfferAssist(lead, text, {
        previousPreparation: offerPrepRef.current,
      });
      if (offer?.ok) {
        setOfferPrep(offer.previousPreparation ?? null);
        setAssist(offer);
        return;
      }
      const appointment = runSellerAppointmentAssist(lead, text, {
        previousAppointment: appointmentDraftRef.current
          || getOpenCleverAppointment(lead),
      });
      if (appointment?.ok) {
        setAppointmentDraft(appointment.appointment ?? null);
        setAssist(appointment);
        return;
      }
      const result = runSellerInlineAssist(lead, text);
      setAssist(result.ok ? result : null);
    }, DEBOUNCE_MS);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [draft, lead, confirmAssist]);

  useEffect(() => {
    if (!focusToken) return;
    const el = document.getElementById('sw-composer-seller');
    if (!el) return;
    el.focus?.();
    composerInputRef.current = el;
  }, [focusToken, cleverMode]);

  function persistMessages(nextLead, historyText) {
    onPersistLead?.(nextLead, { historyText });
  }

  function persistCleverFeedCard(result, options = {}) {
    const text = options.text || buildCleverFeedTextFromResult(result);
    if (!text || !lead?.id) return lead;
    const posted = postCleverAssistFeedCard({
      lead,
      title: result?.title || '✨ Clever',
      text,
      ctaLabel: options.ctaLabel ?? result?.primaryCta ?? null,
      ctaAction: options.ctaAction ?? resolveCleverFeedCtaAction(result),
      visibleToCustomer: options.visibleToCustomer === true,
    });
    if (!posted.message) return lead;
    persistMessages(posted.lead, options.historyText || 'Clever im Kundenverlauf');
    return posted.lead;
  }

  function handleSend(text) {
    if (!text || sending) return;
    setSending(true);
    try {
      const result = sendCleverChannelMessage({
        lead,
        text,
        createdByName: 'Verkäufer',
      });
      if (!result.message) {
        setFeedback('Nachricht konnte nicht gesendet werden.');
        return;
      }
      persistMessages(result.lead, 'Nachricht im gemeinsamen Arbeitsraum gesendet');
      setDraft('');
      setAssist(null);
      setOfferPrep(null);
      setAppointmentDraft(null);
      setFeedback('Gesendet');
      setTimeout(() => setFeedback(''), 2500);
    } finally {
      setSending(false);
    }
  }

  function handleInsertFact(result) {
    const insert = result.insertText || result.body;
    setDraft((prev) => insertInlineFactIntoDraft(prev, insert));
    if (
      result.type === INLINE_RESULT_TYPES.FACT_SUGGESTION
      || result.type === INLINE_RESULT_TYPES.MISSING_FACT
      || result.type === INLINE_RESULT_TYPES.OFFER_DRAFT
    ) {
      persistCleverFeedCard({
        ...result,
        body: result.insertText || result.body,
      }, { ctaLabel: null, ctaAction: null });
    }
    setFeedback('Fakt übernommen');
    setTimeout(() => setFeedback(''), 2000);
  }

  function handleUseVerified(result) {
    const verified = result.verified;
    setDraft((prev) => {
      let next = String(prev ?? '');
      if (result.claimed != null) {
        next = next.replace(
          new RegExp(String(result.claimed), 'g'),
          String(verified),
        );
      }
      return insertInlineFactIntoDraft(next, result.insertText || '');
    });
    persistCleverFeedCard(result, { ctaLabel: null, ctaAction: null });
    setAssist(null);
    setFeedback('Verifizierten Wert übernommen');
    setTimeout(() => setFeedback(''), 2200);
  }

  function handlePrepareReply(result) {
    if (result.insertText) {
      setDraft((prev) => insertInlineFactIntoDraft(prev, result.insertText));
      setAssist(null);
      return;
    }
    handleInsertFact(result);
  }

  function handleSendDraft(result) {
    const body = result.draft?.body || result.body;
    if (body) handleSend(body);
  }

  function handleSendActions(result) {
    setSending(true);
    try {
      const sent = sendSellerWorkspacePackage({
        lead,
        body: result.draft?.body || result.body,
        actions: result.actions || [],
        createdByName: 'Verkäufer',
      });
      if (!sent.ok) {
        setFeedback('Paket konnte nicht gesendet werden.');
        return;
      }
      persistMessages(sent.lead, 'Workspace-Paket gesendet');
      setDraft('');
      setAssist(null);
      setOfferPrep(null);
      setAppointmentDraft(null);
      setFeedback('Gesendet');
      setTimeout(() => setFeedback(''), 2500);
    } finally {
      setSending(false);
    }
  }

  function handleChoice(choice) {
    const insert = choice?.insertText || choice?.label;
    if (!insert) return;
    setDraft(insert);
  }

  function handlePrepareOffer(result) {
    persistCleverFeedCard(result, {
      ctaAction: resolveCleverFeedCtaAction(result) || 'prepare_offer',
      historyText: 'Clever Angebotsvorbereitung',
    });
    const magic = result?.magic ?? offerPrep;
    if (onPrepareOfferDraft) {
      onPrepareOfferDraft({ magic });
      setFeedback('Angebot wird vorbereitet …');
      setTimeout(() => setFeedback(''), 2500);
      return;
    }
    onOpenOffer?.();
  }

  function handleCleverFeedCta(payload = {}) {
    const action = payload.ctaAction;
    if (action === 'prepare_offer' || action === 'complete_offer' || action === 'open_offer') {
      if (onPrepareOfferDraft) {
        onPrepareOfferDraft({ magic: null });
        return;
      }
      onOpenOffer?.();
    }
  }

  function handleSendAppointmentProposal(result) {
    const appointment = result?.appointment;
    if (!appointment?.startAt || sending) return;
    setSending(true);
    try {
      let nextLead = lead;
      const messageBody = result.messageBody || result.draft?.body;
      if (messageBody) {
        const sent = sendCleverChannelMessage({
          lead: nextLead,
          text: messageBody,
          createdByName: 'Verkäufer',
        });
        if (!sent.message) {
          setFeedback('Nachricht konnte nicht gesendet werden.');
          return;
        }
        nextLead = sent.lead;
      }

      const card = sendCleverChannelMessage({
        lead: nextLead,
        text: `${appointment.typeLabel} · ${formatAppointmentWhen(appointment.startAt)}`,
        kind: MESSAGE_KIND.APPOINTMENT_CARD,
        payload: {
          title: appointment.typeLabel,
          vehicleLabel: appointment.vehicleContext,
          whenLabel: formatAppointmentWhen(appointment.startAt),
          startAt: appointment.startAt,
          status: APPOINTMENT_STATUS.PROPOSED,
          ctaConfirm: 'Ja, passt',
          ctaChange: 'Anderen Termin vorschlagen',
        },
        createdByName: 'Verkäufer',
      });
      if (card.message) nextLead = card.lead;

      const patch = buildCrmPatchFromAppointment(appointment, { markProposed: true });
      nextLead = applyAppointmentCrmPatch(nextLead, patch);
      const historyText = `${appointment.typeLabel} vorgeschlagen (${formatAppointmentWhen(appointment.startAt)})`;
      persistMessages({
        ...nextLead,
        history: [
          ...(nextLead.history ?? []),
          {
            id: `hist-appt-${Date.now()}`,
            at: new Date().toISOString(),
            type: 'appointment_proposed',
            text: historyText,
          },
        ],
      }, historyText);

      setDraft('');
      setAssist(null);
      setAppointmentDraft(null);
      setFeedback('Vorschlag gesendet');
      setTimeout(() => setFeedback(''), 2500);
    } finally {
      setSending(false);
    }
  }

  function handleScheduleAppointment(result) {
    let appointment = result?.appointment;
    if (!appointment?.startAt || sending) return;

    if (result.proposedStartAt) {
      appointment = {
        ...appointment,
        startAt: result.proposedStartAt,
        endAt: new Date(
          new Date(result.proposedStartAt).getTime()
            + (appointment.durationMinutes || 60) * 60_000,
        ).toISOString(),
        pendingChangeStartAt: null,
      };
    }

    setSending(true);
    try {
      const patch = buildCrmPatchFromAppointment(appointment, { markScheduled: true });
      let nextLead = applyAppointmentCrmPatch(lead, patch);
      const when = formatAppointmentWhen(appointment.startAt);
      const historyText = `${appointment.typeLabel} eingetragen (${when})`;
      const clever = postCleverAssistFeedCard({
        lead: nextLead,
        title: '✨ Clever',
        text: `${appointment.typeLabel} eingetragen · ${when}`,
        visibleToCustomer: false,
      });
      if (clever.message) nextLead = clever.lead;
      nextLead = {
        ...nextLead,
        history: [
          ...(nextLead.history ?? []),
          {
            id: `hist-appt-${Date.now()}`,
            at: new Date().toISOString(),
            type: 'appointment_scheduled',
            text: historyText,
          },
        ],
      };
      persistMessages(nextLead, historyText);
      setDraft('');
      setAssist(null);
      setAppointmentDraft(null);
      setFeedback('Termin eingetragen');
      setTimeout(() => setFeedback(''), 2500);
    } finally {
      setSending(false);
    }
  }

  function handleAppointmentPrimary(result) {
    if (result?.canScheduleNow || result?.primaryCta === 'Termin eintragen') {
      handleScheduleAppointment(result);
      return;
    }
    if (result?.messageBody || result?.draft?.body || result?.requiresCustomerMessage) {
      handleSendAppointmentProposal(result);
    }
  }

  function handleDismissAssist() {
    setAssist(null);
    setOfferPrep(null);
    setAppointmentDraft(null);
  }

  const emptyHint = compactEmpty
    ? 'Noch kein Verlauf – tippen oder sprechen.'
    : 'Noch kein Verlauf. Tippen oder sprechen – Clever nutzt denselben Kundenkontext wie den Notizzettel.';

  const assistResults = assist?.results?.length
    ? assist.results
    : (confirmAssist?.results ?? []);

  return (
    <section
      className={`cust-akte-workspace cust-akte-workspace--chat-only cust-akte-workspace--feed${compactEmpty ? ' cust-akte-workspace--compact-empty' : ''}`}
      aria-label="Kundenverlauf"
    >
      <SharedWorkspaceChat
        role="seller"
        items={timeline.items}
        draft={draft}
        onDraftChange={setDraft}
        onSend={handleSend}
        sending={sending || isSaving}
        sendFeedback={feedback}
        placeholder={placeholder}
        onOpenOffer={onOpenOffer}
        onUploadDocument={onUploadDocument}
        onStartSelfDisclosure={onStartSelfDisclosure}
        onCleverAction={handleCleverFeedCta}
        feedTopSlot={feedTopSlot}
        reviewSlot={(
          <SellerInlineAssistCard
            results={assistResults}
            onInsertFact={handleInsertFact}
            onUseVerified={handleUseVerified}
            onPrepareReply={handlePrepareReply}
            onSendDraft={handleSendDraft}
            onSendActions={handleSendActions}
            onChoice={handleChoice}
            onPrepareOffer={handlePrepareOffer}
            onAppointmentPrimary={handleAppointmentPrimary}
            onDismiss={handleDismissAssist}
          />
        )}
        micSlot={(
          <DealerAiInlineMic
            variant="fab"
            disabled={sending || isSaving}
            onTranscript={(text) => setDraft((prev) => (prev ? `${prev} ${text}` : text))}
          />
        )}
        plusActions={[
          {
            id: 'offer',
            icon: '🚗',
            label: 'Angebot erstellen',
            onClick: () => setDraft((prev) => (prev ? prev : 'Mach dem Kunden ein Angebot.')),
          },
          {
            id: 'file',
            icon: '📄',
            label: 'Dokument senden',
            onClick: () => onUploadDocument?.(),
          },
          {
            id: 'req',
            icon: '📎',
            label: 'Unterlage anfordern',
            onClick: () => setDraft('Schreib ihm, dass noch Unterlagen fehlen.'),
          },
          {
            id: 'sa',
            icon: '✍️',
            label: 'Selbstauskunft senden',
            onClick: () => setDraft('Schick ihm bitte die Selbstauskunft.'),
          },
          {
            id: 'appt',
            icon: '📅',
            label: 'Termin vorschlagen',
            onClick: () => setDraft('Probefahrt anbieten.'),
          },
        ]}
        emptyHint={emptyHint}
      />
    </section>
  );
}
