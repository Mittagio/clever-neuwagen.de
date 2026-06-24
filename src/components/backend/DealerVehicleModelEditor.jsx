import { useMemo, useState } from 'react';
import VehicleImage from '../shared/VehicleImage.jsx';
import DealerVehicleActionCard from './DealerVehicleActionCard.jsx';
import DealerModelConditionsHub from './DealerModelConditionsHub.jsx';
import DealerModelPaymentConditions from './DealerModelPaymentConditions.jsx';
import DealerModelLeasingWizard from './DealerModelLeasingWizard.jsx';
import DealerModelFinancingWizard from './DealerModelFinancingWizard.jsx';
import DealerModelFinancingHub from './DealerModelFinancingHub.jsx';
import DealerModelFinanceResidualsWizard from './DealerModelFinanceResidualsWizard.jsx';
import DealerModelTrimPicker from './DealerModelTrimPicker.jsx';
import DealerModelCustomerPreview from './DealerModelCustomerPreview.jsx';
import DealerModelPublishFlow from './DealerModelPublishFlow.jsx';
import DealerModelChangeHistory from './DealerModelChangeHistory.jsx';
import DealerCopyConditionsPanel from './DealerCopyConditionsPanel.jsx';
import DealerConditionStatusBadge from './DealerConditionStatusBadge.jsx';
import {
  buildCustomerModelBadges,
  CASH_PREPARATION_MODES,
  createEmptyPromotion,
  resolveModelSettings,
} from '../../services/dealer/dealerVehicleManagement.js';
import {
  getLeasingWizardProgress,
  resolveSkippedMap,
} from '../../services/dealer/dealerLeasingWizard.js';
import {
  getModelTrimLines,
  shouldShowTrimPicker,
} from '../../services/dealer/dealerTrimConditions.js';
import { validateModelForPublish } from '../../services/dealer/dealerPublishValidation.js';
import { canPublishConditions } from '../../services/dealer/dealerConditionPermissions.js';
import DealerModelPromotionBadges from '../shared/DealerModelPromotionBadges.jsx';
import './DealerVehicleManagement.css';

const VIEWS = {
  MAIN: 'main',
  CONDITIONS: 'conditions',
  TRIM_PICKER: 'trim-picker',
  CASH: 'cash',
  LEASING: 'leasing',
  FINANCING: 'financing',
  FINANCING_HUB: 'financing-hub',
  FINANCE_RESIDUALS: 'finance-residuals',
  PUBLISH: 'publish',
};

