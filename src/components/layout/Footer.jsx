import { Link } from 'react-router-dom';
import { LEGAL_FOOTER_LINKS } from '../../constants/legal.js';
import './Footer.css';

export default function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="site-footer">
      <div className="site-footer__inner">
        <div className="site-footer__brand-block">
          <p className="site-footer__brand">Clever-Neuwagen</p>
          <p className="site-footer__tagline">Fahrzeuge finden · Echte Händlerangebote in Ihrer Nähe</p>
        </div>

        <nav className="site-footer__nav" aria-label="Rechtliches und Service">
          {LEGAL_FOOTER_LINKS.map((link) =>
            link.external ? (
              <a
                key={link.label}
                href={link.to}
                className="site-footer__link"
              >
                {link.label}
              </a>
            ) : (
              <Link key={link.to} to={link.to} className="site-footer__link">
                {link.label}
              </Link>
            ),
          )}
        </nav>

        <p className="site-footer__copy">
          © {year} Clever-Neuwagen · clever-neuwagen.de
        </p>
      </div>
    </footer>
  );
}
