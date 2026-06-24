import { useMemo, useState } from 'react';
import {
  formatValidUntilShort,
} from '../../services/dealer/dealerVehicleManagement.js';
import {
  createCustomTargetGroup,
  detectPromotionConflicts,
  resolveTargetGroupLabel,
  resolveTargetGroups,
} from '../../services/dealer/dealerPromotionEngine.js';
import { resolveValidityStatus } from '../../services/dealer/dealerConditionLifecycle.js';
import DealerPromotionScopePicker from './DealerPromotionScopePicker.jsx';
import DealerValidityFields from './DealerValidityFields.jsx';
import DealerConditionStatusBadge from './DealerConditionStatusBadge.jsx';
import './DealerVehicleManagement.css';

export default function DealerVehicleActionCard({
  model,
  conditions,
  promotion,
  allPromotions = [],
  onChange,
  onRemove,
  onAddCustomTargetGroup,
}) {
  const [showCustomGroup, setShowCustomGroup] = useState(false);
  const [customGroupLabel, setCustomGroupLabel] = useState('');

  const targetGroups = useMemo(
    () => resolveTargetGroups(conditions),
    [conditions],
  );

  const status = resolveValidityStatus(
    promotion,
    {
      isComplete: Boolean(promotion.title?.trim()),
      isPublished: promotion.active,
    },
  );

  const conflicts = detectPromotionConflicts(
    allPromotions.filter((p) => p.id !== promotion.id && p.active),
  ).filter((c) => c.a.id === promotion.id || c.b.id === promotion.id);

  function handleAddCustomGroup() {
    const group = createCustomTargetGroup(customGroupLabel);
    onAddCustomTargetGroup?.(group);
    onChange?.({ targetGroup: group.id });
    setCustomGroupLabel('');
    setShowCustomGroup(false);
  }

  return (
    <article className="dvm-action-card">
      <header className="dvm-action-card__head">
        <input
          type="text"
          className="dvm-action-card__title-input"
          value={promotion.title}
          onChange={(e) => onChange?.({ title: e.target.value })}
          placeholder="Aktionsname"
          aria-label="Aktionsname"
        />
        <DealerConditionStatusBadge status={status} />
        <button
          type="button"
          className="dvm-action-card__remove"
          onClick={() => onRemove?.(promotion.id)}
          aria-label="Aktion entfernen"
        >
          ×
        </button>
      </header>

      <DealerPromotionScopePicker
        model={model}
        conditions={conditions}
        scope={promotion.scope}
        onChange={(scope) => onChange?.({ scope })}
      />

      <div className="dvm-action-card__row">
        <label className="dvm-field dvm-field--half">
          <span className="dvm-field__label">Rabatt %</span>
          <input
            type="number"
            className="dvm-field__input"
            min={0}
            max={50}
            value={promotion.extraDiscountPercent ?? ''}
            onChange={(e) => onChange?.({
              extraDiscountPercent: e.target.value === '' ? null : Number(e.target.value),
            })}
          />
        </label>
        <label className="dvm-field dvm-field--half">
          <span className="dvm-field__label">Bonusbetrag €</span>
          <input
            type="number"
            className="dvm-field__input"
            min={0}
            value={promotion.bonusAmount ?? ''}
            onChange={(e) => onChange?.({
              bonusAmount: e.target.value === '' ? null : Number(e.target.value),
            })}
          />
        </label>
      </div>

      <label className="dvm-field">
        <span className="dvm-field__label">Zielgruppe</span>
        <div className="dvm-chips dvm-chips--wrap">
          {targetGroups.map((group) => (
            <button
              key={group.id}
              type="button"
              className={`dvm-chip${promotion.targetGroup === group.id ? ' is-active' : ''}`}
              onClick={() => onChange?.({ targetGroup: group.id })}
            >
              {group.label}
            </button>
          ))}
          <button
            type="button"
            className="dvm-chip dvm-chip--add"
            onClick={() => setShowCustomGroup((v) => !v)}
          >
            + Eigene Zielgruppe
          </button>
        </div>
      </label>

      {showCustomGroup && (
        <div className="dvm-action-card__custom-group">
          <input
            type="text"
            className="dvm-field__input"
            value={customGroupLabel}
            onChange={(e) => setCustomGroupLabel(e.target.value)}
            placeholder="z. B. Studenten, Ärzte, Bosch Mitarbeiter"
          />
          <button type="button" className="dvm-chip is-active" onClick={handleAddCustomGroup}>
            Anlegen
          </button>
        </div>
      )}

      <DealerValidityFields
        value={promotion}
        onChange={(partial) => onChange?.(partial)}
      />

      <label className="dvm-field">
        <span className="dvm-field__label">Badge-Text auf Kundenseite</span>
        <input
          type="text"
          className="dvm-field__input"
          value={promotion.badgeText}
          onChange={(e) => onChange?.({ badgeText: e.target.value })}
          placeholder="z. B. 1.000 € Studentenbonus"
        />
      </label>

      <div className="dvm-toggle-row">
        <label className="dvm-toggle">
          <input
            type="checkbox"
            checked={promotion.highlight === true}
            onChange={(e) => onChange?.({ highlight: e.target.checked })}
          />
          <span>⭐ Highlight-Aktion</span>
        </label>
        <label className="dvm-toggle">
          <input
            type="checkbox"
            checked={promotion.combinable !== false}
            onChange={(e) => onChange?.({ combinable: e.target.checked })}
          />
          <span>Mit anderen Aktionen kombinierbar</span>
        </label>
        <label className="dvm-toggle">
          <input
            type="checkbox"
            checked={promotion.active}
            onChange={(e) => onChange?.({ active: e.target.checked })}
          />
          <span>Aktiv</span>
        </label>
        <label className="dvm-toggle">
          <input
            type="checkbox"
            checked={promotion.showOnCustomerSite}
            onChange={(e) => onChange?.({ showOnCustomerSite: e.target.checked })}
          />
          <span>Auf Kundenseite</span>
        </label>
      </div>

      {conflicts.length > 0 && (
        <p className="dvm-action-card__conflict">
          {conflicts[0].label}
        </p>
      )}

      {promotion.validUntil && (
        <p className="dvm-action-card__hint">
          {resolveTargetGroupLabel(conditions, promotion.targetGroup)}
          {' · '}
          gültig bis {formatValidUntilShort(promotion.validUntil)}
        </p>
      )}
    </article>
  );
}
