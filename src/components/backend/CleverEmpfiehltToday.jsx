import { Link, useNavigate } from 'react-router-dom';
import { buildKundenaktePath } from '../../services/leadAkteEntry.js';
import { useCleverComposerOptional } from '../../context/CleverComposerContext.jsx';
import { resolveEmpfiehltCleverAction } from '../../logic/backendHomeEmpfiehltActions.js';
import {
  IconFile,
  IconPhone,
  IconSparkle,
  IconUser,
} from '../dealer-ai/AkteIcons.jsx';
import './CleverEmpfiehltToday.css';

function isTelHref(href) {
  return Boolean(href && /^tel:/i.test(String(href)));
}

function shortCtaLabel(label = '') {
  const raw = String(label || 'Öffnen').trim();
  const short = raw
    .replace(/^angebot prüfen und senden$/i, 'Angebot öffnen')
    .replace(/^unterlagen anfordern$/i, 'Unterlagen fehlen')
    .replace(/^unterlagen prüfen$/i, 'Unterlagen fehlen')
    .replace(/^heute nachfassen$/i, 'Heute nachfassen')
    .replace(/^öffnen und erledigen$/i, 'Öffnen');
  return /[>›]$/.test(short) ? short : `${short} ›`;
}

function resolveItemIcon(item = {}) {
  const blob = `${item.actionId || ''} ${item.ctaLabel || ''} ${item.headline || ''}`.toLowerCase();
  if (/call|anruf|tel:|phone/.test(blob) || isTelHref(item.ctaHref)) return IconPhone;
  if (/document|unterlagen|docs/.test(blob)) return IconUser;
  return IconFile;
}

function resolveIconTone(item = {}) {
  const blob = `${item.actionId || ''} ${item.ctaLabel || ''} ${item.headline || ''}`.toLowerCase();
  if (/call|anruf|tel:|phone/.test(blob) || isTelHref(item.ctaHref)) return 'green';
  if (/document|unterlagen|docs/.test(blob)) return 'orange';
  return 'purple';
}

export default function CleverEmpfiehltToday({ items = [], variant = 'default' }) {
  const isHome = variant === 'home';
  const navigate = useNavigate();
  const composerCtx = useCleverComposerOptional();
  const visible = isHome ? items.slice(0, 3) : items;
  const sectionClass = [
    'clever-today',
    isHome ? 'clever-today--home backend-home__widget' : '',
  ].filter(Boolean).join(' ');

  function continueCleverAction(item) {
    const resolved = resolveEmpfiehltCleverAction(item);
    if (resolved.kind === 'tel' && resolved.href) {
      window.location.href = resolved.href;
      return;
    }
    if (resolved.kind === 'run_turn' && resolved.leadId && resolved.sellerInput) {
      if (typeof composerCtx?.requestComposerAction === 'function') {
        composerCtx.requestComposerAction({
          type: 'run_turn',
          leadId: resolved.leadId,
          sellerInput: resolved.sellerInput,
        });
        return;
      }
    }
    // Fallback: Akte nur wenn kein Clever-Pfad verfügbar
    if (resolved.leadId) {
      navigate(buildKundenaktePath(resolved.leadId));
    }
  }

  function renderCta(item, cta) {
    const callHref = isTelHref(item.ctaHref) ? item.ctaHref : null;
    if (callHref) {
      return (
        <a href={callHref} className="clever-today__action clever-today__action--cta">
          {cta}
        </a>
      );
    }
    return (
      <button
        type="button"
        className="clever-today__action clever-today__action--cta"
        onClick={() => continueCleverAction(item)}
      >
        {cta}
      </button>
    );
  }

  if (!visible.length) {
    return (
      <section className={sectionClass} aria-labelledby="clever-today-title">
        <div className="clever-today__head">
          {isHome ? (
            <span className="backend-home__widget-icon" aria-hidden>
              <IconSparkle />
            </span>
          ) : null}
          <h2 id="clever-today-title" className={isHome ? 'backend-home__widget-title' : 'clever-today__title'}>
            Clever empfiehlt heute
          </h2>
        </div>
        <p className="clever-today__empty">Aktuell keine offenen Aufgaben.</p>
        {isHome ? (
          <Link to="/backend/verkaufschancen" className="backend-home__widget-link">
            Alle anzeigen ›
          </Link>
        ) : null}
      </section>
    );
  }

  return (
    <section className={sectionClass} aria-labelledby="clever-today-title">
      <div className="clever-today__head">
        {isHome ? (
          <span className="backend-home__widget-icon" aria-hidden>
            <IconSparkle />
          </span>
        ) : null}
        <h2 id="clever-today-title" className={isHome ? 'backend-home__widget-title' : 'clever-today__title'}>
          Clever empfiehlt heute
        </h2>
        {!isHome ? (
          <p className="clever-today__sub">Von oben nach unten – die wichtigste Arbeit zuerst.</p>
        ) : null}
      </div>

      <ol className={`clever-today__list${isHome ? ' clever-today__list--home' : ''}`}>
        {visible.map((item, index) => {
          const why = isHome ? '' : (item.whySummary || '');
          const cta = isHome
            ? shortCtaLabel(item.ctaLabel || item.headline)
            : (item.ctaLabel || item.headline || 'Öffnen und erledigen');
          const aktePath = buildKundenaktePath(item.leadId);
          const ItemIcon = resolveItemIcon(item);
          const tone = resolveIconTone(item);

          if (isHome) {
            return (
              <li key={item.leadId} className="clever-today__home-row">
                <span className={`clever-today__home-icon clever-today__home-icon--${tone}`} aria-hidden>
                  <ItemIcon />
                </span>
                <div className="clever-today__home-body">
                  <p className="clever-today__home-name">{item.customerName}</p>
                  {renderCta(item, cta)}
                </div>
              </li>
            );
          }

          return (
            <li key={item.leadId} className="clever-today__card">
              <span className="clever-today__rank" aria-hidden>{index + 1}</span>
              <div className="clever-today__body">
                <div className="clever-today__row">
                  <Link to={aktePath} className="clever-today__name-link">
                    <p className="clever-today__name">{item.customerName}</p>
                  </Link>
                  {item.dueTodayBadge ? (
                    <span className="clever-today__due-badge">{item.dueTodayBadge}</span>
                  ) : null}
                </div>
                {why ? (
                  <Link to={aktePath} className="clever-today__why-link">
                    <p className="clever-today__why">{why}</p>
                  </Link>
                ) : null}
                {renderCta(item, cta)}
              </div>
              <Link
                to={aktePath}
                className="clever-today__chevron"
                aria-label={`${item.customerName} öffnen`}
              >
                →
              </Link>
            </li>
          );
        })}
      </ol>

      {isHome && items.length > 3 ? (
        <Link to="/backend/verkaufschancen" className="backend-home__widget-link">
          Alle anzeigen ›
        </Link>
      ) : null}
    </section>
  );
}
