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
  if (!data?.title && !data?.text && !data?.cta && !data?.ctaLabel) return null;

  const explanation = data.text ?? data.explanation ?? '';
  const reason = data.whyClever ?? data.reason ?? '';
  const cta = data.cta ?? data.ctaLabel ?? data.title ?? 'Weiter';
  const handlerType = data.handlerType ?? data.action;
  const isCall = handlerType === 'call' && data.canCall !== false && telHref;
  const isUnterlagen = handlerType === 'documents'
    || handlerType === 'leasing_submit'
    || data.action === 'unterlagen';

  const note = explanation || reason;
  const showNote = Boolean(note)
    && note !== cta
    && note !== data.title
    && (isUnterlagen || !/unterlagen fehlen/i.test(note));

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
    <section className="cust-akte-nbs cust-akte-nbs--dominant" aria-labelledby="cust-akte-nbs-title">
      <p id="cust-akte-nbs-title" className="cust-akte-nbs__eyebrow">Nächster guter Schritt</p>
      {isCall ? (
        <a
          href={telHref}
          className="cust-akte-nbs__cta cust-akte-nbs__cta--dominant"
          onClick={() => onAction?.(data)}
        >
          {cta}
        </a>
      ) : (
        <button
          type="button"
          className="cust-akte-nbs__cta cust-akte-nbs__cta--dominant"
          onClick={handleClick}
        >
          {cta}
        </button>
      )}
      {showNote && (
        <p className="cust-akte-nbs__note cust-akte-nbs__note--subtle">{note}</p>
      )}
    </section>
  );
}
