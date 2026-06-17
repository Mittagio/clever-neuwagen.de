import { Link } from 'react-router-dom';
import { DEALER_APP_LEGAL_LINKS } from '../../constants/legal.js';
import './DealerAppLegalMenu.css';

export default function DealerAppLegalMenu({
  title = 'Rechtliches',
  compact = false,
  className = '',
}) {
  return (
    <nav
      className={`dealer-legal-menu${compact ? ' dealer-legal-menu--compact' : ''}${className ? ` ${className}` : ''}`}
      aria-label={title}
    >
      {!compact && <p className="dealer-legal-menu__title">{title}</p>}
      <ul className="dealer-legal-menu__list">
        {DEALER_APP_LEGAL_LINKS.map((link) => (
          <li key={link.label}>
            {link.external ? (
              <a href={link.to} className="dealer-legal-menu__link">
                {link.label}
              </a>
            ) : (
              <Link to={link.to} className="dealer-legal-menu__link">
                {link.label}
              </Link>
            )}
          </li>
        ))}
      </ul>
    </nav>
  );
}
