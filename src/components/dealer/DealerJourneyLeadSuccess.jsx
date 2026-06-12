import { formatJourneyLeadDossierLines } from '../../services/dealer/journeyLeadService.js';
import { getInitials } from '../../logic/leadService.js';
import './dealer-landing.css';

/**
 * Bestätigung nach Phase 6 – was der Händler erhält.
 */
export default function DealerJourneyLeadSuccess({
  contactName,
  dealerName,
  dealerContact,
  inquiryBrief,
  cleverQuotePercent,
  wantTestDrive = false,
}) {
  const lines = formatJourneyLeadDossierLines(inquiryBrief);
  const cq = cleverQuotePercent ?? inquiryBrief?.cleverQuotePercent;
  const advisorName = dealerContact?.name ?? inquiryBrief?.dealer?.contactName;
  const advisorRole = dealerContact?.role ?? inquiryBrief?.dealer?.contactRole;

  return (
    <section className="dl-lead-success" aria-live="polite">
      <p className="dl-lead-success__phase">Anfrage gesendet</p>
      <h2 className="dl-lead-success__title">
        Danke
        {contactName ? `, ${contactName.split(' ')[0]}` : ''}
        !
      </h2>
      <p className="dl-lead-success__sub">
        {dealerName ?? 'Ihr Händler'}
        {' '}
        erhält Ihr Dossier mit Konfiguration, Kaufart und Sonderkonditionen.
        {wantTestDrive && ' Eine Probefahrt ist gewünscht.'}
      </p>

      {advisorName && (
        <div className="dl-lead-success__advisor">
          <span className="dl-lead-success__advisor-avatar" aria-hidden>
            {getInitials(advisorName)}
          </span>
          <div>
            <p className="dl-lead-success__advisor-name">{advisorName}</p>
            {advisorRole && (
              <p className="dl-lead-success__advisor-role">{advisorRole}</p>
            )}
          </div>
        </div>
      )}

      <div className="dl-lead-success__dossier">
        <p className="dl-lead-success__dossier-label">Das sieht der Händler</p>
        <ul className="dl-lead-success__dossier-list">
          {lines.map((line) => (
            <li key={line}>{line}</li>
          ))}
          {cq != null && !lines.some((l) => l.includes('CleverQuote')) && (
            <li>
              CleverQuote:
              {' '}
              {cq}
              %
            </li>
          )}
        </ul>
      </div>

      <p className="dl-lead-success__hint">
        Sie werden in Kürze kontaktiert – ohne erneutes Durchfragen aller Details.
      </p>
    </section>
  );
}
