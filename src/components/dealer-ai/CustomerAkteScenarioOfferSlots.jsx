import {
  areAllScenarioOffersReady,
  countReadyScenarioOffers,
} from '../../services/crm/commercialScenarios.js';
import './CustomerAkteScenarioOfferSlots.css';

function formatRate(value) {
  if (value == null || !Number.isFinite(Number(value))) return null;
  return `${Number(value).toLocaleString('de-DE')} €`;
}

/**
 * Seller Angebotsbereich: eine Fahrzeugspur, Slots pro commercialScenario.
 */
export default function CustomerAkteScenarioOfferSlots({
  track = null,
  slots = null,
  onCreateOffer = null,
  onUploadPdf = null,
  onOpenOffer = null,
  onSendBoth = null,
  disabled = false,
}) {
  const resolvedSlots = slots ?? track?.scenarioSlots ?? [];
  if (!track || resolvedSlots.length < 2) return null;

  const readyCount = countReadyScenarioOffers(resolvedSlots);
  const allReady = areAllScenarioOffersReady(resolvedSlots);

  return (
    <section className="scenario-slots" aria-label={`${track.modelLabel} Angebotsvarianten`}>
      <header className="scenario-slots__head">
        <h3 className="scenario-slots__vehicle">{track.modelLabel || track.displayName}</h3>
        <p className="scenario-slots__sub">
          Eine Spur · {resolvedSlots.length} Angebotsvarianten
        </p>
      </header>

      <ul className="scenario-slots__list">
        {resolvedSlots.map((slot) => {
          const rate = formatRate(slot.monthlyRate);
          const balloon = formatRate(slot.balloonPayment);
          return (
            <li key={slot.scenarioId}>
              <article
                className={[
                  'scenario-slot',
                  slot.ready ? 'scenario-slot--ready' : 'scenario-slot--draft',
                ].join(' ')}
              >
                <div className="scenario-slot__top">
                  <h4 className="scenario-slot__type">{slot.typeLabel}</h4>
                  <span className="scenario-slot__status">
                    {slot.ready ? (slot.checked ? '✓ geprüft' : 'Bereit') : 'Noch zu erstellen'}
                  </span>
                </div>

                <p className="scenario-slot__conditions">{slot.conditionsLine || slot.chipLabel}</p>

                {slot.ready && rate ? (
                  <p className="scenario-slot__rate">
                    <span className="scenario-slot__rate-value">{rate}</span>
                    <span className="scenario-slot__rate-suffix">/Monat</span>
                  </p>
                ) : null}

                {slot.ready && balloon && slot.type === 'financing' ? (
                  <p className="scenario-slot__balloon">
                    Schlussrate {balloon}
                  </p>
                ) : null}

                {slot.feedbackLabel ? (
                  <p
                    className={[
                      'scenario-slot__feedback',
                      slot.feedbackSentiment === 'positive'
                        ? 'scenario-slot__feedback--positive'
                        : '',
                      slot.feedbackSentiment === 'negative'
                        ? 'scenario-slot__feedback--negative'
                        : '',
                    ].filter(Boolean).join(' ')}
                  >
                    {slot.feedbackLabel}
                  </p>
                ) : null}

                <div className="scenario-slot__actions">
                  {!slot.ready ? (
                    <>
                      <button
                        type="button"
                        className="scenario-slot__btn scenario-slot__btn--primary"
                        disabled={disabled}
                        onClick={() => onCreateOffer?.(slot, track)}
                      >
                        Angebot erstellen
                      </button>
                      {onUploadPdf ? (
                        <button
                          type="button"
                          className="scenario-slot__btn"
                          disabled={disabled}
                          onClick={() => onUploadPdf?.(slot, track)}
                        >
                          PDF hochladen
                        </button>
                      ) : null}
                    </>
                  ) : (
                    <button
                      type="button"
                      className="scenario-slot__btn"
                      disabled={disabled}
                      onClick={() => onOpenOffer?.(slot, track)}
                    >
                      Öffnen
                    </button>
                  )}
                </div>
              </article>
            </li>
          );
        })}
      </ul>

      {allReady && onSendBoth ? (
        <button
          type="button"
          className="scenario-slots__send"
          disabled={disabled}
          onClick={() => onSendBoth(track, resolvedSlots)}
        >
          Beide Angebote senden
        </button>
      ) : (
        <p className="scenario-slots__hint">
          {readyCount === 0
            ? 'Beide Varianten noch anlegen – danach gemeinsam senden.'
            : `${readyCount} von ${resolvedSlots.length} bereit.`}
        </p>
      )}
    </section>
  );
}
