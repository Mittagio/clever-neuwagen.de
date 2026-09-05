import { useMemo, useState, useEffect, useRef } from 'react';
import { PAYMENT_TYPE_LABELS } from '../../services/dealerAiParser.js';
import {
  evaluateSellerConfirmGate,
  PDF_CONFIRM_FIELDS,
  resolveLowConfidenceFields,
  buildHighConfidenceConfirmedMap,
  editablePriceDetailFields,
} from '../../services/dealer/sellerOfferConfirmGate.js';
import {
  assessCommercialPlausibility,
  formatEuroDe,
  parseGermanMoney,
} from '../../services/dealer/parseGermanMoney.js';
import { buildOfferVersionHistory, VEHICLE_OFFER_STATUS } from '../../services/vehicleOffer.js';
import { resolveConfigureHeroImage } from '../../services/dealerAiVehicleConfigureFlow.js';
import {
  listOfferIdentityColorChoices,
  listOfferIdentityModelChoices,
  listOfferIdentityPackageChoices,
  listOfferIdentityPowertrainChoices,
  listOfferIdentityTrimChoices,
} from '../../services/cleverSeller/offerVehicleIdentity.js';
import { RATE_AUTHORITY } from '../../services/cleverSeller/captureThenOffer.js';
import { IconChevronRight } from './AkteIcons.jsx';
import {
  FlowCard,
  FlowPrimaryButton,
  FlowStickyFooter,
  OfferFlowLayout,
} from './flow/OfferFlowComponents.jsx';
import './DealerAiOfferPreview.css';

function formatCurrency(amount) {
  if (amount == null) return '–';
  return `${Number(amount).toLocaleString('de-DE')} €`;
}

