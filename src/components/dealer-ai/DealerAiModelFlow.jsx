import { useMemo, useState } from 'react';
import { getSalesChipById } from '../../data/salesAdvisorChips.js';
import {
  filterAssistantModels,
  getAssistantModelImage,
  getModelFlowChipGroups,
} from '../../data/dealerAiStartFlows.js';
import './DealerAiStart.css';

function labelForGroup(group, chipIds) {
  const groupIds = group.chips.filter((c) => !c.skip).map((c) => c.id);
  const selected = chipIds.find((id) => groupIds.includes(id));
  if (!selected) return group.emptyLabel ?? 'Keine Angabe';
  const fromGroup = group.chips.find((c) => c.id === selected);
  return fromGroup?.label ?? getSalesChipById(selected)?.label ?? group.emptyLabel ?? 'Keine Angabe';
}

export default function DealerAiModelFlow({ onBack, onEvaluate, isAnalyzing = false }) {
  const [search, setSearch] = useState('');
  const [selectedModel, setSelectedModel] = useState(null);
  const [chipIds, setChipIds] = useState([]);
  const [openGroup, setOpenGroup] = useState(null);

  const models = useMemo(() => filterAssistantModels(search), [search]);
  const chipGroups = useMemo(() => getModelFlowChipGroups(chipIds), [chipIds]);

  function toggleChip(chip, group) {
    const groupChipIds = group.chips.filter((c) => !c.skip).map((c) => c.id);
    if (chip.skip) {
      setChipIds((prev) => prev.filter((id) => !groupChipIds.includes(id)));
      setOpenGroup(null);
      return;
    }
    setChipIds((prev) => {
      let withoutGroup = prev.filter((id) => !groupChipIds.includes(id));
      if (group.id === 'paymentType') {
        withoutGroup = withoutGroup.filter((id) => !id.startsWith('budget_') && !id.startsWith('price_'));
      }
      if (prev.includes(chip.id)) return withoutGroup;
      return [...withoutGroup, chip.id];
    });
    setOpenGroup(null);
  }

  function handleEvaluate() {
    if (!selectedModel) return;
    onEvaluate?.({ model: selectedModel, chipIds });
  }

  return (
    <section className="dai-model-flow" aria-label="Modell wählen">
      <header className="dai-model-hero">
        <button type="button" className="dai-flow__back" onClick={onBack}>
          ‹ Zurück
        </button>
        <h1 className="dai-model-hero__title">Modell wählen</h1>
        <p className="dai-model-hero__sub">Kunde weiß schon, was er möchte.</p>
      </header>

      <div className="dai-model-search-row">
        <label className="dai-model-search-wrap">
          <span className="dai-model-search__icon" aria-hidden>🔍</span>
          <input
            type="search"
            className="dai-model-search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Modell suchen …"
          />
        </label>
      </div>

      <div className="dai-model-grid">
        {models.map((model) => {
          const active = selectedModel?.id === model.id;
          const imageUrl = getAssistantModelImage(model.id);
          return (
            <button
              key={model.id}
              type="button"
              className={`dai-model-tile${active ? ' is-active' : ''}`}
              onClick={() => setSelectedModel(model)}
              aria-pressed={active}
            >
              {active && <span className="dai-model-tile__check" aria-hidden>✓</span>}
              {imageUrl ? (
                <img src={imageUrl} alt="" className="dai-model-tile__img" loading="lazy" />
              ) : (
                <span className="dai-model-tile__placeholder" aria-hidden>🚗</span>
              )}
              <span className="dai-model-tile__name">{model.name}</span>
              <span className="dai-model-tile__tagline">{model.tagline}</span>
              {model.badge && (
                <span className={`dai-model-tile__badge dai-model-tile__badge--${model.badge.toLowerCase()}`}>
                  {model.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {selectedModel && (
        <section className="dai-model-options" aria-label="Zusatzangaben">
          <h2 className="dai-model-options__title">Ihre Auswahl (optional)</h2>
          {chipGroups.map((group) => (
            <div key={group.id} className="dai-model-option">
              <button
                type="button"
                className="dai-model-option__row"
                onClick={() => setOpenGroup(openGroup === group.id ? null : group.id)}
                aria-expanded={openGroup === group.id}
              >
                <span className="dai-model-option__icon" aria-hidden>{group.icon}</span>
                <span className="dai-model-option__label">{group.label}</span>
                <span className="dai-model-option__value">{labelForGroup(group, chipIds)}</span>
                <span className="dai-model-option__chev" aria-hidden>›</span>
              </button>
              {openGroup === group.id && (
                <div className="dai-chip-grid dai-chip-grid--compact">
                  {group.chips.map((chip) => {
                    const groupIds = group.chips.filter((c) => !c.skip).map((c) => c.id);
                    const active = chip.skip
                      ? !groupIds.some((id) => chipIds.includes(id))
                      : chipIds.includes(chip.id);
                    return (
                      <button
                        key={chip.id}
                        type="button"
                        className={`dai-chip${active ? ' is-active' : ''}`}
                        onClick={() => toggleChip(chip, group)}
                        aria-pressed={active}
                      >
                        <span className="dai-chip__emoji" aria-hidden>{chip.emoji}</span>
                        <span className="dai-chip__label">{chip.label}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
          <p className="dai-model-options__note">
            <span aria-hidden>✦</span>
            Diese Angaben helfen uns, das beste Angebot für Ihren Kunden zu erstellen.
          </p>
        </section>
      )}

      <button
        type="button"
        className="dai-cta dai-cta--primary dai-cta--block"
        onClick={handleEvaluate}
        disabled={!selectedModel || isAnalyzing}
      >
        <span className="dai-cta__spark" aria-hidden>✦</span>
        {isAnalyzing ? 'Wird ausgewertet …' : 'Kundenwunsch auswerten'}
      </button>
    </section>
  );
}
