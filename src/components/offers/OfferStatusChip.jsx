import { OFFER_STATUS } from '../../data/offerTypes.js';
import './OfferComponents.css';

export default function OfferStatusChip({ status, compact = false }) {
  const meta = OFFER_STATUS[status] ?? OFFER_STATUS.entwurf;

  return (
    <span
      className={`offer-status-chip ${compact ? 'offer-status-chip--compact' : ''}`}
      style={{ color: meta.color, background: meta.bg }}
    >
      {meta.label}
    </span>
  );
}
