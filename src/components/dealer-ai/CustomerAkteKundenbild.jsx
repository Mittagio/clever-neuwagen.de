import { useId } from 'react';
import { IconCar, IconChevronDown, IconUser } from './AkteIcons.jsx';
import { flattenSnapshotChips } from '../../services/dealer/buildCustomerSnapshotModel.js';
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

function SnapshotChip({ chip, onFactTap }) {
  const category = chip.category || chip.tint || 'alltag';
  return (
    <button
      type="button"
      className={[
        'cust-kundenbild__chip',
        `cust-kundenbild__chip--${category}`,
        chip.relevant || chip.highlighted ? 'is-relevant' : '',
        chip.highlighted ? 'is-highlight' : '',
      ].filter(Boolean).join(' ')}
      data-category={category}
      onClick={() => onFactTap?.(chip)}
      aria-label={`${chip.label} bearbeiten`}
    >
      <ChipIcon icon={chip.icon || category} />
      <span className="cust-kundenbild__chip-label">{chip.label}</span>
    </button>
  );
}

/**
 * Zone 1 – immer sichtbare Kernkonditionen (Tap → Mini-Editor).
 */
export function CustomerAkteKernkonditionen({
  kern = null,
  onFactTap = null,
}) {
  if (!kern?.hasData && !kern?.line) return null;
  const chips = kern.chips ?? [];
  const lineChips = chips.filter((c) => (
    c.id !== 'vehicleWish'
    && !String(c.id).startsWith('track-fav')
    && c.id !== 'modelHint'
    && c.id !== 'trim'
  ));
  const vehicleChip = chips.find((c) => (
    c.id === 'vehicleWish'
    || String(c.id).startsWith('track-fav')
    || c.id === 'modelHint'
    || c.id === 'trim'
  ));

  return (
    <div
      className={`cust-kundenbild__kern${kern.source === 'deal' ? ' is-deal' : ''}`}
      aria-label={kern.title || 'Kernkonditionen'}
    >
      <p className="cust-kundenbild__kern-title">
        {kern.title || 'Kernkonditionen'}
      </p>
      {lineChips.length > 0 ? (
        <ul className="cust-kundenbild__kern-chips">
          {lineChips.map((chip) => (
            <li key={chip.id}>
              <SnapshotChip chip={chip} onFactTap={onFactTap} />
            </li>
          ))}
        </ul>
      ) : kern.line ? (
        <p className="cust-kundenbild__kern-line">{kern.line}</p>
      ) : null}
      {vehicleChip ? (
        <ul className="cust-kundenbild__kern-vehicle">
          <li>
            <SnapshotChip chip={vehicleChip} onFactTap={onFactTap} />
          </li>
        </ul>
      ) : null}
    </div>
  );
}

/**
 * Zone 2 – eine klappbare Soft-Sektion „Kundeninfos & Wünsche“.
 */
export function CustomerAkteKundeninfos({
  soft = null,
  expanded = false,
  onToggle = null,
  onFactTap = null,
  onMerken = null,
  onAusstattungErgaenzen = null,
  panelId = null,
  /** 'full' | 'bar' | 'panel' */
  variant = 'full',
}) {
  const hasSoft = Boolean(soft?.hasData || soft?.groups?.length || soft?.chips?.length);
  if (!hasSoft) return null;

  const summaryLine = soft?.summary?.line || '';
  const groups = soft?.groups ?? [];
  const showBar = variant === 'full' || variant === 'bar';
  const showPanel = (variant === 'full' || variant === 'panel') && expanded;

  function handleToggle() {
    onToggle?.(!expanded);
  }

  return (
    <div className={`cust-kundenbild__soft${expanded ? ' is-expanded' : ' is-collapsed'}`}>
      {showBar ? (
        <div className="cust-kundenbild__compact">
          <div className="cust-kundenbild__head">
            <button
              type="button"
              className="cust-kundenbild__toggle"
              onClick={handleToggle}
              aria-expanded={expanded}
              aria-controls={panelId || undefined}
            >
              <span className="cust-kundenbild__title">Kundeninfos & Wünsche</span>
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
                aria-controls={panelId || undefined}
                aria-label={expanded ? 'Kundeninfos einklappen' : 'Kundeninfos ausklappen'}
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
          id={panelId || undefined}
          className="cust-kundenbild__panel"
          role="region"
          aria-label="Kundeninfos & Wünsche Details"
        >
          {groups.map((group) => (
            <div key={group.id} className="cust-kundenbild__group">
              <p className="cust-kundenbild__group-title">{group.title}</p>
              {group.facts?.length ? (
                <ul className="cust-kundenbild__chips">
                  {group.facts.map((chip) => (
                    <li key={chip.id}>
                      <SnapshotChip chip={chip} onFactTap={onFactTap} />
                    </li>
                  ))}
                </ul>
              ) : null}
              {group.showEquipmentCta && typeof onAusstattungErgaenzen === 'function' ? (
                <button
                  type="button"
                  className="cust-kundenbild__equip-cta"
                  onClick={onAusstattungErgaenzen}
                >
                  + Ausstattung ergänzen
                </button>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

/**
 * Kundenbild: Kernkonditionen (immer) + eine Soft-Sektion darunter.
 * Motto: Composer erfassen · Chips erkennen/korrigieren.
 */
export default function CustomerAkteKundenbild({
  model = null,
  expanded = false,
  onToggle = null,
  onFactTap = null,
  onMerken = null,
  onAusstattungErgaenzen = null,
  /** 'full' | 'bar' | 'panel' – bar=sticky Compact, panel=nur Soft-Details, full=beides */
  variant = 'full',
}) {
  const panelId = useId();

  const kern = model?.kern ?? null;
  const soft = model?.soft ?? (
    model?.groups || model?.chips
      ? {
        hasData: Boolean(model?.meta?.hasSoft ?? model?.meta?.hasData),
        summary: model?.summary,
        groups: model?.groups,
        chips: model?.chips ?? flattenSnapshotChips(model?.groups ?? []),
      }
      : null
  );
  const workingContext = model?.workingContext || null;

  const hasKern = Boolean(kern?.hasData || kern?.line);
  const hasSoft = Boolean(soft?.hasData || soft?.groups?.length || soft?.chips?.length);
  if (!hasKern && !hasSoft && !workingContext) return null;

  const showKern = hasKern && (variant === 'full' || variant === 'bar');
  const showSoft = hasSoft && (variant === 'full' || variant === 'bar' || variant === 'panel');
  // Working-Strip nur in Bar/Full (nicht doppelt im Panel)
  const showWorking = Boolean(workingContext?.line) && (
    variant === 'full'
    || (variant === 'bar' && !expanded)
  );

  return (
    <section
      className={`cust-kundenbild${expanded ? ' is-expanded' : ' is-collapsed'}${variant !== 'full' ? ` cust-kundenbild--${variant}` : ''}`}
      aria-label="Kundenbild"
    >
      {showKern ? (
        <CustomerAkteKernkonditionen kern={kern} onFactTap={onFactTap} />
      ) : null}

      {showSoft ? (
        <CustomerAkteKundeninfos
          soft={soft}
          expanded={expanded}
          onToggle={onToggle}
          onFactTap={onFactTap}
          onMerken={onMerken}
          onAusstattungErgaenzen={onAusstattungErgaenzen}
          panelId={panelId}
          variant={variant}
        />
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
