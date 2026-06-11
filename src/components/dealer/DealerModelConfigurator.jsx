import { useMemo, useState } from 'react';
import VehicleImage from '../shared/VehicleImage.jsx';
import {
  createDefaultConfiguration,
  resolveConfiguratorCatalog,
  summarizeConfiguration,
} from '../../services/dealer/modelConfiguratorCatalog.js';
import './dealer-landing.css';

function OptionChip({ active, children, onClick }) {
  return (
    <button
      type="button"
      className={`dl-config__chip${active ? ' dl-config__chip--active' : ''}`}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function PackageToggle({ active, label, onToggle }) {
  return (
    <label className={`dl-config__package${active ? ' dl-config__package--active' : ''}`}>
      <input type="checkbox" checked={active} onChange={onToggle} />
      <span>{label}</span>
    </label>
  );
}

/**
 * Phase 2 – Modell konfigurieren (Farbe, Antrieb, Ausstattung, Pakete).
 */
export default function DealerModelConfigurator({
  modelKey,
  dealerId,
  initialConfig = null,
  onContinue,
}) {
  const catalog = useMemo(() => resolveConfiguratorCatalog(modelKey), [modelKey]);
  const [config, setConfig] = useState(
    () => initialConfig ?? createDefaultConfiguration(modelKey),
  );

  if (!catalog || !config) return null;

  const summary = summarizeConfiguration(config);
  const imageModel = summary?.modelKey ?? catalog.modelKey;
  const colorSlug = catalog.colors.find((c) => c.id === config.colorId)?.imageSlug;

  function setColor(colorId) {
    setConfig((prev) => ({ ...prev, colorId }));
  }

  function setPowertrain(powertrainId) {
    setConfig((prev) => ({ ...prev, powertrainId }));
  }

  function setTrim(trimId) {
    setConfig((prev) => ({ ...prev, trimId }));
  }

  function togglePackage(packageId) {
    setConfig((prev) => {
      const ids = new Set(prev.packageIds ?? []);
      if (ids.has(packageId)) ids.delete(packageId);
      else ids.add(packageId);
      return { ...prev, packageIds: [...ids] };
    });
  }

  return (
    <section className="dl-config" aria-labelledby="dl-config-title">
      <header className="dl-config__head">
        <p className="dl-config__phase">Phase 2 – Konfigurieren</p>
        <h2 id="dl-config-title" className="dl-config__title">{catalog.headline}</h2>
        <p className="dl-config__subtitle">{catalog.subtitle}</p>
      </header>

      <div className="dl-config__layout">
        <div className="dl-config__visual">
          <VehicleImage
            brand="Kia"
            model={imageModel}
            color={colorSlug}
            dealerId={dealerId}
            bodyType="suv"
            className="dl-config__image-wrap"
            imageClassName="dl-config__image"
            variant="card"
            glow
          />
          {summary && (
            <div className="dl-config__preview">
              <p className="dl-config__preview-label">Ihre Auswahl</p>
              <p className="dl-config__preview-line">
                <strong>{summary.modelLabel}</strong>
                {' · '}
                {summary.trimLabel}
              </p>
              <p className="dl-config__preview-line">
                {summary.colorLabel}
                {' · '}
                {summary.powertrainLabel}
              </p>
              {summary.packageLabels.length > 0 && (
                <p className="dl-config__preview-packages">
                  {summary.packageLabels.join(' · ')}
                </p>
              )}
            </div>
          )}
        </div>

        <div className="dl-config__groups">
          <fieldset className="dl-config__group">
            <legend>Farbe</legend>
            <div className="dl-config__chips">
              {catalog.colors.map((color) => (
                <OptionChip
                  key={color.id}
                  active={config.colorId === color.id}
                  onClick={() => setColor(color.id)}
                >
                  {color.label}
                </OptionChip>
              ))}
            </div>
          </fieldset>

          <fieldset className="dl-config__group">
            <legend>Motorisierung</legend>
            <div className="dl-config__chips">
              {catalog.powertrains.map((pt) => (
                <OptionChip
                  key={pt.id}
                  active={config.powertrainId === pt.id}
                  onClick={() => setPowertrain(pt.id)}
                >
                  {pt.label}
                </OptionChip>
              ))}
            </div>
          </fieldset>

          <fieldset className="dl-config__group">
            <legend>Ausstattung</legend>
            <div className="dl-config__chips">
              {catalog.trims.map((trim) => (
                <OptionChip
                  key={trim.id}
                  active={config.trimId === trim.id}
                  onClick={() => setTrim(trim.id)}
                >
                  {trim.label}
                </OptionChip>
              ))}
            </div>
          </fieldset>

          <fieldset className="dl-config__group">
            <legend>Pakete</legend>
            <div className="dl-config__packages">
              {catalog.packages.map((pkg) => (
                <PackageToggle
                  key={pkg.id}
                  label={pkg.label}
                  active={config.packageIds?.includes(pkg.id)}
                  onToggle={() => togglePackage(pkg.id)}
                />
              ))}
            </div>
          </fieldset>
        </div>
      </div>

      <div className="dl-config__footer">
        <p className="dl-config__next-hint">
          Als Nächstes: Wie möchten Sie das Fahrzeug nutzen – Kauf, Finanzierung oder Leasing?
        </p>
        <button
          type="button"
          className="btn btn-primary dl-config__cta"
          onClick={() => onContinue?.(config, summary)}
        >
          Weiter mit dieser Konfiguration
        </button>
      </div>
    </section>
  );
}
