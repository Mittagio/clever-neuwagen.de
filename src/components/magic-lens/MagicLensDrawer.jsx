import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  MAGIC_LENS_AVAILABILITY_OPTIONS,
  MAGIC_LENS_BODY_OPTIONS,
  MAGIC_LENS_BRAND_OPTIONS,
  MAGIC_LENS_FEATURES,
  MAGIC_LENS_MILEAGE_OPTIONS,
  MAGIC_LENS_MODELS_BY_BRAND,
  MAGIC_LENS_PAYMENT_OPTIONS,
  MAGIC_LENS_RADIUS_OPTIONS,
  MAGIC_LENS_SORT_OPTIONS,
  MAGIC_LENS_TERM_OPTIONS,
  countMagicLensActiveFilters,
} from '../../data/magicLensOptions.js';
import { parseManualLocationInput } from '../../logic/advisorLocation.js';
import { CleverInsightMobileTip } from '../search/CleverInsightsPanel.jsx';
import './magicLens.css';

const SNAP_HEIGHT = { collapsed: 72, half: 0.52, full: 0.92 };

function snapFromHeight(px, viewportH) {
  const halfPx = viewportH * SNAP_HEIGHT.half;
  const fullPx = viewportH * SNAP_HEIGHT.full;
  if (px < (SNAP_HEIGHT.collapsed + halfPx) / 2) return 'collapsed';
  if (px < (halfPx + fullPx) / 2) return 'half';
  return 'full';
}

function heightForSnap(snap, viewportH) {
  if (snap === 'collapsed') return SNAP_HEIGHT.collapsed;
  return Math.round(viewportH * SNAP_HEIGHT[snap]);
}

function MagicLensSection({ title, children }) {
  return (
    <section className="magic-lens__section">
      <h3 className="magic-lens__section-title">{title}</h3>
      {children}
    </section>
  );
}

function ChipRow({ options, activeId, onSelect, getId = (o) => o.id, getLabel = (o) => o.label }) {
  return (
    <div className="magic-lens__chips">
      {options.map((opt) => {
        const id = getId(opt);
        const isActive = activeId === id || (id === '' && !activeId);
        return (
          <button
            key={id || 'all'}
            type="button"
            className={`magic-lens__chip${isActive ? ' is-active' : ''}`}
            onClick={() => onSelect(id)}
          >
            {getLabel(opt)}
          </button>
        );
      })}
    </div>
  );
}

