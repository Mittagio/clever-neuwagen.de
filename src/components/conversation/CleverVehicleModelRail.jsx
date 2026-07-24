import { useMemo } from 'react';
import { VEHICLE_DIRECTION_REACTIONS } from '../../services/consultation/vehicleDirectionService.js';
import { buildVehicleModelCard } from '../../services/consultation/vehicleModelCardPresentation.js';
import './clever-conversation.css';

/**
 * Einheitliche, swipebare Modellkacheln (mittelgroß / Handybreite).
 * Stammdaten werden zur Anzeige live angereichert (auch bei alten Turns).
 */
export default function CleverVehicleModelRail({
  cards = [],
  intro = null,
  reactions = {},
  needProfile = {},
  notepadLabels = [],
  onReact = null,
  ariaLabel = 'Fahrzeugmodelle',
}) {
  const list = useMemo(() => {
    return (cards ?? [])
      .filter((card) => card?.modelKey)
      .map((card) => {
        const fresh = buildVehicleModelCard(card.modelKey, {
          needProfile,
          notepadLabels,
          reason: card.reason ?? null,
          subtitle: card.subtitle ?? null,
          fitHints: card.fitHints,
          highlighted: card.highlighted,
        });
        return {
          ...(fresh ?? {}),
          ...card,
          // Frische verifizierte Felder gewinnen über stale Turn-Daten
          ...(fresh ? {
            name: fresh.name || card.name,
            image: fresh.image || card.image,
            isElectric: fresh.isElectric,
            uvpLabel: fresh.uvpLabel,
            powerLabel: fresh.powerLabel,
            rangeLabel: fresh.rangeLabel,
            matchChips: fresh.matchChips,
            contextAnswer: fresh.contextAnswer ?? card.contextAnswer,
            metaLine: fresh.metaLine,
          } : {}),
        };
      });
  }, [cards, needProfile, notepadLabels]);

  if (!list.length) return null;

  return (
    <section className="cc-model-rail cc-turn-enter" aria-label={ariaLabel}>
      {intro && <p className="cc-model-rail__intro">{intro}</p>}
      <div className="cc-model-rail__track" role="list">
        {list.map((card) => {
          const reaction = reactions[card.modelKey] ?? null;
          return (
            <article
              key={card.modelKey}
              className={[
                'cc-model-card',
                card.highlighted ? 'is-highlighted' : '',
                reaction === 'not_fit' ? 'is-dismissed' : '',
                reaction === 'interested' ? 'is-interested' : '',
              ].filter(Boolean).join(' ')}
              role="listitem"
            >
              {card.image ? (
                <img
                  className="cc-model-card__img"
                  src={card.image}
                  alt=""
                  loading="lazy"
                />
              ) : (
                <div className="cc-model-card__img cc-model-card__img--placeholder" aria-hidden />
              )}

              <div className="cc-model-card__body">
                <p className="cc-model-card__name">{card.name}</p>

                {card.contextAnswer && (
                  <p className="cc-model-card__answer">
                    <span className="cc-model-card__answer-label">{card.contextAnswer.label}</span>
                    <span className="cc-model-card__answer-value">{card.contextAnswer.value}</span>
                  </p>
                )}

                <div className="cc-model-card__fixed" aria-label="Stammdaten">
                  <p className="cc-model-card__fixed-row">
                    <span>UVP ab</span>
                    <strong>{card.uvpLabel ? card.uvpLabel.replace(/^UVP ab\s+/i, '') : '–'}</strong>
                  </p>
                  <p className="cc-model-card__fixed-row">
                    <span>PS</span>
                    <strong>{card.powerLabel || '–'}</strong>
                  </p>
                  {card.isElectric && (
                    <p className="cc-model-card__fixed-row">
                      <span>Reichweite</span>
                      <strong>{card.rangeLabel || '–'}</strong>
                    </p>
                  )}
                </div>

                {(card.matchChips?.length > 0) && (
                  <div className="cc-model-card__chips" aria-label="Passende Wünsche">
                    {card.matchChips.map((chip) => (
                      <span key={chip} className="cc-model-card__chip">{chip}</span>
                    ))}
                  </div>
                )}

                {(card.metaLine || card.subtitle) && !(card.matchChips?.length) && (
                  <p className="cc-model-card__meta">
                    {[card.subtitle, card.metaLine].filter(Boolean).join(' · ')}
                  </p>
                )}

                {card.reason && !card.contextAnswer && !(card.matchChips?.length) && (
                  <p className="cc-model-card__reason">{card.reason}</p>
                )}

                {typeof onReact === 'function' && (
                  <div className="cc-model-card__actions" role="group" aria-label={`${card.name} Aktionen`}>
                    {VEHICLE_DIRECTION_REACTIONS.map((option) => (
                      <button
                        key={option.id}
                        type="button"
                        className={[
                          'cc-model-card__action',
                          option.subtle ? 'is-subtle' : '',
                          reaction === option.id ? 'is-active' : '',
                        ].filter(Boolean).join(' ')}
                        aria-pressed={reaction === option.id}
                        onClick={() => onReact(card.modelKey, option.id)}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