export default function DealerVehicleModelEditor({
  model,
  conditions,
  userRole = 'dealerAdmin',
  onBack,
  onUpdateModel,
  onUpdateModelSettings,
  onUpdateDiscount,
  onUpdateLeasingFactor,
  onUpdateFinanceCondition,
  onUpdateFinanceResidual,
  onAddPromotion,
  onUpdatePromotion,
  onRemovePromotion,
  onAddCustomTargetGroup,
  onPublish,
  onSaved,
}) {
  const [view, setView] = useState(VIEWS.MAIN);
  const [savedFlash, setSavedFlash] = useState(false);
  const [pendingPaymentType, setPendingPaymentType] = useState(null);
  const [trimScope, setTrimScope] = useState(null);
  const trims = useMemo(() => getModelTrimLines(model), [model]);
  const settings = useMemo(
    () => resolveModelSettings(conditions, model.id),
    [conditions, model.id],
  );
  const previewBadges = useMemo(
    () => buildCustomerModelBadges(conditions, model.id),
    [conditions, model.id],
  );
  const leasingProgress = useMemo(
    () => getLeasingWizardProgress(conditions, model.id, resolveSkippedMap(settings)),
    [conditions, model.id, settings],
  );
  const publishCheck = useMemo(
    () => validateModelForPublish(conditions, model),
    [conditions, model],
  );
  const mayPublish = canPublishConditions(userRole);

  function patchSettings(partial) {
    onUpdateModelSettings?.(model.id, partial);
  }

  function handleSave() {
    setSavedFlash(true);
    onSaved?.();
    setTimeout(() => setSavedFlash(false), 2000);
  }

  const prep = settings.preparationFee ?? {};
  const dealerDefaultFee = conditions.preparationFee ?? 1290;

  function openPaymentFlow(paymentType) {
    if (paymentType === 'financing') {
      setPendingPaymentType(paymentType);
      setTrimScope(null);
      setView(VIEWS.FINANCING_HUB);
      return;
    }
    if (shouldShowTrimPicker(trims)) {
      setPendingPaymentType(paymentType);
      setTrimScope(null);
      setView(VIEWS.TRIM_PICKER);
      return;
    }
    setTrimScope(null);
    if (paymentType === 'cash') setView(VIEWS.CASH);
    else if (paymentType === 'leasing') setView(VIEWS.LEASING);
  }

  function openFinancingConditions() {
    if (shouldShowTrimPicker(trims)) {
      setPendingPaymentType('financing');
      setTrimScope(null);
      setView(VIEWS.TRIM_PICKER);
      return;
    }
    setTrimScope(null);
    setView(VIEWS.FINANCING);
  }

  function backToFinancingHub() {
    setPendingPaymentType('financing');
    setTrimScope(null);
    setView(VIEWS.FINANCING_HUB);
  }

  function handleTrimConfirm(scope) {
    setTrimScope(scope);
    if (pendingPaymentType === 'cash') setView(VIEWS.CASH);
    else if (pendingPaymentType === 'leasing') setView(VIEWS.LEASING);
    else if (pendingPaymentType === 'financing') setView(VIEWS.FINANCING);
  }

  function backToConditions() {
    setPendingPaymentType(null);
    setTrimScope(null);
    setView(VIEWS.CONDITIONS);
  }

  if (view === VIEWS.CONDITIONS) {
    return (
      <DealerModelConditionsHub
        model={model}
        conditions={conditions}
        onBack={() => setView(VIEWS.MAIN)}
        onOpenPayment={openPaymentFlow}
      />
    );
  }

  if (view === VIEWS.TRIM_PICKER && pendingPaymentType) {
    return (
      <DealerModelTrimPicker
        model={model}
        conditions={conditions}
        paymentType={pendingPaymentType}
        onBack={pendingPaymentType === 'financing' ? backToFinancingHub : backToConditions}
        onConfirm={handleTrimConfirm}
      />
    );
  }

  if (view === VIEWS.CASH) {
    return (
      <DealerModelPaymentConditions
        model={model}
        conditions={conditions}
        paymentType="cash"
        trimScope={trimScope}
        onBack={backToConditions}
        onUpdateModelSettings={onUpdateModelSettings}
        onUpdateDiscount={onUpdateDiscount}
      />
    );
  }

  if (view === VIEWS.FINANCING_HUB) {
    return (
      <DealerModelFinancingHub
        model={model}
        conditions={conditions}
        onBack={backToConditions}
        onOpenConditions={openFinancingConditions}
        onOpenResiduals={() => setView(VIEWS.FINANCE_RESIDUALS)}
      />
    );
  }

  if (view === VIEWS.FINANCE_RESIDUALS) {
    return (
      <DealerModelFinanceResidualsWizard
        model={model}
        conditions={conditions}
        onBack={backToFinancingHub}
        onUpdateFinanceResidual={onUpdateFinanceResidual}
        onUpdateModelSettings={onUpdateModelSettings}
        onPublish={mayPublish ? () => setView(VIEWS.PUBLISH) : undefined}
      />
    );
  }

  if (view === VIEWS.FINANCING) {
    return (
      <DealerModelFinancingWizard
        model={model}
        conditions={conditions}
        trimScope={trimScope}
        onBack={backToFinancingHub}
        onUpdateFinanceCondition={onUpdateFinanceCondition}
        onUpdateModelSettings={onUpdateModelSettings}
        onPreview={() => setView(VIEWS.PUBLISH)}
        onPublish={mayPublish ? onPublish : undefined}
      />
    );
  }

  if (view === VIEWS.LEASING) {
    return (
      <DealerModelLeasingWizard
        model={model}
        conditions={conditions}
        trimScope={trimScope}
        onBack={backToConditions}
        onUpdateLeasingFactor={onUpdateLeasingFactor}
        onUpdateModelSettings={onUpdateModelSettings}
        onPublish={mayPublish ? () => setView(VIEWS.PUBLISH) : undefined}
      />
    );
  }

  if (view === VIEWS.PUBLISH) {
    return (
      <DealerModelPublishFlow
        model={model}
        conditions={conditions}
        userRole={userRole}
        onBack={() => setView(VIEWS.MAIN)}
        onPublish={onPublish}
      />
    );
  }

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
          <div className="dvm-editor__status-row">
            <DealerConditionStatusBadge
              status={publishCheck.canPublish ? 'draft' : 'incomplete'}
              label={publishCheck.canPublish ? 'Bereit zur Vorschau' : 'Unvollständig'}
            />
          </div>
        </div>
      </header>

      <DealerCopyConditionsPanel
        model={model}
        conditions={conditions}
        onUpdateModelSettings={onUpdateModelSettings}
        onUpdateLeasingFactor={onUpdateLeasingFactor}
      />

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

      <section className="dvm-section">
        <h3 className="dvm-section__title">Konditionen</h3>
        <p className="dvm-section__hint">
          Barzahlung, Leasing und Finanzierung getrennt pflegen – mobil und Schritt für Schritt.
        </p>
        <button
          type="button"
          className="dvm-conditions-entry"
          onClick={() => setView(VIEWS.CONDITIONS)}
        >
          <span className="dvm-conditions-entry__icon" aria-hidden>📋</span>
          <span className="dvm-conditions-entry__body">
            <span className="dvm-conditions-entry__title">Konditionen öffnen</span>
            <span className="dvm-conditions-entry__meta">
              Leasing: {leasingProgress.filled} von {leasingProgress.total} Faktoren
            </span>
          </span>
          <span className="dvm-conditions-entry__chev" aria-hidden>›</span>
        </button>
      </section>

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

      <section className="dvm-section">
        <div className="dvm-section__head-row">
          <h3 className="dvm-section__title">Sonderaktionen</h3>
          <button
            type="button"
            className="dvm-add-btn"
            onClick={() => onAddPromotion?.(model.id, createEmptyPromotion(model.id))}
          >
            + Aktion anlegen
          </button>
        </div>

        {(settings.promotions ?? []).length === 0 ? (
          <p className="dvm-empty">Noch keine Aktion – z. B. Studentenbonus oder Sommeraktion anlegen.</p>
        ) : (
          <div className="dvm-action-stack">
            {(settings.promotions ?? []).map((promo) => (
              <DealerVehicleActionCard
                key={promo.id}
                model={model}
                conditions={conditions}
                promotion={promo}
                allPromotions={settings.promotions ?? []}
                onChange={(partial) => onUpdatePromotion?.(model.id, promo.id, partial)}
                onRemove={(id) => onRemovePromotion?.(model.id, id)}
                onAddCustomTargetGroup={onAddCustomTargetGroup}
              />
            ))}
          </div>
        )}
      </section>

      <section className="dvm-section">
        <h3 className="dvm-section__title">Kundenvorschau</h3>
        <p className="dvm-section__hint">
          So sieht der Kunde das Fahrzeug auf der Landingpage – vor der Veröffentlichung prüfen.
        </p>
        <DealerModelCustomerPreview model={model} conditions={conditions} />
        {mayPublish && (
          <button
            type="button"
            className="dvm-conditions-entry dvm-conditions-entry--publish"
            onClick={() => setView(VIEWS.PUBLISH)}
          >
            <span className="dvm-conditions-entry__icon" aria-hidden>🚀</span>
            <span className="dvm-conditions-entry__body">
              <span className="dvm-conditions-entry__title">Veröffentlichen</span>
              <span className="dvm-conditions-entry__meta">
                Vorschau, Prüfung und Freigabe
              </span>
            </span>
            <span className="dvm-conditions-entry__chev" aria-hidden>›</span>
          </button>
        )}
      </section>

      <section className="dvm-section">
        <h3 className="dvm-section__title">Änderungsverlauf</h3>
        <DealerModelChangeHistory conditions={conditions} modelId={model.id} />
      </section>

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
            <p className="dvm-preview__label">Badge-Vorschau</p>
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
