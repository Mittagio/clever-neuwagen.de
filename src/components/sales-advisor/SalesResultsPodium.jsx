import VehicleImage from '../shared/VehicleImage.jsx';
import CleverQuoteBadge from '../cleverQuote/CleverQuoteBadge.jsx';
import { formatCurrency } from '../../logic/marketplaceService.js';
import { getFulfilledLabels } from '../../services/sales/salesAdvisorService.js';

const MEDALS = ['🥇', '🥈', '🥉'];

function formatDelivery(match) {
  const t = match?.bestOffer?.deliveryTime ?? match?.vehicle?.deliveryTime ?? '';
  if (!t) return null;
  if (/sofort/i.test(t) || match?.vehicle?.availability === 'sofort') return 'Sofort verfügbar';
  return t.replace(/^Lieferzeit\s*/i, '').trim() || t;
}

export default function SalesResultsPodium({
  matches = [],
  customerName = '',
  onSelect,
  onToggleCompare,
  onOpenCompare,
  onShowCustomer,
  compareSlugs = [],
}) {
  if (!matches.length) {
    return (
      <div className="ss-empty">
        <p>Keine passenden Fahrzeuge gefunden. Bitte Wünsche anpassen.</p>
      </div>
    );
  }

  return (
    <div className="ss-results">
      <header className="ss-results__head">
        <h1>Beste Fahrzeuge{customerName ? ` für ${customerName}` : ' für Ihren Kunden'}</h1>
        <p>Sortiert nach CleverQuote™ – Passung vor Preis und Händler</p>
      </header>

      <div className="ss-podium">
        {matches.map((match, index) => {
          const v = match.vehicle;
          const title = match.model ?? `${v.brand} ${v.model}`;
          const rate = match.bestOffer?.monthlyRate ?? v.monthlyRate;
          const fulfilled = getFulfilledLabels(match).slice(0, 5);
          const delivery = formatDelivery(match);
          const inCompare = compareSlugs.includes(match.slug);

          return (
            <article key={match.slug} className={`ss-podium-card ss-podium-card--rank-${index + 1}`}>
              <div className="ss-podium-card__rank">{MEDALS[index] ?? `${index + 1}.`}</div>
              <VehicleImage
                brand={v.brand}
                model={v.imageModel ?? v.model}
                className="ss-podium-card__image"
              />
              <div className="ss-podium-card__body">
                <h2>{title}</h2>
                {match.cleverQuote && (
                  <CleverQuoteBadge cleverQuote={match.cleverQuote} size="md" showTier />
                )}
                <p className="ss-podium-card__rate">{formatCurrency(rate)}<span>/Monat</span></p>
                {delivery && <p className="ss-podium-card__delivery">{delivery}</p>}
                {fulfilled.length > 0 && (
                  <ul className="ss-podium-card__fulfilled">
                    {fulfilled.map((label) => (
                      <li key={label}><span aria-hidden>✓</span> {label}</li>
                    ))}
                  </ul>
                )}
                <div className="ss-podium-card__actions">
                  <button type="button" className="ss-btn ss-btn--primary" onClick={() => onSelect(match)}>
                    Details & Angebot
                  </button>
                  <button
                    type="button"
                    className={`ss-btn ss-btn--ghost${inCompare ? ' ss-btn--active' : ''}`}
                    onClick={() => onToggleCompare(match.slug)}
                  >
                    {inCompare ? 'Im Vergleich' : 'Zum Vergleich hinzufügen'}
                  </button>
                  {onShowCustomer && (
                    <button type="button" className="ss-btn ss-btn--ghost" onClick={() => onShowCustomer(match)}>
                      Kunde zeigen
                    </button>
                  )}
                </div>
              </div>
            </article>
          );
        })}
      </div>

      {compareSlugs.length >= 2 && (
        <div className="ss-results__compare-bar">
          <button type="button" className="ss-btn ss-btn--secondary ss-btn--block" onClick={onOpenCompare}>
            Schnellvergleich ({compareSlugs.length} Fahrzeuge)
          </button>
        </div>
      )}
    </div>
  );
}
