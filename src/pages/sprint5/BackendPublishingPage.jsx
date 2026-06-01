import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import PageShell from '../../components/layout/PageShell';
import usePageSeo from '../../hooks/usePageSeo';
import { usePublishedDealerConditions } from '../../context/DealerConditionsContext.jsx';
import ComplianceShieldBanner from '../../components/compliance/ComplianceShieldBanner.jsx';
import ComplianceCopyBlock from '../../components/compliance/ComplianceCopyBlock.jsx';
import { validateVehicleCompliance } from '../../logic/complianceShield.js';
import {
  generatePublishingTexts,
  PUBLISHING_CHANNELS,
  PUBLISHING_VEHICLES,
} from '../../logic/publishingCenter.js';
import './Sprint5Shared.css';
import './BackendPublishingPage.css';

export default function BackendPublishingPage() {
  const { publishedConditions: conditions } = usePublishedDealerConditions();
  const [vehicleId, setVehicleId] = useState(PUBLISHING_VEHICLES[0].id);

  const vehicle = PUBLISHING_VEHICLES.find((v) => v.id === vehicleId) ?? PUBLISHING_VEHICLES[0];

  const vehicleRef = useMemo(() => ({
    engineId: vehicle.defaultConfig.engineId,
    trimId: vehicle.defaultConfig.trimId,
    brand: 'Kia',
    model: 'Sportage',
    label: vehicle.label,
  }), [vehicle]);

  const validation = useMemo(
    () => validateVehicleCompliance(vehicleRef),
    [vehicleRef],
  );

  const publishResult = useMemo(() => {
    if (!validation.publishable) return { texts: null, validation };
    return generatePublishingTexts(vehicle.defaultConfig, conditions);
  }, [vehicle, conditions, validation.publishable]);

  usePageSeo({
    title: 'Publishing Center',
    description: 'Multi-Channel-Inserate mit Compliance-Sperre.',
    path: '/backend/publishing',
  });

  return (
    <PageShell>
      <div className="s5-page pub-page">
        <Link to="/backend" className="s5-header__back">← Backend</Link>
        <p className="s5-header__kicker">Multi-Channel · Compliance Shield</p>
        <h1 className="s5-header__title">Publishing Center</h1>
        <p className="s5-header__sub">
          Copy-Buttons sind gesperrt, bis alle WLTP-Pflichtangaben geprüft sind.
          Bei Freigabe wird der Pflichtblock automatisch angehängt.
        </p>

        <ComplianceShieldBanner validation={validation} />

        <section className="s5-card">
          <h2 className="s5-card__title">Fahrzeug auswählen</h2>
          <div className="pub-vehicles">
            {PUBLISHING_VEHICLES.map((v) => (
              <button
                key={v.id}
                type="button"
                className={`pub-vehicle-btn${vehicleId === v.id ? ' is-active' : ''}`}
                onClick={() => setVehicleId(v.id)}
              >
                {v.label}
              </button>
            ))}
          </div>
        </section>

        {!validation.publishable ? (
          <div className="s5-banner s5-banner--warn">
            Veröffentlichung blockiert: Pflichtangaben fehlen.
            {' '}
            <Link to="/admin/compliance">Compliance Shield öffnen →</Link>
          </div>
        ) : (
          <div className="pub-channels">
            {PUBLISHING_CHANNELS.map((ch) => (
              <section key={ch.id} className="s5-card pub-channel">
                <ComplianceCopyBlock
                  vehicleRef={vehicleRef}
                  validation={validation}
                  label={ch.buttonLabel}
                  text={publishResult.texts?.[ch.id] ?? ''}
                  channelId={ch.id}
                  compact
                />
                <pre className="pub-preview">{publishResult.texts?.[ch.id]}</pre>
              </section>
            ))}
          </div>
        )}
      </div>
    </PageShell>
  );
}
