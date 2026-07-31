/**
 * CleverGlobalComposer – App-Shell Composer (Slice 1–2).
 * Orchestrierung nur über runCleverSellerTurn – keine zweite Pipeline.
 */
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import SharedWorkspaceChat from '../chat/SharedWorkspaceChat.jsx';
import SellerUniversalReviewCard from '../dealer-ai/SellerUniversalReviewCard.jsx';
import { useCleverComposerOptional } from '../../context/CleverComposerContext.jsx';
import { runCleverSellerTurn } from '../../services/cleverSeller/runCleverSellerTurn.js';
import {
  buildUniversalReviewModel,
  shouldShowUniversalReview,
} from '../../services/cleverSeller/buildUniversalReviewModel.js';
import { buildKundenaktePath } from '../../services/leadAkteEntry.js';
import './CleverGlobalComposer.css';

const SUGGESTION_CHIPS = [
  { id: 'today', label: 'Was liegt heute an?' },
  { id: 'open', label: 'Öffne Herrn Brandes.' },
  { id: 'summary', label: 'Was wollte Herr Brandes noch einmal?' },
  { id: 'tow', label: 'XCeed Anhängelast?' },
];

function buildAkteNavPath({ leadId, messageId = null, offerId = null }) {
  if (!leadId) return null;
  const base = buildKundenaktePath(leadId);
  const params = new URLSearchParams();
  if (messageId) params.set('messageId', messageId);
  if (offerId) params.set('offerId', offerId);
  const qs = params.toString();
  return qs ? `${base}?${qs}` : base;
}

