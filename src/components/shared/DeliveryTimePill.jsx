export default function DeliveryTimePill({ label, className = '' }) {
  if (!label) return null;
  return (
    <p className={`delivery-pill${className ? ` ${className}` : ''}`}>
      <span className="delivery-pill__icon" aria-hidden>🚚</span>
      {label}
    </p>
  );
}
