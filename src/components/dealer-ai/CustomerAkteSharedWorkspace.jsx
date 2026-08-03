import { useEffect, useMemo, useRef, useState } from 'react';
import SharedWorkspaceChat from '../chat/SharedWorkspaceChat.jsx';
import DealerAiInlineMic from './DealerAiInlineMic.jsx';
import SellerUniversalReviewCard from './SellerUniversalReviewCard.jsx';
import {
  buildSharedWorkspaceTimeline,
  postCleverAssistFeedCard,
  postOfferUpdatedStatus,
  sendSellerWorkspacePackage,
} from '../../services/crm/sharedWorkspaceService.js';
import {
  MESSAGE_KIND,
  sendCleverChannelMessage,
} from '../../services/crm/customerMessageService.js';
import { runCleverSellerTurn } from '../../services/cleverSeller/runCleverSellerTurn.js';
import {
  isCleverMagicMessageClientEnabled,
  requestCleverMagicMessage,
} from '../../services/clever/intelligence/cleverSharedIntelligenceClient.js';
import {
  INLINE_RESULT_TYPES,
  insertInlineFactIntoDraft,
} from '../../services/dealer/sellerInlineComposerAssist.js';
import { runSellerOfferAssist } from '../../services/dealer/sellerOfferAssistFlow.js';
import {
  OUTBOUND_TONES,
  composeSellerOutboundMessageAsync,
} from '../../services/crm/improveSellerOutboundMessage.js';
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
import {
  buildUniversalReviewModel,
  shouldShowUniversalReview,
} from '../../services/cleverSeller/buildUniversalReviewModel.js';
import { applyAcceptedSellerTurn } from '../../services/cleverSeller/applyAcceptedSellerTurn.js';
import { extractMagicOfferPdf } from '../../services/dealer/magicOfferPdfExtract.js';
import { runComposerPdfAttachTurnWithOcr } from '../../services/cleverSeller/runComposerPdfAttachTurn.js';
import { resolveCleverOcrProvider } from '../../services/cleverSeller/resolveCleverOcrProvider.js';
import { SELLER_TURN_INTENTS } from '../../services/cleverSeller/sellerFactTypes.js';
import {
  enrichSellerTurnWithMagicPropose,
} from '../../services/cleverSeller/enrichSellerTurnWithMagicPropose.js';
import {
  COMPOSER_PRIMARY_CHIPS,
  COMPOSER_MORE_CHIPS,
  buildChipSellerInput,
  resolveComposerShortcut,
} from '../../services/crm/composerSuggestionService.js';
import {
  findOfferWorkingContext,
  toCurrentOfferContext,
  buildDocumentWorkingContextItem,
} from '../../services/crm/composerWorkingContext.js';
import { buildVehicleOpportunityCards, formatVehicleCardConditions, formatVehicleCardPrice, formatVehicleCardTitle } from '../../services/customerAkte.js';
import {
  isComposerAkteSearchQuery,
} from '../../services/crm/composerAkteSearch.js';
import {
  COMPOSER_MODES,
  beginCustomerMessageEdit,
  cancelCustomerMessageEdit,
  completeCustomerMessageEditSend,
  isCustomerMessageEditMode,
  resolveComposerUi,
} from '../../services/crm/composerMode.js';
import {
  COMPOSER_LAST_ACTION_STATUS,
  buildComposerLastActionFromReviewModel,
  buildComposerLastActionFromText,
} from '../../services/crm/composerLastAction.js';
import {
  buildMagicAkteContext,
  detectChipIntent,
} from '../../services/crm/magic/buildMagicAkteContext.js';
import {
  getVehicleTrackMeta,
  VEHICLE_TRACK_STATUS_UI,
} from '../../services/crm/vehicleTrack.js';

/** Surface-Hint für denselben Orchestrator wie Global Composer (fester Lead). */
const AKTE_COMPOSER_SCOPE = 'customer_akte';

function countLeadOffers(lead = {}) {
  try {
    const cards = buildVehicleOpportunityCards({ lead, wishFields: lead?.wish ?? {} });
    return Array.isArray(cards) ? cards.length : 0;
  } catch {
    return 0;
  }
}

