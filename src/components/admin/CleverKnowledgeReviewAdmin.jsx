import { useCallback, useEffect, useState } from 'react';
import {
  approveCleverKnowledgeAnswer,
  KNOWLEDGE_ANSWER_STATUS,
  KNOWLEDGE_CONFIDENCE,
  listCleverKnowledgeAnswers,
  rejectCleverKnowledgeAnswer,
  updateCleverKnowledgeAnswer,
} from '../../services/admin/cleverKnowledgeAnswerService.js';
import './CleverKnowledgeReviewAdmin.css';

const STATUS_LABELS = {
  draft: 'Entwurf',
  pending_review: 'In Prüfung',
  approved: 'Freigegeben',
  rejected: 'Abgelehnt',
  archived: 'Archiviert',
};

const CONFIDENCE_LABELS = {
  seller_answered: 'Verkäuferantwort',
  admin_verified: 'Admin geprüft',
  manufacturer_verified: 'Herstellerquelle',
};

function formatWhen(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

export default function CleverKnowledgeReviewAdmin() {
  const [filter, setFilter] = useState(KNOWLEDGE_ANSWER_STATUS.PENDING_REVIEW);
  const [items, setItems] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [editAnswer, setEditAnswer] = useState('');
  const [editSource, setEditSource] = useState('');

  const reload = useCallback(() => {
    const list = filter === 'all'
      ? listCleverKnowledgeAnswers()
      : listCleverKnowledgeAnswers({ status: filter });
    setItems(list);
  }, [filter]);

  useEffect(() => {
    reload();
    const onChange = () => reload();
    window.addEventListener('clever-knowledge-answers-changed', onChange);
    return () => window.removeEventListener('clever-knowledge-answers-changed', onChange);
  }, [reload]);

  function startEdit(item) {
    setEditingId(item.id);
    setEditAnswer(item.answerText ?? '');
    setEditSource(item.sourceNote ?? '');
  }

  function saveEdit(id) {
    updateCleverKnowledgeAnswer(id, {
      answerText: editAnswer.trim(),
      sourceNote: editSource.trim() || null,
    });
    setEditingId(null);
    reload();
  }

  return (
    <div className="cka-admin">
      <header className="cka-admin__head">
        <p className="cka-admin__kicker">Clever verbessern</p>
        <h1 className="cka-admin__title">Clever Wissen prüfen</h1>
        <p className="cka-admin__lead">
          Verkäuferantworten aus Kundenfragen – freigeben, bearbeiten oder ablehnen.
        </p>
      </header>

      <div className="cka-admin__filters" role="tablist" aria-label="Statusfilter">
        {[
          { id: KNOWLEDGE_ANSWER_STATUS.PENDING_REVIEW, label: 'In Prüfung' },
          { id: KNOWLEDGE_ANSWER_STATUS.APPROVED, label: 'Freigegeben' },
          { id: KNOWLEDGE_ANSWER_STATUS.REJECTED, label: 'Abgelehnt' },
          { id: 'all', label: 'Alle' },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={filter === tab.id}
            className={`cka-admin__filter${filter === tab.id ? ' cka-admin__filter--active' : ''}`}
            onClick={() => setFilter(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {items.length === 0 ? (
        <p className="cka-admin__empty">Keine Einträge in dieser Ansicht.</p>
      ) : (
        <ul className="cka-admin__list">
          {items.map((item) => (
            <li key={item.id} className="cka-admin__item">
              <div className="cka-admin__item-head">
                <span className="cka-admin__status">{STATUS_LABELS[item.status] ?? item.status}</span>
                <span className="cka-admin__when">{formatWhen(item.updatedAt ?? item.createdAt)}</span>
              </div>

              <p className="cka-admin__question">
                <strong>Frage:</strong>
                {' '}
                {item.questionText}
              </p>

              {editingId === item.id ? (
                <>
                  <textarea
                    className="cka-admin__edit-area"
                    rows={3}
                    value={editAnswer}
                    onChange={(e) => setEditAnswer(e.target.value)}
                  />
                  <input
                    type="text"
                    className="cka-admin__edit-source"
                    value={editSource}
                    onChange={(e) => setEditSource(e.target.value)}
                    placeholder="Quelle / Hinweis"
                  />
                  <div className="cka-admin__actions">
                    <button type="button" className="cka-admin__btn" onClick={() => saveEdit(item.id)}>
                      Speichern
                    </button>
                    <button type="button" className="cka-admin__btn cka-admin__btn--ghost" onClick={() => setEditingId(null)}>
                      Abbrechen
                    </button>
                  </div>
                </>
              ) : (
                <p className="cka-admin__answer">
                  <strong>Antwort:</strong>
                  {' '}
                  {item.answerText}
                </p>
              )}

              <dl className="cka-admin__meta">
                <div><dt>Modell</dt><dd>{item.modelLabel ?? '—'}</dd></div>
                <div><dt>Kategorie</dt><dd>{item.category ?? '—'}</dd></div>
                <div><dt>Händler</dt><dd>{item.dealerName ?? item.dealerId ?? '—'}</dd></div>
                <div><dt>Beantwortet von</dt><dd>{item.answeredByUserName ?? item.answeredByUserId ?? '—'}</dd></div>
                <div><dt>Vertrauen</dt><dd>{CONFIDENCE_LABELS[item.confidence] ?? item.confidence}</dd></div>
                {item.sourceNote && (
                  <div><dt>Quelle</dt><dd>{item.sourceNote}</dd></div>
                )}
              </dl>

              {item.status === KNOWLEDGE_ANSWER_STATUS.PENDING_REVIEW && editingId !== item.id && (
                <div className="cka-admin__actions">
                  <button
                    type="button"
                    className="cka-admin__btn cka-admin__btn--approve"
                    onClick={() => {
                      approveCleverKnowledgeAnswer(item.id, {
                        confidence: KNOWLEDGE_CONFIDENCE.ADMIN_VERIFIED,
                      });
                      reload();
                    }}
                  >
                    Freigeben
                  </button>
                  <button type="button" className="cka-admin__btn" onClick={() => startEdit(item)}>
                    Bearbeiten
                  </button>
                  <button
                    type="button"
                    className="cka-admin__btn cka-admin__btn--ghost"
                    onClick={() => {
                      rejectCleverKnowledgeAnswer(item.id);
                      reload();
                    }}
                  >
                    Ablehnen
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
