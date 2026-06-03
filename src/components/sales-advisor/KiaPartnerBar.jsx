import { KIA_PARTNER } from '../../data/kia/kiaPartnerHub.js';

export default function KiaPartnerBar({ activeModelCount = 0, registryCount = 2 }) {
  return (
    <div className="ss-kia-partner" role="status">
      <span className="ss-kia-partner__badge" aria-hidden="true">Kia</span>
      <div className="ss-kia-partner__copy">
        <strong>{KIA_PARTNER.tagline}</strong>
        <p>
          Verkaufsmodus: nur Kia
          {activeModelCount > 0 ? ` · ${activeModelCount} aktive Modelle` : ''}
          {` · CleverQuote voll für ${registryCount} Registry-Modelle`}
        </p>
      </div>
    </div>
  );
}
