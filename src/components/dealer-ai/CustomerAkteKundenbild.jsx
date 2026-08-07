import { useId, useState } from 'react';
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

/** Collapsed summary: max. zwei fachliche Zeilen. */
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

  const personGroup = byId.get(SOFT_SNAPSHOT_GROUP.MENSCH_ALLTAG);
  const fahrzeugGroup = byId.get(SOFT_SNAPSHOT_GROUP.FAHRZEUGPRAEFERENZ);
  const ausstattungGroup = byId.get(SOFT_SNAPSHOT_GROUP.AUSSTATTUNG_TECHNIK);

  const lines = [];
  const personLine = lineFromFacts('Person', personGroup?.facts);
  if (personLine) lines.push(personLine);

  const fahrzeugLine = lineFromFacts('Fahrzeug', fahrzeugGroup?.facts);
  if (fahrzeugLine && lines.length < 2) lines.push(fahrzeugLine);

  if (lines.length < 2) {
    let wichtigFacts = ausstattungGroup?.facts ?? [];
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
    const wichtigLine = lineFromFacts('Ausstattung', wichtigFacts);
    if (wichtigLine) lines.push(wichtigLine);
  }

  if (lines.length) return lines.slice(0, 2);

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
  const isEmpty = Boolean(chip.empty);
  return (
    <button
      type="button"
      className={[
        'cust-kundenbild__chip',
        `cust-kundenbild__chip--${category}`,
        priority ? `cust-kundenbild__chip--prio-${priority.key}` : '',
        isEmpty ? 'is-empty' : '',
        chip.relevant || chip.highlighted ? 'is-relevant' : '',
        chip.highlighted ? 'is-highlight' : '',
      ].filter(Boolean).join(' ')}
      data-category={category}
      data-priority={priority?.key || undefined}
      data-empty={isEmpty ? 'true' : undefined}
      onClick={() => onFactTap?.(chip)}
      aria-label={isEmpty ? `${chip.label} ergänzen` : `${chip.label} bearbeiten`}
    >
      <ChipIcon icon={chip.icon || category} />
      <span className="cust-kundenbild__chip-label">{displayLabel}</span>
      {priority && !isEmpty ? (
        <span className="cust-kundenbild__chip-prio" aria-hidden>
          <span className="cust-kundenbild__chip-prio-dot" />
          {priority.label}
        </span>
      ) : null}
    </button>
  );
}

/**
 * Eine Soft-Kategorie: klappbar, auch leer, mit Plus → vordefinierte Chips.
 */
