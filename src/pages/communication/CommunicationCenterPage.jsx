import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import { useCommunication } from '../../context/CommunicationContext.jsx';
import { PILOT_LEAD_ID } from '../../data/demoLeads.js';
import {
  SALES_CHANCE_LIST_FILTERS,
  ASSIGNMENT_FILTERS,
  DEALER_SELLERS,
} from '../../data/salesChanceTypes.js';
import SalesChanceListItem from '../../components/sales-chance/SalesChanceListItem.jsx';
import SalesChanceDossier from '../../components/sales-chance/SalesChanceDossier.jsx';
import CommunicationTimeline from '../../components/communication/CommunicationTimeline.jsx';
import CommunicationComposer from '../../components/communication/CommunicationComposer.jsx';
import './CommunicationCenterPage.css';

const TABS = [
  { id: 'messages', label: 'Nachrichten' },
  { id: 'offers', label: 'Angebote' },
  { id: 'documents', label: 'Dokumente' },
  { id: 'all', label: 'Historie' },
];

export default function CommunicationCenterPage() {
  const {
    leads,
    getDueToday,
    getKpis,
    updateLeadStatus,
    currentSellerId,
    setCurrentSellerId,
  } = useCommunication();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const [filter, setFilter] = useState('all');
  const [assignmentFilter, setAssignmentFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState(searchParams.get('leadId'));
  const [activeTab, setActiveTab] = useState('messages');
  const [toast, setToast] = useState('');
  const composerRef = useRef(null);

  const dueToday = getDueToday();
  const kpis = getKpis();

  useEffect(() => {
    if (location.state?.selectedLeadId) {
      setSelectedId(location.state.selectedLeadId);
    } else if (location.state?.openPilot) {
      setSelectedId(PILOT_LEAD_ID);
    }
    if (location.state?.filter) {
      setFilter(location.state.filter);
    }
  }, [location.state]);

  useEffect(() => {
    const id = searchParams.get('leadId');
    if (id) setSelectedId(id);
  }, [searchParams]);

  useEffect(() => {
    if (selectedId) {
      setSearchParams({ leadId: selectedId }, { replace: true });
    }
  }, [selectedId, setSearchParams]);

  const filtered = useMemo(() => {
    let list = [...leads].sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
    if (filter !== 'all') list = list.filter((l) => l.status === filter);
    if (assignmentFilter === 'mine') {
      list = list.filter((l) => l.ownerId === currentSellerId);
    } else if (assignmentFilter === 'unassigned') {
      list = list.filter((l) => !l.ownerId);
    }
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (l) =>
          l.contact.name?.toLowerCase().includes(q)
          || l.contact.email?.toLowerCase().includes(q)
          || l.contact.phone?.includes(q)
          || l.vehicle?.label?.toLowerCase().includes(q)
          || l.ownerName?.toLowerCase().includes(q),
      );
    }
    return list;
  }, [leads, filter, assignmentFilter, search, currentSellerId]);

  const selectedLead = leads.find((l) => l.id === selectedId) ?? null;
  const neuCount = leads.filter((l) => l.status === 'neu').length;

  function showToast(msg) {
    setToast(msg);
    setTimeout(() => setToast(''), 2800);
  }

  async function handleStatusChange(status) {
    if (!selectedLead) return;
    await updateLeadStatus(selectedLead.id, status);
    showToast('Status der Verkaufschance aktualisiert');
  }

  function scrollToComposer() {
    composerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }

  return (
    <div className="comm-center">
      <aside className={`comm-center__list${selectedId ? ' comm-center__list--narrow' : ''}`}>
        <header className="comm-center__header">
          <div className="comm-center__header-top">
            <Link to="/backend" className="comm-center__back">←</Link>
            <h1 className="comm-center__title">Verkaufschancen</h1>
            {neuCount > 0 && <span className="comm-center__badge">{neuCount}</span>}
          </div>
          <input
            type="search"
            className="comm-center__search"
            placeholder="Verkaufschance suchen…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </header>

        <div className="comm-center__seller">
          <label>
            Ich bin
            <select
              value={currentSellerId}
              onChange={(e) => setCurrentSellerId(e.target.value)}
            >
              {DEALER_SELLERS.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </label>
        </div>

        {dueToday.length > 0 && (
          <div className="comm-center__due">
            <strong>Heute fällig ({dueToday.length})</strong>
            <ul>
              {dueToday.slice(0, 3).map((r) => (
                <li key={r.id}>
                  <button type="button" onClick={() => setSelectedId(r.leadId)}>
                    {r.label}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="comm-center__assign-filters" role="tablist">
          {ASSIGNMENT_FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              className={`comm-center__filter comm-center__filter--assign${assignmentFilter === f.id ? ' is-active' : ''}`}
              onClick={() => setAssignmentFilter(f.id)}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div className="comm-center__filters" role="tablist">
          {SALES_CHANCE_LIST_FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              className={`comm-center__filter${filter === f.id ? ' is-active' : ''}`}
              onClick={() => setFilter(f.id)}
            >
              {f.label}
            </button>
          ))}
        </div>

        <ul className="comm-center__leads">
          {filtered.map((lead) => (
            <li key={lead.id}>
              <SalesChanceListItem
                lead={lead}
                isActive={lead.id === selectedId}
                onClick={() => setSelectedId(lead.id)}
              />
            </li>
          ))}
        </ul>
      </aside>

      <main className={`comm-center__profile${!selectedId ? ' comm-center__profile--hidden-mobile' : ''}`}>
        {selectedId && (
          <button
            type="button"
            className="comm-center__mobile-back"
            onClick={() => setSelectedId(null)}
          >
            ← Verkaufschancen
          </button>
        )}
        <SalesChanceDossier
          lead={selectedLead}
          onStatusChange={selectedLead ? handleStatusChange : undefined}
          onScrollToComposer={scrollToComposer}
          onToast={showToast}
        />
      </main>

      <section className={`comm-center__comm${!selectedId ? ' comm-center__comm--hidden-mobile' : ''}`}>
        <header className="comm-center__comm-head">
          <h2>Kommunikationscenter</h2>
          {selectedLead && (
            <span className="comm-center__comm-sub">{selectedLead.contact.name}</span>
          )}
        </header>

        <div className="comm-center__kpis">
          <span>{kpis.emailsSent} Mails</span>
          <span>{kpis.whatsappsSent} WA</span>
          <span>{kpis.offersSent} Angebote</span>
          <span>{kpis.conversionRate}% Conv.</span>
        </div>

        <div className="comm-center__tabs" role="tablist">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              className={`comm-center__tab${activeTab === tab.id ? ' is-active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="comm-center__timeline-wrap">
          <CommunicationTimeline
            history={selectedLead?.history ?? []}
            activeTab={activeTab}
          />
        </div>

        <div ref={composerRef}>
          <CommunicationComposer lead={selectedLead} onToast={showToast} />
        </div>
      </section>

      {toast && <p className="comm-center__toast" role="status">{toast}</p>}
    </div>
  );
}
