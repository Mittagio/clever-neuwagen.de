import { useMemo, useState, useEffect, useRef } from 'react';
import { PAYMENT_TYPE_LABELS } from '../../services/dealerAiParser.js';
import { resolveConfigureHeroImage } from '../../services/dealerAiVehicleConfigureFlow.js';
import PkwEnVkvBox from '../compliance/PkwEnVkvBox.jsx';
import {
  ENVKV_CHANNEL,
  buildDefaultNewPassengerCarRef,
  requiresPkwEnVkv,
} from '../../services/vehicle/requiresPkwEnVkv.js';
import { buildVehicleRefFromOfferContext } from '../../services/vehicle/pkwEnVkvPublishGate.js';
import { buildPkwEnVkvCompactLines } from '../../services/vehicle/pkwEnVkvPresentation.js';
import { resolveVehicleEnvironmentalData } from '../../services/vehicle/vehicleEnvironmentalData.js';
import {
  evaluateSellerConfirmGate,
  PDF_CONFIRM_FIELDS,
  resolveLowConfidenceFields,
  buildHighConfidenceConfirmedMap,
} from '../../services/dealer/sellerOfferConfirmGate.js';
import {
  assessCommercialPlausibility,
  formatEuroDe,
  parseGermanMoney,
} from '../../services/dealer/parseGermanMoney.js';
import {
  FlowCard,
  FlowGhostButton,
  FlowPriceDetails,
  FlowPrimaryButton,
  FlowSectionHeader,
  FlowStickyFooter,
  OfferFlowLayout,
} from './flow/OfferFlowComponents.jsx';
import './DealerAiOfferPreview.css';

function formatCurrency(amount) {
  if (amount == null) return '–';
  return `${Number(amount).toLocaleString('de-DE')} €`;
}

function collectPackagesAndExtras(vehicleConfiguration, payment) {
  const items = [];
  for (const pkg of vehicleConfiguration?.selectedPackages ?? []) {
    items.push(pkg.name);
  }
  for (const acc of vehicleConfiguration?.accessories ?? []) {
    items.push(acc.name);
  }
  for (const extra of vehicleConfiguration?.dealerExtras ?? []) {
    items.push(extra.name);
  }
  if (payment?.towBar) items.push('Anhängerkupplung');
  if (payment?.winterWheels) items.push('Winterräder');
  if (payment?.maintenance) items.push('Wartung');
  if (payment?.insurance) items.push('Versicherung');
  return [...new Set(items)];
}

const OFFER_TYPE_OPTIONS = [
  { value: 'leasing', label: 'Leasing' },
  { value: 'financing', label: 'Finanzierung' },
  { value: 'cash', label: 'Barkauf' },
];

const FIELD_LABELS = {
  monthlyRate: 'Monatliche Rate',
  downPayment: 'Sonderzahlung',
  termMonths: 'Laufzeit',
  annualMileage: 'Fahrleistung',
  transferFee: 'Überführung',
  offerType: 'Angebotsart',
};

function buildInitialConfirmValues(offerDraft) {
  const recognized = offerDraft?.sellerConfirm?.recognized ?? {};
  return {
    monthlyRate: offerDraft?.payment?.calculatedRate ?? recognized.monthlyRate ?? null,
    downPayment: offerDraft?.payment?.downPayment ?? recognized.downPayment ?? null,
    termMonths: offerDraft?.payment?.termMonths ?? recognized.termMonths ?? null,
    annualMileage: offerDraft?.payment?.mileagePerYear ?? recognized.annualMileage ?? null,
    transferFee: offerDraft?.payment?.transferCost ?? recognized.transferFee ?? null,
    offerType: offerDraft?.payment?.type ?? recognized.offerType ?? 'leasing',
  };
}

