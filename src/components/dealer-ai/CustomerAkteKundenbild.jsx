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

const COLLAPSED_SUMMARY_MAX = 4;
const KERN_CHIP_MAX = 6;

function ChipIcon({ icon }) {
  const key = String(icon || '').toLowerCase();
  if (
    key === 'car'
    || key === 'fahrzeug'
    || key === 'inzahlungnahme'
    || key === 'equipment'
    || key === 'wichtig'
  ) {
    return <IconCar className="cust-kundenbild__chip-icon" />;
  }
  if (key === 'alltag' || key === 'users' || key === 'notiz' || key === 'persoenlich') {
    return <IconUser className="cust-kundenbild__chip-icon" />;
  }
  if (key === 'vertrag' || key === 'clock') {
    return <IconClock className="cust-kundenbild__chip-icon" />;
  }
  if (key === 'budget' || key === 'euro') {
    return <IconEuro className="cust-kundenbild__chip-icon" />;
  }
  return <IconCar className="cust-kundenbild__chip-icon" />;
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

function urgencyFirst(facts = []) {
  const urgent = [];
  const rest = [];
  for (const f of facts) {
    if (
      f.priority === 'required'
      || f.priority === 'important'
      || /sofort|unfall|ersatz|dringend/i.test(String(f.label || ''))
    ) {
      urgent.push(f);
    } else {
      rest.push(f);
    }
  }
  return [...urgent, ...rest];
}

/**
 * Collapsed summary chips under Konditionen (soft facts only).
 */
function buildCollapsedSummaryChips(soft, max = COLLAPSED_SUMMARY_MAX) {
  const groups = soft?.groups ?? [];
  const byId = new Map(groups.map((g) => [g.id, g]));
  const picked = [];
  const seen = new Set();

  function takeFacts(facts = [], limit = max) {
    for (const fact of facts) {
      if (picked.length >= limit) break;
      const id = fact?.id || fact?.label;
      const label = String(fact?.label || '').trim();
      if (!id || !label || seen.has(id)) continue;
      seen.add(id);
      picked.push(fact);
    }
  }

  takeFacts(urgencyFirst(byId.get(SOFT_SNAPSHOT_GROUP.PERSOENLICH)?.facts));
  takeFacts(urgencyFirst(byId.get(SOFT_SNAPSHOT_GROUP.MENSCH_ALLTAG)?.facts));
  takeFacts(byId.get(SOFT_SNAPSHOT_GROUP.FAHRZEUGPRAEFERENZ)?.facts);

  if (picked.length < max) {
    let wichtigFacts = byId.get(SOFT_SNAPSHOT_GROUP.AUSSTATTUNG_TECHNIK)?.facts ?? [];
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
    takeFacts(urgencyFirst(wichtigFacts));
  }

  if (!picked.length) takeFacts(soft?.summary?.tokens ?? []);
  if (!picked.length && soft?.chips?.length) takeFacts(urgencyFirst(soft.chips));

  const allSoft = flattenSnapshotChips(groups);
  const overflow = Math.max(0, allSoft.length - picked.length);
  return { chips: picked.slice(0, max), overflow };
}

function SnapshotChip({ chip, onFactTap, compact = false }) {
  const category = chip.category || chip.tint || 'alltag';
  const priority = chipPriorityMeta(chip);
  const displayLabel = stripEquipmentPrioritySuffix(chip.label || '') || chip.label;
  const isEmpty = Boolean(chip.empty);
  const isSalesCritical = Boolean(priority)
    || /sofort|unfall|ersatz|dringend|eilig/i.test(String(chip.label || ''));
  return (
    <button
      type="button"
      className={[
        'cust-kundenbild__chip',
        compact ? 'cust-kundenbild__chip--compact' : '',
        `cust-kundenbild__chip--${category}`,
        priority ? `cust-kundenbild__chip--prio-${priority.key}` : '',
        isSalesCritical ? 'is-sales-critical' : 'is-soft-fact',
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
      {!compact ? <ChipIcon icon={chip.icon || category} /> : null}
      <span className="cust-kundenbild__chip-label">{displayLabel}</span>
      {priority && !isEmpty && !compact ? (
        <span className="cust-kundenbild__chip-prio" aria-hidden>
          <span className="cust-kundenbild__chip-prio-dot" />
          {priority.label}
        </span>
      ) : null}
    </button>
  );
}

/**
 * Soft-Gruppe wie zuvor: Titel, Zähler, +, Chips mit Icons.
 * Leere Gruppen werden nicht gerendert.
 */
function SoftKnowledgeGroup({
  group,
  onFactTap = null,
  onAddToGroup = null,
}) {
  const facts = group?.facts ?? [];
  const hasFacts = facts.length > 0;
  const [open, setOpen] = useState(true);
  const panelId = useId();
  const count = facts.length;
  const canAdd = typeof onAddToGroup === 'function' && (group?.showAddCta !== false);

  function handleToggle() {
    setOpen((v) => !v);
  }

  if (!hasFacts) return null;

  return (
    <div className={`cust-kundenbild__group${open ? ' is-open' : ' is-closed'}`}>
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
            <ul className="cust-kundenbild__chips">
              {facts.map((chip) => (
                <li key={chip.id || chip.label}>
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
  const chips = (kern.chips ?? []).slice(0, KERN_CHIP_MAX);
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
 * Zone 2 – kompaktes Kundenwissen (Summary + optional Detail).
 */
export function CustomerAkteKundeninfos({
  soft = null,
  expanded = false,
  onToggle = null,
  onFactTap = null,
  onAddToGroup = null,
  onMerken = null,
  panelId = null,
  /** 'full' | 'bar' | 'panel' */
  variant = 'full',
}) {
  const hasSoft = Boolean(soft?.hasData || soft?.groups?.length || soft?.chips?.length);
  if (!hasSoft) return null;

  const sectionTitle = soft?.title || 'Kundenwissen';
  const { chips: summaryChips, overflow: summaryOverflow } = buildCollapsedSummaryChips(soft);
  const groups = (soft?.groups ?? []).filter((g) => (g?.facts?.length ?? 0) > 0);
  const showBar = variant === 'full' || variant === 'bar';
  const showPanel = variant === 'full' || variant === 'panel';
  const showCollapsedSummary = !expanded && showBar;

  function handleToggle() {
    onToggle?.(!expanded);
  }

  function handleMerken(e) {
    e?.stopPropagation?.();
    if (typeof onMerken === 'function') {
      onMerken();
      return;
    }
    const first = groups[0];
    if (first) onAddToGroup?.(first);
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
                className="cust-kundenbild__merken-btn"
                onClick={handleMerken}
              >
                + Merken
              </button>
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

          {showCollapsedSummary ? (
            summaryChips.length > 0 ? (
              <ul
                className="cust-kundenbild__summary-chips"
                aria-label="Kundenwissen Zusammenfassung"
              >
                {summaryChips.map((chip) => (
                  <li key={chip.id || chip.label}>
                    <SnapshotChip chip={chip} onFactTap={onFactTap} />
                  </li>
                ))}
                {summaryOverflow > 0 ? (
                  <li>
                    <button
                      type="button"
                      className="cust-kundenbild__chip cust-kundenbild__chip--overflow"
                      onClick={handleToggle}
                      aria-label={`${summaryOverflow} weitere Infos anzeigen`}
                    >
                      <span className="cust-kundenbild__chip-label">+{summaryOverflow}</span>
                    </button>
                  </li>
                ) : null}
              </ul>
            ) : (
              <p className="cust-kundenbild__summary-empty">Noch nichts gemerkt</p>
            )
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
              {groups.length > 0 ? (
                groups.map((group) => (
                  <SoftKnowledgeGroup
                    key={group.id}
                    group={group}
                    onFactTap={onFactTap}
                    onAddToGroup={onAddToGroup}
                  />
                ))
              ) : (
                <p className="cust-kundenbild__panel-empty">
                  Noch keine Details – über „+ Merken“ ergänzen.
                </p>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

/**
 * Kundenbild: Kernkonditionen (immer) + Soft-Sektion darunter.
 */
export default function CustomerAkteKundenbild({
  model = null,
  expanded = false,
  onToggle = null,
  onFactTap = null,
  onAddToGroup = null,
  onMerken = null,
  /** @deprecated use onAddToGroup */
  onAusstattungErgaenzen = null,
  /** 'full' | 'bar' | 'panel' */
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
  const hasKern = Boolean(kern);
  const hasSoft = Boolean(soft?.hasData || soft?.groups?.length || soft?.chips?.length);
  // Arbeitskontext nur noch im Composer-Pill – kein Fließtext-Doppel unter Kundenwissen
  if (!hasKern && !hasSoft) return null;

  const showKern = hasKern && (variant === 'full' || variant === 'bar');
  const showSoft = hasSoft && (variant === 'full' || variant === 'bar' || variant === 'panel');

  function handleAddToGroup(group) {
    if (typeof onAddToGroup === 'function') {
      onAddToGroup(group);
      return;
    }
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
          onMerken={onMerken}
          panelId={panelId}
          variant={variant}
        />
      ) : null}
    </section>
  );
}
