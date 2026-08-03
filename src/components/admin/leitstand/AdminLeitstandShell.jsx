import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import PageShell from '../../layout/PageShell.jsx';
import './adminLeitstand.css';

const NAV_ITEMS = [
  { to: '/admin', label: 'Heute', icon: '📊', end: true },
  { to: '/admin/aufgaben', label: 'Aufgaben', icon: '✓' },
  { to: '/admin/haendler', label: 'Händler', icon: '🏢' },
  { to: '/admin/daten', label: 'Daten', icon: '🚗' },
  { to: '/admin/system', label: 'System', icon: '⚙️' },
];

export default function AdminLeitstandLayout() {
  const location = useLocation();

  useEffect(() => {
    document.title = 'Clever Admin';
  }, [location.pathname]);

  return (
    <PageShell className="admin-shell admin-leitstand-shell">
      <div className="al-layout">
        <main className="al-main">
          <Outlet />
        </main>
        <nav className="al-nav" aria-label="Admin-Leitstand">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) => `al-nav__item${isActive ? ' is-active' : ''}`}
            >
              <span className="al-nav__icon" aria-hidden>{item.icon}</span>
              <span className="al-nav__label">{item.label}</span>
            </NavLink>
          ))}
        </nav>
      </div>
    </PageShell>
  );
}

export function AlPageHeader({ title, subtitle, action }) {
  return (
    <header className="al-header">
      <div>
        <p className="al-header__kicker">Clever-Neuwagen · Admin</p>
        <h1 className="al-header__title">{title}</h1>
        {subtitle ? <p className="al-header__sub">{subtitle}</p> : null}
      </div>
      {action ? <div className="al-header__action">{action}</div> : null}
    </header>
  );
}

export function AlKpiTile({ emoji, value, label, hint, to, tone = 'default' }) {
  const className = `al-kpi al-kpi--${tone}`;
  const inner = (
    <>
      <span className="al-kpi__emoji" aria-hidden>{emoji}</span>
      <p className="al-kpi__value">{value}</p>
      <p className="al-kpi__label">{label}</p>
      {hint ? <p className="al-kpi__hint">{hint}</p> : null}
    </>
  );
  if (to) {
    return <NavLink to={to} className={className}>{inner}</NavLink>;
  }
  return <article className={className}>{inner}</article>;
}

