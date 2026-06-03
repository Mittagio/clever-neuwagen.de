import { buildLocalAvailabilityMessage } from '../../logic/discoveryResultsPresentation.js';
import './discovery-results.css';

export default function DiscoveryLocalBanner({ match, dealerCount }) {
  const msg = buildLocalAvailabilityMessage(match, dealerCount);
  return (
    <p className="disc-local-banner">
      <strong>{msg.title}</strong>
      <span>{msg.subtitle}</span>
    </p>
  );
}
