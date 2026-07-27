import { useEffect, useMemo, useRef, useState } from 'react';
import { buildAttributedWishChips } from '../../services/dealer/customerUnderstanding.js';
import {
  buildBundledNotepadItems,
  classifyNotepadLabel,
} from '../../services/consultation/notepadChipBundling.js';
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
 * Notizzettel – Konditionen sichtbar; Rest wie KD-Memory (Chips + Bundle-Zähler).
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
  const [expandedBundle, setExpandedBundle] = useState(null);
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

  const conditions = useMemo(
    () => chips.filter((c) => c.group === 'condition'),
    [chips],
  );

  const otherChips = useMemo(
    () => chips.filter((c) => c.group !== 'condition'),
    [chips],
  );

  const conditionKeys = useMemo(
    () => new Set(conditions.map((c) => normalizeKey(c.label))),
    [conditions],
  );

  /** KD-Bundling nur für Nicht-Konditionen (keine Doppelung). */
  const bundledRest = useMemo(() => {
    const labels = otherChips
      .map((c) => c.label)
      .filter((label) => {
        if (conditionKeys.has(normalizeKey(label))) return false;
        // Konditionen-Gruppe ist schon sichtbar → keine zweite Payment-Bundle
        if (conditions.length && classifyNotepadLabel(label) === 'payment') return false;
        return true;
      });
    return buildBundledNotepadItems(labels);
  }, [otherChips, conditionKeys, conditions.length]);

  const chipByLabel = useMemo(() => {
    const map = new Map();
    for (const chip of otherChips) map.set(normalizeKey(chip.label), chip);
    return map;
  }, [otherChips]);

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

  function handleLabelClick(label) {
    const chip = chipByLabel.get(normalizeKey(label));
    if (chip) {
      handleChipClick(chip);
      return;
    }
    onOpenFull?.();
  }

  function renderConditionChips(list) {
    return (
      <ul className="cust-akte-clever-notepad__chips">
        {list.map((chip) => {
          const key = normalizeKey(chip.label);
          return (
            <li key={`condition-${chip.origin}-${chip.label}`}>
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
    ...conditions,
    ...otherChips,
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

      <section
        ref={blockRef}
        className="cust-akte-clever-notepad cust-akte-clever-notepad--compact"
        aria-label="Notizzettel"
      >
        {conditions.length ? (
          <div className="cust-akte-clever-notepad__group cust-akte-clever-notepad__group--conditions">
            <p className="cust-akte-clever-notepad__group-label">Konditionen</p>
            {renderConditionChips(conditions)}
          </div>
        ) : null}

        {bundledRest.length ? (
          <div className="cust-akte-clever-notepad__rest" role="list" aria-label="Weitere Merker">
            {bundledRest.map((item) => {
              if (item.type === 'bundle' && !(item.count > 0)) return null;

              if (item.type === 'chip') {
                const key = normalizeKey(item.label);
                const chip = chipByLabel.get(key);
                return (
                  <button
                    key={item.id}
                    type="button"
                    role="listitem"
                    className={[
                      'cust-akte-clever-notepad__chip',
                      chip?.origin === 'seller' ? 'cust-akte-clever-notepad__chip--seller' : '',
                      glowKeys.has(key) ? 'is-magic-capture' : '',
                    ].filter(Boolean).join(' ')}
                    onClick={() => handleLabelClick(item.label)}
                  >
                    {item.label}
                  </button>
                );
              }

              const isOpen = expandedBundle === item.id;
              return (
                <div key={item.id} className="cust-akte-clever-notepad__bundle-wrap" role="listitem">
                  <button
                    type="button"
                    className={`cust-akte-clever-notepad__bundle${isOpen ? ' is-open' : ''}`}
                    aria-expanded={isOpen}
                    aria-label={`${item.title}, ${item.count} Einträge`}
                    onClick={() => setExpandedBundle((prev) => (prev === item.id ? null : item.id))}
                  >
                    <span className="cust-akte-clever-notepad__bundle-title">{item.title}</span>
                    <span className="cust-akte-clever-notepad__bundle-count">{item.count}</span>
                  </button>
                  {isOpen ? (
                    <div className="cust-akte-clever-notepad__bundle-panel" role="group" aria-label={item.title}>
                      {(item.labels ?? []).map((label) => (
                        <button
                          key={label}
                          type="button"
                          className="cust-akte-clever-notepad__chip"
                          onClick={() => handleLabelClick(label)}
                        >
                          {label}
                        </button>
                      ))}
                      <button
                        type="button"
                        className="cust-akte-clever-notepad__more"
                        onClick={() => onOpenFull?.()}
                      >
                        Alle öffnen
                      </button>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        ) : null}

        {!conditions.length && !bundledRest.length ? (
          <button type="button" className="cust-akte-clever-notepad__empty" onClick={() => onOpenFull?.()}>
            Wünsche ergänzen
          </button>
        ) : null}
      </section>
    </>
  );
}
