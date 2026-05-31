const MOCK_TRANSCRIPT =
  'Ich suche ein Familien-SUV mit maximal 400 Euro Leasingrate und schneller Lieferung.';

export default function LandingSpeechModal({ open, onClose, onUseText }) {
  if (!open) return null;

  return (
    <div className="lp-modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="lp-modal"
        role="dialog"
        aria-labelledby="lp-speech-title"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="lp-speech-title" className="lp-modal__title">Spracheingabe</h2>
        <p className="lp-modal__text">
          Spracheingabe wird vorbereitet. Aktuell bitte Text eingeben.
        </p>
        <p className="lp-modal__mock-label">Demo-Erkennung:</p>
        <blockquote className="lp-modal__quote">&bdquo;{MOCK_TRANSCRIPT}&ldquo;</blockquote>
        <div className="lp-modal__actions">
          <button type="button" className="lp-btn lp-btn--ghost" onClick={onClose}>
            Schließen
          </button>
          <button
            type="button"
            className="lp-btn lp-btn--primary"
            onClick={() => onUseText(MOCK_TRANSCRIPT)}
          >
            Text übernehmen
          </button>
        </div>
      </div>
    </div>
  );
}
