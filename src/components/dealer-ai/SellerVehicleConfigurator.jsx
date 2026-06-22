import { useEffect, useMemo, useState } from 'react';
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

const STEPS = [
  { id: 'vehicle', number: 1, title: 'Fahrzeug' },
  { id: 'color', number: 2, title: 'Farbe' },
  { id: 'packages', number: 3, title: 'Pakete' },
  { id: 'extras', number: 4, title: 'Extras' },
];

const FUEL_GROUP_ORDER = ['Benzin', 'Hybrid', 'Plug-in Hybrid', 'Diesel', 'Elektro', 'Standard'];

function colorSwatch(color) {
  if (color.hexPreview) return color.hexPreview;
  const haystack = `${color.id} ${color.label}`.toLowerCase();
  if (/black|schwarz|pearl.*black/.test(haystack)) return '#1a1a1a';
  if (/white|weiss|weiß|snow|carrara|deluxe/.test(haystack)) return '#f4f4f0';
  if (/red|rot|magma|runway/.test(haystack)) return '#8b1e2f';
  if (/blue|blau|frost|ocean|yacht|smoke/.test(haystack)) return '#2d4a6e';
  if (/green|grün|gruen|aventurine|experience/.test(haystack)) return '#3d5c4a';
  if (/grey|gray|grau|wolf|shale|pentametal|astro|sparkling|ivory|lunar/.test(haystack)) return '#8b939e';
  return '#cbd5e1';
}

function formatColorPrice(priceGross) {
  if (!priceGross) return 'Serie';
  return `+ ${priceGross.toLocaleString('de-DE')} €`;
}

function groupEnginesByFuel(engines) {
  const map = new Map();
  for (const engine of engines) {
    const group = engine.fuelType ?? 'Standard';
    if (!map.has(group)) map.set(group, []);
    map.get(group).push(engine);
  }
  return FUEL_GROUP_ORDER
    .filter((key) => map.has(key))
    .map((key) => ({ id: key, label: key, engines: map.get(key) }));
}

function TrimPill({ label, selected, onClick }) {
  return (
    <button
      type="button"
      className={`vc-trim-pill${selected ? ' is-selected' : ''}`}
      onClick={onClick}
      aria-pressed={selected}
    >
      {label}
    </button>
  );
}

function PackageCard({ pkg, onToggle }) {
  const isIncluded = pkg.status === 'included';
  const isBlocked = pkg.status === 'blocked';
  const isSelected = pkg.status === 'selected';
  const clickable = !isIncluded && !isBlocked;
  const highlights = (pkg.highlights ?? []).slice(0, 6);
  const requiredPackages = pkg.requiredPackages?.length
    ? pkg.requiredPackages
    : (pkg.missingRequiredLabels ?? []).map((label) => ({ label, satisfied: false }));

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
        {highlights.length > 0 && (
          <ul className="vc-package-card__features">
            {highlights.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        )}
      </button>

      {requiredPackages.length > 0 && (
        <div className="vc-package-card__requires">
          <p className="vc-package-card__requires-label">Benötigt:</p>
          <ul className="vc-package-card__requires-list">
            {requiredPackages.map((req) => (
              <li
                key={req.id ?? req.label}
                className={req.satisfied ? 'is-satisfied' : 'is-missing'}
              >
                {req.satisfied ? '✓ ' : ''}
                {req.label}
              </li>
            ))}
          </ul>
        </div>
      )}

      {isIncluded && (
        <p className="vc-package-card__status vc-package-card__status--included">
          Bereits in {pkg.includedInTrimLabel} enthalten
        </p>
      )}
    </div>
  );
}

function ExtraChip({ label, selected, onChange }) {
  return (
    <button
      type="button"
      className={`vc-extra-chip${selected ? ' is-selected' : ''}`}
      onClick={() => onChange(!selected)}
      aria-pressed={selected}
    >
      {selected && <span className="vc-extra-chip__check" aria-hidden="true">✓</span>}
      {label}
    </button>
  );
}

