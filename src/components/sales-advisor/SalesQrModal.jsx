export default function SalesQrModal({ open, url, onClose }) {
  if (!open || !url) return null;

  const qrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=280x280&margin=12&data=${encodeURIComponent(url)}`;

  return (
    <div className="ss-qr-backdrop" role="presentation" onClick={onClose}>
      <div className="ss-qr-modal" role="dialog" aria-labelledby="ss-qr-title" onClick={(e) => e.stopPropagation()}>
        <header className="ss-qr-modal__head">
          <h2 id="ss-qr-title">QR-Code für Ihren Kunden</h2>
          <button type="button" className="ss-qr-modal__close" onClick={onClose} aria-label="Schließen">×</button>
        </header>
        <p className="ss-qr-modal__hint">Kunde scannt – landet auf dem persönlichen Fahrzeugvergleich.</p>
        <img src={qrSrc} alt="QR-Code zum Fahrzeugvergleich" className="ss-qr-modal__image" width={280} height={280} />
        <p className="ss-qr-modal__url">{url}</p>
      </div>
    </div>
  );
}
