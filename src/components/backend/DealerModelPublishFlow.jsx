import { useMemo, useState } from 'react';
import DealerModelCustomerPreview from './DealerModelCustomerPreview.jsx';
import DealerConditionStatusBadge from './DealerConditionStatusBadge.jsx';
import { validateModelForPublish } from '../../services/dealer/dealerPublishValidation.js';
import { canPublishConditions } from '../../services/dealer/dealerConditionPermissions.js';
import './DealerVehicleManagement.css';

export default function DealerModelPublishFlow({
  model,
  conditions,
  userRole = 'dealerAdmin',
  onBack,
  onPublish,
}) {
  const [confirmedWarnings, setConfirmedWarnings] = useState(false);
  const validation = useMemo(
    () => validateModelForPublish(conditions, model),
    [conditions, model],
  );
  const mayPublish = canPublishConditions(userRole);
  const hasCriticalWarnings = validation.warnings.some((w) => w.requiresConfirmation);
  const canConfirm = validation.canPublish
    && mayPublish
    && (!hasCriticalWarnings || confirmedWarnings);

  return (
    <div className="dvm-conditions dvm-publish-flow">
      <button type="button" className="dvm-back" onClick={onBack}>
        ← {model.name}
      </button>

      <header className="dvm-conditions__head">
        <h2 className="dvm-conditions__title">Veröffentlichen</h2>
        <p className="dvm-conditions__sub">
          Prüfung, Vorschau und Freigabe für die Kunden-Landingpage
        </p>
      </header>

      {!mayPublish && (
        <p className="dvm-publish-flow__role-hint">
          Nur Verkaufsleitung darf veröffentlichen. Ihre Änderungen bleiben als Entwurf gespeichert.
        </p>
      )}

      <section className="dvm-publish-checklist">
        <h3 className="dvm-publish-checklist__title">Pflichtprüfung</h3>
        {validation.issues.length === 0 ? (
          <p className="dvm-publish-checklist__ok">✓ Alle Pflichtfelder gepflegt</p>
        ) : (
          <ul className="dvm-publish-checklist__issues">
            {validation.issues.map((issue) => (
              <li key={issue.id} className="dvm-publish-checklist__issue">
                <DealerConditionStatusBadge status="incomplete" />
                <span>{issue.label}</span>
              </li>
            ))}
          </ul>
        )}

        {validation.warnings.length > 0 && (
          <ul className="dvm-publish-checklist__warnings">
            {validation.warnings.map((warning) => (
              <li key={warning.id} className="dvm-publish-checklist__warning">
                <DealerConditionStatusBadge status="draft" label="Hinweis" />
                <span>{warning.label}</span>
              </li>
            ))}
          </ul>
        )}

        {hasCriticalWarnings && (
          <label className="dvm-toggle dvm-toggle--large dvm-publish-confirm">
            <input
              type="checkbox"
              checked={confirmedWarnings}
              onChange={(e) => setConfirmedWarnings(e.target.checked)}
            />
            <span>Ich habe die Warnungen geprüft und möchte trotzdem veröffentlichen</span>
          </label>
        )}
      </section>

      <DealerModelCustomerPreview model={model} conditions={conditions} />

      <div className="dvm-wizard-actions dvm-publish-flow__actions">
        <button
          type="button"
          className="dvm-wizard-actions__primary"
          disabled={!canConfirm}
          onClick={() => onPublish?.()}
        >
          Jetzt veröffentlichen
        </button>
        <button type="button" className="dvm-wizard-actions__ghost" onClick={onBack}>
          Weiter bearbeiten
        </button>
      </div>
    </div>
  );
}
