import { getFeatureLabel } from '../../data/features/featureCatalog.js';
import './wish.css';

export function WishFulfillmentList({ matched = [], missing = [], viaPackage = [] }) {
  const hasItems = matched.length || missing.length || viaPackage.length;
  if (!hasItems) return null;

  return (
    <div className="wish-fulfillment">
      <p className="wish-fulfillment__title">Ihre Wünsche</p>
      <ul className="wish-fulfillment__list">
        {matched.map((id) => (
          <li key={id} className="wish-fulfillment__item wish-fulfillment__item--ok">
            ✅ {getFeatureLabel(id)}
          </li>
        ))}
        {viaPackage.map((id) => (
          <li key={id} className="wish-fulfillment__item wish-fulfillment__item--warn">
            ⚠️ {getFeatureLabel(id)} per Paket möglich
          </li>
        ))}
        {missing.map((id) => (
          <li key={id} className="wish-fulfillment__item wish-fulfillment__item--miss">
            ❌ {getFeatureLabel(id)} nicht verfügbar
          </li>
        ))}
      </ul>
    </div>
  );
}

export function WishMissingHint({ missing = [] }) {
  if (!missing.length) return null;
  return (
    <p className="wish-missing-hint">
      Fehlt: {missing.map(getFeatureLabel).join(', ')}
    </p>
  );
}
