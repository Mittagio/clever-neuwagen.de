import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  CONSENT_CATEGORIES,
  acceptAll,
  acceptCustom,
  acceptEssentialOnly,
  getStoredConsent,
} from '../../services/cookieConsentService.js';
import './CookieConsent.css';

export default function CookieConsentBanner() {
  const [visible, setVisible] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [draft, setDraft] = useState({ analytics: false, marketing: false });

  useEffect(() => {
    if (!getStoredConsent()) setVisible(true);
  }, []);

  function closeBanner() {
    setVisible(false);
    setShowSettings(false);
  }

  function handleEssential() {
    acceptEssentialOnly();
    closeBanner();
  }

  function handleAcceptAll() {
    acceptAll();
    closeBanner();
  }

  function handleSaveSettings() {
    acceptCustom(draft);
    closeBanner();
  }

  if (!visible) return null;

  return (
    <div className="cookie-consent" role="dialog" aria-labelledby="cookie-consent-title" aria-modal="true">
      <div className="cookie-consent__inner">
        {!showSettings ? (
          <>
            <div className="cookie-consent__body">
              <h2 id="cookie-consent-title" className="cookie-consent__title">Cookies & Datenschutz</h2>
              <p className="cookie-consent__text">
                Wir verwenden derzeit nur <strong>technisch notwendige</strong> Cookies
                und lokale Speicherung für den Betrieb der Plattform.
              </p>
              <p className="cookie-consent__text cookie-consent__text--muted">
                Analyse- und Marketing-Tools (Google Analytics, Meta Pixel, Microsoft Clarity, Hotjar)
                sind vorbereitet, aber noch nicht aktiv.
              </p>
              <Link to="/legal/datenschutz" className="cookie-consent__link">
                Datenschutzerklärung
              </Link>
            </div>
            <div className="cookie-consent__actions">
              <button type="button" className="cookie-consent__btn cookie-consent__btn--ghost" onClick={() => setShowSettings(true)}>
                Einstellungen
              </button>
              <button type="button" className="cookie-consent__btn cookie-consent__btn--secondary" onClick={handleEssential}>
                Nur notwendige Cookies
              </button>
              <button type="button" className="cookie-consent__btn cookie-consent__btn--primary" onClick={handleAcceptAll}>
                Alle akzeptieren
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="cookie-consent__body cookie-consent__body--settings">
              <h2 className="cookie-consent__title">Cookie-Einstellungen</h2>
              <p className="cookie-consent__text cookie-consent__text--muted">
                Wählen Sie, welche Kategorien Sie zulassen möchten. Analyse- und Marketing-Tools
                werden erst nach technischer Aktivierung geladen.
              </p>

              <ul className="cookie-consent__categories">
                {Object.values(CONSENT_CATEGORIES).map((cat) => {
                  const checked = cat.required || draft[cat.id];
                  return (
                    <li key={cat.id} className="cookie-consent__category">
                      <label className="cookie-consent__category-label">
                        <input
                          type="checkbox"
                          checked={!!checked}
                          disabled={cat.required || !cat.active}
                          onChange={(e) => {
                            if (cat.required) return;
                            setDraft((prev) => ({ ...prev, [cat.id]: e.target.checked }));
                          }}
                        />
                        <span>
                          <strong>{cat.label}</strong>
                          {!cat.active && cat.id !== 'essential' && (
                            <span className="cookie-consent__badge">Vorbereitet</span>
                          )}
                        </span>
                      </label>
                      <p className="cookie-consent__category-desc">{cat.description}</p>
                      {cat.tools?.length > 0 && (
                        <p className="cookie-consent__category-tools">{cat.tools.join(' · ')}</p>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
            <div className="cookie-consent__actions">
              <button type="button" className="cookie-consent__btn cookie-consent__btn--ghost" onClick={() => setShowSettings(false)}>
                Zurück
              </button>
              <button type="button" className="cookie-consent__btn cookie-consent__btn--primary" onClick={handleSaveSettings}>
                Auswahl speichern
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
