import { useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useCleverInbox } from '../../context/CleverInboxContext.jsx';
import { INBOX_CATEGORY_FILTERS } from '../../services/crm/cleverInboxService.js';
import { buildInboxActionAkteUrl } from '../../services/crm/cleverInboxQuestionRoute.js';
import CleverInboxCard from '../../components/backend/CleverInboxCard.jsx';
import '../../components/backend/CleverInbox.css';

const STATUS_TABS = [
  { id: 'open', label: 'Offen' },
  { id: 'done', label: 'Erledigt' },
];

export default function CleverInboxPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const leadId = searchParams.get('leadId');
  const [activeTab, setActiveTab] = useState('open');
  const [activeCategory, setActiveCategory] = useState('all');
  const inbox = useCleverInbox();

  const items = useMemo(() => inbox.listItems({
    status: activeTab,
    category: activeCategory,
    leadId: leadId ?? undefined,
    customerId: leadId ?? undefined,
  }), [inbox, activeTab, activeCategory, leadId, inbox.version]);

  function handleAction(item) {
    if (!item.leadId) return;
    navigate(buildInboxActionAkteUrl(item.leadId, item));
  }

  function handleSecondaryAction(item) {
    if (!item.leadId) return;
    navigate(buildInboxActionAkteUrl(item.leadId, item, { secondary: true }));
  }

  return (
    <div className="clever-inbox-page">
      <header className="clever-inbox-page__head">
        <Link to="/backend" className="backend-home__kpi-link">← Dashboard</Link>
        <h1 className="clever-inbox-page__title">Clever Eingang</h1>
        <p className="clever-inbox-page__sub">
          Kundenfragen, Angebotsreaktionen und neue Nachrichten.
        </p>
        {leadId && (
          <p className="clever-inbox-page__filter-hint">
            Gefiltert auf diese Kundenakte.
            {' '}
            <Link to="/backend/clever-eingang">Alle Nachrichten anzeigen</Link>
          </p>
        )}
      </header>

      <div className="clever-inbox-page__tabs" role="tablist" aria-label="Clever Eingang Status">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.id}
            className={`clever-inbox-page__tab${activeTab === tab.id ? ' is-active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="clever-inbox-page__categories" aria-label="Clever Eingang Kategorien">
        {INBOX_CATEGORY_FILTERS.map((category) => (
          <button
            key={category.id}
            type="button"
            className={`clever-inbox-page__category${activeCategory === category.id ? ' is-active' : ''}`}
            onClick={() => setActiveCategory(category.id)}
          >
            {category.label}
          </button>
        ))}
      </div>

      {items.length === 0 ? (
        <p className="clever-inbox-page__empty">
          {activeTab === 'open'
            ? 'Keine offenen Nachrichten – alles erledigt.'
            : 'Noch keine erledigten Nachrichten.'}
        </p>
      ) : (
        <div className="clever-inbox-page__list">
          {items.map((item) => (
            <CleverInboxCard
              key={item.id}
              item={item}
              onAction={handleAction}
              onSecondaryAction={handleSecondaryAction}
              onMarkDone={(entry) => inbox.markDone(entry.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
