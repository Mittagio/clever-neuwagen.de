import { formatSonderwuenscheSummary } from '../../logic/offerDialogService.js';
import './OfferDialogThread.css';

function formatTime(iso) {
  try {
    return new Date(iso).toLocaleString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '';
  }
}

export default function OfferDialogThread({ history = [], sonderwuensche }) {
  const summary = formatSonderwuenscheSummary(sonderwuensche);

  if (!history.length && !summary.length) {
    return null;
  }

  return (
    <section className="offer-dialog-thread card" aria-label="Ihr Dialog zum Angebot">
      <h2>Ihr Dialog</h2>
      {summary.length > 0 && (
        <div className="offer-dialog-thread__wishes">
          <p className="offer-dialog-thread__wishes-title">Ihre Sonderwünsche</p>
          <ul>
            {summary.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      )}
      {history.length > 0 && (
        <ol className="offer-dialog-thread__list">
          {history.map((entry) => (
            <li
              key={entry.id}
              className={`offer-dialog-thread__item offer-dialog-thread__item--${entry.direction ?? 'inbound'}`}
            >
              <div className="offer-dialog-thread__bubble">
                <p className="offer-dialog-thread__text">{entry.text}</p>
                <time className="offer-dialog-thread__time" dateTime={entry.at}>
                  {formatTime(entry.at)}
                </time>
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
