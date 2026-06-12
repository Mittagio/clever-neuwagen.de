import { useCallback, useEffect, useState } from 'react';
import { VEHICLE_QUESTION_INTENT_BY_ID } from '../../data/vehicleQuestionCatalog.js';
import { KIA_MODEL_ATTRIBUTES } from '../../data/kia/kiaModelAttributes.js';
import {
  answerAndResolveOpenCustomerQuestion,
  countOpenCustomerQuestions,
  loadOpenCustomerQuestions,
} from '../../services/admin/openCustomerQuestionsService.js';
import { hydrateStammdatenFromServer } from '../../services/admin/stammdatenHydration.js';
import { getStammdatenFieldSpec } from '../../services/admin/stammdatenFieldSpec.js';
import './AdminOpenQuestionsPanel.css';

function resolveItemField(item) {
  return item.field ?? VEHICLE_QUESTION_INTENT_BY_ID[item.intentId ?? '']?.factField ?? null;
}

function QuestionAnswerForm({ item, onSaved }) {
  const field = resolveItemField(item);
  const spec = getStammdatenFieldSpec(field);
  const [value, setValue] = useState(spec?.inputType === 'boolean' ? 'true' : '');
  const [feedback, setFeedback] = useState('');

  function submit() {
    const answerValue = spec?.inputType === 'boolean'
      ? value === 'true'
      : value;
    const result = answerAndResolveOpenCustomerQuestion(item.id, answerValue);
    if (!result.ok) return;

    setFeedback(
      result.applied
        ? 'Stammdaten gespeichert – Clever-Antworten nutzen den Wert ab sofort.'
        : 'Als erledigt markiert (kein Stammdaten-Feld zugeordnet).',
    );
    onSaved();
  }

  const fieldLabel = spec?.label ?? field ?? 'Antwort';

  return (
    <div className="admin-open-questions__form">
      {spec ? (
        <label className="admin-open-questions__label">
          <span>{fieldLabel}{spec.unit ? ` (${spec.unit})` : ''}</span>
          {spec.inputType === 'select' && (
            <select
              className="admin-open-questions__input"
              value={value}
              onChange={(e) => setValue(e.target.value)}
            >
              <option value="">Bitte wählen …</option>
              {(spec.options ?? []).map((opt) => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
          )}
          {spec.inputType === 'boolean' && (
            <select
              className="admin-open-questions__input"
              value={value}
              onChange={(e) => setValue(e.target.value)}
            >
              <option value="true">Ja</option>
              <option value="false">Nein</option>
            </select>
          )}
          {spec.inputType === 'number' && (
            <input
              type="number"
              className="admin-open-questions__input"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder={spec.placeholder}
              step="any"
            />
          )}
          {spec.inputType === 'text' && (
            <input
              type="text"
              className="admin-open-questions__input"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder={spec.placeholder}
            />
          )}
        </label>
      ) : (
        <label className="admin-open-questions__label">
          <span>Notiz / Antwort</span>
          <input
            type="text"
            className="admin-open-questions__input"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="Interne Notiz"
          />
        </label>
      )}

      <button
        type="button"
        className="admin-open-questions__save"
        onClick={submit}
        disabled={spec && spec.inputType !== 'boolean' && !String(value).trim()}
      >
        Speichern & erledigt
      </button>

      {feedback && <p className="admin-open-questions__feedback">{feedback}</p>}
    </div>
  );
}

export default function AdminOpenQuestionsPanel() {
  const [items, setItems] = useState([]);
  const [expandedId, setExpandedId] = useState(null);

  const refresh = useCallback(() => {
    setItems(loadOpenCustomerQuestions({ status: 'open' }));
  }, []);

  useEffect(() => {
    hydrateStammdatenFromServer().finally(refresh);
    const onChange = () => refresh();
    window.addEventListener('clever-open-questions-changed', onChange);
    window.addEventListener('clever-stammdaten-overrides-changed', onChange);
    return () => {
      window.removeEventListener('clever-open-questions-changed', onChange);
      window.removeEventListener('clever-stammdaten-overrides-changed', onChange);
    };
  }, [refresh]);

  const openCount = countOpenCustomerQuestions();

  return (
    <section className="admin-open-questions" aria-labelledby="admin-open-questions-title">
      <header className="admin-open-questions__head">
        <div>
          <h2 id="admin-open-questions-title">Offene Kundenfragen</h2>
          <p className="admin-open-questions__sub">
            Fragen ohne Stammdaten – einmal beantworten, danach dauerhaft im Fragenkatalog nutzbar.
          </p>
        </div>
        <span className="admin-open-questions__count">{openCount}</span>
      </header>

      {items.length === 0 ? (
        <p className="admin-open-questions__empty">Keine offenen Fragen.</p>
      ) : (
        <ul className="admin-open-questions__list">
          {items.map((item) => {
            const modelLabel = item.modelKey
              ? KIA_MODEL_ATTRIBUTES[item.modelKey]?.label ?? item.modelKey
              : 'Allgemein';
            const field = resolveItemField(item);
            const spec = getStammdatenFieldSpec(field);
            const isOpen = expandedId === item.id;

            return (
              <li key={item.id} className="admin-open-questions__item">
                <div className="admin-open-questions__item-main">
                  <div>
                    <p className="admin-open-questions__query">{item.query}</p>
                    <p className="admin-open-questions__meta">
                      {modelLabel}
                      {item.category ? ` · ${item.category}` : ''}
                      {spec ? ` · Feld: ${spec.label}` : field ? ` · ${field}` : ''}
                      {' · '}
                      {new Date(item.createdAt).toLocaleString('de-DE')}
                    </p>
                  </div>
                  <button
                    type="button"
                    className="admin-open-questions__toggle"
                    onClick={() => setExpandedId(isOpen ? null : item.id)}
                    aria-expanded={isOpen}
                  >
                    {isOpen ? 'Schließen' : 'Beantworten'}
                  </button>
                </div>

                {isOpen && (
                  <QuestionAnswerForm
                    item={item}
                    onSaved={() => {
                      setExpandedId(null);
                      refresh();
                    }}
                  />
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
