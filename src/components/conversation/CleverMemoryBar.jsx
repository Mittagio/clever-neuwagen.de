import { useMemo, useState } from 'react';
import { buildBundledNotepadItems } from '../../services/consultation/notepadChipBundling.js';
import './clever-conversation.css';

function iconForLabel(label = '') {
  const t = String(label ?? '').toLowerCase();
  if (/^suv$|^van$|^kombi$|^kleinwagen$|^limousine$/.test(t)) return '🚙';
  if (/^elektro$|plug-in|hybrid|benzin|diesel/.test(t)) return '⚡';
  if (/ev9|kia ev9/.test(t)) return '🚙';
  if (/^ev\d|sportage|ceed|niro|picanto|sorento|carnival/.test(t)) return '🚗';
  if (/sitz|heckklappe|panorama|komfort/.test(t)) return '💺';
  if (/park|kamera|hud|navi|carplay|matrix|technik/.test(t)) return '⚙️';
  if (/notruf|totwinkel|spur|abstand|sicherheit/.test(t)) return '🛡️';
  if (/km|reichweite/.test(t)) return '🔋';
  if (/ladelänge|2\s*m|laderaum|kofferraum/.test(t)) return '📦';
  if (/anhäng|anhaeng|ahk|kupplung|zuglast|anhängelast/.test(t)) return '🪝';
  if (/leasing|finanz|kauf|kondition|anzahlung|inzahlung|budget|€/.test(t)) return '💶';
  if (/monate|verfügbarkeit|sofort|monat/.test(t)) return '📅';
  if (/blau|rot|weiß|weiss|schwarz|grün|gruen|grau|silber|wolfsgrau/.test(t)) return '🎨';
  if (/familie|kinder/.test(t)) return '👨‍👩‍👧';
  if (/hund/.test(t)) return '🐶';
  return '·';
}

function MemoryChip({
  label,
  highlight = false,
  onRemove,
}) {
  return (
    <span
      className={['cc-memory__chip', highlight ? 'is-new' : ''].filter(Boolean).join(' ')}
      role="listitem"
    >
      <span className="cc-memory__chip-icon" aria-hidden>{iconForLabel(label)}</span>
      <span className="cc-memory__chip-text">{label}</span>
      {typeof onRemove === 'function' && (
        <button
          type="button"
          className="cc-memory__chip-x"
          onClick={() => onRemove(label)}
          aria-label={`${label} entfernen`}
          title={`${label} entfernen`}
        >
          <span aria-hidden>×</span>
        </button>
      )}
    </span>
  );
}

export default function CleverMemoryBar({
  labels = [],
  onRemove,
  animating = false,
  highlightLabels = [],
}) {
  const [expandedBundle, setExpandedBundle] = useState(null);
  const items = useMemo(() => buildBundledNotepadItems(labels), [labels]);
  const highlight = new Set(highlightLabels);

  if (!labels.length) return null;

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
        {items.map((item) => {
          if (item.type === 'chip') {
            return (
              <MemoryChip
                key={item.id}
                label={item.label}
                highlight={highlight.has(item.label)}
                onRemove={onRemove}
              />
            );
          }

          const isOpen = expandedBundle === item.id;
          return (
            <span key={item.id} className="cc-memory__bundle-wrap" role="listitem">
              <button
                type="button"
                className={`cc-memory__bundle${isOpen ? ' is-open' : ''}`}
                aria-expanded={isOpen}
                onClick={() => setExpandedBundle((prev) => (prev === item.id ? null : item.id))}
              >
                <span className="cc-memory__chip-icon" aria-hidden>{item.icon}</span>
                <span className="cc-memory__bundle-count">{item.count}</span>
                <span className="cc-memory__chip-text">{item.title}</span>
              </button>
              {isOpen && (
                <span className="cc-memory__bundle-panel">
                  {(item.labels ?? []).map((label) => (
                    <MemoryChip
                      key={label}
                      label={label}
                      highlight={highlight.has(label)}
                      onRemove={onRemove}
                    />
                  ))}
                </span>
              )}
            </span>
          );
        })}
      </div>
    </div>
  );
}
