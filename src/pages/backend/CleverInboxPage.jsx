import { useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useCleverInbox } from '../../context/CleverInboxContext.jsx';
import {
  INBOX_CATEGORY_FILTERS,
  buildInboxDemoItems,
  buildInboxPageSummary,
  getCategoryOpenCount,
} from '../../services/crm/cleverInboxService.js';
import { buildInboxActionAkteUrl } from '../../services/crm/cleverInboxQuestionRoute.js';
import CleverInboxCard from '../../components/backend/CleverInboxCard.jsx';
import '../../components/backend/CleverInbox.css';

const STATUS_TABS = [
  { id: 'open', label: 'Offen' },
  { id: 'done', label: 'Erledigt' },
];

function resolveCategoryCount(categoryId, filter) {
  if (categoryId === 'all') return 0;
  return getCategoryOpenCount(categoryId, filter);
}

export default function CleverInboxPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const leadId = searchParams.get('leadId');
  const showDemo = searchParams.get('demo') === '1';
  const [activeTab, setActiveTab] = useState('open');
  const [activeCategory, setActiveCategory] = useState('all');
  const [doneToast, setDoneToast] = useState('');
  const inbox = useCleverInbox();

  const listFilter = useMemo(() => ({
    status: activeTab,
    category: activeCategory,
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

  const items = useMemo(() => {
    const live = inbox.listItems(listFilter);
    if (live.length || !showDemo || activeTab !== 'open') return live;
    const demo = buildInboxDemoItems();
    if (activeCategory === 'all') return demo;
    const category = INBOX_CATEGORY_FILTERS.find((entry) => entry.id === activeCategory);
    if (!category?.types?.length) return demo;
    return demo.filter((item) => category.types.includes(item.type));
  }, [inbox, listFilter, showDemo, activeTab, activeCategory, inbox.version]);

  function handleAction(item) {
    if (!item.leadId || item.metadata?.demo) return;
    navigate(buildInboxActionAkteUrl(item.leadId, item));
  }

  function handleMarkDone(entry) {
    if (entry.metadata?.demo) return;
    inbox.markDone(entry.id);
    setDoneToast('Nachricht erledigt');
    window.setTimeout(() => setDoneToast(''), 2400);
  }

  const isEmptyOpen = activeTab === 'open' && items.length === 0;

  return (
    <div className="clever-inbox-page">
      <header className="clever-inbox-page__head">
        <Link to="/backend" className="clever-inbox-page__back">← Dashboard</Link>
        <h1 className="clever-inbox-page__title">Clever Eingang</h1>
        <p className="clever-inbox-page__sub">
          Kundenfragen, Angebotsreaktionen und neue Nachrichten.
        </p>
        <p className="clever-inbox-page__summary" aria-live="polite">
          {pageSummary.summaryLine}
        </p>
        {leadId && (
          <p className="clever-inbox-page__filter-hint">
            Gefiltert auf diese Kundenakte.
            {' '}
            <Link to="/backend/clever-eingang">Alle Nachrichten anzeigen</Link>
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
        {INBOX_CATEGORY_FILTERS.map((category) => {
          const count = activeTab === 'open'
            ? resolveCategoryCount(category.id, summaryFilter)
            : 0;
          return (
            <button
              key={category.id}
              type="button"
              className={`clever-inbox-page__category${activeCategory === category.id ? ' is-active' : ''}`}
              onClick={() => setActiveCategory(category.id)}
            >
              {category.label}
              {count > 0 && (
                <span className="clever-inbox-page__category-count">{count}</span>
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
            Aktuell gibt es keine offenen Kundenfragen oder Angebotsreaktionen.
          </p>
          <p className="clever-inbox-page__empty-hint">
            Neue Fragen aus Frag Clever, Kundenlinks und Unterlagen erscheinen hier automatisch.
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
      ) : items.length === 0 ? (
        <p className="clever-inbox-page__empty-done">
          Noch keine erledigten Nachrichten in dieser Ansicht.
        </p>
      ) : (
        <div className="clever-inbox-page__list">
          {items.map((item) => (
            <CleverInboxCard
              key={item.id}
              item={item}
              onAction={handleAction}
              onMarkDone={handleMarkDone}
            />
          ))}
        </div>
      )}
    </div>
  );
}
