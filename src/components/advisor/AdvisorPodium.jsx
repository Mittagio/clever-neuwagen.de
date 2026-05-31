import { formatAdvisorRate } from '../../services/advisorEngine.js';
import LegalDisclaimer from '../legal/LegalDisclaimer.jsx';
import AdvisorVehicleImage from './AdvisorVehicleImage.jsx';
import './AdvisorComponents.css';

export default function AdvisorPodium({ items, dealerId, activeId, onSelect, onCompareAll }) {
  if (!items?.length) return null;

  const podium = items.slice(0, 3);

  return (
    <section className="adv-podium" aria-label="Top 3 Empfehlungen">
      <div className="adv-podium__head">
        <h2 className="adv-podium__title">Ihre Top {podium.length}</h2>
        <button type="button" className="adv-podium__compare-btn" onClick={onCompareAll}>
          Vergleich starten
        </button>
      </div>
      <div className="adv-podium__scroll">
        {podium.map((item) => (
          <button
            key={item.id}
            type="button"
            className={`adv-podium-card${activeId === item.id ? ' is-active' : ''}`}
            onClick={() => onSelect(item.id)}
          >
            <span className="adv-podium-card__medal">{item.rankMedal}</span>
            <AdvisorVehicleImage
              rec={item}
              dealerId={dealerId}
              className="adv-vehicle-visual adv-vehicle-visual--podium"
              imageClassName="adv-vehicle-visual__img"
            />
            <p className="adv-podium-card__name">{item.label}</p>
            <p className="adv-podium-card__rate">{formatAdvisorRate(item.monthlyRate)}</p>
            <p className="adv-podium-card__meta">{item.deliveryTime}</p>
            {item.isHotDeal && (
              <span className="adv-podium-card__hot">🔥 Top-Angebot</span>
            )}
          </button>
        ))}
      </div>
      <LegalDisclaimer compact className="adv-podium__disclaimer" />
    </section>
  );
}
