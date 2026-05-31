import { LEAD_STATUS } from '../../data/leadTypes.js';
import {
  formatLeadTime,
  formatRate,
  getInitials,
  getLeadPreview,
} from '../../logic/leadService.js';
import './LeadListItem.css';

export default function LeadListItem({ lead, isActive, onClick }) {
  const status = LEAD_STATUS[lead.status] ?? LEAD_STATUS.neu;
  const preview = getLeadPreview(lead);
  const displayName = lead.contact.name?.trim() || 'Unbekannt';

  return (
    <button
      type="button"
      className={`lead-item${isActive ? ' lead-item--active' : ''}`}
      onClick={onClick}
    >
      <span
        className="lead-item__avatar"
        style={{ background: status.bg, color: status.color }}
        aria-hidden="true"
      >
        {getInitials(displayName)}
      </span>

      <span className="lead-item__body">
        <span className="lead-item__row">
          <span className="lead-item__name">
            {displayName}
            {lead.pilot && <span className="lead-item__pilot">Pilot</span>}
          </span>
          <span className="lead-item__time">{formatLeadTime(lead.updatedAt)}</span>
        </span>
        <span className="lead-item__row">
          <span className="lead-item__vehicle">{lead.vehicle?.label ?? 'Fahrzeug offen'}</span>
          {lead.desiredRate != null && (
            <span className="lead-item__rate">{formatRate(lead.desiredRate)}/M</span>
          )}
        </span>
        <span className="lead-item__preview">{preview}</span>
      </span>

      <span
        className="lead-item__status-dot"
        style={{ background: status.color }}
        title={status.label}
      />
    </button>
  );
}
