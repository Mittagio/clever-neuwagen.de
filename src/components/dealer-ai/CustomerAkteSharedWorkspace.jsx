import { useEffect, useMemo, useRef, useState } from 'react';
import SharedWorkspaceChat from '../chat/SharedWorkspaceChat.jsx';
import DealerAiInlineMic from './DealerAiInlineMic.jsx';
import SellerInlineAssistCard from './SellerInlineAssistCard.jsx';
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
import { runCleverSellerTurn, shouldEscalateSellerInterpretation } from '../../services/cleverSeller/runCleverSellerTurn.js';
import {
  isCleverSellerOpenAiInterpretClientEnabled,
  requestCleverMagicMessage,
  requestCleverSellerTurn,
} from '../../services/clever/intelligence/cleverSharedIntelligenceClient.js';
import {
  INLINE_RESULT_TYPES,
  insertInlineFactIntoDraft,
  runSellerInlineAssist,
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
import { SELLER_TURN_INTENTS } from '../../services/cleverSeller/sellerFactTypes.js';
import {
  COMPOSER_PRIMARY_CHIPS,
  COMPOSER_MORE_CHIPS,
  buildComposerSuggestionAssist,
  resolveComposerShortcut,
} from '../../services/crm/composerSuggestionService.js';
import {
  findOfferWorkingContext,
  toCurrentOfferContext,
} from '../../services/crm/composerWorkingContext.js';
import { buildVehicleOpportunityCards, formatVehicleCardConditions, formatVehicleCardPrice, formatVehicleCardTitle } from '../../services/customerAkte.js';
import {
  isComposerAkteSearchQuery,
  runComposerAkteSearch,
} from '../../services/crm/composerAkteSearch.js';
import { shouldClearAssistOnEmptyDraft } from './composerAssistPin.js';
import {
  COMPOSER_MODES,
  beginCustomerMessageEdit,
  cancelCustomerMessageEdit,
  completeCustomerMessageEditSend,
  isCustomerMessageEditMode,
  resolveComposerUi,
  shouldRunSellerInterpret,
} from '../../services/crm/composerMode.js';

const DEBOUNCE_MS = 380;

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
  onSendPortfolio = null,
  onMessageSent = null,
  onUploadDocument = null,
  onStartSelfDisclosure = null,
  seedDraft = '',
  seedDraftToken = 0,
  feedTopSlot = null,
  /** Thread/Frage-Kontext aus Inbox-Deep-Link oder Portal-Antwort */
  replyContext = null,
  /** Cursor-Anhänge: aktives Angebot etc. */
  workingContextItems = [],
  onRemoveWorkingContext = null,
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
    setDraft(String(seedDraft));
  }, [seedDraftToken, seedDraft]);

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
    if (debounceRef.current) clearTimeout(debounceRef.current);
    // customer_message_edit: kein Debounce-Interpret, kein Universal Review, keine Facts
    if (!shouldRunSellerInterpret(composerMode)) {
      return undefined;
    }
    const text = String(draft ?? '').trim();
    if (text.length < 3) {
      assistRequestIdRef.current += 1;
      setUniversalTurn(null);
      if (!shouldClearAssistOnEmptyDraft({
        pinned: assistPinnedRef.current,
        confirmAssist,
      })) {
        return undefined;
      }
      if (confirmAssist?.ok) {
        setAssist(confirmAssist);
      } else {
        clearAssist();
      }
      return undefined;
    }
    debounceRef.current = setTimeout(() => {
      // Tippen ersetzt eine chip-/review-vorbereitete Karte.
      unpinAssist();
      const requestId = ++assistRequestIdRef.current;
      const isStale = () => requestId !== assistRequestIdRef.current
        || !shouldRunSellerInterpret(composerModeRef.current);

      const shortcut = resolveComposerShortcut(text);
      if (shortcut) {
        if (isStale()) return;
        const suggestion = buildComposerSuggestionAssist(lead, shortcut.id, {
          customerName,
        });
        setUniversalTurn(null);
        setAssist(suggestion.ok ? suggestion : null);
        return;
      }

      if (isComposerAkteSearchQuery(text)) {
        if (isStale()) return;
        const search = runComposerAkteSearch(lead, text, { customerName });
        setUniversalTurn(null);
        setAssist(search.ok ? search : null);
        return;
      }

      const applyAssistFromTurn = (turn) => {
        if (isStale()) return;
        if (shouldShowUniversalReview(turn)) {
          setUniversalTurn(turn);
          setAssist(null);
          return;
        }
        setUniversalTurn(null);

        const portfolioAssist = runSellerInlineAssist(lead, text);
        if (portfolioAssist?.ok && portfolioAssist.results?.some((r) => r.type === INLINE_RESULT_TYPES.PORTFOLIO_SEND)) {
          setAssist(portfolioAssist);
          return;
        }

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
        const result = portfolioAssist?.ok ? portfolioAssist : runSellerInlineAssist(lead, text);
        setAssist(result.ok ? result : null);
      };

      const localTurn = runCleverSellerTurn({
        lead,
        sellerInput: text,
        currentOfferContext: resolveCurrentOfferContext(),
      });
      const gate = shouldEscalateSellerInterpretation({
        ...localTurn,
        sellerInput: text,
        facts: localTurn.extractedFacts,
        normalized: localTurn.interpretedInput?.normalized,
      });

      if (
        isCleverSellerOpenAiInterpretClientEnabled()
        && gate.shouldEscalate
        && lead?.id
      ) {
        setFeedback('Clever prüft …');
        requestCleverSellerTurn({
          leadId: lead.id,
          sellerInput: text,
          needProfile: lead?.crm?.needProfile ?? null,
          sellerInsights: (lead?.crm?.sellerInsights ?? []).slice(-8).map((i) => ({
            text: String(i.text ?? '').slice(0, 400),
            labels: i.understoodLabels ?? i.labels ?? [],
            context: i.context ?? null,
          })),
        }).then((remote) => {
          if (isStale()) return;
          if (remote?.extractedFacts) {
            applyAssistFromTurn(remote);
          } else {
            applyAssistFromTurn(localTurn);
          }
          setFeedback('');
        }).catch(() => {
          if (isStale()) return;
          applyAssistFromTurn(localTurn);
          setFeedback('');
        });
        return;
      }

      applyAssistFromTurn(localTurn);
    }, DEBOUNCE_MS);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      assistRequestIdRef.current += 1;
    };
  }, [draft, lead, confirmAssist, customerName, workingContextItems, composerMode]);

  useEffect(() => {
    if (!focusToken) return;
    const el = document.getElementById('sw-composer-seller');
    if (!el) return;
    el.focus?.();
    composerInputRef.current = el;
  }, [focusToken, cleverMode]);

  function showSuggestionDraft(chipId) {
    const suggestion = buildComposerSuggestionAssist(lead, chipId, {
      customerName,
      focusOfferId: findOfferWorkingContext(workingContextItems)?.offerId ?? null,
    });
    if (!suggestion.ok) {
      setFeedback('Nachricht konnte nicht vorbereitet werden');
      setTimeout(() => setFeedback(''), 2800);
      return;
    }
    setComposerMode(COMPOSER_MODES.CLEVER_WORK);
    setEditingMessageDraft(null);
    priorWorkDraftRef.current = '';
    setUniversalTurn(null);
    pinAssist(suggestion);
    setOfferPrep(null);
    setAppointmentDraft(null);
    setDraft('');
    const isPortfolio = suggestion.results?.[0]?.type === INLINE_RESULT_TYPES.PORTFOLIO_SEND;
    setFeedback(isPortfolio
      ? 'Kundenlink vorbereitet'
      : 'Nachricht vorbereitet – prüfen und senden');
    setTimeout(() => setFeedback(''), 2800);
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

  function handleSend(text) {
    if (!text || sending) return;

    const editing = isCustomerMessageEditMode(composerModeRef.current);
    if (editing) {
      const completed = completeCustomerMessageEditSend({ editedBody: text });
      setSending(true);
      try {
        const ctx = resolveReplyContext();
        const result = sendCleverChannelMessage({
          lead,
          text: completed.sendBody,
          threadId: ctx.threadId,
          relatedOfferId: ctx.relatedOfferId,
          relatedQuestionId: ctx.relatedQuestionId,
          createdByName: 'Verkäufer',
        });
        if (!result.message) {
          setFeedback(resolveSendFailureFeedback(result.error));
          return;
        }
        persistMessages(result.lead, 'Nachricht im gemeinsamen Arbeitsraum gesendet');
        setComposerMode(completed.composerMode);
        setEditingMessageDraft(null);
        priorWorkDraftRef.current = '';
        resetMagicComposer();
        setDraft('');
        clearAssist();
        setUniversalTurn(null);
        setOfferPrep(null);
        setAppointmentDraft(null);
        onMessageSent?.();
        setFeedback('Gesendet');
        setTimeout(() => setFeedback(''), 2500);
      } finally {
        setSending(false);
      }
      return;
    }

    const shortcut = resolveComposerShortcut(text);
    if (shortcut) {
      handleSuggestionChip(shortcut);
      return;
    }
    if (isComposerAkteSearchQuery(text)) {
      const search = runComposerAkteSearch(lead, text, { customerName });
      setUniversalTurn(null);
      if (search.ok) pinAssist(search);
      else clearAssist();
      setDraft('');
      setFeedback(search.ok ? 'Suche im Vorgang' : 'Nichts gefunden');
      setTimeout(() => setFeedback(''), 2500);
      return;
    }
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
        return;
      }
      persistMessages(result.lead, 'Nachricht im gemeinsamen Arbeitsraum gesendet');
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
    return {
      offerId: offerItem.offerId,
      shortLabel: offerItem.shortLabel || offerItem.label,
      label: offerItem.label,
      card: offerItem.card || null,
      modelKey: offerItem.card?.modelKey || offerItem.card?.model || null,
      trimId: offerItem.card?.trimId || offerItem.card?.trim || null,
      color: offerItem.card?.color || null,
    };
  }

  async function runMagicCompose(sourceText, { allowWithoutPackageDetails = false, tone = outboundTone } = {}) {
    const source = String(sourceText ?? '').trim();
    if (!source) return null;
    magicSeedRef.current = source;
    setHasMagicSeed(true);
    allowWithoutPackageDetailsRef.current = allowWithoutPackageDetails;
    setMagicBusy(true);
    setFeedback('Clever schreibt …');
    try {
      const payload = {
        rawSellerInput: source,
        draftText: source,
        lead,
        customerName,
        recipient: displayName,
        tone,
        workingContext: resolveMagicWorkingContext(),
        offerContext: resolveMagicOfferContext(),
        allowWithoutPackageDetails,
        sellerId: lead?.crm?.sellerId || lead?.ownerId || 'seller',
        dealerId: lead?.crm?.dealerId || lead?.dealerId || null,
      };

      let result = null;
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

      if (!result?.ok) {
        // Client-Fallback: grounded Orchestrator ohne Server (gleiche Faktenregeln)
        result = await composeSellerOutboundMessageAsync(payload, { forceFallback: true });
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
    if (body) handleSend(body);
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
    setOfferPrep(null);
    setAppointmentDraft(null);
  }

  function handleAcceptUniversalReview() {
    if (!universalTurn || sending) return;
    setSending(true);
    try {
      const preparedActions = universalTurn.preparedActions ?? [];
      const offerAction = preparedActions.find((a) => (
        a.type === SELLER_TURN_INTENTS.PREPARE_OFFER && a.status === 'prepared'
      ));
      const messageAction = preparedActions.find((a) => (
        a.type === SELLER_TURN_INTENTS.DRAFT_MESSAGE && a.status === 'prepared'
      ));
      const appointmentAction = preparedActions.find((a) => (
        a.type === SELLER_TURN_INTENTS.PROPOSE_APPOINTMENT && a.status === 'prepared'
      ));
      const documentsAction = preparedActions.find((a) => (
        a.type === SELLER_TURN_INTENTS.REQUEST_DOCUMENTS && a.status === 'prepared'
      ));
      const portfolioAction = preparedActions.find((a) => (
        a.type === SELLER_TURN_INTENTS.SEND_PORTFOLIO && a.status === 'prepared'
      ));

      const applied = applyAcceptedSellerTurn(lead, universalTurn, {
        postFeedCard: false,
      });
      if (!applied.ok) {
        setFeedback('Konnte nicht übernommen werden.');
        return;
      }
      let nextLead = applied.lead;
      persistMessages(nextLead, `Clever: ${applied.acceptedLabels.length} Angaben übernommen`);

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

      const sellerSeed = universalTurn.interpretedInput?.normalized
        || universalTurn.interpretedInput?.raw
        || '';
      const refreshedOffer = offerAction
        ? runSellerOfferAssist(nextLead, sellerSeed, {
          previousPreparation: offerAction?.legacy?.results?.[0]?.magic
            || offerAction?.legacy?.previousPreparation
            || null,
        })
        : null;
      const offerResult = refreshedOffer?.results?.[0]
        || offerAction?.legacy?.results?.[0]
        || offerAction?.legacy
        || null;
      const messageLegacy = messageAction?.legacy ?? null;
      const messageResult = messageLegacy?.results?.find(
        (r) => r.type === INLINE_RESULT_TYPES.MESSAGE_DRAFT,
      ) || messageLegacy?.results?.[0] || null;
      const appointmentLegacy = appointmentAction?.legacy ?? null;
      const appointmentResult = appointmentLegacy?.results?.[0] || appointmentLegacy || null;
      const documentsLegacy = documentsAction?.legacy ?? null;

      setUniversalTurn(null);

      const updateOnly = Boolean(offerAction?.payload?.updateOnly);
      const messageBody = messageResult?.draft?.body || messageResult?.body || '';

      // Multi-Aktion: Angebot anpassen + Nachricht in einem Accept
      if (updateOnly && messageBody) {
        setDraft('');
        setOfferPrep(null);
        setAppointmentDraft(null);
        pinAssist(messageLegacy?.ok
          ? messageLegacy
          : { ok: true, results: [messageResult] });
        setFeedback('Änderungen übernommen – Nachricht prüfen und senden');
        setTimeout(() => setFeedback(''), 3200);
        return;
      }

      if (offerAction && offerResult && !updateOnly) {
        setDraft('');
        clearAssist();
        setOfferPrep(null);
        setAppointmentDraft(null);
        setFeedback(
          applied.acceptedLabels.length === 1
            ? '1 Angabe übernommen – Angebot wird vorbereitet'
            : `${applied.acceptedLabels.length} Angaben übernommen – Angebot wird vorbereitet`,
        );
        setTimeout(() => setFeedback(''), 2800);
        handlePrepareOffer(offerResult, { lead: nextLead, skipFeedCard: true });
        return;
      }

      if (updateOnly && !messageBody) {
        setDraft('');
        clearAssist();
        setOfferPrep(null);
        setAppointmentDraft(null);
        setFeedback('Angebot aktualisiert');
        setTimeout(() => setFeedback(''), 2500);
        return;
      }

      if (messageResult) {
        const body = messageResult.draft?.body || messageResult.body || '';
        if (body) {
          unpinAssist();
          setDraft(body);
          setAssist(messageLegacy?.ok ? messageLegacy : {
            ok: true,
            results: [messageResult],
          });
        } else {
          setDraft('');
          pinAssist(messageLegacy?.ok ? messageLegacy : {
            ok: true,
            results: [messageResult],
          });
        }
        setOfferPrep(null);
        setAppointmentDraft(null);
        setFeedback('Angaben übernommen – Nachricht bereit zum Senden');
        setTimeout(() => setFeedback(''), 2800);
        return;
      }

      if (appointmentResult && appointmentLegacy?.ok !== false) {
        setAppointmentDraft(appointmentLegacy?.appointment ?? appointmentResult?.appointment ?? null);
        pinAssist(appointmentLegacy?.ok ? appointmentLegacy : {
          ok: true,
          results: [appointmentResult],
        });
        setDraft('');
        setOfferPrep(null);
        setFeedback('Angaben übernommen – Termin bereit');
        setTimeout(() => setFeedback(''), 2800);
        return;
      }

      if (documentsLegacy) {
        const body = documentsLegacy.body || documentsLegacy.draft?.body || '';
        const actions = documentsLegacy.actions || [];
        unpinAssist();
        setAssist({
          ok: true,
          results: [{
            type: INLINE_RESULT_TYPES.ACTION_DRAFT,
            title: '✨ Clever hat vorbereitet',
            body,
            actions,
            draft: { body },
            primaryCta: 'Senden',
            secondaryCta: 'Bearbeiten',
          }],
        });
        setDraft(body);
        setOfferPrep(null);
        setAppointmentDraft(null);
        setFeedback('Angaben übernommen – Unterlagen-Paket bereit');
        setTimeout(() => setFeedback(''), 2800);
        return;
      }

      if (portfolioAction) {
        setDraft('');
        clearAssist();
        setOfferPrep(null);
        setAppointmentDraft(null);
        setFeedback(
          applied.acceptedLabels.length
            ? `${applied.acceptedLabels.length} Angabe${applied.acceptedLabels.length === 1 ? '' : 'n'} übernommen – Kundenlink`
            : 'Kundenlink wird vorbereitet',
        );
        setTimeout(() => setFeedback(''), 2800);
        handleSendPortfolio({});
        return;
      }

      setDraft('');
      clearAssist();
      setOfferPrep(null);
      setAppointmentDraft(null);
      setFeedback(
        applied.acceptedLabels.length === 1
          ? '1 Angabe übernommen'
          : `${applied.acceptedLabels.length} Angaben übernommen`,
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
      setFeedback('Bitte PDF reinwerfen (z. B. Konfigurator).');
      setTimeout(() => setFeedback(''), 2800);
      return;
    }
    setSending(true);
    setFeedback('PDF wird gelesen …');
    try {
      const extracted = await extractMagicOfferPdf(file);
      const fullText = extracted.ok ? String(extracted.text || '').trim() : '';
      const interpretSeed = [
        extracted.fileName ? `PDF: ${extracted.fileName}` : null,
        fullText || null,
      ].filter(Boolean).join('\n\n');
      const draftSeed = [
        extracted.fileName ? `PDF: ${extracted.fileName}` : null,
        fullText ? fullText.slice(0, 4000) : null,
      ].filter(Boolean).join('\n\n');

      if (!extracted.ok || !fullText) {
        setDraft((prev) => (prev
          ? `${prev}\nKonfigurator-PDF: ${extracted.fileName || file.name}`
          : `Konfigurator-PDF: ${extracted.fileName || file.name}`));
        setFeedback('PDF übernommen – bitte kurz beschreiben, was drinsteht.');
        setTimeout(() => setFeedback(''), 3200);
        return;
      }

      setDraft(draftSeed);
      const turn = runCleverSellerTurn({
        lead,
        sellerInput: interpretSeed,
        currentOfferContext: resolveCurrentOfferContext(),
        attachments: [{
          kind: 'configurator_pdf',
          mimeType: file.type || 'application/pdf',
          fileName: extracted.fileName,
        }],
      });
      if (shouldShowUniversalReview(turn)) {
        setUniversalTurn(turn);
        clearAssist();
        setFeedback('PDF gelesen – bitte Angaben prüfen');
      } else {
        setUniversalTurn(null);
        setFeedback('PDF gelesen – ergänze ggf. noch Details');
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

  const assistResults = assist?.results?.length
    ? assist.results
    : (confirmAssist?.results ?? []);

  const reviewModel = useMemo(
    () => (universalTurn ? buildUniversalReviewModel(universalTurn) : null),
    [universalTurn],
  );

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
        feedTopSlot={feedTopSlot}
        workspaceSlot={workspaceSlot}
        scrollToMessageId={scrollToMessageId}
        scrollToMessageToken={scrollToMessageToken}
        contextPills={workingContextItems}
        onRemoveContextPill={onRemoveWorkingContext}
        suggestionChips={COMPOSER_PRIMARY_CHIPS}
        moreSuggestionChips={COMPOSER_MORE_CHIPS}
        onSuggestionChip={handleSuggestionChip}
        reviewSlot={inMessageEdit ? null : (
          reviewModel ? (
            <SellerUniversalReviewCard
              model={reviewModel}
              onAccept={handleAcceptUniversalReview}
              onDismiss={handleDismissAssist}
            />
          ) : (
            <SellerInlineAssistCard
              results={assistResults}
              onInsertFact={handleInsertFact}
              onEditMessageDraft={handleEditMessageDraft}
              onUseVerified={handleUseVerified}
              onPrepareReply={handlePrepareReply}
              onSendDraft={handleSendDraft}
              onCopyDraft={handleCopyDraft}
              onSendActions={handleSendActions}
              onChoice={handleChoice}
              onPrepareOffer={handlePrepareOffer}
              onSendPortfolio={handleSendPortfolio}
              onAppointmentPrimary={handleAppointmentPrimary}
              onOpenSearchHit={(result) => {
                if (result?.offerId) {
                  onOpenOffer?.({ offerId: result.offerId, id: result.offerId });
                  clearAssist();
                  setDraft('');
                  return;
                }
                if (result?.messageId && onFocusFeedMessage) {
                  onFocusFeedMessage(result.messageId);
                  clearAssist();
                  setDraft('');
                  return;
                }
                if (result?.messageId) {
                  setFeedback('Treffer im Verlauf – bitte nach oben scrollen');
                  setTimeout(() => setFeedback(''), 2800);
                  return;
                }
                setFeedback('Treffer im Verlauf – Filter „Nachrichten“ nutzen');
                setTimeout(() => setFeedback(''), 2800);
              }}
              onDismiss={handleDismissAssist}
            />
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