export function AlSection({ title, children, action, id }) {
  return (
    <section className="al-section" id={id}>
      <div className="al-section__head">
        <h2 className="al-section__title">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

export function AlTimeline({ items = [] }) {
  if (!items.length) {
    return <p className="al-empty">Noch keine Ereignisse heute.</p>;
  }
  return (
    <ol className="al-timeline">
      {items.map((item) => (
        <li key={item.id} className={`al-timeline__item al-timeline__item--${item.severity ?? 'info'}`}>
          <time className="al-timeline__time">
            {new Date(item.time).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
          </time>
          <div className="al-timeline__body">
            <p className="al-timeline__text">
              {item.actor && item.actor !== 'System' ? (
                <strong>{item.actor}</strong>
              ) : null}
              {' '}
              {item.text}
            </p>
            {item.detail ? <p className="al-timeline__detail">{item.detail}</p> : null}
          </div>
        </li>
      ))}
    </ol>
  );
}

export function AlTaskCard({ task, onAction }) {
  const priority = task.priority ?? 'later';
  return (
    <article className={`al-task al-task--${priority}`}>
      <div className="al-task__head">
        <span className="al-task__cat">{task.category}</span>
      </div>
      <h3 className="al-task__title">{task.title}</h3>
      {task.subtitle ? <p className="al-task__sub">{task.subtitle}</p> : null}
      {task.href ? (
        <NavLink to={task.href} className="al-task__action" onClick={onAction}>
          {task.actionLabel ?? 'Öffnen'} →
        </NavLink>
      ) : null}
    </article>
  );
}

export function AlHealthCard({ title, items = [], id }) {
  return (
    <article className="al-health-card" id={id}>
      <h3 className="al-health-card__title">{title}</h3>
      <ul className="al-health-card__list">
        {items.map((item) => (
          <li key={item.id} className="al-health-card__row">
            <span className={`al-health-card__dot al-health-card__dot--${item.status}`} aria-hidden />
            <div>
              <p className="al-health-card__label">{item.label}</p>
              <p className="al-health-card__detail">{item.detail}</p>
            </div>
          </li>
        ))}
      </ul>
    </article>
  );
}

/** Schlanker Kern-Status (Magic/OCR/Mail/Warnungen/Preise) */
export function AlCoreSignalStrip({ signals = [], overall = 'unknown' }) {
  if (!signals.length) return null;
  return (
    <div className={`al-core-strip al-core-strip--${overall}`} id="kern">
      <p className="al-core-strip__kicker">Leitstand-Kern</p>
      <ul className="al-core-strip__list">
        {signals.map((signal) => {
          const inner = (
            <>
              <span className={`al-health-card__dot al-health-card__dot--${signal.status}`} aria-hidden />
              <span className="al-core-strip__label">{signal.label}</span>
              <span className="al-core-strip__detail">{signal.detail}</span>
            </>
          );
          if (signal.href) {
            return (
              <li key={signal.id}>
                <NavLink to={signal.href} className="al-core-strip__item">
                  {inner}
                </NavLink>
              </li>
            );
          }
          return (
            <li key={signal.id}>
              <div className="al-core-strip__item">{inner}</div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function AlWarningList({ warnings = [], emptyLabel = 'Keine aktuellen Clever-Warnungen.' }) {
  if (!warnings.length) {
    return <p className="al-empty">{emptyLabel}</p>;
  }
  return (
    <ul className="al-warning-list">
      {warnings.map((w) => (
        <li key={w.id} className={`al-warning-list__item al-warning-list__item--${w.severity}`}>
          <p className="al-warning-list__title">{w.title}</p>
          {w.detail ? <p className="al-warning-list__detail">{w.detail}</p> : null}
          {w.createdAt ? (
            <time className="al-warning-list__time" dateTime={w.createdAt}>
              {new Date(w.createdAt).toLocaleString('de-DE')}
            </time>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

export function AlReleaseCard({ release, onPublish }) {
  const done = release.checklist?.filter((c) => c.done).length ?? 0;
  const total = release.checklist?.length ?? 0;
  const allDone = total > 0 && done === total;

  return (
    <article className="al-release-card">
      <div className="al-release-card__head">
        <h3 className="al-release-card__title">{release.title}</h3>
        <span className="al-release-card__badge">{release.changeCount} Änderungen</span>
      </div>
      <ul className="al-release-card__checklist">
        {(release.checklist ?? []).map((item) => (
          <li key={item.id} className={item.done ? 'is-done' : ''}>
            {item.done ? '✓' : '○'} {item.label}
          </li>
        ))}
      </ul>
      {release.status !== 'published' && (
        <button
          type="button"
          className="al-btn al-btn--primary"
          disabled={!allDone && release.status !== 'ready'}
          onClick={() => onPublish?.(release.id)}
        >
          Jetzt veröffentlichen
        </button>
      )}
      {release.status === 'published' && (
        <p className="al-release-card__published">🚀 Veröffentlicht · alle Händler aktualisiert</p>
      )}
    </article>
  );
}

export function AlMailRow({ mail, onRetry }) {
  const statusMap = {
    sent: { emoji: '✅', label: 'Versendet' },
    queued: { emoji: '⏳', label: 'Wartend' },
    failed: { emoji: '❌', label: 'Fehlgeschlagen' },
  };
  const status = statusMap[mail.status] ?? statusMap.queued;
  const created = mail.createdAt ? new Date(mail.createdAt).toLocaleString('de-DE') : '–';
  const sent = mail.sentAt ? new Date(mail.sentAt).toLocaleString('de-DE') : null;

  return (
    <article className={`al-mail-row al-mail-row--${mail.status}`}>
      <span className="al-mail-row__status" aria-label={status.label}>{status.emoji}</span>
      <div className="al-mail-row__body">
        <p className="al-mail-row__subject">{mail.subject}</p>
        <p className="al-mail-row__to">An: {mail.to}</p>
        {mail.templateName ? (
          <p className="al-mail-row__template">Vorlage: {mail.templateName}</p>
        ) : mail.templateId ? (
          <p className="al-mail-row__template">Vorlage: {mail.templateId}</p>
        ) : null}
        <p className="al-mail-row__time">
          Erstellt: {created}
          {sent ? ` · Versendet: ${sent}` : ''}
          {mail.retryCount > 0 ? ` · Versuche: ${mail.retryCount}` : ''}
        </p>
        {mail.error ? <p className="al-mail-row__error">Fehler: {mail.error}</p> : null}
      </div>
      {(mail.status === 'failed' || mail.status === 'queued') && (
        <button type="button" className="al-btn al-btn--ghost" onClick={() => onRetry?.(mail.id)}>
          🔁 Erneut
        </button>
      )}
    </article>
  );
}

export function AlDealerCard({ dealer, brands, conversion, provision, lastLogin, to }) {
  const statusEmoji = dealer.status === 'active' ? '🟢' : dealer.status === 'review' ? '🟡' : '⚪';
  const inner = (
    <>
      <div className="al-dealer-card__head">
        <h3 className="al-dealer-card__name">{dealer.companyName}</h3>
        <span className="al-dealer-card__status">{statusEmoji} {dealer.status}</span>
      </div>
      <div className="al-dealer-card__kpis">
        <div><span>{dealer.stats?.leads ?? 0}</span><small>Leads</small></div>
        <div><span>{dealer.stats?.offers ?? 0}</span><small>Angebote</small></div>
        <div><span>{dealer.stats?.sales ?? 0}</span><small>Verkäufe</small></div>
        <div><span>{conversion}</span><small>Conversion</small></div>
      </div>
      <p className="al-dealer-card__meta">
        {provision} Provision · {brands} · Login: {lastLogin}
      </p>
    </>
  );
  if (to) {
    return <NavLink to={to} className="al-dealer-card">{inner}</NavLink>;
  }
  return <article className="al-dealer-card">{inner}</article>;
}

export function AlLinkGrid({ links = [] }) {
  return (
    <div className="al-link-grid">
      {links.map((link) => (
        <NavLink key={link.to} to={link.to} className="al-link-card">
          <span className="al-link-card__emoji" aria-hidden>{link.emoji}</span>
          <span className="al-link-card__label">{link.label}</span>
          {link.hint ? <span className="al-link-card__hint">{link.hint}</span> : null}
        </NavLink>
      ))}
    </div>
  );
}
