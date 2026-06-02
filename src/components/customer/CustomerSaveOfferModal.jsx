import { useEffect, useState } from 'react';
import { useCustomerAuth } from '../../context/CustomerAuthContext.jsx';
import CustomerAuthFlow from './CustomerAuthFlow.jsx';
import './CustomerSaveOfferModal.css';

export default function CustomerSaveOfferModal({ title, vehicle, offer, onClose, onSaved }) {
  const { isLoggedIn, saveMarketplaceVehicle, registerOffer } = useCustomerAuth();
  const [done, setDone] = useState(false);
  const [saveAfterLogin, setSaveAfterLogin] = useState(false);

  useEffect(() => {
    if (!isLoggedIn || done || !saveAfterLogin) return;
    if (offer) registerOffer(offer);
    else if (vehicle) saveMarketplaceVehicle(vehicle);
    onSaved?.();
    setDone(true);
  }, [isLoggedIn, done, saveAfterLogin, offer, vehicle, registerOffer, saveMarketplaceVehicle, onSaved]);

  if (done) {
    return (
      <div className="cust-save-overlay" onClick={onClose} role="presentation">
        <div className="cust-save-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-labelledby="cust-save-title">
          <h2 id="cust-save-title">Gespeichert</h2>
          <p>Das Angebot liegt in Ihrem Bereich unter „Gemerkte Angebote“.</p>
          <button type="button" className="cust-save-btn" onClick={onClose}>Schließen</button>
        </div>
      </div>
    );
  }

  if (isLoggedIn && saveAfterLogin) {
    return (
      <div className="cust-save-overlay" role="presentation">
        <div className="cust-save-modal" role="dialog">
          <p>Wird gespeichert …</p>
        </div>
      </div>
    );
  }

  function triggerSaveAfterLogin() {
    setSaveAfterLogin(true);
  }

  return (
    <div className="cust-save-overlay" onClick={onClose} role="presentation">
      <div className="cust-save-modal cust-save-modal--wide" onClick={(e) => e.stopPropagation()} role="dialog" aria-labelledby="cust-save-title">
        <button type="button" className="cust-save-close" onClick={onClose} aria-label="Schließen">×</button>
        <h2 id="cust-save-title">{title ?? 'E-Mail eingeben, um Angebot zu speichern'}</h2>
        <p className="cust-save-sub">Ohne Passwort – wir senden Ihnen einen Code per E-Mail.</p>
        <CustomerAuthFlow onSuccess={triggerSaveAfterLogin} />
      </div>
    </div>
  );
}
