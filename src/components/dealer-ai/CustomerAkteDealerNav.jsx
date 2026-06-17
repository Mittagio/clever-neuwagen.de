import { Link } from 'react-router-dom';
import './CustomerAkte.css';

export default function CustomerAkteDealerNav({ onNewWish }) {
  return (
    <nav className="cust-akte-dealer-nav" aria-label="Händler-Navigation">
      <Link to="/dealer-ai" className="cust-akte-dealer-nav__item">
        <span className="cust-akte-dealer-nav__icon" aria-hidden>⌂</span>
        Übersicht
      </Link>
      <Link to="/communication" className="cust-akte-dealer-nav__item cust-akte-dealer-nav__item--active">
        <span className="cust-akte-dealer-nav__icon" aria-hidden>👥</span>
        Kunden
      </Link>
      <button
        type="button"
        className="cust-akte-dealer-nav__fab"
        onClick={onNewWish}
        aria-label="Neu"
      >
        +
      </button>
      <Link to="/backend/angebote" className="cust-akte-dealer-nav__item">
        <span className="cust-akte-dealer-nav__icon" aria-hidden>📄</span>
        Angebote
      </Link>
      <button type="button" className="cust-akte-dealer-nav__item cust-akte-dealer-nav__item--more">
        <span className="cust-akte-dealer-nav__icon" aria-hidden>☰</span>
        Mehr
        <span className="cust-akte-dealer-nav__dot" aria-hidden />
      </button>
    </nav>
  );
}
