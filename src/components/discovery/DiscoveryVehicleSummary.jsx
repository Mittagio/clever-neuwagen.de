import { formatCurrency } from '../../logic/marketplaceService.js';
import './discovery-results.css';

const COLOR_LABELS = { white: 'Weiß', gray: 'Grau', black: 'Schwarz' };
const MOTOR_LABELS = {
  verbrenner: 'Benziner',
  hybrid: 'Hybrid',
  'plugin-hybrid': 'Plug-in',
};

export default function DiscoveryVehicleSummary({
  match,
  customize = {},
}) {
  if (!match) return null;

  const v = match.vehicle;
  const title = `${match.bestTrim ?? ''}`.trim() || v.model;
  const modelLine = match.model;
  const color = COLOR_LABELS[customize.colorId] ?? 'Weiß';
  const motor = MOTOR_LABELS[customize.motorId] ?? MOTOR_LABELS[v.powertrain] ?? 'Benziner';
  const packages = customize.packages?.length
    ? customize.packages.map((id) => {
        const map = { winter: 'Winterpaket', towbar: 'Anhängerkupplung', panorama: 'Panoramadach', assist: 'Assistenzpaket' };
        return map[id];
      }).filter(Boolean)
    : [];

  return (
    <aside className="disc-summary" aria-label="Ihr Fahrzeug">
      <div className="disc-summary__inner card">
        <h2 className="disc-summary__title">Ihr Fahrzeug</h2>
        <p className="disc-summary__model">{modelLine}</p>
        <p className="disc-summary__trim">{title}</p>
        <dl className="disc-summary__list">
          <div><dt>Motor</dt><dd>{motor}</dd></div>
          <div><dt>Farbe</dt><dd>{color}</dd></div>
          {packages.map((p) => (
            <div key={p}><dt>Paket</dt><dd>{p}</dd></div>
          ))}
          <div className="disc-summary__rate">
            <dt>Rate</dt>
            <dd>{formatCurrency(match.bestOffer.monthlyRate)}/Monat</dd>
          </div>
          <div><dt>Lieferzeit</dt><dd>{match.bestOffer.deliveryTime ?? v.deliveryTime}</dd></div>
        </dl>
        <p className="disc-summary__note">Wird später live mit Ihrer Konfiguration aktualisiert.</p>
      </div>
    </aside>
  );
}
