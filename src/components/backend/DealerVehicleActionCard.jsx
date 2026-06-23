import {
  ACTION_TARGET_GROUPS,
  formatValidUntilShort,
} from '../../services/dealer/dealerVehicleManagement.js';
import './DealerVehicleManagement.css';

export default function DealerVehicleActionCard({
  promotion,
  onChange,
  onRemove,
}) {
  const targetLabel = ACTION_TARGET_GROUPS.find((g) => g.id === promotion.targetGroup)?.label
    ?? promotion.targetGroup;

  return (
    <article className="dvm-action-card">
      <header className="dvm-action-card__head">
        <input
          type="text"
          className="dvm-action-card__title-input"
          value={promotion.title}
          onChange={(e) => onChange?.({ title: e.target.value })}
          placeholder="Aktionstitel"
          aria-label="Aktionstitel"
        />
        <button
          type="button"
          className="dvm-action-card__remove"
          onClick={() => onRemove?.(promotion.id)}
          aria-label="Aktion entfernen"
        >
          ×
        </button>
      </header>

      <label className="dvm-field">
        <span className="dvm-field__label">Beschreibung</span>
        <textarea
          className="dvm-field__textarea"
          rows={2}
          value={promotion.description}
          onChange={(e) => onChange?.({ description: e.target.value })}
          placeholder="Kurz für interne Notiz"
        />
      </label>

      <div className="dvm-action-card__row">
        <label className="dvm-field dvm-field--half">
          <span className="dvm-field__label">Bonus €</span>
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
        <label className="dvm-field dvm-field--half">
          <span className="dvm-field__label">Extra-Rabatt %</span>
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
      </div>

      <label className="dvm-field">
        <span className="dvm-field__label">Zielgruppe</span>
        <div className="dvm-chips">
          {ACTION_TARGET_GROUPS.map((group) => (
            <button
              key={group.id}
              type="button"
              className={`dvm-chip${promotion.targetGroup === group.id ? ' is-active' : ''}`}
              onClick={() => onChange?.({ targetGroup: group.id })}
            >
              {group.label}
            </button>
          ))}
        </div>
      </label>

      <div className="dvm-action-card__row">
        <label className="dvm-field dvm-field--half">
          <span className="dvm-field__label">Gültig von</span>
          <input
            type="date"
            className="dvm-field__input"
            value={promotion.validFrom?.slice(0, 10) ?? ''}
            onChange={(e) => onChange?.({ validFrom: e.target.value })}
          />
        </label>
        <label className="dvm-field dvm-field--half">
          <span className="dvm-field__label">Gültig bis</span>
          <input
            type="date"
            className="dvm-field__input"
            value={promotion.validUntil?.slice(0, 10) ?? ''}
            onChange={(e) => onChange?.({ validUntil: e.target.value })}
          />
        </label>
      </div>

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
            checked={promotion.showOnCustomerSite}
            onChange={(e) => onChange?.({ showOnCustomerSite: e.target.checked })}
          />
          <span>Auf Kundenseite anzeigen</span>
        </label>
        <label className="dvm-toggle">
          <input
            type="checkbox"
            checked={promotion.active}
            onChange={(e) => onChange?.({ active: e.target.checked })}
          />
          <span>Aktiv</span>
        </label>
      </div>

      {promotion.validUntil && (
        <p className="dvm-action-card__hint">
          Kunde sieht: gültig bis {formatValidUntilShort(promotion.validUntil)}
        </p>
      )}
    </article>
  );
}
