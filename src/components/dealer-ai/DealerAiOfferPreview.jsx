import { useMemo, useState, useEffect } from 'react';
import { PAYMENT_TYPE_LABELS } from '../../services/dealerAiParser.js';
import { resolveConfigureHeroImage } from '../../services/dealerAiVehicleConfigureFlow.js';
import PkwEnVkvBox from '../compliance/PkwEnVkvBox.jsx';
import { ENVKV_CHANNEL } from '../../services/vehicle/requiresPkwEnVkv.js';
import { buildVehicleRefFromOfferContext } from '../../services/vehicle/pkwEnVkvPublishGate.js';
import {
  evaluateSellerConfirmGate,
  PDF_CONFIRM_FIELDS,
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
  VehicleOfferHero,
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
  monthlyRate: 'Monatsrate (€)',
  downPayment: 'Anzahlung / Sonderzahlung (€)',
  termMonths: 'Laufzeit (Monate)',
  annualMileage: 'km/Jahr',
  transferFee: 'Überführung (€)',
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

  const [draftValues, setDraftValues] = useState(() => buildInitialConfirmValues(offerDraft));
  const [confirmed, setConfirmed] = useState({});
  const [edited, setEdited] = useState({});

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
  }, [draftKey, isSaved, offerDraft]);

  const gate = useMemo(
    () => evaluateSellerConfirmGate({
      confirmed,
      edited,
      values: draftValues,
    }),
    [confirmed, edited, draftValues],
  );

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

  const warnings = useMemo(() => {
    const fromExtract = sellerConfirm?.warnings ?? [];
    const live = livePlausibility.warnings ?? [];
    return [...new Set([...fromExtract, ...live])];
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

  function updateField(field, rawValue) {
    const next = parseFieldInput(field, rawValue);
    setDraftValues((prev) => ({ ...prev, [field]: next }));
    setEdited((prev) => ({ ...prev, [field]: true }));
    setConfirmed((prev) => ({ ...prev, [field]: false }));
    onCommercialChange?.({ [field]: next });
  }

  function toggleConfirm(field) {
    setConfirmed((prev) => ({ ...prev, [field]: !prev[field] }));
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

  const evidence = sellerConfirm?.evidence ?? {};
  const ambiguities = sellerConfirm?.ambiguities ?? [];

  return (
    <OfferFlowLayout
      backLabel={!saved ? '← Zurück' : null}
      onBack={!saved ? onBack : null}
      title="Angebotsvorschau"
      subtitle={requireConfirm
        ? 'Erkannte Werte prüfen, ggf. korrigieren und bestätigen – erst dann speichern.'
        : 'Prüfen und Angebot speichern.'}
    >
      <VehicleOfferHero
        modelLine={vehicleMainLine || '–'}
        motorLine={vehicleMotorLine}
        colorLabel={colorLabel}
        imageSrc={heroImage}
        imageAlt={vehicleMainLine}
        priceMain={isCash
          ? formatCurrency(offerPrice)
          : offerPrice != null
            ? `${Number(offerPrice).toLocaleString('de-DE')} €`
            : '–'}
        priceLabel={isCash ? 'Angebotspreis' : 'Monatliche Rate'}
        priceSuffix={!isCash && offerPrice != null ? '/ Monat' : null}
        badges={heroBadges}
        footerMeta={isCash && uvpTotal != null ? `UVP ${formatCurrency(uvpTotal)}` : undefined}
      />

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

      {ambiguities.length > 0 && requireConfirm && (
        <div className="dai-opreview-warn dai-opreview-warn--list" role="status">
          <p>Nicht eindeutig erkannt:</p>
          <ul>
            {ambiguities.map((a) => (
              <li key={a.field}>
                {a.message}
                {a.candidates?.length
                  ? ` (${a.candidates.map((c) => c.value).join(' / ')})`
                  : ''}
              </li>
            ))}
          </ul>
        </div>
      )}

      <FlowCard>
        <FlowSectionHeader title="Fahrzeug" onEdit={!saved && !requireConfirm ? onBack : null} />
        <p className="cn-vehicle-line">{vehicleMainLine || '–'}</p>
        {vehicleMotorLine && <p className="cn-vehicle-sub">{vehicleMotorLine}</p>}
        {colorLabel && <p className="cn-vehicle-color">{colorLabel}</p>}
        {showPackages && (
          <ul className="cn-package-list">
            {packageItems.map((label) => (
              <li key={label}>{label}</li>
            ))}
          </ul>
        )}
      </FlowCard>

      <PkwEnVkvBox
        variant="detail"
        audience="internal"
        channel={ENVKV_CHANNEL.OFFER}
        vehicleRef={envkvVehicleRef}
      />

      {requireConfirm ? (
        <FlowCard>
          <FlowSectionHeader title="Konditionen bestätigen" />
          <p className="dai-opreview-confirm-hint">
            Jedes Pflichtfeld mit ✓ bestätigen (oder Wert korrigieren und dann ✓).
          </p>
          <div className="dai-opreview-confirm-fields">
            {PDF_CONFIRM_FIELDS.map((field) => {
              const recognizedVal = recognized[field];
              const current = draftValues[field];
              const isRequired = field === 'monthlyRate' || field === 'offerType';
              const warnField = (field === 'monthlyRate' && livePlausibility.flags?.monthlyRateImplausible)
                || (field === 'downPayment' && livePlausibility.flags?.downPaymentImplausible);
              const ev = evidence[field];

              return (
                <div
                  key={field}
                  className={`dai-opreview-confirm-row${warnField ? ' dai-opreview-confirm-row--warn' : ''}${confirmed[field] ? ' dai-opreview-confirm-row--ok' : ''}`}
                >
                  <div className="dai-opreview-confirm-row__head">
                    <label htmlFor={`confirm-${field}`}>
                      {FIELD_LABELS[field]}
                      {isRequired ? ' *' : ''}
                    </label>
                    {recognizedVal != null && recognizedVal !== '' && (
                      <span className="dai-opreview-confirm-row__recognized">
                        erkannt: {field === 'offerType'
                          ? (PAYMENT_TYPE_LABELS[recognizedVal] ?? recognizedVal)
                          : (field === 'termMonths' || field === 'annualMileage'
                            ? Number(recognizedVal).toLocaleString('de-DE')
                            : formatEuroDe(Number(recognizedVal)))}
                      </span>
                    )}
                  </div>
                  {field === 'offerType' ? (
                    <select
                      id={`confirm-${field}`}
                      value={current || 'leasing'}
                      onChange={(e) => updateField(field, e.target.value)}
                      disabled={saved}
                    >
                      {OFFER_TYPE_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  ) : (
                    <input
                      id={`confirm-${field}`}
                      type="text"
                      inputMode="decimal"
                      value={current == null ? '' : String(current)}
                      onChange={(e) => updateField(field, e.target.value)}
                      disabled={saved}
                      placeholder={recognizedVal != null ? String(recognizedVal) : ''}
                    />
                  )}
                  {ev?.sourceText && (
                    <p className="dai-opreview-confirm-row__evidence">
                      PDF: „{ev.sourceText}“
                    </p>
                  )}
                  <label className="dai-opreview-confirm-check">
                    <input
                      type="checkbox"
                      checked={Boolean(confirmed[field])}
                      onChange={() => toggleConfirm(field)}
                      disabled={saved || (isRequired && (current == null || current === ''))}
                    />
                    <span>Bestätigt</span>
                  </label>
                </div>
              );
            })}
          </div>
        </FlowCard>
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
            termMonths={requireConfirm ? draftValues.termMonths : payment.termMonths}
            mileagePerYear={requireConfirm ? draftValues.annualMileage : payment.mileagePerYear}
            downPayment={requireConfirm ? draftValues.downPayment : payment.downPayment}
            formatCurrency={formatCurrency}
          />
        </FlowCard>
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

      <FlowStickyFooter saved={saved ? '✓ Angebot gespeichert' : null}>
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
          <>
            {requireConfirm && !gate.canSave && (
              <p className="dai-opreview-gate-hint">
                Bitte Pflichtfelder bestätigen, bevor Sie speichern.
              </p>
            )}
            <FlowPrimaryButton
              onClick={handleSaveClick}
              disabled={isSaving || savePending || (requireConfirm && !gate.canSave)}
            >
              {isSaving || savePending ? 'Wird gespeichert …' : 'Angebot speichern'}
            </FlowPrimaryButton>
          </>
        )}
      </FlowStickyFooter>
    </OfferFlowLayout>
  );
}
