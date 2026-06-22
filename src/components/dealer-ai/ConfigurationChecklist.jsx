import { useState } from 'react';

/**
 * Einträge für die kompakte Hero-Zeile (Farbe + Pakete).
 */
export function buildConfigLineItems(vehicleConfiguration) {
  const items = [];
  if (vehicleConfiguration?.colorLabel) items.push(vehicleConfiguration.colorLabel);
  for (const pkg of vehicleConfiguration?.selectedPackages ?? []) {
    items.push(pkg.name);
  }
  return items;
}

export function buildHeroSubtitle(vehicleConfiguration, maxVisible = 4) {
  const items = buildConfigLineItems(vehicleConfiguration);
  if (!items.length) return '';
  if (items.length <= maxVisible) return items.join(' · ');
  return items.slice(0, maxVisible).join(' · ');
}

export function ConfigurationHeroLine({ vehicleConfiguration, maxVisible = 4 }) {
  const [expanded, setExpanded] = useState(false);
  const items = buildConfigLineItems(vehicleConfiguration);
  if (!items.length) return null;

  const hasMore = items.length > maxVisible;
  const visibleItems = expanded ? items : items.slice(0, maxVisible);
  const hiddenCount = items.length - maxVisible;

  return (
    <div className="dai-cond-hero__config-line">
      <p className="dai-cond-hero__config-text">
        {visibleItems.join(' · ')}
      </p>
      {hasMore && !expanded && (
        <button
          type="button"
          className="dai-cond-hero__config-more"
          onClick={() => setExpanded(true)}
        >
          + {hiddenCount} weitere ∨
        </button>
      )}
      {hasMore && expanded && (
        <button
          type="button"
          className="dai-cond-hero__config-more"
          onClick={() => setExpanded(false)}
        >
          Weniger anzeigen ∧
        </button>
      )}
    </div>
  );
}

function OverviewTile({ icon, title, lines, badge, complete = true, showCheck = true }) {
  return (
    <div className={`cn-config-tile${complete ? ' is-complete' : ''}`}>
      <div className="cn-config-tile__head">
        <span className="cn-config-tile__icon" aria-hidden="true">{icon}</span>
        {showCheck && complete && (
          <span className="cn-config-tile__check" aria-hidden="true">✓</span>
        )}
        {badge != null && badge > 0 && (
          <span className="cn-config-tile__badge">{badge}</span>
        )}
      </div>
      <p className="cn-config-tile__title">{title}</p>
      {lines.map((line) => (
        <p key={line} className="cn-config-tile__line">{line}</p>
      ))}
    </div>
  );
}

export function ConfigurationOverviewTiles({ vehicleConfiguration, onEdit }) {
  if (!vehicleConfiguration) return null;

  const motor = vehicleConfiguration.motorLabel ?? vehicleConfiguration.batteryLabel;
  const vehicleLines = [
    [vehicleConfiguration.model, vehicleConfiguration.trimLabel].filter(Boolean).join(' '),
    motor,
  ].filter(Boolean);

  const packageCount = vehicleConfiguration.selectedPackages?.length ?? 0;
  const extrasCount = (vehicleConfiguration.accessories?.length ?? 0)
    + (vehicleConfiguration.dealerExtras?.length ?? 0);

  return (
    <section className="cn-config-overview" aria-label="Konfigurationsübersicht">
      <div className="cn-config-overview__head">
        {onEdit && (
          <button type="button" className="cn-section-head__edit" onClick={onEdit}>
            <span aria-hidden="true">✎</span> Bearbeiten
          </button>
        )}
      </div>
      <div className="cn-config-overview__tiles">
        <OverviewTile
          icon="🚗"
          title="Fahrzeug"
          lines={vehicleLines.length ? vehicleLines : ['Auswahl offen']}
          complete={Boolean(vehicleConfiguration.trimId)}
        />
        <OverviewTile
          icon="🎨"
          title="Farbe"
          lines={[vehicleConfiguration.colorLabel ?? 'Auswahl offen']}
          complete={Boolean(vehicleConfiguration.colorId)}
        />
        <OverviewTile
          icon="📦"
          title="Pakete"
          lines={[packageCount === 0 ? 'Keine gewählt' : `${packageCount} ausgewählt`]}
          badge={packageCount > 0 ? packageCount : null}
          showCheck={false}
          complete
        />
        <OverviewTile
          icon="⭐"
          title="Extras"
          lines={[extrasCount === 0 ? 'Keine gewählt' : `${extrasCount} ausgewählt`]}
          badge={extrasCount > 0 ? extrasCount : null}
          showCheck={false}
          complete
        />
      </div>
    </section>
  );
}

/** @deprecated Nutze ConfigurationOverviewTiles */
export default function ConfigurationChecklist(props) {
  return <ConfigurationOverviewTiles {...props} />;
}
