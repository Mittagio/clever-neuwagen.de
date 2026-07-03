import { Link, useLocation } from 'react-router-dom';
import { useState } from 'react';
import { useDealerAdmin } from '../../context/DealerAdminContext.jsx';
import { getDealerStatusMeta } from '../../logic/dealerAdminEngine.js';
import './DealerAdminShared.css';

export function AdminOperatorNav() {
  const location = useLocation();
  const links = [
    { to: '/admin', label: 'Cockpit', end: true },
    { to: '/admin/haendler', label: 'Händler' },
    { to: '/admin/approvals', label: 'Freigaben' },
    { to: '/admin/onboarding', label: 'Onboarding' },
    { to: '/admin/billing', label: 'Abrechnung' },
    { to: '/admin/datenpruefung', label: 'Datenprüfung' },
    { to: '/admin/import', label: 'Preislisten' },
    { to: '/admin/launch', label: 'Launch' },
  ];

  return (
    <nav className="dop-nav" aria-label="Betreiber-Navigation">
      {links.map((link) => {
        const active = link.end
          ? location.pathname === '/admin'
          : location.pathname.startsWith(link.to);
        return (
          <Link
            key={link.to}
            to={link.to}
            className={`dop-nav__link${active ? ' is-active' : ''}`}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}

export function AdminNotificationBell() {
  const { notifications, markNotificationsRead } = useDealerAdmin();
  const [open, setOpen] = useState(false);
  const unread = notifications.filter((n) => !n.read).length;

  return (
    <div className="dop-bell">
      <button
        type="button"
        className="dop-bell__btn"
        onClick={() => setOpen((v) => !v)}
        aria-label={`Benachrichtigungen${unread ? `, ${unread} ungelesen` : ''}`}
      >
        🔔
        {unread > 0 && <span className="dop-bell__badge">{unread}</span>}
      </button>
      {open && (
        <div className="dop-bell__panel" role="dialog" aria-label="Benachrichtigungen">
          <div className="dop-bell__head">
            <strong>Benachrichtigungen</strong>
            {unread > 0 && (
              <button type="button" className="dop-bell__mark" onClick={markNotificationsRead}>
                Alle gelesen
              </button>
            )}
          </div>
          <ul className="dop-bell__list">
            {notifications.map((n) => (
              <li key={n.id} className={`dop-bell__item${n.read ? '' : ' is-unread'}`}>
                <Link to="/admin/approvals" onClick={() => setOpen(false)}>
                  🔔 {n.text}
                </Link>
              </li>
            ))}
          </ul>
          <Link to="/admin/approvals" className="dop-bell__footer" onClick={() => setOpen(false)}>
            Approval Center →
          </Link>
        </div>
      )}
    </div>
  );
}

export function DealerStatusBadge({ status }) {
  const meta = getDealerStatusMeta(status);
  return (
    <span className={`dop-status dop-status--${meta.tone}`}>
      {meta.emoji} {meta.label}
    </span>
  );
}

export function OperatorPageHeader({ title, subtitle, backTo, actions }) {
  return (
    <header className="dop-header">
      <div className="dop-header__row">
        {backTo && <Link to={backTo} className="dop-header__back">← Zurück</Link>}
        <AdminNotificationBell />
      </div>
      <p className="dop-header__kicker">Betreiber-Cockpit</p>
      <h1 className="dop-header__title">{title}</h1>
      {subtitle && <p className="dop-header__sub">{subtitle}</p>}
      {actions && <div className="dop-header__actions">{actions}</div>}
    </header>
  );
}

export function KpiCard({ label, value, hint }) {
  return (
    <article className="dop-kpi">
      <p className="dop-kpi__label">{label}</p>
      <p className="dop-kpi__value">{value}</p>
      {hint && <p className="dop-kpi__hint">{hint}</p>}
    </article>
  );
}

export function ApprovalActions({ onApprove, onReject, extra }) {
  return (
    <div className="dop-approval-actions">
      <button type="button" className="dop-btn dop-btn--approve" onClick={onApprove}>
        ✓ Freigeben
      </button>
      <button type="button" className="dop-btn dop-btn--reject" onClick={onReject}>
        ✕ Ablehnen
      </button>
      {extra}
    </div>
  );
}
