import './CustomerAkte.css';

export default function CustomerAkteNextStep({
  hint,
  telHref,
  onFallback,
  onUnterlagen,
}) {
  if (!hint?.text) return null;

  const isUnterlagen = hint.action === 'unterlagen';

  return (
    <section className="cust-akte-nbs cust-akte-nbs--hero" aria-labelledby="cust-akte-nbs-title">
      <h2 id="cust-akte-nbs-title" className="cust-akte-nbs__label">
        <span aria-hidden>🎯</span> Nächster guter Schritt
      </h2>
      <div className="cust-akte-nbs__card">
        <p className="cust-akte-nbs__text">{hint.text}</p>
        {isUnterlagen ? (
          <button type="button" className="cust-akte-nbs__cta" onClick={onUnterlagen}>
            {hint.cta}
          </button>
        ) : hint.canCall && telHref ? (
          <a href={telHref} className="cust-akte-nbs__cta">
            {hint.cta}
          </a>
        ) : (
          <button type="button" className="cust-akte-nbs__cta" onClick={onFallback}>
            {hint.cta}
          </button>
        )}
      </div>
    </section>
  );
}
