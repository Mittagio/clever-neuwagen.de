import {
  DEALER_AI_MILEAGE_OPTIONS,
  DEALER_AI_PAYMENT_OPTIONS,
  DEALER_AI_TERM_OPTIONS,
  PAYMENT_TYPE_LABELS,
} from '../../services/dealerAiParser.js';
import {
  buildBudgetPriceOptions,
  buildBudgetRateOptions,
  buildDeliveryDateOptions,
  buildDownPaymentOptions,
} from '../../services/dealerAiMailExtractor.js';
import {
  buildOfferPreview,
  buildRecognizedWishFramework,
  buildSensibleAlternatives,
} from '../../services/dealerAiVehicleConfigureFlow.js';
import './DealerAiVehicleConfigure.css';

function SelectField({ label, value, options, onChange, formatOption, className = '' }) {
  return (
    <label className={`dai-config-field ${className}`.trim()}>
      <span className="dai-config-field__label">{label}</span>
      <select
        className="dai-config-field__select"
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
      >
        {options.map((opt) => {
          const id = typeof opt === 'object' ? opt.id : opt;
          const optLabel = formatOption
            ? formatOption(opt)
            : (typeof opt === 'object' ? opt.label : String(opt));
          return (
            <option key={String(id)} value={id}>{optLabel}</option>
          );
        })}
      </select>
    </label>
  );
}

