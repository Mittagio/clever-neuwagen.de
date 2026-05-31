import { RATE_DISCLAIMER } from '../../constants/legal.js';
import './LegalDisclaimer.css';

export default function LegalDisclaimer({ compact = false, className = '' }) {
  return (
    <p
      className={`legal-disclaimer${compact ? ' legal-disclaimer--compact' : ''} ${className}`.trim()}
      role="note"
    >
      {RATE_DISCLAIMER}
    </p>
  );
}

export { RATE_DISCLAIMER };
