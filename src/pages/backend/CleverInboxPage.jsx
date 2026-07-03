import { useMemo, useRef, useState } from 'react';

import { Link, useNavigate, useSearchParams } from 'react-router-dom';

import { useCleverInbox } from '../../context/CleverInboxContext.jsx';

import {

  INBOX_CATEGORY_FILTERS,

  buildInboxDemoItems,

  buildInboxPageSummary,

  getCategoryOpenCount,

} from '../../services/crm/cleverInboxService.js';

import {

  buildInboxHeroSummary,

  buildInboxWorkCards,

  filterWorkCardsByTodayImportant,

} from '../../services/crm/inboxWorkCardModel.js';

import { buildInboxActionAkteUrl } from '../../services/crm/cleverInboxQuestionRoute.js';

import CleverInboxCard from '../../components/backend/CleverInboxCard.jsx';
import PasteInquiryCapture from '../../components/dealer-ai/PasteInquiryCapture.jsx';

import '../../components/backend/CleverInbox.css';



const STATUS_TABS = [

  { id: 'open', label: 'Offen' },

  { id: 'done', label: 'Erledigt' },

];



const TODAY_IMPORTANT_FILTER = {

  id: 'today',

  label: 'Heute wichtig',

};



function resolveCategoryCount(categoryId, filter) {

  if (categoryId === 'all' || categoryId === 'today') return 0;

  return getCategoryOpenCount(categoryId, filter);

}



