import { buildSalesCompareRows } from '../../services/sales/salesAdvisorService.js';
import { formatCurrency } from '../../logic/marketplaceService.js';

export default function SalesQuickCompare({ matches = [] }) {
  const rows = buildSalesCompareRows(matches);

  if (rows.length < 2) return null;

  return (
    <div className="ss-compare">
      <header className="ss-compare__head">
        <h1>Schnellvergleich</h1>
        <p>Welches Fahrzeug erfüllt Ihre Wünsche am besten?</p>
      </header>
      <div className="ss-compare-grid">
        {rows.map((row) => (
          <article key={row.slug} className="ss-compare-card">
            <h2>{row.title}</h2>
            <p className="ss-compare-card__quote">
              CleverQuote {row.cleverQuote?.percent ?? '—'} %
            </p>
            <p className="ss-compare-card__rate">{formatCurrency(row.monthlyRate)}/Monat</p>
            <dl className="ss-compare-card__facts">
              <div><dt>Reichweite</dt><dd>{row.rangeKm}{typeof row.rangeKm === 'number' ? ' km' : ''}</dd></div>
              <div><dt>Kofferraum</dt><dd>{row.trunkLiters}{typeof row.trunkLiters === 'number' ? ' l' : ''}</dd></div>
              <div><dt>Anhängelast</dt><dd>{row.towCapacityKg}{typeof row.towCapacityKg === 'number' ? ' kg' : ''}</dd></div>
              <div><dt>Lieferzeit</dt><dd>{row.deliveryTime}</dd></div>
            </dl>
          </article>
        ))}
      </div>
    </div>
  );
}
