import { useId, useState } from 'react';
import { IconChevronDown } from './AkteIcons.jsx';
import {
  SNAPSHOT_EXPANDED_VISIBLE_CHIPS,
  flattenSnapshotChips,
  splitExpandedChips,
} from '../../services/dealer/buildCustomerSnapshotModel.js';
import './CustomerAkteKundenbild.css';

/**
 * Kompakte Chip-Übersicht (Customer Truth).
 * Motto: Composer erfassen · Chips erkennen/korrigieren.
 */
export default function CustomerAkteKundenbild({
  model = null,
  expanded = false,
  onToggle = null,
  onFactTap = null,
  onMerken = null,
  /** 'full' | 'bar' | 'panel' – bar=sticky Compact, panel=nur Gruppen, full=beides */
  variant = 'full',
}) {
  const panelId = useId();
  const [chipsExpanded, setChipsExpanded] = useState(false);

  if (!model?.meta?.hasData) return null;

  const groups = model.groups ?? [];
  const summaryLine = model.summary?.line || '';
  const allChips = model.chips ?? flattenSnapshotChips(groups);
  const { visible, overflow } = splitExpandedChips(
    allChips,
    SNAPSHOT_EXPANDED_VISIBLE_CHIPS,
    chipsExpanded,
  );
  const visibleIds = new Set(visible.map((c) => c.id));
  const visibleByGroup = groups
    .map((g) => ({
      ...g,
      facts: (g.facts || []).filter((f) => visibleIds.has(f.id)),
    }))
    .filter((g) => g.facts.length > 0);

  const showBar = variant === 'full' || variant === 'bar';
  const showPanel = (variant === 'full' || variant === 'panel') && expanded;

  function handleToggle() {
    if (expanded) setChipsExpanded(false);
    onToggle?.(!expanded);
  }

  function handleFactClick(fact) {
    onFactTap?.(fact);
  }

  return (
    <section
      className={`cust-kundenbild${expanded ? ' is-expanded' : ' is-collapsed'}${variant !== 'full' ? ` cust-kundenbild--${variant}` : ''}`}
      aria-label="Kundenbild"
    >
      {showBar ? (
        <div className="cust-kundenbild__compact">
          <div className="cust-kundenbild__head">
            <button
              type="button"
              className="cust-kundenbild__toggle"
              onClick={handleToggle}
              aria-expanded={expanded}
              aria-controls={panelId}
            >
              <span className="cust-kundenbild__title">Kundenbild</span>
            </button>
            <div className="cust-kundenbild__head-actions">
              {typeof onMerken === 'function' ? (
                <button
                  type="button"
                  className="cust-kundenbild__merken"
                  onClick={(e) => {
                    e.stopPropagation();
                    onMerken();
                  }}
                >
                  + Merken
                </button>
              ) : null}
              <button
                type="button"
                className="cust-kundenbild__chevron-btn"
                onClick={handleToggle}
                aria-expanded={expanded}
                aria-controls={panelId}
                aria-label={expanded ? 'Kundenbild einklappen' : 'Kundenbild ausklappen'}
              >
                <span className={`cust-kundenbild__chevron${expanded ? ' is-open' : ''}`} aria-hidden>
                  <IconChevronDown />
                </span>
              </button>
            </div>
          </div>
          {!expanded && summaryLine ? (
            <p className="cust-kundenbild__summary" title={summaryLine}>
              {summaryLine}
            </p>
          ) : null}
        </div>
      ) : null}

      {showPanel ? (
        <div
          id={panelId}
          className="cust-kundenbild__panel"
          role="region"
          aria-label="Kundenbild Details"
        >
          {visibleByGroup.map((group) => (
            <div key={group.id} className="cust-kundenbild__group">
              <h3 className="cust-kundenbild__group-title">{group.title}</h3>
              <ul className="cust-kundenbild__facts">
                {group.facts.map((fact) => (
                  <li key={fact.id}>
                    <button
                      type="button"
                      className={[
                        'cust-kundenbild__fact',
                        fact.tint ? `cust-kundenbild__fact--${fact.tint}` : '',
                        fact.relevant || fact.highlighted ? ' is-relevant' : '',
                        fact.highlighted ? ' is-highlight' : '',
                      ].filter(Boolean).join('')}
                      onClick={() => handleFactClick(fact)}
                      aria-label={`${fact.label} bearbeiten`}
                    >
                      {fact.label}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
          {overflow > 0 && !chipsExpanded ? (
            <button
              type="button"
              className="cust-kundenbild__more"
              onClick={() => setChipsExpanded(true)}
            >
              {`+ ${overflow} weitere`}
            </button>
          ) : null}
          {chipsExpanded && allChips.length > SNAPSHOT_EXPANDED_VISIBLE_CHIPS ? (
            <button
              type="button"
              className="cust-kundenbild__more cust-kundenbild__more--less"
              onClick={() => setChipsExpanded(false)}
            >
              Weniger
            </button>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
