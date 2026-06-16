import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  buildCustomerCardSummary,
  buildHistoryCardSummary,
  buildOfferCardSummary,
  buildOutcomeCardSummary,
  buildShortSubline,
  buildWishCardSummary,
  CALL_OUTCOME_CHIPS,
  computeFollowUpAt,
  FOLLOW_UP_CHIPS,
  formatHistoryWhen,
  getDefaultFollowUpChipId,
  OFFER_STATUS_LABELS,
  phoneTelHref,
  pipelineToLeadStatus,
  toDatetimeLocalValue,
} from '../../services/dealerAiLeadCrm.js';
import {
  DEALER_AI_DELIVERY_DATE_OPTIONS,
  DEALER_AI_PAYMENT_OPTIONS,
  PAYMENT_TYPE_LABELS,
} from '../../services/dealerAiParser.js';
import LeadDetailPanel from './LeadDetailPanel.jsx';

const SHEETS = {
  customer: 'customer',
  wish: 'wish',
  next: 'next',
  offer: 'offer',
  outcome: 'outcome',
  history: 'history',
};

function Field({ label, id, type = 'text', value, onChange, placeholder, inputMode }) {
  return (
    <label className="dai-lead-field" htmlFor={id}>
      <span className="dai-lead-field__label">{label}</span>
      {type === 'textarea' ? (
        <textarea
          id={id}
          className="dai-lead-field__input dai-lead-field__input--area"
          rows={2}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
        />
      ) : (
        <input
          id={id}
          type={type}
          inputMode={inputMode}
          className="dai-lead-field__input"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
        />
      )}
    </label>
  );
}

function SummaryCard({ title, summary, onClick }) {
  return (
    <button type="button" className="dai-vc-card" onClick={onClick}>
      <div className="dai-vc-card__main">
        <span className="dai-vc-card__title">{title}</span>
        <span className="dai-vc-card__summary">{summary}</span>
      </div>
      <span className="dai-vc-card__chev" aria-hidden>›</span>
    </button>
  );
}

function SheetFooter({ onCancel, onSave, saving, saveLabel = 'Speichern' }) {
  return (
    <div className="dai-sheet-actions">
      {onCancel && (
        <button type="button" className="dai-btn dai-btn--ghost" onClick={onCancel}>
          Abbrechen
        </button>
      )}
      <button type="button" className="dai-btn dai-btn--primary" onClick={onSave} disabled={saving}>
        {saving ? 'Speichern …' : saveLabel}
      </button>
    </div>
  );
}

