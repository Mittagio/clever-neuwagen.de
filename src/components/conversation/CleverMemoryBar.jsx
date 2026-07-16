import './clever-conversation.css';

function iconForLabel(label = '') {
  const t = String(label ?? '').toLowerCase();
  if (/^suv$|^van$|^kombi$|^kleinwagen$|^limousine$/.test(t)) return '🚙';
  if (/^elektro$|plug-in|hybrid|benzin|diesel/.test(t)) return '⚡';
  if (/ev9|kia ev9/.test(t)) return '🚙';
  if (/^ev\d|sportage|ceed|niro|picanto|sorento|carnival/.test(t)) return '🚗';
  if (/sitz/.test(t)) return '💺';
  if (/km|reichweite/.test(t)) return '🔋';
  if (/ladelänge|2\s*m|laderaum|kofferraum/.test(t)) return '📦';
  if (/anhäng|anhaeng|ahk|kupplung|zuglast|anhängelast/.test(t)) return '🪝';
  if (/leasing|finanz|kauf/.test(t) || /budget/.test(t) || /€\/monat/.test(t)) return '💶';
  if (/monate/.test(t)) return '📅';
  if (/hud|head-up/.test(t)) return '📷';
  if (/blau|rot|weiß|weiss|schwarz|grün|gruen|grau|silber|wolfsgrau/.test(t)) return '🎨';
  if (/familie|kinder/.test(t)) return '👨‍👩‍👧';
  if (/hund/.test(t)) return '🐶';
  return '·';
}

export default function CleverMemoryBar({
  labels = [],
  onRemove,
  animating = false,
  highlightLabels = [],
}) {
  if (!labels.length) return null;

  const highlight = new Set(highlightLabels);

  return (
    <div className="cc-memory" aria-label="Clevers Notizzettel">
      <p className="cc-memory__label">Notizzettel</p>
      <div
        className={[
          'cc-memory__track',
          animating ? 'is-animating' : '',
        ].filter(Boolean).join(' ')}
        role="list"
      >
        {labels.map((label) => (
          <span
            key={label}
            className={[
              'cc-memory__chip',
              highlight.has(label) ? 'is-new' : '',
            ].filter(Boolean).join(' ')}
            role="listitem"
          >
            <span className="cc-memory__chip-icon" aria-hidden>{iconForLabel(label)}</span>
            <span className="cc-memory__chip-text">{label}</span>
            <button
              type="button"
              className="cc-memory__chip-x"
              onClick={() => onRemove?.(label)}
              aria-label={`${label} entfernen`}
              title={`${label} entfernen`}
            >
              <span aria-hidden>×</span>
            </button>
          </span>
        ))}
      </div>
    </div>
  );
}
