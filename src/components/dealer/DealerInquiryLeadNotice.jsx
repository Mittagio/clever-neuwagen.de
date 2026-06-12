import './dealer-landing.css';

/**
 * Hinweis wenn eine bestehende CRM-Anfrage verknüpft wurde.
 */
export default function DealerInquiryLeadNotice({ syncResult }) {
  if (!syncResult?.message) return null;

  return (
    <p className="dl-inquiry-lead-notice" role="status" aria-live="polite">
      <span className="dl-inquiry-lead-notice__icon" aria-hidden>✓</span>
      {syncResult.message}
    </p>
  );
}
