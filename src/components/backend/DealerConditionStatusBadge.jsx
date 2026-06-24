import { CONDITION_STATUS_LABELS } from '../../services/dealer/dealerConditionLifecycle.js';
import './DealerVehicleManagement.css';

const STATUS_TONES = {
  draft: 'draft',
  active: 'active',
  expired: 'expired',
  incomplete: 'incomplete',
};

export default function DealerConditionStatusBadge({ status = 'draft', label }) {
  const tone = STATUS_TONES[status] ?? 'draft';
  const text = label ?? CONDITION_STATUS_LABELS[status] ?? status;

  return (
    <span className={`dvm-status-badge dvm-status-badge--${tone}`}>
      {text}
    </span>
  );
}
