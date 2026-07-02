import VehicleImage from '../shared/VehicleImage.jsx';
import { formatVehicleCardTitle } from '../../services/customerAkte.js';
import { buildBoardOfferCardModel } from '../../services/dealer/boardOfferModel.js';
import './CustomerAkte.css';

export default function CustomerAkteVehicleCard({
  card,
  lead = null,
  index = 0,
  animateIn = false,
  onClick,
  onMenu,
  onAction,
}) {
  const title = formatVehicleCardTitle(card);
  const model = buildBoardOfferCardModel(card, lead);

  function handlePrimaryAction(event) {
    event.stopPropagation();
    if (model.primaryAction) {
      onAction?.(model.primaryAction, card);
      return;
    }
    onClick?.(card);
  }

  function handleSecondaryAction(event, action) {
    event.stopPropagation();
    onAction?.(action, card);
  }

  return (
    <article
      className={`cust-akte-vcard cust-akte-vcard--board cust-akte-vcard--offer${model.isDraft ? ' cust-akte-vcard--draft' : ' cust-akte-vcard--created'}${animateIn ? ' cust-akte-vcard--animate' : ''}`}
      style={{ '--card-index': index }}
    >
      <button
        type="button"
        className="cust-akte-vcard__main"
        onClick={() => onClick?.(card)}
        aria-label={`${title} – ${model.badge.label}`}
      >
        <div className="cust-akte-vcard__visual">
          <span className={`cust-akte-vcard__badge cust-akte-vcard__badge--${model.badge.tone}`}>
            {model.badge.label}
          </span>
          <VehicleImage
            brand="Kia"
            model={card.modelKey}
            bodyType={card.bodyType ?? 'suv'}
            variant="card"
            className="cust-akte-vcard__image-wrap"
            imageClassName="cust-akte-vcard__image"
          />
        </div>

        <div className="cust-akte-vcard__body">
          <p className="cust-akte-vcard__title">{title}</p>
          <p className="cust-akte-vcard__payment-type">{model.paymentTypeLabel}</p>

          {model.conditionChips.length > 0 ? (
            <div className="cust-akte-vcard__chips">
              {model.conditionChips.map((chip) => (
                <span key={chip.id} className="cust-akte-vcard__chip">{chip.label}</span>
              ))}
            </div>
          ) : null}

          {model.primaryResult ? (
            <p className="cust-akte-vcard__result">
              <span className="cust-akte-vcard__result-value">{model.primaryResult.value}</span>
              {model.primaryResult.suffix ? (
                <span className="cust-akte-vcard__result-suffix">{model.primaryResult.suffix}</span>
              ) : null}
            </p>
          ) : (
            <p className="cust-akte-vcard__draft-hint">{model.metaLine}</p>
          )}

          {model.listPriceLine ? (
            <p className="cust-akte-vcard__meta">{model.listPriceLine}</p>
          ) : null}

          {model.packageLine ? (
            <p className="cust-akte-vcard__meta">{model.packageLine}</p>
          ) : null}

          {!model.isDraft && model.metaLine ? (
            <p className="cust-akte-vcard__meta cust-akte-vcard__meta--muted">{model.metaLine}</p>
          ) : null}

          {model.questionHint ? (
            <p className="cust-akte-vcard__question-hint">{model.questionHint}</p>
          ) : null}
        </div>
      </button>

      <div className="cust-akte-vcard__actions">
        {model.primaryAction ? (
          <button
            type="button"
            className="cust-akte-vcard__action cust-akte-vcard__action--primary"
            onClick={handlePrimaryAction}
          >
            {model.primaryAction.label}
          </button>
        ) : null}

        {model.secondaryActions.slice(0, model.primaryAction ? 2 : 3).map((action) => (
          <button
            key={action.id}
            type="button"
            className="cust-akte-vcard__action"
            onClick={(event) => handleSecondaryAction(event, action)}
          >
            {action.label}
          </button>
        ))}

        <button
          type="button"
          className="cust-akte-vcard__menu"
          onClick={(e) => { e.stopPropagation(); onMenu?.(card); }}
          aria-label="Mehr Optionen"
        >
          ⋯
        </button>
      </div>
    </article>
  );
}
