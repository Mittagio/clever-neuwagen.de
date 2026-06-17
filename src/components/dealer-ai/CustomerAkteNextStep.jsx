import './CustomerAkte.css';

export default function CustomerAkteNextStep({
  hint,
  telHref,
  onFallback,
  onUnterlagen,
  onCleverAntwort,
}) {
  if (!hint?.text) return null;

  const isUnterlagen = hint.action === 'unterlagen';

  return (
    <section className="cust-akte-nbs" aria-labelledby="cust-akte-nbs-title">
      <h2 id="cust-akte-nbs-title" className="visually-hidden">Nächster guter Schritt</h2>
      <div className="cust-akte-nbs__box">
        <span className="cust-akte-nbs__star" aria-hidden>★</span>
        <p className="cust-akte-nbs__text">{hint.text}</p>
      </div>
      {isUnterlagen ? (
        <button type="button" className="cust-akte-nbs__cta" onClick={onUnterlagen}>
          {hint.cta}
        </button>
      ) : hint.canCall && telHref ? (
        <a href={telHref} className="cust-akte-nbs__cta">
          <span aria-hidden>📞</span>
          {hint.cta}
        </a>
      ) : (
        <button type="button" className="cust-akte-nbs__cta" onClick={onFallback}>
          {hint.cta}
        </button>
      )}
      {onCleverAntwort && (
        <button
          type="button"
          className="cust-akte-nbs__cta cust-akte-nbs__cta--secondary"
          onClick={onCleverAntwort}
        >
          Clever Antwort erstellen
        </button>
      )}
    </section>
  );
}
