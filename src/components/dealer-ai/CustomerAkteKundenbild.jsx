import { useId } from 'react';
import {
  IconCalendar,
  IconCar,
  IconClock,
  IconEuro,
  IconGauge,
  IconPencil,
} from './AkteIcons.jsx';
import {
  EQUIPMENT_WISH_PRIORITY,
  EQUIPMENT_WISH_PRIORITY_LABEL,
  SNAPSHOT_SUMMARY_MAX_TOKENS,
  buildKnowledgeChipProvenanceTitle,
  buildSnapshotSummary,
  buildSoftPanelTopics,
  flattenSnapshotChips,
  normalizeKnowledgeChipSource,
  SOFT_SNAPSHOT_GROUP,
  stripEquipmentPrioritySuffix,
} from '../../services/dealer/buildCustomerSnapshotModel.js';
import { safeSnapshotFactLabel } from '../../services/cleverSeller/normalizeFactDisplayLabel.js';
import './CustomerAkteKundenbild.css';

/**
 * Kundenwissen = Hybrid: Summary-Chips light (collapsed) + Themenpanel (expanded).
 * Default: 3–5 Soft-Facts als dezente Pills + Overflow/+N + „Alles anzeigen“.
 * Panel: Themenzeilen (kein Bucket-Chrome); Erfassung primär Composer (Merken).
 * Provenance: Desktop title/hover; Mobile nur im Expanded-Detail (kein Long-Press).
 * Kontakt-Missing gehört in den Header, nicht hier.
 */

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

function chipTitle(chip) {
  return buildKnowledgeChipProvenanceTitle(chip);
}

function formatProvenanceInline(title) {
  if (!title) return '';
  return String(title).replace(/\n/g, ' · ');
}

/**
 * Collapsed Summary-Tokens: bevorzugt soft.summary.tokens;
 * Fallback aus soft.chips / groups wenn Soft-Facts existieren aber Tokens leer.
 */
function resolveCollapsedSummaryTokens(soft, maxTokens = SNAPSHOT_SUMMARY_MAX_TOKENS) {
  const fromSummary = Array.isArray(soft?.summary?.tokens)
    ? soft.summary.tokens.filter((t) => !t.empty && safeSnapshotFactLabel(t.label))
    : [];
  const summaryOverflow = Number(soft?.summary?.overflow) > 0
    ? Number(soft.summary.overflow)
    : 0;
  if (fromSummary.length > 0) {
    return { tokens: fromSummary, overflow: summaryOverflow };
  }
  const chipSource = Array.isArray(soft?.chips) && soft.chips.length
    ? soft.chips
    : (soft?.groups ?? []);
  const built = buildSnapshotSummary(chipSource, maxTokens);
  return {
    tokens: (built.tokens || []).filter((t) => !t.empty && safeSnapshotFactLabel(t.label)),
    overflow: Number(built.overflow) > 0 ? Number(built.overflow) : 0,
  };
}

/**
 * Expanded-Detail: Fact tippbar; Desktop title/hover; Mobile Provenance inline.
 * Kein Long-Press.
 */
function ProvenanceFact({
  fact,
  className = '',
  onFactTap = null,
  as = 'span',
  /** Im Expanded-Panel: Herkunft auch ohne Hover sichtbar (Mobile). */
  showProvenanceMeta = false,
}) {
  const title = chipTitle(fact);
  const displayLabel = stripEquipmentPrioritySuffix(fact?.label || '')
    || safeSnapshotFactLabel(fact?.label);
  if (!displayLabel) return null;
  const Tag = as === 'button' ? 'button' : 'span';
  const inlineTitle = formatProvenanceInline(title);

  const props = {
    className: [
      'cust-kundenbild__fact',
      showProvenanceMeta ? 'cust-kundenbild__fact--with-meta' : '',
      className,
    ].filter(Boolean).join(' '),
    title: title || undefined,
    'data-source': normalizeKnowledgeChipSource(fact?.source) || fact?.source || undefined,
    'data-confirmed': fact?.confirmed === false ? 'false' : 'true',
    onClick: () => onFactTap?.(fact),
  };

  if (Tag === 'button') {
    props.type = 'button';
    props['aria-label'] = displayLabel
      ? `${displayLabel}${inlineTitle ? ` – ${inlineTitle}` : ''}`
      : undefined;
  }

  return (
    <Tag {...props}>
      <span className="cust-kundenbild__fact-label">{displayLabel}</span>
      {as === 'button' ? (
        <span className="cust-kundenbild__fact-edit" aria-hidden>✎</span>
      ) : null}
      {showProvenanceMeta && inlineTitle ? (
        <span className="cust-kundenbild__fact-meta" aria-hidden>
          {inlineTitle}
        </span>
      ) : null}
    </Tag>
  );
}

