import { useState } from 'react';
import EquipmentFeatureSourceModal from '../admin/EquipmentFeatureSourceModal.jsx';
import { getEquipmentWishStatusBadge } from '../../data/equipment/equipmentWishTypes.js';
import { buildSourceDetailFromEquipmentWish } from '../../services/sales/equipmentOfferTransferService.js';
import './CustomerAkteEquipmentWishes.css';

function EquipmentWishCard({ wish, onCopyFeedback }) {
  const badge = getEquipmentWishStatusBadge(wish.status);
  const [copyMessage, setCopyMessage] = useState('');

  async function handleCopy() {
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(wish.customerText);
      } else {
        console.log('[CustomerAkteEquipmentWishes] copy', wish.customerText);
      }
      setCopyMessage('Text kopiert.');
      onCopyFeedback?.('Text kopiert.');
    } catch {
      setCopyMessage('Kopieren fehlgeschlagen.');
    }
  }

  const solutionHint = wish.packageLabel
    ? `über ${wish.packageLabel} erhältlich`
    : wish.recommendedTrimLabel
      ? `ab ${wish.recommendedTrimLabel}`
      : wish.statusLabel;

  return (
    <article className="cust-eq-wish">
      <div className="cust-eq-wish__head">
        <div>
          <h3 className="cust-eq-wish__title">{wish.featureLabel}</h3>
          <p className="cust-eq-wish__model">{wish.modelLabel}</p>
          <p className="cust-eq-wish__hint">{solutionHint}</p>
        </div>
        <span className={`cust-eq-wish__badge cust-eq-wish__badge--${badge.tone}`}>
          {badge.label}
        </span>
      </div>

      <div className="cust-eq-wish__actions">
        <WishSourceButton wish={wish} />
        <button type="button" className="cust-eq-wish__btn" onClick={handleCopy}>
          Text kopieren
        </button>
      </div>

      {copyMessage && <p className="cust-eq-wish__copy-hint" role="status">{copyMessage}</p>}
    </article>
  );
}

function WishSourceButton({ wish }) {
  const [sourceDetail, setSourceDetail] = useState(null);
  const detail = buildSourceDetailFromEquipmentWish(wish);

  if (!detail.hasSource) {
    return <span className="cust-eq-wish__muted">Keine Quelle</span>;
  }

  return (
    <>
      <button
        type="button"
        className="cust-eq-wish__btn cust-eq-wish__btn--ghost"
        onClick={() => setSourceDetail(detail)}
      >
        Quelle
      </button>
      {sourceDetail && (
        <EquipmentFeatureSourceModal
          detail={sourceDetail}
          onClose={() => setSourceDetail(null)}
        />
      )}
    </>
  );
}

export default function CustomerAkteEquipmentWishes({ wishes = [], onCopyFeedback }) {
  if (!wishes.length) return null;

  return (
    <section className="cust-eq-wishes" aria-labelledby="cust-eq-wishes-title">
      <h2 id="cust-eq-wishes-title" className="cust-eq-wishes__title">
        Ausstattungswünsche
      </h2>
      <div className="cust-eq-wishes__list">
        {wishes.map((wish) => (
          <EquipmentWishCard key={wish.id} wish={wish} onCopyFeedback={onCopyFeedback} />
        ))}
      </div>
    </section>
  );
}
