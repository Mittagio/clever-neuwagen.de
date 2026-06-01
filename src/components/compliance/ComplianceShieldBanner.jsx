import { validateVehicleCompliance } from '../../logic/complianceShield.js';
import './ComplianceShieldBanner.css';

export default function ComplianceShieldBanner({
  vehicleRef,
  validation: validationProp,
  compact = false,
  showFields = !compact,
}) {
  const validation = validationProp ?? validateVehicleCompliance(vehicleRef ?? {});

  return (
    <div
      className={`compliance-banner compliance-banner--${validation.status}${compact ? ' compliance-banner--compact' : ''}`}
      role="status"
    >
      <div className="compliance-banner__head">
        <span className="compliance-banner__score">{validation.score} %</span>
        <span className="compliance-banner__status">
          {validation.statusEmoji} {validation.statusLabel}
        </span>
      </div>

      {!validation.publishable && (
        <p className="compliance-banner__block-msg">
          {validation.blockedCopyMessage}
        </p>
      )}

      {showFields && (
        <dl className="compliance-banner__meta">
          <div>
            <dt>Quelle</dt>
            <dd>{validation.source}</dd>
          </div>
          <div>
            <dt>Geprüft</dt>
            <dd>
              {validation.verifiedBy !== '–'
                ? `${validation.verifiedBy} · ${validation.verifiedAt}`
                : 'Noch nicht freigegeben'}
            </dd>
          </div>
          <div>
            <dt>Antrieb</dt>
            <dd>{validation.powertrain?.toUpperCase()}</dd>
          </div>
        </dl>
      )}

      {validation.missingFields?.length > 0 && (
        <p className="compliance-banner__missing">
          Fehlend: {validation.missingFields.map((f) => f.label).join(', ')}
        </p>
      )}

      {validation.warnings?.length > 0 && (
        <ul className="compliance-banner__warnings">
          {validation.warnings.map((w) => (
            <li key={w}>{w}</li>
          ))}
        </ul>
      )}

      {validation.publishable && validation.requiredLegalBlock && !compact && (
        <p className="compliance-banner__legal">
          <strong>Pflichtblock:</strong> {validation.requiredLegalBlock}
        </p>
      )}
    </div>
  );
}
