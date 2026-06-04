import { LEAD_STATUS } from '../../data/leadTypes.js';
import { getLeadBriefPreview } from '../../logic/dealerInquiryBrief.js';
import {
  formatLeadTime,
  formatRate,
  getInitials,
  getLeadPreview,
} from '../../logic/leadService.js';
import './LeadListItem.css';

export default function LeadListItem({ lead, isActive, onClick }) {
  const status = LEAD_STATUS[lead.status] ?? LEAD_STATUS.neu;
  const preview = getLeadBriefPreview(lead.inquiryBrief) ?? getLeadPreview(lead);
  const displayName = lead.contact.name?.trim() || 'Neue Anfrage';
  const cq = lead.cleverQuotePercent ?? lead.inquiryBrief?.cleverQuotePercent;
  const budget = lead.budgetMax ?? lead.inquiryBrief?.budget?.maxMonthly;

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
          <span className="lead-item__rate-row">
            {cq != null && <span className="lead-item__cq">{cq} %</span>}
            {lead.desiredRate != null && (
              <span className="lead-item__rate">{formatRate(lead.desiredRate)}/M</span>
            )}
          </span>
        </span>
        {budget != null && (
          <span className="lead-item__budget">Budget bis {budget} €/Monat</span>
        )}
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