/**
 * Collapsed: dezente Summary-Pills (nicht schwere CRM-Chips).
 * Click → expand; Desktop: Provenance nur via native title.
 */
function SummaryChipLight({
  fact,
  onActivate = null,
  overflow = false,
}) {
  const displayLabel = overflow
    ? `+${fact?.overflow ?? safeSnapshotFactLabel(fact?.label) ?? ''}`
    : (stripEquipmentPrioritySuffix(fact?.label || '') || safeSnapshotFactLabel(fact?.label));
  if (!overflow && !displayLabel) return null;
  const title = overflow
    ? `${fact?.overflow || ''} weitere Infos anzeigen`
    : chipTitle(fact);

  return (
    <button
      type="button"
      className={[
        'cust-kundenbild__summary-chip',
        overflow ? 'cust-kundenbild__summary-chip--overflow' : '',
      ].filter(Boolean).join(' ')}
      title={title || undefined}
      data-source={overflow
        ? undefined
        : (normalizeKnowledgeChipSource(fact?.source) || fact?.source || undefined)}
      data-confirmed={overflow
        ? undefined
        : (fact?.confirmed === false ? 'false' : 'true')}
      onClick={(event) => {
        event.stopPropagation();
        onActivate?.(fact, { overflow: Boolean(overflow) });
      }}
      aria-label={overflow
        ? `${fact?.overflow || ''} weitere Infos anzeigen`
        : (displayLabel ? `${displayLabel} – Kundenwissen öffnen` : 'Kundenwissen öffnen')}
    >
      <span className="cust-kundenbild__summary-chip-label">{displayLabel}</span>
    </button>
  );
}

/**
 * Konditionen-Chips (nicht Soft) – bleiben tappable Mini-Editor-Einstieg.
 */
function SnapshotChip({ chip, onFactTap, compact = false }) {
  const category = chip.category || chip.tint || 'alltag';
  const priority = chipPriorityMeta(chip);
  const displayLabel = stripEquipmentPrioritySuffix(chip.label || '') || chip.label;
  const isEmpty = Boolean(chip.empty);
  const isSalesCritical = Boolean(priority && priority.key !== 'preferred')
    || /sofort|unfall|ersatz|dringend|eilig/i.test(String(chip.label || ''));
  const title = chipTitle(chip);
  return (
    <button
      type="button"
      className={[
        'cust-kundenbild__chip',
        compact ? 'cust-kundenbild__chip--compact' : '',
        `cust-kundenbild__chip--${category}`,
        isSalesCritical ? 'is-sales-critical' : 'is-soft-fact',
        isEmpty ? 'is-empty' : '',
        chip.relevant || chip.highlighted ? 'is-relevant' : '',
        chip.highlighted ? 'is-highlight' : '',
      ].filter(Boolean).join(' ')}
      data-category={category}
      data-priority={priority?.key || undefined}
      data-empty={isEmpty ? 'true' : undefined}
      title={title}
      onClick={() => onFactTap?.(chip)}
      aria-label={isEmpty ? `${displayLabel} ergänzen` : `${displayLabel} bearbeiten`}
    >
      {!compact ? <ChipIcon icon={chip.icon || category} /> : null}
      <span className="cust-kundenbild__chip-label">{displayLabel}</span>
    </button>
  );
}

/**
 * Zone 1 – Konditionen (Tap → Mini-Editor).
 * Deal-Konditionen (Leasing, Laufzeit, km, AZ) gehören hierher – nicht in den Header.
 */
