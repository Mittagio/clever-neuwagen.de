import { useMemo, useState } from 'react';
import LeadDetailPanel from './LeadDetailPanel.jsx';
import './CustomerAkte.css';

/**
 * Kundenakte – Kurzüberblick Frag-Clever-Gespräch für Verkäufer.
 */
export default function CustomerAkteCleverGespraech({ conversation }) {
  const [sheetOpen, setSheetOpen] = useState(false);

  const lastUserQuestion = useMemo(() => {
    const userMessages = (conversation?.messages ?? []).filter((m) => m.role === 'user');
    return userMessages[userMessages.length - 1]?.text ?? null;
  }, [conversation?.messages]);

  if (!conversation) return null;

  const { summary, extractedSignals = [], openQuestions = [], messages = [] } = conversation;

  return (
    <>
      <section className="cust-clever-gespraech" aria-labelledby="cust-clever-gespraech-title">
        <header className="cust-clever-beratung__head">
          <h2 id="cust-clever-gespraech-title" className="cust-clever-beratung__title">
            Clever Gespräch
          </h2>
          <p className="cust-clever-beratung__hint">
            Frag Clever auf der Kundenseite – hier die wichtigsten Themen.
          </p>
        </header>

        <div className="cust-clever-beratung__card">
          {summary && (
            <div className="cust-clever-beratung__block">
              <p className="cust-clever-beratung__label">Zusammenfassung</p>
              <p className="cust-clever-gespraech__summary">{summary}</p>
            </div>
          )}

          {extractedSignals.length > 0 && (
            <div className="cust-clever-beratung__block">
              <p className="cust-clever-beratung__label">Wichtigste Themen</p>
              <ul className="cust-clever-beratung__chips">
                {extractedSignals.map((signal) => (
                  <li key={signal.id}>
                    <span className="cust-clever-beratung__chip">{signal.label}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {openQuestions.length > 0 && (
            <div className="cust-clever-beratung__block">
              <p className="cust-clever-beratung__label">Offene Fragen</p>
              <ul className="cust-clever-beratung__open">
                {openQuestions.map((item) => (
                  <li key={item.id}>{item.question}</li>
                ))}
              </ul>
            </div>
          )}

          {lastUserQuestion && (
            <div className="cust-clever-beratung__block">
              <p className="cust-clever-beratung__label">Letzter Stand</p>
              <p className="cust-clever-gespraech__last">&ldquo;{lastUserQuestion}&rdquo;</p>
            </div>
          )}

          {messages.length > 0 && (
            <button
              type="button"
              className="cust-clever-gespraech__toggle"
              onClick={() => setSheetOpen(true)}
            >
              Gespräch anzeigen
            </button>
          )}
        </div>
      </section>

      <LeadDetailPanel
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        title="Clever Gespräch"
        footer={(
          <button type="button" className="dai-btn dai-btn--ghost" onClick={() => setSheetOpen(false)}>
            Schließen
          </button>
        )}
      >
        <ul className="cust-clever-gespraech__thread">
          {messages.map((message, index) => (
            <li
              key={`${message.createdAt ?? index}-${message.role}`}
              className={`cust-clever-gespraech__msg cust-clever-gespraech__msg--${message.role}`}
            >
              <span className="cust-clever-gespraech__role">
                {message.role === 'user' ? 'Kunde' : 'Clever'}
              </span>
              <p className="cust-clever-gespraech__text">{message.text}</p>
            </li>
          ))}
        </ul>
      </LeadDetailPanel>
    </>
  );
}
