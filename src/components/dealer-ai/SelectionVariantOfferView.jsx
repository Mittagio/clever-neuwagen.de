import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { usePublishedDealerConditions } from '../../context/DealerConditionsContext.jsx';
import {
  buildConfiguratorConditionsLine,
  buildDraftFromSelectionVariant,
  computeVariantConfiguratorPreview,
  formatConfiguratorUvpAmount,
  resolveVariantDisplayAmounts,
} from '../../services/sales/offerVariantConfigurator.js';
import {
  formatVariantOfferBadge,
  readVariantOfferPdf,
  variantHasOfferPdf,
} from '../../services/sales/selectionVariantOffer.js';
import { formatFileSize, formatUploadWhen } from '../../services/vehicleOffer.js';
import { resolveConfigureHeroImage } from '../../services/dealerAiVehicleConfigureFlow.js';
import './SelectionVariantOfferView.css';

export default function SelectionVariantOfferView({
  group,
  variant,
  lead,
  onBack,
  onUploadPdf,
  onDeletePdf,
  onEditConfiguration,
  isSaving = false,
}) {
  const { publishedConditions: conditions } = usePublishedDealerConditions();
  const fileInputRef = useRef(null);
  const [toast, setToast] = useState('');
  const [localVariant, setLocalVariant] = useState(variant);

  useEffect(() => {
    setLocalVariant(variant);
  }, [variant]);

  const draft = useMemo(
    () => buildDraftFromSelectionVariant({ group, variant: localVariant, lead, conditions }),
    [group, localVariant, lead, conditions],
  );

  const preview = useMemo(
    () => computeVariantConfiguratorPreview(draft, conditions),
    [draft, conditions],
  );

  const displayAmounts = useMemo(
    () => resolveVariantDisplayAmounts(draft, preview, localVariant),
    [draft, preview, localVariant],
  );

  const heroImage = useMemo(() => resolveConfigureHeroImage(draft), [draft]);
  const offerPdf = readVariantOfferPdf(localVariant);
  const conditionsLine = buildConfiguratorConditionsLine(draft, preview.paymentLabel);
  const upeLine = formatConfiguratorUvpAmount(draft);

  function showToast(message) {
    setToast(message);
    setTimeout(() => setToast(''), 2800);
  }

  const handleFile = useCallback(async (file) => {
    if (!file || file.type !== 'application/pdf') {
      showToast('Bitte eine PDF-Datei wählen');
      return;
    }
    try {
      const next = await onUploadPdf?.(localVariant, file);
      if (next) {
        setLocalVariant(next);
        showToast('Angebot-PDF hinterlegt');
      }
    } catch {
      showToast('Upload fehlgeschlagen');
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, [localVariant, onUploadPdf]);

  const onDrop = useCallback((event) => {
    event.preventDefault();
    const file = event.dataTransfer?.files?.[0];
    if (file) handleFile(file);
  }, [handleFile]);

  async function handleDelete() {
    const next = await onDeletePdf?.(localVariant);
    if (next) {
      setLocalVariant(next);
      showToast('PDF entfernt');
    }
  }

  if (!group || !localVariant || !draft) return null;

  const title = `${group.modelLabel} · ${localVariant.trimLabel ?? 'Ausstattung'}`;

  return (
    <div className="svo" role="dialog" aria-label="Angebot und PDF">
      <div className="svo__scroll">
        <header className="svo__header">
          <button type="button" className="svo__back" onClick={onBack}>
            ← Zur Auswahl
          </button>
          <h1 className="svo__title">Angebot &amp; PDF</h1>
          <p className="svo__subtitle">{title}</p>
        </header>

        {heroImage ? (
          <div className="svo__hero">
            <img src={heroImage} alt={title} />
          </div>
        ) : null}

        <section className="svo__card">
          <h2 className="svo__card-title">Konfiguration</h2>
          {conditionsLine ? <p className="svo__line">{conditionsLine}</p> : null}
          {upeLine !== '–' ? <p className="svo__line">UPE: {upeLine}</p> : null}
          {displayAmounts.formatted !== '–' ? (
            <p className="svo__rate">{displayAmounts.formatted}</p>
          ) : null}
          <button
            type="button"
            className="svo__link-btn"
            onClick={() => onEditConfiguration?.(group, localVariant)}
          >
            Konfiguration anpassen
          </button>
        </section>

        <section className="svo__card">
          <div className="svo__card-head">
            <h2 className="svo__card-title">Offizielles Angebot (PDF)</h2>
            <span className={`svo__badge${variantHasOfferPdf(localVariant) ? ' svo__badge--ready' : ''}`}>
              {formatVariantOfferBadge(localVariant)}
            </span>
          </div>
          <p className="svo__hint">
            Laden Sie hier das verbindliche Angebot aus Ihrem Leasing- oder Finanzprogramm hoch.
            Der Kunde sieht es im Angebotslink zum Download.
          </p>

          {!offerPdf ? (
            <div
              className="svo__upload"
              onDragOver={(e) => e.preventDefault()}
              onDrop={onDrop}
            >
              <p className="svo__upload-title">Noch kein PDF hinterlegt</p>
              <input
                ref={fileInputRef}
                type="file"
                accept="application/pdf"
                className="svo__upload-input"
                onChange={(e) => handleFile(e.target.files?.[0])}
              />
              <button
                type="button"
                className="svo__btn svo__btn--primary"
                disabled={isSaving}
                onClick={() => fileInputRef.current?.click()}
              >
                PDF hochladen
              </button>
            </div>
          ) : (
            <div className="svo__pdf-row">
              <div>
                <p className="svo__pdf-name">{offerPdf.fileName}</p>
                <p className="svo__pdf-meta">
                  {formatUploadWhen(offerPdf.uploadedAt)}
                  {offerPdf.sizeBytes ? ` · ${formatFileSize(offerPdf.sizeBytes)}` : ''}
                </p>
              </div>
              <div className="svo__pdf-actions">
                {offerPdf.dataUrl && (
                  <button
                    type="button"
                    className="svo__btn svo__btn--ghost"
                    onClick={() => window.open(offerPdf.dataUrl, '_blank', 'noopener')}
                  >
                    Öffnen
                  </button>
                )}
                <button
                  type="button"
                  className="svo__btn svo__btn--ghost"
                  disabled={isSaving}
                  onClick={() => fileInputRef.current?.click()}
                >
                  Ersetzen
                </button>
                <button
                  type="button"
                  className="svo__btn svo__btn--ghost"
                  disabled={isSaving}
                  onClick={handleDelete}
                >
                  Löschen
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="application/pdf"
                  className="svo__upload-input"
                  onChange={(e) => handleFile(e.target.files?.[0])}
                />
              </div>
            </div>
          )}
        </section>
      </div>

      <footer className="svo__footer">
        <button type="button" className="svo__btn svo__btn--secondary" onClick={onBack}>
          Fertig
        </button>
      </footer>

      {toast ? <p className="svo__toast" role="status">{toast}</p> : null}
    </div>
  );
}
