import {
  partitionCleverQuoteItems,
  CLEVER_QUOTE_UNCERTAIN_LABEL,
} from '../../services/cleverQuote/cleverQuoteService.js';

function WishGroup({ title, items, icon, className }) {
  if (!items?.length) return null;
  return (
    <div className={`cq-why-group ${className ?? ''}`}>
      <p className="cq-why-group__title">{title}</p>
      <ul className="cq-why-group__list">
        {items.map((item) => (
          <li key={item.id}>
            <span className="cq-why-group__icon" aria-hidden>{icon}</span>
            {item.label}
            {item.status === 'package' && (
              <span className="cq-why-group__hint"> · Paket nötig</span>
            )}
            {item.via === 'package' && item.status === 'fulfilled' && (
              <span className="cq-why-group__hint"> · im Paket</span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Inline „Warum X %?“ – Regel 2 Sprint 34 */
export default function CleverQuoteWhyPanel({ cleverQuote, compact = false }) {
  if (!cleverQuote?.items?.length) return null;

  const { fulfilled, packageNeeded, missing, uncertain } = partitionCleverQuoteItems(cleverQuote);

  return (
    <div className={`cq-why-panel${compact ? ' cq-why-panel--compact' : ''}`}>
      <p className="cq-why-panel__heading">
        {cleverQuote.percent != null
          ? `Warum ${cleverQuote.percent} %?`
          : 'Warum diese Einschätzung?'}
      </p>
      {cleverQuote.trustNote && (
        <p className="cq-why-panel__trust">{cleverQuote.trustNote}</p>
      )}
      <WishGroup title="Erfüllt" items={fulfilled} icon="✓" className="cq-why-group--ok" />
      <WishGroup title="Mit Paket möglich" items={packageNeeded} icon="○" className="cq-why-group--pkg" />
      <WishGroup title="Nicht erfüllt" items={missing} icon="✗" className="cq-why-group--no" />
      <WishGroup
        title={CLEVER_QUOTE_UNCERTAIN_LABEL}
        items={uncertain}
        icon="?"
        className="cq-why-group--uncertain"
      />
    </div>
  );
}

export function RecommendReasonsPanel({ reasons = [], title = 'Warum passt dieses Fahrzeug?' }) {
  if (!reasons.length) return null;
  return (
    <div className="cq-recommend-panel">
      <p className="cq-recommend-panel__title">{title}</p>
      <ul className="cq-recommend-panel__list">
        {reasons.map((reason) => (
          <li key={reason}><span aria-hidden>✅</span> {reason}</li>
        ))}
      </ul>
    </div>
  );
}
