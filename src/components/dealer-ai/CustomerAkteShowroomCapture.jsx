import {
  applyShowroomCaptureToLead,
  buildShowroomCaptureSummary,
} from '../../services/showroom/showroomQuickCaptureService.js';
import '../../components/showroom/showroom-mode.css';

export default function CustomerAkteShowroomCapture({
  capture,
  onApply,
  onEdit,
  onSuggestVehicles,
  onPrepareOffer,
}) {
  if (!capture || capture.status === 'applied') return null;

  const summary = buildShowroomCaptureSummary(capture);

  return (
    <section className="showroom-akte-banner" aria-labelledby="showroom-akte-title">
      <h2 id="showroom-akte-title" className="showroom-akte-banner__title">
        Neue Schnellaufnahme vorhanden
      </h2>
      <p className="showroom-akte-banner__text">
        Aus dem Showroom Modus – bitte übernehmen oder ergänzen.
      </p>
      {summary.length > 0 && (
        <div className="showroom-akte-banner__summary">
          {summary.map((line) => (
            <p key={line} style={{ margin: '0 0 0.25rem' }}>{line}</p>
          ))}
        </div>
      )}
      <div className="showroom-akte-banner__actions">
        <button
          type="button"
          className="showroom-akte-banner__btn showroom-akte-banner__btn--primary"
          onClick={onApply}
        >
          Übernehmen
        </button>
        <button type="button" className="showroom-akte-banner__btn" onClick={onEdit}>
          Bearbeiten
        </button>
        <button type="button" className="showroom-akte-banner__btn" onClick={onEdit}>
          Ergänzen
        </button>
        <button type="button" className="showroom-akte-banner__btn" onClick={onSuggestVehicles}>
          Fahrzeuge vorschlagen
        </button>
        <button type="button" className="showroom-akte-banner__btn" onClick={onPrepareOffer}>
          Angebot vorbereiten
        </button>
      </div>
    </section>
  );
}

export { applyShowroomCaptureToLead };