function StepAccordionItem({
  step,
  isOpen,
  isComplete,
  summary,
  onToggle,
  children,
}) {
  return (
    <section className={`vc-step${isOpen ? ' is-open' : ''}${isComplete ? ' is-complete' : ''}${isComplete && !isOpen ? ' is-compact' : ''}`}>
      <button
        type="button"
        className="vc-step__trigger"
        onClick={onToggle}
        aria-expanded={isOpen}
      >
        <span className="vc-step__indicator">
          {isComplete ? (
            <span className="vc-step__done" aria-hidden="true">✓</span>
          ) : (
            <span className="vc-step__num">{step.number}</span>
          )}
        </span>
        <span className="vc-step__text">
          <span className="vc-step__title">{step.title}</span>
          {summary && (
            <span className="vc-step__summary">{summary}</span>
          )}
        </span>
        <span className="vc-step__chevron" aria-hidden="true">{isOpen ? '−' : '+'}</span>
      </button>
      {isOpen && (
        <div className="vc-step__body">
          {children}
        </div>
      )}
    </section>
  );
}

/**
 * Verkäufer-Konfigurator – mobile-first, Schritt-für-Schritt.
 */
export default function SellerVehicleConfigurator({ draft, onChange }) {
  const [openStep, setOpenStep] = useState('vehicle');
  const [fuelGroup, setFuelGroup] = useState(null);

  const options = useMemo(
    () => buildConfigureOptions(draft.modelKey, draft.trimId),
    [draft.modelKey, draft.trimId],
  );

  const packageCatalog = useMemo(
    () => buildPackageCatalog(draft.modelKey, draft.trimId, draft.packageIds ?? []),
    [draft.modelKey, draft.trimId, draft.packageIds],
  );

  const engineGroups = useMemo(
    () => groupEnginesByFuel(options.engines),
    [options.engines],
  );

  const activeEngine = options.engines.find((e) => e.id === draft.engineId) ?? options.engines[0] ?? null;
  const activeFuelGroup = fuelGroup
    ?? activeEngine?.fuelType
    ?? engineGroups[0]?.id
    ?? null;

  const enginesInGroup = engineGroups.find((g) => g.id === activeFuelGroup)?.engines ?? options.engines;

  useEffect(() => {
    if (!activeEngine?.fuelType) return;
    setFuelGroup((prev) => {
      const groupEngines = engineGroups.find((g) => g.id === prev)?.engines ?? [];
      if (prev && groupEngines.some((e) => e.id === draft.engineId)) return prev;
      return activeEngine.fuelType;
    });
  }, [draft.engineId, activeEngine?.fuelType, engineGroups]);

  const selectedPackageCount = (draft.packageIds ?? []).length;
  const dealerExtraCount = Object.values(draft.extras ?? {}).filter(Boolean).length;
  const accessoryCount = (draft.accessoryIds ?? []).length;
  const extrasCount = dealerExtraCount + accessoryCount;

  const engineLabel = activeEngine?.fullName ?? activeEngine?.label ?? draft.batteryLabel ?? null;

  const stepSummaries = {
    vehicle: [draft.trimLabel, engineLabel].filter(Boolean).join(' · ') || 'Auswahl offen',
    color: draft.colorLabel ?? 'Auswahl offen',
    packages: selectedPackageCount === 0 ? 'Keine gewählt' : `${selectedPackageCount} gewählt`,
    extras: extrasCount === 0 ? 'Keine gewählt' : `${extrasCount} gewählt`,
  };

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

  function handleEngineChange(engine) {
    patch({
      engineId: engine.id,
      batteryLabel: engine.label,
      motorLabel: engine.fullName ?? engine.label,
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
    { id: 'ahk', label: 'Anhängerkupplung' },
    { id: 'winterraeder', label: 'Winterräder' },
    { id: 'wartung', label: 'Wartung' },
    { id: 'versicherung', label: 'Versicherung' },
    { id: 'standheizung', label: 'Standheizung' },
  ];

  const hasPackages = packageCatalog.groups.length > 0;
  const hasExtras = options.accessories.length > 0 || dealerExtras.length > 0;

  function isStepComplete(stepId) {
    if (stepId === 'vehicle') return Boolean(draft.trimId && draft.engineId);
    if (stepId === 'color') return Boolean(draft.colorId);
    if (stepId === 'packages') return true;
    if (stepId === 'extras') return true;
    return false;
  }

  function toggleStep(stepId) {
    setOpenStep((prev) => (prev === stepId ? prev : stepId));
  }

  return (
    <div className="vehicle-configurator vehicle-configurator--mobile">
      {STEPS.filter((step) => {
        if (step.id === 'packages' && !hasPackages) return false;
        if (step.id === 'extras' && !hasExtras) return false;
        return true;
      }).map((step) => (
        <StepAccordionItem
          key={step.id}
          step={step}
          isOpen={openStep === step.id}
          isComplete={isStepComplete(step.id)}
          summary={stepSummaries[step.id]}
          onToggle={() => toggleStep(step.id)}
        >
          {step.id === 'vehicle' && (
            <>
              {options.trims.length > 0 && (
                <div className="vc-field-block">
                  <p className="vc-field-block__label">Linie</p>
                  <div className={`vc-trim-grid${options.trims.length >= 5 ? ' vc-trim-grid--scroll' : ''}`}>
                    {options.trims.map((trim) => (
                      <TrimPill
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
                <div className="vc-field-block">
                  <p className="vc-field-block__label">Motor / Batterie</p>
                  {engineGroups.length > 1 && (
                    <div className="vc-fuel-groups">
                      {engineGroups.map((group) => (
                        <button
                          key={group.id}
                          type="button"
                          className={`vc-fuel-group${activeFuelGroup === group.id ? ' is-selected' : ''}`}
                          onClick={() => setFuelGroup(group.id)}
                          aria-pressed={activeFuelGroup === group.id}
                        >
                          {group.label}
                        </button>
                      ))}
                    </div>
                  )}
                  <div className="vc-engine-list">
                    {enginesInGroup.map((engine) => (
                      <button
                        key={engine.id}
                        type="button"
                        className={`vc-engine-option${draft.engineId === engine.id ? ' is-selected' : ''}`}
                        onClick={() => handleEngineChange(engine)}
                        aria-pressed={draft.engineId === engine.id}
                      >
                        <span className="vc-engine-option__name">{engine.fullName ?? engine.label}</span>
                        {engine.drive && (
                          <span className="vc-engine-option__meta">{engine.drive}</span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {step.id === 'color' && (
            <div className="vc-color-grid">
              {options.colors.map((color) => (
                <button
                  key={color.id}
                  type="button"
                  className={`vc-color-chip${draft.colorId === color.id ? ' is-selected' : ''}`}
                  onClick={() => patch({ colorId: color.id, colorLabel: color.label })}
                  aria-pressed={draft.colorId === color.id}
                >
                  <span
                    className="vc-color-chip__swatch"
                    style={{ background: colorSwatch(color) }}
                    aria-hidden="true"
                  />
                  <span className="vc-color-chip__info">
                    <span className="vc-color-chip__name">{color.label}</span>
                    <span className="vc-color-chip__price">{formatColorPrice(color.priceGross)}</span>
                  </span>
                  {draft.colorId === color.id && (
                    <span className="vc-color-chip__check" aria-hidden="true">✓</span>
                  )}
                </button>
              ))}
            </div>
          )}

          {step.id === 'packages' && (
            <div className="vc-packages-flow">
              {packageCatalog.packages
                .filter((pkg) => pkg.status !== 'hidden')
                .map((pkg) => (
                  <PackageCard key={pkg.id} pkg={pkg} onToggle={togglePackage} />
                ))}
            </div>
          )}

          {step.id === 'extras' && (
            <div className="vc-extras-flow">
              <div className="vc-extra-chips">
                {options.accessories.map((acc) => (
                  <ExtraChip
                    key={acc.id}
                    label={acc.label}
                    selected={(draft.accessoryIds ?? []).includes(acc.id)}
                    onChange={(active) => toggleAccessory(acc.id, active)}
                  />
                ))}
                {dealerExtras.map((extra) => (
                  <ExtraChip
                    key={extra.id}
                    label={extra.label}
                    selected={Boolean(draft.extras?.[extra.id])}
                    onChange={(active) => toggleExtra(extra.id, active)}
                  />
                ))}
              </div>
            </div>
          )}
        </StepAccordionItem>
      ))}
    </div>
  );
}
