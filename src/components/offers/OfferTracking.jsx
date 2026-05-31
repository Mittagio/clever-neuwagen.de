import { formatTrackingDate } from '../../logic/offerService.js';
import './OfferComponents.css';

export default function OfferTracking({ tracking }) {
  if (!tracking) return null;

  const rows = [
    { label: 'Versendet', value: tracking.sentAt },
    { label: 'Geöffnet', value: tracking.openedAt },
    { label: 'Zuletzt angesehen', value: tracking.lastViewedAt },
  ];

  return (
    <div className="offer-tracking">
      <h3 className="offer-tracking-title">Öffnungsverfolgung</h3>
      <dl className="offer-tracking-list">
        {rows.map(({ label, value }) => (
          <div key={label} className="offer-tracking-row">
            <dt>{label}</dt>
            <dd>{value ? formatTrackingDate(value) : '–'}</dd>
          </div>
        ))}
      </dl>
      {tracking.openCount > 0 && (
        <p className="offer-tracking-meta">{tracking.openCount}× angesehen</p>
      )}
    </div>
  );
}
