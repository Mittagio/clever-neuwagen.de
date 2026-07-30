import CustomerAkteVehicleTracks from './CustomerAkteVehicleTracks.jsx';
import CustomerAkteGoldenMomentCard from './CustomerAkteGoldenMomentCard.jsx';

/**
 * Desktop-Assist-Rail – Golden Moment + optional Fahrzeugspuren.
 * Rate dominant, filigran; kein %-Kaufscore.
 * Wenn Spuren links im Context stehen: showTracks=false (kein Golden-Duplikat links).
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
  showTracks = true,
}) {
  const count = tracks.length || boardItems.length;

  return (
    <aside className="cust-akte-offer-rail cust-akte-assist-rail" aria-label="Clever Assist">
      <header className="cust-akte-offer-rail__head">
        <p className="cust-akte-offer-rail__label">Clever</p>
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

      {showTracks && tracks.length > 0 ? (
        <CustomerAkteVehicleTracks
          tracks={tracks}
          title="Spuren"
          compact
          onOpenTrack={onOpenTrack}
          onResumeTrack={onResumeTrack}
        />
      ) : null}

      {!goldenMoment && (showTracks ? tracks.length === 0 : count === 0) ? (
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
      ) : null}
    </aside>
  );
}
