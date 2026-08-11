import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useOffers } from '../../context/OffersContext.jsx';
import { useCommunication } from '../../context/CommunicationContext.jsx';
import { useCleverComposerOptional } from '../../context/CleverComposerContext.jsx';
import {
  IconBriefcase,
  IconInbox,
} from '../dealer-ai/AkteIcons.jsx';
import {
  buildBackendHomeEingangStats,
  buildBackendHomeWorkStats,
} from '../../logic/backendHomeStats.js';
import CleverEmpfiehltToday from './CleverEmpfiehltToday.jsx';
import './BackendHome.css';

export function CleverEingangHomeCard({ leads = [] }) {
  const stats = useMemo(() => buildBackendHomeEingangStats(leads), [leads]);
  const alert = stats.needsDecision > 0 || stats.unreadCount > 0;

  return (
    <article
      className={`backend-home__widget${alert ? ' backend-home__widget--alert' : ''}`}
      aria-label="Clever Eingang"
    >
      <header className="backend-home__widget-head">
        <span className="backend-home__widget-icon" aria-hidden>
          <IconInbox />
        </span>
        <h2 className="backend-home__widget-title">Clever Eingang</h2>
      </header>
      <p className="backend-home__widget-stat">{stats.needsYouLabel}</p>
      <ul className="backend-home__eingang-breakdown" aria-label="Entscheidung">
        {stats.breakdown.map((bucket) => (
          <li key={bucket.id}>
            <Link
              to={bucket.to}
              className="backend-home__eingang-bucket"
            >
              <strong>{bucket.count}</strong>
              <span>{bucket.label}</span>
            </Link>
          </li>
        ))}
      </ul>
      <Link to="/backend/clever-eingang" className="backend-home__widget-link">
        Zum Eingang ›
      </Link>
    </article>
  );
}

export function MeineArbeitHomeCard({ leads = [] }) {
  const { offers } = useOffers();
  const { getDueToday } = useCommunication();
  const composerCtx = useCleverComposerOptional();
  const dueToday = getDueToday?.() ?? [];
  const work = useMemo(
    () => buildBackendHomeWorkStats(leads, offers, dueToday),
    [leads, offers, dueToday],
  );

  function openTodayOverview(event) {
    event.preventDefault();
    if (typeof composerCtx?.requestComposerAction === 'function') {
      composerCtx.requestComposerAction({
        type: 'today_overview',
        sellerInput: 'Was liegt heute an?',
      });
      return;
    }
  }

  return (
    <article className="backend-home__widget" aria-label="Meine Arbeit">
      <header className="backend-home__widget-head">
        <span className="backend-home__widget-icon" aria-hidden>
          <IconBriefcase />
        </span>
        <h2 className="backend-home__widget-title">Meine Arbeit</h2>
      </header>
      <div className="backend-home__work-stats" role="list">
        <Link
          to={work.links.offers}
          className="backend-home__work-stat backend-home__work-stat--link"
          role="listitem"
        >
          <strong>{work.offers}</strong>
          <span>Angebote</span>
        </Link>
        <Link
          to={work.links.dueToday}
          className="backend-home__work-stat backend-home__work-stat--link"
          role="listitem"
        >
          <strong>{work.dueToday}</strong>
          <span>heute fällig</span>
        </Link>
        <button
          type="button"
          className="backend-home__work-stat backend-home__work-stat--link"
          role="listitem"
          onClick={openTodayOverview}
        >
          <strong>{work.appointmentsToday}</strong>
          <span>Termine heute</span>
        </button>
      </div>
      {work.secondaryLabel ? (
        <p className="backend-home__work-secondary">{work.secondaryLabel}</p>
      ) : null}
      <Link to="/backend/verkaufschancen" className="backend-home__widget-link">
        Meine Übersicht ›
      </Link>
    </article>
  );
}

export default function BackendHomeWidgets({ leads = [], empfiehltItems = [] }) {
  return (
    <section className="backend-home__widgets" aria-label="Übersicht">
      <CleverEingangHomeCard leads={leads} />
      <CleverEmpfiehltToday items={empfiehltItems} variant="home" />
      <MeineArbeitHomeCard leads={leads} />
    </section>
  );
}
