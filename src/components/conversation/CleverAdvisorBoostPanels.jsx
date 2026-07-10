import { useState } from 'react';

function ChipButton({ chip, selected, onToggle, className }) {
  return (
    <button
      key={chip.id}
      type="button"
      className={`${className}${selected ? ` ${className}--selected` : ''}`}
      aria-pressed={selected}
      onClick={() => onToggle(chip.id)}
    >
      {chip.label}
    </button>
  );
}

export default function CleverAdvisorBoostPanels({
  boostView,
  selectedIds,
  onToggleChip,
  chipClassName = 'cc-advisor-boost__chip',
  groupClassName = 'cc-advisor-boost__group',
}) {
  const [showAll, setShowAll] = useState(false);
  const { highlights = [], categories = [], copy } = boostView;

  return (
    <>
      {highlights.map((group) => (
        <div key={group.id} className={groupClassName}>
          <p className={`${groupClassName}-label`}>
            <span aria-hidden>{group.icon}</span>
            {group.label}
          </p>
          <div className={`${groupClassName}-chips`} role="group" aria-label={group.label}>
            {group.chips.map((chip) => (
              <ChipButton
                key={chip.id}
                chip={chip}
                selected={selectedIds.has(chip.id)}
                onToggle={onToggleChip}
                className={chipClassName}
              />
            ))}
          </div>
        </div>
      ))}

      {categories.length > 0 && (
        <button
          type="button"
          className="cc-advisor-boost__more"
          onClick={() => setShowAll((prev) => !prev)}
          aria-expanded={showAll}
        >
          {showAll ? copy.showLessLabel : copy.showMoreLabel}
        </button>
      )}

      {showAll && categories.map((category) => (
        <div key={category.id} className={groupClassName}>
          <p className={`${groupClassName}-label`}>{category.label}</p>
          <div className={`${groupClassName}-chips`} role="group" aria-label={category.label}>
            {category.chips.map((chip) => (
              <ChipButton
                key={chip.id}
                chip={chip}
                selected={selectedIds.has(chip.id)}
                onToggle={onToggleChip}
                className={chipClassName}
              />
            ))}
          </div>
        </div>
      ))}
    </>
  );
}
