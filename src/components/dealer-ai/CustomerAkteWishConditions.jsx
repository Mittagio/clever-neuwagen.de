import './CustomerAkte.css';

export default function CustomerAkteWishConditions({
  chips = [],
  onOpenWish,
}) {
  if (!chips.length) return null;

  return (
    <section className="cust-akte-wish" aria-labelledby="cust-akte-wish-title">
      <div className="cust-akte-wish__head">
        <h2 id="cust-akte-wish-title" className="cust-akte-wish__label">Wunschkonditionen</h2>
        {onOpenWish && (
          <button
            type="button"
            className="cust-akte-wish__edit"
            onClick={onOpenWish}
            aria-label="Wunschkonditionen bearbeiten"
          >
            ✎
          </button>
        )}
      </div>
      <button
        type="button"
        className="cust-akte-wish__card"
        onClick={onOpenWish}
        disabled={!onOpenWish}
      >
        <div className="cust-akte-wish__chips">
          {chips.map((chip) => (
            <span key={chip} className="cust-akte-wish__chip">{chip}</span>
          ))}
        </div>
      </button>
    </section>
  );
}
