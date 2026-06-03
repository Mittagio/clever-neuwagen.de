import { useEffect, useMemo, useState } from 'react';
import {
  resolveChipType,
  getChipEditorConfig,
  buildChipFilterPatch,
  CHIP_TYPES,
} from '../../services/search/chipConfig.js';
import { buildFeaturesFilterPatch } from '../../services/search/featureFilterSync.js';
import { matchFeaturesFromText } from '../../services/wish/wishParser.js';
import { getFeatureLabel } from '../../data/features/featureCatalog.js';
import { parseManualLocationInput } from '../../logic/advisorLocation.js';
import './smartChipEditor.css';

function useIsMobileSheet() {
  const [mobile, setMobile] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)');
    const update = () => setMobile(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);
  return mobile;
}

/**
 * Chip-Editor – Bottom Sheet (Mobile) / kompaktes Modal (Desktop).
 */
export default function SearchChipEditor({
  chip,
  filters,
  localized = false,
  onClose,
  onApply,
  onAllowLocation,
  onOpenSearch,
}) {
  const [customValue, setCustomValue] = useState('');
  const [showPlzInput, setShowPlzInput] = useState(false);
  const [showModelPicker, setShowModelPicker] = useState(false);
  const [pendingOption, setPendingOption] = useState(null);
  const [draftFeatures, setDraftFeatures] = useState(() => filters.features ?? []);
  const isMobile = useIsMobileSheet();

  const type = chip ? resolveChipType(chip) : null;
  const config = chip ? getChipEditorConfig(chip, filters) : null;

  useEffect(() => {
    if (!chip || !config) return;
    setDraftFeatures(filters.features ?? []);
    const current = config.options?.find((o) => o.isActive)?.value;
    setPendingOption(current ?? null);
    setCustomValue('');
    setShowPlzInput(false);
    setShowModelPicker(false);
  }, [chip, filters, config]);

  const draftActiveFeatures = useMemo(
    () => draftFeatures
      .filter((id) => getFeatureLabel(id))
      .map((id) => ({ id, label: getFeatureLabel(id) })),
    [draftFeatures],
  );

  const isFeatureEditor = Boolean(config?.showFeatureEditor);
  const useDeferredApply = isMobile && !isFeatureEditor;

  function applyPatch(patch) {
    if (patch && Object.keys(patch).length > 0) {
      onApply?.(patch);
    }
    onClose?.();
  }

  function selectOption(value) {
    if (type === CHIP_TYPES.MODEL_REFINE && value === 'custom_model') {
      setShowModelPicker(true);
      return;
    }
    if (useDeferredApply) {
      setPendingOption(value);
      return;
    }
    const patch = buildChipFilterPatch(type, value, filters);
    applyPatch(patch);
  }

  function applyDeferred() {
    if (pendingOption !== undefined && pendingOption !== null) {
      const patch = buildChipFilterPatch(type, pendingOption, filters);
      applyPatch(patch);
      return;
    }
    onClose?.();
  }

  function toggleFeature(featureId) {
    setDraftFeatures((prev) => (
      prev.includes(featureId)
        ? prev.filter((f) => f !== featureId)
        : [...prev, featureId]
    ));
  }

  function applyFeatures() {
    let next = [...draftFeatures];
    const text = customValue.trim();
    if (text) {
      const fromText = matchFeaturesFromText(text);
      if (fromText.length) {
        next = [...new Set([...next, ...fromText])];
        applyPatch(buildFeaturesFilterPatch(filters, next));
        return;
      }
      applyPatch({
        ...buildFeaturesFilterPatch(filters, next),
        query: `${filters.query ?? ''} ${text}`.trim(),
      });
      return;
    }
    applyPatch(buildFeaturesFilterPatch(filters, next));
  }

  function submitCustom(e) {
    e.preventDefault();
    const val = customValue.trim();
    if (!val) return;

    if (isFeatureEditor) {
      const fromText = matchFeaturesFromText(val);
      const merged = [...new Set([...draftFeatures, ...fromText])];
      setDraftFeatures(merged);
      setCustomValue('');
      if (!isMobile) {
        applyPatch(buildFeaturesFilterPatch(filters, merged));
      }
      return;
    }

    if (type === CHIP_TYPES.MODEL || showModelPicker) {
      applyPatch(buildChipFilterPatch(CHIP_TYPES.MODEL, val, { ...filters, model: val }));
      return;
    }
    if (type === CHIP_TYPES.BUDGET || type === CHIP_TYPES.CASH_BUDGET) {
      const num = Number(val.replace(/\D/g, ''));
      if (num > 0) applyPatch(buildChipFilterPatch(type, num, filters));
      return;
    }
    if (type === CHIP_TYPES.LOCATION) {
      const loc = parseManualLocationInput(val);
      if (loc) {
        applyPatch({
          city: loc.city ?? '',
          plz: loc.plz ?? '',
          locLabel: loc.city || loc.plz || '',
          radius: filters.radius ?? 25,
          locSkip: false,
        });
      }
    }
  }

  function handleGeo() {
    onAllowLocation?.();
    onClose?.();
  }

  const optionList = useMemo(() => {
    if (!config?.options?.length) return [];
    return config.options.map((opt) => ({
      ...opt,
      isActive: useDeferredApply
        ? pendingOption === opt.value
        : opt.isActive,
    }));
  }, [config, useDeferredApply, pendingOption]);

  if (!chip || !config) return null;

  if (config.showFallback) {
    return (
      <div className="smart-chip-edit" onClick={onClose} role="presentation">
        <div
          className="smart-chip-edit__panel"
          role="dialog"
          aria-modal="true"
          aria-labelledby="search-chip-editor-title"
          onClick={(e) => e.stopPropagation()}
        >
          <button type="button" className="smart-chip-edit__close" onClick={onClose} aria-label="Schließen">
            ×
          </button>
          <h2 id="search-chip-editor-title" className="smart-chip-edit__title">
            Suche anpassen
          </h2>
          <p className="smart-chip-edit__hint">{config.fallbackMessage}</p>
          <button
            type="button"
            className="smart-chip-edit__loc-btn"
            onClick={() => {
              onOpenSearch?.();
              onClose?.();
            }}
          >
            {config.fallbackButtonLabel}
          </button>
        </div>
      </div>
    );
  }

  const hasOptions = config.options?.length > 0;
  const hasRadius = config.showRadiusSection && config.radiusOptions?.length > 0;
  const hasLocActions = config.showLocationActions;

  return (
    <div className="smart-chip-edit" onClick={onClose} role="presentation">
      <div
        className={`smart-chip-edit__panel${isMobile ? ' smart-chip-edit__panel--sheet' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="search-chip-editor-title"
        onClick={(e) => e.stopPropagation()}
      >
        <button type="button" className="smart-chip-edit__close" onClick={onClose} aria-label="Schließen">
          ×
        </button>

        <h2 id="search-chip-editor-title" className="smart-chip-edit__title">
          {config.title}
        </h2>
        {config.hint && !isFeatureEditor && <p className="smart-chip-edit__hint">{config.hint}</p>}

        {hasLocActions && (
          <div className="smart-chip-edit__loc-actions">
            <button type="button" className="smart-chip-edit__loc-btn" onClick={handleGeo}>
              Standort verwenden
            </button>
            <button
              type="button"
              className="smart-chip-edit__loc-btn smart-chip-edit__loc-btn--secondary"
              onClick={() => setShowPlzInput((v) => !v)}
            >
              PLZ / Ort eingeben
            </button>
          </div>
        )}

        {hasRadius && (
          <div className="smart-chip-edit__section">
            <p className="smart-chip-edit__section-label">Radius</p>
            <div className="smart-chip-edit__options">
              {config.radiusOptions.map((opt) => (
                <button
                  key={String(opt.value)}
                  type="button"
                  className={`smart-chip-edit__option${opt.isActive ? ' is-active' : ''}`}
                  onClick={() => {
                    applyPatch(buildChipFilterPatch(CHIP_TYPES.RADIUS, opt.value, filters));
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {isFeatureEditor && (
          <div className="smart-chip-edit__features">
            {draftActiveFeatures.length > 0 && (
              <div className="smart-chip-edit__section">
                <p className="smart-chip-edit__section-label">Aktive Wünsche</p>
                <div className="smart-chip-edit__feature-chips">
                  {draftActiveFeatures.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      className="smart-chip-edit__feature-chip is-active"
                      onClick={() => toggleFeature(item.id)}
                    >
                      {item.label} ✓
                    </button>
                  ))}
                </div>
              </div>
            )}
            <div className="smart-chip-edit__section">
              <p className="smart-chip-edit__section-label">Weitere Ausstattung</p>
              <div className="smart-chip-edit__feature-chips">
                {[...(config.quickItems ?? []), ...(config.moreItems ?? [])].map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className={`smart-chip-edit__feature-chip${draftFeatures.includes(item.id) ? ' is-active' : ''}`}
                    onClick={() => toggleFeature(item.id)}
                  >
                    {item.label}{draftFeatures.includes(item.id) ? ' ✓' : ''}
                  </button>
                ))}
              </div>
            </div>
            <form className="smart-chip-edit__custom" onSubmit={submitCustom}>
              <label className="smart-chip-edit__custom-label">{config.customInputLabel}</label>
              <div className="smart-chip-edit__custom-row">
                <input
                  type="text"
                  value={customValue}
                  onChange={(e) => setCustomValue(e.target.value)}
                  placeholder={config.customInputPlaceholder}
                />
                {!isMobile && <button type="submit">Hinzufügen</button>}
              </div>
            </form>
          </div>
        )}

        {hasOptions && !isFeatureEditor && (
          <div className="smart-chip-edit__options" role="listbox">
            {optionList.map((opt) => (
              <button
                key={String(opt.value ?? opt.label)}
                type="button"
                role="option"
                aria-selected={opt.isActive}
                className={`smart-chip-edit__option${opt.isActive ? ' is-active' : ''}`}
                onClick={() => selectOption(opt.value)}
              >
                {opt.label}
              </button>
            ))}
          </div>
        )}

        {config.showCustomInput && type === CHIP_TYPES.LOCATION && showPlzInput && (
          <form className="smart-chip-edit__custom" onSubmit={submitCustom}>
            <label className="smart-chip-edit__custom-label">{config.customInputLabel}</label>
            <div className="smart-chip-edit__custom-row">
              <input
                type="text"
                value={customValue}
                onChange={(e) => setCustomValue(e.target.value)}
                placeholder={config.customInputPlaceholder}
                autoFocus
              />
              <button type="submit">Übernehmen</button>
            </div>
          </form>
        )}

        {showModelPicker && (
          <form className="smart-chip-edit__custom" onSubmit={submitCustom}>
            <label className="smart-chip-edit__custom-label">Modell eingeben</label>
            <div className="smart-chip-edit__custom-row">
              <input
                type="text"
                value={customValue}
                onChange={(e) => setCustomValue(e.target.value)}
                placeholder="z. B. EV3"
                autoFocus
              />
              <button type="submit">Übernehmen</button>
            </div>
          </form>
        )}

        {config.showCustomInput && type !== CHIP_TYPES.LOCATION && !showModelPicker && !isFeatureEditor && (
          <form className="smart-chip-edit__custom" onSubmit={submitCustom}>
            <label className="smart-chip-edit__custom-label">{config.customInputLabel}</label>
            <div className="smart-chip-edit__custom-row">
              <input
                type={type === CHIP_TYPES.BUDGET || type === CHIP_TYPES.CASH_BUDGET ? 'number' : 'text'}
                inputMode={type === CHIP_TYPES.BUDGET || type === CHIP_TYPES.CASH_BUDGET ? 'numeric' : 'text'}
                value={customValue}
                onChange={(e) => setCustomValue(e.target.value)}
                placeholder={config.customInputPlaceholder}
              />
              {config.customInputSuffix && (
                <span className="smart-chip-edit__suffix">{config.customInputSuffix}</span>
              )}
              <button type="submit">Übernehmen</button>
            </div>
          </form>
        )}

        {type === CHIP_TYPES.LOCATION && !localized && !hasLocActions && (
          <button type="button" className="smart-chip-edit__loc-btn" onClick={handleGeo}>
            Standort verwenden
          </button>
        )}

        {(isMobile || isFeatureEditor) && (
          <div className="smart-chip-edit__foot">
            <button
              type="button"
              className="smart-chip-edit__apply"
              onClick={() => {
                if (isFeatureEditor) applyFeatures();
                else applyDeferred();
              }}
            >
              Ergebnisse anzeigen
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
