/**
 * CleverGlobalComposer – App-Shell Composer (Slice 1: Dashboard).
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
  { id: 'tow', label: 'XCeed Anhängelast?' },
];

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
    else if (chip.label) setDraft(chip.label);
  }

  function handleOpenLead(leadId) {
    if (!leadId) return;
    navigate(buildKundenaktePath(leadId));
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
            const today = lastTurn?.todayOverview?.items?.[0];
            if (today?.leadId) handleOpenLead(today.leadId);
          }}
          onReject={() => {
            setReviewModel(null);
            setLastTurn(null);
          }}
        />
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
