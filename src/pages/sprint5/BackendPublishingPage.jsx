import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import PageShell from '../../components/layout/PageShell';
import usePageSeo from '../../hooks/usePageSeo';
import { usePublishedDealerConditions } from '../../context/DealerConditionsContext.jsx';
import CopyBlock from '../../components/listing/CopyBlock.jsx';
import {
  evaluateVehicleCompliance,
} from '../../logic/complianceShield.js';
import {
  generatePublishingTexts,
  PUBLISHING_CHANNELS,
  PUBLISHING_VEHICLES,
} from '../../logic/publishingCenter.js';
import { auditVehiclePublished } from '../../services/sprint5Audit.js';
import './Sprint5Shared.css';
import './BackendPublishingPage.css';

export default function BackendPublishingPage() {
  const { publishedConditions: conditions } = usePublishedDealerConditions();
  const [vehicleId, setVehicleId] = useState(PUBLISHING_VEHICLES[0].id);

  const vehicle = PUBLISHING_VEHICLES.find((v) => v.id === vehicleId) ?? PUBLISHING_VEHICLES[0];

  const compliance = useMemo(
    () => evaluateVehicleCompliance({
      vehicleLabel: vehicle.label,
      engineId: vehicle.defaultConfig.engineId,
    }),
    [vehicle],
  );

  const texts = useMemo(() => {
    if (compliance.publishBlocked) return null;
    return generatePublishingTexts(vehicle.defaultConfig, conditions);
  }, [vehicle, conditions, compliance.publishBlocked]);

  usePageSeo({
    title: 'Publishing Center',
    description: 'Inserate für mobile.de, Leasingmarkt, Social Media und E-Mail generieren.',
    path: '/backend/publishing',
  });

  function handlePublished() {
    if (!compliance.publishBlocked) {
      auditVehiclePublished(vehicle.label);
    }
  }

  return (
    <PageShell>
      <div className="s5-page pub-page">
        <Link to="/backend" className="s5-header__back">← Backend</Link>
        <p className="s5-header__kicker">Multi-Channel</p>
        <h1 className="s5-header__title">Publishing Center</h1>
        <p className="s5-header__sub">
          Ein Fahrzeug erfassen – Texte für alle Kanäle automatisch erzeugen und kopieren.
        </p>

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
          <p className="pub-compliance">
            Compliance: <strong>{compliance.score} %</strong> · {compliance.statusEmoji} {compliance.statusLabel}
          </p>
        </section>

        {compliance.publishBlocked ? (
          <div className="s5-banner s5-banner--warn">
            Pflichtangaben fehlen – Veröffentlichung blockiert. Bitte zuerst{' '}
            <Link to="/admin/compliance">Compliance Shield</Link> prüfen.
          </div>
        ) : (
          <div className="pub-channels">
            {PUBLISHING_CHANNELS.map((ch) => (
              <section key={ch.id} className="s5-card pub-channel">
                <div className="pub-channel__head">
                  <h3 className="s5-card__title">{ch.icon} {ch.label}</h3>
                  <CopyBlock
                    label={ch.buttonLabel}
                    text={texts[ch.id]}
                    compact
                    onCopied={handlePublished}
                  />
                </div>
                <pre className="pub-preview">{texts[ch.id]}</pre>
              </section>
            ))}
          </div>
        )}
      </div>
    </PageShell>
  );
}
