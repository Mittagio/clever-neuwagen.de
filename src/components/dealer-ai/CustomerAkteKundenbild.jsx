import { useId } from 'react';
import {
  IconCar,
  IconChevronDown,
  IconChevronRight,
  IconClock,
  IconEuro,
  IconSwap,
  IconUsers,
} from './AkteIcons.jsx';
import './CustomerAkteKundenbild.css';

const GROUP_ICONS = {
  bedarf: IconUsers,
  budget: IconEuro,
  vertrag: IconClock,
  wunsch: IconCar,
  bestand: IconSwap,
};

/**
 * Kompakter aufklappbarer Kundenüberblick (Customer Truth).
 * Compact-Zeile sticky unter dem Header; Expanded = tappable Gruppen-Cards.
 */
export default function CustomerAkteKundenbild({
  model = null,
  expanded = false,
  onToggle = null,
  onFactTap = null,
  /** 'full' | 'bar' | 'panel' – bar=sticky Compact, panel=nur Gruppen, full=beides */
  variant = 'full',
}) {
  const panelId = useId();
  if (!model?.meta?.hasData) return null;

  const summaryLine = model.summary?.line || '';
  const groups = model.groups ?? [];
  const showBar = variant === 'full' || variant === 'bar';
  const showPanel = (variant === 'full' || variant === 'panel') && expanded;

  function handleToggle() {
    onToggle?.(!expanded);
  }

  function handleGroupTap(group) {
    const editKey = group?.editKey || group?.facts?.[0]?.editKey || null;
    if (!editKey) return;
    onFactTap?.({
      id: group.id,
      label: group.title,
      editKey,
      groupId: group.id,
    });
  }

  return (
    <section
      className={`cust-kundenbild${expanded ? ' is-expanded' : ' is-collapsed'}${variant !== 'full' ? ` cust-kundenbild--${variant}` : ''}`}
      aria-label="Kundenbild"
    >
      {showBar ? (
        <div className="cust-kundenbild__compact">
          <button
            type="button"
            className="cust-kundenbild__toggle"
            onClick={handleToggle}
            aria-expanded={expanded}
            aria-controls={panelId}
          >
            <span className="cust-kundenbild__title">Kundenbild</span>
            <span className={`cust-kundenbild__chevron${expanded ? ' is-open' : ''}`} aria-hidden>
              <IconChevronDown />
            </span>
          </button>
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
          <ul className="cust-kundenbild__groups">
            {groups.map((group) => {
              const Icon = GROUP_ICONS[group.id] || IconUsers;
              const lines = group.summaryLines?.length
                ? group.summaryLines
                : [(group.facts || []).map((f) => f.cardLabel || f.label).filter(Boolean).join(' · ')].filter(Boolean);
              return (
                <li key={group.id}>
                  <button
                    type="button"
                    className={`cust-kundenbild__row${group.relevant ? ' is-relevant' : ''}`}
                    onClick={() => handleGroupTap(group)}
                    aria-label={`${group.title} bearbeiten`}
                  >
                    <span className="cust-kundenbild__row-icon" aria-hidden>
                      <Icon />
                    </span>
                    <span className="cust-kundenbild__row-body">
                      <span className="cust-kundenbild__row-head">
                        <span className="cust-kundenbild__group-title">{group.title}</span>
                        <span className="cust-kundenbild__row-chevron" aria-hidden>
                          <IconChevronRight />
                        </span>
                      </span>
                      {lines.map((line) => (
                        <span key={line} className="cust-kundenbild__row-summary">
                          {line}
                        </span>
                      ))}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
