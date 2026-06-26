import { Link } from 'react-router-dom';
import { buildKundenaktePath } from '../../services/leadAkteEntry.js';
import { getInboxEventMeta } from '../../services/crm/cleverInboxService.js';
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
  item,
  onAction,
  onMarkDone,
}) {
  const meta = getInboxEventMeta(item.type);
  const customerLine = [item.customerName, item.vehicleLabel].filter(Boolean).join(' · ');

  return (
    <article className="clever-inbox-card">
      <div className="clever-inbox-card__head">
        <span className="clever-inbox-card__badge">
          <span aria-hidden>{meta.icon}</span>
          {' '}
          {meta.badge}
        </span>
        <time className="clever-inbox-card__time" dateTime={item.createdAt}>
          {formatWhen(item.createdAt)}
        </time>
      </div>

      <h3 className="clever-inbox-card__title">{item.title}</h3>
      {customerLine && <p className="clever-inbox-card__customer">{customerLine}</p>}
      {item.message && <p className="clever-inbox-card__message">{item.message}</p>}

      <div className="clever-inbox-card__actions">
        <button
          type="button"
          className="clever-inbox-card__cta"
          onClick={() => onAction?.(item)}
        >
          {item.actionLabel ?? meta.actionLabel}
        </button>
        {item.leadId && (
          <Link to={buildKundenaktePath(item.leadId)} className="clever-inbox-card__link">
            Kundenakte
          </Link>
        )}
        {item.status === 'open' && (
          <button
            type="button"
            className="clever-inbox-card__ghost"
            onClick={() => onMarkDone?.(item)}
          >
            Erledigt
          </button>
        )}
      </div>
    </article>
  );
}
