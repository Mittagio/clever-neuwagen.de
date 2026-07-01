import { useState } from 'react';
import { Link } from 'react-router-dom';
import CleverLexikon from './CleverLexikon.jsx';
import './BackendVerkaufenHub.css';

const SELL_ENTRIES = [
  {
    id: 'advice',
    kind: 'link',
    to: '/verkaufsassistent',
    icon: '✨',
    title: 'Clever Beratung',
    text: 'Kundenwunsch frei erfassen – Clever erkennt Auto, Bezahlung und Notiz.',
    accent: 'primary',
  },
  {
    id: 'showroom',
    kind: 'link',
    to: '/verkaufsassistent?view=showroom',
    icon: '📱',
    title: 'Showroom Modus',
    text: 'Mobil am Auto, im Showroom oder spontan im Gespräch.',
    accent: 'green',
  },
  {
    id: 'model',
    kind: 'link',
    to: '/verkaufsassistent?view=model',
    icon: '🚗',
    title: 'Modell wählen',
    text: 'Direkt starten, wenn das Modell schon feststeht.',
    accent: 'purple',
  },
  {
    id: 'lexikon',
    kind: 'toggle',
    icon: '📖',
    title: 'Clever-Lexikon',
    text: 'Technik und Ausstattung schnell nachschlagen.',
    accent: 'blue',
  },
];

export default function BackendVerkaufenHub({ onBack }) {
  const [showLexikon, setShowLexikon] = useState(false);

  function renderEntry(entry) {
    const className = `backend-sell__entry backend-sell__entry--${entry.accent}${entry.id === 'lexikon' && showLexikon ? ' is-active' : ''}`;

    if (entry.kind === 'link') {
      return (
        <Link key={entry.id} to={entry.to} className={className}>
          <span className="backend-sell__entry-icon" aria-hidden>{entry.icon}</span>
          <span className="backend-sell__entry-body">
            <span className="backend-sell__entry-title">{entry.title}</span>
            <span className="backend-sell__entry-text">{entry.text}</span>
          </span>
          <span className="backend-sell__entry-chev" aria-hidden>›</span>
        </Link>
      );
    }

    return (
      <button
        key={entry.id}
        type="button"
        className={className}
        onClick={() => setShowLexikon((open) => !open)}
        aria-expanded={showLexikon}
      >
        <span className="backend-sell__entry-icon" aria-hidden>{entry.icon}</span>
        <span className="backend-sell__entry-body">
          <span className="backend-sell__entry-title">{entry.title}</span>
          <span className="backend-sell__entry-text">{entry.text}</span>
        </span>
        <span className="backend-sell__entry-chev" aria-hidden>{showLexikon ? '⌃' : '›'}</span>
      </button>
    );
  }

  return (
    <div className="backend-sell">
      <header className="backend-sell__head">
        {onBack && (
          <button type="button" className="backend-sell__back" onClick={onBack}>
            ← Dashboard
          </button>
        )}
        <h1 className="backend-sell__title">Verkaufen</h1>
        <p className="backend-sell__sub">
          Beratung, Showroom und Modellauswahl – alles für den Verkaufstag.
        </p>
      </header>

      <div className="backend-sell__list">
        {SELL_ENTRIES.map(renderEntry)}
      </div>

      {showLexikon && (
        <CleverLexikon
          className="backend-sell__lexikon"
          subline=""
          placeholder="z. B. EV4 Länge, Sportage Batterie"
          showChips={false}
        />
      )}
    </div>
  );
}
