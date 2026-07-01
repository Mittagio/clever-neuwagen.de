import { Link } from 'react-router-dom';
import {
  getInboxDisplayMessage,
  getInboxEventMeta,
  getInboxItemTopics,
  isInboxItemUrgent,
} from '../../services/crm/cleverInboxService.js';
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

function buildCustomerLine(item) {
  const parts = [item.customerName, item.vehicleLabel].filter(Boolean);
  return parts.join(' · ');
}

export default function CleverInboxCard({
  item,
  onAction,
  onMarkDone,
}) {
  const meta = getInboxEventMeta(item.type);
  const topics = getInboxItemTopics(item);
  const displayMessage = getInboxDisplayMessage(item);
  const primaryLabel = item.actionLabel ?? meta.actionLabel;
  const customerLine = buildCustomerLine(item);
  const urgent = isInboxItemUrgent(item);
  const isDemo = item.metadata?.demo === true;
  const kundenakteUrl = item.leadId && !isDemo
    ? buildInboxKundenakteUrl(item.leadId, item)
    : null;

  return (
    <article className={`clever-inbox-card${urgent ? ' clever-inbox-card--urgent' : ''}`}>
      <div className="clever-inbox-card__head">
        <div className="clever-inbox-card__badges">
          <span className={`clever-inbox-card__badge clever-inbox-card__badge--${item.type}`}>
            <span aria-hidden>{meta.icon}</span>
            {' '}
            {meta.badge}
          </span>
          {urgent && (
            <span className="clever-inbox-card__badge clever-inbox-card__badge--urgent">
              Dringend
            </span>
          )}
        </div>
        <time className="clever-inbox-card__time" dateTime={item.createdAt}>
          {formatWhen(item.createdAt)}
        </time>
      </div>

      <h3 className="clever-inbox-card__title">{item.title}</h3>

      {customerLine && (
        <p className="clever-inbox-card__customer">{customerLine}</p>
      )}

      {displayMessage && (
        <p className="clever-inbox-card__message">{displayMessage}</p>
      )}

      {topics.length > 0 && (
        <div className="clever-inbox-card__chips" aria-label="Themen">
          {topics.map((topic) => (
            <span key={topic} className="clever-inbox-card__chip">{topic}</span>
          ))}
        </div>
      )}

      <div className="clever-inbox-card__actions">
        <button
          type="button"
          className="clever-inbox-card__cta"
          onClick={() => onAction?.(item)}
          disabled={isDemo}
        >
          {primaryLabel}
        </button>
        {kundenakteUrl && (
          <Link to={kundenakteUrl} className="clever-inbox-card__secondary">
            Kundenakte
          </Link>
        )}
        {item.status === 'open' && !isDemo && (
          <button
            type="button"
            className="clever-inbox-card__secondary"
            onClick={() => onMarkDone?.(item)}
          >
            Erledigt
          </button>
        )}
      </div>
    </article>
  );
}
