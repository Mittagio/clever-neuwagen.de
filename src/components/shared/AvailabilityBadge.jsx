import { INVENTORY_TYPES } from '../../data/inventoryTypes.js';
import './AvailabilityBadge.css';

export default function AvailabilityBadge({ label, type, compact = false }) {
  const config = INVENTORY_TYPES[type] ?? INVENTORY_TYPES.konfigurierbar;

  if (compact) {
    return (
      <span className={`avail-badge avail-badge--${type} avail-badge--compact`}>
        {label}
      </span>
    );
  }

  return (
    <span className={`avail-badge avail-badge--${type}`}>
      <span className="avail-badge-emoji" aria-hidden="true">{config.emoji}</span>
      <span className="avail-badge-text">{label?.replace(/^[^\s]+\s/, '') ?? config.customerLabel}</span>
    </span>
  );
}
