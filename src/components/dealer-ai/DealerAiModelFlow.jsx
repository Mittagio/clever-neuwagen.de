import { useMemo, useState } from 'react';
import {
  filterAssistantModels,
  getAssistantModelImage,
} from '../../data/dealerAiStartFlows.js';
import { parseDealerAiInput } from '../../services/dealerAiParser.js';
import './DealerAiStart.css';

export default function DealerAiModelFlow({ onBack, onConfigureModel, onError, isAnalyzing = false }) {
  const [search, setSearch] = useState('');
  const [selectedModel, setSelectedModel] = useState(null);

  const models = useMemo(() => filterAssistantModels(search), [search]);

  function handleContinue() {
    if (!selectedModel) return;
    const parsed = parseDealerAiInput(`Kia ${selectedModel.name}`);
    if (!parsed.ok) {
      onError?.(parsed.error ?? 'Modell konnte nicht geladen werden.');
      return;
    }
    onConfigureModel?.({ model: selectedModel, parsed });
  }

  const ctaLabel = selectedModel
    ? `${selectedModel.name} konfigurieren`
    : 'Modell auswählen';

  return (
    <section className="dai-model-flow" aria-label="Modell wählen">
      <header className="dai-model-hero">
        <button type="button" className="dai-flow__back" onClick={onBack}>
          ‹ Zurück
        </button>
        <h1 className="dai-model-hero__title">Modell wählen</h1>
        <p className="dai-model-hero__sub">Welches Fahrzeug soll konfiguriert werden?</p>
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
        <p className="dai-model-selected" role="status">
          <span className="dai-model-selected__label">{selectedModel.name} ausgewählt</span>
        </p>
      )}

      <button
        type="button"
        className="dai-cta dai-cta--primary dai-cta--block"
        onClick={handleContinue}
        disabled={!selectedModel || isAnalyzing}
      >
        {isAnalyzing ? 'Wird geladen …' : ctaLabel}
      </button>
    </section>
  );
}
