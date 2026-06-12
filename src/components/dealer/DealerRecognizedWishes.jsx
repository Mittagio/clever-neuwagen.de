import './dealer-landing.css';

/**
 * Erkannte Wünsche unter dem Suchfeld – „Clever hat mich verstanden“.
 */
export default function DealerRecognizedWishes({ wishes = [], compact = false }) {
  if (!wishes.length) return null;

  return (
    <aside
      className={`dl-recognized-wishes${compact ? ' dl-recognized-wishes--compact' : ''}`}
      aria-label="Erkannte Wünsche"
    >
      <p className="dl-recognized-wishes__label">Erkannte Wünsche</p>
      <ul className="dl-recognized-wishes__list">
        {wishes.map((wish) => (
          <li key={wish.id} className="dl-recognized-wishes__item">
            <span className="dl-recognized-wishes__check" aria-hidden>✓</span>
            {wish.label}
          </li>
        ))}
      </ul>
    </aside>
  );
}
