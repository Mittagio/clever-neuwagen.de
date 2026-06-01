import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { usePublishedDealerConditions } from '../context/DealerConditionsContext.jsx';
import { sportage } from '../data/kiaSportage.js';
import ComplianceShieldBanner from '../components/compliance/ComplianceShieldBanner.jsx';
import ComplianceCopyBlock from '../components/compliance/ComplianceCopyBlock.jsx';
import {
  GENERATOR_VEHICLES,
  LISTING_BLOCK_KEYS,
  generateListingBlocks,
} from '../logic/listingGenerator.js';
import './InsertGeneratorPage.css';

const DEFAULT_VEHICLE = GENERATOR_VEHICLES[0];

export default function InsertGeneratorPage() {
  const { publishedConditions: conditions } = usePublishedDealerConditions();
  const [vehicleId] = useState(DEFAULT_VEHICLE.id);
  const [config, setConfig] = useState({ ...DEFAULT_VEHICLE.defaultConfig });

  const blocks = useMemo(
    () => generateListingBlocks(config, conditions),
    [config, conditions],
  );

  const vehicleRef = useMemo(() => ({
    engineId: config.engineId,
    trimId: config.trimId,
    brand: sportage.brand,
    model: sportage.model,
  }), [config.engineId, config.trimId]);

  function update(field, value) {
    setConfig((prev) => ({ ...prev, [field]: value }));
  }

  function togglePackage(id) {
    setConfig((prev) => {
      const ids = prev.packageIds ?? [];
      const next = ids.includes(id) ? ids.filter((p) => p !== id) : [...ids, id];
      return { ...prev, packageIds: next };
    });
  }

  const trim = sportage.trims.find((t) => t.id === config.trimId);
  const engine = sportage.engines.find((e) => e.id === config.engineId);

  return (
    <div className="insert-gen">
      <header className="insert-gen__header">
        <div className="insert-gen__header-top">
          <Link to="/sales" className="insert-gen__back">
            ← Verkäufer
          </Link>
          <span className="insert-gen__badge">mobile.de</span>
        </div>
        <h1 className="insert-gen__title">Inseratgenerator</h1>
        <p className="insert-gen__sub">
          {sportage.brand} {sportage.model} · {trim?.name} · {engine?.name}
        </p>
      </header>

      <section className="insert-gen__picker">
        <h2 className="insert-gen__section-title">Fahrzeug wählen</h2>
        <div className="insert-gen__vehicle-chips">
          {GENERATOR_VEHICLES.map((v) => (
            <button
              key={v.id}
              type="button"
              className={`insert-gen__chip${vehicleId === v.id ? ' insert-gen__chip--active' : ''}`}
              disabled={vehicleId === v.id}
            >
              {v.label}
            </button>
          ))}
        </div>

        <div className="insert-gen__selects">
          <label className="insert-gen__field">
            <span>Ausstattung</span>
            <select
              value={config.trimId}
              onChange={(e) => update('trimId', e.target.value)}
            >
              {sportage.trims.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </label>

          <label className="insert-gen__field">
            <span>Motor</span>
            <select
              value={config.engineId}
              onChange={(e) => update('engineId', e.target.value)}
            >
              {sportage.engines.map((e) => (
                <option key={e.id} value={e.id}>{e.name}</option>
              ))}
            </select>
          </label>

          <label className="insert-gen__field">
            <span>Farbe</span>
            <select
              value={config.colorId}
              onChange={(e) => update('colorId', e.target.value)}
            >
              {sportage.colors.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </label>
        </div>

        <div className="insert-gen__packages">
          <span className="insert-gen__packages-label">Pakete</span>
          <div className="insert-gen__package-chips">
            {sportage.packages.map((pkg) => (
              <button
                key={pkg.id}
                type="button"
                className={`insert-gen__chip insert-gen__chip--sm${
                  config.packageIds?.includes(pkg.id) ? ' insert-gen__chip--active' : ''
                }`}
                onClick={() => togglePackage(pkg.id)}
              >
                {pkg.name}
              </button>
            ))}
          </div>
        </div>
      </section>

      <ComplianceShieldBanner vehicleRef={vehicleRef} validation={blocks.compliance} />

      <section className="insert-gen__blocks">
        <h2 className="insert-gen__section-title">Blöcke kopieren</h2>
        <p className="insert-gen__hint">
          {blocks.compliance?.publishable
            ? 'Pflichtblock wird bei Kopie automatisch angehängt.'
            : 'Kopieren gesperrt – Pflichtangaben unvollständig oder ungeprüft.'}
        </p>

        <ComplianceCopyBlock
          vehicleRef={vehicleRef}
          validation={blocks.compliance}
          label={LISTING_BLOCK_KEYS[0].label}
          text={blocks.mobileTitle}
          channelId="mobile-title"
          compact
        />

        {LISTING_BLOCK_KEYS.slice(1).map(({ id, label }) => (
          <ComplianceCopyBlock
            key={id}
            vehicleRef={vehicleRef}
            validation={blocks.compliance}
            label={label}
            text={blocks[id]}
            channelId={id}
          />
        ))}
      </section>

      <footer className="insert-gen__footer">
        <Link to="/backend">Backend</Link>
        <span>·</span>
        <Link to="/sales">Verkäufermodus</Link>
      </footer>
    </div>
  );
}
