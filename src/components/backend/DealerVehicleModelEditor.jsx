import { useMemo, useState } from 'react';
import VehicleImage from '../shared/VehicleImage.jsx';
import DealerVehicleActionCard from './DealerVehicleActionCard.jsx';
import {
  buildCustomerModelBadges,
  CASH_PREPARATION_MODES,
  clampDiscount,
  createEmptyPromotion,
  PAYMENT_DISCOUNT_QUICK_VALUES,
  resolveModelSettings,
} from '../../services/dealer/dealerVehicleManagement.js';
import DealerModelPromotionBadges from '../shared/DealerModelPromotionBadges.jsx';
import './DealerVehicleManagement.css';

const PAYMENT_TYPES = [
  { key: 'cash', label: 'Barzahlung', icon: '💶' },
  { key: 'leasing', label: 'Leasing', icon: '📋' },
  { key: 'financing', label: 'Finanzierung', icon: '🏦' },
];

function DiscountCard({ label, icon, value, onChange, min, max }) {
  function adjust(delta) {
    onChange(clampDiscount((Number(value) || 0) + delta, min, max));
  }

  return (
    <div className="dvm-discount-card">
      <div className="dvm-discount-card__head">
        <span className="dvm-discount-card__icon" aria-hidden>{icon}</span>
        <span className="dvm-discount-card__label">{label}</span>
      </div>

      <div className="dvm-stepper">
        <button type="button" className="dvm-stepper__btn" onClick={() => adjust(-1)} aria-label="Weniger">−</button>
        <div className="dvm-stepper__value">
          <input
            type="range"
            className="dvm-stepper__range"
            min={min}
            max={max}
            value={Number(value) || 0}
            onChange={(e) => onChange(clampDiscount(e.target.value, min, max))}
          />
          <span className="dvm-stepper__percent">{Number(value) || 0} %</span>
        </div>
        <button type="button" className="dvm-stepper__btn" onClick={() => adjust(1)} aria-label="Mehr">+</button>
      </div>

      <div className="dvm-quick-btns">
        {PAYMENT_DISCOUNT_QUICK_VALUES.map((pct) => (
          <button
            key={pct}
            type="button"
            className={`dvm-quick-btn${Number(value) === pct ? ' is-active' : ''}`}
            onClick={() => onChange(pct)}
          >
            {pct} %
          </button>
        ))}
      </div>
    </div>
  );
}

