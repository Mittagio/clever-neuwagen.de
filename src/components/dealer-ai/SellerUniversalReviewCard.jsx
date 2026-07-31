import { useMemo, useState } from 'react';
import {
  IconBranch,
  IconCopy,
  IconThumbDown,
  IconThumbUp,
} from './AkteIcons.jsx';
import './SellerUniversalReviewCard.css';

function pickPrimaryBody(model) {
  const sections = Array.isArray(model?.actionSections) ? model.actionSections : [];
  const knowledge = sections.find((s) => s.kind === 'knowledge_result');
  if (knowledge?.headline) {
    return [knowledge.title, knowledge.headline, knowledge.line].filter(Boolean).join('\n');
  }
  const today = sections.find((s) => s.kind === 'today_overview');
  if (today?.items?.length) {
    return today.items.slice(0, 4).map((item) => (
      [item.customerName, item.headline, item.reasons?.[0] ? `Grund: ${item.reasons[0]}` : null]
        .filter(Boolean)
        .join('\n')
    )).join('\n\n');
  }
  const draftSection = sections.find((s) => (
    (s.kind === 'message_draft'
      || s.kind === 'appointment_propose'
      || s.kind === 'golden_moment'
      || s.kind === 'history_search')
    && s.body
  ));
  if (draftSection?.body) return String(draftSection.body).trim();

  const lines = [];
  for (const section of sections) {
    if (section.headline) lines.push(section.headline);
    if (section.line) lines.push(section.line);
    if (section.inheritedLine) lines.push(section.inheritedLine);
    if (section.changes?.length) {
      for (const change of section.changes) {
        const value = change.from && change.to
          ? `${change.from} → ${change.to}`
          : (change.to || change.from);
        if (value) lines.push(`${change.label}: ${value}`);
      }
    }
  }
  if (lines.length) return lines.join('\n');

  const groups = Array.isArray(model?.groups) ? model.groups : [];
  if (groups.length) {
    return groups.map((g) => g.line).filter(Boolean).join('\n');
  }
  return model?.summaryLine || '';
}

function pickMetaLine(model) {
  const sections = Array.isArray(model?.actionSections) ? model.actionSections : [];
  const offer = sections.find((s) => (
    s.kind === 'offer_change' || s.kind === 'offer_prepare' || s.kind === 'track_feedback'
  ));
  if (offer?.headline) return offer.headline;
  if (offer?.line) return offer.line;
  if (model?.missingLine) return model.missingLine;
  return null;
}

/**
 * Cursor-artige Review: eine Antwort + schmale Icon-CTAs (Ja / Nein / Vielleicht / Kopieren).
 * Settled (`status`): letzte übernommene/gesendete Aktion ohne Accept-CTAs.
 */
export default function SellerUniversalReviewCard({
  model = null,
  onAccept = null,
  onAcceptAndRevise = null,
  onMaybe = null,
  onDismiss = null,
  onOpenHistoryHit = null,
  /** accepted | ready_to_send | sent – settled last-action mode */
  status = null,
  statusLabel = null,
  onOpenChat = null,
  /** Settled + ready_to_send: Nachricht jetzt senden */
  onSend = null,
}) {
  const [copied, setCopied] = useState(false);
  const sections = Array.isArray(model?.actionSections) ? model.actionSections : [];
  const groups = Array.isArray(model?.groups) ? model.groups : [];
  const body = useMemo(() => pickPrimaryBody(model), [model]);
  const metaLine = useMemo(() => pickMetaLine(model), [model]);
  const historyHit = sections.find((s) => s.kind === 'history_search' && s.hit)?.hit;
  const settled = Boolean(status);

  if (!model || (!groups.length && !sections.length && !body)) return null;

  const canMaybe = typeof onMaybe === 'function' || typeof onAcceptAndRevise === 'function';
  const resolvedStatusLabel = statusLabel
    || (status === 'ready_to_send'
      ? 'Bereit zum Senden'
      : status === 'sent'
        ? 'Gesendet'
        : status
          ? 'Übernommen'
          : null);

  async function handleCopy() {
    const text = body || model.summaryLine || '';
    if (!text) return;
    try {
      await navigator.clipboard?.writeText?.(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  }

  function handleMaybe() {
    if (typeof onMaybe === 'function') {
      onMaybe(model);
      return;
    }
    onAcceptAndRevise?.(model);
  }

  return (
    <article
      className={`sur-card sur-card--cursor${settled ? ' sur-card--settled' : ''}`}
      aria-live="polite"
    >
      <header className="sur-card__meta">
        <span className="sur-card__when">{settled ? 'zuletzt' : 'gerade eben'}</span>
        {model.title ? (
          <span className="sur-card__eyebrow">{model.title.replace(/^✨\s*/, '')}</span>
        ) : null}
        {resolvedStatusLabel ? (
          <span className="sur-card__status" data-status={status || 'accepted'}>
            {resolvedStatusLabel}
          </span>
        ) : null}
      </header>

      {metaLine ? (
        <p className="sur-card__context">{metaLine}</p>
      ) : null}

      {body ? (
        <pre className="sur-card__draft">{body}</pre>
      ) : (
        <p className="sur-card__summary">{model.summaryLine}</p>
      )}

      {historyHit && onOpenHistoryHit ? (
        <button
          type="button"
          className="sur-card__text-link"
          onClick={() => onOpenHistoryHit(historyHit)}
        >
          Im Verlauf öffnen
        </button>
      ) : null}

      {settled && onOpenChat ? (
        <button
          type="button"
          className="sur-card__text-link"
          onClick={() => onOpenChat()}
        >
          Im Chat ansehen
        </button>
      ) : null}

      {settled && status === 'ready_to_send' && typeof onSend === 'function' && body ? (
        <button
          type="button"
          className="sur-card__send"
          onClick={() => onSend(body)}
        >
          Jetzt senden
        </button>
      ) : null}

      <div className="sur-card__toolbar" role="group" aria-label="Clever Aktionen">
        {!settled ? (
          <>
            <button
              type="button"
              className="sur-card__icon-btn"
              onClick={() => onAccept?.(model)}
              title="Ja – übernehmen"
              aria-label="Ja – übernehmen"
            >
              <IconThumbUp />
            </button>
            <button
              type="button"
              className="sur-card__icon-btn"
              onClick={() => onDismiss?.(model)}
              title="Nein – verwerfen"
              aria-label="Nein – verwerfen"
            >
              <IconThumbDown />
            </button>
            {canMaybe ? (
              <button
                type="button"
                className="sur-card__icon-btn"
                onClick={handleMaybe}
                title="Vielleicht – im Composer weiterbearbeiten"
                aria-label="Vielleicht – im Composer weiterbearbeiten"
              >
                <IconBranch />
              </button>
            ) : null}
          </>
        ) : null}
        <button
          type="button"
          className="sur-card__icon-btn"
          onClick={handleCopy}
          title={copied ? 'Kopiert' : 'Kopieren'}
          aria-label={copied ? 'Kopiert' : 'Kopieren'}
        >
          <IconCopy />
        </button>
        {settled && onDismiss ? (
          <button
            type="button"
            className="sur-card__icon-btn sur-card__icon-btn--dismiss"
            onClick={() => onDismiss?.(model)}
            title="Ausblenden"
            aria-label="Ausblenden"
          >
            ×
          </button>
        ) : null}
        {copied ? <span className="sur-card__copied">Kopiert</span> : null}
      </div>
    </article>
  );
}
