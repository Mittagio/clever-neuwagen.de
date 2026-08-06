import { useId, useState } from 'react';
import { IconCar, IconChevronDown, IconUser } from './AkteIcons.jsx';
import {
  SNAPSHOT_EXPANDED_VISIBLE_CHIPS,
  flattenSnapshotChips,
  splitExpandedChips,
} from '../../services/dealer/buildCustomerSnapshotModel.js';
import './CustomerAkteKundenbild.css';

function ChipIcon({ icon }) {
  if (icon === 'car' || icon === 'fahrzeug' || icon === 'inzahlungnahme') {
    return <IconCar className="cust-kundenbild__chip-icon" />;
  }
  if (icon === 'alltag' || icon === 'users') {
    return <IconUser className="cust-kundenbild__chip-icon" />;
  }
  return null;
}

/**
 * Kompakte Chip-Übersicht (Customer Truth) – Person zuerst.
 * Motto: Composer erfassen · Chips erkennen/korrigieren.
 * Offer-Konditionen liegen im Arbeitskontext-Strip darunter.
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

  const hasChips = Boolean(model?.meta?.hasData);
  const workingContext = model?.workingContext || null;
  if (!hasChips && !workingContext) return null;

  const groups = model?.groups ?? [];
  const summaryLine = model?.summary?.line || '';
  const allChips = model?.chips ?? flattenSnapshotChips(groups);
  const { visible, overflow } = splitExpandedChips(
    allChips,
    SNAPSHOT_EXPANDED_VISIBLE_CHIPS,
    chipsExpanded,
  );

  const showBar = variant === 'full' || variant === 'bar';
  const showPanel = (variant === 'full' || variant === 'panel') && expanded && hasChips;
  // Strip einmal: collapsed Bar, Expanded Panel, oder Full – nie doppelt Bar+Panel
  const showWorking = Boolean(workingContext?.line) && (
    variant === 'full'
    || variant === 'panel'
    || (variant === 'bar' && !expanded)
  );

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
      {showBar && hasChips ? (
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
                    <ChipIcon icon={chip.icon || category} />
                    <span className="cust-kundenbild__chip-label">{chip.label}</span>
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

      {showWorking ? (
        <div className="cust-kundenbild__working" aria-label={workingContext.title || 'Aktueller Arbeitskontext'}>
          <p className="cust-kundenbild__working-title">
            {workingContext.title || 'Aktueller Arbeitskontext'}
          </p>
          <p className="cust-kundenbild__working-line">{workingContext.line}</p>
        </div>
      ) : null}
    </section>
  );
}
