import { useCallback, useEffect, useState } from 'react';
import { KIA_MODEL_ATTRIBUTES } from '../../data/kia/kiaModelAttributes.js';
import {
  countOpenCustomerQuestions,
  loadOpenCustomerQuestions,
  resolveOpenCustomerQuestion,
} from '../../services/admin/openCustomerQuestionsService.js';
import './AdminOpenQuestionsPanel.css';

export default function AdminOpenQuestionsPanel() {
  const [items, setItems] = useState([]);

  const refresh = useCallback(() => {
    setItems(loadOpenCustomerQuestions({ status: 'open' }));
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  function handleResolve(id) {
    resolveOpenCustomerQuestion(id);
    refresh();
  }

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
            return (
              <li key={item.id} className="admin-open-questions__item">
                <div>
                  <p className="admin-open-questions__query">{item.query}</p>
                  <p className="admin-open-questions__meta">
                    {modelLabel}
                    {item.category ? ` · ${item.category}` : ''}
                    {' · '}
                    {new Date(item.createdAt).toLocaleString('de-DE')}
                  </p>
                </div>
                <button
                  type="button"
                  className="admin-open-questions__resolve"
                  onClick={() => handleResolve(item.id)}
                >
                  Erledigt
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
