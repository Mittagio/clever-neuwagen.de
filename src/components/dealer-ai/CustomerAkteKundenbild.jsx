import { useId, useState } from 'react';
import {
  IconCalendar,
  IconCar,
  IconChevronDown,
  IconClock,
  IconEuro,
  IconGauge,
  IconPencil,
  IconSeat,
  IconUser,
  IconUsers,
} from './AkteIcons.jsx';
import {
  EQUIPMENT_WISH_PRIORITY,
  EQUIPMENT_WISH_PRIORITY_LABEL,
  buildKnowledgeChipProvenanceTitle,
  flattenSnapshotChips,
  normalizeKnowledgeChipSource,
  SOFT_SNAPSHOT_GROUP,
  stripEquipmentPrioritySuffix,
} from '../../services/dealer/buildCustomerSnapshotModel.js';
import './CustomerAkteKundenbild.css';

const COLLAPSED_SUMMARY_MAX = 4;
const KERN_CHIP_MAX = 6;
/** Pro Bucket in der erweiterten Karte: max. Chips, Rest als +N. */
const GROUP_CHIP_VISIBLE_MAX = 4;

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
  if (
    key === 'alltag'
    || key === 'users'
    || key === 'notiz'
    || key === 'persoenlich'
    || key === 'persoenliches'
    || key === 'sonstiges'
  ) {
    return <IconUser className="cust-kundenbild__chip-icon" />;
  }
  if (key === 'vertrag' || key === 'clock' || key === 'term' || key === 'laufzeit') {
    return <IconClock className="cust-kundenbild__chip-icon" />;
  }
  if (key === 'km' || key === 'mileage' || key === 'gauge' || key === 'speedo') {
    return <IconGauge className="cust-kundenbild__chip-icon" />;
  }
  if (key === 'calendar' || key === 'ende' || key === 'enddate' || key === 'lieferzeit') {
    return <IconCalendar className="cust-kundenbild__chip-icon" />;
  }
  if (key === 'budget' || key === 'euro') {
    return <IconEuro className="cust-kundenbild__chip-icon" />;
  }
  return <IconCar className="cust-kundenbild__chip-icon" />;
}

function GroupCategoryIcon({ groupId }) {
  if (groupId === SOFT_SNAPSHOT_GROUP.AUSSTATTUNG_TECHNIK) {
    return <IconSeat className="cust-kundenbild__group-icon" />;
  }
  if (groupId === SOFT_SNAPSHOT_GROUP.SONSTIGES) {
    return <IconUser className="cust-kundenbild__group-icon" />;
  }
  if (groupId === SOFT_SNAPSHOT_GROUP.PERSOENLICHES) {
    return <IconUsers className="cust-kundenbild__group-icon" />;
  }
  // Fahrzeugwunsch
  return <IconCar className="cust-kundenbild__group-icon" />;
}

function EditLink({ onClick, ariaLabel }) {
  return (
    <button
      type="button"
      className="cust-kundenbild__edit-link"
      onClick={onClick}
      aria-label={ariaLabel}
      title={ariaLabel}
    >
      <IconPencil className="cust-kundenbild__edit-icon" aria-hidden />
    </button>
  );
}

