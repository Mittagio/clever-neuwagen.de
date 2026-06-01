import { LEAD_STATUS } from '../../data/leadTypes.js';
import { formatLeadTime, formatRate, getInitials, getLeadPreview } from '../../logic/leadService.js';
import './SalesChanceComponents.css';

export default function SalesChanceListItem({ lead, isActive, onClick }) {
  const status = LEAD_STATUS[lead.status] ?? LEAD_STATUS.neu;
  const displayName = lead.contact.name?.trim() || 'Unbekannt';

  return (
    <button
      type="button"
      className={`sc-list-item${isActive ? ' is-active' : ''}`}
      onClick={onClick}
    >
      <span
        className="sc-list-item__avatar"
        style={{ background: status.bg, color: status.color }}
        aria-hidden="true"
      >
        {getInitials(displayName)}
      </span>

      <span className="sc-list-item__body">
        <span className="sc-list-item__row">
          <span className="sc-list-item__name">
            {displayName}
            {lead.pilot && <span className="sc-list-item__tag">Pilot</span>}
          </span>
          <span className="sc-list-item__time">{formatLeadTime(lead.updatedAt)}</span>
        </span>
        <span className="sc-list-item__vehicle">{lead.vehicle?.label ?? 'Fahrzeug offen'}</span>
        <span className="sc-list-item__meta">
          {lead.desiredRate != null && (
            <span>Wunsch {formatRate(lead.desiredRate)}/M</span>
          )}
          {lead.ownerName && <span>· {lead.ownerName}</span>}
        </span>
        <span className="sc-list-item__preview">{getLeadPreview(lead)}</span>
        <span className="sc-list-item__status" style={{ color: status.color }}>
          {status.label}
        </span>
      </span>
    </button>
  );
}
