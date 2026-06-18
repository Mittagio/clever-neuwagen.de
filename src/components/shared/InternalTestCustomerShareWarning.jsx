import { isInternalTestEnv } from '../../config/internalTestEnv.js';
import './internal-test-env.css';

export default function InternalTestCustomerShareWarning({ className = '' }) {
  if (!isInternalTestEnv()) return null;

  return (
    <p
      className={`internal-test-share-warning${className ? ` ${className}` : ''}`}
      role="note"
    >
      Interne Testversion – bitte nicht an Kunden weitergeben.
    </p>
  );
}
