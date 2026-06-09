import { useMemo } from 'react';
import { evaluateVehicleAgainstProfile } from '../../services/search/vehicleFeatureRuleEngine.js';
import { computeWeightedWishPercent, modelCheckLabel } from '../../services/search/profileWishScore.js';
import '../cleverQuote/cleverQuote.css';
import './dealer-landing.css';

function statusIcon(status) {
  if (status === 'fulfilled') return { icon: '✓', className: 'dl-wish-checklist__item--ok' };
  if (status === 'package') return { icon: '○', className: 'dl-wish-checklist__item--pkg' };
  return { icon: '✗', className: 'dl-wish-checklist__item--no' };
}

function profileHasChecks(profile) {
  if (!profile) return false;
  return Boolean(
    profile.fuel
    || profile.minRangeKm
    || profile.rangeKmMin
    || profile.seatsMin
    || (profile.requiredFeatures?.length > 0),
  );
}

/**
 * Zeigt pro Modell/Trim die Rule-Engine-Prüfung (✓ / Paket / ✗).
 */
export default function WishFeatureChecklist({
  profile,
  match,
  checks = null,
  percent = null,
  modelLabel = null,
  title = 'Ihre Wünsche – geprüft',
  compact = false,
}) {
  const evaluation = useMemo(() => {
    if (checks?.length) {
      const pct = percent ?? computeWeightedWishPercent(checks);
      return { checks, cleverQuotePercent: pct, model: modelLabel, trim: null };
    }
    if (!profileHasChecks(profile) || !match?.vehicle) return null;
    const result = evaluateVehicleAgainstProfile(profile, match.vehicle);
    return {
      ...result,
      cleverQuotePercent: computeWeightedWishPercent(result.checks),
    };
  }, [profile, match, checks, percent, modelLabel]);

  if (!evaluation?.checks?.length) return null;

  const showTrimLine = evaluation.trim && !compact;

  return (
    <div className="dl-wish-checklist" aria-label="Ausstattungsprüfung">
      <p className="dl-wish-checklist__title">{title}</p>
      {showTrimLine && (
        <p className="dl-wish-checklist__trim">
          {evaluation.model} {evaluation.trim}
          {evaluation.cleverQuotePercent != null && (
            <span className="dl-wish-checklist__pct">{evaluation.cleverQuotePercent} % CleverQuote</span>
          )}
        </p>
      )}
      <ul className="dl-wish-checklist__list">
        {evaluation.checks.map((check) => {
          const { icon, className } = statusIcon(check.status);
          const label = modelLabel && !showTrimLine ? modelCheckLabel(check) : check.label;
          return (
            <li key={`${check.id}-${check.label}`} className={`dl-wish-checklist__item ${className}`}>
              <span className="dl-wish-checklist__icon" aria-hidden>{icon}</span>
              <span className="dl-wish-checklist__label">{label}</span>
              {check.status === 'package' && showTrimLine && (
                <span className="dl-wish-checklist__hint">Paket</span>
              )}
              {check.detail && check.status === 'fulfilled' && (
                <span className="dl-wish-checklist__hint">{check.detail}</span>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
