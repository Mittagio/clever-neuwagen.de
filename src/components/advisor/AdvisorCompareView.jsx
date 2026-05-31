import { Link } from 'react-router-dom';
import { formatPrice } from '../../data/kiaSportage.js';
import { formatAdvisorRate, buildAdvisorWhatsAppMessage } from '../../services/advisorEngine.js';
import LegalDisclaimer from '../legal/LegalDisclaimer.jsx';
import AdvisorVehicleImage from './AdvisorVehicleImage.jsx';
import './AdvisorComponents.css';

function operatingCostLabel(level) {
  if (level <= 1) return 'Sehr niedrig';
  if (level <= 2) return 'Niedrig';
  return 'Mittel';
}

export default function AdvisorCompareView({
  items,
  dealerId,
  dealerName,
  dealerPhone,
  onBack,
  onRemove,
  onSelectForOffer,
}) {
  if (!items.length) return null;

  return (
    <section className="adv-compare-view">
      <header className="adv-compare-view__head">
        <button type="button" className="adv-compare-view__back" onClick={onBack}>
          ← Zurück
        </button>
        <h2>Fahrzeugvergleich</h2>
        <p>{items.length} Modelle nebeneinander</p>
      </header>

      <div className="adv-compare-view__scroll">
        {items.map((item) => (
          <article key={item.id} className="adv-compare-view__card">
            <button
              type="button"
              className="adv-compare-view__remove"
              onClick={() => onRemove(item.id)}
              aria-label="Aus Vergleich entfernen"
            >
              ✕
            </button>

            <span className="adv-compare-view__medal">{item.rankMedal}</span>

            <AdvisorVehicleImage
              rec={item}
              dealerId={dealerId}
              className="adv-vehicle-visual adv-vehicle-visual--compare"
              imageClassName="adv-vehicle-visual__img"
            />

            <h3 className="adv-compare-view__name">{item.fullLabel}</h3>
            <p className="adv-compare-view__fuel">{item.engineName} · {item.fuelLabel}</p>

            <p className="adv-compare-view__rate">
              {formatAdvisorRate(item.monthlyRate)}
              <span>/Monat</span>
            </p>

            {item.isHotDeal && (
              <span className="adv-compare-view__hot">🔥 Besonders gutes Angebot</span>
            )}

            <dl className="adv-compare-view__facts">
              <div>
                <dt>Lieferzeit</dt>
                <dd>{item.deliveryTime}</dd>
              </div>
              <div>
                <dt>Verfügbarkeit</dt>
                <dd>{item.availabilityLabel}</dd>
              </div>
              {item.rangeKm && (
                <div>
                  <dt>Reichweite</dt>
                  <dd>{item.rangeKm} km WLTP</dd>
                </div>
              )}
              <div>
                <dt>Betriebskosten</dt>
                <dd>{operatingCostLabel(item.operatingCostLevel)}</dd>
              </div>
              {item.hauspreis > 0 && (
                <div>
                  <dt>Hauspreis</dt>
                  <dd>{formatPrice(item.hauspreis)}</dd>
                </div>
              )}
            </dl>

            <div className="adv-compare-view__equipment">
              <p className="adv-compare-view__equipment-title">Ausstattung</p>
              <ul>
                {item.highlights.slice(0, 4).map((h) => (
                  <li key={h}>{h}</li>
                ))}
              </ul>
            </div>

            <ul className="adv-compare-view__reasons">
              {item.reasonBullets.slice(0, 3).map((b) => (
                <li key={b}>✓ {b}</li>
              ))}
            </ul>

            <div className="adv-compare-view__actions">
              <button
                type="button"
                className="adv-btn adv-btn--primary"
                onClick={() => onSelectForOffer(item)}
              >
                📋 Dieses Fahrzeug als Angebot
              </button>
              <button
                type="button"
                className="adv-btn adv-btn--wa"
                onClick={() => {
                  const msg = buildAdvisorWhatsAppMessage(item, dealerName);
                  const digits = dealerPhone?.replace(/\D/g, '') ?? '';
                  const url = digits
                    ? `https://wa.me/${digits}?text=${encodeURIComponent(msg)}`
                    : `https://wa.me/?text=${encodeURIComponent(msg)}`;
                  window.open(url, '_blank', 'noopener,noreferrer');
                }}
              >
                📱 WhatsApp
              </button>
              <Link to="/haendler/autohaus-trinkle" className="adv-btn adv-btn--ghost">
                📋 Konfiguration
              </Link>
            </div>
          </article>
        ))}
      </div>
      <LegalDisclaimer compact className="adv-compare-view__disclaimer" />
    </section>
  );
}
