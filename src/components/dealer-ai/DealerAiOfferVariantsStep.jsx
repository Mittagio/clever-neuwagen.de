import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  DISCOUNT_GROUP_OPTIONS,
  DOWN_PAYMENT_OPTIONS,
  LEASING_MILEAGE_OPTIONS,
  LEASING_TERM_OPTIONS,
} from '../../services/configuration/conditionsStepPreview.js';
import {
  buildVariantSummaryLines,
  formatVariantRate,
  patchSmartVariantDraft,
  recalculateSmartVariant,
} from '../../services/dealer/smartOfferVariants.js';
import { FINANCING_WIZARD_DOWN_PAYMENTS } from '../../services/dealer/dealerFinancingWizard.js';
import { FINANCE_RESIDUAL_TERMS } from '../../services/dealer/dealerFinanceResiduals.js';
import {
  FlowChip,
  FlowPrimaryButton,
  FlowSecondaryButton,
  FlowStickyFooter,
  OfferFlowLayout,
} from './flow/OfferFlowComponents.jsx';
import './DealerAiOfferVariantsStep.css';

function formatBudget(value) {
  if (value == null) return null;
  return `${Number(value).toLocaleString('de-DE')} €/Monat`;
}

function budgetClass(status) {
  if (status === 'ok') return 'is-ok';
  if (status === 'over') return 'is-over';
  return '';
}

function VariantCard({
  variant,
  paymentType,
  onSelect,
  onAdjust,
}) {
  const lines = buildVariantSummaryLines(variant);
  const rateLabel = paymentType === 'cash' ? 'Kaufpreis' : 'Rate';

  return (
    <article className="dai-variant-card">
      <div className="dai-variant-card__head">
        <div className="dai-variant-card__tier">
          <span className="dai-variant-card__medal" aria-hidden="true">{variant.medal}</span>
          <span className="dai-variant-card__tier-label">{variant.tierLabel}</span>
          <span className="dai-variant-card__role">{variant.roleLabel}</span>
        </div>
        {variant.budget?.status && variant.budget.status !== 'open' && (
          <span className={`dai-variant-card__budget ${budgetClass(variant.budget.status)}`}>
            {variant.budget.icon} {variant.budget.label}
          </span>
        )}
      </div>

      <p className="dai-variant-card__trim">{variant.trimLabel}</p>
      <p className="dai-variant-card__rate">
        <span className="visually-hidden">{rateLabel}: </span>
        {formatVariantRate(variant)}
      </p>

      {lines.length > 0 && (
        <ul className="dai-variant-card__lines">
          {lines.map((line) => (
            <li key={line.label}>
              <span>{line.label}</span>
              <span>{line.value}</span>
            </li>
          ))}
        </ul>
      )}

      <div className="dai-variant-card__actions">
        <FlowSecondaryButton onClick={() => onAdjust(variant)}>
          Anpassen
        </FlowSecondaryButton>
        <FlowPrimaryButton onClick={() => onSelect(variant)}>
          Auswählen
        </FlowPrimaryButton>
      </div>
    </article>
  );
}

