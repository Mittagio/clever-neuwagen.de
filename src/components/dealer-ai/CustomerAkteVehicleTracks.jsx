import {
  VEHICLE_TRACK_STATUS,
  filterTracksByStatus,
} from '../../services/crm/vehicleTrack.js';
import './CustomerAkteVehicleTracks.css';

function formatRate(value) {
  if (value == null || !Number.isFinite(Number(value))) return null;
  return `${Number(value).toLocaleString('de-DE')} €`;
}

function formatConditions(track) {
  const parts = [];
  if (track.termMonths != null) parts.push(`${track.termMonths} M`);
  if (track.annualMileage != null) {
    parts.push(`${Number(track.annualMileage).toLocaleString('de-DE')} km`);
  }
  if (track.downPayment != null) {
    parts.push(`${Number(track.downPayment).toLocaleString('de-DE')} € AZ`);
  }
  return parts.join(' · ');
}

function offerStatusLine(track) {
  if (track.status === VEHICLE_TRACK_STATUS.DEFERRED && track.rejectionReasonLabel) {
    return `Grund: ${track.rejectionReasonLabel}`;
  }
  if (track.openedAt) return 'Kunde hat geöffnet';
  if (track.sentAt || track.offerStatus === 'sent' || track.offerStatus === 'opened') {
    return 'Gesendet';
  }
  if (track.offerStatus === 'prepared') {
    return 'Vorbereitet';
  }
  if (track.offerStatus === 'draft' || track.offerStatus === 'pdf_uploaded') {
    return 'Entwurf';
  }
  return null;
}

const FILTER_OPTIONS = [
  { id: 'all', label: 'Alle' },
  { id: 'active', label: 'Aktiv' },
  { id: 'deferred', label: 'Zurückgestellt' },
];

/**
 * Vertikale Fahrzeugspuren – Mockup Clever-Hauptseite / Angebote-Tab.
 * Rate dominant, Status-Badge, Favorit leicht hervorgehoben, Deferred grau.
 */
export default function CustomerAkteVehicleTracks({
  tracks = [],
  title = 'Angebote',
  onOpenTrack = null,
  onResumeTrack = null,
  filter = 'all',
  showFilters = false,
  onFilterChange = null,
  emptyLabel = null,
  compact = false,
}) {
  const filtered = filterTracksByStatus(tracks, filter);

  if (!filtered.length && !showFilters) return null;

  return (
    <section className={`vt-list${compact ? ' vt-list--compact' : ''}`} aria-label={title}>
      <header className="vt-list__head">
        <h2 className="vt-list__title">{title}</h2>
      </header>

      {showFilters ? (
        <div className="vt-list__filters" role="tablist" aria-label="Angebote filtern">
          {FILTER_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              type="button"
              role="tab"
              aria-selected={filter === opt.id}
              className={[
                'vt-list__filter',
                filter === opt.id ? 'vt-list__filter--active' : '',
              ].filter(Boolean).join(' ')}
              onClick={() => onFilterChange?.(opt.id)}
            >
              {opt.label}
            </button>
          ))}
        </div>
      ) : null}

      {!filtered.length ? (
        emptyLabel ? (
          <p className="vt-list__empty">{emptyLabel}</p>
        ) : null
      ) : (
        <ul className="vt-list__items">
          {filtered.map((track) => {
            const rate = formatRate(track.monthlyRate);
            const conditions = formatConditions(track);
            const statusLine = offerStatusLine(track);
            const isFavorite = track.status === VEHICLE_TRACK_STATUS.FAVORITE;
            const isDeferred = track.status === VEHICLE_TRACK_STATUS.DEFERRED;

            return (
              <li key={track.id}>
                <article
                  className={[
                    'vt-card',
                    isFavorite ? 'vt-card--favorite' : '',
                    isDeferred ? 'vt-card--deferred' : '',
                  ].filter(Boolean).join(' ')}
                >
                  <div className="vt-card__top">
                    <h3 className="vt-card__name">{track.modelLabel}</h3>
                    <span className={`vt-card__badge vt-card__badge--${track.statusTone}`}>
                      {track.statusLabel}
                    </span>
                  </div>

                  {rate ? (
                    <p className="vt-card__rate">
                      <span className="vt-card__rate-value">{rate}</span>
                      <span className="vt-card__rate-suffix">/Monat</span>
                    </p>
                  ) : null}

                  {conditions && !isDeferred ? (
                    <p className="vt-card__conditions">{conditions}</p>
                  ) : null}

                  {track.requirementLabels?.length > 0 && isFavorite ? (
                    <p className="vt-card__wishes">
                      {track.requirementLabels.join(' · ')}
                    </p>
                  ) : null}

                  {statusLine ? (
                    <p className="vt-card__status">{statusLine}</p>
                  ) : null}

                  <div className="vt-card__actions">
                    {isDeferred ? (
                      <button
                        type="button"
                        className="vt-card__action vt-card__action--ghost"
                        onClick={() => onResumeTrack?.(track)}
                      >
                        Wieder aufnehmen
                      </button>
                    ) : null}
                    <button
                      type="button"
                      className="vt-card__action"
                      onClick={() => onOpenTrack?.(track)}
                    >
                      Öffnen
                      <span aria-hidden> ›</span>
                    </button>
                  </div>
                </article>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
