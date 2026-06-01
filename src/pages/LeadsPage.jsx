import { useMemo, useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useLeads } from '../context/LeadsContext.jsx';
import { PILOT_LEAD_ID } from '../data/demoLeads.js';
import { LEAD_STATUS, LEAD_STATUS_ORDER } from '../data/leadTypes.js';
import LeadListItem from '../components/leads/LeadListItem.jsx';
import LeadDetail from '../components/leads/LeadDetail.jsx';
import './LeadsPage.css';

export default function LeadsPage() {
  const { leads } = useLeads();
  const location = useLocation();
  const [filter, setFilter] = useState('all');
  const [selectedId, setSelectedId] = useState(null);
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (location.state?.selectedLeadId) {
      setSelectedId(location.state.selectedLeadId);
    } else if (location.state?.openPilot) {
      setSelectedId(PILOT_LEAD_ID);
    }
  }, [location.state]);

  const filtered = useMemo(() => {
    let list = [...leads].sort((a, b) => {
      if (a.pilot && !b.pilot) return -1;
      if (!a.pilot && b.pilot) return 1;
      return new Date(b.updatedAt) - new Date(a.updatedAt);
    });

    if (filter !== 'all') {
      list = list.filter((l) => l.status === filter);
    }

    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (l) =>
          l.contact.name?.toLowerCase().includes(q)
          || l.contact.email?.toLowerCase().includes(q)
          || l.contact.phone?.includes(q)
          || l.vehicle?.label?.toLowerCase().includes(q),
      );
    }

    return list;
  }, [leads, filter, search]);

  const selectedLead = leads.find((l) => l.id === selectedId) ?? null;
  const neuCount = leads.filter((l) => l.status === 'neu').length;

  return (
    <div className="leads-page">
      <aside className={`leads-page__list${selectedId ? ' leads-page__list--hidden-mobile' : ''}`}>
        <header className="leads-page__header">
          <div className="leads-page__header-top">
            <Link to="/backend" className="leads-page__back">←</Link>
            <h1 className="leads-page__title">Leadcenter (klassisch)</h1>
            {neuCount > 0 && (
              <span className="leads-page__badge">{neuCount}</span>
            )}
            <Link to="/communication" className="leads-page__templates" title="Sales Communication">
              💬
            </Link>
          </div>
          <input
            type="search"
            className="leads-page__search"
            placeholder="Suchen…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </header>

        <div className="leads-page__filters" role="tablist">
          <button
            type="button"
            className={`leads-page__filter${filter === 'all' ? ' is-active' : ''}`}
            onClick={() => setFilter('all')}
          >
            Alle ({leads.length})
          </button>
          {LEAD_STATUS_ORDER.map((key) => {
            const count = leads.filter((l) => l.status === key).length;
            if (count === 0 && filter !== key) return null;
            const s = LEAD_STATUS[key];
            return (
              <button
                key={key}
                type="button"
                className={`leads-page__filter${filter === key ? ' is-active' : ''}`}
                onClick={() => setFilter(key)}
                style={{ '--filter-color': s.color }}
              >
                {s.label} ({count})
              </button>
            );
          })}
        </div>

        <div className="leads-page__items">
          {filtered.length === 0 ? (
            <p className="leads-page__empty">Keine Leads in dieser Ansicht.</p>
          ) : (
            filtered.map((lead) => (
              <LeadListItem
                key={lead.id}
                lead={lead}
                isActive={lead.id === selectedId}
                onClick={() => setSelectedId(lead.id)}
              />
            ))
          )}
        </div>
      </aside>

      <main className={`leads-page__detail${selectedId ? ' leads-page__detail--open' : ''}`}>
        {selectedLead ? (
          <LeadDetail
            lead={selectedLead}
            onBack={() => setSelectedId(null)}
          />
        ) : (
          <div className="leads-page__placeholder">
            <span className="leads-page__placeholder-icon">💬</span>
            <p>Lead auswählen, um Details zu sehen</p>
          </div>
        )}
      </main>
    </div>
  );
}
