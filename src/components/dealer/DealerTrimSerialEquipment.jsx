import { useState } from 'react';
import './dealer-landing.css';

/**
 * Phase 4 – Serienausstattung (erst nach Trim-Empfehlung, aufklappbar).
 */
export default function DealerTrimSerialEquipment({ sections = [] }) {
  const [open, setOpen] = useState(false);

  if (!sections.length) return null;

  return (
    <section className="dl-serial-equip" aria-labelledby="dl-serial-equip-title">
      <button
        type="button"
        className="dl-serial-equip__toggle"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        {open ? 'Serienausstattung ausblenden' : 'Serienausstattung anzeigen'}
      </button>

      {open && (
        <div className="dl-serial-equip__body">
          <h3 id="dl-serial-equip-title" className="dl-serial-equip__title">
            Bereits in der Serie enthalten
          </h3>
          {sections.map((section) => (
            <div key={section.title} className="dl-serial-equip__group">
              <h4 className="dl-serial-equip__group-title">{section.title}</h4>
              <ul className="dl-serial-equip__list">
                {section.items.map((item) => (
                  <li key={item}>
                    <span aria-hidden>✓</span>
                    {' '}
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
