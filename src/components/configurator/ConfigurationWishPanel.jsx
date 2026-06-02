import { useMemo, useState, useEffect } from 'react';
import { CONFIGURATOR_FEATURE_IDS, getFeatureLabel } from '../../data/features/featureCatalog.js';
import { getManufacturerModel } from '../../data/manufacturer/manufacturerRegistry.js';
import { formatCurrency } from '../../logic/marketplaceService.js';
import { priceAllTrimsForWish, priceConfiguration } from '../../services/pricing/pricingEngine.js';
import { findBestTrimForWish } from '../../services/configurator/wishPackageResolver.js';
import './configurationWish.css';

function ConfigWishChip({ id, active, onToggle }) {
  return (
    <button
      type="button"
      className={`config-wish-chip${active ? ' is-active' : ''}`}
      onClick={() => onToggle(id)}
    >
      {active ? '☑' : '☐'} {getFeatureLabel(id)}
    </button>
  );
}

export default function ConfigurationWishPanel({
  vehicle,
  initialWishIds = [],
  paymentType = 'leasing',
  onConfigChange,
}) {
  const [wishIds, setWishIds] = useState(initialWishIds);
  const mfg = getManufacturerModel(vehicle.brand, vehicle.model);

  const bestConfig = useMemo(() => {
    if (!mfg) return null;
    return findBestTrimForWish({
      brand: vehicle.brand,
      model: vehicle.model,
      wishFeatureIds: wishIds,
    });
  }, [mfg, vehicle, wishIds]);

  const livePricing = useMemo(() => {
    if (!mfg || !bestConfig) return null;
    return priceConfiguration({
      brand: vehicle.brand,
      model: vehicle.model,
      trimId: bestConfig.trimId,
      wishFeatureIds: wishIds,
      paymentType,
    });
  }, [mfg, vehicle, bestConfig, wishIds, paymentType]);

  const trimComparison = useMemo(() => {
    if (!mfg) return [];
    return priceAllTrimsForWish({
      brand: vehicle.brand,
      model: vehicle.model,
      wishFeatureIds: wishIds,
      paymentType,
    });
  }, [mfg, vehicle, wishIds, paymentType]);

  useEffect(() => {
    if (!mfg || !bestConfig) return;
    onConfigChange?.({
      wishIds,
      trimId: bestConfig.trimId,
      trimName: bestConfig.trimName,
      livePricing,
    });
  }, [wishIds, bestConfig, livePricing, mfg, onConfigChange]);

  if (!mfg) return null;

  function toggleWish(id) {
    setWishIds((prev) => (prev.includes(id) ? prev.filter((f) => f !== id) : [...prev, id]));
  }

  const displayRate = livePricing?.leasingRate ?? livePricing?.primaryRate ?? vehicle.monthlyRate;
  const requiredPackages = livePricing?.wishResolution?.requiredPackages ?? [];
  const requiredAccessories = livePricing?.wishResolution?.requiredAccessories ?? [];

  return (
    <section className="config-wish-panel card" aria-label="Konfiguration und Wünsche">
      <VehicleHeader vehicle={vehicle} trimName={bestConfig?.trimName} rate={displayRate} />

      <div className="config-wish-panel__section">
        <h2>Wünsche auswählen</h2>
        <div className="config-wish-panel__chips">
          {CONFIGURATOR_FEATURE_IDS.map((id) => (
            <ConfigWishChip
              key={id}
              id={id}
              active={wishIds.includes(id)}
              onToggle={toggleWish}
            />
          ))}
        </div>
      </div>

      {wishIds.length > 0 && livePricing?.wishResolution && (
        <div className="config-wish-panel__magic">
          {requiredPackages.length > 0 && (
            <p className="config-wish-panel__package-hint">
              <strong>{requiredPackages[0].name} erforderlich</strong>
              {' '}für {requiredPackages.map((p) => p.reason).filter(Boolean).join(', ')}
            </p>
          )}
          <div className="config-wish-panel__required">
            <p className="config-wish-panel__required-title">Für Ihren Wunsch benötigt:</p>
            <ul>
              <li>✓ {bestConfig?.trimName}</li>
              {requiredPackages.map((p) => (
                <li key={p.id}>✓ {p.name}</li>
              ))}
              {requiredAccessories.map((a) => (
                <li key={a.id}>✓ {a.name}</li>
              ))}
            </ul>
            <p className="config-wish-panel__new-rate">
              Neue Rate: <strong>{formatCurrency(displayRate)}/Monat</strong>
            </p>
          </div>
        </div>
      )}

      {trimComparison.length > 0 && (
        <div className="config-wish-panel__section">
          <h2>Ausstattungsvergleich</h2>
          <div className="config-wish-panel__trim-grid">
            {trimComparison.map((trim) => (
              <article
                key={trim.trimId}
                className={`config-wish-trim${trim.isRecommended ? ' config-wish-trim--best' : ''}`}
              >
                {trim.isRecommended && <span className="config-wish-trim__badge">Empfohlen</span>}
                <h3>{trim.trimName}</h3>
                <p className="config-wish-trim__match">
                  Erfüllt {trim.wishesMatched} von {trim.wishesTotal || wishIds.length} Wünschen
                </p>
                {trim.monthlyRate != null && (
                  <p className="config-wish-trim__rate">{formatCurrency(trim.monthlyRate)}/Monat</p>
                )}
                {trim.requiredPackages?.length > 0 && (
                  <p className="config-wish-trim__hint">
                    {trim.requiredPackages.map((p) => p.name).join(', ')} möglich
                  </p>
                )}
                {trim.missingFeatures?.length > 0 && (
                  <p className="config-wish-trim__missing">
                    Fehlt: {trim.missingFeatures.map(getFeatureLabel).join(', ')}
                  </p>
                )}
              </article>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

function VehicleHeader({ vehicle, trimName, rate }) {
  return (
    <header className="config-wish-panel__hero">
      <div>
        <p className="config-wish-panel__eyebrow">Konfiguration & Wünsche</p>
        <h1>{vehicle.brand} {vehicle.model}{trimName ? ` ${trimName}` : ''}</h1>
        <p className="config-wish-panel__from">ab {formatCurrency(rate)}/Monat</p>
      </div>
    </header>
  );
}
