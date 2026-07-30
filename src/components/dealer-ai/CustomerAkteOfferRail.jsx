import CustomerAkteVehicleTracks from './CustomerAkteVehicleTracks.jsx';
import CustomerAkteGoldenMomentCard from './CustomerAkteGoldenMomentCard.jsx';

/**
 * Desktop-Assist-Rail – alle Fahrzeugspuren vertikal + Golden Moment.
 * Rate dominant, filigran; kein %-Kaufscore.
 */
export default function CustomerAkteOfferRail({
  tracks = [],
  goldenMoment = null,
  boardItems = [],
  onOpenBoard = null,
  onOpenTrack = null,
  onResumeTrack = null,
  onGoldenPrimary = null,
  onGoldenSecondary = null,
}) {
  const count = tracks.length || boardItems.length;

  return (
    <aside className="cust-akte-offer-rail cust-akte-assist-rail" aria-label="Angebote">
      <header className="cust-akte-offer-rail__head">
        <p className="cust-akte-offer-rail__label">Angebote</p>
        {count > 0 ? (
          <button
            type="button"
            className="cust-akte-offer-rail__all"
            onClick={() => onOpenBoard?.()}
          >
            {count > 1 ? `Alle (${count})` : 'Board'}
          </button>
        ) : null}
      </header>

      {goldenMoment ? (
        <div className="cust-akte-offer-rail__moment">
          <CustomerAkteGoldenMomentCard
            moment={goldenMoment}
            onPrimary={onGoldenPrimary}
            onSecondary={onGoldenSecondary}
          />
        </div>
      ) : null}

      {tracks.length > 0 ? (
        <CustomerAkteVehicleTracks
          tracks={tracks}
          title="Spuren"
          compact
          onOpenTrack={onOpenTrack}
          onResumeTrack={onResumeTrack}
        />
      ) : (
        <div className="cust-akte-offer-rail__empty">
          <p>Noch kein Angebot auf dem Tisch.</p>
          <button
            type="button"
            className="cust-akte-offer-rail__open"
            onClick={() => onOpenBoard?.()}
          >
            Angebot anlegen
          </button>
        </div>
      )}
    </aside>
  );
}
