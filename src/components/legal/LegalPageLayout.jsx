import { Link, useLocation } from 'react-router-dom';
import { LEGAL_NAV } from '../../constants/legal.js';
import usePageSeo from '../../hooks/usePageSeo.js';
import './LegalPageLayout.css';

export default function LegalPageLayout({
  title,
  seoTitle,
  seoDescription,
  seoPath,
  subtitle,
  children,
}) {
  const location = useLocation();

  usePageSeo({
    title: seoTitle ?? title,
    description: seoDescription,
    path: seoPath ?? location.pathname,
  });

  return (
    <div className="legal-page">
      <header className="legal-page__header">
        <Link to="/" className="legal-page__back">← Startseite</Link>
        <p className="legal-page__kicker">Rechtliches</p>
        <h1 className="legal-page__title">{title}</h1>
        {subtitle && <p className="legal-page__subtitle">{subtitle}</p>}
        <p className="legal-page__lawyer-note" role="note">
          Vorlage – vor Livebetrieb durch einen Fachanwalt prüfen lassen.
        </p>
      </header>

      <nav className="legal-page__nav" aria-label="Rechtliche Seiten">
        {LEGAL_NAV.map((item) => (
          <Link
            key={item.to}
            to={item.to}
            className={`legal-page__nav-link${location.pathname === item.to ? ' is-active' : ''}`}
          >
            {item.label}
          </Link>
        ))}
      </nav>

      <main className="legal-page__main">
        {children}
      </main>
    </div>
  );
}