export default function CleverGlobalComposer() {
  const ctx = useCleverComposerOptional();
  const navigate = useNavigate();
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [reviewModel, setReviewModel] = useState(null);
  const [lastTurn, setLastTurn] = useState(null);
  const [progressHint, setProgressHint] = useState(null);

  const visible = Boolean(ctx?.shouldShowGlobalComposer);

  const contextPills = useMemo(() => {
    if (!ctx) return [];
    return (ctx.attachedWorkingObjects || []).map((obj) => ({
      id: obj.id || obj.offerId || obj.label,
      label: obj.label || 'Arbeitsobjekt',
    }));
  }, [ctx]);

  if (!visible) return null;

  function handleSuggestion(chip) {
    if (!chip) return;
    if (chip.id === 'today') setDraft('Was liegt heute an?');
    else if (chip.id === 'tow') setDraft('XCeed Anhängelast?');
    else if (chip.id === 'open') setDraft('Öffne Herrn Brandes.');
    else if (chip.id === 'summary') setDraft('Was wollte Herr Brandes noch einmal?');
    else if (chip.label) setDraft(chip.label);
  }

  function handleOpenLead(leadId, extras = {}) {
    if (!leadId) return;
    // Einmaliger Working Context an Akte (keine Customer Truth)
    if (extras.hit && typeof ctx?.setAttachedWorkingObjects === 'function') {
      ctx.setAttachedWorkingObjects([{
        id: extras.hit.sourceId || extras.hit.messageId || extras.hit.offerId,
        label: extras.hit.title || 'Historien-Treffer',
        kind: extras.hit.sourceType || 'history_hit',
        messageId: extras.hit.messageId || null,
        offerId: extras.hit.offerId || null,
        oneShot: true,
      }]);
    }
    const path = buildAkteNavPath({
      leadId,
      messageId: extras.messageId || extras.hit?.messageId || null,
      offerId: extras.offerId || extras.hit?.offerId || null,
    });
    navigate(path);
  }

  function resolvePrimaryNavTarget(turn, model) {
    const sections = model?.actionSections || [];
    const summary = sections.find((s) => s.kind === 'customer_summary');
    if (summary?.summary?.customerId) {
      return { leadId: summary.summary.customerId };
    }
    const search = sections.find((s) => s.kind === 'customer_search_results');
    if (search?.results?.[0]?.leadId) {
      return { leadId: search.results[0].leadId };
    }
    const history = sections.find((s) => (
      s.kind === 'history_search_results' || s.kind === 'offer_history_result'
    ));
    if (history?.hit?.customerId) {
      return {
        leadId: history.hit.customerId,
        messageId: history.hit.messageId || null,
        offerId: history.hit.offerId || null,
        hit: history.hit,
      };
    }
    const today = turn?.todayOverview?.items?.[0];
    if (today?.leadId) return { leadId: today.leadId };
    return null;
  }

  function handleSend() {
    const text = String(draft || '').trim();
    if (!text || sending) return;
    setSending(true);
    setFeedback('');

    const lower = text.toLowerCase();
    if (/heute an|heute liegt|tages/.test(lower)) {
      setProgressHint('Clever prüft Ihre heutigen Vorgänge …');
    } else if (/anhängelast|reichweite|tank|wärmepumpe|kofferraum/.test(lower)) {
      setProgressHint('Clever sucht in den verifizierten Fahrzeugdaten …');
    } else if (/öffne|finde den kunden|finde den|suche/.test(lower)) {
      setProgressHint('Clever sucht in Ihren Kunden …');
    } else if (/was wollte|noch einmal|zusammenfassung/.test(lower)) {
      setProgressHint('Clever liest den Kundenkontext …');
    } else if (/geschrieben|angebot geschickt|historie|verlauf/.test(lower)) {
      setProgressHint('Clever durchsucht die Kundenhistorie …');
    } else {
      setProgressHint('Clever denkt mit …');
    }

    try {
      const turn = runCleverSellerTurn({
        lead: ctx.currentCustomer || {},
        sellerInput: text,
        leadsSnapshot: ctx.leadsSnapshot || [],
        scopeHint: 'dashboard',
        appContext: {
          routeContext: ctx.routeContext,
          attachedWorkingObjects: ctx.attachedWorkingObjects,
          dashboardContext: ctx.dashboardContext,
        },
        workingContextItems: ctx.attachedWorkingObjects || [],
        customerName: '',
      });
      setLastTurn(turn);
      const model = turn.reviewModel
        || (shouldShowUniversalReview(turn) ? buildUniversalReviewModel(turn) : null);
      setReviewModel(model);
      setDraft('');
      setProgressHint(null);
      if (model) {
        setFeedback(model.title || 'Clever hat vorbereitet');
      } else {
        setFeedback('Clever hat nichts Sicheres gefunden');
      }
      setTimeout(() => setFeedback(''), 2800);
    } catch {
      setProgressHint(null);
      setFeedback('Clever konnte das gerade nicht prüfen');
      setTimeout(() => setFeedback(''), 2800);
    } finally {
      setSending(false);
    }
  }

  const customerResults = lastTurn?.customerSearchResults || [];
  const historyResults = lastTurn?.historySearchResults || [];

  const reviewSlot = reviewModel
    ? (
      <div className="clever-global-composer__review">
        {Array.isArray(reviewModel.progressLines) && reviewModel.progressLines.length > 0 && (
          <ul className="clever-global-composer__progress" aria-label="Clever Fortschritt">
            {reviewModel.progressLines.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        )}
        <SellerUniversalReviewCard
          model={reviewModel}
          onAccept={() => {
            const target = resolvePrimaryNavTarget(lastTurn, reviewModel);
            if (target?.leadId) handleOpenLead(target.leadId, target);
          }}
          onReject={() => {
            setReviewModel(null);
            setLastTurn(null);
          }}
          onOpenHistoryHit={(hit) => {
            if (!hit) return;
            const leadId = hit.customerId || hit.leadId;
            if (!leadId) return;
            handleOpenLead(leadId, {
              messageId: hit.messageId || hit.id || null,
              offerId: hit.offerId || null,
              hit,
            });
          }}
        />
        {customerResults.length > 0 && (
          <div className="clever-global-composer__today-list">
            {customerResults.slice(0, 6).map((item) => (
              <button
                key={item.leadId || item.customerId}
                type="button"
                className="clever-global-composer__today-item"
                onClick={() => handleOpenLead(item.leadId || item.customerId)}
              >
                <strong>{item.customerName}</strong>
                <span>{item.vehicleLabel || item.card?.headline || item.matchReason}</span>
                {item.matchReasons?.[0] && (
                  <em>Grund: {item.matchReasons[0]}</em>
                )}
              </button>
            ))}
          </div>
        )}
        {historyResults.length > 0 && (
          <div className="clever-global-composer__today-list">
            {historyResults.slice(0, 4).map((hit) => (
              <button
                key={hit.sourceId || hit.messageId || hit.offerId}
                type="button"
                className="clever-global-composer__today-item"
                onClick={() => handleOpenLead(hit.customerId, {
                  messageId: hit.messageId,
                  offerId: hit.offerId,
                  hit,
                })}
              >
                <strong>{hit.whenLabel || hit.title}</strong>
                <span>{String(hit.matchedText || '').slice(0, 120)}</span>
                {hit.sourceLabel && <em>Quelle: {hit.sourceLabel}</em>}
              </button>
            ))}
          </div>
        )}
        {lastTurn?.todayOverview?.items?.length > 0 && (
          <div className="clever-global-composer__today-list">
            {lastTurn.todayOverview.items.slice(0, 6).map((item) => (
              <button
                key={item.leadId}
                type="button"
                className="clever-global-composer__today-item"
                onClick={() => handleOpenLead(item.leadId)}
              >
                <strong>{item.customerName}</strong>
                <span>{item.headline}</span>
                {item.reasons?.[0] && (
                  <em>Grund: {item.reasons[0]}</em>
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    )
    : null;

  return (
    <div className="clever-global-composer" data-testid="clever-global-composer">
      {progressHint && (
        <p className="clever-global-composer__hint" role="status">{progressHint}</p>
      )}
      <SharedWorkspaceChat
        role="seller"
        hideFeed
        items={[]}
        draft={draft}
        onDraftChange={setDraft}
        onSend={handleSend}
        sending={sending}
        sendFeedback={feedback}
        placeholder="Was möchten Sie wissen oder erledigen?"
        composerLabel="Clever"
        sendAriaLabel="An Clever senden"
        reviewSlot={reviewSlot}
        contextPills={contextPills}
        suggestionChips={SUGGESTION_CHIPS}
        onSuggestionChip={handleSuggestion}
        emptyHint=""
      />
    </div>
  );
}
