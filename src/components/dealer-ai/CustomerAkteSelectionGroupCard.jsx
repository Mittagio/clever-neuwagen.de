import VehicleImage from '../shared/VehicleImage.jsx';
import {
  formatSelectionGroupBudgetLine,
  formatSelectionGroupStatus,
  formatSelectionGroupSubtitle,
  formatSelectionGroupTrimLine,
  formatWishConditionsLine,
} from '../../services/sales/offerSelectionGroup.js';
import './CustomerAkte.css';

export default function CustomerAkteSelectionGroupCard({
  group,
  index = 0,
  animateIn = false,
  onClick,
}) {
  const status = formatSelectionGroupStatus(group);
  const trimLine = formatSelectionGroupTrimLine(group);
  const conditionsLine = formatWishConditionsLine(group.wishConditions);
  const budgetLine = formatSelectionGroupBudgetLine(group.wishConditions);

  return (
    <article
      className={`cust-akte-sgroup${animateIn ? ' cust-akte-sgroup--animate' : ''}`}
      style={{ '--card-index': index }}
    >
      <button
        type="button"
        className="cust-akte-sgroup__main"
        onClick={() => onClick?.(group)}
        aria-label={`${group.modelLabel} – Clever Auswahl öffnen`}
      >
        <div className="cust-akte-sgroup__visual">
          <VehicleImage
            brand="Kia"
            model={group.modelKey}
            bodyType="suv"
            variant="card"
            className="cust-akte-sgroup__image-wrap"
            imageClassName="cust-akte-sgroup__image"
          />
        </div>

        <div className="cust-akte-sgroup__body">
          <p className="cust-akte-sgroup__title">{group.modelLabel}</p>
          <p className="cust-akte-sgroup__count">{formatSelectionGroupSubtitle(group)}</p>
          {trimLine && <p className="cust-akte-sgroup__trims">{trimLine}</p>}
          {conditionsLine && (
            <p className="cust-akte-sgroup__conditions">{conditionsLine}</p>
          )}
          {budgetLine && <p className="cust-akte-sgroup__budget">{budgetLine}</p>}
          <p className={`cust-akte-sgroup__status cust-akte-sgroup__status--${status.tone}`}>
            {status.label}
          </p>
        </div>
      </button>

      <div className="cust-akte-sgroup__cta-wrap">
        <button
          type="button"
          className="cust-akte-sgroup__cta"
          onClick={() => onClick?.(group)}
        >
          Auswahl öffnen
        </button>
      </div>
    </article>
  );
}
