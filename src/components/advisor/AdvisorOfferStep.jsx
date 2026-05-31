import { formatPrice } from '../../data/kiaSportage.js';
import { formatAdvisorRate } from '../../services/advisorEngine.js';
import AdvisorVehicleImage from './AdvisorVehicleImage.jsx';
import './AdvisorComponents.css';

export default function AdvisorOfferStep({
  rec,
  dealerId,
  dealerName,
  termMonths,
  mileagePerYear,
  onBack,
  onContinue,
}) {
  if (!rec) return null;

  return (
    <section className="adv-offer-step">
      <header className="adv-offer-step__head">
        <button type="button" className="adv-compare-view__back" onClick={onBack}>
          ← Zurück zum Vergleich
        </button>
        <h2>Ihr persönliches Angebot</h2>
        <p>Für {dealerName} · {termMonths} Monate · {mileagePerYear.toLocaleString('de-DE')} km/Jahr</p>
      </header>

      <article className="adv-offer-step__card">
        <AdvisorVehicleImage
          rec={rec}
          dealerId={dealerId}
          className="adv-vehicle-visual adv-vehicle-visual--offer"
          imageClassName="adv-vehicle-visual__img"
        />
        <span className="adv-offer-step__medal">{rec.rankMedal}</span>
        <h3>{rec.fullLabel}</h3>
        <p className="adv-offer-step__engine">{rec.engineName} · {rec.fuelLabel}</p>

        <p className="adv-offer-step__rate">
          {formatAdvisorRate(rec.monthlyRate)}
          <span>/Monat Leasing</span>
        </p>

        {rec.isHotDeal && (
          <span className="adv-compare-view__hot">🔥 Besonders gutes Angebot</span>
        )}

        <dl className="adv-compare-view__facts">
          <div>
            <dt>Lieferzeit</dt>
            <dd>{rec.deliveryTime}</dd>
          </div>
          <div>
            <dt>Verfügbarkeit</dt>
            <dd>{rec.availabilityLabel}</dd>
          </div>
          {rec.hauspreis > 0 && (
            <div>
              <dt>Hauspreis</dt>
              <dd>{formatPrice(rec.hauspreis)}</dd>
            </div>
          )}
        </dl>

        <ul className="adv-compare-view__reasons">
          {rec.reasonBullets.slice(0, 3).map((b) => (
            <li key={b}>✓ {b}</li>
          ))}
        </ul>
      </article>

      <p className="adv-offer-step__hint">
        Im nächsten Schritt geben Sie einmalig Ihre Kontaktdaten an. Das Angebot wird automatisch erstellt und in Ihrem Kundenkonto gespeichert.
      </p>

      <button type="button" className="adv-btn adv-btn--primary adv-offer-step__cta" onClick={onContinue}>
        Weiter zu Kontakt
      </button>
    </section>
  );
}
