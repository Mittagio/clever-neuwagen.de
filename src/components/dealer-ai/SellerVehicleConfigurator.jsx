import { useMemo } from 'react';
import {
  buildConfigureOptions,
  filterAccessoryIdsForTrim,
  filterPackageIdsForTrim,
} from '../../services/vehicleConfiguration.js';
import {
  buildPackageCatalog,
  formatPackagePrice,
} from '../../services/configuration/configurePackageCatalog.js';
import './SellerVehicleConfigurator.css';

function OptionCard({ label, sublabel, selected, onClick, disabled = false, className = '' }) {
  return (
    <button
      type="button"
      className={`vc-option-card${selected ? ' is-selected' : ''}${disabled ? ' is-disabled' : ''} ${className}`.trim()}
      onClick={onClick}
      disabled={disabled}
      aria-pressed={selected}
    >
      <span className="vc-option-card__label">{label}</span>
      {sublabel && <span className="vc-option-card__sub">{sublabel}</span>}
    </button>
  );
}

function PackageCard({ pkg, onToggle }) {
  const isIncluded = pkg.status === 'included';
  const isBlocked = pkg.status === 'blocked';
  const isSelected = pkg.status === 'selected';
  const clickable = !isIncluded && !isBlocked;

  return (
    <div
      className={`vc-package-card${isSelected ? ' is-selected' : ''}${isIncluded ? ' is-included' : ''}${isBlocked ? ' is-blocked' : ''}`}
    >
      <button
        type="button"
        className="vc-package-card__main"
        onClick={() => clickable && onToggle(pkg.id)}
        disabled={!clickable}
        aria-pressed={isSelected}
      >
        <div className="vc-package-card__head">
          <span className="vc-package-card__name">{pkg.name}</span>
          <span className="vc-package-card__price">
            {isIncluded ? 'Serie' : formatPackagePrice(pkg.priceGross)}
          </span>
        </div>
        {pkg.highlights.length > 0 && (
          <ul className="vc-package-card__highlights">
            {pkg.highlights.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        )}
      </button>
      {isIncluded && (
        <p className="vc-package-card__status vc-package-card__status--included">
          ✓ Bereits in {pkg.includedInTrimLabel} enthalten
        </p>
      )}
      {isBlocked && pkg.missingRequiredLabels.length > 0 && (
        <p className="vc-package-card__status vc-package-card__status--blocked">
          Benötigt: {pkg.missingRequiredLabels.join(', ')}
        </p>
      )}
    </div>
  );
}

function ExtraCard({ label, selected, onChange }) {
  return (
    <button
      type="button"
      className={`vc-extra-card${selected ? ' is-selected' : ''}`}
      onClick={() => onChange(!selected)}
      aria-pressed={selected}
    >
      {label}
    </button>
  );
}

/**
 * Verkäufer-Konfigurator – Fahrzeug zusammenstellen, nicht Formular ausfüllen.
 */
export default function SellerVehicleConfigurator({ draft, onChange }) {
  const options = useMemo(
    () => buildConfigureOptions(draft.modelKey, draft.trimId),
    [draft.modelKey, draft.trimId],
  );

  const packageCatalog = useMemo(
    () => buildPackageCatalog(draft.modelKey, draft.trimId, draft.packageIds ?? []),
    [draft.modelKey, draft.trimId, draft.packageIds],
  );

  function patch(partial) {
    onChange({ ...draft, ...partial });
  }

  function handleTrimChange(trimId) {
    const trim = options.trims.find((t) => t.id === trimId);
    const packageIds = filterPackageIdsForTrim(draft.modelKey, trimId, draft.packageIds ?? []);
    const accessoryIds = filterAccessoryIdsForTrim(draft.modelKey, trimId, draft.accessoryIds ?? []);
    patch({
      trimId,
      trimLabel: trim?.label ?? draft.trimLabel,
      packageIds,
      accessoryIds,
    });
  }

  function togglePackage(packageId) {
    const pkg = packageCatalog.packages.find((p) => p.id === packageId);
    if (!pkg || pkg.status === 'included' || pkg.status === 'blocked') return;

    const ids = new Set(draft.packageIds ?? []);
    if (ids.has(packageId)) ids.delete(packageId);
    else ids.add(packageId);
    patch({ packageIds: [...ids] });
  }

  function toggleAccessory(accessoryId, active) {
    const ids = new Set(draft.accessoryIds ?? []);
    if (active) ids.add(accessoryId);
    else ids.delete(accessoryId);
    const nextExtras = { ...draft.extras };
    if (accessoryId.includes('anhaenger')) nextExtras.ahk = active;
    patch({ accessoryIds: [...ids], extras: nextExtras });
  }

  function toggleExtra(key, active) {
    const nextExtras = { ...draft.extras, [key]: active };
    const next = { ...draft, extras: nextExtras };
    if (key === 'ahk') {
      const ids = new Set(next.accessoryIds ?? []);
      const ahk = options.accessories.find((a) => /anhänger|anhaenger/i.test(a.label));
      if (ahk) {
        if (active) ids.add(ahk.id);
        else ids.delete(ahk.id);
      }
      next.accessoryIds = [...ids];
    }
    onChange(next);
  }

  const dealerExtras = [
    { id: 'winterraeder', label: 'Winterräder' },
    { id: 'wartung', label: 'Wartung' },
    { id: 'versicherung', label: 'Versicherung' },
    { id: 'ahk', label: 'AHK' },
  ];

  function formatEngineLabel(opt) {
    const label = typeof opt === 'object' ? opt.label : String(opt);
    return label.includes('kWh') ? label.match(/\d+(?:[,.]\d+)?\s*kWh/i)?.[0]?.replace(',', '.') ?? label : label;
  }

  return (
    <div className="vehicle-configurator">
      <section className="vc-section">
        <header className="vc-section__head">
          <span className="vc-section__step">1</span>
          <h3 className="vc-section__title">Fahrzeug</h3>
        </header>
        <div className="vc-model-line">
          <span className="vc-model-line__brand">Kia</span>
          <span className="vc-model-line__model">{draft.model}</span>
        </div>

        {options.trims.length > 0 && (
          <div className="vc-subsection">
            <p className="vc-subsection__label">Linie</p>
            <div className="vc-option-cards">
              {options.trims.map((trim) => (
                <OptionCard
                  key={trim.id}
                  label={trim.label}
                  selected={draft.trimId === trim.id}
                  onClick={() => handleTrimChange(trim.id)}
                />
              ))}
            </div>
          </div>
        )}

        {options.engines.length > 0 && (
          <div className="vc-subsection">
            <p className="vc-subsection__label">Batterie / Antrieb</p>
            <div className="vc-option-cards">
              {options.engines.map((engine) => (
                <OptionCard
                  key={engine.id}
                  label={formatEngineLabel(engine)}
                  sublabel={engine.label !== formatEngineLabel(engine) ? engine.label : null}
                  selected={draft.engineId === engine.id}
                  onClick={() => patch({
                    engineId: engine.id,
                    batteryLabel: formatEngineLabel(engine),
                  })}
                />
              ))}
            </div>
          </div>
        )}

        {draft.motorLabel && (
          <p className="vc-motor-hint">Motorisierung: {draft.motorLabel}</p>
        )}
      </section>

      <section className="vc-section">
        <header className="vc-section__head">
          <span className="vc-section__step">2</span>
          <h3 className="vc-section__title">Farbe</h3>
        </header>
        <div className="vc-color-cards">
          {options.colors.map((color) => (
            <OptionCard
              key={color.id}
              label={color.label}
              selected={draft.colorId === color.id}
              onClick={() => patch({ colorId: color.id, colorLabel: color.label })}
              className="vc-option-card--color"
            />
          ))}
        </div>
      </section>

      {packageCatalog.groups.length > 0 && (
        <section className="vc-section">
          <header className="vc-section__head">
            <span className="vc-section__step">3</span>
            <h3 className="vc-section__title">Pakete</h3>
          </header>
          {packageCatalog.groups.map((group) => (
            <div key={group.id} className="vc-package-group">
              <h4 className="vc-package-group__title">{group.label}</h4>
              <div className="vc-package-cards">
                {group.packages.map((pkg) => (
                  <PackageCard key={pkg.id} pkg={pkg} onToggle={togglePackage} />
                ))}
              </div>
            </div>
          ))}
        </section>
      )}

      {(options.accessories.length > 0 || dealerExtras.length > 0) && (
        <section className="vc-section">
          <header className="vc-section__head">
            <span className="vc-section__step">4</span>
            <h3 className="vc-section__title">Extras</h3>
          </header>
          <div className="vc-extra-cards">
            {options.accessories.map((acc) => (
              <ExtraCard
                key={acc.id}
                label={acc.label}
                selected={(draft.accessoryIds ?? []).includes(acc.id)}
                onChange={(active) => toggleAccessory(acc.id, active)}
              />
            ))}
            {dealerExtras.map((extra) => (
              <ExtraCard
                key={extra.id}
                label={extra.label}
                selected={Boolean(draft.extras?.[extra.id])}
                onChange={(active) => toggleExtra(extra.id, active)}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
