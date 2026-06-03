import {
  getSmartSalesStats,
  getOpenRepliesCount,
} from '../../services/sales/salesAdvisorStats.js';

export default function SalesAdvisorStatsBar() {
  const stats = getSmartSalesStats();
  const openReplies = getOpenRepliesCount();

  return (
    <div className="ss-stats" aria-label="Beratungs-Statistik heute">
      <div className="ss-stats__item">
        <span className="ss-stats__value">{stats.advised}</span>
        <span className="ss-stats__label">Heute beraten</span>
      </div>
      <div className="ss-stats__item">
        <span className="ss-stats__value">{stats.sent}</span>
        <span className="ss-stats__label">Angebote versendet</span>
      </div>
      <div className="ss-stats__item">
        <span className="ss-stats__value">{stats.qrCreated}</span>
        <span className="ss-stats__label">QR-Codes erstellt</span>
      </div>
      <div className="ss-stats__item">
        <span className="ss-stats__value">{stats.compareOpened ?? 0}</span>
        <span className="ss-stats__label">Vergleich geöffnet</span>
      </div>
      <div className="ss-stats__item">
        <span className="ss-stats__value">{stats.offerViewed ?? 0}</span>
        <span className="ss-stats__label">Angebot angesehen</span>
      </div>
      <div className="ss-stats__item">
        <span className="ss-stats__value">{openReplies}</span>
        <span className="ss-stats__label">Rückmeldungen offen</span>
      </div>
    </div>
  );
}
