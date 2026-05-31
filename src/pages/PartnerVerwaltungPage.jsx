import { Link } from 'react-router-dom';
import { useVoucherPartners } from '../context/VoucherPartnersContext.jsx';
import { DRIVE_TYPES, PARTNER_TYPES } from '../data/voucherPartners.js';
import './PartnerVerwaltungPage.css';

export default function PartnerVerwaltungPage() {
  const { partners, updatePartner, toggleAssignment, toggleActive, resetToDefaults } = useVoucherPartners();

  const fuelPartners = partners.filter((p) => p.type === 'fuel');
  const chargingPartners = partners.filter((p) => p.type === 'charging');

  return (
    <div className="pv-page">
      <header className="pv-header">
        <Link to="/backend" className="pv-back">←</Link>
        <div>
          <h1 className="pv-title">Partnerverwaltung</h1>
          <p className="pv-sub">Tankstellen & Ladekarten · Gutscheine bei Auslieferung</p>
        </div>
        <button type="button" className="pv-reset" onClick={resetToDefaults}>
          Zurücksetzen
        </button>
      </header>

      <main className="pv-main">
        <section className="pv-section">
          <h2 className="pv-section-title">⛽ Tankstellenpartner</h2>
          <div className="pv-grid">
            {fuelPartners.map((partner) => (
              <PartnerCard
                key={partner.id}
                partner={partner}
                onUpdate={updatePartner}
                onToggleAssignment={toggleAssignment}
                onToggleActive={toggleActive}
              />
            ))}
          </div>
        </section>

        <section className="pv-section">
          <h2 className="pv-section-title">⚡ Ladekartenanbieter</h2>
          <div className="pv-grid">
            {chargingPartners.map((partner) => (
              <PartnerCard
                key={partner.id}
                partner={partner}
                onUpdate={updatePartner}
                onToggleAssignment={toggleAssignment}
                onToggleActive={toggleActive}
              />
            ))}
          </div>
        </section>

        <aside className="pv-info card">
          <h3>Kundenauswahl</h3>
          <p>
            Alle aktiven Tankstellen und Ladebetreiber stehen dem Kunden als
            Geschenk-Optionen zur Verfügung. Nach bestätigter Auslieferung wählt
            der Kunde selbst einen Gutschein aus.
          </p>
          <ul>
            <li><strong>{fuelPartners.length}</strong> Tankstellenpartner</li>
            <li><strong>{chargingPartners.length}</strong> Ladebetreiber</li>
            <li>Kunde wählt <strong>einen</strong> Gutschein seiner Wahl</li>
          </ul>
        </aside>
      </main>
    </div>
  );
}

function PartnerCard({ partner, onUpdate, onToggleAssignment, onToggleActive }) {
  const typeLabel = PARTNER_TYPES[partner.type]?.label ?? partner.type;

  return (
    <article className={`pv-card${partner.active ? '' : ' pv-card--off'}`}>
      <header className="pv-card__head">
        <div>
          <h3 className="pv-card__name">{partner.name}</h3>
          <span className="pv-card__type">{typeLabel}</span>
        </div>
        <button
          type="button"
          className={`pv-toggle${partner.active ? ' is-on' : ''}`}
          onClick={() => onToggleActive(partner.id)}
        >
          {partner.active ? 'Aktiv' : 'Inaktiv'}
        </button>
      </header>

      <div className="pv-fields">
        <label>
          Gutscheinwert (€)
          <input
            type="number"
            min={0}
            step={5}
            value={partner.voucherValue}
            onChange={(e) => onUpdate(partner.id, { voucherValue: Number(e.target.value) || 0 })}
          />
        </label>
        <label>
          Gültigkeit
          <input
            type="text"
            value={partner.validityLabel}
            onChange={(e) => onUpdate(partner.id, { validityLabel: e.target.value })}
            placeholder="90 Tage"
          />
        </label>
        <label className="pv-fields__full">
          Aktionscode
          <input
            type="text"
            value={partner.promoCode}
            onChange={(e) => onUpdate(partner.id, { promoCode: e.target.value })}
            placeholder="PARTNER-CODE"
          />
        </label>
      </div>

      <div className="pv-assign">
        <span className="pv-assign__label">Zuordnung</span>
        <div className="pv-assign__chips">
          {Object.values(DRIVE_TYPES).map((dt) => (
            <button
              key={dt.id}
              type="button"
              className={`pv-chip${partner.assignment.includes(dt.id) ? ' is-on' : ''}`}
              onClick={() => onToggleAssignment(partner.id, dt.id)}
            >
              {dt.label}
            </button>
          ))}
        </div>
      </div>
    </article>
  );
}