export default function CleverInboxPage() {

  const navigate = useNavigate();

  const listRef = useRef(null);

  const [searchParams] = useSearchParams();

  const leadId = searchParams.get('leadId');

  const showDemo = searchParams.get('demo') === '1';

  const [activeTab, setActiveTab] = useState('open');

  const [activeCategory, setActiveCategory] = useState('all');

  const [doneToast, setDoneToast] = useState('');

  const inbox = useCleverInbox();



  const listFilter = useMemo(() => ({

    status: activeTab,

    category: activeCategory === 'today' ? 'all' : activeCategory,

    leadId: leadId ?? undefined,

    customerId: leadId ?? undefined,

  }), [activeTab, activeCategory, leadId]);



  const summaryFilter = useMemo(() => ({

    leadId: leadId ?? undefined,

    customerId: leadId ?? undefined,

  }), [leadId]);



  const pageSummary = useMemo(

    () => buildInboxPageSummary(summaryFilter),

    [summaryFilter, inbox.version],

  );



  const heroSummary = useMemo(

    () => buildInboxHeroSummary(pageSummary.openItems, {

      questionCount: pageSummary.questionCount,

      documentCount: pageSummary.documentCount,

    }),

    [pageSummary, inbox.version],

  );



  const rawItems = useMemo(() => {

    const live = inbox.listItems(listFilter);

    if (live.length || !showDemo || activeTab !== 'open') return live;

    const demo = buildInboxDemoItems();

    if (activeCategory === 'all' || activeCategory === 'today') return demo;

    const category = INBOX_CATEGORY_FILTERS.find((entry) => entry.id === activeCategory);

    if (!category?.types?.length) return demo;

    return demo.filter((item) => category.types.includes(item.type));

  }, [inbox, listFilter, showDemo, activeTab, activeCategory, inbox.version]);



  const workCards = useMemo(() => {

    const cards = buildInboxWorkCards(rawItems);

    if (activeCategory === 'today') {

      return filterWorkCardsByTodayImportant(cards);

    }

    return cards;

  }, [rawItems, activeCategory]);



  function handleAction(item) {

    if (!item.leadId || item.metadata?.demo) return;

    navigate(buildInboxActionAkteUrl(item.leadId, item));

  }



  function handleMarkDone(workCard) {

    const entries = workCard?.groupItems ?? [workCard?.primaryItem].filter(Boolean);

    if (!entries.length || entries[0]?.metadata?.demo) return;

    entries.forEach((entry) => {

      if (entry?.id) inbox.markDone(entry.id);

    });

    setDoneToast('Arbeitskarte erledigt');

    window.setTimeout(() => setDoneToast(''), 2400);

  }



  function handleStartPrimary() {

    const primary = heroSummary.primaryWorkCard;

    if (!primary) return;

    const el = document.getElementById(`inbox-work-card-${primary.id}`);

    if (el) {

      el.scrollIntoView({ behavior: 'smooth', block: 'center' });

      el.classList.add('clever-inbox-card--highlight');

      window.setTimeout(() => el.classList.remove('clever-inbox-card--highlight'), 1600);

      return;

    }

    handleAction(primary.primaryItem);

  }



  const isEmptyOpen = activeTab === 'open' && workCards.length === 0;

  const showHero = activeTab === 'open';



  return (

    <div className="clever-inbox-page" ref={listRef}>

      <header className="clever-inbox-page__head">

        <Link to="/backend" className="clever-inbox-page__back">← Dashboard</Link>

        <h1 className="clever-inbox-page__title">Clever Eingang</h1>

        <PasteInquiryCapture compact />

        {showHero && (

          <section className="clever-inbox-page__hero" aria-label="Heute wichtig">

            <p className="clever-inbox-page__hero-kicker">Heute wichtig</p>

            <p className="clever-inbox-page__hero-line" aria-live="polite">

              {heroSummary.heroLine}

            </p>

            <p className="clever-inbox-page__sub">

              Clever sortiert nach dem nächsten besten Schritt.

            </p>



            <div className="clever-inbox-page__stat-cards">

              {heroSummary.statCards.map((stat) => (

                <div key={stat.id} className="clever-inbox-page__stat-card">

                  <span className="clever-inbox-page__stat-label">{stat.label}</span>

                  <strong className="clever-inbox-page__stat-value">{stat.count}</strong>

                </div>

              ))}

            </div>



            {heroSummary.primaryWorkCard && (

              <button

                type="button"

                className="clever-inbox-page__hero-cta"

                onClick={handleStartPrimary}

              >

                Jetzt zuerst bearbeiten

              </button>

            )}

          </section>

        )}



        {!showHero && (

          <p className="clever-inbox-page__sub">

            Erledigte Kundenfragen, Angebotsreaktionen und Unterlagen.

          </p>

        )}



        {leadId && (

          <p className="clever-inbox-page__filter-hint">

            Gefiltert auf diese Kundenakte.

            {' '}

            <Link to="/backend/clever-eingang">Alle Arbeitskarten anzeigen</Link>

          </p>

        )}

        {showDemo && (

          <p className="clever-inbox-page__demo-hint">Demo-Vorschau aktiv</p>

        )}

      </header>



      <div className="clever-inbox-page__status-row">

        <div className="clever-inbox-page__tabs" role="tablist" aria-label="Clever Eingang Status">

          {STATUS_TABS.map((tab) => (

            <button

              key={tab.id}

              type="button"

              role="tab"

              aria-selected={activeTab === tab.id}

              className={`clever-inbox-page__tab clever-inbox-page__tab--main${activeTab === tab.id ? ' is-active' : ''}`}

              onClick={() => setActiveTab(tab.id)}

            >

              {tab.label}

            </button>

          ))}

        </div>

      </div>



      <div className="clever-inbox-page__categories" aria-label="Clever Eingang Kategorien">

        {[...INBOX_CATEGORY_FILTERS, TODAY_IMPORTANT_FILTER].map((category) => {

          const count = activeTab === 'open'

            ? resolveCategoryCount(category.id, summaryFilter)

            : 0;

          const todayCount = category.id === 'today' && activeTab === 'open'

            ? filterWorkCardsByTodayImportant(heroSummary.workCards).length

            : 0;

          const displayCount = category.id === 'today' ? todayCount : count;

          return (

            <button

              key={category.id}

              type="button"

              className={`clever-inbox-page__category${activeCategory === category.id ? ' is-active' : ''}${category.id === 'today' ? ' clever-inbox-page__category--today' : ''}`}

              onClick={() => setActiveCategory(category.id)}

            >

              {category.label}

              {displayCount > 0 && (

                <span className="clever-inbox-page__category-count">{displayCount}</span>

              )}

            </button>

          );

        })}

      </div>



      {doneToast && (

        <p className="clever-inbox-page__toast" role="status">{doneToast}</p>

      )}



      {isEmptyOpen ? (

        <section className="clever-inbox-page__empty-state" aria-labelledby="clever-inbox-empty-title">

          <div className="clever-inbox-page__empty-icon" aria-hidden>✓</div>

          <h2 id="clever-inbox-empty-title" className="clever-inbox-page__empty-title">

            Alles erledigt

          </h2>

          <p className="clever-inbox-page__empty-text">

            Keine offenen Kundenfragen oder Angebotsreaktionen.

          </p>

          <p className="clever-inbox-page__empty-hint">

            Neue Nachrichten, Angebotsreaktionen und Unterlagen erscheinen hier automatisch.

          </p>

          <div className="clever-inbox-page__empty-actions">

            <Link to="/backend" className="clever-inbox-page__empty-cta clever-inbox-page__empty-cta--secondary">

              Zurück zum Dashboard

            </Link>

            <Link to="/verkaufsassistent" className="clever-inbox-page__empty-cta">

              Clever Berater starten

            </Link>

          </div>

        </section>

      ) : workCards.length === 0 ? (

        <p className="clever-inbox-page__empty-done">

          Noch keine erledigten Arbeitskarten in dieser Ansicht.

        </p>

      ) : (

        <div className="clever-inbox-page__list">

          {workCards.map((workCard) => (

            <CleverInboxCard

              key={workCard.id}

              workCard={workCard}

              onAction={handleAction}

              onMarkDone={handleMarkDone}

            />

          ))}

        </div>

      )}

    </div>

  );

}

