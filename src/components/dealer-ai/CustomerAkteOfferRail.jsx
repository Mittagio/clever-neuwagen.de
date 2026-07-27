import { useMemo } from 'react';
import VehicleImage from '../shared/VehicleImage.jsx';
import { formatVehicleCardTitle } from '../../services/customerAkte.js';
import { buildBoardOfferCardModel } from '../../services/dealer/boardOfferModel.js';

/**
 * Desktop-rechte Offer-Rail – filigrane Darstellung des primären Board-Angebots.
 */
export default function CustomerAkteOfferRail({
  lead = null,
  boardItems = [],
  onOpenBoard = null,
  onCardClick = null,
  onCardAction = null,
}) {
  const primaryItem = boardItems.find((item) => item.type !== 'selection_group')
    ?? boardItems[0]
    ?? null;
  const card = primaryItem?.type === 'selection_group' ? null : primaryItem?.card ?? null;
  const count = boardItems.length;

  const model = useMemo(
    () => (card ? buildBoardOfferCardModel(card, lead) : null),
    [card, lead],
  );

  const title = card ? formatVehicleCardTitle(card) : '';
  const specs = model?.conditionChips?.length
    ? model.conditionChips.map((chip) => chip.label)
    : [];
  if (model?.paymentTypeLabel && !specs.includes(model.paymentTypeLabel)) {
    specs.unshift(model.paymentTypeLabel);
  }

  function openPrimary() {
    if (!card) {
      onOpenBoard?.();
      return;
    }
    if (model?.primaryAction) {
      onCardAction?.(model.primaryAction, card);
      return;
    }
    onCardClick?.(card);
  }

  return (
    <section className="cust-akte-offer-rail" aria-label="Angebote">
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

      {card && model ? (
        <article className="cust-akte-offer-rail__card">
          <div className="cust-akte-offer-rail__visual">
            <span
              className={`cust-akte-offer-rail__badge cust-akte-offer-rail__badge--${model.badge.tone}`}
            >
              {model.badge.label}
            </span>
            <VehicleImage
              brand="Kia"
              model={card.modelKey}
              bodyType={card.bodyType ?? 'suv'}
              variant="card"
              className="cust-akte-offer-rail__image-wrap"
              imageClassName="cust-akte-offer-rail__image"
            />
          </div>

          <div className="cust-akte-offer-rail__body">
            <h3 className="cust-akte-offer-rail__title">{title}</h3>

            {model.primaryResult ? (
              <p className="cust-akte-offer-rail__rate">
                <span>{model.primaryResult.value}</span>
                {model.primaryResult.suffix ? (
                  <span className="cust-akte-offer-rail__rate-suffix">
                    {model.primaryResult.suffix}
                  </span>
                ) : null}
              </p>
            ) : (
              <p className="cust-akte-offer-rail__hint">{model.metaLine}</p>
            )}

            {specs.length > 0 ? (
              <ul className="cust-akte-offer-rail__specs">
                {specs.slice(0, 4).map((label) => (
                  <li key={label}>
                    <span className="cust-akte-offer-rail__spec-icon" aria-hidden>○</span>
                    <span>{label}</span>
                  </li>
                ))}
              </ul>
            ) : null}

            {model.questionHint ? (
              <p className="cust-akte-offer-rail__question">{model.questionHint}</p>
            ) : null}
          </div>

          <button
            type="button"
            className="cust-akte-offer-rail__open"
            onClick={openPrimary}
          >
            {model.primaryAction?.label || 'Angebot öffnen'}
          </button>
        </article>
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
    </section>
  );
}