export default function DealerAiLeadFollowUp({
  result,
  parsed,
  lead,
  onSave,
  onPrepareOffer,
  onDiscard,
  onAddHistory,
  isSaving = false,
}) {
  const fields = parsed?.fields ?? {};
  const crm = lead?.crm ?? {};

  const [activeSheet, setActiveSheet] = useState(null);
  const [createdFlash, setCreatedFlash] = useState(true);

  useEffect(() => {
    if (!createdFlash) return undefined;
    const timer = setTimeout(() => setCreatedFlash(false), 3200);
    return () => clearTimeout(timer);
  }, [createdFlash]);

  const [name, setName] = useState(lead?.contact?.name?.replace('Kunde (offen)', '') ?? fields.customerName ?? '');
  const [phone, setPhone] = useState(lead?.contact?.phone ?? '');
  const [email, setEmail] = useState(lead?.contact?.email ?? '');
  const [note, setNote] = useState(lead?.notes ?? parsed?.shortForm ?? '');

  const [wishModel, setWishModel] = useState(lead?.vehicle?.model ?? fields.model ?? '');
  const [wishTrim, setWishTrim] = useState(lead?.vehicle?.trim ?? fields.trimLabel ?? '');
  const [wishPaymentType, setWishPaymentType] = useState(lead?.paymentType ?? fields.paymentType ?? 'unknown');
  const [wishDesiredPrice, setWishDesiredPrice] = useState(
    lead?.wish?.desiredPrice ?? fields.desiredPrice ?? '',
  );
  const [wishDesiredRate, setWishDesiredRate] = useState(
    lead?.desiredRate ?? fields.desiredRate ?? '',
  );
  const [wishTermMonths, setWishTermMonths] = useState(lead?.wish?.termMonths ?? fields.termMonths ?? '');
  const [wishMileage, setWishMileage] = useState(lead?.wish?.mileagePerYear ?? fields.mileagePerYear ?? '');
  const [wishDelivery, setWishDelivery] = useState(
    lead?.deliveryTime ?? fields.desiredDeliveryDate ?? fields.deliveryTime ?? '',
  );
  const [wishEquipment, setWishEquipment] = useState(
    lead?.wish?.equipment ?? fields.trimLabel ?? '',
  );

  const [nextStepId, setNextStepId] = useState(crm.nextStepId ?? getDefaultFollowUpChipId());
  const [followUpAt, setFollowUpAt] = useState(
    crm.followUpAt ?? computeFollowUpAt(getDefaultFollowUpChipId()),
  );
  const [pipelineStatusId, setPipelineStatusId] = useState(crm.pipelineStatusId ?? 'neu');
  const [outcomeId, setOutcomeId] = useState(crm.lastOutcomeId ?? null);
  const [outcomeNote, setOutcomeNote] = useState('');

  const history = useMemo(
    () => [...(lead?.history ?? [])].sort((a, b) => new Date(b.at) - new Date(a.at)),
    [lead?.history],
  );

  const telHref = phoneTelHref(phone);
  const offers = crm.offers ?? [];

  const wishSummaryFields = useMemo(() => ({
    brand: fields.brand ?? 'Kia',
    model: wishModel,
    trimLabel: wishTrim,
    paymentType: wishPaymentType,
    desiredPrice: wishDesiredPrice ? Number(wishDesiredPrice) : null,
    desiredRate: wishDesiredRate ? Number(wishDesiredRate) : null,
  }), [fields.brand, wishModel, wishTrim, wishPaymentType, wishDesiredPrice, wishDesiredRate]);

  const subline = buildShortSubline({
    brand: fields.brand ?? 'Kia',
    model: wishModel,
    trimLabel: wishTrim,
    paymentType: wishPaymentType,
  });

  const nextStepLabel = FOLLOW_UP_CHIPS.find((c) => c.id === nextStepId)?.label ?? 'Morgen anrufen';

  const outcomeSummaryCrm = useMemo(() => ({
    lastOutcomeLabel: crm.lastOutcomeLabel
      ?? CALL_OUTCOME_CHIPS.find((c) => c.id === outcomeId)?.label
      ?? null,
  }), [crm.lastOutcomeLabel, outcomeId]);

  function closeSheet() {
    setActiveSheet(null);
  }

  function openSheet(id) {
    setActiveSheet(id);
  }

  function selectFollowUp(chip) {
    setNextStepId(chip.id);
    setFollowUpAt(computeFollowUpAt(chip.id));
  }

  function buildSavePayload(extraCrm = {}) {
    const nextLabel = FOLLOW_UP_CHIPS.find((c) => c.id === nextStepId)?.label ?? nextStepLabel;
    const outcomeChip = CALL_OUTCOME_CHIPS.find((c) => c.id === outcomeId);
    const vehicleLabel = [fields.brand ?? 'Kia', wishModel, wishTrim].filter(Boolean).join(' ').trim();

    return {
      contact: {
        name: name.trim() || 'Kunde (offen)',
        phone: phone.trim(),
        email: email.trim(),
      },
      notes: note.trim(),
      status: pipelineToLeadStatus(pipelineStatusId),
      vehicle: {
        brand: fields.brand ?? 'Kia',
        model: wishModel,
        trim: wishTrim,
        label: vehicleLabel || 'Kia – Modell offen',
      },
      paymentType: wishPaymentType,
      desiredRate: wishDesiredRate ? Number(wishDesiredRate) : null,
      deliveryTime: wishDelivery,
      wish: {
        termMonths: wishTermMonths ? Number(wishTermMonths) : null,
        mileagePerYear: wishMileage ? Number(wishMileage) : null,
        desiredPrice: wishDesiredPrice ? Number(wishDesiredPrice) : null,
        equipment: wishEquipment.trim(),
      },
      crm: {
        ...crm,
        pipelineStatusId,
        nextStepId,
        nextStepLabel: nextLabel,
        followUpAt,
        reservedModels: crm.reservedModels ?? [],
        offers: crm.offers ?? [],
        lastOutcomeId: outcomeId ?? crm.lastOutcomeId,
        lastOutcomeLabel: outcomeChip?.label ?? crm.lastOutcomeLabel,
        ...extraCrm,
      },
    };
  }

  function save(meta = {}) {
    onSave?.(buildSavePayload(), meta);
    if (meta.flash !== false) {
      setCreatedFlash(false);
    }
  }

  function saveCustomerSheet() {
    save({ historyText: 'Kunde gespeichert', addFollowupHistory: false });
    closeSheet();
  }

  function saveWishSheet() {
    save({ historyText: 'Wunsch gespeichert', addFollowupHistory: false });
    closeSheet();
  }

  function saveNextSheet() {
    save({
      historyText: `Nachfassen geplant: ${nextStepLabel}`,
      historyType: 'followup',
      addFollowupHistory: false,
    });
    closeSheet();
  }

  function saveOutcomeSheet() {
    const chip = CALL_OUTCOME_CHIPS.find((c) => c.id === outcomeId);
    if (chip) {
      const text = chip.label + (outcomeNote.trim() ? ` · ${outcomeNote.trim()}` : '');
      onAddHistory?.(text, 'call', { pipelineStatusId: chip.statusId });
      setPipelineStatusId(chip.statusId);
      onSave?.(buildSavePayload({
        lastOutcomeId: chip.id,
        lastOutcomeLabel: chip.label,
        pipelineStatusId: chip.statusId,
      }), { silent: true, addFollowupHistory: false });
    } else if (outcomeNote.trim()) {
      onAddHistory?.(outcomeNote.trim(), 'note');
    }
    setOutcomeNote('');
    closeSheet();
  }

  function saveAll() {
    save({ historyText: 'Gespeichert', addFollowupHistory: false });
  }

  return (
    <section className="dai-lead-followup" aria-labelledby="dai-lead-followup-title">
      {createdFlash && (
        <p className="dai-lead-created-flash" role="status">
          Verkaufschance angelegt
        </p>
      )}

      <header className="dai-lead-head">
        <h2 id="dai-lead-followup-title" className="dai-lead-head__title">Verkaufschance</h2>
        <p className="dai-lead-head__subline">{subline}</p>
        <span className="dai-lead-head__badge">Neu</span>
        {result?.leadId && (
          <Link to="/backend/verkaufschancen" className="dai-link dai-lead-head__link">
            In Verkaufschancen öffnen
          </Link>
        )}
      </header>

      <div className="dai-vc-cards">
        <SummaryCard
          title="Kunde"
          summary={buildCustomerCardSummary(name, phone)}
          onClick={() => openSheet(SHEETS.customer)}
        />
        <SummaryCard
          title="Wunsch"
          summary={buildWishCardSummary(wishSummaryFields)}
          onClick={() => openSheet(SHEETS.wish)}
        />
        <SummaryCard
          title="Nächster Schritt"
          summary={nextStepLabel}
          onClick={() => openSheet(SHEETS.next)}
        />
        <SummaryCard
          title="Angebot"
          summary={buildOfferCardSummary(offers)}
          onClick={() => openSheet(SHEETS.offer)}
        />
        <SummaryCard
          title="Ergebnis"
          summary={buildOutcomeCardSummary(outcomeSummaryCrm)}
          onClick={() => openSheet(SHEETS.outcome)}
        />
        <SummaryCard
          title="Verlauf"
          summary={buildHistoryCardSummary(history.length)}
          onClick={() => openSheet(SHEETS.history)}
        />
      </div>

      <div className="dai-vc-bar" role="toolbar" aria-label="Schnellaktionen">
        {telHref ? (
          <a href={telHref} className="dai-vc-bar__btn dai-vc-bar__btn--call">
            Anrufen
          </a>
        ) : (
          <button type="button" className="dai-vc-bar__btn" onClick={() => openSheet(SHEETS.customer)}>
            Kunde
          </button>
        )}
        <button type="button" className="dai-vc-bar__btn" onClick={() => openSheet(SHEETS.offer)}>
          Angebot
        </button>
        <button
          type="button"
          className="dai-vc-bar__btn dai-vc-bar__btn--primary"
          onClick={saveAll}
          disabled={isSaving}
        >
          {isSaving ? '…' : 'Speichern'}
        </button>
      </div>

      <button type="button" className="dai-lead-later" onClick={onDiscard}>
        Später
      </button>

      {/* ── Kunde ── */}
      <LeadDetailPanel
        open={activeSheet === SHEETS.customer}
        onClose={closeSheet}
        title="Kunde"
        footer={(
          <SheetFooter onCancel={closeSheet} onSave={saveCustomerSheet} saving={isSaving} />
        )}
      >
        <div className="dai-lead-form">
          <Field label="Name" id="lead-name" value={name} onChange={setName} placeholder="Max Müller" />
          <Field
            label="Telefon"
            id="lead-phone"
            type="tel"
            inputMode="tel"
            value={phone}
            onChange={setPhone}
            placeholder="0170 1234567"
          />
          <Field
            label="E-Mail"
            id="lead-email"
            type="email"
            value={email}
            onChange={setEmail}
            placeholder="kunde@beispiel.de"
          />
          <Field
            label="Notiz"
            id="lead-note"
            type="textarea"
            value={note}
            onChange={setNote}
            placeholder="Kurz notieren"
          />
          {telHref && (
            <a href={telHref} className="dai-btn dai-btn--call dai-btn--block">
              Anrufen
            </a>
          )}
        </div>
      </LeadDetailPanel>

      {/* ── Wunsch ── */}
      <LeadDetailPanel
        open={activeSheet === SHEETS.wish}
        onClose={closeSheet}
        title="Wunsch"
        footer={<SheetFooter onCancel={closeSheet} onSave={saveWishSheet} saving={isSaving} />}
      >
        <div className="dai-lead-form">
          <Field
            label="Fahrzeug / Modell"
            id="lead-wish-model"
            value={wishModel}
            onChange={setWishModel}
            placeholder="z. B. EV5 Earth"
          />
          <label className="dai-lead-field" htmlFor="lead-wish-payment">
            <span className="dai-lead-field__label">Angebotsart</span>
            <select
              id="lead-wish-payment"
              className="dai-lead-field__input"
              value={wishPaymentType}
              onChange={(e) => setWishPaymentType(e.target.value)}
            >
              {DEALER_AI_PAYMENT_OPTIONS.map((id) => (
                <option key={id} value={id}>{PAYMENT_TYPE_LABELS[id]}</option>
              ))}
            </select>
          </label>
          {wishPaymentType === 'cash' ? (
            <Field
              label="Budget"
              id="lead-wish-price"
              type="number"
              inputMode="numeric"
              value={wishDesiredPrice}
              onChange={setWishDesiredPrice}
              placeholder="40000"
            />
          ) : (
            <Field
              label="Rate"
              id="lead-wish-rate"
              type="number"
              inputMode="numeric"
              value={wishDesiredRate}
              onChange={setWishDesiredRate}
              placeholder="299"
            />
          )}
          <Field
            label="Laufzeit"
            id="lead-wish-term"
            type="number"
            inputMode="numeric"
            value={wishTermMonths}
            onChange={setWishTermMonths}
            placeholder="48 Monate"
          />
          <Field
            label="Kilometer"
            id="lead-wish-km"
            type="number"
            inputMode="numeric"
            value={wishMileage}
            onChange={setWishMileage}
            placeholder="15000 / Jahr"
          />
          <label className="dai-lead-field" htmlFor="lead-wish-delivery">
            <span className="dai-lead-field__label">Übergabe</span>
            <select
              id="lead-wish-delivery"
              className="dai-lead-field__input"
              value={wishDelivery}
              onChange={(e) => setWishDelivery(e.target.value)}
            >
              <option value="">—</option>
              {DEALER_AI_DELIVERY_DATE_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
          </label>
          <Field
            label="Ausstattung"
            id="lead-wish-equipment"
            value={wishEquipment}
            onChange={setWishEquipment}
            placeholder="z. B. Earth, Panorama"
          />
        </div>
      </LeadDetailPanel>

      {/* ── Nächster Schritt ── */}
      <LeadDetailPanel
        open={activeSheet === SHEETS.next}
        onClose={closeSheet}
        title="Nächster Schritt"
        footer={<SheetFooter onCancel={closeSheet} onSave={saveNextSheet} saving={isSaving} />}
      >
        <div className="dai-lead-chips dai-lead-chips--large" role="group" aria-label="Nächster Schritt">
          {FOLLOW_UP_CHIPS.map((chip) => (
            <button
              key={chip.id}
              type="button"
              className={`dai-lead-chip dai-lead-chip--large${nextStepId === chip.id ? ' is-active' : ''}`}
              onClick={() => selectFollowUp(chip)}
              aria-pressed={nextStepId === chip.id}
            >
              {chip.label}
            </button>
          ))}
        </div>
        <label className="dai-lead-field" htmlFor="lead-followup-at">
          <span className="dai-lead-field__label">Datum / Uhrzeit</span>
          <input
            id="lead-followup-at"
            type="datetime-local"
            className="dai-lead-field__input"
            value={toDatetimeLocalValue(followUpAt)}
            onChange={(e) => setFollowUpAt(new Date(e.target.value).toISOString())}
          />
        </label>
      </LeadDetailPanel>

      {/* ── Angebot ── */}
      <LeadDetailPanel
        open={activeSheet === SHEETS.offer}
        onClose={closeSheet}
        title="Angebot"
        footer={offers.length === 0 ? (
          <button type="button" className="dai-btn dai-btn--ghost" onClick={closeSheet}>
            Schließen
          </button>
        ) : null}
      >
        {offers.length === 0 ? (
          <div className="dai-lead-empty">
            <p>Noch kein Angebot</p>
            <div className="dai-lead-empty__actions">
              <button type="button" className="dai-btn dai-btn--primary" onClick={() => { closeSheet(); onPrepareOffer?.(); }}>
                Angebot erstellen
              </button>
              <button type="button" className="dai-btn dai-btn--secondary" disabled title="Bald verfügbar">
                Angebot hochladen
              </button>
              <button type="button" className="dai-btn dai-btn--ghost" disabled title="Bald verfügbar">
                Link vorbereiten
              </button>
            </div>
          </div>
        ) : (
          <ul className="dai-lead-offers">
            {offers.map((offer) => (
              <li key={offer.id} className="dai-lead-offer-card">
                <p className="dai-lead-offer-card__name">{offer.name}</p>
                <p className="dai-lead-offer-card__meta">
                  {[offer.vehicle, offer.paymentType, OFFER_STATUS_LABELS[offer.status] ?? offer.status]
                    .filter(Boolean)
                    .join(' · ')}
                </p>
                <div className="dai-lead-offer-card__actions">
                  <button type="button" className="dai-btn dai-btn--secondary">Öffnen</button>
                  <button type="button" className="dai-btn dai-btn--ghost">Link kopieren</button>
                  <button type="button" className="dai-btn dai-btn--ghost">Senden</button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </LeadDetailPanel>

      {/* ── Ergebnis ── */}
      <LeadDetailPanel
        open={activeSheet === SHEETS.outcome}
        onClose={closeSheet}
        title="Ergebnis"
        footer={<SheetFooter onCancel={closeSheet} onSave={saveOutcomeSheet} saving={isSaving} />}
      >
        <div className="dai-lead-chips dai-lead-chips--large dai-lead-chips--wrap" role="group" aria-label="Ergebnis">
          {CALL_OUTCOME_CHIPS.map((chip) => (
            <button
              key={chip.id}
              type="button"
              className={`dai-lead-chip dai-lead-chip--large dai-lead-chip--outcome${outcomeId === chip.id ? ' is-active' : ''}`}
              onClick={() => setOutcomeId(chip.id)}
              aria-pressed={outcomeId === chip.id}
            >
              {chip.label}
            </button>
          ))}
        </div>
        <Field
          label="Kurze Notiz"
          id="lead-outcome-note"
          type="textarea"
          value={outcomeNote}
          onChange={setOutcomeNote}
          placeholder="Optional"
        />
      </LeadDetailPanel>

      {/* ── Verlauf ── */}
      <LeadDetailPanel
        open={activeSheet === SHEETS.history}
        onClose={closeSheet}
        title="Verlauf"
        footer={(
          <button type="button" className="dai-btn dai-btn--ghost" onClick={closeSheet}>
            Schließen
          </button>
        )}
      >
        {history.length === 0 ? (
          <p className="dai-lead-empty">Noch keine Einträge.</p>
        ) : (
          <ul className="dai-lead-history dai-lead-history--timeline">
            {history.map((entry) => (
              <li key={entry.id} className="dai-lead-history__item">
                <span className="dai-lead-history__when">{formatHistoryWhen(entry.at)}</span>
                <span className="dai-lead-history__text">{entry.text}</span>
              </li>
            ))}
          </ul>
        )}
      </LeadDetailPanel>
    </section>
  );
}
