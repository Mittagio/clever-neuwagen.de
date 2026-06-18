import { useEffect } from 'react';
import { isInternalTestEnv } from '../../config/internalTestEnv.js';

function ensureMeta(name, content) {
  let meta = document.querySelector(`meta[name="${name}"]`);
  if (!meta) {
    meta = document.createElement('meta');
    meta.setAttribute('name', name);
    document.head.appendChild(meta);
  }
  meta.setAttribute('content', content);
}

export default function InternalTestEnvHead() {
  useEffect(() => {
    if (!isInternalTestEnv()) return undefined;

    ensureMeta('robots', 'noindex, nofollow');
    ensureMeta('googlebot', 'noindex, nofollow');

    return undefined;
  }, []);

  return null;
}