export default function MagicLensDrawer({
  filters,
  onChange,
  onReset,
  expandSignal = 0,
  mobileTip = null,
  onApplyTip,
}) {
  const [snap, setSnap] = useState('collapsed');
  const [draft, setDraft] = useState(filters);
  const dragRef = useRef({ startY: 0, startH: 0, dragging: false });
  const viewportRef = useRef(typeof window !== 'undefined' ? window.innerHeight : 800);

  useEffect(() => {
    setDraft(filters);
  }, [filters]);

  useEffect(() => {
    if (expandSignal > 0) setSnap('half');
  }, [expandSignal]);

  useEffect(() => {
    function onResize() {
      viewportRef.current = window.innerHeight;
    }
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const activeCount = useMemo(() => countMagicLensActiveFilters(filters), [filters]);
  const payment = draft.payment || 'leasing';

  const modelOptions = useMemo(() => {
    const brand = draft.brand;
    const models = brand ? (MAGIC_LENS_MODELS_BY_BRAND[brand] ?? []) : [];
    return [{ id: '', label: 'Alle Modelle' }, ...models.map((m) => ({ id: m, label: m }))];
  }, [draft.brand]);

  const patchDraft = useCallback((patch) => {
    setDraft((prev) => ({ ...prev, ...patch }));
  }, []);

  function toggleFeature(featureId) {
    const next = draft.features.includes(featureId)
      ? draft.features.filter((id) => id !== featureId)
      : [...draft.features, featureId];
    patchDraft({ features: next });
  }

  function handleApply() {
    onChange?.(draft);
    setSnap('collapsed');
  }

  function handleReset() {
    onReset?.();
    setSnap('collapsed');
  }

  function expandToHalf() {
    if (snap === 'collapsed') setSnap('half');
  }

  function onPointerDown(e) {
    dragRef.current = {
      startY: e.clientY,
      startH: heightForSnap(snap, viewportRef.current),
      dragging: true,
    };
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  function onPointerMove(e) {
    if (!dragRef.current.dragging) return;
    const delta = dragRef.current.startY - e.clientY;
    const nextH = Math.max(SNAP_HEIGHT.collapsed, dragRef.current.startH + delta);
    const nextSnap = snapFromHeight(nextH, viewportRef.current);
    if (nextSnap !== snap) setSnap(nextSnap);
  }

  function onPointerUp(e) {
    if (!dragRef.current.dragging) return;
    dragRef.current.dragging = false;
    e.currentTarget.releasePointerCapture(e.pointerId);
    const delta = dragRef.current.startY - e.clientY;
    const projected = dragRef.current.startH + delta;
    setSnap(snapFromHeight(projected, viewportRef.current));
  }

  return (
    <>
      {snap !== 'collapsed' && (
        <button
          type="button"
          className="magic-lens-backdrop"
          aria-label="Magic Lens schließen"
          onClick={() => setSnap('collapsed')}
        />
      )}

      <div
        className={`magic-lens magic-lens--sheet magic-lens--${snap}`}
        role="dialog"
        aria-label="Filter und Suche verfeinern"
        aria-modal={snap !== 'collapsed'}
      >
        <div
          className="magic-lens__handle-zone"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          <div className="magic-lens__handle" aria-hidden="true" />
          <div className="magic-lens__peek-row">
            <CleverInsightMobileTip
              insight={snap === 'collapsed' ? mobileTip : null}
              onApply={onApplyTip}
              onOpenFilters={expandToHalf}
            />
            {snap !== 'collapsed' && (
              <button
                type="button"
                className="magic-lens__collapse-btn"
                onClick={() => setSnap('collapsed')}
              >
                Schließen
              </button>
            )}
            {snap === 'collapsed' && (
              <button
                type="button"
                className="magic-lens__filters-btn"
                onClick={expandToHalf}
                aria-label="Filter öffnen"
              >
                {activeCount > 0 ? `${activeCount} Filter` : 'Filter'}
              </button>
            )}
          </div>
        </div>

        <div className="magic-lens__scroll">
          <MagicLensSection title="Kaufmodell">
            <ChipRow
              options={MAGIC_LENS_PAYMENT_OPTIONS}
              activeId={payment}
              onSelect={(id) => patchDraft({ payment: id })}
            />
          </MagicLensSection>

          <MagicLensSection title="Budget">
            <div className="magic-lens__inputs">
              {payment === 'cash' ? (
                <div className="magic-lens__field">
                  <label htmlFor="ml-maxPrice">Kaufpreis bis</label>
                  <input
                    id="ml-maxPrice"
                    type="number"
                    inputMode="numeric"
                    placeholder="z. B. 35.000"
                    value={draft.maxPrice ?? ''}
                    onChange={(e) => patchDraft({
                      maxPrice: e.target.value ? Number(e.target.value) : null,
                    })}
                  />
                </div>
              ) : (
                <div className="magic-lens__field">
                  <label htmlFor="ml-maxRate">
                    {payment === 'finance' ? 'Finanzierungsrate bis' : 'Leasingrate bis'}
                  </label>
                  <input
                    id="ml-maxRate"
                    type="number"
                    inputMode="numeric"
                    placeholder="z. B. 400"
                    value={draft.maxRate ?? ''}
                    onChange={(e) => patchDraft({
                      maxRate: e.target.value ? Number(e.target.value) : null,
                    })}
                  />
                </div>
              )}
            </div>
          </MagicLensSection>

          <MagicLensSection title="Fahrzeug">
            <div className="magic-lens__inputs">
              <ChipRow
                options={MAGIC_LENS_BRAND_OPTIONS}
                activeId={draft.brand}
                onSelect={(id) => patchDraft({ brand: id, model: '' })}
              />
              <div className="magic-lens__sub">
                <ChipRow
                  options={modelOptions}
                  activeId={draft.model}
                  onSelect={(id) => patchDraft({ model: id })}
                />
              </div>
              <div className="magic-lens__sub">
                <span className="magic-lens__section-title">Karosserie</span>
                <ChipRow
                  options={[{ id: 'all', label: 'Alle' }, ...MAGIC_LENS_BODY_OPTIONS]}
                  activeId={draft.type || 'all'}
                  onSelect={(id) => patchDraft({ type: id === 'all' ? 'all' : id })}
                />
              </div>
            </div>
          </MagicLensSection>

          <MagicLensSection title="Ausstattung">
            <div className="magic-lens__chips">
              {MAGIC_LENS_FEATURES.map((feature) => (
                <button
                  key={feature.id}
                  type="button"
                  className={`magic-lens__chip${draft.features.includes(feature.id) ? ' is-active' : ''}`}
                  onClick={() => toggleFeature(feature.id)}
                >
                  {feature.label}
                </button>
              ))}
            </div>
          </MagicLensSection>

          <MagicLensSection title="Standort">
            <div className="magic-lens__inputs">
              <div className="magic-lens__field">
                <label htmlFor="ml-location">PLZ oder Ort</label>
                <input
                  id="ml-location"
                  type="text"
                  placeholder="z. B. Stuttgart"
                  value={draft.city || draft.plz || ''}
                  onChange={(e) => {
                    const loc = parseManualLocationInput(e.target.value);
                    if (loc) patchDraft({ city: loc.city ?? '', plz: loc.plz ?? '' });
                    else patchDraft({ city: e.target.value, plz: '' });
                  }}
                />
              </div>
              <ChipRow
                options={MAGIC_LENS_RADIUS_OPTIONS}
                activeId={draft.radius ?? 'all'}
                onSelect={(value) => patchDraft({ radius: value === 'all' ? null : value })}
                getId={(o) => o.value ?? 'all'}
                getLabel={(o) => o.label}
              />
            </div>
          </MagicLensSection>

          <MagicLensSection title="Verfügbarkeit">
            <ChipRow
              options={[{ id: '', label: 'Alle' }, ...MAGIC_LENS_AVAILABILITY_OPTIONS]}
              activeId={draft.availability}
              onSelect={(id) => patchDraft({ availability: id })}
            />
          </MagicLensSection>

          <MagicLensSection title="Leasing-Details">
            <div className="magic-lens__sub">
              <span className="magic-lens__section-title">Laufzeit</span>
              <ChipRow
                options={MAGIC_LENS_TERM_OPTIONS.map((m) => ({ id: String(m), label: `${m} Monate` }))}
                activeId={String(draft.termMonths)}
                onSelect={(id) => patchDraft({ termMonths: Number(id) })}
              />
            </div>
            <div className="magic-lens__sub">
              <span className="magic-lens__section-title">Kilometer / Jahr</span>
              <ChipRow
                options={MAGIC_LENS_MILEAGE_OPTIONS.map((km) => ({
                  id: String(km),
                  label: km.toLocaleString('de-DE'),
                }))}
                activeId={String(draft.mileagePerYear)}
                onSelect={(id) => patchDraft({ mileagePerYear: Number(id) })}
              />
            </div>
            <div className="magic-lens__sub">
              <span className="magic-lens__section-title">Sortierung</span>
              <ChipRow
                options={MAGIC_LENS_SORT_OPTIONS}
                activeId={draft.sort}
                onSelect={(id) => patchDraft({ sort: id })}
              />
            </div>
          </MagicLensSection>
        </div>

        <div className="magic-lens__actions">
          <button type="button" className="magic-lens__apply" onClick={handleApply}>
            {activeCount > 0 ? `${activeCount} Filter anwenden` : 'Filter anwenden'}
          </button>
          {activeCount > 0 && (
            <button type="button" className="magic-lens__reset" onClick={handleReset}>
              Alle Filter zurücksetzen
            </button>
          )}
        </div>
      </div>
    </>
  );
}
