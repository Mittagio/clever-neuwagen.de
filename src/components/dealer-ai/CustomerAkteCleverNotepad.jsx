import { useEffect, useMemo, useRef, useState } from 'react';
import { buildAttributedWishChips } from '../../services/dealer/customerUnderstanding.js';
import './CustomerAkte.css';

const MOBILE_VISIBLE = 6;

function normalizeKey(label) {
  return String(label ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
}

/**
 * Notizzettel für die Clever-Verkäuferseite – nur bestehende Wish/Need-Chips.
 * Mobile: max. ~2 Reihen, Rest als +N. Sticky-Kompaktzeile wenn der Block aus dem Viewport ist.
 */
export default function CustomerAkteCleverNotepad({
  lead = null,
  conditionChips = [],
  customerName = '',
  onOpenFull,
  sticky = true,
}) {
  const [compact, setCompact] = useState(false);
  const blockRef = useRef(null);

  const chips = useMemo(() => {
    const attributed = buildAttributedWishChips(lead) ?? [];
    const merged = [];
    const seen = new Set();

    const push = (chip) => {
      const label = typeof chip === 'string' ? chip : chip?.label;
      const key = normalizeKey(label);
      if (!key || seen.has(key)) return;
      seen.add(key);
      merged.push(typeof chip === 'string' ? { label, origin: 'customer' } : { ...chip, label });
    };

    for (const chip of conditionChips) push(chip);
    for (const chip of attributed) push(chip);
    return merged;
  }, [lead, conditionChips]);

  useEffect(() => {
    if (!sticky || !blockRef.current) return undefined;
    const node = blockRef.current;
    const observer = new IntersectionObserver(
      ([entry]) => setCompact(!entry.isIntersecting),
      { root: null, threshold: 0, rootMargin: '-48px 0px 0px 0px' },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [sticky, chips.length]);

  const visible = chips.slice(0, MOBILE_VISIBLE);
  const overflow = Math.max(0, chips.length - MOBILE_VISIBLE);
  const stickyChips = chips.slice(0, 5);

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

      <section ref={blockRef} className="cust-akte-clever-notepad" aria-label="Notizzettel">
        <p className="cust-akte-clever-notepad__label">Notizzettel</p>
        <ul className="cust-akte-clever-notepad__chips">
          {visible.map((chip) => (
            <li key={`${chip.origin}-${chip.label}`}>
              <button
                type="button"
                className={`cust-akte-clever-notepad__chip${chip.origin === 'seller' ? ' cust-akte-clever-notepad__chip--seller' : ''}`}
                onClick={() => onOpenFull?.()}
              >
                {chip.label}
                {chip.origin === 'seller' && chip.badge ? (
                  <span className="cust-akte-clever-notepad__badge">{chip.badge}</span>
                ) : null}
              </button>
            </li>
          ))}
          {overflow > 0 ? (
            <li>
              <button
                type="button"
                className="cust-akte-clever-notepad__more"
                onClick={() => onOpenFull?.()}
              >
                +{overflow}
              </button>
            </li>
          ) : null}
        </ul>
      </section>
    </>
  );
}
