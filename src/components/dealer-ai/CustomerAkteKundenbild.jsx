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
 * Expanded: flache Soft-Tint-Pills ohne ALL-CAPS-Sektionsüberschriften.
 */
export default function CustomerAkteKundenbild({
  model = null,
  expanded = false,
  onToggle = null,
  onFactTap = null,
  onMerken = null,
  /** 'full' | 'bar' | 'panel' – bar=sticky Compact, panel=nur Chips, full=beides */
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

  const showBar = variant === 'full' || variant === 'bar';
  const showPanel = (variant === 'full' || variant === 'panel') && expanded;

  function handleToggle() {
    if (expanded) setChipsExpanded(false);
    onToggle?.(!expanded);
  }

  function handleChipClick(chip) {
    onFactTap?.(chip);
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
          <ul className="cust-kundenbild__chips">
            {visible.map((chip) => {
              const category = chip.category || chip.tint || 'alltag';
              return (
                <li key={chip.id}>
                  <button
                    type="button"
                    className={[
                      'cust-kundenbild__chip',
                      `cust-kundenbild__chip--${category}`,
                      chip.relevant || chip.highlighted ? 'is-relevant' : '',
                      chip.highlighted ? 'is-highlight' : '',
                    ].filter(Boolean).join(' ')}
                    data-category={category}
                    onClick={() => handleChipClick(chip)}
                    aria-label={`${chip.label} bearbeiten`}
                  >
                    {chip.label}
                  </button>
                </li>
              );
            })}
          </ul>
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
