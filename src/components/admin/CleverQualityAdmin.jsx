import { useCallback, useEffect, useState } from 'react';
import './CleverQualityAdmin.css';

const FEEDBACK_LABELS = {
  good: 'Passt',
  wrong_vehicle_fact: 'Falsche Fahrzeuginfo',
  unnecessary_question: 'Unnötige Rückfrage',
  missed_customer_need: 'Kundenwunsch übersehen',
  unnatural_seller_language: 'Klingt nicht wie Verkäufer',
  other: 'Sonstiges',
};

const GAP_STATUS_LABELS = {
  new: 'Neu',
  reviewed: 'Geprüft',
  accepted: 'Übernommen',
  rejected: 'Abgelehnt',
  resolved: 'Erledigt',
};

function formatWhen(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('de-DE');
  } catch {
    return iso;
  }
}

export default function CleverQualityAdmin() {
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/v1/admin/clever/quality/summary');
      const data = await res.json();
      if (!data.ok) throw new Error(data.error ?? 'load_failed');
      setSummary(data.summary);
    } catch (err) {
      setError(err?.message ?? 'Fehler beim Laden');
      setSummary(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  async function reviewFeedback(id, status) {
    await fetch(`/api/v1/admin/clever/feedback/${id}/review`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    reload();
  }

  async function reviewGap(id, status) {
    await fetch(`/api/v1/admin/clever/knowledge-gaps/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, reviewedBy: 'admin' }),
    });
    reload();
  }

  async function acceptGolden(id) {
    await fetch(`/api/v1/admin/clever/golden-candidates/${id}/accept`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    reload();
  }

  if (loading) return <p className="cq-admin__hint">Lade Clever Qualität …</p>;
  if (error) return <p className="cq-admin__error">{error}</p>;
  if (!summary) return null;

  return (
    <div className="cq-admin">
      <header className="cq-admin__header">
        <h2>Clever Qualität</h2>
        <p>Kontrollierter Lernkreislauf – Feedback und Wissenslücken ohne automatische Produktiv-Aktivierung.</p>
      </header>

      <div className="cq-admin__kpis">
        <div className="cq-admin__kpi"><strong>{summary.newSellerFeedback}</strong><span>Neues Verkäuferfeedback</span></div>
        <div className="cq-admin__kpi"><strong>{summary.openKnowledgeGaps}</strong><span>Offene Wissenslücken</span></div>
        <div className="cq-admin__kpi"><strong>{summary.fallbackTurns}</strong><span>Antworten mit Fallback</span></div>
        <div className="cq-admin__kpi"><strong>{summary.officialWebTurns}</strong><span>Offizielle Webquelle</span></div>
        <div className="cq-admin__kpi"><strong>{summary.conflictTurns}</strong><span>Datenkonflikte</span></div>
        <div className="cq-admin__kpi"><strong>{summary.escalationTurns}</strong><span>Terra-Eskalationen</span></div>
      </div>

      <section className="cq-admin__section">
        <h3>Neue Wissenslücken</h3>
        {(summary.newKnowledgeGaps ?? []).length === 0 && (
          <p className="cq-admin__hint">Keine offenen Wissenslücken.</p>
        )}
        <ul className="cq-admin__list">
          {(summary.newKnowledgeGaps ?? []).map((gap) => (
            <li key={gap.id} className="cq-admin__item">
              <div className="cq-admin__item-main">
                <strong>{gap.brandKey ?? '—'} · {gap.modelKey ?? '—'}</strong>
                <span>{gap.requestedFact}</span>
                <span>{GAP_STATUS_LABELS[gap.status] ?? gap.status}</span>
                <span>{gap.customerQuestionCount ?? 1}× gefragt</span>
                <span>{(gap.sourceUrls ?? []).length ? 'Offizielle Quelle' : 'Keine Quelle'}</span>
              </div>
              <div className="cq-admin__actions">
                <button type="button" onClick={() => reviewGap(gap.id, 'accepted')}>Übernehmen</button>
                <button type="button" onClick={() => reviewGap(gap.id, 'rejected')}>Ablehnen</button>
                <button type="button" onClick={() => reviewGap(gap.id, 'resolved')}>Bereits vorhanden</button>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="cq-admin__section">
        <h3>Neues Verkäuferfeedback</h3>
        {(summary.sellerFeedback ?? []).length === 0 && (
          <p className="cq-admin__hint">Kein offenes Feedback.</p>
        )}
        <ul className="cq-admin__list">
          {(summary.sellerFeedback ?? []).map((item) => (
            <li key={item.id} className="cq-admin__item">
              <div className="cq-admin__item-main">
                <strong>{FEEDBACK_LABELS[item.category] ?? item.category}</strong>
                <span>{formatWhen(item.createdAt)}</span>
              </div>
              {item.sellerCorrection && <p className="cq-admin__quote">{item.sellerCorrection}</p>}
              <div className="cq-admin__actions">
                <button type="button" onClick={() => reviewFeedback(item.id, 'accepted')}>Annehmen</button>
                <button type="button" onClick={() => reviewFeedback(item.id, 'rejected')}>Ablehnen</button>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="cq-admin__section">
        <h3>Golden Conversation Kandidaten</h3>
        {(summary.goldenCandidates ?? []).length === 0 && (
          <p className="cq-admin__hint">Keine Kandidaten in Prüfung.</p>
        )}
        <ul className="cq-admin__list">
          {(summary.goldenCandidates ?? []).map((candidate) => (
            <li key={candidate.id} className="cq-admin__item">
              <p className="cq-admin__quote">{candidate.customerMessage}</p>
              <p className="cq-admin__quote">{candidate.desiredBehavior}</p>
              <button type="button" onClick={() => acceptGolden(candidate.id)}>
                Als Golden Conversation übernehmen
              </button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