export function CustomerAkteKernkonditionen({
  kern = null,
  onFactTap = null,
  onEditConditions = null,
}) {
  if (!kern) return null;
  const chips = (kern.chips ?? []).slice(0, KERN_CHIP_MAX);
  if (!kern.hasData && !kern.line && chips.length === 0) return null;

  const editControl = typeof onEditConditions === 'function' ? (
    <EditLink onClick={onEditConditions} ariaLabel="Konditionen bearbeiten" />
  ) : null;

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

/** Leerzustand im geöffneten Panel – kein Chip-Picker. */
function SoftKnowledgeEmptyState({ onMerken = null }) {
  return (
    <div className="cust-kundenbild__soft-empty" data-kundenwissen-empty="true">
      <p className="cust-kundenbild__panel-empty">
        Noch nichts gemerkt – im Composer erzählen oder unten ergänzen.
      </p>
      {typeof onMerken === 'function' ? (
        <button
          type="button"
          className="cust-kundenbild__wissen-add"
          onClick={onMerken}
        >
          + Wissen ergänzen
        </button>
      ) : null}
    </div>
  );
}

/**
 * Ruhige Themenzeile: Label + klickbare Fact-Chips (kein Bucket-Chrome).
 */
function SoftTopicLine({ topic, onFactTap = null }) {
  const facts = topic?.facts ?? [];
  if (!facts.length) return null;
  return (
    <div className="cust-kundenbild__topic" data-topic={topic.id}>
      <span className="cust-kundenbild__topic-label">{topic.title}</span>
      <ul className="cust-kundenbild__topic-list" aria-label={topic.title}>
        {facts.map((fact) => (
          <li key={fact.id || fact.label} className="cust-kundenbild__topic-item">
            <ProvenanceFact
              fact={fact}
              onFactTap={onFactTap}
              as="button"
              className="cust-kundenbild__fact--chip"
              showProvenanceMeta={false}
            />
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Zone 2 – Kundenwissen (Summary-Chips light + ruhiges Themenpanel).
 */
export function CustomerAkteKundeninfos({
  soft = null,
  expanded = false,
  onToggle = null,
  onFactTap = null,
  /** @deprecated Chip-Picker nicht mehr Primary – Composer/Merken */
  onAddToGroup: _onAddToGroup = null,
  onMerken = null,
  panelId = null,
  /** 'full' | 'bar' | 'panel' */
  variant = 'full',
}) {
  const hasSoft = Boolean(soft?.hasData || soft?.groups?.length || soft?.chips?.length || soft?.summary);
  if (!hasSoft) return null;

  const sectionTitle = soft?.title || 'Kundenwissen';
  const { tokens: summaryTokens, overflow: summaryOverflow } = resolveCollapsedSummaryTokens(soft);
  const summaryLine = soft?.summary?.line
    || summaryTokens
      .map((t) => stripEquipmentPrioritySuffix(t.label) || t.label)
      .filter(Boolean)
      .join(' · ');
  const topics = Array.isArray(soft?.topics) && soft.topics.length
    ? soft.topics
    : buildSoftPanelTopics(soft?.groups ?? []);
  const hasSoftFacts = topics.some((t) => (t.facts?.length || 0) > 0)
    || Boolean(soft?.hasSoftFacts)
    || summaryTokens.length > 0
    || Boolean(soft?.chips?.some((c) => !c.empty && String(c.label || '').trim()));
  const showBar = variant === 'full' || variant === 'bar';
  const showPanel = variant === 'full' || variant === 'panel';
  const showCollapsedSummary = !expanded && showBar;
  const linkLabel = expanded
    ? 'Weniger'
    : (hasSoftFacts ? 'Alles anzeigen' : 'Bearbeiten');

  function handleToggle(event) {
    event?.stopPropagation?.();
    onToggle?.(!expanded);
  }

  function handleExpandFromRow(event) {
    if (expanded) return;
    // Link / Buttons in der Zeile handeln selbst (stopPropagation)
    const target = event?.target;
    if (target?.closest?.('button, a, input, textarea, select')) return;
    onToggle?.(true);
  }

  function handleSummaryChipActivate(fact, { overflow = false } = {}) {
    if (!expanded) {
      onToggle?.(true);
      return;
    }
    if (!overflow) onFactTap?.(fact);
  }

  function handleMerken() {
    if (typeof onMerken === 'function') {
      onMerken();
      return;
    }
    // Fallback: Panel offen halten
    if (!expanded) onToggle?.(true);
  }

  return (
    <div
      className={`cust-kundenbild__soft${expanded ? ' is-expanded' : ' is-collapsed'}${hasSoftFacts ? '' : ' is-empty-soft'}`}
      aria-label={sectionTitle}
    >
      {showBar ? (
        <div className="cust-kundenbild__compact">
          <div
            className={[
              'cust-kundenbild__soft-row',
              showCollapsedSummary && !expanded ? 'is-expandable' : '',
            ].filter(Boolean).join(' ')}
            onClick={handleExpandFromRow}
          >
            <span className="cust-kundenbild__title">{sectionTitle}</span>
            {showCollapsedSummary && summaryTokens.length > 0 ? (
              <ul
                className="cust-kundenbild__summary-chips"
                aria-label="Kundenwissen Zusammenfassung"
              >
                {summaryTokens.map((fact) => (
                  <li key={fact.id || fact.label}>
                    <SummaryChipLight
                      fact={fact}
                      onActivate={handleSummaryChipActivate}
                    />
                  </li>
                ))}
                {summaryOverflow > 0 ? (
                  <li>
                    <SummaryChipLight
                      fact={{ overflow: summaryOverflow, label: String(summaryOverflow) }}
                      overflow
                      onActivate={handleSummaryChipActivate}
                    />
                  </li>
                ) : null}
              </ul>
            ) : showCollapsedSummary && !hasSoftFacts ? (
              <span className="cust-kundenbild__summary-empty-inline">Noch nichts gemerkt</span>
            ) : (
              <span className="cust-kundenbild__soft-row-spacer" aria-hidden />
            )}
            <div className="cust-kundenbild__head-actions">
              <button
                type="button"
                className="cust-kundenbild__soft-link"
                onClick={handleToggle}
                aria-expanded={expanded}
                aria-controls={panelId || undefined}
              >
                {linkLabel}
              </button>
            </div>
          </div>
          {showCollapsedSummary && summaryLine && summaryTokens.length === 0 ? (
            <p className="cust-kundenbild__summary-line cust-kundenbild__summary-line--fallback">
              {summaryLine}
            </p>
          ) : null}
        </div>
      ) : null}

      {showPanel && expanded ? (
        <div
          id={panelId || undefined}
          className="cust-kundenbild__panel"
          role="region"
          aria-label={`${sectionTitle} Details`}
        >
          {topics.length > 0 ? (
            <>
              <div className="cust-kundenbild__topics">
                {topics.map((topic) => (
                  <SoftTopicLine
                    key={topic.id}
                    topic={topic}
                    onFactTap={onFactTap}
                  />
                ))}
              </div>
              {typeof onMerken === 'function' ? (
                <button
                  type="button"
                  className="cust-kundenbild__wissen-add"
                  onClick={handleMerken}
                >
                  + Wissen ergänzen
                </button>
              ) : null}
            </>
          ) : (
            <SoftKnowledgeEmptyState onMerken={typeof onMerken === 'function' ? handleMerken : null} />
          )}
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
  /** @deprecated use onMerken / onAddToGroup */
  onAusstattungErgaenzen = null,
  /** 'full' | 'bar' | 'panel' */
  variant = 'full',
  /** Header zeigt Fahrzeug-Kontext → Hierarchy-Styling (Soft ruhiger); Kern-Chips bleiben sichtbar */
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
        topics: model?.topics,
        chips: model?.chips ?? flattenSnapshotChips(model?.groups ?? []),
        hasSoftFacts: Boolean(model?.meta?.hasSoftFacts),
      }
      : null
  );
  const hasKern = Boolean(kern);
  const hasSoft = Boolean(
    soft?.hasData
    || soft?.groups?.length
    || soft?.chips?.length
    || soft?.summary
    || soft?.topics?.length,
  );
  // Arbeitskontext nur noch im Composer-Pill – kein Fließtext-Doppel unter Kundenwissen
  if (!hasKern && !hasSoft) return null;

  const showKern = hasKern && (variant === 'full' || variant === 'bar');
  const showSoft = hasSoft && (variant === 'full' || variant === 'bar' || variant === 'panel');

  function handleMerken() {
    if (typeof onMerken === 'function') {
      onMerken();
      return;
    }
    // Legacy: Ausstattung-Picker nur als letzter Fallback
    if (typeof onAusstattungErgaenzen === 'function') {
      onAusstattungErgaenzen();
      return;
    }
    if (typeof onAddToGroup === 'function') {
      onAddToGroup({
        id: SOFT_SNAPSHOT_GROUP.PERSOENLICHES,
        title: 'Persönliches',
        addCategory: 'familie',
      });
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
        />
      ) : null}

      {showSoft ? (
        <CustomerAkteKundeninfos
          soft={soft}
          expanded={expanded}
          onToggle={onToggle}
          onFactTap={onFactTap}
          onAddToGroup={onAddToGroup}
          onMerken={handleMerken}
          panelId={panelId}
          variant={variant}
        />
      ) : null}
    </section>
  );
}
