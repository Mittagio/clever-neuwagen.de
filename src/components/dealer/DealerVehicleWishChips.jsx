import { useMemo, useState } from 'react';
import {
  getDealerWishGroupsForModel,
  getPopularWishesForModel,
} from '../../services/dealer/dealerWishCatalogService.js';
import './dealer-landing.css';

function WishChipButton({ chip, active, hint, onToggle }) {
  return (
    <span className="dl-wish-chips__chip-wrap">
      <button
        type="button"
        className={`dl-wish-chips__chip${active ? ' dl-wish-chips__chip--active' : ''}${hint?.severity === 'warning' ? ' dl-wish-chips__chip--warn' : ''}`}
        aria-pressed={active}
        onClick={() => onToggle?.(chip.id)}
      >
        {active && <span className="dl-wish-chips__check" aria-hidden>☑ </span>}
        {chip.label}
      </button>
      {active && hint?.message && (
        <span className={`dl-wish-chips__hint dl-wish-chips__hint--${hint.severity}`}>
          {hint.message}
        </span>
      )}
    </span>
  );
}

/**
 * Einklappbare Kategorien + häufig gewählte Wünsche + Such-Priorisierung.
 */
export default function DealerVehicleWishChips({
  modelKey,
  selectedChipIds = [],
  searchProfile = null,
  searchFilters = null,
  searchChipIds = [],
  chipHints = {},
  onToggle,
}) {
  const [expandedGroups, setExpandedGroups] = useState(() => new Set());

  const catalogOptions = useMemo(() => ({
    searchProfile,
    searchFilters,
    searchChipIds,
  }), [searchProfile, searchFilters, searchChipIds]);

  const groups = useMemo(
    () => getDealerWishGroupsForModel(modelKey, catalogOptions),
    [modelKey, catalogOptions],
  );

  const popular = useMemo(
    () => getPopularWishesForModel(modelKey, catalogOptions),
    [modelKey, catalogOptions],
  );

  if (!groups.length) return null;

  function toggleGroup(groupId) {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(groupId)) next.delete(groupId);
      else next.add(groupId);
      return next;
    });
  }

  const selectedInGroup = (group) => (
    group.chips.filter((c) => selectedChipIds.includes(c.id)).length
  );

  return (
    <div className="dl-wish-chips">
      {popular && (
        <section className="dl-wish-chips__popular" aria-label={popular.title}>
          <h4 className="dl-wish-chips__popular-title">
            <span aria-hidden>🔥</span>
            {' '}
            {popular.title}
          </h4>
          <div className="dl-wish-chips__row">
            {popular.chips.map((chip) => (
              <WishChipButton
                key={chip.id}
                chip={chip}
                active={selectedChipIds.includes(chip.id)}
                hint={chipHints[chip.id]}
                onToggle={onToggle}
              />
            ))}
          </div>
        </section>
      )}

      <div className="dl-wish-chips__accordion">
        {groups.map((group) => {
          const expanded = expandedGroups.has(group.id);
          const selectedCount = selectedInGroup(group);
          return (
            <div
              key={group.id}
              className={`dl-wish-chips__category${expanded ? ' dl-wish-chips__category--open' : ''}`}
            >
              <button
                type="button"
                className="dl-wish-chips__category-head"
                aria-expanded={expanded}
                onClick={() => toggleGroup(group.id)}
              >
                <span className="dl-wish-chips__category-label">
                  {group.label}
                  {' '}
                  <span aria-hidden>{group.emoji}</span>
                </span>
                <span className="dl-wish-chips__category-meta">
                  {selectedCount > 0 && (
                    <span className="dl-wish-chips__category-selected">
                      {selectedCount}
                      {' '}
                      gewählt
                    </span>
                  )}
                  <span className="dl-wish-chips__category-count">
                    (
                    {group.chips.length}
                    )
                  </span>
                  <span className="dl-wish-chips__category-chevron" aria-hidden>
                    {expanded ? '▾' : '▸'}
                  </span>
                </span>
              </button>

              {expanded && (
                <div className="dl-wish-chips__row dl-wish-chips__row--nested">
                  {group.chips.map((chip) => (
                    <WishChipButton
                      key={chip.id}
                      chip={chip}
                      active={selectedChipIds.includes(chip.id)}
                      hint={chipHints[chip.id]}
                      onToggle={onToggle}
                    />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
