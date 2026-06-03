import { useMemo, useState } from 'react';
import { getFeatureLabel } from '../../data/features/featureCatalog.js';
import { getWishBuilderChips } from '../../services/configuration/featureResolver.js';
import WishFeatureChip from './WishFeatureChip.jsx';
import '../vehicle-detail/vehicle-detail.css';

function WishChecklistRow({ label, status, statusLabel, onRemove }) {
  return (
    <div className={`vd-wish-check vd-wish-check--${status}`}>
      <span className="vd-wish-check__mark" aria-hidden>
        {status === 'standard' || status === 'fulfilled' ? '✓' : '☑'}
      </span>
      <span className="vd-wish-check__label">{label}</span>
      {statusLabel && <span className="vd-wish-check__badge">{statusLabel}</span>}
      {onRemove && (
        <button type="button" className="vd-wish-check__remove" onClick={onRemove} aria-label={`${label} entfernen`}>
          ×
        </button>
      )}
    </div>
  );
}

export default function WishBuilderCard({
  vehicle,
  selection,
  recommendationResult,
  fulfillment,
  onToggleFeature,
  onShowMore,
}) {
  const [showAll, setShowAll] = useState(false);
  const { grouped, visibleIds } = useMemo(
    () => getWishBuilderChips(vehicle.brand, vehicle.model, 8),
    [vehicle.brand, vehicle.model],
  );

  function chipStatus(featureId) {
    const included = recommendationResult?.includedFeatures?.find((f) => f.id === featureId);
    if (included) return 'standard';
    if (selection.selectedFeatures.includes(featureId)) {
      const pkg = recommendationResult?.requiredPackages?.find((p) =>
        p.features.some((f) => f.id === featureId && f.reason === 'requested'),
      );
      if (pkg && selection.selectedPackages?.includes(pkg.id)) return 'standard';
      if (pkg) return 'package';
      return 'requested';
    }
    return 'open';
  }

  function statusLabel(featureId, status) {
    if (status === 'standard') return 'SERIENMÄSSIG';
    if (status === 'package') return 'PAKET NÖTIG';
    if (status === 'requested') return 'IHR WUNSCH';
    return null;
  }

  const selectedRows = selection.selectedFeatures.map((id) => {
    const status = chipStatus(id);
    return {
      id,
      label: getFeatureLabel(id),
      status: status === 'standard' ? 'standard' : status === 'package' ? 'package' : 'requested',
      statusLabel: statusLabel(id, status),
    };
  });

  const displayGroups = showAll
    ? grouped
    : grouped.map((g) => ({
      ...g,
      features: g.features.filter((f) => visibleIds.includes(f.id)).slice(0, 3),
    })).filter((g) => g.features.length > 0);

  return (
    <section className="vd-wish vd-wish--embedded vd-wish--advisor" id="vd-wish-builder" aria-label="Wunschauto bauen">
      <div className="vd-wish__intro">
        <h2 className="vd-wish__title">
          <span className="vd-wish__sparkle" aria-hidden>✨</span>
          Wunschauto bauen
        </h2>
        <p className="vd-wish__question">
          Wählen Sie Wünsche – Clever-Neuwagen findet Ausstattung, Pakete und den besten Preis.
        </p>
      </div>

      {selectedRows.length > 0 && (
        <div className="vd-wish__checklist" aria-label="Ihre Wünsche">
          {selectedRows.map((row) => (
            <WishChecklistRow
              key={row.id}
              label={row.label}
              status={row.status}
              statusLabel={row.statusLabel}
              onRemove={() => onToggleFeature(row.id)}
            />
          ))}
        </div>
      )}

      {displayGroups.map((group) => (
        <div key={group.id} className="vd-wish__group">
          <p className="vd-wish__group-label">{group.label}</p>
          <div className="vd-wish__chips">
            {group.features.map((feature) => (
              <WishFeatureChip
                key={feature.id}
                featureId={feature.id}
                label={feature.label ?? getFeatureLabel(feature.id)}
                status={chipStatus(feature.id)}
                onClick={() => onToggleFeature(feature.id)}
              />
            ))}
          </div>
        </div>
      ))}

      {!showAll && (
        <button type="button" className="vd-wish__more" onClick={() => { setShowAll(true); onShowMore?.(); }}>
          Weitere Wünsche anzeigen
        </button>
      )}
    </section>
  );
}