function SoftKnowledgeGroup({
  group,
  onFactTap = null,
  onAddToGroup = null,
}) {
  const facts = group?.facts ?? [];
  const hasFacts = facts.length > 0;
  const [open, setOpen] = useState(hasFacts);
  const panelId = useId();
  const count = facts.length;
  const canAdd = typeof onAddToGroup === 'function' && (group?.showAddCta !== false);

  function handleToggle() {
    setOpen((v) => !v);
  }

  return (
    <div className={`cust-kundenbild__group${open ? ' is-open' : ' is-closed'}${hasFacts ? '' : ' is-empty'}`}>
      <div className="cust-kundenbild__group-head">
        <button
          type="button"
          className="cust-kundenbild__group-toggle"
          onClick={handleToggle}
          aria-expanded={open}
          aria-controls={panelId}
        >
          <span className="cust-kundenbild__group-title">{group.title}</span>
          {count > 0 ? (
            <span className="cust-kundenbild__group-count">{count}</span>
          ) : null}
          <span className={`cust-kundenbild__group-chevron${open ? ' is-open' : ''}`} aria-hidden>
            <IconChevronDown />
          </span>
        </button>
        {canAdd ? (
          <button
            type="button"
            className="cust-kundenbild__group-add"
            onClick={(e) => {
              e.stopPropagation();
              onAddToGroup(group);
            }}
            aria-label={`${group.title} ergänzen`}
            title="Vordefinierte Chips"
          >
            +
          </button>
        ) : null}
      </div>
      <div
        className={`cust-kundenbild__group-collapse${open ? ' is-open' : ''}`}
        aria-hidden={!open}
      >
        <div className="cust-kundenbild__group-collapse-inner">
          <div
            id={panelId}
            className="cust-kundenbild__group-body"
            role="region"
            aria-label={group.title}
            {...(!open ? { inert: true } : {})}
          >
            {hasFacts ? (
              <ul className="cust-kundenbild__chips">
                {facts.map((chip) => (
                  <li key={chip.id}>
                    <SnapshotChip chip={chip} onFactTap={onFactTap} />
                  </li>
                ))}
                {canAdd ? (
                  <li>
                    <button
                      type="button"
                      className="cust-kundenbild__chip cust-kundenbild__chip--add"
                      onClick={() => onAddToGroup(group)}
                      aria-label={`${group.title}: Chip hinzufügen`}
                    >
                      <span className="cust-kundenbild__chip-label">+</span>
                    </button>
                  </li>
                ) : null}
              </ul>
            ) : (
              <p className="cust-kundenbild__group-empty">
                Noch nichts gemerkt.
                {canAdd ? (
                  <>
                    {' '}
                    <button
                      type="button"
                      className="cust-kundenbild__group-empty-add"
                      onClick={() => onAddToGroup(group)}
                    >
                      Chips wählen
                    </button>
                    {' '}
                    oder Composer (Merken).
                  </>
                ) : (
                  ' Über Composer (Merken) ergänzen.'
                )}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Zone 1 – immer sichtbare Konditionen (Tap → Mini-Editor).
 */
export function CustomerAkteKernkonditionen({
  kern = null,
  onFactTap = null,
}) {
  if (!kern) return null;
  const chips = kern.chips ?? [];
  if (!kern.hasData && !kern.line && chips.length === 0) return null;

  return (
    <div
      className="cust-kundenbild__kern"
      aria-label={kern.title || 'Konditionen'}
    >
      <p className="cust-kundenbild__kern-title">
        {kern.title || 'Konditionen'}
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
 * Zone 2 – klappbare Soft-Sektion „Kundenwissen“ mit 4 Unterkategorien.
 */
export function CustomerAkteKundeninfos({
  soft = null,
  expanded = false,
  onToggle = null,
  onFactTap = null,
  onAddToGroup = null,
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
  const showPanel = variant === 'full' || variant === 'panel';

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
          {summaryLines.length > 0 ? (
            <div
              className={`cust-kundenbild__summary${expanded ? ' is-hidden' : ''}`}
              title={summaryLines.map((l) => (l.prefix ? `${l.prefix}: ${l.body}` : l.body)).join('\n')}
              aria-hidden={expanded}
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
          className={`cust-kundenbild__panel-collapse${expanded ? ' is-open' : ''}`}
          aria-hidden={!expanded}
        >
          <div className="cust-kundenbild__panel-collapse-inner">
            <div
              id={panelId || undefined}
              className="cust-kundenbild__panel"
              role="region"
              aria-label={`${sectionTitle} Details`}
              {...(!expanded ? { inert: true } : {})}
            >
              {groups.map((group) => (
                <SoftKnowledgeGroup
                  key={group.id}
                  group={group}
                  onFactTap={onFactTap}
                  onAddToGroup={onAddToGroup}
                />
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

/**
 * Kundenbild: Kernkonditionen (immer) + Soft-Sektion darunter.
 * Motto: Composer merken · Plus-Chip wählen · Chips erkennen/korrigieren.
 */
export default function CustomerAkteKundenbild({
  model = null,
  expanded = false,
  onToggle = null,
  onFactTap = null,
  onAddToGroup = null,
  /** @deprecated use onAddToGroup */
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

  const hasKern = Boolean(kern);
  const hasSoft = Boolean(soft?.hasData || soft?.groups?.length || soft?.chips?.length);
  if (!hasKern && !hasSoft && !workingContext) return null;

  const showKern = hasKern && (variant === 'full' || variant === 'bar');
  const showSoft = hasSoft && (variant === 'full' || variant === 'bar' || variant === 'panel');
  const showWorking = Boolean(workingContext?.line) && (
    variant === 'full'
    || (variant === 'bar' && !expanded)
  );

  function handleAddToGroup(group) {
    if (typeof onAddToGroup === 'function') {
      onAddToGroup(group);
      return;
    }
    // Legacy-Fallback: Ausstattung → alter CTA
    if (
      group?.id === SOFT_SNAPSHOT_GROUP.AUSSTATTUNG_TECHNIK
      && typeof onAusstattungErgaenzen === 'function'
    ) {
      onAusstattungErgaenzen();
    }
  }

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
          onAddToGroup={handleAddToGroup}
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
