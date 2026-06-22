import { useMemo, useState } from 'react';
import { PAYMENT_TYPE_LABELS } from '../../services/dealerAiParser.js';
import { resolveConfigureHeroImage } from '../../services/dealerAiVehicleConfigureFlow.js';
import {
  FlowCard,
  FlowGhostButton,
  FlowPriceDetails,
  FlowPrimaryButton,
  FlowSecondaryButton,
  FlowSectionHeader,
  FlowStickyFooter,
  OfferFlowLayout,
  VehicleOfferHero,
} from './flow/OfferFlowComponents.jsx';

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

/** Schritt 3 – Angebotsvorschau (einheitlicher Flow) */
export default function DealerAiOfferPreview({
  offerDraft,
  onBack,
  onSave,
  onPreparePdfLink,
  onFinish,
  isSaving = false,
  isSaved = false,
}) {
  const [savePending, setSavePending] = useState(false);

  if (!offerDraft) return null;

  const {
    customer,
    vehicle,
    payment,
    vehicleConfiguration,
    offerCalculation,
    offerPreview,
  } = offerDraft;

  const preview = offerPreview ?? {};
  const calculation = offerCalculation ?? {};

  const vehicleMainLine = [vehicleConfiguration?.model ?? vehicle.model, vehicleConfiguration?.trimLabel ?? vehicle.trimLabel]
    .filter(Boolean)
    .join(' ');
  const vehicleMotorLine = vehicleConfiguration?.motorLabel
    ?? vehicleConfiguration?.batteryLabel
    ?? vehicle.battery
    ?? null;
  const colorLabel = vehicleConfiguration?.colorLabel ?? vehicle.color ?? null;

  const uvpTotal = preview.uvpConfigurationPrice
    ?? vehicleConfiguration?.uvpConfigurationPrice
    ?? vehicle.uvpConfigurationPrice
    ?? null;

  const discountPercent = preview.discountPercent ?? calculation.discountPercent ?? null;
  const discountAmount = preview.discountAmount ?? calculation.discountAmount ?? null;
  const housePrice = preview.housePrice ?? calculation.housePrice ?? null;
  const transferCost = payment.transferCost ?? calculation.preparationFee ?? null;

  const isCash = payment.type === 'cash';
  const isLeasing = payment.type === 'leasing';
  const isFinance = payment.type === 'financing' || payment.type === 'threeWayFinancing';

  const calculatedRate = payment.calculatedRate ?? preview.monthlyRate ?? calculation.monthlyRate ?? null;
  const offerPrice = isCash
    ? (calculatedRate ?? (housePrice != null && transferCost != null ? housePrice + transferCost : null))
    : calculatedRate;

  const savings = discountAmount
    ?? (uvpTotal != null && housePrice != null ? uvpTotal - housePrice : null);

  const paymentLabel = PAYMENT_TYPE_LABELS[payment.type] ?? payment.type;

  const heroImage = useMemo(() => resolveConfigureHeroImage({
    modelKey: vehicle.modelKey,
    colorId: vehicle.colorId ?? vehicleConfiguration?.colorId,
    trimId: vehicle.trimId ?? vehicleConfiguration?.trimId,
  }), [vehicle.modelKey, vehicle.colorId, vehicle.trimId, vehicleConfiguration?.colorId, vehicleConfiguration?.trimId]);

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

  async function handleSaveClick() {
    if (saved || savePending || isSaving) return;
    setSavePending(true);
    try {
      const ok = await onSave?.();
      if (ok === false) return;
    } finally {
      setSavePending(false);
    }
  }

  return (
    <OfferFlowLayout
      backLabel={!saved ? '← Zu Konditionen' : null}
      onBack={!saved ? onBack : null}
      title="Angebotsvorschau"
      subtitle="Prüfen und Angebot speichern."
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
            ? `${offerPrice.toLocaleString('de-DE')} €`
            : '–'}
        priceLabel={isCash ? 'Angebotspreis' : 'Monatliche Rate'}
        priceSuffix={!isCash && offerPrice != null ? '/ Monat' : null}
        badges={heroBadges}
        footerMeta={isCash && uvpTotal != null ? `UVP ${formatCurrency(uvpTotal)}` : undefined}
      />

      <FlowCard>
        <FlowSectionHeader title="Fahrzeug" onEdit={!saved ? onBack : null} />
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
          <FlowPrimaryButton
            onClick={handleSaveClick}
            disabled={isSaving || savePending}
          >
            {isSaving || savePending ? 'Wird gespeichert …' : 'Angebot speichern'}
          </FlowPrimaryButton>
        )}
      </FlowStickyFooter>
    </OfferFlowLayout>
  );
}
