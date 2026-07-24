import { useEffect, useMemo, useRef, useState } from 'react';
import {
  buildBundledNotepadItems,
  findBundleForLabel,
} from '../../services/consultation/notepadChipBundling.js';
import './clever-conversation.css';

export function iconForNotepadLabel(label = '') {
  const t = String(label ?? '').toLowerCase();
  if (/^suv$|^van$|^kombi$|^kleinwagen$|^limousine$|^pickup$/.test(t)) return '🚙';
  if (/^elektro$|plug-in|hybrid|benzin|diesel|verbrenner/.test(t)) return '⚡';
  if (/interessant/.test(t)) return '🚙';
  if (/^ev\d|sportage|ceed|niro|picanto|sorento|carnival/.test(t)) return '🚗';
  if (/sitz|heckklappe|panorama|komfort|klima|leder|keyless|memory|massage|wärmepumpe|lenkrad/.test(t)) return '💺';
  if (/park|kamera|hud|navi|carplay|android|matrix|technik|cockpit|soundsystem|wlan|dab/.test(t)) return '⚙️';
  if (/notruf|totwinkel|spur|abstand|sicherheit|notbrems|müdigkeit|tempomat|reifendruck/.test(t)) return '🛡️';
  if (/reichweite|wltp/.test(t)) return '🔋';
  if (/ladelänge|2\s*m|laderaum|kofferraum/.test(t)) return '📦';
  if (/anhäng|anhaeng|ahk|kupplung|zuglast|anhängelast|\d[\d.\s]*kg/.test(t)) return '🪝';
  if (/leasing|finanz|kauf|kondition|anzahlung|inzahlung|budget|€|monate|sonderzahlung|wunschrate/.test(t)) return '💶';
  if (/verfügbarkeit|sofort|planung|bald/.test(t)) return '📅';
  if (/blau|rot|weiß|weiss|schwarz|grün|gruen|grau|silber|wolfsgrau/.test(t)) return '🎨';
  if (/familie|kinder/.test(t)) return '👨‍👩‍👧';
  if (/hund/.test(t)) return '🐶';
  if (/^\d[\d.]*\s*km/.test(t)) return '🛣';
  return '·';
}

function MemoryChip({
  label,
  highlight = false,
  onRemove,
  flying = false,
}) {
  return (
    <span
      className={[
        'cc-memory__chip',
        highlight ? 'is-new' : '',
        flying ? 'is-capture' : '',
      ].filter(Boolean).join(' ')}
      role="listitem"
    >
      <span className="cc-memory__chip-icon" aria-hidden>{iconForNotepadLabel(label)}</span>
      <span className="cc-memory__chip-text">{label}</span>
      {typeof onRemove === 'function' && !flying && (
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
  const [captureLabel, setCaptureLabel] = useState(null);
  const [glowBundleId, setGlowBundleId] = useState(null);
  const [announce, setAnnounce] = useState('');
  const panelRef = useRef(null);

  const items = useMemo(() => buildBundledNotepadItems(labels), [labels]);
  const highlight = new Set(highlightLabels);

  useEffect(() => {
    if (!highlightLabels.length) return undefined;

    const label = highlightLabels[0];
    const bundle = findBundleForLabel(label, items);
    const reduceMotion = typeof window !== 'undefined'
      && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    setAnnounce(
      bundle?.id === 'bundle:wishes'
        ? `${label} als Wunsch notiert.`
        : bundle?.id === 'bundle:payment'
          ? `${label} zu den Konditionen hinzugefügt.`
          : `${label} zum Notizzettel hinzugefügt.`,
    );

    if (bundle && expandedBundle !== bundle.id) {
      if (!reduceMotion) {
        setCaptureLabel(label);
      }
      setGlowBundleId(bundle.id);
      const captureTimer = window.setTimeout(() => setCaptureLabel(null), reduceMotion ? 0 : 650);
      const glowTimer = window.setTimeout(() => setGlowBundleId(null), 1400);
      return () => {
        window.clearTimeout(captureTimer);
        window.clearTimeout(glowTimer);
      };
    }

    if (bundle && expandedBundle === bundle.id) {
      setGlowBundleId(bundle.id);
      const glowTimer = window.setTimeout(() => setGlowBundleId(null), 1400);
      return () => window.clearTimeout(glowTimer);
    }

    return undefined;
  }, [highlightLabels, items, expandedBundle]);

  useEffect(() => {
    if (!expandedBundle) return undefined;
    function onPointerDown(event) {
      if (panelRef.current && !panelRef.current.contains(event.target)) {
        setExpandedBundle(null);
      }
    }
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [expandedBundle]);

  if (!labels.length) return null;

  return (
    <div className="cc-memory" aria-label="Clevers Notizzettel">
      <p className="cc-memory__label">Notizzettel</p>
      <div className="cc-memory__sr" aria-live="polite">{announce}</div>
      <div
        className={[
          'cc-memory__track',
          animating ? 'is-animating' : '',
        ].filter(Boolean).join(' ')}
        role="list"
      >
        {captureLabel && (
          <MemoryChip
            key={`capture:${captureLabel}`}
            label={captureLabel}
            highlight
            flying
          />
        )}

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
          const glowing = glowBundleId === item.id
            || (item.labels ?? []).some((label) => highlight.has(label));

          return (
            <span
              key={item.id}
              ref={isOpen ? panelRef : undefined}
              className={[
                'cc-memory__bundle-wrap',
                glowing ? 'is-glow' : '',
              ].filter(Boolean).join(' ')}
              role="listitem"
            >
              <button
                type="button"
                className={[
                  'cc-memory__bundle',
                  isOpen ? 'is-open' : '',
                  glowing ? 'is-new' : '',
                ].filter(Boolean).join(' ')}
                aria-expanded={isOpen}
                aria-label={`${item.title}, ${item.count} Einträge`}
                onClick={() => setExpandedBundle((prev) => (prev === item.id ? null : item.id))}
              >
                <span className="cc-memory__chip-icon" aria-hidden>{item.icon}</span>
                <span className="cc-memory__chip-text">{item.title}</span>
                <span className="cc-memory__bundle-count">{item.count}</span>
                <span className="cc-memory__bundle-chev" aria-hidden>{isOpen ? '▴' : '▾'}</span>
              </button>
              {isOpen && (
                <span className="cc-memory__bundle-panel" role="group" aria-label={item.title}>
                  <span className="cc-memory__bundle-panel-title">{item.title}</span>
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
