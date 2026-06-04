import { useNavigate } from 'react-router-dom';
import VehicleImage from '../shared/VehicleImage.jsx';
import './vehicle-detail-stream.css';

const MEDALS = ['🥇', '🥈', '🥉'];

export default function VehicleDetailAltSlider({ alternatives = [] }) {
  const navigate = useNavigate();
  if (!alternatives.length) return null;

  return (
    <section className="vd-stream-block vd-stream-alts" aria-labelledby="vd-stream-alts-title">
      <h2 id="vd-stream-alts-title" className="vd-stream-block__title">Weitere Alternativen</h2>
      <p className="vd-stream-block__sub">CleverQuote-Ranking – nur die besten Treffer</p>
      <div className="vd-stream-alts__track" role="list">
        {alternatives.map((alt, index) => (
          <article key={alt.slug} className="vd-stream-alt-card card" role="listitem">
            <span className="vd-stream-alt-card__rank" aria-hidden>{MEDALS[index] ?? `${index + 1}.`}</span>
            <div className="vd-stream-alt-card__image">
              <VehicleImage
                brand={alt.vehicle.brand}
                model={alt.vehicle.imageModel ?? alt.vehicle.model}
              />
            </div>
            <h3 className="vd-stream-alt-card__title">{alt.title}</h3>
            <p className="vd-stream-alt-card__meta">{alt.fulfillmentLabel}</p>
            <p className="vd-stream-alt-card__price">{alt.priceLabel}</p>
            <button
              type="button"
              className="vd-btn vd-btn--outline vd-btn--sm vd-btn--block"
              onClick={() => navigate(`${alt.path}?wunsch=1`)}
            >
              Ansehen
            </button>
          </article>
        ))}
      </div>
    </section>
  );
}