export default function DealerVehicleModelEditor({
  model,
  conditions,
  onBack,
  onUpdateModel,
  onUpdateModelSettings,
  onUpdateDiscount,
  onAddPromotion,
  onUpdatePromotion,
  onRemovePromotion,
  onSaved,
}) {
  const [savedFlash, setSavedFlash] = useState(false);
  const settings = useMemo(
    () => resolveModelSettings(conditions, model.id),
    [conditions, model.id],
  );
  const previewBadges = useMemo(
    () => buildCustomerModelBadges(conditions, model.id),
    [conditions, model.id],
  );

  function patchSettings(partial) {
    onUpdateModelSettings?.(model.id, partial);
  }

  function patchPaymentDiscount(key, value) {
    patchSettings({
      paymentDiscounts: { [key]: clampDiscount(value, settings.discountMin ?? 0, settings.discountMax ?? 50) },
    });
    onUpdateDiscount?.(model.id, 'standard', settings.paymentDiscounts?.leasing ?? value);
  }

  function handleSave() {
    setSavedFlash(true);
    onSaved?.();
    setTimeout(() => setSavedFlash(false), 2000);
  }

  const prep = settings.preparationFee ?? {};
  const dealerDefaultFee = conditions.preparationFee ?? 1290;

  return (
    <div className="dvm-editor">
      <button type="button" className="dvm-back" onClick={onBack}>
        ← Alle Modelle
      </button>

      <header className="dvm-editor__hero">
        <div className="dvm-editor__hero-visual">
          <VehicleImage
            brand={model.brand ?? 'Kia'}
            model={model.id}
            bodyType="suv"
            variant="hero"
            className="dvm-editor__hero-image-wrap"
            imageClassName="dvm-editor__hero-image"
          />
        </div>
        <div>
          <p className="dvm-editor__brand">{model.brand}</p>
          <h2 className="dvm-editor__title">{model.name}</h2>
          <p className="dvm-editor__subtitle">Modell verwalten</p>
        </div>
      </header>

      {/* A) Grunddaten */}
      <section className="dvm-section">
        <h3 className="dvm-section__title">Grunddaten</h3>

        <label className="dvm-toggle dvm-toggle--large">
          <input
            type="checkbox"
            checked={model.active}
            onChange={(e) => onUpdateModel?.(model.id, { active: e.target.checked })}
          />
          <span>Modell aktiv</span>
        </label>

        <div className="dvm-field-grid">
          <label className="dvm-field">
            <span className="dvm-field__label">Listenpreis ab (€)</span>
            <input
              type="number"
              className="dvm-field__input"
              value={settings.listPrice ?? ''}
              onChange={(e) => patchSettings({
                listPrice: e.target.value === '' ? null : Number(e.target.value),
              })}
              placeholder="z. B. 32.990"
            />
          </label>
          <label className="dvm-field">
            <span className="dvm-field__label">Ab-Preis / Rate-Hinweis</span>
            <input
              type="text"
              className="dvm-field__input"
              value={settings.priceFrom ?? ''}
              onChange={(e) => patchSettings({ priceFrom: e.target.value })}
              placeholder="z. B. ab 299 €/Monat"
            />
          </label>
          <label className="dvm-field">
            <span className="dvm-field__label">Lieferzeit</span>
            <input
              type="text"
              className="dvm-field__input"
              value={settings.deliveryTime ?? ''}
              onChange={(e) => {
                patchSettings({ deliveryTime: e.target.value });
                onUpdateModel?.(model.id, { defaultDeliveryTime: e.target.value });
              }}
            />
          </label>
        </div>

        <label className="dvm-field">
          <span className="dvm-field__label">Kurzer Kundenhinweis</span>
          <textarea
            className="dvm-field__textarea"
            rows={2}
            value={settings.customerHint ?? ''}
            onChange={(e) => patchSettings({ customerHint: e.target.value })}
            placeholder="z. B. Aktionsmodelle mit kurzer Lieferzeit verfügbar"
          />
        </label>
      </section>

      {/* B) Konditionen */}
      <section className="dvm-section">
        <h3 className="dvm-section__title">Konditionen</h3>
        <p className="dvm-section__hint">Rabatte je Zahlungsart – per Slider oder Schnellauswahl.</p>

        <div className="dvm-discount-stack">
          {PAYMENT_TYPES.map((pt) => (
            <DiscountCard
              key={pt.key}
              label={pt.label}
              icon={pt.icon}
              value={settings.paymentDiscounts?.[pt.key] ?? 0}
              min={settings.discountMin ?? 0}
              max={settings.discountMax ?? 50}
              onChange={(val) => patchPaymentDiscount(pt.key, val)}
            />
          ))}
        </div>

        <div className="dvm-field-grid">
          <label className="dvm-field">
            <span className="dvm-field__label">Fixer Bonus (€)</span>
            <input
              type="number"
              className="dvm-field__input"
              min={0}
              value={settings.bonusAmount ?? ''}
              onChange={(e) => patchSettings({
                bonusAmount: e.target.value === '' ? null : Number(e.target.value),
              })}
            />
          </label>
          <label className="dvm-field">
            <span className="dvm-field__label">Rabatt min–max %</span>
            <div className="dvm-inline-range">
              <input
                type="number"
                className="dvm-field__input"
                min={0}
                max={50}
                value={settings.discountMin ?? 0}
                onChange={(e) => patchSettings({ discountMin: Number(e.target.value) || 0 })}
              />
              <span>–</span>
              <input
                type="number"
                className="dvm-field__input"
                min={0}
                max={50}
                value={settings.discountMax ?? 50}
                onChange={(e) => patchSettings({ discountMax: Number(e.target.value) || 50 })}
              />
            </div>
          </label>
        </div>
      </section>

      {/* Überführung */}
      <section className="dvm-section dvm-section--prep">
        <h3 className="dvm-section__title">Überführung & Preistext</h3>

        <label className="dvm-toggle dvm-toggle--large">
          <input
            type="checkbox"
            checked={prep.useDealerDefault !== false}
            onChange={(e) => patchSettings({
              preparationFee: { useDealerDefault: e.target.checked },
            })}
          />
          <span>
            Händlerstandard verwenden (
            {dealerDefaultFee.toLocaleString('de-DE')}
            {' '}
            €)
          </span>
        </label>

        {prep.useDealerDefault === false && (
          <label className="dvm-field">
            <span className="dvm-field__label">Modell-Überführung (€)</span>
            <input
              type="number"
              className="dvm-field__input"
              min={0}
              value={prep.amount ?? ''}
              onChange={(e) => patchSettings({
                preparationFee: { amount: Number(e.target.value) || 0 },
              })}
            />
          </label>
        )}

        <p className="dvm-section__hint">Leasing: Überführung wird immer separat ausgewiesen.</p>

        <div className="dvm-chips dvm-chips--wrap">
          {CASH_PREPARATION_MODES.map((mode) => (
            <button
              key={mode.id}
              type="button"
              className={`dvm-chip${prep.cashDisplayMode === mode.id ? ' is-active' : ''}`}
              onClick={() => patchSettings({ preparationFee: { cashDisplayMode: mode.id } })}
            >
              {mode.label}
            </button>
          ))}
        </div>

        {prep.cashDisplayMode === 'custom' && (
          <label className="dvm-field">
            <span className="dvm-field__label">Eigener Rechtstext</span>
            <textarea
              className="dvm-field__textarea"
              rows={2}
              value={prep.customLegalText ?? ''}
              onChange={(e) => patchSettings({
                preparationFee: { customLegalText: e.target.value },
              })}
              placeholder="Individueller Hinweis für Barpreis"
            />
          </label>
        )}
      </section>

      {/* C) Sonderaktionen */}
      <section className="dvm-section">
        <div className="dvm-section__head-row">
          <h3 className="dvm-section__title">Sonderaktionen</h3>
          <button
            type="button"
            className="dvm-add-btn"
            onClick={() => onAddPromotion?.(model.id, createEmptyPromotion())}
          >
            + Aktion
          </button>
        </div>

        {(settings.promotions ?? []).length === 0 ? (
          <p className="dvm-empty">Noch keine Aktion – z. B. Studentenbonus oder Sommeraktion anlegen.</p>
        ) : (
          <div className="dvm-action-stack">
            {(settings.promotions ?? []).map((promo) => (
              <DealerVehicleActionCard
                key={promo.id}
                promotion={promo}
                onChange={(partial) => onUpdatePromotion?.(model.id, promo.id, partial)}
                onRemove={(id) => onRemovePromotion?.(model.id, id)}
              />
            ))}
          </div>
        )}
      </section>

      {/* D) Sichtbarkeit */}
      <section className="dvm-section">
        <h3 className="dvm-section__title">Sichtbarkeit</h3>

        <div className="dvm-toggle-stack">
          <label className="dvm-toggle dvm-toggle--large">
            <input
              type="checkbox"
              checked={settings.showOnCustomerSite}
              onChange={(e) => {
                patchSettings({ showOnCustomerSite: e.target.checked });
                onUpdateModel?.(model.id, {
                  showOnDealerPage: e.target.checked,
                  syncToLanding: e.target.checked,
                });
              }}
            />
            <span>Auf Kundenseite anzeigen</span>
          </label>
          <label className="dvm-toggle dvm-toggle--large">
            <input
              type="checkbox"
              checked={settings.highlight}
              onChange={(e) => patchSettings({ highlight: e.target.checked })}
            />
            <span>Als Highlight markieren</span>
          </label>
        </div>

        <label className="dvm-field">
          <span className="dvm-field__label">
            Priorität auf Landingpage (
            {settings.landingPriority ?? 50}
            )
          </span>
          <input
            type="range"
            className="dvm-priority-range"
            min={0}
            max={100}
            value={settings.landingPriority ?? 50}
            onChange={(e) => patchSettings({ landingPriority: Number(e.target.value) })}
          />
        </label>

        {previewBadges.length > 0 && (
          <div className="dvm-preview">
            <p className="dvm-preview__label">Vorschau Kundenseite</p>
            <DealerModelPromotionBadges badges={previewBadges} />
          </div>
        )}
      </section>

      <div className="dvm-save-dock">
        <button
          type="button"
          className={`dvm-save-btn${savedFlash ? ' is-saved' : ''}`}
          onClick={handleSave}
        >
          {savedFlash ? '✓ Gespeichert' : 'Speichern'}
        </button>
      </div>
    </div>
  );
}
