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

function CompactConfigTile({
  title,
  value,
  actionLabel,
  onAction,
  warn = false,
}) {
  return (
    <div className={`cn-config-compact-tile${warn ? ' cn-config-compact-tile--warn' : ''}`}>
      <p className="cn-config-compact-tile__title">{title}</p>
      <p className="cn-config-compact-tile__value">{value}</p>
      {onAction && actionLabel && (
        <button type="button" className="cn-config-compact-tile__action" onClick={onAction}>
          {actionLabel}
        </button>
      )}
    </div>
  );
}

export function ConfigurationOverviewTiles({ vehicleConfiguration, onEdit, compact = false }) {
  if (!vehicleConfiguration) return null;

  const motor = vehicleConfiguration.motorLabel ?? vehicleConfiguration.batteryLabel;
  const vehicleLine = [
    vehicleConfiguration.model,
    vehicleConfiguration.trimLabel,
  ].filter(Boolean).join(' ') || 'Auswahl offen';

  const packageCount = vehicleConfiguration.selectedPackages?.length ?? 0;
  const packageNames = (vehicleConfiguration.selectedPackages ?? [])
    .map((pkg) => pkg.name)
    .filter(Boolean);
  const packageLabel = packageCount === 0
    ? 'Keine Pakete'
    : (packageNames[0] ?? `${packageCount} ausgewählt`);

  const extrasCount = (vehicleConfiguration.accessories?.length ?? 0)
    + (vehicleConfiguration.dealerExtras?.length ?? 0);
  const extrasLabel = extrasCount === 0 ? 'Keine Extras' : `${extrasCount} ausgewählt`;

  if (compact) {
    return (
      <section className="cn-config-overview cn-config-overview--compact" aria-label="Ausstattung">
        <div className="cn-config-compact-grid">
          <CompactConfigTile
            title="Fahrzeug"
            value={vehicleLine}
            actionLabel="Bearbeiten"
            onAction={onEdit}
          />
          <CompactConfigTile
            title="Farbe"
            value={vehicleConfiguration.colorLabel ?? 'Auswahl offen'}
            actionLabel={vehicleConfiguration.colorLabel ? 'ändern' : 'wählen'}
            onAction={onEdit}
            warn={!vehicleConfiguration.colorId}
          />
          <CompactConfigTile
            title="Pakete"
            value={packageLabel}
            actionLabel={packageCount === 0 ? 'hinzufügen' : 'ändern'}
            onAction={onEdit}
          />
          <CompactConfigTile
            title="Extras"
            value={extrasLabel}
            actionLabel={extrasCount === 0 ? 'hinzufügen' : 'ändern'}
            onAction={onEdit}
          />
        </div>
      </section>
    );
  }

  const vehicleLines = [vehicleLine, motor].filter(Boolean);

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
