import { useState } from 'react';
import './discovery-results.css';

const COLORS = [
  { id: 'white', label: 'Weiß' },
  { id: 'gray', label: 'Grau' },
  { id: 'black', label: 'Schwarz' },
];

const PACKAGES = [
  { id: 'winter', label: 'Winterpaket' },
  { id: 'towbar', label: 'Anhängerkupplung' },
  { id: 'panorama', label: 'Panoramadach' },
  { id: 'assist', label: 'Assistenzpaket' },
];

const MOTORS = [
  { id: 'verbrenner', label: 'Benziner' },
  { id: 'hybrid', label: 'Hybrid' },
  { id: 'plugin-hybrid', label: 'Plug-in' },
];

export default function DiscoveryCustomizePanel({ defaultMotor = 'verbrenner', onChange }) {
  const [colorId, setColorId] = useState('white');
  const [packages, setPackages] = useState(['winter']);
  const [motorId, setMotorId] = useState(defaultMotor);

  function update(next) {
    onChange?.(next);
  }

  function setColor(id) {
    setColorId(id);
    update({ colorId: id, packages, motorId });
  }

  function togglePackage(id) {
    const next = packages.includes(id) ? packages.filter((p) => p !== id) : [...packages, id];
    setPackages(next);
    update({ colorId, packages: next, motorId });
  }

  function setMotor(id) {
    setMotorId(id);
    update({ colorId, packages, motorId: id });
  }

  const colorLabel = COLORS.find((c) => c.id === colorId)?.label ?? 'Weiß';
  const packageLabels = PACKAGES.filter((p) => packages.includes(p.id)).map((p) => p.label);
  const motorLabel = MOTORS.find((m) => m.id === motorId)?.label ?? 'Benziner';

  return (
    <section className="disc-customize card" aria-label="Fahrzeug anpassen">
      <h2 className="disc-customize__title">Fahrzeug anpassen</h2>
      <p className="disc-customize__hint">
        Passen Sie Ausstattung an – auf der Angebotsseite wird alles live berechnet.
      </p>

      <div className="disc-customize__block">
        <h3>Farbe</h3>
        <div className="disc-customize__options disc-customize__options--radio">
          {COLORS.map((c) => (
            <button
              key={c.id}
              type="button"
              className={`disc-customize__option${colorId === c.id ? ' is-active' : ''}`}
              onClick={() => setColor(c.id)}
            >
              ○ {c.label}
            </button>
          ))}
        </div>
      </div>

      <div className="disc-customize__block">
        <h3>Pakete</h3>
        <div className="disc-customize__options">
          {PACKAGES.map((p) => (
            <button
              key={p.id}
              type="button"
              className={`disc-customize__option${packages.includes(p.id) ? ' is-active' : ''}`}
              onClick={() => togglePackage(p.id)}
            >
              {packages.includes(p.id) ? '☑' : '☐'} {p.label}
            </button>
          ))}
        </div>
      </div>

      <div className="disc-customize__block">
        <h3>Motor</h3>
        <div className="disc-customize__options disc-customize__options--radio">
          {MOTORS.map((m) => (
            <button
              key={m.id}
              type="button"
              className={`disc-customize__option${motorId === m.id ? ' is-active' : ''}`}
              onClick={() => setMotor(m.id)}
            >
              ○ {m.label}
            </button>
          ))}
        </div>
      </div>

      <p className="disc-customize__preview" aria-live="polite">
        Vorschau: {colorLabel}
        {packageLabels.length ? ` · ${packageLabels.join(', ')}` : ''}
        {' · '}{motorLabel}
      </p>
    </section>
  );
}

export function getCustomizeDefaults() {
  return { colorId: 'white', packages: ['winter'], motorId: 'verbrenner' };
}