function chipPriorityMeta(chip) {
  const raw = chip?.priority
    || (/·\s*muss\s*$/i.test(chip?.label || '') ? EQUIPMENT_WISH_PRIORITY.REQUIRED : null)
    || (/·\s*wichtig\s*$/i.test(chip?.label || '') ? EQUIPMENT_WISH_PRIORITY.IMPORTANT : null)
    || (/·\s*wunsch\s*$/i.test(chip?.label || '') ? EQUIPMENT_WISH_PRIORITY.PREFERRED : null);
  if (raw === EQUIPMENT_WISH_PRIORITY.REQUIRED || raw === 'required') {
    return { key: 'required', label: EQUIPMENT_WISH_PRIORITY_LABEL[EQUIPMENT_WISH_PRIORITY.REQUIRED] };
  }
  if (raw === EQUIPMENT_WISH_PRIORITY.IMPORTANT || raw === 'important') {
    return { key: 'important', label: EQUIPMENT_WISH_PRIORITY_LABEL[EQUIPMENT_WISH_PRIORITY.IMPORTANT] };
  }
  if (raw === EQUIPMENT_WISH_PRIORITY.PREFERRED || raw === 'preferred') {
    return { key: 'preferred', label: EQUIPMENT_WISH_PRIORITY_LABEL[EQUIPMENT_WISH_PRIORITY.PREFERRED] };
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

function chipTitle(chip) {
  return buildKnowledgeChipProvenanceTitle(chip);
}

function chipSourceClass(chip) {
  const style = normalizeKnowledgeChipSource(chip?.source);
  if (style === 'customer') return 'cust-kundenbild__chip--source-customer';
  if (style === 'clever') return 'cust-kundenbild__chip--source-clever';
  if (style === 'seller' || style === 'document') {
    return 'cust-kundenbild__chip--source-seller';
  }
  return 'cust-kundenbild__chip--source-seller';
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

  takeFacts(urgencyFirst(byId.get(SOFT_SNAPSHOT_GROUP.PERSOENLICHES)?.facts));
  // Fahrzeugwunsch nur bei echten Zusatzinfos (Farbe/Antrieb/…), nie Header-Modell-Duplikat
  takeFacts(
    (byId.get(SOFT_SNAPSHOT_GROUP.FAHRZEUGPRAEFERENZ)?.facts || [])
      .filter((f) => !f.empty && String(f.label || '').trim()),
  );

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

  if (picked.length < max) {
    takeFacts(byId.get(SOFT_SNAPSHOT_GROUP.SONSTIGES)?.facts);
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
  const isSalesCritical = Boolean(priority && priority.key !== 'preferred')
    || /sofort|unfall|ersatz|dringend|eilig/i.test(String(chip.label || ''));
  const title = chipTitle(chip);
  const sourceStyle = normalizeKnowledgeChipSource(chip.source) || undefined;
  return (
    <button
      type="button"
      className={[
        'cust-kundenbild__chip',
        compact ? 'cust-kundenbild__chip--compact' : '',
        `cust-kundenbild__chip--${category}`,
        chipSourceClass(chip),
        isSalesCritical ? 'is-sales-critical' : 'is-soft-fact',
        isEmpty ? 'is-empty' : '',
        chip.relevant || chip.highlighted ? 'is-relevant' : '',
        chip.highlighted ? 'is-highlight' : '',
      ].filter(Boolean).join(' ')}
      data-category={category}
      data-priority={priority?.key || undefined}
      data-empty={isEmpty ? 'true' : undefined}
      data-source={sourceStyle || chip.source || undefined}
      title={title}
      onClick={() => onFactTap?.(chip)}
      aria-label={isEmpty ? `${displayLabel} ergänzen` : `${displayLabel} bearbeiten`}
    >
      {sourceStyle === 'clever' ? (
        <span className="cust-kundenbild__chip-sparkle" aria-hidden>✦</span>
      ) : sourceStyle === 'customer' ? (
        <IconUser className="cust-kundenbild__chip-source-icon" aria-hidden />
      ) : (!compact ? <ChipIcon icon={chip.icon || category} /> : null)}
      <span className="cust-kundenbild__chip-label">{displayLabel}</span>
    </button>
  );
}

/**
 * Soft-Gruppe wie Mockup: Kategorie-Icon, Titel, Zähler, +, Tags.
 * Leere Gruppen werden nicht gerendert (Taxonomie-Freeze).
 * Max. 3–4 Chips, Rest als +N.
 */
function SoftKnowledgeGroup({
  group,
  onFactTap = null,
  onAddToGroup = null,
}) {
  const panelId = useId();
  const [showAll, setShowAll] = useState(false);
  const facts = urgencyFirst(group?.facts ?? []);
  if (!facts.length) return null;
  const count = facts.length;
  const canAdd = typeof onAddToGroup === 'function' && (group?.showAddCta !== false);
  const visible = showAll ? facts : facts.slice(0, GROUP_CHIP_VISIBLE_MAX);
  const overflow = Math.max(0, count - visible.length);

  return (
    <div className="cust-kundenbild__group is-open">
      <div className="cust-kundenbild__group-head">
        <div className="cust-kundenbild__group-identity">
          <span className="cust-kundenbild__group-icon-wrap" aria-hidden>
            <GroupCategoryIcon groupId={group.id} />
          </span>
          <span className="cust-kundenbild__group-title">{group.title}</span>
          {count > 0 ? (
            <span className="cust-kundenbild__group-count">{count}</span>
          ) : null}
        </div>
        {canAdd ? (
          <button
            type="button"
            className="cust-kundenbild__group-add"
            onClick={() => onAddToGroup(group)}
            aria-label={`${group.title} ergänzen`}
            title="Vordefinierte Chips"
          >
            +
          </button>
        ) : null}
      </div>
      <div
        id={panelId}
        className="cust-kundenbild__group-body"
        role="region"
        aria-label={group.title}
      >
        <ul className="cust-kundenbild__chips">
          {visible.map((chip) => (
            <li key={chip.id || chip.label}>
              <SnapshotChip chip={chip} onFactTap={onFactTap} />
            </li>
          ))}
          {overflow > 0 ? (
            <li>
              <button
                type="button"
                className="cust-kundenbild__chip cust-kundenbild__chip--overflow"
                onClick={() => setShowAll(true)}
                aria-label={`${overflow} weitere anzeigen`}
                title={`${overflow} weitere anzeigen`}
              >
                <span className="cust-kundenbild__chip-label">+{overflow}</span>
              </button>
            </li>
          ) : null}
        </ul>
      </div>
    </div>
  );
}

/**
 * Zone 1 – Konditionen (Tap → Mini-Editor).
 * Bei lean Header: keine lauten Chip-Duplikate, nur ruhiger Edit-Zugang.
 */
export function CustomerAkteKernkonditionen({
  kern = null,
  onFactTap = null,
  onEditConditions = null,
  /** Header zeigt bereits Fahrzeug + Konditionen → keine Chip-Duplikate */
  leanHeaderActive = false,
}) {
  if (!kern) return null;
  const chips = (kern.chips ?? []).slice(0, KERN_CHIP_MAX);
  if (!kern.hasData && !kern.line && chips.length === 0) return null;

  const editControl = typeof onEditConditions === 'function' ? (
    <EditLink onClick={onEditConditions} ariaLabel="Konditionen bearbeiten" />
  ) : null;

  if (leanHeaderActive) {
    if (!editControl) return null;
    return (
      <div
        className="cust-kundenbild__kern cust-kundenbild__kern--lean"
        aria-label={kern.title || 'Konditionen'}
      >
        <div className="cust-kundenbild__kern-row cust-kundenbild__kern-row--lean">
          <span className="cust-kundenbild__kern-lean-hint">Konditionen</span>
          {editControl}
        </div>
      </div>
    );
  }

  return (
    <div
      className="cust-kundenbild__kern"
      aria-label={kern.title || 'Konditionen'}
    >
      {chips.length > 0 ? (
        <div className="cust-kundenbild__kern-row">
          <ul className="cust-kundenbild__kern-chips">
            {chips.map((chip) => (
              <li key={chip.id}>
                <SnapshotChip chip={chip} onFactTap={onFactTap} />
              </li>
            ))}
          </ul>
          {editControl}
        </div>
      ) : (
        <div className="cust-kundenbild__kern-row">
          {kern.line ? (
            <p className="cust-kundenbild__kern-line">{kern.line}</p>
          ) : null}
          {editControl}
        </div>
      )}
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
  /** @deprecated Kundenwissen-Stift entfernt – Buckets + Composer */
  onMerken: _onMerken = null,
  panelId = null,
  /** 'full' | 'bar' | 'panel' */
  variant = 'full',
}) {
  const hasSoft = Boolean(soft?.hasData || soft?.groups?.length || soft?.chips?.length);
  if (!hasSoft) return null;

  const sectionTitle = soft?.title || 'Kundenwissen';
  const { chips: summaryChips, overflow: summaryOverflow } = buildCollapsedSummaryChips(soft);
  // Nur Buckets mit Facts; Fahrzeugwunsch nur bei echter Zusatzinformation
  const groups = (soft?.groups ?? []).filter((g) => {
    const facts = (g?.facts ?? []).filter((f) => !f.empty && String(f.label || '').trim());
    if (!facts.length) return false;
    if (g.id === SOFT_SNAPSHOT_GROUP.FAHRZEUGPRAEFERENZ) return facts.length > 0;
    return true;
  });
  const showBar = variant === 'full' || variant === 'bar';
  const showPanel = variant === 'full' || variant === 'panel';
  const showCollapsedSummary = !expanded && showBar;
  const expandLabel = expanded ? 'Kundenwissen einklappen' : 'Kundenwissen ausklappen';

  function handleToggle() {
    onToggle?.(!expanded);
  }

  return (
    <div
      className={`cust-kundenbild__soft${expanded ? ' is-expanded' : ' is-collapsed'}`}
      aria-label={sectionTitle}
    >
      {showBar ? (
        <div className="cust-kundenbild__compact">
          <div className="cust-kundenbild__soft-row">
            {showCollapsedSummary && summaryChips.length > 0 ? (
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
                      title={`${summaryOverflow} weitere Infos anzeigen`}
                    >
                      <span className="cust-kundenbild__chip-label">+{summaryOverflow}</span>
                    </button>
                  </li>
                ) : null}
              </ul>
            ) : (
              <span className="cust-kundenbild__soft-row-spacer" aria-hidden />
            )}
            <div className="cust-kundenbild__head-actions">
              <button
                type="button"
                className="cust-kundenbild__chevron-btn"
                onClick={handleToggle}
                aria-expanded={expanded}
                aria-controls={panelId || undefined}
                aria-label={expandLabel}
                title={expandLabel}
              >
                <span className={`cust-kundenbild__chevron${expanded ? ' is-open' : ''}`} aria-hidden>
                  <IconChevronDown />
                </span>
              </button>
            </div>
          </div>
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
              ) : null}
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
  onEditConditions = null,
  /** @deprecated use onAddToGroup */
  onAusstattungErgaenzen = null,
  /** 'full' | 'bar' | 'panel' */
  variant = 'full',
  /** Header trägt bereits Lean-Konditionen → keine lauten Kern-Chips */
  leanHeaderActive = false,
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
      className={[
        'cust-kundenbild',
        expanded ? 'is-expanded' : 'is-collapsed',
        variant !== 'full' ? `cust-kundenbild--${variant}` : '',
        leanHeaderActive ? 'cust-kundenbild--hierarchy' : '',
      ].filter(Boolean).join(' ')}
      aria-label="Kundenbild"
    >
      {showKern ? (
        <CustomerAkteKernkonditionen
          kern={kern}
          onFactTap={onFactTap}
          onEditConditions={onEditConditions}
          leanHeaderActive={leanHeaderActive}
        />
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
