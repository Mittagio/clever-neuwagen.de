import { useId } from 'react';
import { IconChevronDown } from './AkteIcons.jsx';
import './CustomerAkteKundenbild.css';

/**
 * Kompakter aufklappbarer Kundenüberblick (Customer Truth).
 * Compact-Zeile sticky unter dem Header; Expanded wächst nach unten und scrollt mit.
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
          {groups.map((group) => (
            <div key={group.id} className="cust-kundenbild__group">
              <h3 className="cust-kundenbild__group-title">{group.title}</h3>
              <ul className="cust-kundenbild__facts">
                {group.facts.map((fact) => (
                  <li key={fact.id}>
                    <button
                      type="button"
                      className={`cust-kundenbild__fact${fact.relevant ? ' is-relevant' : ''}`}
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
        </div>
      ) : null}
    </section>
  );
}