function QuickEditorSheet({
  variant,
  conditions,
  onClose,
  onApply,
}) {
  const [localDraft, setLocalDraft] = useState(variant?.draft ?? {});

  useEffect(() => {
    setLocalDraft(variant?.draft ?? {});
  }, [variant]);

  const paymentType = localDraft.paymentType ?? 'leasing';
  const isLeasing = paymentType === 'leasing';
  const isFinance = paymentType === 'financing' || paymentType === 'threeWayFinancing';
  const isCash = paymentType === 'cash';

  const patch = useCallback((next) => {
    setLocalDraft((prev) => ({ ...prev, ...next }));
  }, []);

  const handleApply = () => {
    let next = patchSmartVariantDraft(variant, localDraft);
    next = recalculateSmartVariant(next, conditions);
    onApply(next);
    onClose();
  };

  const downOptions = isFinance
    ? FINANCING_WIZARD_DOWN_PAYMENTS
    : DOWN_PAYMENT_OPTIONS.filter((v) => v <= 10000);

  const termOptions = isFinance ? FINANCE_RESIDUAL_TERMS : LEASING_TERM_OPTIONS;

  return (
    <div className="dai-variant-sheet" role="presentation" onClick={onClose}>
      <div
        className="dai-variant-sheet__panel"
        role="dialog"
        aria-labelledby="variant-quick-editor-title"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id="variant-quick-editor-title" className="dai-variant-sheet__title">
          {variant.tierLabel} anpassen
        </h2>
        <p className="dai-variant-sheet__subtitle">
          {variant.trimLabel} – Änderungen werden sofort neu berechnet.
        </p>

        {(isLeasing || isFinance) && (
          <div className="dai-variant-sheet__field">
            <span className="dai-variant-sheet__label">Laufzeit</span>
            <div className="dai-variant-sheet__chips">
              {termOptions.map((months) => (
                <FlowChip
                  key={months}
                  label={`${months} Mon.`}
                  selected={localDraft.termMonths === months}
                  onClick={() => patch({ termMonths: months })}
                />
              ))}
            </div>
          </div>
        )}

        {isLeasing && (
          <div className="dai-variant-sheet__field">
            <span className="dai-variant-sheet__label">Kilometer</span>
            <div className="dai-variant-sheet__chips">
              {[10000, 12500, 15000, 17500, 20000, 25000, 30000]
                .filter((km) => LEASING_MILEAGE_OPTIONS.includes(km))
                .map((km) => (
                  <FlowChip
                    key={km}
                    label={`${(km / 1000).toLocaleString('de-DE')}k`}
                    selected={localDraft.mileagePerYear === km}
                    onClick={() => patch({ mileagePerYear: km })}
                  />
                ))}
            </div>
          </div>
        )}

        {(isLeasing || isFinance) && (
          <div className="dai-variant-sheet__field">
            <span className="dai-variant-sheet__label">Anzahlung</span>
            <div className="dai-variant-sheet__chips">
              {downOptions.map((amount) => (
                <FlowChip
                  key={amount}
                  label={amount === 0 ? '0 €' : `${amount.toLocaleString('de-DE')} €`}
                  selected={localDraft.downPayment === amount}
                  onClick={() => patch({ downPayment: amount })}
                />
              ))}
            </div>
          </div>
        )}

        <div className="dai-variant-sheet__field">
          <span className="dai-variant-sheet__label">Rabatt</span>
          <div className="dai-variant-sheet__chips">
            {DISCOUNT_GROUP_OPTIONS.filter((g) => g.id !== 'custom').map((group) => (
              <FlowChip
                key={group.id}
                label={group.label}
                selected={localDraft.customerGroup === group.id}
                onClick={() => patch({ customerGroup: group.id, customDiscountPercent: null })}
              />
            ))}
          </div>
        </div>

        {isCash && (variant.snapshot?.promotions ?? []).length > 0 && (
          <div className="dai-variant-sheet__field">
            <span className="dai-variant-sheet__label">Aktive Aktionen</span>
            <div className="dai-variant-sheet__chips">
              {(variant.snapshot.promotions ?? []).map((promo) => (
                <FlowChip
                  key={promo.id}
                  label={promo.badgeText || promo.title}
                  selected
                  onClick={() => {}}
                />
              ))}
            </div>
          </div>
        )}

        <div className="dai-variant-sheet__footer">
          <FlowSecondaryButton onClick={onClose}>Abbrechen</FlowSecondaryButton>
          <FlowPrimaryButton onClick={handleApply}>Übernehmen</FlowPrimaryButton>
        </div>
      </div>
    </div>
  );
}

/** Schritt – drei Clever-Vorschläge mit Händlerkonditionen */
export default function DealerAiOfferVariantsStep({
  variants = [],
  draft,
  conditions,
  onVariantsChange,
  onSelectVariant,
  onOpenConditions,
  onBack,
  isExecuting = false,
}) {
  const [editingVariant, setEditingVariant] = useState(null);

  const budgetLimit = draft?.desiredRate ?? null;
  const paymentType = draft?.paymentType ?? 'leasing';

  const liveVariants = useMemo(() => variants, [variants]);

  const handleApplyEdit = (updated) => {
    const next = liveVariants.map((v) => (v.id === updated.id ? updated : v));
    onVariantsChange?.(next);
  };

  return (
    <OfferFlowLayout
      backLabel={onBack ? '← Zurück' : null}
      onBack={onBack}
      title="Clever-Vorschläge"
      subtitle="Drei Varianten – bereits berechnet, sofort versandbereit."
    >
      <p className="dai-variants-intro">
        Clever hat Händlerkonditionen, Rabatte und Aktionen automatisch angewendet.
        Prüfen, bei Bedarf anpassen und eine Variante auswählen.
      </p>

      {budgetLimit != null && (
        <p className="dai-variants-budget">
          Kundenbudget: <strong>{formatBudget(budgetLimit)}</strong>
        </p>
      )}

      <div className="dai-variants-grid">
        {liveVariants.map((variant) => (
          <VariantCard
            key={variant.id}
            variant={variant}
            paymentType={paymentType}
            onSelect={onSelectVariant}
            onAdjust={setEditingVariant}
          />
        ))}
      </div>

      {editingVariant && (
        <QuickEditorSheet
          variant={editingVariant}
          conditions={conditions}
          onClose={() => setEditingVariant(null)}
          onApply={handleApplyEdit}
        />
      )}

      <FlowStickyFooter hint="Variante wählen oder anpassen – danach Angebotsvorschau">
        {onOpenConditions && (
          <FlowSecondaryButton onClick={onOpenConditions} disabled={isExecuting}>
            Alle Konditionen
          </FlowSecondaryButton>
        )}
      </FlowStickyFooter>
    </OfferFlowLayout>
  );
}
