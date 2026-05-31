import { MODEL_STATUS, CHANGE_STATUS, BRAND_STATUS } from '../../data/adminCatalog.js';
import './StatusBadge.css';

const STATUS_MAPS = {
  brand: BRAND_STATUS,
  model: MODEL_STATUS,
  change: CHANGE_STATUS,
};

export default function StatusBadge({ status, type = 'model' }) {
  const map = STATUS_MAPS[type] ?? MODEL_STATUS;
  const config = map[status] ?? { label: status, className: 'status-draft' };

  return (
    <span className={`status-badge ${config.className}`}>
      {config.label}
    </span>
  );
}
