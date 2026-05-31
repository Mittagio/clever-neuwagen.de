import { Link, useLocation } from 'react-router-dom';
import { getPaymentStatusMeta } from '../../logic/billingEngine.js';
import { formatMoney } from '../../data/billingConfig.js';
import './BillingShared.css';

export function AdminBillingNav() {
  const location = useLocation();
  const links = [
    { to: '/admin/billing', label: 'Dashboard', end: true },
    { to: '/admin/deliveries', label: 'Auslieferungen' },
    { to: '/admin/invoices', label: 'Rechnungen' },
    { to: '/admin/rewards', label: 'Gutscheine' },
  ];

  return (
    <nav className="bill-nav" aria-label="Abrechnung">
      {links.map((link) => {
        const active = link.end
          ? location.pathname === link.to
          : location.pathname.startsWith(link.to);
        return (
          <Link
            key={link.to}
            to={link.to}
            className={`bill-nav__link${active ? ' is-active' : ''}`}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}

export function BillingKpiGrid({ items }) {
  return (
    <div className="bill-kpi-grid">
      {items.map((item) => (
        <article key={item.label} className="bill-kpi-card">
          <p className="bill-kpi-card__label">{item.label}</p>
          <p className="bill-kpi-card__value">{item.value}</p>
          {item.hint && <p className="bill-kpi-card__hint">{item.hint}</p>}
        </article>
      ))}
    </div>
  );
}

export function PaymentStatusBadge({ status }) {
  const meta = getPaymentStatusMeta(status);
  return (
    <span className={`bill-status bill-status--${meta.tone}`}>
      {meta.emoji} {meta.label}
    </span>
  );
}

export function BillingMoney({ amount, compact }) {
  return <span className="bill-money">{formatMoney(amount, { compact })}</span>;
}

export function ProvisionChain() {
  const steps = [
    'Lead', 'Angebot', 'Bestellung', 'Auslieferung', 'Bestätigung', 'Provision aktiv',
  ];
  return (
    <div className="bill-chain" aria-label="Provisionskette">
      {steps.map((label, i) => (
        <span key={label} className="bill-chain__step">
          {i > 0 && <span className="bill-chain__arrow" aria-hidden>↓</span>}
          <span className="bill-chain__label">{label}</span>
        </span>
      ))}
    </div>
  );
}

export function BillingPageHeader({ title, subtitle, backTo, actions }) {
  return (
    <header className="bill-header">
      <div className="bill-header__top">
        {backTo && <Link to={backTo} className="bill-header__back">← Zurück</Link>}
        <div className="bill-header__links">
          <Link to="/admin" className="bill-header__link">Admin</Link>
          <Link to="/backend/billing" className="bill-header__link">Händler-Sicht</Link>
        </div>
      </div>
      <p className="bill-header__kicker">Abrechnung & Provisionen</p>
      <h1 className="bill-header__title">{title}</h1>
      {subtitle && <p className="bill-header__sub">{subtitle}</p>}
      {actions && <div className="bill-header__actions">{actions}</div>}
    </header>
  );
}
