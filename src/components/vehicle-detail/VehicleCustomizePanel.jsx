import { useEffect, useMemo } from 'react';
import { getManufacturerModel } from '../../data/manufacturer/manufacturerRegistry.js';
import {
  getVehicleColors,
  getConfigurablePackages,
} from '../../logic/vehicleDetailConfig.js';
import VehicleWishPanel from './VehicleWishPanel.jsx';
import './vehicle-detail.css';

function ColorSwatch({ color, active, onSelect }) {
  return (
    <button
      type="button"
      className={`vd-color${active ? ' is-active' : ''}`}
      onClick={() => onSelect(color.id)}
      aria-label={color.name}
    >
      <span className="vd-color__dot" style={{ background: color.hex }} />
      <span className="vd-color__name">{color.name}</span>
    </button>
  );
}

function PackageToggle({ item, active, onToggle }) {
  return (
    <button
      type="button"
      className={`vd-package${active ? ' is-active' : ''}`}
      onClick={onToggle}
    >
      {item.name}
    </button>
  );
}

function SectionContent({
  section,
  colors,
  packages,
  accessories,
  colorId,
  onColorChange,
  packageIds,
  accessoryIds,
  onPackageToggle,
  onAccessoryToggle,
  wishPanelProps,
}) {
  if (section === 'color' && colors.length > 0) {
    return (
      <div className="vd-customize__colors">
        {colors.map((c) => (
          <ColorSwatch
            key={c.id}
            color={c}
            active={colorId === c.id}
            onSelect={onColorChange}
          />
        ))}
      </div>
    );
  }
  if (section === 'packages') {
    return (
      <div className="vd-customize__packages">
        {packages.map((pkg) => (
          <PackageToggle
            key={pkg.id}
            item={pkg}
            active={packageIds.includes(pkg.id)}
            onToggle={() => onPackageToggle(pkg.id)}
          />
        ))}
        {accessories.map((acc) => (
          <PackageToggle
            key={acc.id}
            item={acc}
            active={accessoryIds.includes(acc.id)}
            onToggle={() => onAccessoryToggle(acc.id)}
          />
        ))}
      </div>
    );
  }
  if (section === 'wishes' && wishPanelProps) {
    return <VehicleWishPanel {...wishPanelProps} embedded />;
  }
  return null;
}

const SECTION_TITLES = {
  color: 'Farbe wählen',
  packages: 'Pakete',
  wishes: 'Was soll Ihr Auto haben?',
};

export default function VehicleCustomizePanel({
  vehicle,
  configMode = false,
  trimId,
  trimName,
  colorId,
  onColorChange,
  packageIds,
  accessoryIds,
  onPackageToggle,
  onAccessoryToggle,
  wishIds,
  onWishIdsChange,
  exploreWishId,
  onExploreWishChange,
  onApplyWishConfiguration,
  onTrimUpgrade,
  paymentType = 'leasing',
  termMonths = 48,
  mileagePerYear = 10000,
  downPayment = 0,
  financeDown = 0,
  financeBalloon = 0,
  baselineEnginePricing = null,
  currentRateLabel,
  activeSection = null,
  onActiveSectionChange,
  embedded = false,
}) {
  const mfg = getManufacturerModel(vehicle.brand, vehicle.model);
  const colors = useMemo(
    () => getVehicleColors(vehicle.brand, vehicle.model, trimId),
    [vehicle.brand, vehicle.model, trimId],
  );
  const { packages, accessories } = useMemo(
    () => getConfigurablePackages(vehicle.brand, vehicle.model, trimId),
    [vehicle.brand, vehicle.model, trimId],
  );

  const hasPackages = packages.length > 0 || accessories.length > 0;
  const sheetOpen = Boolean(activeSection);

  useEffect(() => {
    if (!sheetOpen) return undefined;
    const prev = document.body.style.overflow;
    const mq = window.matchMedia('(max-width: 767px)');
    const lock = () => {
      if (mq.matches) document.body.style.overflow = 'hidden';
    };
    lock();
    mq.addEventListener('change', lock);
    return () => {
      document.body.style.overflow = prev;
      mq.removeEventListener('change', lock);
    };
  }, [sheetOpen]);

  if (!mfg && !configMode) return null;

  if (embedded && !activeSection) return null;

  const toggleSection = (key) => {
    onActiveSectionChange?.(activeSection === key ? null : key);
  };

  const wishPanelProps = {
    vehicle,
    trimId,
    trimName,
    wishIds,
    exploreWishId,
    onExploreWishChange,
    onWishIdsChange,
    onApplyConfiguration: onApplyWishConfiguration,
    onTrimUpgrade,
    paymentType,
    termMonths,
    mileagePerYear,
    downPayment,
    financeDown,
    financeBalloon,
    baselineEnginePricing,
    currentRateLabel,
    embedded: true,
  };

  const sectionProps = {
    section: activeSection,
    colors,
    packages,
    accessories,
    colorId,
    onColorChange,
    packageIds,
    accessoryIds,
    onPackageToggle,
    onAccessoryToggle,
    wishPanelProps,
  };

  return (
    <section className={`vd-customize${embedded ? ' vd-customize--embedded' : ' vd-tool-row'}${sheetOpen ? ' vd-customize--open' : ''}`} aria-label="Fahrzeug anpassen">
      {!embedded && (
        <>
          <div className="vd-customize__teaser">
            <div className="vd-customize__teaser-text">
              <p className="vd-customize__teaser-title">Fahrzeug anpassen</p>
              <p className="vd-customize__teaser-sub">Noch nicht ganz Ihr Wunschauto? Wählen Sie, was Ihr Auto haben soll.</p>
            </div>
          </div>
          <div className="vd-customize__quick">
            {mfg && colors.length > 0 && (
              <button
                type="button"
                className={`vd-quick-chip${activeSection === 'color' ? ' is-active' : ''}`}
                onClick={() => toggleSection('color')}
              >
                Farbe
              </button>
            )}
            <button
              type="button"
              className={`vd-quick-chip${activeSection === 'wishes' ? ' is-active' : ''}`}
              onClick={() => toggleSection('wishes')}
            >
              Ausstattung
            </button>
            {mfg && hasPackages && (
              <button
                type="button"
                className={`vd-quick-chip${activeSection === 'packages' ? ' is-active' : ''}`}
                onClick={() => toggleSection('packages')}
              >
                Pakete
              </button>
            )}
          </div>
        </>
      )}

      {activeSection && (
        <div className="vd-customize__panel vd-customize__panel--inline">
          <SectionContent {...sectionProps} />
        </div>
      )}

      {activeSection && (
        <div
          className="vd-customize__sheet-backdrop"
          role="presentation"
          onClick={() => onActiveSectionChange?.(null)}
        >
          <div
            className="vd-customize__sheet"
            role="dialog"
            aria-modal="true"
            aria-labelledby="vd-customize-sheet-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="vd-customize__sheet-head">
              <h2 id="vd-customize-sheet-title" className="vd-customize__sheet-title">
                {SECTION_TITLES[activeSection]}
              </h2>
              <button
                type="button"
                className="vd-customize__sheet-close"
                onClick={() => onActiveSectionChange?.(null)}
                aria-label="Schließen"
              >
                ×
              </button>
            </div>
            <div className="vd-customize__sheet-body">
              <SectionContent {...sectionProps} />
            </div>
            <button
              type="button"
              className="vd-btn vd-btn--primary vd-btn--block vd-customize__sheet-done"
              onClick={() => onActiveSectionChange?.(null)}
            >
              Übernehmen
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
