import { useNavigate, Link } from 'react-router-dom';
import { useLeads } from '../../context/LeadsContext.jsx';
import {
  recordRecentCustomerOpen,
  resolveCustomerOpenAction,
} from '../../services/crm/customerSearchService.js';
import { buildKundenaktePath } from '../../services/leadAkteEntry.js';
import BackendCustomerSearch from './BackendCustomerSearch.jsx';
import BackendRecentCustomers from './BackendRecentCustomers.jsx';
import BackendHomeToday from './BackendHomeToday.jsx';
import '../showroom/showroom-mode.css';
import './BackendHome.css';

const SALES_ENTRIES = [
  {
    id: 'advice',
    to: '/verkaufsassistent',
    icon: '💬',
    title: 'Clever Beratung',
    text: 'Kundenwunsch eingeben, einfügen oder per Mikrofon erfassen.',
    className: '',
  },
  {
    id: 'showroom',
    to: '/verkaufsassistent?view=showroom',
    icon: '📱',
    title: 'Showroom Modus',
    text: 'Mobiler Schnellmodus am Auto, im Showroom oder spontan im Gespräch.',
    className: 'backend-home__entry-card--showroom',
  },
  {
    id: 'model',
    to: '/verkaufsassistent?view=model',
    icon: '🚗',
    title: 'Modell wählen',
    text: 'Direkte Modellauswahl, wenn der Kunde schon weiß, welches Modell ihn interessiert.',
    className: '',
  },
];

export default function BackendHome() {
  const navigate = useNavigate();
  const { leads } = useLeads();

  function handleOpenCustomerRecord(leadId) {
    const { action, leadId: resolvedId } = resolveCustomerOpenAction(leadId, leads);
    if (action !== 'open' || !resolvedId) return;
    const lead = leads.find((item) => item.id === resolvedId);
    if (lead) recordRecentCustomerOpen(lead);
    navigate(buildKundenaktePath(resolvedId));
  }

  return (
    <div className="backend-home backend-home--calm">
      <section className="backend-home__advisor-hero" aria-labelledby="advisor-hero-title">
        <div className="backend-home__advisor-hero-inner">
          <h2 id="advisor-hero-title" className="backend-home__advisor-title">
            Was möchten Sie tun?
          </h2>
          <p className="backend-home__advisor-subline">
            Kunde finden oder neuen Verkaufsfall starten.
          </p>

          <BackendCustomerSearch
            leads={leads}
            onOpenCustomerRecord={handleOpenCustomerRecord}
            variant="hero"
          />

          <div className="backend-home__entry-grid" aria-label="Verkaufen Einstiege">
            {SALES_ENTRIES.map((entry) => (
              <Link
                key={entry.id}
                to={entry.to}
                className={`backend-home__entry-card${entry.className ? ` ${entry.className}` : ''}`}
              >
                <span className="backend-home__entry-icon" aria-hidden>{entry.icon}</span>
                <h3 className="backend-home__entry-title">{entry.title}</h3>
                <p className="backend-home__entry-text">{entry.text}</p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <BackendRecentCustomers
        leads={leads}
        onOpenCustomerRecord={handleOpenCustomerRecord}
      />

      <BackendHomeToday leads={leads} />
    </div>
  );
}
