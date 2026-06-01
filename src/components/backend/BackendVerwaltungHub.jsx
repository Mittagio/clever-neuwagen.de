import { Link } from 'react-router-dom';
import { formatPublishedAt, getSyncStatusLabel } from '../../data/dealerConditionsSchema.js';
import './BackendHub.css';

const ADMIN_LINKS = [
  {
    title: 'Abrechnung & Provision',
    desc: 'Lieferungen, Rewards, Rechnungen',
    href: '/backend/billing',
    icon: '💰',
  },
  {
    title: 'Dokumenten-Tresor',
    desc: 'Sichere Übergabe (48h)',
    href: '/backend/documents',
    icon: '🔒',
  },
  {
    title: 'Verkaufskommunikation',
    desc: 'Verkaufschancen, Nachrichten, Vorlagen',
    href: '/communication',
    icon: '💬',
  },
  {
    title: 'Angebotszentrum',
    desc: 'Alle Angebote & Tracking',
    href: '/offers',
    icon: '📄',
  },
  {
    title: 'Vorlagen',
    desc: 'E-Mail- & WhatsApp-Texte',
    href: '/communication/templates',
    icon: '📝',
  },
  {
    title: 'Verkaufsassistent',
    desc: 'Guided Selling',
    href: '/assistant',
    icon: '🎯',
  },
];

export default function BackendVerwaltungHub({
  conditions,
  publishedConditions,
  onSectionChange,
}) {
  const syncStatus = getSyncStatusLabel(conditions, publishedConditions ?? conditions);

  return (
    <div className="backend-hub">
      <header className="backend-hub__head">
        <h2 className="backend-hub__title">Verwaltung</h2>
        <p className="backend-hub__desc">
          Konditionen, Finanzen und interne Tools – selten gebraucht, aber vollständig.
        </p>
      </header>

      <div className="backend-hub__status-bar">
        <span>{syncStatus.emoji} {syncStatus.label}</span>
        <span>·</span>
        <span>Zuletzt: {formatPublishedAt(conditions.lastPublishedAt)}</span>
      </div>

      <div className="backend-hub__cards backend-hub__cards--compact">
        <button type="button" className="backend-hub__card" onClick={() => onSectionChange('discounts')}>
          <span className="backend-hub__card-icon">💶</span>
          <span className="backend-hub__card-label">Rabatte</span>
        </button>
        <button type="button" className="backend-hub__card" onClick={() => onSectionChange('leasing')}>
          <span className="backend-hub__card-icon">📋</span>
          <span className="backend-hub__card-label">Leasing</span>
        </button>
        <button type="button" className="backend-hub__card" onClick={() => onSectionChange('finance')}>
          <span className="backend-hub__card-icon">🏦</span>
          <span className="backend-hub__card-label">Finanzierung</span>
        </button>
        <button type="button" className="backend-hub__card" onClick={() => onSectionChange('delivery')}>
          <span className="backend-hub__card-icon">🚚</span>
          <span className="backend-hub__card-label">Lieferzeit</span>
        </button>
      </div>

      <div className="backend-hub__link-grid">
        {ADMIN_LINKS.map((item) => (
          <Link key={item.href} to={item.href} className="backend-hub__link-card">
            <span className="backend-hub__link-icon" aria-hidden="true">{item.icon}</span>
            <span className="backend-hub__link-title">{item.title}</span>
            <span className="backend-hub__link-desc">{item.desc}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
