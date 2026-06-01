import { Link } from 'react-router-dom';

function CopyBlock({ label, text }) {
  if (!text) return null;

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(text);
    } catch { /* */ }
  }

  return (
    <div className="dai-copy-block">
      <div className="dai-copy-block__head">
        <span>{label}</span>
        <button type="button" className="dai-copy-btn" onClick={handleCopy}>Kopieren</button>
      </div>
      <pre className="dai-copy-block__text">{text}</pre>
    </div>
  );
}

export default function DealerAiResultPanel({ result, vehicleCard }) {
  if (!result) return null;

  return (
    <section className="dai-card dai-card--result">
      <header className="dai-card__head">
        <h2 className="dai-card__title">Ergebnis</h2>
        <span className="dai-result-badge">{result.message}</span>
      </header>

      {result.offerCode && (
        <div className="dai-result-block">
          <p className="dai-result-kpi">{result.offerCode}</p>
          <p className="dai-result-sub">Angebotsnummer</p>
          <div className="dai-result-links">
            <Link to={`/angebot/${result.offerCode}`} className="dai-link">Angebot öffnen</Link>
            <Link to="/offers" className="dai-link">Angebotszentrum</Link>
            {result.leadId && <Link to="/leads" className="dai-link">CRM / Leads</Link>}
          </div>
        </div>
      )}

      {vehicleCard && (
        <article className="dai-vehicle-card">
          <h3 className="dai-vehicle-card__title">{vehicleCard.label}</h3>
          <p className="dai-vehicle-card__meta">
            {[vehicleCard.motor, vehicleCard.color, vehicleCard.rate && `${vehicleCard.rate} €/Mt.`]
              .filter(Boolean)
              .join(' · ')}
          </p>
          {vehicleCard.delivery && (
            <p className="dai-vehicle-card__delivery">{vehicleCard.delivery}</p>
          )}
        </article>
      )}

      {result.inventoryIds?.length > 0 && (
        <div className="dai-result-block">
          <p className="dai-result-sub">{result.inventoryIds.length} Lagerfahrzeug(e)</p>
          <Link to="/backend" className="dai-link">Im Backend prüfen → Lager</Link>
        </div>
      )}

      {result.texts && (
        <div className="dai-listing-texts">
          <CopyBlock label="mobile.de Titel" text={result.texts.mobileDe} />
          <CopyBlock label="Leasingmarkt" text={result.texts.leasingmarkt} />
          <CopyBlock label="WhatsApp" text={result.texts.whatsapp} />
          <CopyBlock label="E-Mail" text={result.texts.email} />
          {result.insertGeneratorUrl && (
            <Link to={result.insertGeneratorUrl} className="dai-link">Inseratgenerator öffnen →</Link>
          )}
        </div>
      )}

      {(result.landingPage || result.syncStatus) && (
        <div className="dai-sync">
          <p className="dai-sync__label">Sync-Status</p>
          <p className="dai-sync__value">
            {result.syncStatus === 'synchronized' && '🟢 Händlerseite synchronisiert'}
            {result.syncStatus === 'draft_pending' && '🟡 Entwurf – bitte im Backend veröffentlichen'}
            {result.syncStatus === 'created' && '🟢 Angebot & CRM angelegt'}
          </p>
          {result.landingPage && (
            <Link to={result.landingPage} className="dai-link">Landingpage / Händlerseite</Link>
          )}
        </div>
      )}
    </section>
  );
}
