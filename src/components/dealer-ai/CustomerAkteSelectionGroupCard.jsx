import VehicleImage from '../shared/VehicleImage.jsx';
import {
  formatSelectionGroupStatus,
  formatSelectionGroupSubtitle,
  formatSelectionGroupTrimLine,
} from '../../services/sales/offerSelectionGroup.js';
import './CustomerAkte.css';

export default function CustomerAkteSelectionGroupCard({
  group,
  index = 0,
  animateIn = false,
  onClick,
}) {
  if (!group) return null;

  const status = formatSelectionGroupStatus(group);
  const trimLine = formatSelectionGroupTrimLine(group);

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
          <span className={`cust-akte-sgroup__status cust-akte-sgroup__status--${status.tone}`}>
            {status.label}
          </span>
        </div>
      </button>
    </article>
  );
}
