import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import PageShell from '../../components/layout/PageShell';
import usePageSeo from '../../hooks/usePageSeo';
import {
  COMPLIANCE_REQUIRED_FIELDS,
  listComplianceVehicles,
} from '../../logic/complianceShield.js';
import './Sprint5Shared.css';
import './AdminCompliancePage.css';

export default function AdminCompliancePage() {
  const vehicles = useMemo(() => listComplianceVehicles(), []);

  usePageSeo({
    title: 'Compliance Shield',
    description: 'WLTP- und CO₂-Pflichtangaben aus Herstellerdaten – Veröffentlichung blockiert bei Lücken.',
    path: '/admin/compliance',
  });

  return (
    <PageShell className="admin-shell">
      <div className="s5-page compliance-page">
        <Link to="/admin" className="s5-header__back">← Admin</Link>
        <p className="s5-header__kicker">Abmahnschutz</p>
        <h1 className="s5-header__title">Compliance Shield</h1>
        <p className="s5-header__sub">
          Pflichtangaben kommen ausschließlich aus Herstellerdatenbank, Preisliste und Import –
          Verkäufer können diese Werte nicht frei eintippen.
        </p>

        <div className="s5-banner s5-banner--info">
          Pflichtfelder: {COMPLIANCE_REQUIRED_FIELDS.map((f) => f.label).join(' · ')}
        </div>

        <ul className="compliance-list">
          {vehicles.map((v) => (
            <li key={v.engineId} className="s5-card compliance-card">
              <div className="compliance-card__head">
                <div>
                  <h2 className="s5-card__title">{v.vehicleLabel}</h2>
                  <p className="compliance-card__engine">{v.engineName}</p>
                </div>
                <div className="compliance-card__score" data-blocked={v.publishBlocked}>
                  <span className="compliance-card__score-value">{v.score} %</span>
                  <span className="compliance-card__score-label">
                    {v.statusEmoji} {v.statusLabel}
                  </span>
                </div>
              </div>

              {v.publishBlocked && (
                <div className="s5-banner s5-banner--warn compliance-card__warn">
                  Pflichtangaben fehlen – Veröffentlichung blockiert
                </div>
              )}

              <dl className="compliance-values">
                {COMPLIANCE_REQUIRED_FIELDS.map((field) => (
                  <div key={field.id} className="compliance-values__row">
                    <dt>{field.label}</dt>
                    <dd>{v.values[field.id] ?? '–'}</dd>
                  </div>
                ))}
              </dl>

              {v.missingFields.length > 0 && (
                <p className="compliance-card__missing">
                  Fehlend: {v.missingFields.map((f) => f.label).join(', ')}
                </p>
              )}
            </li>
          ))}
        </ul>
      </div>
    </PageShell>
  );
}
