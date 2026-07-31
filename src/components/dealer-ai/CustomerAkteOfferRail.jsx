import CustomerAkteVehicleTracks from './CustomerAkteVehicleTracks.jsx';
import CustomerAkteGoldenMomentCard from './CustomerAkteGoldenMomentCard.jsx';
import CustomerAkteOfferSelectionBar from './CustomerAkteOfferSelectionBar.jsx';

/**
 * Desktop-Assist-Rail – Golden Moment + Fahrzeugspuren als Angebotsgedächtnis.
 * Klick auf Spur = Composer-Kontext + eine Angebots-Mail vorbereiten; „Öffnen“ = Details/PDF.
 */
export default function CustomerAkteOfferRail({
  tracks = [],
  goldenMoment = null,
  boardItems = [],
  onOpenBoard = null,
  onOpenTrack = null,
  onSelectTrack = null,
  onResumeTrack = null,
  onGoldenPrimary = null,
  onGoldenSecondary = null,
  selectedTrackIds = [],
  freshTrackId = null,
  onCompareSelected = null,
  onCreateCustomerOffer = null,
  onPrepareMessage = null,
  onClearSelection = null,
  showTracks = true,
}) {
  const count = tracks.length || boardItems.length;
  const selectedCount = selectedTrackIds?.length ?? 0;

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
            titleId="gm-card-title-assist"
            onPrimary={onGoldenPrimary}
            onSecondary={onGoldenSecondary}
          />
        </div>
      ) : null}

      {showTracks && tracks.length > 0 ? (
        <>
          <CustomerAkteVehicleTracks
            tracks={tracks}
            title="Spuren"
            compact
            onOpenTrack={onOpenTrack}
            onSelectTrack={onSelectTrack}
            onResumeTrack={onResumeTrack}
            selectedTrackIds={selectedTrackIds}
            freshTrackId={freshTrackId}
          />
          <CustomerAkteOfferSelectionBar
            selectedCount={selectedCount}
            onCompare={onCompareSelected}
            onCreateCustomerOffer={onCreateCustomerOffer}
            onPrepareMessage={onPrepareMessage}
            onClear={onClearSelection}
          />
        </>
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
