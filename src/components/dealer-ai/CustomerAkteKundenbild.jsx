import { useId } from 'react';
import {
  IconCar,
  IconChevronDown,
  IconClock,
  IconEuro,
  IconUser,
} from './AkteIcons.jsx';
import {
  EQUIPMENT_WISH_PRIORITY,
  EQUIPMENT_WISH_PRIORITY_LABEL,
  flattenSnapshotChips,
  SOFT_SNAPSHOT_GROUP,
  stripEquipmentPrioritySuffix,
} from '../../services/dealer/buildCustomerSnapshotModel.js';
import './CustomerAkteKundenbild.css';

const COLLAPSED_LINE_MAX = 3;

function ChipIcon({ icon }) {
  if (icon === 'car' || icon === 'fahrzeug' || icon === 'inzahlungnahme') {
    return <IconCar className="cust-kundenbild__chip-icon" />;
  }
  if (icon === 'alltag' || icon === 'users') {
    return <IconUser className="cust-kundenbild__chip-icon" />;
  }
  if (icon === 'vertrag' || icon === 'clock') {
    return <IconClock className="cust-kundenbild__chip-icon" />;
  }
  if (icon === 'budget' || icon === 'euro') {
    return <IconEuro className="cust-kundenbild__chip-icon" />;
  }
  return null;
}

function chipPriorityMeta(chip) {
  const raw = chip?.priority
    || (/·\s*muss\s*$/i.test(chip?.label || '') ? EQUIPMENT_WISH_PRIORITY.REQUIRED : null)
    || (/·\s*wichtig\s*$/i.test(chip?.label || '') ? EQUIPMENT_WISH_PRIORITY.IMPORTANT : null);
  if (raw === EQUIPMENT_WISH_PRIORITY.REQUIRED || raw === 'required') {
    return { key: 'required', label: EQUIPMENT_WISH_PRIORITY_LABEL[EQUIPMENT_WISH_PRIORITY.REQUIRED] };
  }
  if (raw === EQUIPMENT_WISH_PRIORITY.IMPORTANT || raw === 'important') {
    return { key: 'important', label: EQUIPMENT_WISH_PRIORITY_LABEL[EQUIPMENT_WISH_PRIORITY.IMPORTANT] };
  }
  return null;
}

/** Collapsed summary: max. zwei fachliche Zeilen aus bestehenden Soft-Gruppen (keine Taxonomie-Änderung). */
function buildCollapsedSummaryLines(soft) {
  const groups = soft?.groups ?? [];
  const byId = new Map(groups.map((g) => [g.id, g]));

  function lineFromFacts(prefix, facts = [], max = COLLAPSED_LINE_MAX) {
    const labels = facts
      .map((f) => String(f.label || '').trim())
      .filter(Boolean);
    if (!labels.length) return null;
    const shown = labels.slice(0, max);
    const overflow = labels.length - shown.length;
    const body = [
      ...shown,
      overflow > 0 ? `+${overflow}` : null,
    ].filter(Boolean).join(' · ');
    return { prefix, body };
  }

  const fahrzeugGroup = byId.get(SOFT_SNAPSHOT_GROUP.FAHRZEUGPRAEFERENZ);
  const wichtigGroup = byId.get(SOFT_SNAPSHOT_GROUP.AUSSTATTUNG_TECHNIK);

  const lines = [];
  const fahrzeugLine = lineFromFacts('Fahrzeug', fahrzeugGroup?.facts);
  if (fahrzeugLine) lines.push(fahrzeugLine);

  // Ausstattung / entscheidend → „Wichtig“ (kein Taxonomie-Umbau)
  let wichtigFacts = wichtigGroup?.facts ?? [];
  if (!wichtigFacts.length) {
    wichtigFacts = groups
      .flatMap((g) => g.facts || [])
      .filter((f) => (
        f.priority === 'required'
        || f.priority === 'important'
        || f.tint === 'wichtig'
        || f.category === 'wichtig'
      ));
  }
  const wichtigLine = lineFromFacts('Wichtig', wichtigFacts);
  if (wichtigLine) lines.push(wichtigLine);

  if (lines.length) return lines;

  // Fallback: bestehende Summary, max. zwei Zeilen ohne falsches Fach-Label
  const tokens = (soft?.summary?.tokens ?? [])
    .map((t) => String(t.label || '').trim())
    .filter(Boolean);
  if (tokens.length) {
    const first = tokens.slice(0, COLLAPSED_LINE_MAX);
    const rest = tokens.slice(COLLAPSED_LINE_MAX);
    const out = [{ prefix: null, body: first.join(' · ') }];
    if (rest.length) {
      const shown = rest.slice(0, COLLAPSED_LINE_MAX);
      const overflow = rest.length - shown.length;
      out.push({
        prefix: null,
        body: [...shown, overflow > 0 ? `+${overflow}` : null].filter(Boolean).join(' · '),
      });
    } else if ((soft?.summary?.overflow ?? 0) > 0) {
      out[0].body = `${out[0].body} · +${soft.summary.overflow}`;
    }
    return out;
  }
  const raw = String(soft?.summary?.line || '').trim();
  return raw ? [{ prefix: null, body: raw }] : [];
}

