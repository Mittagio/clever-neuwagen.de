import { getRegistrationStatusMeta } from '../../logic/dealerRegistration.js';
import './RegistrationStatusBadge.css';

export default function RegistrationStatusBadge({ status }) {
  const meta = getRegistrationStatusMeta(status);
  return (
    <span className={`reg-status reg-status--${meta.tone}`}>
      {meta.label}
    </span>
  );
}
