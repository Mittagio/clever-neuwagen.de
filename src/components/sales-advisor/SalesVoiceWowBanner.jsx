import './smartSales.css';

export default function SalesVoiceWowBanner({ matchCount = 0, transcript = '' }) {
  if (!transcript || matchCount < 1) return null;

  return (
    <div className="ss-voice-wow" role="status">
      <p className="ss-voice-wow__title">
        {matchCount} passende Fahrzeuge gefunden
      </p>
      <p className="ss-voice-wow__sub">
        Clever hat Ihr Gespräch verstanden und die besten Treffer sortiert.
      </p>
      {transcript && (
        <p className="ss-voice-wow__quote">„{transcript.slice(0, 120)}{transcript.length > 120 ? '…' : ''}"</p>
      )}
    </div>
  );
}
