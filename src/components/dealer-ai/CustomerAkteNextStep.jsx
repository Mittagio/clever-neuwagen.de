import { useState } from 'react';
import './CustomerAkte.css';

export default function CustomerAkteNextStep({
  hint,
  recommendation,
  telHref,
  whatsappHref,
  mailHref,
  onAction,
  onFallback,
  onUnterlagen,
}) {
  const data = recommendation ?? hint;
  if (!data?.title && !data?.text) return null;

  const [showWhy, setShowWhy] = useState(false);
  const title = data.title ?? 'Nächster Schritt';
  const explanation = data.text ?? data.explanation ?? '';
  const reason = data.whyClever ?? data.reason ?? '';
  const cta = data.cta ?? data.ctaLabel ?? 'Weiter';
  const handlerType = data.handlerType ?? data.action;
  const isCall = handlerType === 'call' && data.canCall !== false && telHref;
  const isUnterlagen = handlerType === 'documents'
    || handlerType === 'leasing_submit'
    || data.action === 'unterlagen';

  function handleClick() {
    if (onAction) {
      onAction(data);
      return;
    }
    if (isUnterlagen) {
      onUnterlagen?.();
      return;
    }
    onFallback?.();
  }

  return (
    <section className="cust-akte-nbs cust-akte-nbs--hero" aria-labelledby="cust-akte-nbs-title">
      <h2 id="cust-akte-nbs-title" className="cust-akte-nbs__label">
        <span aria-hidden>🎯</span> Nächster guter Schritt
      </h2>
      <div className="cust-akte-nbs__card cust-akte-nbs__card--primary">
        <p className="cust-akte-nbs__headline">{title}</p>
        {explanation && <p className="cust-akte-nbs__text">{explanation}</p>}
        {isCall ? (
          <a href={telHref} className="cust-akte-nbs__cta" onClick={() => onAction?.(data)}>
            {cta}
          </a>
        ) : (
          <button type="button" className="cust-akte-nbs__cta" onClick={handleClick}>
            {cta}
          </button>
        )}
        {(whatsappHref || mailHref) && handlerType === 'offer_send' && (
          <div className="cust-akte-nbs__secondary-actions">
            {whatsappHref && (
              <a href={whatsappHref} className="cust-akte-nbs__secondary" target="_blank" rel="noopener noreferrer">
                WhatsApp
              </a>
            )}
            {mailHref && (
              <a href={mailHref} className="cust-akte-nbs__secondary" onClick={() => onAction?.(data)}>
                E-Mail
              </a>
            )}
          </div>
        )}
        {reason && (
          <div className="cust-akte-nbs__why">
            <button
              type="button"
              className="cust-akte-nbs__why-toggle"
              onClick={() => setShowWhy((v) => !v)}
              aria-expanded={showWhy}
            >
              Warum empfiehlt Clever das?
            </button>
            {showWhy && <p className="cust-akte-nbs__why-text">{reason}</p>}
          </div>
        )}
      </div>
    </section>
  );
}
