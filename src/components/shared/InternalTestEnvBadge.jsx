import { useEffect } from 'react';
import { INTERNAL_TEST_BADGE_LABEL, isInternalTestEnv } from '../../config/internalTestEnv.js';
import './internal-test-env.css';

export default function InternalTestEnvBadge() {
  useEffect(() => {
    if (!isInternalTestEnv()) return undefined;
    document.body.classList.add('internal-test-env-active');
    return () => document.body.classList.remove('internal-test-env-active');
  }, []);

  if (!isInternalTestEnv()) return null;

  return (
    <div className="internal-test-env-badge" role="status" aria-live="polite">
      <span className="internal-test-env-badge__dot" aria-hidden />
      <span>{INTERNAL_TEST_BADGE_LABEL}</span>
      <span aria-hidden> · Demo / nicht öffentlich</span>
    </div>
  );
}