function SnapshotChip({ chip, onFactTap }) {
  const category = chip.category || chip.tint || 'alltag';
  const priority = chipPriorityMeta(chip);
  const displayLabel = stripEquipmentPrioritySuffix(chip.label || '') || chip.label;
  return (
    <button
      type="button"
      className={[
        'cust-kundenbild__chip',
        `cust-kundenbild__chip--${category}`,
        priority ? `cust-kundenbild__chip--prio-${priority.key}` : '',
        chip.relevant || chip.highlighted ? 'is-relevant' : '',
        chip.highlighted ? 'is-highlight' : '',
      ].filter(Boolean).join(' ')}
      data-category={category}
      data-priority={priority?.key || undefined}
      onClick={() => onFactTap?.(chip)}
      aria-label={`${chip.label} bearbeiten`}
    >
      <ChipIcon icon={chip.icon || category} />
      <span className="cust-kundenbild__chip-label">{displayLabel}</span>
      {priority ? (
        <span className="cust-kundenbild__chip-prio" aria-hidden>
          <span className="cust-kundenbild__chip-prio-dot" />
          {priority.label}
        </span>
      ) : null}
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

  return (
    <div
      className="cust-kundenbild__kern"
      aria-label={kern.title || 'Kernkonditionen'}
    >
      <p className="cust-kundenbild__kern-title">
        {kern.title || 'Kernkonditionen'}
      </p>
      {chips.length > 0 ? (
        <ul className="cust-kundenbild__kern-chips">
          {chips.map((chip) => (
            <li key={chip.id}>
              <SnapshotChip chip={chip} onFactTap={onFactTap} />
            </li>
          ))}
        </ul>
      ) : kern.line ? (
        <p className="cust-kundenbild__kern-line">{kern.line}</p>
      ) : null}
    </div>
  );
}

/**
 * Zone 2 – eine klappbare Soft-Sektion „Kundenwissen“ (A/B/C).
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

  const sectionTitle = soft?.title || 'Kundenwissen';
  const summaryLines = buildCollapsedSummaryLines(soft);
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
              <span className="cust-kundenbild__title">{sectionTitle}</span>
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
                aria-label={expanded ? 'Kundenwissen einklappen' : 'Kundenwissen ausklappen'}
              >
                <span className={`cust-kundenbild__chevron${expanded ? ' is-open' : ''}`} aria-hidden>
                  <IconChevronDown />
                </span>
              </button>
            </div>
          </div>
          {!expanded && summaryLines.length > 0 ? (
            <div
              className="cust-kundenbild__summary"
              title={summaryLines.map((l) => (l.prefix ? `${l.prefix}: ${l.body}` : l.body)).join('\n')}
            >
              {summaryLines.map((line) => (
                <p key={line.prefix || line.body} className="cust-kundenbild__summary-line">
                  {line.prefix ? (
                    <>
                      <span className="cust-kundenbild__summary-prefix">{line.prefix}:</span>
                      {' '}
                      {line.body}
                    </>
                  ) : line.body}
                </p>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      {showPanel ? (
        <div
          id={panelId || undefined}
          className="cust-kundenbild__panel"
          role="region"
          aria-label={`${sectionTitle} Details`}
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
