import './CustomerAkte.css';

export default function CustomerAkteNextStep({
  hint,
  recommendation,
  telHref,
  onAction,
  onFallback,
  onUnterlagen,
}) {
  const data = recommendation ?? hint;
  if (!data?.title && !data?.text) return null;

  const title = data.title ?? 'Nächster Schritt';
  const explanation = data.text ?? data.explanation ?? '';
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
    <section className="cust-akte-nbs cust-akte-nbs--compact" aria-labelledby="cust-akte-nbs-title">
      <h2 id="cust-akte-nbs-title" className="cust-akte-nbs__label">Nächster guter Schritt</h2>
      <div className="cust-akte-nbs__card">
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
      </div>
    </section>
  );
}
