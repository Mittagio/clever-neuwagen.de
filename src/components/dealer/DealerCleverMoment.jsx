import { DEALER_TRUST_TILES } from '../../data/dealerLandingContent.js';
import './dealer-landing.css';

export default function DealerCleverMoment() {
  return (
    <section className="dl-trust" aria-label="Warum Autohaus Trinkle">
      <ul className="dl-trust__grid">
        {DEALER_TRUST_TILES.map((tile) => (
          <li key={tile.id} className="dl-trust__tile">
            <span className="dl-trust__icon" aria-hidden>{tile.icon}</span>
            <div className="dl-trust__body">
              <strong className="dl-trust__title">{tile.title}</strong>
              <span className="dl-trust__text">{tile.text}</span>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
