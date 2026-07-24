import './PasteInquiryPreview.css';

function PreviewBlock({ title, lines = [], children }) {
  if (!lines.length && !children) return null;
  return (
    <section className="paste-inquiry-preview__block">
      <h3 className="paste-inquiry-preview__block-title">{title}</h3>
      {lines.map((line) => (
        <p key={line} className="paste-inquiry-preview__line">{line}</p>
      ))}
      {children}
    </section>
  );
}

export default function PasteInquiryPreview({
  preview,
  onApplyStock,
  onApplyCustomer,
  onManualEdit,
  onOpenAkte,
  onPrepareAnswer,
  onCreateOffer,
  onOpenListing,
  isExecuting = false,
  appliedLeadId = null,
}) {
  if (!preview) return null;

  return (
    <section className="paste-inquiry-preview" aria-label="Erkennungsvorschau">
      <header className="paste-inquiry-preview__head">
        <p className="paste-inquiry-preview__kicker">{preview.title}</p>
        <p className="paste-inquiry-preview__type">{preview.inquiryTypeLabel}</p>
        {preview.sourceLabel && (
          <p className="paste-inquiry-preview__source">Quelle: {preview.sourceLabel}</p>
        )}
      </header>

      {preview.uncertain && (
        <div className="paste-inquiry-preview__uncertain">
          <p>Clever ist nicht sicher. Bitte wählen Sie, wie die Anfrage übernommen werden soll.</p>
          <div className="paste-inquiry-preview__uncertain-actions">
            <button type="button" className="paste-inquiry-preview__chip" onClick={onApplyStock} disabled={isExecuting}>
              Als Bestandsfahrzeug-Anfrage übernehmen
            </button>
            <button type="button" className="paste-inquiry-preview__chip" onClick={onApplyCustomer} disabled={isExecuting}>
              Als normale Kundenanfrage übernehmen
            </button>
            <button type="button" className="paste-inquiry-preview__chip paste-inquiry-preview__chip--ghost" onClick={onManualEdit} disabled={isExecuting}>
              Manuell bearbeiten
            </button>
          </div>
        </div>
      )}

      <PreviewBlock title="Kunde" lines={preview.customerLines} />

      <PreviewBlock title="Anfrage">
        <p className="paste-inquiry-preview__line">{preview.inquiryTypeLabel}</p>
      </PreviewBlock>

      {preview.vehicleLines?.length > 0 && (
        <PreviewBlock title="Fahrzeug" lines={preview.vehicleLines} />
      )}

      {preview.wishLines?.length > 0 && (
        <PreviewBlock title="Notiert" lines={preview.wishLines} />
      )}

      {preview.customerMessage && (
        <PreviewBlock title="Nachricht">
          <p className="paste-inquiry-preview__message">{preview.customerMessage}</p>
        </PreviewBlock>
      )}

      {!preview.uncertain && (
        <div className="paste-inquiry-preview__actions">
          <button
            type="button"
            className="paste-inquiry-preview__primary"
            onClick={onApplyStock}
            disabled={isExecuting}
          >
            {appliedLeadId ? 'Kundenakte öffnen' : 'Kundenakte erstellen / öffnen'}
          </button>
          <button type="button" className="paste-inquiry-preview__secondary" onClick={onPrepareAnswer} disabled={isExecuting || !appliedLeadId}>
            Antwort vorbereiten
          </button>
          <button type="button" className="paste-inquiry-preview__secondary" onClick={onCreateOffer} disabled={isExecuting || !appliedLeadId}>
            Angebot erstellen
          </button>
          {preview.vehicleUrl && (
            <button type="button" className="paste-inquiry-preview__secondary" onClick={onOpenListing} disabled={isExecuting}>
              Inserat öffnen
            </button>
          )}
          <button type="button" className="paste-inquiry-preview__ghost" onClick={onManualEdit} disabled={isExecuting}>
            Manuell bearbeiten
          </button>
        </div>
      )}
    </section>
  );
}
