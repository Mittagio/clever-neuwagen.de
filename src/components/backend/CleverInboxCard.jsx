import { Link } from 'react-router-dom';
import { buildInboxKundenakteUrl } from '../../services/crm/cleverInboxQuestionRoute.js';
import './CleverInbox.css';

function formatWhen(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  const time = d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
  if (sameDay) return `Heute ${time}`;
  return `${d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })} ${time}`;
}

export default function CleverInboxCard({
  workCard,
  onAction,
  onMarkDone,
}) {
  const item = workCard.primaryItem;
  const isDemo = item.metadata?.demo === true;
  const kundenakteUrl = item.leadId && !isDemo
    ? buildInboxKundenakteUrl(item.leadId, item)
    : null;

  const warmthClass = workCard.warmth
    ? ` clever-inbox-card--${workCard.warmth}`
    : '';

  return (
    <article
      id={`inbox-work-card-${workCard.id}`}
      className={`clever-inbox-card${warmthClass}`}
    >
      <div className="clever-inbox-card__head">
        <div className="clever-inbox-card__badges">
          {workCard.warmthLabel && (
            <span className={`clever-inbox-card__warmth clever-inbox-card__warmth--${workCard.warmth}`}>
              {workCard.warmthLabel}
            </span>
          )}
        </div>
        <time className="clever-inbox-card__time" dateTime={workCard.createdAt}>
          {formatWhen(workCard.createdAt)}
        </time>
      </div>

      <h3 className="clever-inbox-card__customer-title">{workCard.customerTitle}</h3>

      {workCard.offerContext.conditionsLine && (
        <p className="clever-inbox-card__offer-line">{workCard.offerContext.conditionsLine}</p>
      )}

      {workCard.offerContext.rateLine && (
        <p className="clever-inbox-card__rate-line">{workCard.offerContext.rateLine}</p>
      )}

      <p className="clever-inbox-card__concern">{workCard.mainConcern}</p>

      {workCard.signals.length > 0 && (
        <p className="clever-inbox-card__signals">
          <span className="clever-inbox-card__signals-label">Signale:</span>
          {' '}
          {workCard.signals.join(' · ')}
        </p>
      )}

      <div className="clever-inbox-card__next-step">
        <span className="clever-inbox-card__next-step-label">Nächster Schritt:</span>
        {' '}
        <span className="clever-inbox-card__next-step-value">{workCard.nextStepLabel}</span>
      </div>

      <div className="clever-inbox-card__actions">
        <button
          type="button"
          className="clever-inbox-card__cta"
          onClick={() => onAction?.(item)}
          disabled={isDemo}
        >
          {workCard.actionLabel}
        </button>
        {kundenakteUrl && (
          <Link to={kundenakteUrl} className="clever-inbox-card__secondary">
            Kundenakte
          </Link>
        )}
        {item.status === 'open' && !isDemo && (
          <button
            type="button"
            className="clever-inbox-card__secondary clever-inbox-card__secondary--ghost"
            onClick={() => onMarkDone?.(workCard)}
          >
            Erledigt
          </button>
        )}
      </div>
    </article>
  );
}
