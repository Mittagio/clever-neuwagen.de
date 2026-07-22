import './clever-conversation.css';

export default function CleverPluginBrandBar({ branding }) {
  if (!branding) return null;

  return (
    <header className="cc-plugin-brand" aria-label="Händler">
      <div className="cc-plugin-brand__main">
        {branding.logoUrl ? (
          <img
            className="cc-plugin-brand__logo"
            src={branding.logoUrl}
            alt={branding.dealerName || 'Autohaus'}
          />
        ) : (
          <span className="cc-plugin-brand__name">{branding.dealerName}</span>
        )}
        <div className="cc-plugin-brand__meta">
          {!branding.logoUrl && branding.dealerName && (
            <span className="cc-plugin-brand__tag">Kia Beratung</span>
          )}
          {branding.logoUrl && (
            <span className="cc-plugin-brand__name cc-plugin-brand__name--beside">
              {branding.dealerName}
            </span>
          )}
          <span className="cc-plugin-brand__clever">{branding.cleverSupportLine}</span>
        </div>
      </div>
      {(branding.trustLine || branding.hoursToday) && (
        <div className="cc-plugin-brand__trust">
          {branding.trustLine && (
            <p className="cc-plugin-brand__trust-line">{branding.trustLine}</p>
          )}
          {branding.hoursToday && (
            <p className="cc-plugin-brand__hours">{branding.hoursToday}</p>
          )}
        </div>
      )}
    </header>
  );
}
