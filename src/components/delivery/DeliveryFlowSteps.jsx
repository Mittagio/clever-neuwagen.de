import { getDeliveryFlowSteps } from '../../services/delivery/deliveryFlowStatus.js';
import './DeliveryFlowSteps.css';

export default function DeliveryFlowSteps({ deliveryConfirmation, invoiceLinked = false, compact = false }) {
  const steps = getDeliveryFlowSteps(deliveryConfirmation, invoiceLinked);

  return (
    <ol className={`delivery-flow-steps${compact ? ' delivery-flow-steps--compact' : ''}`}>
      {steps.map((step) => (
        <li
          key={step.id}
          className={`delivery-flow-steps__item delivery-flow-steps__item--${step.state}`}
        >
          <span className="delivery-flow-steps__icon">
            {step.state === 'done' && '✓'}
            {step.state === 'error' && '✕'}
            {step.state === 'billable' && '€'}
            {step.state === 'declined' && '–'}
            {step.state === 'pending' && '○'}
          </span>
          <span className="delivery-flow-steps__label">{step.label}</span>
          {step.hint && (
            <span className="delivery-flow-steps__hint">{step.hint}</span>
          )}
        </li>
      ))}
    </ol>
  );
}
