import { Link } from 'react-router-dom';
import './BackendHub.css';

const MARKETING_LINKS = [
  {
    title: 'Fahrzeug veröffentlichen',
    desc: 'Inserate für Website, Mobile.de & Social – mit Compliance Shield',
    href: '/backend/publishing',
    icon: '📢',
    primary: true,
  },
  {
    title: 'Insert-Generator',
    desc: 'Anzeigentexte & Creatives erstellen',
    href: '/insert-generator',
    icon: '✏️',
  },
  {
    title: 'Empfehlungsseite',
    desc: 'Kundenempfehlungen & Sharing',
    href: '/empfehlung',
    icon: '⭐',
  },
  {
    title: 'Trends & Ratgeber',
    desc: 'Content für SEO und Social',
    href: '/trends',
    icon: '📰',
  },
  {
    title: 'Konfigurator',
    desc: 'Händlerseite mit Sportage-Konfigurator',
    href: '/haendler/autohaus-trinkle',
    icon: '🔗',
    external: true,
  },
];

export default function BackendMarketingHub() {
  return (
    <div className="backend-hub">
      <header className="backend-hub__head">
        <h2 className="backend-hub__title">Marketing</h2>
        <p className="backend-hub__desc">
          Hier veröffentlichen Sie Fahrzeuge und erreichen Kunden – ohne Excel und ohne Umwege.
        </p>
      </header>

      <div className="backend-hub__link-grid">
        {MARKETING_LINKS.map((item) => (
          <Link
            key={item.href}
            to={item.href}
            target={item.external ? '_blank' : undefined}
            rel={item.external ? 'noreferrer' : undefined}
            className={`backend-hub__link-card${item.primary ? ' backend-hub__link-card--primary' : ''}`}
          >
            <span className="backend-hub__link-icon" aria-hidden="true">{item.icon}</span>
            <span className="backend-hub__link-title">{item.title}</span>
            <span className="backend-hub__link-desc">{item.desc}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
