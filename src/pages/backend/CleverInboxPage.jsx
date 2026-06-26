import { useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useCleverInbox } from '../../context/CleverInboxContext.jsx';
import { buildKundenaktePath } from '../../services/leadAkteEntry.js';
import CleverInboxCard from '../../components/backend/CleverInboxCard.jsx';
import '../../components/backend/CleverInbox.css';

const TABS = [
  { id: 'open', label: 'Offen' },
  { id: 'done', label: 'Erledigt' },
];

export default function CleverInboxPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const leadId = searchParams.get('leadId');
  const [activeTab, setActiveTab] = useState('open');
  const inbox = useCleverInbox();

  const items = useMemo(() => inbox.listItems({
    status: activeTab,
    leadId: leadId ?? undefined,
    customerId: leadId ?? undefined,
  }), [inbox, activeTab, leadId, inbox.version]);

  function handleAction(item) {
    if (item.actionTarget === 'reply') {
      if (item.leadId) {
        navigate(`${buildKundenaktePath(item.leadId)}?sheet=antworten`);
      }
      return;
    }
    if (item.actionTarget === 'documents' && item.leadId) {
      navigate(`${buildKundenaktePath(item.leadId)}?sheet=unterlagen`);
      return;
    }
    if (item.leadId) {
      navigate(buildKundenaktePath(item.leadId));
    }
  }

  return (
    <div className="clever-inbox-page">
      <header className="clever-inbox-page__head">
        <Link to="/backend" className="backend-home__kpi-link">← Dashboard</Link>
        <h1 className="clever-inbox-page__title">Clever Eingang</h1>
        <p className="clever-inbox-page__sub">
          Kundenfragen, Reaktionen und neue Signale aus Kundenlinks.
        </p>
        {leadId && (
          <p className="clever-inbox-page__filter-hint">
            Gefiltert auf diese Kundenakte.
            {' '}
            <Link to="/backend/clever-eingang">Alle Meldungen anzeigen</Link>
          </p>
        )}
      </header>

      <div className="clever-inbox-page__tabs" role="tablist" aria-label="Clever Eingang Filter">
        {TABS.map((tab) => (
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

      {items.length === 0 ? (
        <p className="clever-inbox-page__empty">
          {activeTab === 'open'
            ? 'Keine offenen Meldungen – alles erledigt.'
            : 'Noch keine erledigten Meldungen.'}
        </p>
      ) : (
        <div className="clever-inbox-page__list">
          {items.map((item) => (
            <CleverInboxCard
              key={item.id}
              item={item}
              onAction={handleAction}
              onMarkDone={(entry) => inbox.markDone(entry.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
