/**
 * Kompakte Fahrzeug-Zusammenfassung ohne Preise.
 */
export function buildConfigurationItems(vehicleConfiguration) {
  if (!vehicleConfiguration) return [];

  const items = [];
  if (vehicleConfiguration.model) items.push(vehicleConfiguration.model);
  if (vehicleConfiguration.trimLabel) items.push(vehicleConfiguration.trimLabel);
  const motor = vehicleConfiguration.motorLabel ?? vehicleConfiguration.batteryLabel;
  if (motor) items.push(motor);
  if (vehicleConfiguration.colorLabel) items.push(vehicleConfiguration.colorLabel);

  for (const pkg of vehicleConfiguration.selectedPackages ?? []) {
    items.push(pkg.name);
  }
  for (const acc of vehicleConfiguration.accessories ?? []) {
    items.push(acc.name);
  }
  for (const extra of vehicleConfiguration.dealerExtras ?? []) {
    items.push(extra.name);
  }

  return items;
}

export function buildHeroSubtitle(vehicleConfiguration) {
  const parts = [];
  if (vehicleConfiguration?.colorLabel) parts.push(vehicleConfiguration.colorLabel);
  for (const pkg of vehicleConfiguration?.selectedPackages ?? []) {
    parts.push(pkg.name);
  }
  for (const acc of vehicleConfiguration?.accessories ?? []) {
    parts.push(acc.name);
  }
  return parts.join(' · ');
}

export default function ConfigurationChecklist({ vehicleConfiguration }) {
  const items = buildConfigurationItems(vehicleConfiguration);
  if (!items.length) return null;

  return (
    <section className="dai-cond-config-list" aria-label="Konfiguration">
      <h3 className="dai-cond-config-list__title">Konfiguration</h3>
      <ul className="dai-cond-config-list__items">
        {items.map((item) => (
          <li key={item} className="dai-cond-config-list__item">
            <span className="dai-cond-config-list__check" aria-hidden="true">✓</span>
            {item}
          </li>
        ))}
      </ul>
    </section>
  );
}
