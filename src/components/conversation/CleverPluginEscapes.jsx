import { useState } from 'react';
import {
  buildWhatsAppUrlWithMessage,
  buildWhatsAppWishMessage,
} from '../../services/consultation/cleverDealerPluginEscape.js';
import './clever-conversation.css';

/**
 * Dezente Escape-Kanäle: WhatsApp + Anrufen (nie Formularzwang).
 */
export default function CleverPluginEscapes({
  branding,
  notepadLabels = [],
  dealerName = '',
  onBeforeWhatsApp = null,
}) {
  const [waStep, setWaStep] = useState(null);
  const [callHint, setCallHint] = useState(false);

  if (!branding?.whatsappHref && !branding?.phoneHref) return null;

  function openWhatsApp(withWishes) {
    const message = withWishes
      ? buildWhatsAppWishMessage({ notepadLabels, dealerName })
      : 'Hallo, ich informiere mich gerade auf Ihrer Website.';
    const url = buildWhatsAppUrlWithMessage(branding.whatsappHref, message);
    onBeforeWhatsApp?.({ withWishes });
    setWaStep(null);
    if (url) window.open(url, '_blank', 'noopener,noreferrer');
  }

  function handleWhatsAppClick() {
    if ((notepadLabels?.length ?? 0) > 0) {
      setWaStep('confirm');
      return;
    }
    openWhatsApp(false);
  }

  function handleCallClick() {
    if ((notepadLabels?.length ?? 0) > 0 && !callHint) {
      setCallHint(true);
      return;
    }
    if (branding.phoneHref) {
      window.location.href = branding.phoneHref;
    }
  }

  return (
    <div className="cc-plugin-escapes" aria-label="Direkt kontaktieren">
      <p className="cc-plugin-escapes__label">Lieber direkt sprechen?</p>
      <div className="cc-plugin-escapes__row">
        {branding.whatsappHref && (
          <button
            type="button"
            className="cc-plugin-escapes__btn"
            onClick={handleWhatsAppClick}
          >
            WhatsApp
          </button>
        )}
        {branding.phoneHref && (
          <button
            type="button"
            className="cc-plugin-escapes__btn"
            onClick={handleCallClick}
          >
            Anrufen
          </button>
        )}
      </div>

      {waStep === 'confirm' && (
        <div className="cc-plugin-escapes__sheet" role="dialog" aria-label="Wünsche mit WhatsApp">
          <p className="cc-plugin-escapes__sheet-text">
            Möchten Sie Ihre bisherigen Wünsche direkt mitgeben?
          </p>
          <div className="cc-plugin-escapes__sheet-actions">
            <button
              type="button"
              className="cc-plugin-escapes__btn cc-plugin-escapes__btn--primary"
              onClick={() => openWhatsApp(true)}
            >
              Ja, Wünsche mitgeben
            </button>
            <button
              type="button"
              className="cc-plugin-escapes__btn"
              onClick={() => openWhatsApp(false)}
            >
              Nur WhatsApp öffnen
            </button>
            <button
              type="button"
              className="cc-plugin-escapes__link"
              onClick={() => setWaStep(null)}
            >
              Abbrechen
            </button>
          </div>
        </div>
      )}

      {callHint && (
        <div className="cc-plugin-escapes__sheet" role="status">
          <p className="cc-plugin-escapes__sheet-text">
            Sie können auch erst Ihre Wünsche weitergeben, damit der Verkäufer bereits weiß, worum es geht.
          </p>
          <div className="cc-plugin-escapes__sheet-actions">
            <a className="cc-plugin-escapes__btn cc-plugin-escapes__btn--primary" href={branding.phoneHref}>
              Trotzdem anrufen
            </a>
            <button
              type="button"
              className="cc-plugin-escapes__link"
              onClick={() => setCallHint(false)}
            >
              Schließen
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
