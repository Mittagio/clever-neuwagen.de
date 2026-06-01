import { LEAD_STATUS } from '../../data/leadTypes.js';

export default function SalesChanceQuickActions({
  lead,
  onCall,
  onCreateOffer,
  onSendMessage,
  onPlanTestDrive,
  onRequestDocument,
  onStatusChange,
}) {
  if (!lead) return null;

  return (
    <div className="sc-quick">
      <div className="sc-quick__actions">
        <button type="button" className="sc-quick__btn" onClick={onCall} disabled={!lead.contact?.phone}>
          📞 Kunde anrufen
        </button>
        <button type="button" className="sc-quick__btn" onClick={onCreateOffer}>
          📄 Angebot erstellen
        </button>
        <button type="button" className="sc-quick__btn sc-quick__btn--primary" onClick={onSendMessage}>
          ✉️ Nachricht senden
        </button>
        <button type="button" className="sc-quick__btn" onClick={onPlanTestDrive}>
          🚗 Probefahrt planen
        </button>
        <button type="button" className="sc-quick__btn" onClick={onRequestDocument}>
          📎 Dokument anfordern
        </button>
      </div>
      <label className="sc-quick__status-label">
        Status
        <select
          value={lead.status}
          onChange={(e) => onStatusChange?.(e.target.value)}
          className="sc-quick__status-select"
        >
          {Object.keys(LEAD_STATUS).map((key) => (
            <option key={key} value={key}>{LEAD_STATUS[key].label}</option>
          ))}
        </select>
      </label>
    </div>
  );
}