function buildCleverFeedTextFromResult(result = {}) {
  if (result.type === INLINE_RESULT_TYPES.MESSAGE_DRAFT) {
    return String(result.body ?? result.draft?.body ?? '').trim()
      || [result.headline, result.hint].map((p) => String(p ?? '').trim()).filter(Boolean).join('\n')
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
  onSendPortfolio = null,
  onMessageSent = null,
  onUploadDocument = null,
  onStartSelfDisclosure = null,
  seedDraft = '',
  seedDraftToken = 0,
  /** Mit seedDraftToken: nach Seed sofort Clever-Vorschlag (wie Absenden) */
  seedAutoRun = false,
  feedTopSlot = null,
  /** Clever-Tab: kein Nachrichtenverlauf über dem Composer (Verlauf = Chat-Tab) */
  hideFeed = false,
  /** Thread/Frage-Kontext aus Inbox-Deep-Link oder Portal-Antwort */
  replyContext = null,
  /** Cursor-Anhänge: aktives Angebot etc. */
  workingContextItems = [],
  onRemoveWorkingContext = null,
  onResolveOfferReference = null,
  onUpsertWorkingContext = null,
  workspaceSlot = null,
  scrollToMessageId = null,
  scrollToMessageToken = 0,
  onAttachOffer = null,
  onAttachDocument = null,
  onFocusFeedMessage = null,
}) {
  const [draft, setDraft] = useState('');
  const [feedback, setFeedback] = useState('');
  const [sending, setSending] = useState(false);
  const [assist, setAssist] = useState(null);
  const [universalTurn, setUniversalTurn] = useState(null);
  /** Clever-Tab (hideFeed): letzte Accept-/Send-Aktion über dem Composer, kein leerer Weißraum. */
  const [lastComposerAction, setLastComposerAction] = useState(null);
  const [offerPrep, setOfferPrep] = useState(null);
  const [appointmentDraft, setAppointmentDraft] = useState(null);
  const [composerMode, setComposerMode] = useState(COMPOSER_MODES.CLEVER_WORK);
  const [editingMessageDraft, setEditingMessageDraft] = useState(null);
  const debounceRef = useRef(null);
  const assistRequestIdRef = useRef(0);
  /** Chip-/Review-vorbereitete Karte: empty-draft-Effekt darf sie nicht verwerfen. */
  const assistPinnedRef = useRef(false);
  const composerInputRef = useRef(null);
  const offerPrepRef = useRef(null);
  const appointmentDraftRef = useRef(null);
  /** Clever-Arbeit-Draft, der beim Nachrichten-Edit pausiert wurde. */
  const priorWorkDraftRef = useRef('');
  /** Rohtext / Stichworte für Magic – Ton-Wechsel regeneriert daraus. */
  const magicSeedRef = useRef('');
  const [outboundTone, setOutboundTone] = useState('freundlich');
  const [magicUiHint, setMagicUiHint] = useState(null);
  const [magicBusy, setMagicBusy] = useState(false);
  const [hasMagicSeed, setHasMagicSeed] = useState(false);
  const allowWithoutPackageDetailsRef = useRef(false);
  const composerModeRef = useRef(composerMode);

  useEffect(() => {
    composerModeRef.current = composerMode;
  }, [composerMode]);

  function pinAssist(next) {
    assistPinnedRef.current = true;
    setAssist(next);
  }

  function unpinAssist() {
    assistPinnedRef.current = false;
  }

  function clearAssist() {
    assistPinnedRef.current = false;
    setAssist(null);
  }

  /** Fingerprint: gleiche Nachricht nicht mehrfach in den Feed spiegeln. */
  const lastMirroredMessageFingerprintRef = useRef('');
  const leadRef = useRef(lead);
  const workingContextRef = useRef(workingContextItems);

  useEffect(() => {
    leadRef.current = lead;
  }, [lead]);

  useEffect(() => {
    workingContextRef.current = workingContextItems;
  }, [workingContextItems]);

  // Global-Composer-Handoff: Nachricht in customer_message_edit öffnen (kein zweiter Composer / kein Neu-Interpret)
  const messageEditHandoffConsumedRef = useRef(null);
  useEffect(() => {
    if (isCustomerMessageEditMode(composerMode)) return;
    const handoff = (workingContextItems || []).find((item) => (
      item
      && item.composerMode === COMPOSER_MODES.CUSTOMER_MESSAGE_EDIT
      && (item.messageDraft || item.draft)
    ));
    if (!handoff) return;
    const fingerprint = `${handoff.id || 'handoff'}|${String(handoff.messageDraft || handoff.draft || '').slice(0, 120)}`;
    if (messageEditHandoffConsumedRef.current === fingerprint) return;
    messageEditHandoffConsumedRef.current = fingerprint;
    const next = beginCustomerMessageEdit({
      result: { body: handoff.messageDraft || handoff.draft, draft: { body: handoff.messageDraft || handoff.draft } },
      recipient: handoff.recipient || handoff.customerName || customerName || 'Kunde',
      contextAttachments: workingContextItems,
      priorWorkDraft: '',
    });
    priorWorkDraftRef.current = next.priorWorkDraft;
    setEditingMessageDraft(next.editingMessageDraft);
    setComposerMode(next.composerMode);
    setDraft(next.draft);
    setUniversalTurn(null);
  }, [workingContextItems, composerMode, customerName]);

  /**
   * Nachricht-Entwurf bewusst in den Seller-Verlauf spiegeln (Chip / Übernehmen).
   * Nicht aus dem Debounce-Interpret aufrufen – sonst Feed-Spam bei jedem Lead-Update.
   */
  function mirrorMessageDraftToFeed(body, options = {}) {
    const text = String(body ?? '').trim();
    if (!text) return options.lead ?? lead;
    const fingerprint = `${options.title || 'message'}|${text.slice(0, 240)}`;
    if (lastMirroredMessageFingerprintRef.current === fingerprint) {
      return options.lead ?? lead;
    }
    lastMirroredMessageFingerprintRef.current = fingerprint;
    return persistCleverFeedCard({
      title: options.title || '✨ Nachricht vorbereitet',
      body: text,
      primaryCta: 'Senden',
      type: INLINE_RESULT_TYPES.MESSAGE_DRAFT,
    }, {
      lead: options.lead ?? lead,
      text,
      historyText: options.historyText || 'Nachricht vorbereitet',
      ctaLabel: 'Senden',
      ctaAction: null,
      visibleToCustomer: false,
    });
  }

  /**
   * Clever-Vertrag (wie Cursor):
   * 1) Verkäufer gibt ein (Composer)
   * 2) Clever schlägt vor (Mitte / reviewSlot) – noch nichts persistiert
   * 3) Erst nach Ja geht es weiter (Accept)
   */
  function showUniversalReview(turn) {
    setLastComposerAction(null);
    setUniversalTurn(turn);
    setAssist(null);
  }

  function rememberLastComposerAction(next) {
    if (!next) return;
    setLastComposerAction(next);
  }

  /** Gemeinsamer Orchestrator-Input: fester Lead, Surface Akte (kein zweiter Brain). */
  function buildAkteSellerTurnParams(extra = {}) {
    return {
      lead,
      customerName,
      workingContextItems,
      currentOfferContext: toCurrentOfferContext(findOfferWorkingContext(workingContextItems)),
      scopeHint: AKTE_COMPOSER_SCOPE,
      ...extra,
    };
  }

  /** Clever-Arbeit: Input → Magic-Nachricht oben (Cursor-ähnlich). */
  async function runCleverProposeFromInput(rawText) {
    const text = String(rawText ?? '').trim();
    if (!text || sending) return false;
    setSending(true);
    setFeedback('Clever schreibt …');
    try {
      if (onResolveOfferReference) {
        onResolveOfferReference(text);
      }

      const offerCtx = resolveCurrentOfferContext();
      const workingCtx = resolveMagicWorkingContext();
      const openVehicles = (() => {
        try {
          return (buildVehicleOpportunityCards({ lead, wishFields: lead?.wish ?? {} }) || [])
            .map((card) => {
              const title = formatVehicleCardTitle(card) || card.shortLabel || card.label || null;
              const conditions = formatVehicleCardConditions(card);
              const price = formatVehicleCardPrice(card);
              const summary = [conditions, price].filter(Boolean).join(' · ') || null;
              const config = (lead?.crm?.vehicleConfigurations ?? []).find((vc) => (
                vc.id === card.id || vc.id === card.configurationId
              ));
              const trackMeta = config ? getVehicleTrackMeta(config) : null;
              return {
                modelKey: card.modelKey || card.model || null,
                model: card.modelName || card.model || null,
                trimId: card.trimId || card.trim || card.trimLabel || null,
                color: card.color || card.colorId || null,
                label: title,
                shortLabel: summary ? `${String(title || '').replace(/^Kia\s+/i, '')} · ${summary}` : title,
                offerId: card.id || card.configurationId || card.offerId || null,
                id: card.id || null,
                monthlyRate: card.desiredRate ?? null,
                termMonths: card.termMonths ?? null,
                mileagePerYear: card.mileagePerYear ?? null,
                paymentType: card.paymentType ?? null,
                summary,
                status: trackMeta?.status || null,
                statusLabel: trackMeta?.status
                  ? (VEHICLE_TRACK_STATUS_UI[trackMeta.status]?.label || trackMeta.status)
                  : null,
              };
            });
        } catch {
          return [];
        }
      })();

      const turn = runCleverSellerTurn(buildAkteSellerTurnParams({
        sellerInput: text,
        currentOfferContext: offerCtx,
        pendingAction: universalTurn?.pendingAction || null,
      }));

      // Magic: LLM / grounded Writer ersetzt Template-Mails
      const enriched = await enrichSellerTurnWithMagicPropose({
        turn,
        sellerInput: text,
        lead,
        customerName,
        displayName,
        workingContext: workingCtx,
        offerContext: offerCtx,
        openVehicles,
        tone: outboundTone || 'freundlich',
      });

      setDraft('');
      setOfferPrep(null);
      setAppointmentDraft(null);

      if (enriched.magicBody) {
        if (shouldShowUniversalReview(enriched.turn)) {
          showUniversalReview(enriched.turn);
        } else {
          setUniversalTurn(null);
          clearAssist();
          rememberLastComposerAction(buildComposerLastActionFromText({
            body: enriched.magicBody,
            title: 'Nachricht',
            status: COMPOSER_LAST_ACTION_STATUS.READY_TO_SEND,
          }));
        }
        setFeedback(enriched.feedback || 'Geprüfter Entwurf – bitte Inhalt kurz gegenlesen');
        setTimeout(() => setFeedback(''), 3200);
        return true;
      }

      if (shouldShowUniversalReview(turn)) {
        showUniversalReview(turn);
        setFeedback('Clever hat vorbereitet');
        setTimeout(() => setFeedback(''), 2400);
        return true;
      }
      const draftBody = String(
        turn?.messageDraft
        || turn?.preparedActions?.find((a) => a.type === SELLER_TURN_INTENTS.DRAFT_MESSAGE)
          ?.payload?.messageDraft
        || '',
      ).trim();
      if (draftBody) {
        setUniversalTurn(null);
        clearAssist();
        rememberLastComposerAction(buildComposerLastActionFromText({
          body: draftBody,
          title: 'Nachricht',
          status: COMPOSER_LAST_ACTION_STATUS.READY_TO_SEND,
        }));
        setFeedback('Nachricht vorbereitet');
        setTimeout(() => setFeedback(''), 2400);
        return true;
      }
      clearAssist();
      setUniversalTurn(null);
      setLastComposerAction(null);
      setFeedback('Clever hat nichts vorbereitet – bitte anders formulieren');
      setTimeout(() => setFeedback(''), 2800);
      return false;
    } finally {
      setSending(false);
    }
  }

  function snapshotAcceptedReview(options = {}) {
    const model = universalTurn ? buildUniversalReviewModel(universalTurn) : null;
    const status = options.status || (
      options.messageBody
        ? COMPOSER_LAST_ACTION_STATUS.READY_TO_SEND
        : COMPOSER_LAST_ACTION_STATUS.ACCEPTED
    );
    const snap = buildComposerLastActionFromReviewModel(model, {
      status,
      body: options.messageBody || options.body || '',
      statusLabel: options.statusLabel || '',
    });
    if (snap) rememberLastComposerAction(snap);
  }

  function focusComposer() {
    const el = document.getElementById('sw-composer-seller');
    if (!el) return;
    el.focus?.();
    composerInputRef.current = el;
  }

  useEffect(() => {
    offerPrepRef.current = offerPrep;
  }, [offerPrep]);

  useEffect(() => {
    appointmentDraftRef.current = appointmentDraft;
  }, [appointmentDraft]);

  useEffect(() => {
    if (!seedDraftToken || !seedDraft) return;
    const text = String(seedDraft).trim();
    if (!text) return;
    if (seedAutoRun) {
      // Spur / „Nachricht vorbereiten“: sofort vorschlagen (Cursor-Vertrag).
      void runCleverProposeFromInput(text);
      return;
    }
    setDraft(text);
  }, [seedDraftToken, seedDraft, seedAutoRun]);

  const timeline = useMemo(
    () => buildSharedWorkspaceTimeline(lead, { role: 'seller' }),
    [lead],
  );

  const displayName = formatCustomerDisplayName(customerName) || 'dem Kunden';
  const composerUi = useMemo(
    () => resolveComposerUi(composerMode, {
      recipient: editingMessageDraft?.recipient || displayName,
      displayName,
      cleverMode,
    }),
    [composerMode, editingMessageDraft?.recipient, displayName, cleverMode],
  );
  const placeholder = composerUi.placeholder;
  const inMessageEdit = isCustomerMessageEditMode(composerMode);

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
    // Clever-Vertrag (wie Cursor): kein Live-Interpret beim Tippen.
    // Vorschlag erst nach Absenden (handleSend) oder Chip.
    // Draft-Leeren nach Absenden darf die frische Review nicht löschen.
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
    assistRequestIdRef.current += 1;
    return undefined;
  }, [draft, composerMode]);

  useEffect(() => {
    if (!focusToken) return;
    const el = document.getElementById('sw-composer-seller');
    if (!el) return;
    el.focus?.();
    composerInputRef.current = el;
  }, [focusToken, cleverMode]);

  /**
   * Chip: nur Composer befüllen (Cursor-Vertrag).
   * Absenden → Vorschlag oben. Kein sofortiges Propose.
   */
  function showSuggestionDraft(chipId) {
    const seed = buildChipSellerInput(chipId, { customerName });
    if (!seed) {
      setFeedback('Chip unbekannt');
      setTimeout(() => setFeedback(''), 2000);
      return;
    }
    setComposerMode(COMPOSER_MODES.CLEVER_WORK);
    setEditingMessageDraft(null);
    priorWorkDraftRef.current = '';
    setOfferPrep(null);
    setAppointmentDraft(null);
    clearAssist();
    // Bestehenden Freitext behalten und Chip-Auftrag anhängen, sonst ersetzen.
    setDraft((prev) => {
      const cur = String(prev ?? '').trim();
      if (!cur) return seed;
      if (cur === seed) return cur;
      return `${cur}\n${seed}`;
    });
    setFeedback('Ergänzen und absenden – Clever schlägt oben vor');
    setTimeout(() => setFeedback(''), 2800);
    focusComposer();
  }

  function handleSuggestionChip(chip) {
    if (!chip?.id || sending) return;
    showSuggestionDraft(chip.id);
  }

  function persistMessages(nextLead, historyText) {
    onPersistLead?.(nextLead, { historyText });
  }

  function persistCleverFeedCard(result, options = {}) {
    const baseLead = options.lead ?? lead;
    const text = options.text || buildCleverFeedTextFromResult(result);
    if (!text || !baseLead?.id) return baseLead;
    const posted = postCleverAssistFeedCard({
      lead: baseLead,
      title: result?.title || '✨ Clever',
      text,
      ctaLabel: options.ctaLabel ?? result?.primaryCta ?? null,
      ctaAction: options.ctaAction ?? resolveCleverFeedCtaAction(result),
      visibleToCustomer: options.visibleToCustomer === true,
    });
    if (!posted.message) return baseLead;
    persistMessages(posted.lead, options.historyText || 'Clever im Kundenverlauf');
    return posted.lead;
  }

  function resolveSendFailureFeedback(error) {
    if (error === 'thread_not_found') {
      return 'Thread nicht gefunden – bitte aus Clever Eingang erneut öffnen';
    }
    if (error === 'sensitive_or_empty') {
      return 'Nachricht enthält sensible Daten und kann nicht gesendet werden.';
    }
    return 'Nachricht konnte nicht gesendet werden.';
  }

  function resolveReplyContext() {
    const offerCtx = findOfferWorkingContext(workingContextItems);
    return {
      threadId: replyContext?.threadId ?? null,
      relatedOfferId: offerCtx?.offerId
        ?? replyContext?.relatedOfferId
        ?? null,
      relatedQuestionId: replyContext?.relatedQuestionId ?? null,
    };
  }

  function resolveCurrentOfferContext() {
    return toCurrentOfferContext(findOfferWorkingContext(workingContextItems));
  }

  /** Kundennachricht wirklich senden (nicht Clever-Arbeit interpretieren). */
  function sendCustomerMessage(body, options = {}) {
    const text = String(body ?? '').trim();
    if (!text || sending) return false;
    setSending(true);
    try {
      const ctx = resolveReplyContext();
      const result = sendCleverChannelMessage({
        lead,
        text,
        threadId: ctx.threadId,
        relatedOfferId: ctx.relatedOfferId,
        relatedQuestionId: ctx.relatedQuestionId,
        createdByName: 'Verkäufer',
      });
      if (!result.message) {
        setFeedback(resolveSendFailureFeedback(result.error));
        return false;
      }
      persistMessages(result.lead, options.historyText || 'Nachricht im gemeinsamen Arbeitsraum gesendet');
      if (options.afterEdit) {
        setComposerMode(COMPOSER_MODES.CLEVER_WORK);
        setEditingMessageDraft(null);
        priorWorkDraftRef.current = '';
        resetMagicComposer();
      }
      setDraft('');
      clearAssist();
      setUniversalTurn(null);
      rememberLastComposerAction(buildComposerLastActionFromText({
        body: text,
        title: options.title || 'Nachricht',
        status: COMPOSER_LAST_ACTION_STATUS.SENT,
      }));
      setOfferPrep(null);
      setAppointmentDraft(null);
      onMessageSent?.();
      setFeedback('Gesendet');
      setTimeout(() => setFeedback(''), 2500);
      return true;
    } finally {
      setSending(false);
    }
  }

  function handleSend(text) {
    if (!text || sending) return;

    const editing = isCustomerMessageEditMode(composerModeRef.current);
    if (editing) {
      const completed = completeCustomerMessageEditSend({ editedBody: text });
      sendCustomerMessage(completed.sendBody, {
        afterEdit: true,
        title: 'Nachricht',
      });
      return;
    }

    const shortcut = resolveComposerShortcut(text);
    if (shortcut) {
      const sellerInput = buildChipSellerInput(shortcut.id, { customerName }) || text;
      void runCleverProposeFromInput(sellerInput);
      return;
    }
    if (isComposerAkteSearchQuery(text)) {
      const turn = runCleverSellerTurn(buildAkteSellerTurnParams({
        sellerInput: text,
      }));
      const historyAction = turn?.preparedActions?.find(
        (a) => a.type === 'search_customer_history' && a.legacy,
      );
      setDraft('');
      if (shouldShowUniversalReview(turn)) {
        showUniversalReview(turn);
        setFeedback('Verlauf durchsucht');
      } else if (historyAction?.legacy?.ok) {
        // Cursor-UI: Treffer als Vorschlag, kein SellerInlineAssistCard
        setUniversalTurn(null);
        clearAssist();
        const hitText = historyAction.legacy?.results?.[0]?.body
          || historyAction.legacy?.results?.[0]?.headline
          || 'Treffer im Verlauf';
        rememberLastComposerAction(buildComposerLastActionFromText({
          body: String(hitText),
          title: 'Verlauf',
          status: COMPOSER_LAST_ACTION_STATUS.ACCEPTED,
          summaryLine: 'Im Chat ansehen',
        }));
        setFeedback('Suche im Vorgang');
      } else {
        setUniversalTurn(null);
        clearAssist();
        setFeedback('Nichts gefunden');
      }
      setTimeout(() => setFeedback(''), 2500);
      return;
    }
    // Clever-Arbeit: Absenden = Clever ausführen (Antwort in der Mitte),
    // nicht die Arbeitsanweisung als Kundennachricht schicken.
    void runCleverProposeFromInput(text);
  }

  function resetMagicComposer() {
    magicSeedRef.current = '';
    setOutboundTone('freundlich');
    setMagicUiHint(null);
    setHasMagicSeed(false);
    allowWithoutPackageDetailsRef.current = false;
  }

  function resolveMagicOfferContext() {
    return toCurrentOfferContext(findOfferWorkingContext(workingContextItems));
  }

  function resolveMagicWorkingContext() {
    const offerItem = findOfferWorkingContext(workingContextItems);
    if (!offerItem) return null;
    const card = offerItem.card || null;
    return {
      offerId: offerItem.offerId,
      shortLabel: offerItem.shortLabel || offerItem.label,
      label: offerItem.label,
      card,
      modelKey: card?.modelKey || card?.model || offerItem.modelKey || null,
      trimId: card?.trimId || card?.trim || offerItem.trimId || null,
      color: card?.color || null,
      monthlyRate: card?.desiredRate ?? card?.monthlyRate ?? offerItem.monthlyRate ?? null,
      termMonths: card?.termMonths ?? offerItem.termMonths ?? null,
      mileagePerYear: card?.mileagePerYear ?? offerItem.mileagePerYear ?? null,
      paymentType: card?.paymentType ?? offerItem.paymentType ?? null,
      summary: offerItem.shortLabel || offerItem.label || null,
    };
  }

  async function runMagicCompose(sourceText, { allowWithoutPackageDetails = false, tone = outboundTone } = {}) {
    const source = String(sourceText ?? '').trim();
    if (!source) return null;
    magicSeedRef.current = source;
    setHasMagicSeed(true);
    allowWithoutPackageDetailsRef.current = allowWithoutPackageDetails;
    setMagicBusy(true);
    setFeedback('Clever versteht …');
    try {
      // Zuerst Orchestrator: Aktion/Review vor reinem Textgenerator
      if (!isCustomerMessageEditMode(composerModeRef.current)) {
        const turn = runCleverSellerTurn(buildAkteSellerTurnParams({
          sellerInput: source,
          pendingAction: universalTurn?.pendingAction || null,
        }));
        if (shouldShowUniversalReview(turn)) {
          setUniversalTurn(turn);
          clearAssist();
          setFeedback('Clever hat vorbereitet – bitte prüfen');
          setTimeout(() => setFeedback(''), 2800);
          return { ok: true, turn, mode: 'universal_review' };
        }
        const turnDraft = turn.messageDraft
          || turn.preparedActions?.find((a) => a.type === SELLER_TURN_INTENTS.DRAFT_MESSAGE)
            ?.payload?.messageDraft
          || null;
        if (turnDraft && !turn.preparedActions?.some((a) => (
          a.type === SELLER_TURN_INTENTS.PREPARE_OFFER
          || a.type === SELLER_TURN_INTENTS.PROPOSE_APPOINTMENT
        ))) {
          // Reine Nachricht aus Turn – optional mit Magic glätten
          setUniversalTurn(null);
        } else if (turnDraft) {
          setUniversalTurn(turn);
          clearAssist();
          setFeedback('Clever hat vorbereitet – bitte prüfen');
          setTimeout(() => setFeedback(''), 2800);
          return { ok: true, turn, mode: 'universal_review' };
        }
      }

      setFeedback('Clever schreibt …');
      const workingCtx = resolveMagicWorkingContext();
      const offerCtx = resolveMagicOfferContext();
      const akteContext = buildMagicAkteContext({
        lead,
        rawSellerInput: source,
        workingContext: workingCtx,
        offerContext: offerCtx,
      });
      const payload = {
        rawSellerInput: source,
        draftText: source,
        lead,
        customerName,
        recipient: displayName,
        tone,
        workingContext: workingCtx,
        offerContext: offerCtx,
        akteContext,
        chipIntent: detectChipIntent(source) || akteContext.chipIntent,
        allowWithoutPackageDetails,
        sellerId: lead?.crm?.sellerId || lead?.ownerId || 'seller',
        dealerId: lead?.crm?.dealerId || lead?.dealerId || null,
      };

      let result = null;
      const magicRemoteEnabled = isCleverMagicMessageClientEnabled();
      if (magicRemoteEnabled) {
        try {
          const remote = await requestCleverMagicMessage(payload);
          if (remote?.ok && remote.body) {
            result = {
              ok: true,
              text: remote.body,
              changed: remote.body !== source,
              tone,
              seed: remote.seed || source,
              grounded: remote,
              missingKnowledge: remote.missingKnowledge || [],
              uiHint: remote.uiHint || null,
              writer: remote.writer,
            };
          }
        } catch {
          result = null;
        }
      }

      if (!result?.ok) {
        result = await composeSellerOutboundMessageAsync(payload, {
          forceFallback: !magicRemoteEnabled,
        });
      }

      if (!result?.ok) {
        setFeedback('Clever konnte keine Nachricht erzeugen');
        setTimeout(() => setFeedback(''), 2000);
        return null;
      }

      setDraft(result.text);
      setMagicUiHint(result.uiHint || null);
      if (result.uiHint?.message) {
        setFeedback(result.uiHint.message);
      } else {
        setFeedback(result.changed ? 'Clever hat die Nachricht geschrieben' : 'Nachricht unverändert');
        setTimeout(() => setFeedback(''), 2800);
      }
      return result;
    } finally {
      setMagicBusy(false);
    }
  }

  function handleEditMessageDraft(result) {
    if (!result || sending) return;
    const next = beginCustomerMessageEdit({
      result,
      recipient: displayName,
      contextAttachments: workingContextItems,
      priorWorkDraft: draft,
    });
    priorWorkDraftRef.current = next.priorWorkDraft;
    resetMagicComposer();
    setComposerMode(next.composerMode);
    setEditingMessageDraft(next.editingMessageDraft);
    setDraft(next.draft);
    setUniversalTurn(null);
    // Assist bleibt gepinnt für Abbrechen-Restore – im Edit nicht gerendert
    pinAssist(assist?.ok
      ? assist
      : { ok: true, results: [result] });
    setFeedback('');
    queueMicrotask(() => focusComposer());
  }

  function handleCancelMessageEdit() {
    const cancelled = cancelCustomerMessageEdit({
      editingMessageDraft,
      priorWorkDraft: priorWorkDraftRef.current,
    });
    setComposerMode(cancelled.composerMode);
    setEditingMessageDraft(null);
    setDraft(cancelled.draft);
    setUniversalTurn(null);
    priorWorkDraftRef.current = '';
    resetMagicComposer();
    if (cancelled.sourceResult) {
      pinAssist({
        ok: true,
        results: [cancelled.sourceResult],
      });
    }
    setFeedback('');
  }

  function handleImproveWithClever(text) {
    void runMagicCompose(text ?? draft);
  }

  function handleRestoreMagicSeed() {
    const seed = String(magicSeedRef.current || '').trim();
    if (!seed) return;
    setDraft(seed);
    setMagicUiHint(null);
    setFeedback('Original wiederhergestellt');
    setTimeout(() => setFeedback(''), 2000);
  }

  function handleMagicWriteWithoutPackageDetails() {
    const seed = String(magicSeedRef.current || draft || '').trim();
    if (!seed) return;
    void runMagicCompose(seed, { allowWithoutPackageDetails: true });
  }

  function handleOutboundToneChange(toneId) {
    const nextTone = OUTBOUND_TONES.some((t) => t.id === toneId) ? toneId : 'freundlich';
    setOutboundTone(nextTone);
    if (!isCustomerMessageEditMode(composerModeRef.current)) return;
    const seed = String(magicSeedRef.current || draft || '').trim();
    if (!seed) return;
    if (!magicSeedRef.current) magicSeedRef.current = seed;
    void runMagicCompose(seed, {
      tone: nextTone,
      allowWithoutPackageDetails: allowWithoutPackageDetailsRef.current,
    });
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
    clearAssist();
    setFeedback('Verifizierten Wert übernommen');
    setTimeout(() => setFeedback(''), 2200);
  }

  function handlePrepareReply(result) {
    if (result.insertText) {
      setDraft((prev) => insertInlineFactIntoDraft(prev, result.insertText));
      clearAssist();
      return;
    }
    handleInsertFact(result);
  }

  function handleSendDraft(result) {
    const body = result.draft?.body || result.body;
    if (body) sendCustomerMessage(body);
  }

  async function handleCopyDraft(result) {
    const body = result.draft?.body || result.body;
    if (!body) return;
    try {
      await navigator.clipboard?.writeText?.(String(body));
      setFeedback('Text kopiert');
      setTimeout(() => setFeedback(''), 2200);
    } catch {
      setFeedback('Kopieren nicht möglich');
      setTimeout(() => setFeedback(''), 2200);
    }
  }

  function handleSendActions(result) {
    setSending(true);
    try {
      const ctx = resolveReplyContext();
      const sent = sendSellerWorkspacePackage({
        lead,
        body: result.draft?.body || result.body,
        actions: result.actions || [],
        createdByName: 'Verkäufer',
        threadId: ctx.threadId,
        relatedOfferId: ctx.relatedOfferId,
        relatedQuestionId: ctx.relatedQuestionId,
      });
      if (!sent.ok) {
        setFeedback(sent.error === 'thread_not_found'
          ? resolveSendFailureFeedback(sent.error)
          : 'Paket konnte nicht gesendet werden.');
        return;
      }
      persistMessages(sent.lead, 'Workspace-Paket gesendet');
      setDraft('');
      clearAssist();
      setOfferPrep(null);
      setAppointmentDraft(null);
      onMessageSent?.();
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

  function handlePrepareOffer(result, options = {}) {
    if (!options.skipFeedCard) {
      persistCleverFeedCard(result, {
        lead: options.lead ?? null,
        ctaAction: resolveCleverFeedCtaAction(result) || 'prepare_offer',
        historyText: 'Clever Angebotsvorbereitung',
      });
    }
    const magic = result?.magic ?? offerPrep;
    if (onPrepareOfferDraft) {
      onPrepareOfferDraft({
        magic,
        lead: options.lead ?? null,
      });
      setFeedback('Angebot wird vorbereitet …');
      setTimeout(() => setFeedback(''), 2500);
      return;
    }
    onOpenOffer?.();
  }

  function handleSendPortfolio(result) {
    if (!onSendPortfolio) {
      setFeedback('Kundenlink-Versand nicht verfügbar');
      return;
    }
    const ok = onSendPortfolio();
    if (ok === false) {
      // Parent zeigt Toast (E-Mail fehlt, keine Angebote, …) – kein Feed-Eintrag
      return;
    }
    persistCleverFeedCard(result, {
      ctaAction: 'send_portfolio',
      historyText: 'Kundenlink aus Composer vorbereitet',
    });
    clearAssist();
    setDraft('');
  }

  function handleCleverFeedCta(payload = {}) {
    const action = payload.ctaAction;
    if (action === 'send_portfolio') {
      handleSendPortfolio({});
      return;
    }
    if (action === 'prepare_offer' || action === 'complete_offer' || action === 'open_offer') {
      const magic = payload?.magic ?? offerPrepRef.current ?? null;
      if (onPrepareOfferDraft && magic) {
        onPrepareOfferDraft({ magic });
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
      const ctx = resolveReplyContext();
      const messageBody = result.messageBody || result.draft?.body;
      if (messageBody) {
        const sent = sendCleverChannelMessage({
          lead: nextLead,
          text: messageBody,
          threadId: ctx.threadId,
          relatedOfferId: ctx.relatedOfferId,
          relatedQuestionId: ctx.relatedQuestionId,
          createdByName: 'Verkäufer',
        });
        if (!sent.message) {
          setFeedback(resolveSendFailureFeedback(sent.error));
          return;
        }
        nextLead = sent.lead;
      }

      const card = sendCleverChannelMessage({
        lead: nextLead,
        text: `${appointment.typeLabel} · ${formatAppointmentWhen(appointment.startAt)}`,
        kind: MESSAGE_KIND.APPOINTMENT_CARD,
        threadId: ctx.threadId,
        relatedOfferId: ctx.relatedOfferId,
        relatedQuestionId: ctx.relatedQuestionId,
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
      if (!card.message) {
        setFeedback(resolveSendFailureFeedback(card.error));
        return;
      }
      nextLead = card.lead;

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
      clearAssist();
      setAppointmentDraft(null);
      onMessageSent?.();
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
      clearAssist();
      setAppointmentDraft(null);
      onMessageSent?.();
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
    if (isCustomerMessageEditMode(composerMode)) {
      handleCancelMessageEdit();
      return;
    }
    clearAssist();
    setUniversalTurn(null);
    setLastComposerAction(null);
    setOfferPrep(null);
    setAppointmentDraft(null);
  }

  /** Vielleicht: Entwurf in den Composer, ohne zu übernehmen */
  function handleMaybeUniversalReview() {
    if (!universalTurn) return;
    const preparedActions = universalTurn.preparedActions ?? [];
    const messageAction = preparedActions.find((a) => (
      a.type === SELLER_TURN_INTENTS.DRAFT_MESSAGE && a.status === 'prepared'
    ));
    const messageLegacy = messageAction?.legacy ?? null;
    const messageResult = messageLegacy?.results?.find(
      (r) => r.type === INLINE_RESULT_TYPES.MESSAGE_DRAFT,
    ) || messageLegacy?.results?.[0] || null;
    const body = String(
      universalTurn.messageDraft
      || messageAction?.payload?.messageDraft
      || messageResult?.draft?.body
      || messageResult?.body
      || '',
    ).trim();
    if (body) setDraft(body);
    clearAssist();
    setUniversalTurn(null);
    setLastComposerAction(null);
    setOfferPrep(null);
    setAppointmentDraft(null);
    setFeedback(body ? 'Zum Bearbeiten im Composer' : 'Verworfen – bitte neu formulieren');
    setTimeout(() => setFeedback(''), 2400);
  }

  function handleUniversalReviewAction(action) {
    if (!action || !universalTurn) return;
    if (action.action === 'discard') {
      handleDismissAssist();
      return;
    }
    if (action.action === 'check_calendar') {
      setFeedback('Kalenderverfügbarkeit noch nicht geprüft.');
      setTimeout(() => setFeedback(''), 3200);
      return;
    }
    if (action.action === 'view_contract_source') {
      const preview = universalTurn.contractDraft?.sourceDocument?.preview
        || universalTurn.interpretedInput?.raw
        || '';
      setFeedback(preview
        ? `Quelle: ${String(preview).slice(0, 160)}${preview.length > 160 ? '…' : ''}`
        : 'Keine Quelle hinterlegt');
      setTimeout(() => setFeedback(''), 4000);
      return;
    }
    if (action.action === 'edit_contract_values') {
      setFeedback('Werte bearbeiten – bitte im Composer korrigieren und erneut einlesen.');
      const preview = universalTurn.contractDraft?.sourceDocument?.preview
        || universalTurn.interpretedInput?.raw
        || '';
      if (preview) setDraft(preview);
      setTimeout(() => setFeedback(''), 3200);
      return;
    }
    if (action.action === 'accept_contract_import') {
      handleAcceptUniversalReview();
      return;
    }
    if (action.action === 'edit_message') {
      const body = String(
        universalTurn.messageDraft
        || universalTurn.handoffWorkingContext?.messageDraft
        || universalTurn.pendingAction?.messageDraft
        || '',
      ).trim();
      if (!body) {
        setFeedback('Keine Nachricht zum Bearbeiten');
        setTimeout(() => setFeedback(''), 2400);
        return;
      }
      const next = beginCustomerMessageEdit({
        result: { body, draft: { body } },
        recipient: customerName || universalTurn.resolvedCustomer?.name || 'Kunde',
        contextAttachments: [
          ...(workingContextItems || []),
          ...(universalTurn.handoffWorkingContext
            ? [universalTurn.handoffWorkingContext]
            : []),
        ],
        priorWorkDraft: '',
      });
      priorWorkDraftRef.current = next.priorWorkDraft;
      setEditingMessageDraft(next.editingMessageDraft);
      setComposerMode(next.composerMode);
      setDraft(next.draft);
      setUniversalTurn(null);
      clearAssist();
      setFeedback('Nachricht bearbeiten – Senden erst nach Bestätigung');
      setTimeout(() => setFeedback(''), 2800);
      return;
    }
    if (action.action === 'send_appointment_proposal' || action.action === 'send_handoff') {
      handleAcceptUniversalReview();
    }
  }

  function handleAcceptUniversalReview(options = {}) {
    if (!universalTurn || sending) return;
    const reviseAfter = Boolean(options.reviseFavoriteOffer);
    setSending(true);
    try {
      const preparedActions = universalTurn.preparedActions ?? [];
      const messageAction = preparedActions.find((a) => (
        a.type === SELLER_TURN_INTENTS.DRAFT_MESSAGE && a.status === 'prepared'
      ));
      const reviseAction = preparedActions.find((a) => a.payload?.reviseFavoriteOffer);

      const messageLegacyEarly = messageAction?.legacy ?? null;
      const messageResultEarly = messageLegacyEarly?.results?.find(
        (r) => r.type === INLINE_RESULT_TYPES.MESSAGE_DRAFT,
      ) || messageLegacyEarly?.results?.[0] || null;
      const messageBody = universalTurn.messageDraft
        || messageAction?.payload?.messageDraft
        || messageResultEarly?.draft?.body
        || messageResultEarly?.body
        || '';

      const applied = applyAcceptedSellerTurn(lead, universalTurn, {
        postFeedCard: true,
      });
      if (!applied.ok) {
        setFeedback('Konnte nicht übernommen werden.');
        return;
      }
      let nextLead = applied.lead;
      // Immer persistieren – sonst landet die Feed-Karte nur im flüchtigen nextLead
      persistMessages(
        nextLead,
        applied.acceptedLabels.length
          ? `Clever: ${applied.acceptedLabels.length} Angaben übernommen`
          : 'Clever Vorbereitung übernommen',
      );

      // Clever-Tab: Accept darf nicht in leeren Weißraum kippen (hideFeed).
      snapshotAcceptedReview({
        messageBody: messageBody || '',
        status: (messageBody || messageResultEarly)
          ? COMPOSER_LAST_ACTION_STATUS.READY_TO_SEND
          : COMPOSER_LAST_ACTION_STATUS.ACCEPTED,
        statusLabel: (messageBody || messageResultEarly)
          ? 'Bereit zum Senden'
          : (applied.acceptedLabels.length ? 'Übernommen' : 'Übernommen'),
      });

      // Cursor-Vertrag: nach Ja stoppen – kein stilles Auto-Weiter.
      // Ausnahme: explizit „Anpassen“ (reviseAfter).
      if (reviseAfter && reviseAction) {
        const modelKey = reviseAction.payload?.modelKey;
        const seed = modelKey
          ? `${modelKey} Angebot anpassen`
          : (universalTurn.interpretedInput?.normalized || 'Angebot anpassen');
        const refreshedOffer = runSellerOfferAssist(nextLead, seed, {});
        const offerResult = refreshedOffer?.results?.[0] || refreshedOffer || null;
        setUniversalTurn(null);
        setDraft('');
        clearAssist();
        setOfferPrep(null);
        setAppointmentDraft(null);
        setFeedback('Einsortiert – Angebot wird angepasst');
        setTimeout(() => setFeedback(''), 2800);
        if (offerResult) {
          handlePrepareOffer(offerResult, { lead: nextLead, skipFeedCard: true });
        }
        return;
      }

      const offerCtx = findOfferWorkingContext(workingContextItems);
      const commercialChange = (applied.acceptedLabels ?? []).some((label) => (
        /km|monat|rate|anzahlung|laufzeit|schlussrate|sonderzahlung/i.test(String(label))
      ));
      if (offerCtx?.card && commercialChange) {
        const card = {
          ...offerCtx.card,
          termMonths: nextLead?.wish?.termMonths ?? offerCtx.card.termMonths,
          mileagePerYear: nextLead?.wish?.mileagePerYear ?? offerCtx.card.mileagePerYear,
          desiredRate: nextLead?.desiredRate ?? offerCtx.card.desiredRate,
          downPayment: nextLead?.wish?.downPayment ?? offerCtx.card.downPayment,
        };
        const posted = postOfferUpdatedStatus({
          lead: nextLead,
          offerId: offerCtx.offerId,
          title: formatVehicleCardTitle(card).replace(/^Kia\s+/i, ''),
          conditionsLine: formatVehicleCardConditions(card) || '',
          rateLine: formatVehicleCardPrice(card) || '',
          eventLabel: 'Angebot aktualisiert',
          createdByName: 'Clever',
        });
        if (posted.message) {
          nextLead = posted.lead;
          persistMessages(nextLead, 'Angebot aktualisiert');
        }
      }

      if (messageBody) {
        mirrorMessageDraftToFeed(messageBody, { lead: nextLead });
      }

      setUniversalTurn(null);
      clearAssist();
      setDraft('');
      setOfferPrep(null);
      setAppointmentDraft(null);
      setFeedback(
        (messageBody || messageResultEarly)
          ? 'Übernommen – Nachricht bereit zum Senden'
          : (applied.acceptedLabels.length === 1
            ? '1 Angabe übernommen'
            : (applied.acceptedLabels.length
              ? `${applied.acceptedLabels.length} Angaben übernommen`
              : 'Übernommen')),
      );
      setTimeout(() => setFeedback(''), 2800);
    } finally {
      setSending(false);
    }
  }

  async function handleAttachFile(file) {
    if (!file || sending) return;
    const isPdf = /pdf/i.test(file.type) || /\.pdf$/i.test(file.name || '');
    if (!isPdf) {
      setFeedback('Bitte PDF reinwerfen (Vertrag oder Konfigurator).');
      setTimeout(() => setFeedback(''), 2800);
      return;
    }
    setSending(true);
    setFeedback('PDF wird gelesen …');
    try {
      const extracted = await extractMagicOfferPdf(file);
      const ocrProvider = await resolveCleverOcrProvider();
      // Gleicher PDF/OCR-Service wie Global Composer – Surface mit festem Lead.
      const { prepared, turn, skipped } = await runComposerPdfAttachTurnWithOcr({
        ...buildAkteSellerTurnParams(),
        extracted,
        file,
        ocrProvider,
      });

      if (skipped || (prepared.needsManualDescribe && prepared.kind !== 'contract_pdf')) {
        setDraft((prev) => (prev ? `${prev}\n${prepared.draftSeed}` : prepared.draftSeed));
        setFeedback(prepared.feedbackManual);
        setTimeout(() => setFeedback(''), 3200);
        return;
      }

      if (prepared.needsManualDescribe && prepared.kind === 'contract_pdf') {
        setDraft((prev) => (prev ? `${prev}\n${prepared.draftSeed}` : prepared.draftSeed));
      } else if (prepared.draftSeed) {
        setDraft(prepared.draftSeed);
      }

      if (prepared.ok && !prepared.needsManualDescribe) {
        onUpsertWorkingContext?.(buildDocumentWorkingContextItem({
          id: `pdf:${prepared.attachment.fileName || file.name || Date.now()}`,
          label: prepared.workingContextLabel || prepared.attachment.fileName || 'PDF',
          fileName: prepared.attachment.fileName || file.name || null,
          status: 'attached',
          kind: prepared.kind,
        }));
      }

      if (turn && shouldShowUniversalReview(turn)) {
        setUniversalTurn(turn);
        clearAssist();
        setFeedback(prepared.feedbackOk || 'PDF gelesen');
      } else if (turn) {
        setUniversalTurn(null);
        setFeedback(prepared.kind === 'contract_pdf'
          ? (prepared.feedbackManual || 'Vertrag gelesen – Kontext angehängt')
          : 'PDF gelesen – Kontext angehängt');
      } else {
        setFeedback(prepared.feedbackManual);
      }
      setTimeout(() => setFeedback(''), 3200);
    } catch (err) {
      setFeedback(err?.message || 'PDF konnte nicht gelesen werden');
      setTimeout(() => setFeedback(''), 3200);
    } finally {
      setSending(false);
    }
  }

  const emptyHint = compactEmpty
    ? 'Noch kein Verlauf – tippen, sprechen oder PDF reinwerfen.'
    : 'Noch kein Verlauf. Tippen, sprechen oder PDF reinwerfen – Clever nutzt denselben Kundenkontext wie den Notizzettel.';

  const reviewModel = useMemo(
    () => (universalTurn ? buildUniversalReviewModel(universalTurn) : null),
    [universalTurn],
  );

  const lastActionSlot = lastComposerAction ? (
    <SellerUniversalReviewCard
      model={lastComposerAction.model}
      status={lastComposerAction.status}
      statusLabel={lastComposerAction.statusLabel}
      onDismiss={() => setLastComposerAction(null)}
      onSend={lastComposerAction.status === COMPOSER_LAST_ACTION_STATUS.READY_TO_SEND
        ? (body) => sendCustomerMessage(body)
        : null}
    />
  ) : null;

  return (
    <section
      className={`cust-akte-workspace cust-akte-workspace--chat-only cust-akte-workspace--feed${hideFeed ? ' cust-akte-workspace--composer-only' : ''}${compactEmpty ? ' cust-akte-workspace--compact-empty' : ''}`}
      aria-label={hideFeed ? 'Clever Composer' : 'Kundenverlauf'}
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
        composerLabel={composerUi.label}
        sendAriaLabel={composerUi.sendAriaLabel}
        composerEditMode={inMessageEdit}
        onCancelEdit={inMessageEdit ? handleCancelMessageEdit : null}
        onImproveWithClever={inMessageEdit ? handleImproveWithClever : null}
        outboundTones={OUTBOUND_TONES}
        outboundTone={outboundTone}
        onOutboundToneChange={handleOutboundToneChange}
        magicBusy={magicBusy}
        magicUiHint={inMessageEdit ? magicUiHint : null}
        onMagicWriteWithoutDetails={inMessageEdit ? handleMagicWriteWithoutPackageDetails : null}
        onMagicReviewData={inMessageEdit && magicUiHint ? () => {
          setFeedback('Bitte Paket-/Ausstattungsdaten in Clever prüfen');
          setTimeout(() => setFeedback(''), 3200);
        } : null}
        onRestoreMagicSeed={inMessageEdit && hasMagicSeed ? handleRestoreMagicSeed : null}
        onOpenOffer={onOpenOffer}
        onUploadDocument={onUploadDocument}
        onStartSelfDisclosure={onStartSelfDisclosure}
        onCleverAction={handleCleverFeedCta}
        onAttachFile={handleAttachFile}
        hideFeed={hideFeed}
        feedTopSlot={hideFeed ? null : feedTopSlot}
        workspaceSlot={workspaceSlot}
        scrollToMessageId={hideFeed ? null : scrollToMessageId}
        scrollToMessageToken={hideFeed ? 0 : scrollToMessageToken}
        contextPills={workingContextItems}
        onRemoveContextPill={onRemoveWorkingContext}
        suggestionChips={COMPOSER_PRIMARY_CHIPS}
        moreSuggestionChips={COMPOSER_MORE_CHIPS}
        onSuggestionChip={handleSuggestionChip}
        reviewSlot={inMessageEdit ? null : (
          reviewModel ? (
            <SellerUniversalReviewCard
              model={reviewModel}
              onAccept={() => handleAcceptUniversalReview()}
              onAcceptAndRevise={() => handleAcceptUniversalReview({ reviseFavoriteOffer: true })}
              onMaybe={handleMaybeUniversalReview}
              onDismiss={handleDismissAssist}
              onReviewAction={handleUniversalReviewAction}
              onOpenHistoryHit={(result) => {
                if (result?.messageId && onFocusFeedMessage) {
                  onFocusFeedMessage(result.messageId);
                  clearAssist();
                  setUniversalTurn(null);
                  setLastComposerAction(null);
                  setDraft('');
                  return;
                }
                if (result?.offerId) {
                  onOpenOffer?.({ offerId: result.offerId, id: result.offerId });
                  clearAssist();
                  setUniversalTurn(null);
                  setLastComposerAction(null);
                  setDraft('');
                  return;
                }
                setFeedback('Treffer im Verlauf – Filter „Nachrichten“ nutzen');
                setTimeout(() => setFeedback(''), 2800);
              }}
            />
          ) : (
            lastActionSlot
          )
        )}
        micSlot={(
          <DealerAiInlineMic
            variant="toolbar"
            disabled={sending || isSaving || inMessageEdit}
            onTranscript={(text) => setDraft((prev) => (prev ? `${prev} ${text}` : text))}
          />
        )}
        plusActions={[
          {
            id: 'attach_offer',
            icon: '📎',
            label: (() => {
              const n = countLeadOffers(lead);
              return n > 0 ? `Angebot anhängen (${n})` : 'Angebot anhängen';
            })(),
            onClick: () => {
              if (onAttachOffer) {
                onAttachOffer();
                return;
              }
              onOpenOffer?.();
            },
          },
          {
            id: 'attach_document',
            icon: '📄',
            label: 'Dokument anhängen',
            onClick: () => {
              if (onAttachDocument) {
                onAttachDocument();
                return;
              }
              onUploadDocument?.();
            },
          },
          {
            id: 'offer',
            icon: '🚗',
            label: 'Angebot erstellen',
            onClick: () => setDraft((prev) => (prev ? prev : 'Mach dem Kunden ein Angebot.')),
          },
          {
            id: 'file',
            icon: '📥',
            label: 'Unterlage ablegen',
            onClick: () => onUploadDocument?.(),
          },
          {
            id: 'req',
            icon: '📋',
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