function TextField({ label, value, onChange, type = 'text', className = '' }) {
  return (
    <label className={`dai-config-field ${className}`.trim()}>
      <span className="dai-config-field__label">{label}</span>
      <input
        type={type}
        className="dai-config-field__input"
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}

function formatCurrency(amount) {
  if (amount == null) return '–';
  return `${Number(amount).toLocaleString('de-DE')} €`;
}

export default function DealerAiVehicleConfigure({
  draft,
  parsed,
  conditions,
  customerContact,
  contextBanner,
  onDraftChange,
  onCreateOffer,
  onBack,
  onSwitchToSearch,
  isExecuting = false,
}) {
  if (!draft) return null;

  const fields = parsed?.fields ?? {};
  const wishFramework = buildRecognizedWishFramework(draft, fields);
  const offerPreview = buildOfferPreview(draft, conditions, fields);
  const alternatives = buildSensibleAlternatives(draft, conditions, fields);

  const customer = draft.customer ?? {};
  const isCash = draft.paymentType === 'cash';
  const budgetOptions = (isCash ? buildBudgetPriceOptions(draft.desiredPrice) : buildBudgetRateOptions(draft.desiredRate))
    .map((amount) => ({ id: String(amount), label: `${amount.toLocaleString('de-DE')} €` }));
  const budgetValue = isCash
    ? (draft.desiredPrice != null ? String(draft.desiredPrice) : '')
    : (draft.desiredRate != null ? String(draft.desiredRate) : '');

  const deliveryOptions = buildDeliveryDateOptions(draft.desiredDeliveryDate).map((v) => ({
    id: v,
    label: v === 'offen' ? 'offen' : v,
  }));
  const downPaymentOptions = buildDownPaymentOptions(draft.downPayment ?? 0).map((v) => ({
    id: String(v),
    label: v === 0 ? '0 €' : `${v.toLocaleString('de-DE')} €`,
  }));

  const vehicleLine = [draft.model, draft.trimLabel, draft.batteryLabel, draft.motorLabel]
    .filter(Boolean)
    .join(' · ');

  function patchDraft(partial) {
    onDraftChange({ ...draft, ...partial });
  }

  function patchCustomer(partial) {
    const nextCustomer = { ...customer, ...partial };
    if (partial.firstName != null || partial.lastName != null) {
      nextCustomer.name = [nextCustomer.firstName, nextCustomer.lastName].filter(Boolean).join(' ');
    }
    patchDraft({ customer: nextCustomer });
  }

  function patchExtras(key, value) {
    const nextExtras = { ...draft.extras, [key]: value };
    const next = { ...draft, extras: nextExtras };
    if (key === 'ahk') {
      const ahkId = 'ev4-anhaenger';
      const ids = new Set(next.accessoryIds ?? []);
      if (value) ids.add(ahkId);
      else ids.delete(ahkId);
      next.accessoryIds = [...ids];
    }
    onDraftChange(next);
  }

  function patchBudget(value) {
    if (!value) {
      patchDraft({ desiredRate: null, desiredPrice: null });
      return;
    }
    const amount = Number(value);
    if (isCash) patchDraft({ desiredPrice: amount, desiredRate: null });
    else patchDraft({ desiredRate: amount, desiredPrice: null });
  }

  const paymentOptions = DEALER_AI_PAYMENT_OPTIONS.filter((p) => p.id !== 'unknown');
  const showCustomer = customerContact?.hasContact
    || customer.firstName
    || customer.lastName
    || customer.phone
    || customer.email
    || customer.mailNote;

  return (
    <div className="dai-configure">
      <header className="dai-configure-header">
        {onBack && (
          <button type="button" className="dai-configure-back" onClick={onBack}>
            ← {contextBanner ? 'Zur Kundenakte' : 'Bearbeiten'}
          </button>
        )}
        <h2 className="dai-configure-header__title">Fahrzeug konfigurieren</h2>
        {!showCustomer && contextBanner && (
          <p className="dai-configure-header__customer">{contextBanner}</p>
        )}
      </header>

      {showCustomer && (
        <section className="dai-config-card dai-config-card--customer">
          <h3 className="dai-config-card__title">Kunde</h3>
          {customer.mailNote && (
            <p className="dai-config-customer__note">{customer.mailNote}</p>
          )}
          <div className="dai-config-grid">
            <TextField
              label="Vorname"
              value={customer.firstName ?? customerContact?.firstName ?? ''}
              onChange={(firstName) => patchCustomer({ firstName })}
            />
            <TextField
              label="Nachname"
              value={customer.lastName ?? customerContact?.lastName ?? ''}
              onChange={(lastName) => patchCustomer({ lastName })}
            />
            <TextField
              label="Telefon"
              value={customer.phone ?? customerContact?.phone ?? ''}
              onChange={(phone) => patchCustomer({ phone })}
            />
            <TextField
              label="E-Mail"
              value={customer.email ?? customerContact?.email ?? ''}
              onChange={(email) => patchCustomer({ email })}
            />
          </div>
        </section>
      )}

      <section className="dai-config-card dai-config-card--recommendation">
        <h3 className="dai-config-card__title">Clever Empfehlung</h3>
        {offerPreview.vehicleTitle && (
          <p className="dai-config-offer-title">{offerPreview.vehicleTitle}</p>
        )}
        <div className="dai-config-offer-meta">
          <SelectField
            label="Laufzeit"
            value={draft.termMonths}
            options={DEALER_AI_TERM_OPTIONS}
            onChange={(v) => patchDraft({ termMonths: Number(v) })}
            formatOption={(m) => `${m} Monate`}
            className="dai-config-field--compact"
          />
          <SelectField
            label="Kilometer"
            value={draft.mileagePerYear}
            options={DEALER_AI_MILEAGE_OPTIONS}
            onChange={(v) => patchDraft({ mileagePerYear: Number(v) })}
            formatOption={(m) => `${m.toLocaleString('de-DE')} km`}
            className="dai-config-field--compact"
          />
          <SelectField
            label="Anzahlung"
            value={String(draft.downPayment ?? 0)}
            options={downPaymentOptions}
            onChange={(v) => patchDraft({ downPayment: Number(v) || 0 })}
            className="dai-config-field--compact"
          />
        </div>
        {offerPreview.monthlyRate != null && (
          <p className="dai-config-offer-rate">
            {isCash
              ? formatCurrency(offerPreview.monthlyRate)
              : `${offerPreview.monthlyRate.toLocaleString('de-DE')} €/Monat`}
          </p>
        )}
        {offerPreview.budget?.status !== 'open' && (
          <p className={`dai-config-offer-budget is-${offerPreview.budget.status}`}>
            {offerPreview.budget.icon} {offerPreview.budget.label}
          </p>
        )}
        {alternatives.length > 0 && (
          <div className="dai-config-offer-alternatives">
            {alternatives.map((alt) => (
              <button
                key={alt.id}
                type="button"
                className="dai-config-offer-alt"
                onClick={() => patchDraft(alt.patch)}
              >
                <span className="dai-config-offer-alt__label">{alt.label}</span>
                <span className="dai-config-offer-alt__headline">{alt.headline}</span>
                {alt.monthlyRate != null && (
                  <span className="dai-config-offer-alt__rate">
                    {alt.monthlyRate.toLocaleString('de-DE')} €/Monat
                  </span>
                )}
                {alt.budget?.status !== 'open' && (
                  <span className={`dai-config-offer-alt__budget is-${alt.budget.status}`}>
                    {alt.budget.icon} {alt.budget.label}
                  </span>
                )}
              </button>
            ))}
          </div>
        )}
      </section>

      <section className="dai-config-card dai-config-card--recognized">
        <div className="dai-config-card__head">
          <h3 className="dai-config-card__title">Kundenwunsch erkannt</h3>
          <p className="dai-config-recognized-badge">✓ automatisch erkannt</p>
        </div>
        {vehicleLine && <p className="dai-config-quick-edit__vehicle">{vehicleLine}</p>}
        <div className="dai-config-quick-edit">
          <SelectField
            label="Angebotsart"
            value={draft.paymentType}
            options={paymentOptions}
            onChange={(paymentType) => patchDraft({ paymentType })}
            formatOption={(opt) => PAYMENT_TYPE_LABELS[opt.id] ?? opt.label}
            className="dai-config-field--compact"
          />
          <SelectField
            label="Budget"
            value={budgetValue}
            options={[{ id: '', label: 'offen' }, ...budgetOptions]}
            onChange={patchBudget}
            className="dai-config-field--compact"
          />
        </div>
        <div className="dai-config-quick-edit dai-config-quick-edit--timing">
          <SelectField
            label="Wunschlieferdatum"
            value={draft.desiredDeliveryDate ?? 'offen'}
            options={deliveryOptions}
            onChange={(v) => patchDraft({
              desiredDeliveryDate: v === 'offen' ? null : v,
              immediateAvailability: v === 'sofort' ? true : draft.immediateAvailability,
            })}
            className="dai-config-field--compact"
          />
          <SelectField
            label="Leasingende"
            value={draft.leasingEndDate ?? 'offen'}
            options={[
              { id: 'offen', label: 'offen' },
              ...buildDeliveryDateOptions(draft.leasingEndDate)
                .filter((v) => !['sofort', 'offen', 'diese Woche', 'nächste Woche', 'diesen Monat', 'nächsten Monat'].includes(v))
                .filter((v) => !v.startsWith('vor '))
                .map((v) => ({ id: v, label: v })),
            ]}
            onChange={(v) => patchDraft({ leasingEndDate: v === 'offen' ? null : v })}
            className="dai-config-field--compact"
          />
          <label className="dai-config-check dai-config-check--inline">
            <input
              type="checkbox"
              checked={Boolean(draft.vehicleChangeIntent)}
              onChange={(e) => patchDraft({ vehicleChangeIntent: e.target.checked })}
            />
            Fahrzeugwechsel
          </label>
          <label className="dai-config-check dai-config-check--inline">
            <input
              type="checkbox"
              checked={Boolean(draft.immediateAvailability)}
              onChange={(e) => patchDraft({
                immediateAvailability: e.target.checked,
                desiredDeliveryDate: e.target.checked ? 'sofort' : draft.desiredDeliveryDate,
              })}
            />
            Sofortbedarf
          </label>
        </div>
        <div className="dai-config-framework" aria-label="Erkanntes Wunschprofil">
          <p><span>Wer?</span> {customer.name ?? customerContact?.name ?? 'offen'}</p>
          <p><span>Was?</span> {wishFramework.what}</p>
          <p><span>Wann?</span> {wishFramework.when}</p>
          <p><span>Konditionen?</span> {wishFramework.conditions}</p>
        </div>
      </section>

      <section className="dai-config-card">
        <h3 className="dai-config-card__title">Fahrzeug</h3>
        <div className="dai-config-grid">
          <SelectField
            label="Modell"
            value={draft.modelKey}
            options={[{ id: draft.modelKey, label: draft.model }]}
            onChange={() => {}}
          />
          {draft.options?.trims?.length > 0 && (
            <SelectField
              label="Linie"
              value={draft.trimId}
              options={draft.options.trims}
              onChange={(trimId) => {
                const trim = draft.options.trims.find((t) => t.id === trimId);
                patchDraft({ trimId, trimLabel: trim?.label ?? draft.trimLabel });
              }}
            />
          )}
          {draft.options?.engines?.length > 0 && (
            <SelectField
              label="Batterie"
              value={draft.engineId}
              options={draft.options.engines}
              onChange={(engineId) => {
                const engine = draft.options.engines.find((e) => e.id === engineId);
                patchDraft({
                  engineId,
                  batteryLabel: engine?.label ?? draft.batteryLabel,
                });
              }}
              formatOption={(opt) => {
                const label = typeof opt === 'object' ? opt.label : String(opt);
                return label.includes('kWh') ? label.match(/\d+\s*kWh/i)?.[0] ?? label : label;
              }}
            />
          )}
          {draft.motorLabel && (
            <div className="dai-config-field dai-config-field--static">
              <span className="dai-config-field__label">Motorisierung</span>
              <span className="dai-config-field__value">{draft.motorLabel}</span>
            </div>
          )}
          <SelectField
            label="Farbe"
            value={draft.colorId}
            options={draft.options?.colors ?? []}
            onChange={(colorId) => {
              const color = draft.options.colors.find((c) => c.id === colorId);
              patchDraft({ colorId, colorLabel: color?.label ?? draft.colorLabel });
            }}
          />
        </div>
        {draft.imageUrl && (
          <div className="dai-config-vehicle-image">
            <img src={draft.imageUrl} alt={`${draft.brand} ${draft.model}`} />
          </div>
        )}
      </section>

      <section className="dai-config-card">
        <h3 className="dai-config-card__title">Zusatzwünsche</h3>
        <div className="dai-config-extras">
          <label className="dai-config-check">
            <input
              type="checkbox"
              checked={Boolean(draft.extras?.ahk)}
              onChange={(e) => patchExtras('ahk', e.target.checked)}
            />
            AHK
          </label>
          <label className="dai-config-check">
            <input
              type="checkbox"
              checked={Boolean(draft.extras?.winterraeder)}
              onChange={(e) => patchExtras('winterraeder', e.target.checked)}
            />
            Winterräder
          </label>
          <label className="dai-config-check">
            <input
              type="checkbox"
              checked={Boolean(draft.extras?.wartung)}
              onChange={(e) => patchExtras('wartung', e.target.checked)}
            />
            Wartung
          </label>
          <label className="dai-config-check">
            <input
              type="checkbox"
              checked={Boolean(draft.extras?.versicherung)}
              onChange={(e) => patchExtras('versicherung', e.target.checked)}
            />
            Versicherung
          </label>
        </div>
        {(draft.specialEquipment?.length > 0 || draft.extras?.freeText) && (
          <p className="dai-config-special-equipment">
            Sonderausstattung: {draft.specialEquipment?.join(', ') || draft.extras?.freeText}
          </p>
        )}
        <label className="dai-config-freetext">
          <span className="dai-config-field__label">Freitext</span>
          <textarea
            rows={2}
            value={draft.extras?.freeText ?? ''}
            onChange={(e) => onDraftChange({
              ...draft,
              extras: { ...draft.extras, freeText: e.target.value },
            })}
            placeholder="Sonderwünsche des Kunden …"
          />
        </label>
      </section>

      <div className="dai-config-actions">
        {onSwitchToSearch && (
          <button
            type="button"
            className="dai-config-actions__secondary"
            onClick={onSwitchToSearch}
            disabled={isExecuting}
          >
            Fahrzeugsuche öffnen
          </button>
        )}
        <button
          type="button"
          className="dai-config-actions__primary"
          onClick={onCreateOffer}
          disabled={isExecuting}
        >
          {isExecuting ? 'Wird erstellt …' : 'Angebot erstellen'}
        </button>
      </div>
    </div>
  );
}
