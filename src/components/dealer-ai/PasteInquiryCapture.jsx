import { Link } from 'react-router-dom';
import './PasteInquiryCapture.css';

export default function PasteInquiryCapture({ compact = false }) {
  if (compact) {
    return (
      <section className="paste-inquiry-capture paste-inquiry-capture--compact" aria-label="Anfrage einfügen">
        <div className="paste-inquiry-capture__copy">
          <p className="paste-inquiry-capture__title">Anfrage einfügen</p>
          <p className="paste-inquiry-capture__hint">
            Kundenmail, mobile.de, Website oder Nachricht – Clever erkennt den Typ automatisch.
          </p>
        </div>
        <Link to="/verkaufsassistent" className="paste-inquiry-capture__link">
          Clever erkennen
        </Link>
      </section>
    );
  }

  return null;
}
