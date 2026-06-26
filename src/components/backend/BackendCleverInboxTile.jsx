import { Link } from 'react-router-dom';
import { buildInboxDashboardSummary } from '../../services/crm/cleverInboxService.js';
import { useCleverInboxOptional } from '../../context/CleverInboxContext.jsx';

export default function BackendCleverInboxTile() {
  const inbox = useCleverInboxOptional();
  const summary = inbox
    ? { openCount: inbox.openCount, subtitle: inbox.openQuestionCount > 0 ? `${inbox.openQuestionCount} Fragen offen` : `${inbox.openCount} neue Meldungen` }
    : buildInboxDashboardSummary();

  if (!summary.openCount) {
    return (
      <Link to="/backend/clever-eingang" className="backend-home__inbox-tile" aria-label="Clever Eingang öffnen">
        <span className="backend-home__inbox-tile-value">0</span>
        <span className="backend-home__inbox-tile-label">Clever Eingang</span>
        <span className="backend-home__inbox-tile-meta">Keine neuen Meldungen</span>
      </Link>
    );
  }

  return (
    <Link to="/backend/clever-eingang" className="backend-home__inbox-tile" aria-label="Clever Eingang öffnen">
      <span className="backend-home__inbox-tile-value">{summary.openCount}</span>
      <span className="backend-home__inbox-tile-label">Clever Eingang</span>
      <span className="backend-home__inbox-tile-meta">{summary.subtitle}</span>
    </Link>
  );
}
