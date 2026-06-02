import { formatCurrency } from '../../logic/marketplaceService.js';
import { getFeatureLabel } from '../../data/features/featureCatalog.js';
import './wish.css';

export default function WishCompareTable({ matches, wishFeatureIds = [] }) {
  if (!matches.length) {
    return <p>Keine Fahrzeuge zum Vergleichen.</p>;
  }

  const features = wishFeatureIds.length
    ? wishFeatureIds
    : [...new Set(matches.flatMap((m) => [...m.matchedFeatures, ...m.missingFeatures, ...m.availableWithPackage]))];

  return (
    <div className="wish-compare-table-wrap">
      <table className="wish-compare-table">
        <thead>
          <tr>
            <th>Wunsch</th>
            {matches.map((m) => (
              <th key={m.vehicleId}>{m.model}<br /><span>{m.bestTrim}</span></th>
            ))}
          </tr>
        </thead>
        <tbody>
          {features.map((fid) => (
            <tr key={fid}>
              <td>{getFeatureLabel(fid)}</td>
              {matches.map((m) => {
                let cell = '❌';
                if (m.matchedFeatures.includes(fid)) cell = '✅';
                else if (m.availableWithPackage.includes(fid)) cell = 'Paket';
                return <td key={m.vehicleId}>{cell}</td>;
              })}
            </tr>
          ))}
          <tr className="wish-compare-table__meta-row">
            <td>Rate</td>
            {matches.map((m) => (
              <td key={m.vehicleId}>{formatCurrency(m.bestOffer.monthlyRate)}/Monat</td>
            ))}
          </tr>
          <tr className="wish-compare-table__meta-row">
            <td>Entfernung</td>
            {matches.map((m) => (
              <td key={m.vehicleId}>{m.bestOffer.distanceKm} km</td>
            ))}
          </tr>
          <tr className="wish-compare-table__meta-row">
            <td>Lieferzeit</td>
            {matches.map((m) => (
              <td key={m.vehicleId}>{m.bestOffer.deliveryTime}</td>
            ))}
          </tr>
          <tr className="wish-compare-table__meta-row">
            <td>Score</td>
            {matches.map((m) => (
              <td key={m.vehicleId}><strong>{m.score}</strong></td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  );
}
