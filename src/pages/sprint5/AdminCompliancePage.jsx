import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import PageShell from '../../components/layout/PageShell';
import usePageSeo from '../../hooks/usePageSeo';
import { COMPLIANCE_STATUS } from '../../data/complianceSchema.js';
import { listComplianceVehicles } from '../../logic/complianceShield.js';
import ComplianceShieldBanner from '../../components/compliance/ComplianceShieldBanner.jsx';
import { buildAdminEnVkvStatusLabel, resolveVehicleEnvironmentalData } from '../../services/vehicle/vehicleEnvironmentalData.js';
import '../sprint5/Sprint5Shared.css';
import './AdminCompliancePage.css';

const TABS = [
  { id: 'all', label: 'Alle' },
  { id: COMPLIANCE_STATUS.verified, label: '🟢 Geprüft' },
  { id: COMPLIANCE_STATUS.needs_review, label: '🟡 Prüfung nötig' },
  { id: COMPLIANCE_STATUS.missing, label: '🔴 Blockiert' },
];

export default function AdminCompliancePage() {
  const [tab, setTab] = useState('all');
  const vehicles = useMemo(() => listComplianceVehicles(), []);

  const filtered = useMemo(() => {
    if (tab === 'all') return vehicles;
    return vehicles.filter((v) => v.status === tab);
  }, [vehicles, tab]);

  const counts = useMemo(() => ({
    verified: vehicles.filter((v) => v.status === COMPLIANCE_STATUS.verified).length,
    needs_review: vehicles.filter((v) => v.status === COMPLIANCE_STATUS.needs_review).length,
    missing: vehicles.filter((v) => v.status === COMPLIANCE_STATUS.missing).length,
  }), [vehicles]);

  usePageSeo({
    title: 'Compliance Shield',
    description: 'Harte Sperre für WLTP-, Verbrauchs- und CO₂-Pflichtangaben.',
    path: '/admin/compliance',
  });

  return (
    <PageShell className="admin-shell">
      <div className="s5-page compliance-page">
        <Link to="/admin" className="s5-header__back">← Admin</Link>
        <p className="s5-header__kicker">Abmahnschutz · Compliance Shield</p>
        <h1 className="s5-header__title">WLTP / CO₂ Compliance</h1>
        <p className="s5-header__sub">
          Kein Inserat, Angebot oder Social-Media-Text ohne geprüfte Pflichtangaben aus der
          Herstellerdatenbank. Händler können Verbrauchswerte nicht frei eingeben.
        </p>

        <div className="compliance-stats">
          <div className="compliance-stat compliance-stat--ok">
            <span className="compliance-stat__n">{counts.verified}</span>
            <span>Geprüft</span>
          </div>
          <div className="compliance-stat compliance-stat--warn">
            <span className="compliance-stat__n">{counts.needs_review}</span>
            <span>Prüfung nötig</span>
          </div>
          <div className="compliance-stat compliance-stat--bad">
            <span className="compliance-stat__n">{counts.missing}</span>
            <span>Blockiert</span>
          </div>
        </div>

        <div className="compliance-tabs">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              className={`compliance-tab${tab === t.id ? ' is-active' : ''}`}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>

        <ul className="compliance-list">
          {filtered.map((v) => (
            <li key={`${v.engineId}-${v.vehicleLabel}`} className="s5-card compliance-card">
              <p className="compliance-card__envkv-status">
                {buildAdminEnVkvStatusLabel(resolveVehicleEnvironmentalData({ engineId: v.engineId, label: v.vehicleLabel }))}
              </p>
              <ComplianceShieldBanner validation={v} showFields />
              <dl className="compliance-values">
                {Object.entries(v.values ?? {}).map(([key, val]) => (
                  <div key={key} className="compliance-values__row">
                    <dt>{key}</dt>
                    <dd>{val ?? '–'}</dd>
                  </div>
                ))}
              </dl>
            </li>
          ))}
        </ul>

        {filtered.length === 0 && (
          <p className="compliance-empty">Keine Fahrzeuge in dieser Kategorie.</p>
        )}
      </div>
    </PageShell>
  );
}
