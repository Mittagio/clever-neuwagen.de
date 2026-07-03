import {
  buildPkwEnVkvCompactLines,
  buildPkwEnVkvDetailLines,
  buildPkwEnVkvLabelBlock,
} from '../../services/vehicle/pkwEnVkvPresentation.js';
import {
  ENVKV_CHANNEL,
  requiresPkwEnVkv,
  buildDefaultNewPassengerCarRef,
} from '../../services/vehicle/requiresPkwEnVkv.js';
import { resolveVehicleEnvironmentalData } from '../../services/vehicle/vehicleEnvironmentalData.js';
import './PkwEnVkvBox.css';

const PUBLIC_PLACEHOLDER = 'Pflichtangaben werden geprüft';

export function PkwEnVkvInternalWarning({
  title = 'CO₂-/Verbrauchsangaben fehlen',
  body = 'Dieses Angebot sollte nicht veröffentlicht oder versendet werden, bis die Pflichtangaben ergänzt sind.',
  actions = null,
  className = '',
}) {
  return (
    <div className={`pkw-envkv-warning ${className}`.trim()} role="alert">
      <p className="pkw-envkv-warning__title">{title}</p>
      <p className="pkw-envkv-warning__body">{body}</p>
      {actions ? <div className="pkw-envkv-warning__actions">{actions}</div> : null}
    </div>
  );
}

export function PkwEnVkvCalculatorStatus({ vehicleRef, draft = null, className = '' }) {
  const ref = buildDefaultNewPassengerCarRef(vehicleRef ?? draft ?? {});
  const required = requiresPkwEnVkv(ref, { channel: ENVKV_CHANNEL.OFFER, paymentType: ref.paymentType });
  const envData = resolveVehicleEnvironmentalData(ref);

  if (!required) return null;

  const ok = envData.publishable;
  return (
    <div
      className={`pkw-envkv-calc-status pkw-envkv-calc-status--${ok ? 'ok' : 'warn'} ${className}`.trim()}
      role="status"
    >
      {ok ? 'CO₂-/Verbrauchsangaben vorhanden' : 'CO₂-/Verbrauchsangaben fehlen – vor Versand ergänzen.'}
    </div>
  );
}

export default function PkwEnVkvBox({
  vehicleRef = null,
  environmentalData: environmentalDataProp = null,
  variant = 'compact',
  audience = 'public',
  channel = ENVKV_CHANNEL.ONLINE,
  className = '',
  showSource = false,
  onMarkExempt = null,
}) {
  const ref = buildDefaultNewPassengerCarRef(vehicleRef ?? {});
  const envData = environmentalDataProp ?? resolveVehicleEnvironmentalData(ref);
  const required = requiresPkwEnVkv(ref, { channel, paymentType: ref.paymentType });

  if (!required) return null;

  const isInternal = audience === 'internal';
  const publishable = Boolean(envData.publishable);

  if (!publishable && !isInternal) {
    return null;
  }

  if (!publishable && isInternal) {
    return (
      <PkwEnVkvInternalWarning
        className={className}
        actions={(
          <>
            <span className="pkw-envkv-warning__hint">Daten ergänzen · Quelle prüfen</span>
            {onMarkExempt ? (
              <button type="button" className="pkw-envkv-warning__action" onClick={onMarkExempt}>
                Als nicht erforderlich markieren (Gebrauchtwagen)
              </button>
            ) : null}
          </>
        )}
      />
    );
  }

  if (variant === 'label') {
    const block = buildPkwEnVkvLabelBlock(envData);
    if (!block) return isInternal ? <p className="pkw-envkv-placeholder">{PUBLIC_PLACEHOLDER}</p> : null;
    return (
      <p className={`pkw-envkv-box pkw-envkv-box--label ${className}`.trim()}>
        {block}
      </p>
    );
  }

  const lines = variant === 'detail'
    ? buildPkwEnVkvDetailLines(envData)
    : buildPkwEnVkvCompactLines(envData);

  if (!lines.length) {
    return isInternal ? <p className="pkw-envkv-placeholder">{PUBLIC_PLACEHOLDER}</p> : null;
  }

  const rootClass = [
    'pkw-envkv-box',
    `pkw-envkv-box--${variant}`,
    className,
  ].filter(Boolean).join(' ');

  if (variant === 'compact') {
    return (
      <div className={rootClass} aria-label="Energieverbrauch und CO₂-Angaben">
        {lines.map((row) => (
          <span key={row.label} className="pkw-envkv-box__chip">
            {row.label}: {row.value}
          </span>
        ))}
      </div>
    );
  }

  return (
    <div className={rootClass} aria-label="Energieverbrauch und CO₂-Angaben">
      <p className="pkw-envkv-box__title">Energieverbrauch & CO₂ (WLTP)</p>
      <dl className="pkw-envkv-box__rows">
        {lines.map((row) => (
          <div key={row.label} className="pkw-envkv-box__row">
            <dt>{row.label}</dt>
            <dd>{row.value}</dd>
          </div>
        ))}
      </dl>
      {showSource && envData.source ? (
        <p className="pkw-envkv-box__source">Quelle: {envData.source}</p>
      ) : null}
    </div>
  );
}
