import { useEffect, useMemo, useRef, useState } from 'react';
import { buildAttributedWishChips } from '../../services/dealer/customerUnderstanding.js';
import './CustomerAkte.css';

function normalizeKey(label) {
  return String(label ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
}

const IMPORTANT_RE = /verfügbar|sofort|ahk|anhänger|kupplung|reichweite|hud|zeitdruck|dringend/i;
const MODEL_RE = /\b(ev[2-9]|sportage|sorento|ceed|xceed|niro|picanto)\b/i;

function classifyChip(chip) {
  if (chip.field || chip.kind === 'condition') return 'condition';
  if (MODEL_RE.test(chip.label)) return 'model';
  if (IMPORTANT_RE.test(chip.label)) return 'important';
  return 'wish';
}

/**
 * Notizzettel – semantisch gruppiert, Magic Capture bei neuen Chips.
 */
export default function CustomerAkteCleverNotepad({
  lead = null,
  conditionChips = [],
  customerName = '',
  onOpenFull,
  onChipClick,
  sticky = true,
}) {
  const [compact, setCompact] = useState(false);
  const [captureLabels, setCaptureLabels] = useState([]);
  const [glowKeys, setGlowKeys] = useState(() => new Set());
  const blockRef = useRef(null);
  const prevKeysRef = useRef(new Set());

  const chips = useMemo(() => {
    const attributed = buildAttributedWishChips(lead) ?? [];
    const merged = [];
    const seen = new Set();

    const push = (chip, kind = 'wish') => {
      const label = typeof chip === 'string' ? chip : chip?.label;
      const key = normalizeKey(label);
      if (!key || seen.has(key)) return;
      seen.add(key);
      if (typeof chip === 'string') {
        merged.push({ label, origin: 'customer', kind, group: classifyChip({ label, kind }) });
        return;
      }
      const next = {
        ...chip,
        label,
        kind: chip.field ? 'condition' : kind,
      };
      next.group = classifyChip(next);
      merged.push(next);
    };

    for (const chip of conditionChips) push(chip, 'condition');
    for (const chip of attributed) push(chip, 'wish');
    return merged;
  }, [lead, conditionChips]);

  const groups = useMemo(() => {
    const condition = chips.filter((c) => c.group === 'condition');
    const important = chips.filter((c) => c.group === 'important');
    const model = chips.filter((c) => c.group === 'model');
    const wish = chips.filter((c) => c.group === 'wish');
    return { condition, important, model, wish };
  }, [chips]);

  useEffect(() => {
    const keys = new Set(chips.map((c) => normalizeKey(c.label)));
    const prev = prevKeysRef.current;
    const added = chips.filter((c) => !prev.has(normalizeKey(c.label)));
    prevKeysRef.current = keys;
    if (!added.length || prev.size === 0) return undefined;

    const labels = added.map((c) => c.label).slice(0, 3);
    setCaptureLabels(labels);
    setGlowKeys(new Set(added.map((c) => normalizeKey(c.label))));
    const clearCapture = setTimeout(() => setCaptureLabels([]), 520);
    const clearGlow = setTimeout(() => setGlowKeys(new Set()), 700);
    return () => {
      clearTimeout(clearCapture);
      clearTimeout(clearGlow);
    };
  }, [chips]);

  useEffect(() => {
    if (!sticky || !blockRef.current) return undefined;
    const node = blockRef.current;
    const root = node.closest('.sw-chat__feed') || null;
    const observer = new IntersectionObserver(
      ([entry]) => setCompact(!entry.isIntersecting),
      { root, threshold: 0, rootMargin: '-8px 0px 0px 0px' },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [sticky, chips.length]);

  function handleChipClick(chip) {
    if (onChipClick) {
      onChipClick(chip);
      return;
    }
    onOpenFull?.();
  }

  function renderChipList(list, limit = 8) {
    const visible = list.slice(0, limit);
    return (
      <ul className="cust-akte-clever-notepad__chips">
        {visible.map((chip) => {
          const key = normalizeKey(chip.label);
          return (
            <li key={`${chip.group}-${chip.origin}-${chip.label}`}>
              <button
                type="button"
                className={[
                  'cust-akte-clever-notepad__chip',
                  chip.origin === 'seller' ? 'cust-akte-clever-notepad__chip--seller' : '',
                  glowKeys.has(key) ? 'is-magic-capture' : '',
                ].filter(Boolean).join(' ')}
                onClick={() => handleChipClick(chip)}
              >
                {chip.label}
                {chip.origin === 'seller' && chip.badge ? (
                  <span className="cust-akte-clever-notepad__badge">{chip.badge}</span>
                ) : null}
              </button>
            </li>
          );
        })}
      </ul>
    );
  }

  const stickyChips = [
    ...groups.model,
    ...groups.condition,
    ...groups.important,
    ...groups.wish,
  ].slice(0, 5);

  if (!chips.length) {
    return (
      <section className="cust-akte-clever-notepad" aria-label="Notizzettel">
        <p className="cust-akte-clever-notepad__label">Notizzettel</p>
        <button type="button" className="cust-akte-clever-notepad__empty" onClick={() => onOpenFull?.()}>
          Wünsche ergänzen
        </button>
      </section>
    );
  }

  return (
    <>
      {sticky ? (
        <button
          type="button"
          className={`cust-akte-clever-notepad__sticky${compact ? ' is-visible' : ''}`}
          onClick={() => onOpenFull?.()}
          aria-label="Notizzettel öffnen"
          aria-hidden={!compact}
          tabIndex={compact ? 0 : -1}
        >
          <span className="cust-akte-clever-notepad__sticky-name">
            {customerName?.trim() || 'Kunde'}
          </span>
          <span className="cust-akte-clever-notepad__sticky-chips">
            {stickyChips.map((chip) => (
              <span key={chip.label} className="cust-akte-clever-notepad__sticky-chip">
                {chip.label}
              </span>
            ))}
          </span>
        </button>
      ) : null}

      {captureLabels.length ? (
        <div className="cust-akte-clever-notepad__capture" aria-live="polite">
          {captureLabels.map((label) => (
            <span key={label} className="cust-akte-clever-notepad__capture-chip">
              +
              {' '}
              {label}
            </span>
          ))}
        </div>
      ) : null}

      <section ref={blockRef} className="cust-akte-clever-notepad" aria-label="Notizzettel">
        <p className="cust-akte-clever-notepad__label">Notizzettel</p>

        {groups.model.length ? (
          <div className="cust-akte-clever-notepad__group">
            <p className="cust-akte-clever-notepad__group-label">Modell</p>
            {renderChipList(groups.model, 4)}
          </div>
        ) : null}

        {groups.condition.length ? (
          <div className="cust-akte-clever-notepad__group">
            <p className="cust-akte-clever-notepad__group-label">Konditionen</p>
            {renderChipList(groups.condition, 6)}
          </div>
        ) : null}

        {groups.important.length ? (
          <div className="cust-akte-clever-notepad__group">
            <p className="cust-akte-clever-notepad__group-label">Wichtig</p>
            {renderChipList(groups.important, 4)}
          </div>
        ) : null}

        {groups.wish.length ? (
          <div className="cust-akte-clever-notepad__group">
            <p className="cust-akte-clever-notepad__group-label">Weitere Wünsche</p>
            {renderChipList(groups.wish, 4)}
          </div>
        ) : null}

        {chips.length > 12 ? (
          <button
            type="button"
            className="cust-akte-clever-notepad__more"
            onClick={() => onOpenFull?.()}
          >
            +
            {chips.length - 12}
            {' '}
            mehr
          </button>
        ) : null}
      </section>
    </>
  );
}
