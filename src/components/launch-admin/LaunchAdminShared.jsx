import { Link, useLocation } from 'react-router-dom';
import { AdminNotificationBell } from '../dealer-admin/DealerAdminShared.jsx';
import { ROLES, USER_STATUS } from '../../data/rolesConfig.js';
import { getSeverityMeta } from '../../logic/launchReadinessEngine.js';
import './LaunchAdminShared.css';

export const LAUNCH_NAV = [
  { to: '/admin/launch', label: 'Launch' },
  { to: '/admin/analytics', label: 'Analytics' },
  { to: '/admin/pilot', label: 'Pilot Trinkle' },
  { to: '/admin/roles', label: 'Rollen' },
  { to: '/admin/email', label: 'E-Mail' },
  { to: '/admin/system', label: 'System' },
  { to: '/admin/audit', label: 'Audit' },
  { to: '/admin/backup', label: 'Backup' },
  { to: '/admin/domains', label: 'Domains' },
];

export function LaunchAdminNav() {
  const location = useLocation();
  return (
    <nav className="launch-nav" aria-label="Launch-Administration">
      {LAUNCH_NAV.map((link) => (
        <Link
          key={link.to}
          to={link.to}
          className={`launch-nav__link${location.pathname === link.to ? ' is-active' : ''}`}
        >
          {link.label}
        </Link>
      ))}
    </nav>
  );
}

export function LaunchPageHeader({ title, subtitle, backTo, actions }) {
  return (
    <header className="launch-header">
      <div className="launch-header__row">
        {backTo ? <Link to={backTo} className="launch-header__back">← Zurück</Link> : <Link to="/admin" className="launch-header__back">← Cockpit</Link>}
        <AdminNotificationBell />
      </div>
      <p className="launch-header__kicker">Launch Readiness · Sprint 4</p>
      <h1 className="launch-header__title">{title}</h1>
      {subtitle && <p className="launch-header__sub">{subtitle}</p>}
      {actions && <div className="launch-header__actions">{actions}</div>}
    </header>
  );
}

export function LaunchKpi({ label, value, hint }) {
  return (
    <article className="launch-kpi">
      <p className="launch-kpi__label">{label}</p>
      <p className="launch-kpi__value">{value}</p>
      {hint && <p className="launch-kpi__hint">{hint}</p>}
    </article>
  );
}

export function StatusChip({ statusMap, statusId }) {
  const meta = statusMap[statusId] ?? statusMap.warning ?? statusMap.active;
  return (
    <span className={`launch-chip launch-chip--${meta.tone}`}>
      {meta.emoji} {meta.label}
    </span>
  );
}

export function UserStatusChip({ status }) {
  return <StatusChip statusMap={USER_STATUS} statusId={status} />;
}

export function SystemSeverityChip({ type }) {
  const meta = getSeverityMeta(type);
  return <StatusChip statusMap={{ [type]: meta }} statusId={type} />;
}

export function RoleBadge({ roleId }) {
  const role = ROLES[roleId];
  return (
    <span className="launch-role-badge">{role?.label ?? roleId}</span>
  );
}

export function LaunchCard({ children, className = '' }) {
  return <article className={`launch-card ${className}`.trim()}>{children}</article>;
}

export function LaunchProgress({ percent, label }) {
  return (
    <div className="launch-progress">
      <div className="launch-progress__bar" style={{ width: `${percent}%` }} />
      <p className="launch-progress__label">{label ?? `${percent} %`}</p>
    </div>
  );
}

export function FlowChain({ phases }) {
  return (
    <div className="launch-flow">
      {phases.map((phase, i) => (
        <div key={phase.label} className={`launch-flow__step${phase.done ? ' is-done' : ''}`}>
          {i > 0 && <span className="launch-flow__arrow">→</span>}
          <span className="launch-flow__label">{phase.label}</span>
        </div>
      ))}
    </div>
  );
}
