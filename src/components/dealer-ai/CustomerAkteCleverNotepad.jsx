import { useEffect, useMemo, useRef, useState } from 'react';
import { buildAttributedWishChips } from '../../services/dealer/customerUnderstanding.js';
import {
  buildBundledNotepadItems,
  classifyNotepadLabel,
} from '../../services/consultation/notepadChipBundling.js';
import { buildCustomerTruthNotepadGroups } from '../../services/crm/commercialScenarios.js';
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

const TRUTH_GROUP_META = [
  { key: 'vehicle', label: 'FAHRZEUG' },
  { key: 'offerWishes', label: 'ANGEBOTSWÜNSCHE' },
  { key: 'customer', label: 'KUNDE' },
  { key: 'open', label: 'OFFEN' },
];

/**
 * Notizzettel – Konditionen sichtbar; Rest wie KD-Memory (Chips + Bundle-Zähler).
 * Bei commercialScenarios: FAHRZEUG / ANGEBOTSWÜNSCHE / KUNDE / OFFEN.
 */
export default function CustomerAkteCleverNotepad({
  lead = null,
  conditionChips = [],
  customerName = '',
  workingOfferLabel = null,
  onOpenWorkingOffer = null,
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

  const truthGroups = useMemo(
    () => buildCustomerTruthNotepadGroups(lead),
    [lead],
  );

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

    if (!truthGroups) {
      for (const chip of conditionChips) push(chip, 'condition');
    }
    for (const chip of attributed) push(chip, 'wish');
    return merged;
  }, [lead, conditionChips, truthGroups]);

  const conditions = useMemo(
    () => (truthGroups ? [] : chips.filter((c) => c.group === 'condition')),
    [chips, truthGroups],
  );

  const otherChips = useMemo(
    () => chips.filter((c) => c.group !== 'condition'),
    [chips],
  );

  const conditionKeys = useMemo(
    () => new Set(conditions.map((c) => normalizeKey(c.label))),
    [conditions],
  );

  const truthLabels = useMemo(() => {
    if (!truthGroups) return new Set();
    const set = new Set();
    for (const meta of TRUTH_GROUP_META) {
      for (const chip of truthGroups[meta.key] ?? []) {
        set.add(normalizeKey(chip.label));
      }
    }
    return set;
  }, [truthGroups]);

  /** KD-Bundling nur für Nicht-Konditionen (keine Doppelung). */
  const bundledRest = useMemo(() => {
    const labels = otherChips
      .map((c) => c.label)
      .filter((label) => {
        if (conditionKeys.has(normalizeKey(label))) return false;
        if (truthLabels.has(normalizeKey(label))) return false;
        if (conditions.length && classifyNotepadLabel(label) === 'payment') return false;
        if (truthGroups && classifyNotepadLabel(label) === 'payment') return false;
        return true;
      });
    return buildBundledNotepadItems(labels);
  }, [otherChips, conditionKeys, conditions.length, truthLabels, truthGroups]);

  const chipByLabel = useMemo(() => {
    const map = new Map();
    for (const chip of otherChips) map.set(normalizeKey(chip.label), chip);
    return map;
  }, [otherChips]);

  const allVisibleChips = useMemo(() => {
    if (!truthGroups) return chips;
    const fromTruth = TRUTH_GROUP_META.flatMap((meta) => truthGroups[meta.key] ?? []);
    return [...fromTruth, ...chips];
  }, [truthGroups, chips]);

  useEffect(() => {
    const keys = new Set(allVisibleChips.map((c) => normalizeKey(c.label)));
    const prev = prevKeysRef.current;
    const added = allVisibleChips.filter((c) => !prev.has(normalizeKey(c.label)));
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
  }, [allVisibleChips]);

  useEffect(() => {
    if (!sticky || !blockRef.current) return undefined;
    const node = blockRef.current;
    const root = node.closest('.sw-chat__feed-main')
      || node.closest('.sw-chat__feed')
      || null;
    const observer = new IntersectionObserver(
      ([entry]) => setCompact(!entry.isIntersecting),
      { root, threshold: 0, rootMargin: '-8px 0px 0px 0px' },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [sticky, allVisibleChips.length]);

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

  function renderChipList(list, groupKey = 'default') {
    return (
      <ul className="cust-akte-clever-notepad__chips">
        {list.map((chip) => {
          const key = normalizeKey(chip.label);
          return (
            <li key={`${groupKey}-${chip.id || chip.origin || 'x'}-${chip.label}`}>
              <button
                type="button"
                className={[
                  'cust-akte-clever-notepad__chip',
                  chip.origin === 'seller' ? 'cust-akte-clever-notepad__chip--seller' : '',
                  chip.kind === 'open' || chip.tone === 'open'
                    ? 'cust-akte-clever-notepad__chip--open'
                    : '',
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
    ...(truthGroups
      ? TRUTH_GROUP_META.flatMap((meta) => truthGroups[meta.key] ?? [])
      : [...conditions, ...otherChips]),
  ].slice(0, 5);

  const workingOfferStrip = workingOfferLabel ? (
    <button
      type="button"
      className="cust-akte-clever-notepad__working"
      onClick={() => (onOpenWorkingOffer ? onOpenWorkingOffer() : onOpenFull?.())}
      aria-label={`Arbeitskontext: ${workingOfferLabel}`}
    >
      <span className="cust-akte-clever-notepad__working-icon" aria-hidden="true">📎</span>
      <span className="cust-akte-clever-notepad__working-label">{workingOfferLabel}</span>
    </button>
  ) : null;

  const hasContent = truthGroups
    || chips.length
    || bundledRest.length;

  if (!hasContent) {
    return (
      <section className="cust-akte-clever-notepad" aria-label="Notizzettel">
        <p className="cust-akte-clever-notepad__label">Notizzettel</p>
        {workingOfferStrip}
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
            {workingOfferLabel ? (
              <span className="cust-akte-clever-notepad__sticky-chip cust-akte-clever-notepad__sticky-chip--offer">
                {workingOfferLabel}
              </span>
            ) : null}
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
        {workingOfferStrip}

        {truthGroups ? (
          TRUTH_GROUP_META.map((meta) => {
            const list = truthGroups[meta.key] ?? [];
            if (!list.length) return null;
            return (
              <div
                key={meta.key}
                className={[
                  'cust-akte-clever-notepad__group',
                  `cust-akte-clever-notepad__group--${meta.key}`,
                  meta.key === 'open' ? 'cust-akte-clever-notepad__group--open' : '',
                ].filter(Boolean).join(' ')}
              >
                <p className="cust-akte-clever-notepad__group-label">{meta.label}</p>
                {renderChipList(list, meta.key)}
              </div>
            );
          })
        ) : null}

        {!truthGroups && conditions.length ? (
          <div className="cust-akte-clever-notepad__group cust-akte-clever-notepad__group--conditions">
            <p className="cust-akte-clever-notepad__group-label">Konditionen</p>
            {renderChipList(conditions, 'condition')}
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

        {!truthGroups && !conditions.length && !bundledRest.length ? (
          <button type="button" className="cust-akte-clever-notepad__empty" onClick={() => onOpenFull?.()}>
            Wünsche ergänzen
          </button>
        ) : null}
      </section>
    </>
  );
}