function parseFieldInput(field, rawValue) {
  if (field === 'offerType') return String(rawValue || '');
  if (rawValue === '' || rawValue == null) return null;
  const asGerman = parseGermanMoney(rawValue);
  if (asGerman != null) return asGerman;
  const n = Number(String(rawValue).replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

function formatConfirmDisplayValue(field, value) {
  if (value == null || value === '') return '–';
  if (field === 'offerType') return PAYMENT_TYPE_LABELS[value] ?? String(value);
  if (field === 'termMonths') {
    return `${Number(value).toLocaleString('de-DE')} Monate`;
  }
  if (field === 'annualMileage') {
    return `${Number(value).toLocaleString('de-DE')} km/Jahr`;
  }
  return formatEuroDe(Number(value));
}

function buildHeroMetaParts(draftValues, isCash) {
  const parts = [];
  if (draftValues.termMonths != null && !isCash) {
    parts.push(`${Number(draftValues.termMonths).toLocaleString('de-DE')} Monate`);
  }
  if (draftValues.annualMileage != null && !isCash) {
    parts.push(`${Number(draftValues.annualMileage).toLocaleString('de-DE')} km/Jahr`);
  }
  if (draftValues.downPayment != null && Number(draftValues.downPayment) > 0) {
    parts.push(`${formatEuroDe(Number(draftValues.downPayment))} Sonderzahlung`);
  }
  return parts;
}

function StatusIcon({ status }) {
  if (status === 'ok') {
    return (
      <span className="dai-opreview-status dai-opreview-status--ok" aria-label="Bestätigt">
        ✓
      </span>
    );
  }
  if (status === 'warn') {
    return (
      <span className="dai-opreview-status dai-opreview-status--warn" aria-label="Bitte prüfen">
        !
      </span>
    );
  }
  return (
    <span className="dai-opreview-status dai-opreview-status--pending" aria-label="Noch nicht geprüft" />
  );
}

/** Schritt 3 – Angebotsvorschau (+ PDF-Confirm/Edit) */
export default function DealerAiOfferPreview({
  offerDraft,
  onBack,
  onSave,
  onPreparePdfLink,
  onFinish,
  onCommercialChange,
  isSaving = false,
  isSaved = false,
}) {
  const [savePending, setSavePending] = useState(false);
  const sellerConfirm = offerDraft?.sellerConfirm;
  const requireConfirm = Boolean(sellerConfirm?.required) && !isSaved;
  const recognized = sellerConfirm?.recognized ?? {};
  const fromPdf = offerDraft?.source?.createdFrom === 'magic_offer_pdf'
    || Boolean(sellerConfirm?.required);

  const [draftValues, setDraftValues] = useState(() => buildInitialConfirmValues(offerDraft));
  const [confirmed, setConfirmed] = useState({});
  const [edited, setEdited] = useState({});
  const [centralConfirmed, setCentralConfirmed] = useState(false);
  const [editingField, setEditingField] = useState(null);
  const [editMode, setEditMode] = useState(false);
  const firstRowRef = useRef(null);
  const editInputRef = useRef(null);

  const draftKey = [
    offerDraft?.source?.originalPdf?.fileName ?? '',
    offerDraft?.source?.createdFrom ?? '',
    offerDraft?.payment?.calculatedRate ?? '',
    requireConfirm ? '1' : '0',
  ].join('|');

  useEffect(() => {
    if (!offerDraft || isSaved) return;
    setDraftValues(buildInitialConfirmValues(offerDraft));
    setConfirmed({});
    setEdited({});
    setCentralConfirmed(false);
    setEditingField(null);
    setEditMode(false);
  }, [draftKey, isSaved, offerDraft]);

  useEffect(() => {
    if (editingField && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select?.();
    }
  }, [editingField]);

  const interpretation = sellerConfirm?.offerInterpretation ?? null;
  const confidence = interpretation?.confidence ?? {};
  const ambiguities = sellerConfirm?.ambiguities ?? [];
  const evidence = sellerConfirm?.evidence ?? {};

  const livePlausibility = useMemo(
    () => assessCommercialPlausibility({
      monthlyRate: draftValues.monthlyRate,
      downPayment: draftValues.downPayment,
      vehiclePrice: offerDraft?.offerPreview?.uvpConfigurationPrice
        ?? offerDraft?.offerCalculation?.housePrice
        ?? null,
      offerType: draftValues.offerType,
    }),
    [draftValues, offerDraft],
  );

  const lowConfidenceFields = useMemo(
    () => resolveLowConfidenceFields({
      confidence,
      ambiguities,
      plausibilityFlags: {
        ...(sellerConfirm?.plausibilityFlags ?? {}),
        ...(livePlausibility.flags ?? {}),
      },
      values: draftValues,
    }),
    [confidence, ambiguities, sellerConfirm?.plausibilityFlags, livePlausibility.flags, draftValues],
  );

  const lowConfidenceSet = useMemo(() => new Set(lowConfidenceFields), [lowConfidenceFields]);

  const gate = useMemo(
    () => evaluateSellerConfirmGate({
      confirmed,
      edited,
      values: draftValues,
      centralConfirmed,
      lowConfidenceFields,
    }),
    [confirmed, edited, draftValues, centralConfirmed, lowConfidenceFields],
  );

  const warnings = useMemo(() => {
    const fromExtract = sellerConfirm?.warnings ?? [];
    const live = livePlausibility.warnings ?? [];
    return [...new Set([...fromExtract, ...live])].filter((w) => !String(w).startsWith('missing_evidence:'));
  }, [sellerConfirm?.warnings, livePlausibility.warnings]);

  const vehicle = offerDraft?.vehicle ?? {};
  const vehicleConfiguration = offerDraft?.vehicleConfiguration;
  const payment = offerDraft?.payment ?? {};
  const customer = offerDraft?.customer ?? {};
  const offerCalculation = offerDraft?.offerCalculation ?? {};
  const offerPreview = offerDraft?.offerPreview ?? {};

  const heroImage = useMemo(() => resolveConfigureHeroImage({
    modelKey: vehicle.modelKey,
    colorId: vehicle.colorId ?? vehicleConfiguration?.colorId,
    trimId: vehicle.trimId ?? vehicleConfiguration?.trimId,
  }), [vehicle.modelKey, vehicle.colorId, vehicle.trimId, vehicleConfiguration?.colorId, vehicleConfiguration?.trimId]);

  const activeOfferType = requireConfirm ? draftValues.offerType : payment.type;
  const envkvVehicleRef = useMemo(() => buildVehicleRefFromOfferContext({
    modelKey: vehicle?.modelKey ?? vehicleConfiguration?.modelKey,
    trimId: vehicle?.trimId ?? vehicleConfiguration?.trimId,
    engineId: vehicle?.engineId ?? vehicleConfiguration?.engineId,
    brand: vehicleConfiguration?.brand ?? vehicle?.brand,
    model: vehicle?.model ?? vehicleConfiguration?.model,
    trimLabel: vehicleConfiguration?.trimLabel ?? vehicle?.trimLabel,
    paymentType: activeOfferType,
    isNewPassengerCar: vehicle?.isNewPassengerCar,
    mileageKm: vehicle?.mileageKm ?? vehicle?.mileage,
    vehicleState: vehicle?.vehicleState,
    registrationDate: vehicle?.registrationDate,
    envkvExempt: vehicle?.envkvExempt,
  }), [vehicle, vehicleConfiguration, activeOfferType]);

  const envkvSummary = useMemo(() => {
    const ref = buildDefaultNewPassengerCarRef(envkvVehicleRef ?? {});
    if (!requiresPkwEnVkv(ref, { channel: ENVKV_CHANNEL.OFFER, paymentType: ref.paymentType })) {
      return null;
    }
    const envData = resolveVehicleEnvironmentalData(ref);
    if (!envData?.publishable) return { missing: true, line: null };
    const lines = buildPkwEnVkvCompactLines(envData);
    const parts = lines.map((row) => row.value).filter(Boolean);
    return { missing: false, line: parts.join(' · ') };
  }, [envkvVehicleRef]);

  if (!offerDraft) return null;

  const preview = offerPreview;
  const calculation = offerCalculation;

  const vehicleMainLine = [
    vehicleConfiguration?.model ?? vehicle?.model,
    vehicleConfiguration?.trimLabel ?? vehicle?.trimLabel,
  ]
    .filter(Boolean)
    .join(' ');
  const vehicleMotorLine = vehicleConfiguration?.motorLabel
    ?? vehicleConfiguration?.batteryLabel
    ?? vehicle?.battery
    ?? null;
  const colorLabel = vehicleConfiguration?.colorLabel ?? vehicle?.color ?? null;

  const uvpTotal = preview.uvpConfigurationPrice
    ?? vehicleConfiguration?.uvpConfigurationPrice
    ?? vehicle?.uvpConfigurationPrice
    ?? null;

  const discountPercent = preview.discountPercent ?? calculation.discountPercent ?? null;
  const discountAmount = preview.discountAmount ?? calculation.discountAmount ?? null;
  const housePrice = preview.housePrice ?? calculation.housePrice ?? null;
  const transferCost = requireConfirm
    ? (draftValues.transferFee ?? payment.transferCost ?? calculation.preparationFee ?? null)
    : (payment.transferCost ?? calculation.preparationFee ?? null);

  const isCash = activeOfferType === 'cash';
  const isLeasing = activeOfferType === 'leasing';
  const isFinance = activeOfferType === 'financing' || activeOfferType === 'threeWayFinancing';

  const calculatedRate = requireConfirm
    ? (draftValues.monthlyRate ?? payment.calculatedRate ?? preview.monthlyRate ?? calculation.monthlyRate ?? null)
    : (payment.calculatedRate ?? preview.monthlyRate ?? calculation.monthlyRate ?? null);
  const offerPrice = isCash
    ? (calculatedRate ?? (housePrice != null && transferCost != null ? housePrice + transferCost : null))
    : calculatedRate;

  const savings = discountAmount
    ?? (uvpTotal != null && housePrice != null ? uvpTotal - housePrice : null);

  const paymentLabel = PAYMENT_TYPE_LABELS[activeOfferType] ?? activeOfferType;
  const packageItems = collectPackagesAndExtras(vehicleConfiguration, payment);
  const showPackages = packageItems.length > 0;
  const hasCustomer = Boolean(customer.name || customer.phone || customer.email);
  const saved = isSaved;

  const heroBadges = [];
  if (isCash && discountPercent != null) {
    heroBadges.push({ label: `${discountPercent} % Rabatt`, tone: 'discount' });
  }
  if (isCash && savings != null && savings > 0) {
    heroBadges.push({ label: `${formatCurrency(savings)} Ersparnis`, tone: 'savings' });
  }

  const rateImplausible = livePlausibility.flags?.monthlyRateImplausible
    || sellerConfirm?.plausibilityFlags?.monthlyRateImplausible;

  const heroMetaParts = requireConfirm
    ? buildHeroMetaParts(draftValues, isCash)
    : buildHeroMetaParts({
      termMonths: payment.termMonths,
      annualMileage: payment.mileagePerYear,
      downPayment: payment.downPayment,
    }, isCash);

  const missingCount = gate.missing.length;
  const canRelease = !requireConfirm || gate.canSave;

  function fieldStatus(field) {
    if (confirmed[field]) return 'ok';
    if (lowConfidenceSet.has(field)) return 'warn';
    if (centralConfirmed) return 'ok';
    return 'pending';
  }

  function updateField(field, rawValue) {
    const next = parseFieldInput(field, rawValue);
    setDraftValues((prev) => ({ ...prev, [field]: next }));
    setEdited((prev) => ({ ...prev, [field]: true }));
    setConfirmed((prev) => ({ ...prev, [field]: true }));
    onCommercialChange?.({ [field]: next });
  }

  function handleCentralConfirm() {
    const highOk = buildHighConfidenceConfirmedMap(PDF_CONFIRM_FIELDS, lowConfidenceFields);
    setConfirmed((prev) => ({ ...prev, ...highOk }));
    setCentralConfirmed(true);
    setEditMode(false);
    setEditingField(null);
    // If low-confidence remains, focus the first one for attention
    const firstLow = lowConfidenceFields[0];
    if (firstLow) {
      setEditingField(firstLow);
      setEditMode(true);
    }
  }

  function handleEnableEdit() {
    setEditMode(true);
    const target = lowConfidenceFields[0] ?? PDF_CONFIRM_FIELDS[0];
    setEditingField(target);
    requestAnimationFrame(() => {
      firstRowRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'center' });
    });
  }

  function openInlineEdit(field) {
    if (saved) return;
    setEditMode(true);
    setEditingField(field);
  }

  function closeInlineEdit() {
    setEditingField(null);
  }

  async function handleSaveClick() {
    if (saved || savePending || isSaving) return;
    if (requireConfirm && !gate.canSave) return;
    setSavePending(true);
    try {
      if (requireConfirm && onCommercialChange) {
        onCommercialChange(draftValues);
      }
      const ok = await onSave?.();
      if (ok === false) return;
    } finally {
      setSavePending(false);
    }
  }

  const subtitle = requireConfirm
    ? (fromPdf
      ? 'Von Clever aus dem PDF vorbereitet'
      : 'Clever hat die Konditionen vorbereitet – einmal prüfen und freigeben.')
    : 'Prüfen und Angebot freigeben.';

  const customerSaveLine = customer.name
    ? `Wird in der Kundenakte von ${customer.name} gespeichert.`
    : 'Wird in der Kundenakte gespeichert.';

  const offerTypeAmbiguity = ambiguities.find((a) => a.field === 'offerType');
  const showOfferTypeCallout = requireConfirm
    && lowConfidenceSet.has('offerType')
    && !confirmed.offerType;

  return (
    <OfferFlowLayout
      className="dai-offer-preview"
      backLabel={!saved ? '← Zurück' : null}
      onBack={!saved ? onBack : null}
      title="Angebotsvorschau"
      subtitle={subtitle}
    >
      {/* 1. Hero offer card */}
      <section
        className={`dai-opreview-hero-card${requireConfirm ? ' dai-opreview-hero-card--glow' : ''}`}
        aria-label="Fahrzeug und Preis"
      >
        <div className="dai-opreview-hero-card__vehicle">
          <p className="dai-opreview-hero-card__model">{vehicleMainLine || '–'}</p>
          {vehicleMotorLine && (
            <p className="dai-opreview-hero-card__motor">{vehicleMotorLine}</p>
          )}
          {colorLabel && (
            <p className="dai-opreview-hero-card__color">{colorLabel}</p>
          )}
        </div>

        {heroImage && (
          <div className="dai-opreview-hero-card__glow-zone">
            <div className="dai-opreview-hero-card__image-wrap">
              <img
                className="dai-opreview-hero-card__image"
                src={heroImage}
                alt={vehicleMainLine || 'Fahrzeug'}
              />
            </div>

            <div className="dai-opreview-hero-card__price-block">
              <p className="dai-opreview-hero-card__price">
                {isCash
                  ? formatCurrency(offerPrice)
                  : offerPrice != null
                    ? formatEuroDe(Number(offerPrice))
                    : '–'}
                {!isCash && offerPrice != null && (
                  <span className="dai-opreview-hero-card__price-suffix">/ Monat</span>
                )}
              </p>
              <p className="dai-opreview-hero-card__price-label">
                {isCash ? 'Angebotspreis' : 'Monatliche Rate'}
              </p>
            </div>
          </div>
        )}

        {!heroImage && (
          <div className="dai-opreview-hero-card__glow-zone dai-opreview-hero-card__glow-zone--price-only">
            <div className="dai-opreview-hero-card__price-block">
              <p className="dai-opreview-hero-card__price">
                {isCash
                  ? formatCurrency(offerPrice)
                  : offerPrice != null
                    ? formatEuroDe(Number(offerPrice))
                    : '–'}
                {!isCash && offerPrice != null && (
                  <span className="dai-opreview-hero-card__price-suffix">/ Monat</span>
                )}
              </p>
              <p className="dai-opreview-hero-card__price-label">
                {isCash ? 'Angebotspreis' : 'Monatliche Rate'}
              </p>
            </div>
          </div>
        )}

        {heroMetaParts.length > 0 && (
          <p className="dai-opreview-hero-card__meta">
            {heroMetaParts.join(' · ')}
          </p>
        )}

        {heroBadges.length > 0 && (
          <div className="dai-opreview-hero-card__badges">
            {heroBadges.map((badge) => (
              <span
                key={badge.label}
                className={`cn-badge cn-badge--${badge.tone ?? 'discount'}`}
              >
                {badge.label}
              </span>
            ))}
          </div>
        )}

        {fromPdf && requireConfirm && (
          <p className="dai-opreview-hero-card__clever-signal">
            ✦ Aus PDF erkannt und für Sie vorbereitet
          </p>
        )}

        {showPackages && (
          <ul className="dai-opreview-hero-card__packages">
            {packageItems.map((label) => (
              <li key={label}>{label}</li>
            ))}
          </ul>
        )}
      </section>

      {rateImplausible && !isCash && (
        <div className="dai-opreview-warn" role="alert">
          Ungewöhnliche Monatsrate {formatEuroDe(calculatedRate)} – bitte prüfen
          (häufiger DE-Zahlenfehler, z.&nbsp;B. 152,36 → 15.236).
        </div>
      )}

      {warnings.length > 0 && requireConfirm && (
        <div className="dai-opreview-warn dai-opreview-warn--list" role="status">
          <ul>
            {warnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        </div>
      )}

      {/* 2 + 3. Erkannte Konditionen + zentrale Bestätigung */}
      {requireConfirm ? (
        <section className="dai-opreview-conditions" aria-label="Erkannte Konditionen">
          <h3 className="dai-opreview-conditions__title">Erkannte Konditionen</h3>

          {showOfferTypeCallout && (
            <div className="dai-opreview-callout" role="status">
              <p className="dai-opreview-callout__text">
                ⚠ {offerTypeAmbiguity?.message || 'Angebotsart unsicher'}
              </p>
              <div className="dai-opreview-callout__chips">
                {OFFER_TYPE_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    className={`dai-opreview-chip${draftValues.offerType === opt.value ? ' is-selected' : ''}`}
                    onClick={() => {
                      updateField('offerType', opt.value);
                      setConfirmed((prev) => ({ ...prev, offerType: true }));
                    }}
                    disabled={saved}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          <ul className="dai-opreview-review-list">
            {PDF_CONFIRM_FIELDS.map((field, index) => {
              const status = fieldStatus(field);
              const isEditing = editingField === field;
              const current = draftValues[field];
              const ev = evidence[field];

              return (
                <li
                  key={field}
                  ref={index === 0 ? firstRowRef : undefined}
                  className={[
                    'dai-opreview-review-row',
                    status === 'warn' ? 'dai-opreview-review-row--warn' : '',
                    status === 'ok' ? 'dai-opreview-review-row--ok' : '',
                    isEditing ? 'dai-opreview-review-row--editing' : '',
                    editMode ? 'dai-opreview-review-row--edit-mode' : '',
                  ].filter(Boolean).join(' ')}
                >
                  <div className="dai-opreview-review-row__main">
                    <span className="dai-opreview-review-row__label">
                      {FIELD_LABELS[field]}
                    </span>
                    <span className="dai-opreview-review-row__value">
                      {formatConfirmDisplayValue(field, current)}
                    </span>
                    <StatusIcon status={status} />
                    {!saved && (
                      <button
                        type="button"
                        className="dai-opreview-review-row__edit"
                        onClick={() => openInlineEdit(field)}
                        aria-label={`${FIELD_LABELS[field]} bearbeiten`}
                      >
                        ✎
                      </button>
                    )}
                  </div>

                  {isEditing && !saved && (
                    <div className="dai-opreview-review-row__editor">
                      {field === 'offerType' ? (
                        <div className="dai-opreview-callout__chips">
                          {OFFER_TYPE_OPTIONS.map((opt) => (
                            <button
                              key={opt.value}
                              type="button"
                              className={`dai-opreview-chip${current === opt.value ? ' is-selected' : ''}`}
                              onClick={() => {
                                updateField(field, opt.value);
                                closeInlineEdit();
                              }}
                            >
                              {opt.label}
                            </button>
                          ))}
                        </div>
                      ) : (
                        <input
                          key={`edit-${field}`}
                          ref={editInputRef}
                          id={`confirm-${field}`}
                          type="text"
                          inputMode="decimal"
                          className="dai-opreview-inline-input"
                          defaultValue={current == null ? '' : String(current)}
                          placeholder={recognized[field] != null ? String(recognized[field]) : ''}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              updateField(field, e.currentTarget.value);
                              closeInlineEdit();
                            }
                            if (e.key === 'Escape') closeInlineEdit();
                          }}
                          onBlur={(e) => {
                            updateField(field, e.currentTarget.value);
                            closeInlineEdit();
                          }}
                        />
                      )}
                      {ev?.sourceText && (
                        <p className="dai-opreview-review-row__evidence">
                          PDF: „{ev.sourceText}“
                        </p>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>

          {!saved && (
            <div className="dai-opreview-central">
              {!centralConfirmed ? (
                <>
                  <button
                    type="button"
                    className="dai-opreview-central__primary"
                    onClick={handleCentralConfirm}
                  >
                    ✓ Alle Konditionen sind korrekt
                  </button>
                  <button
                    type="button"
                    className="dai-opreview-central__secondary"
                    onClick={handleEnableEdit}
                  >
                    Werte bearbeiten
                  </button>
                </>
              ) : gate.canSave ? (
                <p className="dai-opreview-central__done" role="status">
                  ✓ Konditionen geprüft
                </p>
              ) : (
                <>
                  <p className="dai-opreview-central__remain" role="status">
                    Bitte unsichere Angaben noch prüfen
                  </p>
                  <button
                    type="button"
                    className="dai-opreview-central__secondary"
                    onClick={handleEnableEdit}
                  >
                    Werte bearbeiten
                  </button>
                </>
              )}
            </div>
          )}
        </section>
      ) : (
        <FlowCard>
          <FlowSectionHeader title="Preisdetails" />
          <FlowPriceDetails
            paymentLabel={paymentLabel}
            isCash={isCash}
            isLeasing={isLeasing}
            isFinance={isFinance}
            uvpTotal={uvpTotal}
            discountPercent={discountPercent}
            discountAmount={discountAmount}
            housePrice={housePrice}
            transferCost={transferCost}
            offerPrice={offerPrice}
            termMonths={payment.termMonths}
            mileagePerYear={payment.mileagePerYear}
            downPayment={payment.downPayment}
            formatCurrency={formatCurrency}
          />
        </FlowCard>
      )}

      {/* 4. Umwelt compact accordion */}
      {envkvSummary && (
        <details className="dai-opreview-envkv">
          <summary className="dai-opreview-envkv__summary">
            <span className="dai-opreview-envkv__label">Verbrauch &amp; CO₂</span>
            <span className="dai-opreview-envkv__compact">
              {envkvSummary.missing
                ? 'Angaben fehlen'
                : (envkvSummary.line || 'Details')}
            </span>
            <span className="dai-opreview-envkv__more">Details</span>
          </summary>
          <div className="dai-opreview-envkv__body">
            <PkwEnVkvBox
              variant="detail"
              audience="internal"
              channel={ENVKV_CHANNEL.OFFER}
              vehicleRef={envkvVehicleRef}
            />
          </div>
        </details>
      )}

      {hasCustomer && (
        <details className="cn-customer-fold">
          <summary>
            <span className="cn-customer-fold__label">Kunde</span>
            <span className="cn-customer-fold__name">{customer.name ?? '–'}</span>
          </summary>
          {(customer.phone || customer.email) && (
            <div className="cn-customer-fold__body">
              {customer.phone && <p>{customer.phone}</p>}
              {customer.email && <p>{customer.email}</p>}
            </div>
          )}
        </details>
      )}

      {/* 5. CTA */}
      <FlowStickyFooter
        className={canRelease && !saved ? 'dai-opreview-foot--ready' : ''}
        saved={saved ? '✓ Angebot gespeichert' : null}
        hint={!saved && !canRelease
          ? (missingCount === 1
            ? 'Noch 1 Angabe prüfen'
            : `Noch ${missingCount} Angaben prüfen`)
          : (!saved ? customerSaveLine : null)}
      >
        {saved ? (
          <>
            <FlowPrimaryButton onClick={onFinish}>Zur Kundenakte</FlowPrimaryButton>
            {onPreparePdfLink && (
              <FlowGhostButton onClick={onPreparePdfLink}>
                PDF / Kundenlink vorbereiten
              </FlowGhostButton>
            )}
          </>
        ) : (
          <FlowPrimaryButton
            className={canRelease ? 'dai-opreview-cta--glow' : 'dai-opreview-cta--calm'}
            onClick={handleSaveClick}
            disabled={isSaving || savePending || (requireConfirm && !gate.canSave)}
          >
            {isSaving || savePending
              ? 'Wird gespeichert …'
              : (canRelease ? 'Angebot freigeben' : (missingCount === 1 ? 'Noch 1 Angabe prüfen' : `Noch ${missingCount} Angaben prüfen`))}
          </FlowPrimaryButton>
        )}
      </FlowStickyFooter>
    </OfferFlowLayout>
  );
}