function collectPackagesAndExtras(vehicleConfiguration, payment, offerDraft = null) {
  const items = [];
  for (const pkg of vehicleConfiguration?.selectedPackages ?? []) {
    items.push(pkg.name);
  }
  for (const label of vehicleConfiguration?.packageLabels ?? []) {
    if (label && !items.includes(label)) items.push(label);
  }
  for (const pkg of offerDraft?.vehicleIdentityDraft?.packages ?? []) {
    const label = pkg?.canonical || pkg?.raw;
    if (label && !items.includes(label)) items.push(label);
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

function resolveColorSwatch(colorId, colorLabel) {
  const haystack = `${colorId || ''} ${colorLabel || ''}`.toLowerCase();
  if (!haystack.trim()) return null;
  if (/black|schwarz|pearl.*black|aurora/.test(haystack)) return '#1a1a1a';
  if (/white|weiss|weiß|snow|carrara|deluxe|clear/.test(haystack)) return '#f4f4f0';
  if (/red|rot|magma|runway|terracotta|signal/.test(haystack)) return '#8b1e2f';
  if (/blue|blau|frost|ocean|yacht|smoke/.test(haystack)) return '#2d4a6e';
  if (/green|grün|gruen|aventurine|experience|adventurous/.test(haystack)) return '#3d5c4a';
  if (/grey|gray|grau|wolf|shale|pentametal|astro|sparkling|ivory|lunar|silver/.test(haystack)) {
    return '#8b939e';
  }
  return '#cbd5e1';
}

const OFFER_TYPE_OPTIONS = [
  { value: 'leasing', label: 'Leasing' },
  { value: 'financing', label: 'Finanzierung' },
  { value: 'cash', label: 'Barkauf' },
];

const FIELD_LABELS = {
  monthlyRate: 'Monatliche Rate',
  downPayment: 'Anzahlung',
  termMonths: 'Laufzeit',
  annualMileage: 'Kilometer',
  transferFee: 'Überführung',
  finalRate: 'Schlussrate',
  offerType: 'Angebotsart',
};

function OpIcon({ children, className = '' }) {
  return (
    <svg
      className={`dai-opreview-icon ${className}`.trim()}
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      {children}
    </svg>
  );
}

const stroke = {
  stroke: 'currentColor',
  strokeWidth: 1.75,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
};

function IconCalendar() {
  return (
    <OpIcon>
      <rect x="3.5" y="5" width="17" height="15.5" rx="2" {...stroke} />
      <path d="M8 3.5v3M16 3.5v3M3.5 10h17" {...stroke} />
    </OpIcon>
  );
}

function IconGauge() {
  return (
    <OpIcon>
      <path d="M5.5 17a7.5 7.5 0 1 1 13 0" {...stroke} />
      <path d="M12 14l3.5-3.5" {...stroke} />
      <circle cx="12" cy="14" r="1.2" fill="currentColor" stroke="none" />
    </OpIcon>
  );
}

function IconWallet() {
  return (
    <OpIcon>
      <rect x="3" y="7" width="18" height="12" rx="2" {...stroke} />
      <path d="M3 10h18" {...stroke} />
      <circle cx="16.5" cy="14" r="1.1" fill="currentColor" stroke="none" />
    </OpIcon>
  );
}

function IconTruck() {
  return (
    <OpIcon>
      <path d="M3 7h11v10H3z" {...stroke} />
      <path d="M14 10h4l3 3v4h-7v-7z" {...stroke} />
      <circle cx="7.5" cy="18.5" r="1.5" {...stroke} />
      <circle cx="17.5" cy="18.5" r="1.5" {...stroke} />
    </OpIcon>
  );
}

function IconPencil() {
  return (
    <OpIcon>
      <path d="M13.5 5.5l5 5L8 21H3v-5L13.5 5.5z" {...stroke} />
      <path d="M11.5 7.5l5 5" {...stroke} />
    </OpIcon>
  );
}

function IconEye() {
  return (
    <OpIcon>
      <path d="M2.5 12s3.5-6.5 9.5-6.5S21.5 12 21.5 12s-3.5 6.5-9.5 6.5S2.5 12 2.5 12z" {...stroke} />
      <circle cx="12" cy="12" r="2.5" {...stroke} />
    </OpIcon>
  );
}

function IconUpload() {
  return (
    <OpIcon>
      <path d="M12 16V5M7.5 9.5L12 5l4.5 4.5" {...stroke} />
      <path d="M4 18.5h16" {...stroke} />
    </OpIcon>
  );
}

function IconFile() {
  return (
    <OpIcon className="dai-opreview-icon--file">
      <path d="M7 3.5h7l4 4V20a1.5 1.5 0 0 1-1.5 1.5h-9.5A1.5 1.5 0 0 1 5.5 20V5A1.5 1.5 0 0 1 7 3.5z" {...stroke} />
      <path d="M14 3.5V8h4.5" {...stroke} />
    </OpIcon>
  );
}

const DETAIL_ICONS = {
  termMonths: IconCalendar,
  annualMileage: IconGauge,
  downPayment: IconWallet,
  transferFee: IconTruck,
};

function buildInitialConfirmValues(offerDraft) {
  const recognized = offerDraft?.sellerConfirm?.recognized ?? {};
  return {
    monthlyRate: offerDraft?.payment?.calculatedRate ?? recognized.monthlyRate ?? null,
    downPayment: offerDraft?.payment?.downPayment ?? recognized.downPayment ?? null,
    termMonths: offerDraft?.payment?.termMonths ?? recognized.termMonths ?? null,
    annualMileage: offerDraft?.payment?.mileagePerYear ?? recognized.annualMileage ?? null,
    transferFee: offerDraft?.payment?.transferCost ?? recognized.transferFee ?? null,
    finalRate: offerDraft?.payment?.finalRate
      ?? offerDraft?.offerCalculation?.finalPayment
      ?? recognized.finalPayment
      ?? null,
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

function resolveOriginalPdfHref(originalPdf) {
  if (!originalPdf) return null;
  return originalPdf.dataUrl || originalPdf.url || null;
}

function pickOriginalPdf(...candidates) {
  let best = null;
  for (const candidate of candidates) {
    if (!candidate || typeof candidate !== 'object') continue;
    const hasData = Boolean(candidate.dataUrl || candidate.url);
    if (!best) {
      best = candidate;
      continue;
    }
    if (hasData && !(best.dataUrl || best.url)) best = candidate;
  }
  return best;
}

/** data:application/pdf;base64,… → blob: URL (zuverlässiger für iframe). */
function createBlobUrlFromPdfDataUrl(dataUrl) {
  if (!dataUrl || typeof dataUrl !== 'string') return null;
  if (!dataUrl.startsWith('data:')) return null;
  try {
    const comma = dataUrl.indexOf(',');
    if (comma < 0) return null;
    const header = dataUrl.slice(0, comma);
    const payload = dataUrl.slice(comma + 1);
    const mimeMatch = header.match(/^data:([^;,]+)/i);
    const mime = mimeMatch?.[1] || 'application/pdf';
    const isBase64 = /;base64/i.test(header);
    let bytes;
    if (isBase64) {
      const binary = atob(payload);
      bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
    } else {
      const decoded = decodeURIComponent(payload);
      bytes = new Uint8Array(decoded.length);
      for (let i = 0; i < decoded.length; i += 1) bytes[i] = decoded.charCodeAt(i);
    }
    return URL.createObjectURL(new Blob([bytes], { type: mime.includes('pdf') ? mime : 'application/pdf' }));
  } catch {
    return null;
  }
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

function PriceDetailIcon({ field }) {
  const Icon = DETAIL_ICONS[field];
  if (!Icon) return <span className="dai-opreview-detail__icon-dot" aria-hidden />;
  return (
    <span className="dai-opreview-detail__icon" aria-hidden>
      <Icon />
    </span>
  );
}

/** Drei anklickbare Identity-Facts – Popover-Choices, kein Freitext-Default. */
function IdentityFactPopover({
  field,
  label,
  open,
  choices,
  selectedId,
  selectedLabel,
  onToggle,
  onSelect,
  disabled,
  showSwatch = false,
  swatchColor = null,
}) {
  const rootRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    function handlePointer(event) {
      if (rootRef.current && !rootRef.current.contains(event.target)) {
        onToggle(null);
      }
    }
    function handleKey(event) {
      if (event.key === 'Escape') onToggle(null);
    }
    document.addEventListener('mousedown', handlePointer);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handlePointer);
      document.removeEventListener('keydown', handleKey);
    };
  }, [open, onToggle]);

  return (
    <div
      ref={rootRef}
      className={`dai-opreview-identity__fact${open ? ' is-open' : ''}${showSwatch ? ' dai-opreview-identity__fact--color' : ''}`}
    >
      <button
        type="button"
        className="dai-opreview-identity__chip"
        onClick={() => onToggle(open ? null : field)}
        disabled={disabled}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label={`${label}: ${selectedLabel || 'offen'}`}
      >
        {showSwatch && (
          <span
            className="dai-opreview-summary__swatch"
            style={{ background: swatchColor || '#cbd5e1' }}
            aria-hidden
          />
        )}
        <span className={!selectedLabel ? 'dai-opreview-identity__chip-open' : undefined}>
          {selectedLabel || 'offen'}
        </span>
      </button>
      {open && !disabled && (
        <ul className="dai-opreview-identity__popover" role="listbox" aria-label={`${label} wählen`}>
          {choices.map((choice) => {
            const isSelected = selectedId
              ? choice.id === selectedId
              : String(choice.label || '').toLowerCase() === String(selectedLabel || '').toLowerCase();
            return (
              <li key={choice.id}>
                <button
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  className={`dai-opreview-identity__option${isSelected ? ' is-selected' : ''}`}
                  onClick={() => onSelect(choice)}
                >
                  {choice.swatch && (
                    <span
                      className="dai-opreview-summary__swatch"
                      style={{ background: choice.swatch }}
                      aria-hidden
                    />
                  )}
                  <span>{choice.label}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/** Schritt 3 – Angebot prüfen (interne Vorbereitung, kein Kundenversand) */
export default function DealerAiOfferPreview({
  offerDraft,
  onBack,
  onSave,
  onCommercialChange,
  onReuploadPdf = null,
  fallbackOriginalPdf = null,
  isSaving = false,
  isSaved = false,
  isReuploading = false,
}) {
  const [savePending, setSavePending] = useState(false);
  const [pdfToast, setPdfToast] = useState('');
  const [pdfPreviewOpen, setPdfPreviewOpen] = useState(false);
  const [pdfBlobUrl, setPdfBlobUrl] = useState(null);
  const [draftValues, setDraftValues] = useState(() => buildInitialConfirmValues(offerDraft));
  const [confirmed, setConfirmed] = useState({});
  const [edited, setEdited] = useState({});
  const [centralConfirmed, setCentralConfirmed] = useState(false);
  const [editingField, setEditingField] = useState(null);
  const [editMode, setEditMode] = useState(false);
  const [identityPopover, setIdentityPopover] = useState(null);
  const fileInputRef = useRef(null);
  const firstRowRef = useRef(null);
  const conditionsRef = useRef(null);
  const editInputRef = useRef(null);
  const sellerConfirm = offerDraft?.sellerConfirm;
  const requireConfirm = Boolean(sellerConfirm?.required) && !isSaved;
  const recognized = sellerConfirm?.recognized ?? {};
  const originalPdf = pickOriginalPdf(
    offerDraft?.source?.originalPdf,
    fallbackOriginalPdf,
  );
  const fromPdf = offerDraft?.source?.createdFrom === 'magic_offer_pdf'
    || Boolean(sellerConfirm?.required)
    || Boolean(originalPdf);
  const originalPdfHref = resolveOriginalPdfHref(originalPdf);
  const originalPdfFileName = originalPdf?.fileName || null;
  const showPdfBlock = Boolean(fromPdf || originalPdfFileName || onReuploadPdf);
  const pdfViewUrl = pdfBlobUrl || originalPdfHref;

  useEffect(() => {
    const dataUrl = originalPdf?.dataUrl;
    if (!dataUrl || typeof dataUrl !== 'string' || !dataUrl.startsWith('data:')) {
      setPdfBlobUrl(null);
      return undefined;
    }
    const blobUrl = createBlobUrlFromPdfDataUrl(dataUrl);
    setPdfBlobUrl(blobUrl);
    return () => {
      if (blobUrl) URL.revokeObjectURL(blobUrl);
    };
  }, [originalPdf?.dataUrl]);

  useEffect(() => {
    setPdfPreviewOpen(false);
  }, [originalPdf?.fileName, originalPdf?.dataUrl, originalPdf?.url]);

  // Identity of the preview draft (not live commercial values – edits must not reset editMode).
  const draftKey = [
    offerDraft?.source?.originalPdf?.fileName ?? '',
    offerDraft?.source?.originalPdf?.uploadedAt ?? '',
    offerDraft?.source?.createdFrom ?? '',
    offerDraft?.vehicle?.modelKey ?? offerDraft?.vehicleConfiguration?.modelKey ?? '',
    offerDraft?.vehicleCardId ?? offerDraft?.id ?? '',
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
    setIdentityPopover(null);
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
  const offerCalculation = offerDraft?.offerCalculation ?? {};
  const offerPreview = offerDraft?.offerPreview ?? {};

  const versionHistory = useMemo(
    () => buildOfferVersionHistory(offerDraft),
    [offerDraft],
  );

  const heroImage = useMemo(() => resolveConfigureHeroImage({
    modelKey: vehicleConfiguration?.modelKey ?? vehicle?.modelKey ?? null,
    colorId: vehicleConfiguration?.colorId ?? vehicle?.colorId ?? null,
    trimId: vehicleConfiguration?.trimId ?? vehicle?.trimId ?? null,
  }), [
    vehicleConfiguration?.modelKey,
    vehicleConfiguration?.colorId,
    vehicleConfiguration?.trimId,
    vehicle?.modelKey,
    vehicle?.colorId,
    vehicle?.trimId,
  ]);

  const activeOfferType = draftValues.offerType || payment.type;

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
  const colorLabel = vehicleConfiguration?.colorLabel
    ?? offerDraft?.vehicleIdentityDraft?.color?.canonical
    ?? offerDraft?.vehicleIdentityDraft?.color?.raw
    ?? vehicle?.color
    ?? null;
  const colorId = vehicleConfiguration?.colorId
    ?? offerDraft?.vehicleIdentityDraft?.colorId
    ?? vehicle?.colorId
    ?? null;
  const colorSwatch = resolveColorSwatch(colorId, colorLabel);
  const modelKey = vehicleConfiguration?.modelKey ?? vehicle?.modelKey ?? null;
  const modelLabel = vehicleConfiguration?.model ?? vehicle?.model ?? null;
  const trimLabel = vehicleConfiguration?.trimLabel ?? vehicle?.trimLabel ?? null;
  const trimId = vehicleConfiguration?.trimId ?? vehicle?.trimId ?? null;
  const rateNeedsReview = Boolean(offerDraft?.rateNeedsReview);
  const rateCalibratedFor = offerDraft?.rateCalibratedFor || null;
  const modelChoices = listOfferIdentityModelChoices({ currentModelKey: modelKey });
  const trimChoices = listOfferIdentityTrimChoices(modelKey);
  const colorChoices = listOfferIdentityColorChoices(modelKey);
  const powertrainChoices = listOfferIdentityPowertrainChoices(modelKey);
  const packageChoices = listOfferIdentityPackageChoices(modelKey, {
    trimId: trimId || (trimLabel ? String(trimLabel).toLowerCase().replace(/\s+/g, '-') : null),
  });
  const powertrainLabel = vehicleMotorLine
    || offerDraft?.vehicleIdentityDraft?.powertrainVariant?.canonical
    || offerDraft?.vehicleIdentityDraft?.powertrainVariant?.raw
    || null;
  const identityConflicts = Array.isArray(offerDraft?.identityConflicts)
    ? offerDraft.identityConflicts
    : [];
  const rateSourceLabel = (() => {
    if (rateNeedsReview) return null;
    const auth = offerDraft?.rateAuthority;
    if (auth === RATE_AUTHORITY.AUTHORITATIVE || fromPdf) {
      const ev = evidence?.monthlyRate?.sourceText || evidence?.monthlyRate?.raw;
      if (ev) return `Quelle: PDF · „${ev}“`;
      if (originalPdfFileName) return `Quelle: PDF · ${originalPdfFileName}`;
      return 'Quelle: PDF';
    }
    if (offerDraft?.offerPreview?.monthlyRate != null || offerDraft?.payment?.calculatedRate != null) {
      return recognized?.monthlyRate != null ? 'Quelle: Verkäufer / Bank' : 'Quelle: Angebot';
    }
    return null;
  })();

  const uvpTotal = preview.uvpConfigurationPrice
    ?? vehicleConfiguration?.uvpConfigurationPrice
    ?? vehicle?.uvpConfigurationPrice
    ?? null;

  const discountPercent = preview.discountPercent ?? calculation.discountPercent ?? null;
  const discountAmount = preview.discountAmount ?? calculation.discountAmount ?? null;
  const housePrice = preview.housePrice ?? calculation.housePrice ?? null;
  const transferCost = draftValues.transferFee
    ?? payment.transferCost
    ?? calculation.preparationFee
    ?? null;
  const displayTermMonths = draftValues.termMonths ?? payment.termMonths ?? null;
  const displayMileage = draftValues.annualMileage ?? payment.mileagePerYear ?? null;
  const displayDownPayment = draftValues.downPayment ?? payment.downPayment ?? null;

  const isCash = activeOfferType === 'cash';
  const isLeasing = activeOfferType === 'leasing';
  const isFinance = activeOfferType === 'financing' || activeOfferType === 'threeWayFinancing';

  const calculatedRate = draftValues.monthlyRate
    ?? payment.calculatedRate
    ?? preview.monthlyRate
    ?? calculation.monthlyRate
    ?? null;
  const offerPrice = isCash
    ? (calculatedRate ?? (housePrice != null && transferCost != null ? housePrice + transferCost : null))
    : calculatedRate;

  const savings = discountAmount
    ?? (uvpTotal != null && housePrice != null ? uvpTotal - housePrice : null);

  const paymentLabel = PAYMENT_TYPE_LABELS[activeOfferType] ?? activeOfferType;
  const packageItems = collectPackagesAndExtras(vehicleConfiguration, payment, offerDraft);
  const showPackages = packageItems.length > 0;
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

  const missingCount = gate.missing.length;
  const canFile = !requireConfirm || gate.canSave;
  const showCheckedBadge = saved
    || offerDraft?.status === VEHICLE_OFFER_STATUS.PREPARED
    || (requireConfirm && centralConfirmed && gate.canSave);

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
    const firstLow = lowConfidenceFields[0];
    if (firstLow) {
      setEditingField(firstLow);
      setEditMode(true);
    }
  }

  function handleEnableEdit() {
    if (saved) return;
    setEditMode(true);
    const target = requireConfirm
      ? (lowConfidenceFields[0] ?? PDF_CONFIRM_FIELDS[0])
      : (editablePriceDetailFields(activeOfferType)[0] ?? 'monthlyRate');
    setEditingField(target);
    requestAnimationFrame(() => {
      firstRowRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'center' });
      conditionsRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
    });
  }

  function handleFinishManualEdit() {
    setEditMode(false);
    setEditingField(null);
    onCommercialChange?.(draftValues);
  }

  function openInlineEdit(field) {
    if (saved) return;
    setEditMode(true);
    setEditingField(field);
  }

  function closeInlineEdit() {
    setEditingField(null);
  }

  function closeIdentityPopover() {
    setIdentityPopover(null);
  }

  function applyIdentityChoice(field, choice) {
    if (!onCommercialChange || !choice) {
      closeIdentityPopover();
      return;
    }
    const patch = {};
    if (field === 'model') {
      patch.model = choice.label;
      patch.modelKey = choice.id;
      const nextTrims = listOfferIdentityTrimChoices(choice.id);
      const currentTrim = vehicleConfiguration?.trimLabel ?? vehicle?.trimLabel ?? '';
      const trimStillValid = nextTrims.some((t) => (
        t.id === (vehicleConfiguration?.trimId || '')
        || String(t.label).toLowerCase() === String(currentTrim).toLowerCase()
      ));
      if (!trimStillValid) {
        patch.trimLabel = '';
        patch.trimId = null;
      }
      const nextColors = listOfferIdentityColorChoices(choice.id);
      const currentColor = vehicleConfiguration?.colorLabel ?? vehicle?.color ?? '';
      const colorStillValid = nextColors.some((c) => (
        c.id === (vehicleConfiguration?.colorId || vehicle?.colorId || '')
        || String(c.label).toLowerCase() === String(currentColor).toLowerCase()
      ));
      if (!colorStillValid) {
        patch.colorLabel = '';
        patch.colorId = null;
      }
    } else if (field === 'trim') {
      patch.trimLabel = choice.label;
      patch.trimId = choice.id;
    } else if (field === 'color') {
      patch.colorLabel = choice.label;
      patch.colorId = choice.id;
    } else if (field === 'powertrain') {
      patch.motorLabel = choice.label;
      patch.engineId = choice.id;
    } else if (field === 'package') {
      const current = collectPackagesAndExtras(
        offerDraft?.vehicleConfiguration,
        offerDraft?.payment,
        offerDraft,
      );
      const has = current.some((p) => String(p).toLowerCase() === String(choice.label).toLowerCase());
      patch.packageLabels = has
        ? current.filter((p) => String(p).toLowerCase() !== String(choice.label).toLowerCase())
        : [...current, choice.label];
    }
    onCommercialChange(patch);
    closeIdentityPopover();
  }

  function resolveIdentityConflict(conflict, choice) {
    if (!onCommercialChange || !conflict || !choice) return;
    const patch = {
      resolveIdentityConflict: { field: conflict.field },
    };
    if (conflict.field === 'trim') {
      patch.trimLabel = choice.value;
      patch.trimId = String(choice.value).toLowerCase().replace(/\s+/g, '-');
    } else if (conflict.field === 'color') {
      patch.colorLabel = choice.value;
    } else if (conflict.field === 'model') {
      patch.modelKey = choice.value;
      patch.model = String(choice.value).toUpperCase();
    } else if (conflict.field === 'powertrain') {
      patch.motorLabel = choice.value;
    }
    // PDF-Wert übernommen + Rate aus PDF → wieder belastbar; Draft behalten → Rate prüfen
    if (choice.id === 'take_pdf' && (offerDraft?.payment?.calculatedRate != null || offerDraft?.offerPreview?.monthlyRate != null)) {
      patch.rateNeedsReview = false;
    } else if (choice.id === 'keep_draft') {
      patch.rateNeedsReview = true;
    }
    onCommercialChange(patch);
  }

  async function handleSaveClick() {
    if (saved || savePending || isSaving) return;
    if (requireConfirm && !gate.canSave) return;
    setSavePending(true);
    try {
      // Persist manual edits into the same draft that „Angebot speichern“ uses (with or without PDF confirm).
      onCommercialChange?.(draftValues);
      const ok = await onSave?.();
      if (ok === false) return;
    } finally {
      setSavePending(false);
    }
  }

  function handleTogglePdfPreview() {
    if (!pdfViewUrl) {
      setPdfToast('PDF-Datei ist nicht mehr im Browser verfügbar – bitte aktuelles PDF ersetzen.');
      window.setTimeout(() => setPdfToast(''), 3200);
      return;
    }
    setPdfPreviewOpen((open) => !open);
  }

  function handleReuploadClick() {
    if (saved || isReuploading || !onReuploadPdf) return;
    fileInputRef.current?.click();
  }

  async function handleReuploadFileChange(event) {
    const file = event.target.files?.[0] ?? null;
    event.target.value = '';
    if (!file || !onReuploadPdf) return;
    await onReuploadPdf(file);
  }

  function renderPriceDetailsHeader({ title, showEdit }) {
    return (
      <div className="dai-opreview-card__head">
        <h3 className="dai-opreview-card__eyebrow">{title}</h3>
        {showEdit && (
          <button
            type="button"
            className="dai-opreview-card__edit"
            onClick={editMode ? handleFinishManualEdit : handleEnableEdit}
          >
            <IconPencil />
            <span>{editMode ? 'Fertig' : 'Werte bearbeiten'}</span>
          </button>
        )}
      </div>
    );
  }

  function renderReadonlyPriceRows() {
    const rows = [];
    if (isCash) {
      if (uvpTotal != null) rows.push({ key: 'uvp', label: 'UVP', value: formatCurrency(uvpTotal) });
      if (discountPercent != null) {
        rows.push({ key: 'discountPct', label: 'Rabatt', value: `${discountPercent} %` });
      }
      if (discountAmount != null) {
        rows.push({
          key: 'discountAmt',
          label: 'Rabattbetrag',
          value: `− ${Number(discountAmount).toLocaleString('de-DE')} €`,
        });
      }
      if (housePrice != null) {
        rows.push({ key: 'house', label: 'Händlerpreis', value: formatCurrency(housePrice) });
      }
      if (transferCost != null) {
        rows.push({
          key: 'transferFee',
          label: 'Überführung',
          value: formatCurrency(transferCost),
          field: 'transferFee',
        });
      }
    } else {
      if (displayTermMonths != null) {
        rows.push({
          key: 'termMonths',
          label: 'Laufzeit',
          value: `${Number(displayTermMonths).toLocaleString('de-DE')} Monate`,
          field: 'termMonths',
        });
      }
      if (isLeasing && displayMileage != null) {
        rows.push({
          key: 'annualMileage',
          label: 'Kilometer',
          value: `${Number(displayMileage).toLocaleString('de-DE')} km/Jahr`,
          field: 'annualMileage',
        });
      }
      if (displayDownPayment != null) {
        rows.push({
          key: 'downPayment',
          label: 'Anzahlung',
          value: formatCurrency(displayDownPayment),
          field: 'downPayment',
        });
      }
      if (transferCost != null) {
        rows.push({
          key: 'transferFee',
          label: 'Überführung',
          value: formatCurrency(transferCost),
          field: 'transferFee',
        });
      }
      const finalRate = draftValues.finalRate
        ?? payment.finalRate
        ?? offerDraft?.offerCalculation?.finalPayment
        ?? null;
      if (isFinance && finalRate != null) {
        rows.push({
          key: 'finalRate',
          label: 'Schlussrate',
          value: formatCurrency(finalRate),
          field: 'finalRate',
        });
      }
    }

    const footerLabel = isCash ? 'Endpreis' : 'Rate';
    const footerValue = isCash
      ? (offerPrice != null ? formatCurrency(offerPrice) : '–')
      : (offerPrice != null
        ? `${Number(offerPrice).toLocaleString('de-DE', {
          minimumFractionDigits: Number.isInteger(Number(offerPrice)) ? 0 : 2,
          maximumFractionDigits: 2,
        })} €/Monat`
        : '–');

    return (
      <>
        {paymentLabel && <p className="dai-opreview-detail__type">{paymentLabel}</p>}
        <ul className="dai-opreview-detail__list" aria-label="Preisdetails">
          {rows.map((row) => (
            <li key={row.key} className="dai-opreview-detail__row">
              <PriceDetailIcon field={row.field} />
              <span className="dai-opreview-detail__label">{row.label}</span>
              <span className="dai-opreview-detail__value">{row.value}</span>
            </li>
          ))}
        </ul>
        <div className="dai-opreview-detail__footer">
          <span>{footerLabel}</span>
          <strong>{footerValue}</strong>
        </div>
      </>
    );
  }

  function renderEditableFieldRow(field, index, { showStatus = false } = {}) {
    const status = showStatus ? fieldStatus(field) : null;
    const isEditing = editingField === field;
    const current = draftValues[field];
    const ev = evidence[field];

    return (
      <li
        key={field}
        ref={index === 0 ? firstRowRef : undefined}
        className={[
          'dai-opreview-review-row',
          'dai-opreview-review-row--edit-mode',
          status === 'warn' ? 'dai-opreview-review-row--warn' : '',
          status === 'ok' ? 'dai-opreview-review-row--ok' : '',
          isEditing ? 'dai-opreview-review-row--editing' : '',
        ].filter(Boolean).join(' ')}
      >
        <div className="dai-opreview-review-row__main">
          <PriceDetailIcon field={field} />
          <span className="dai-opreview-review-row__label">
            {FIELD_LABELS[field]}
          </span>
          <span className="dai-opreview-review-row__value">
            {formatConfirmDisplayValue(field, current)}
          </span>
          {showStatus && <StatusIcon status={status} />}
          {!saved && (
            <button
              type="button"
              className="dai-opreview-review-row__edit"
              onClick={() => openInlineEdit(field)}
              aria-label={`${FIELD_LABELS[field]} bearbeiten`}
            >
              <IconPencil />
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
  }

  function renderPdfActions() {
    if (!showPdfBlock) return null;
    const hasPdfSource = Boolean(originalPdfFileName || fromPdf || originalPdfHref);
    const replaceLabel = hasPdfSource && pdfViewUrl
      ? 'Aktuelles PDF ersetzen'
      : 'PDF hochladen';
    return (
      <FlowCard className="dai-opreview-pdf-card">
        <div className="dai-opreview-pdf-actions" aria-label="Angebots-PDF">
          {hasPdfSource && (
            <div className="dai-opreview-pdf-doc">
              <div className="dai-opreview-pdf-doc__meta">
                <span className="dai-opreview-pdf-doc__icon" aria-hidden>
                  <IconFile />
                </span>
                <div className="dai-opreview-pdf-doc__text">
                  <span className="dai-opreview-pdf-doc__name">
                    {originalPdfFileName || 'Aktuelles PDF'}
                  </span>
                  <span className="dai-opreview-pdf-doc__hint">
                    Eine aktuelle PDF-Datei – Ersetzen aktualisiert sie jederzeit
                  </span>
                  {!pdfViewUrl && (
                    <span className="dai-opreview-pdf-doc__hint">PDF nicht verfügbar</span>
                  )}
                </div>
              </div>
            </div>
          )}

          <div className="dai-opreview-pdf-btn-row">
            {hasPdfSource && (
              <button
                type="button"
                className={`dai-opreview-pdf-btn dai-opreview-pdf-btn--outline${pdfPreviewOpen ? ' is-open' : ''}`}
                onClick={handleTogglePdfPreview}
                disabled={isReuploading || !pdfViewUrl}
                aria-expanded={pdfPreviewOpen}
              >
                <IconEye />
                <span>{pdfPreviewOpen ? 'Vorschau ausblenden' : 'PDF-Vorschau'}</span>
              </button>
            )}

            {!saved && onReuploadPdf && (
              <button
                type="button"
                className="dai-opreview-pdf-btn dai-opreview-pdf-btn--solid"
                onClick={handleReuploadClick}
                disabled={isReuploading || isSaving}
              >
                <IconUpload />
                <span>{isReuploading ? 'PDF wird gelesen …' : replaceLabel}</span>
              </button>
            )}
          </div>

          {hasPdfSource && pdfViewUrl && pdfPreviewOpen && (
            <div className="dai-opreview-pdf-frame-wrap">
              <iframe
                className="dai-opreview-pdf-frame"
                src={pdfViewUrl}
                title={originalPdfFileName ? `Vorschau: ${originalPdfFileName}` : 'PDF-Vorschau'}
              />
            </div>
          )}

          {hasPdfSource && !pdfViewUrl && (
            <p className="dai-opreview-pdf-missing" role="status">
              PDF fehlt – bitte aktuelles PDF ersetzen
            </p>
          )}

          {!saved && onReuploadPdf && (
            <p className="dai-opreview-pdf-replace__hint">
              Ersetzt die aktuelle PDF-Datei (kein Einmal-Limit)
            </p>
          )}

          {pdfToast && (
            <p className="dai-opreview-pdf-toast" role="status">{pdfToast}</p>
          )}
        </div>
      </FlowCard>
    );
  }

  function renderVersionHistory() {
    if (!versionHistory.length) return null;
    return (
      <section className="dai-opreview-history" aria-label="Angebotsversionen">
        <p className="dai-opreview-history__eyebrow">Historie</p>
        <h3 className="dai-opreview-history__title">Angebotsversionen</h3>
        <ol className="dai-opreview-history__list">
          {versionHistory.map((entry) => (
            <li
              key={`${entry.label}-${entry.at || 'now'}-${entry.isCurrent ? 'c' : 'p'}`}
              className={`dai-opreview-history__item${entry.isCurrent ? ' is-current' : ''}`}
            >
              <div className="dai-opreview-history__body">
                <div className="dai-opreview-history__row">
                  <span className="dai-opreview-history__version">{entry.label}</span>
                  {entry.isCurrent && (
                    <span className="dai-opreview-history__badge">Aktuell</span>
                  )}
                </div>
                {(entry.atLabel || entry.summary) && (
                  <p className="dai-opreview-history__meta">
                    {[entry.atLabel, entry.summary].filter(Boolean).join(' · ')}
                  </p>
                )}
              </div>
              <span className="dai-opreview-history__chevron" aria-hidden>
                <IconChevronRight />
              </span>
            </li>
          ))}
        </ol>
      </section>
    );
  }

  const priceDetailFields = editablePriceDetailFields(activeOfferType);

  const offerTypeAmbiguity = ambiguities.find((a) => a.field === 'offerType');
  const showOfferTypeCallout = requireConfirm
    && lowConfidenceSet.has('offerType')
    && !confirmed.offerType;

  const notReadyLabel = missingCount === 1
    ? 'Noch 1 Angabe prüfen'
    : `Noch ${missingCount} Angaben prüfen`;

  const rateMain = isCash
    ? formatCurrency(offerPrice)
    : (offerPrice != null ? formatEuroDe(Number(offerPrice)) : '–');
  const rateSuffix = !isCash && offerPrice != null ? ' / Monat' : '';
  const showRateStale = (rateNeedsReview || identityConflicts.length > 0) && !isCash;

  return (
    <OfferFlowLayout
      className="dai-offer-preview"
      backLabel={!saved ? '← Zurück' : null}
      onBack={!saved ? onBack : null}
      title="Angebot prüfen"
    >
      {/* 1. FAHRZEUG · RATE */}
      <section
        className={`dai-opreview-summary${requireConfirm ? ' dai-opreview-summary--confirm' : ''}`}
        aria-label="Fahrzeug und Rate"
      >
        <div className="dai-opreview-summary__info">
          <div className="dai-opreview-identity" aria-label="Fahrzeug">
            <p className="dai-opreview-identity__eyebrow">FAHRZEUG</p>
            <div className="dai-opreview-identity__row">
              <IdentityFactPopover
                field="model"
                label="Modell"
                open={identityPopover === 'model'}
                choices={modelChoices}
                selectedId={modelKey}
                selectedLabel={modelLabel}
                onToggle={setIdentityPopover}
                onSelect={(choice) => applyIdentityChoice('model', choice)}
                disabled={saved || !onCommercialChange}
              />
              <IdentityFactPopover
                field="trim"
                label="Linie"
                open={identityPopover === 'trim'}
                choices={trimChoices}
                selectedId={trimId}
                selectedLabel={trimLabel}
                onToggle={setIdentityPopover}
                onSelect={(choice) => applyIdentityChoice('trim', choice)}
                disabled={saved || !onCommercialChange}
              />
              <IdentityFactPopover
                field="powertrain"
                label="Antrieb"
                open={identityPopover === 'powertrain'}
                choices={powertrainChoices}
                selectedId={vehicleConfiguration?.engineId || null}
                selectedLabel={powertrainLabel}
                onToggle={setIdentityPopover}
                onSelect={(choice) => applyIdentityChoice('powertrain', choice)}
                disabled={saved || !onCommercialChange || powertrainChoices.length === 0}
              />
              <IdentityFactPopover
                field="color"
                label="Farbe"
                open={identityPopover === 'color'}
                choices={colorChoices}
                selectedId={colorId}
                selectedLabel={colorLabel}
                onToggle={setIdentityPopover}
                onSelect={(choice) => applyIdentityChoice('color', choice)}
                disabled={saved || !onCommercialChange}
                showSwatch
                swatchColor={colorSwatch}
              />
              <IdentityFactPopover
                field="package"
                label="Pakete"
                open={identityPopover === 'package'}
                choices={packageChoices}
                selectedId={null}
                selectedLabel={packageItems.length ? packageItems.join(' · ') : null}
                onToggle={setIdentityPopover}
                onSelect={(choice) => applyIdentityChoice('package', choice)}
                disabled={saved || !onCommercialChange || packageChoices.length === 0}
              />
            </div>
          </div>
          {showCheckedBadge && (
            <span className="dai-opreview-summary__checked">Angebot geprüft</span>
          )}
          {heroBadges.length > 0 && (
            <div className="dai-opreview-summary__badges">
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
        </div>

        {heroImage && (
          <div className="dai-opreview-summary__media">
            <img
              className="dai-opreview-summary__image"
              src={heroImage}
              alt={vehicleMainLine || 'Fahrzeug'}
            />
          </div>
        )}

        <div
          className={`dai-opreview-summary__rate${showRateStale ? ' dai-opreview-summary__rate--stale' : ''}${offerPrice == null && !showRateStale ? ' dai-opreview-summary__rate--missing' : ''}`}
          aria-label="RATE"
        >
          <p className="dai-opreview-summary__rate-label">RATE</p>
          {showRateStale ? (
            <>
              <p className="dai-opreview-summary__rate-value dai-opreview-summary__rate-value--stale">
                Rate prüfen
              </p>
              <p className="dai-opreview-summary__rate-stale-hint">
                Fahrzeug wurde geändert
                {rateCalibratedFor ? ` · zuvor ${rateCalibratedFor}` : ''}
              </p>
              {offerPrice != null && (
                <p className="dai-opreview-summary__rate-previous">
                  bisher {rateMain}
                  {rateSuffix}
                </p>
              )}
            </>
          ) : offerPrice == null ? (
            <>
              <p className="dai-opreview-summary__rate-value dai-opreview-summary__rate-value--missing">
                fehlt
              </p>
              <p className="dai-opreview-summary__rate-stale-hint">
                PDF hochladen oder Rate eintragen
              </p>
            </>
          ) : (
            <>
              <p className="dai-opreview-summary__rate-value">
                {rateMain}
                {rateSuffix && (
                  <span className="dai-opreview-summary__rate-suffix">{rateSuffix}</span>
                )}
              </p>
              {rateSourceLabel && (
                <p className="dai-opreview-summary__rate-source">{rateSourceLabel}</p>
              )}
            </>
          )}
        </div>
      </section>

      {identityConflicts.length > 0 && (
        <div className="dai-opreview-conflict" role="alertdialog" aria-label="Variante prüfen">
          {identityConflicts.map((conflict) => (
            <div key={conflict.field} className="dai-opreview-conflict__item">
              <p className="dai-opreview-conflict__title">{conflict.label || 'Angabe prüfen'}</p>
              <p className="dai-opreview-conflict__line">
                Entwurf: {conflict.draftValue} · PDF: {conflict.pdfValue}
              </p>
              <div className="dai-opreview-conflict__actions">
                {(conflict.choices || []).slice(0, 2).map((choice) => (
                  <button
                    key={choice.id}
                    type="button"
                    className={`dai-opreview-conflict__btn${choice.id === 'take_pdf' ? ' is-primary' : ''}`}
                    onClick={() => resolveIdentityConflict(conflict, choice)}
                    disabled={saved || !onCommercialChange}
                  >
                    {choice.label}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

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

      {/* 2. Preisdetails / Erkannte Konditionen */}
      {requireConfirm ? (
        <FlowCard className="dai-opreview-price-card">
          <section
            ref={conditionsRef}
            className="dai-opreview-conditions"
            aria-label="Erkannte Konditionen"
          >
            {renderPriceDetailsHeader({
              title: 'KONDITIONEN',
              showEdit: !saved,
            })}

            {showOfferTypeCallout && (
              <div className="dai-opreview-callout" role="status">
                <p className="dai-opreview-callout__text">
                  Angebotsart unsicher – bitte wählen
                  {offerTypeAmbiguity?.message ? `: ${offerTypeAmbiguity.message}` : ''}
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

            <ul
              className="dai-opreview-review-list"
              aria-label="Preisdetails bearbeiten"
            >
              {PDF_CONFIRM_FIELDS.map((field, index) => (
                renderEditableFieldRow(field, index, { showStatus: true })
              ))}
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
                      Alle Konditionen sind korrekt
                    </button>
                    <button
                      type="button"
                      className="dai-opreview-central__secondary"
                      onClick={handleEnableEdit}
                    >
                      <IconPencil />
                      <span>Werte bearbeiten</span>
                    </button>
                  </>
                ) : gate.canSave ? (
                  <p className="dai-opreview-central__done" role="status">
                    Konditionen geprüft
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
                      <IconPencil />
                      <span>Werte bearbeiten</span>
                    </button>
                  </>
                )}
              </div>
            )}
          </section>
        </FlowCard>
      ) : (
        <FlowCard className="dai-opreview-price-card">
          {renderPriceDetailsHeader({
            title: 'KONDITIONEN',
            showEdit: !saved && Boolean(onCommercialChange),
          })}
          {editMode && !saved ? (
            <ul
              ref={conditionsRef}
              className="dai-opreview-review-list"
              aria-label="Preisdetails bearbeiten"
            >
              {priceDetailFields.map((field, index) => (
                renderEditableFieldRow(field, index)
              ))}
            </ul>
          ) : (
            renderReadonlyPriceRows()
          )}
        </FlowCard>
      )}

      {renderPdfActions()}

      {renderVersionHistory()}

      {/* CTA – internal file only; Composer owns customer messaging */}
      <FlowStickyFooter
        className={canFile && !saved ? 'dai-opreview-foot--ready' : ''}
        saved={null}
        hint={!saved && !canFile ? notReadyLabel : null}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="application/pdf,.pdf"
          className="dai-opreview-file-input"
          onChange={handleReuploadFileChange}
          tabIndex={-1}
          aria-hidden
        />
        <FlowPrimaryButton
          className={canFile ? 'dai-opreview-cta--glow' : 'dai-opreview-cta--calm'}
          onClick={handleSaveClick}
          disabled={saved || isSaving || savePending || isReuploading || (requireConfirm && !gate.canSave)}
        >
          {isSaving || savePending
            ? 'Wird gespeichert …'
            : (canFile ? 'Angebot speichern' : notReadyLabel)}
        </FlowPrimaryButton>
      </FlowStickyFooter>
    </OfferFlowLayout>
  );
}
