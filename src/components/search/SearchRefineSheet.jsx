import { useEffect } from 'react';
import '../vehicle-detail/vehicle-detail.css';
import './SearchRefineSheet.css';

const REFINE_ITEMS = [
  { id: 'budget', emoji: '💰', label: 'Budget', kind: 'editor', chipId: 'maxPrice' },
  { id: 'range', emoji: '⚡', label: 'Reichweite', kind: 'feature', featureId: 'range_400' },
  { id: 'availability', emoji: '🚗', label: 'Verfügbarkeit', kind: 'patch', patch: { availability: 'sofort' } },
  { id: 'heat_pump', emoji: '🔌', label: 'Wärmepumpe', kind: 'feature', featureId: 'heat_pump' },
  { id: 'towbar', emoji: '🛞', label: 'Anhängerkupplung', kind: 'feature', featureId: 'towbar' },
  { id: 'camera_360', emoji: '🎥', label: '360° Kamera', kind: 'feature', featureId: 'camera_360' },
  { id: 'heated_seats', emoji: '🔥', label: 'Sitzheizung', kind: 'feature', featureId: 'heated_seats' },
];

const PAYMENT_OPTIONS = [
  { id: 'payment_any', label: 'Egal', patch: { payment: '', paymentExplicit: false } },
  { id: 'payment_cash', label: 'Kauf', patch: { payment: 'cash', paymentExplicit: true } },
  { id: 'payment_finance', label: 'Finanzierung', patch: { payment: 'finance', paymentExplicit: true } },
  { id: 'payment_leasing', label: 'Leasing', patch: { payment: 'leasing', paymentExplicit: true } },
];

function buildFeaturePatch(filters, featureId) {
  const prev = filters.features ?? [];
  const next = prev.includes(featureId)
    ? prev.filter((f) => f !== featureId)
    : [...prev, featureId];
  return { features: next };
}

export default function SearchRefineSheet({
  open,
  onClose,
  filters,
  wishes,
  onPatchFilters,
  onEditChip,
  onEditSearch,
}) {
  useEffect(() => {
    if (!open) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open) return null;

  const activeFeatures = new Set(filters.features ?? []);

  function apply(patch) {
    if (!patch) return;
    onPatchFilters?.(patch);
  }

  function handleItem(item) {
    if (item.kind === 'editor') {
      onEditChip?.({ id: item.chipId, type: 'budget' });
      onClose?.();
      return;
    }
    if (item.kind === 'feature') {
      apply(buildFeaturePatch(filters, item.featureId));
      return;
    }
    if (item.kind === 'patch') {
      apply(item.patch);
    }
  }

  return (
    <div className="vd-sheet-backdrop srs-backdrop" role="presentation" onClick={onClose}>
      <div
        className="vd-sheet srs-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="search-refine-sheet-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="vd-sheet__head">
          <h2 id="search-refine-sheet-title" className="vd-sheet__title">Suche verfeinern</h2>
          <button type="button" className="vd-sheet__close" onClick={onClose} aria-label="Schließen">
            ×
          </button>
        </div>
        <div className="vd-sheet__body srs-sheet__body">
          <section className="srs-section">
            <h3 className="srs-section__title">💳 Zahlungsart</h3>
            <div className="srs-payment-row">
              {PAYMENT_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  className={`srs-payment-btn${
                    (opt.patch.payment === (filters.payment || '') && opt.id !== 'payment_any')
                    || (opt.id === 'payment_any' && !filters.payment)
                      ? ' is-active' : ''
                  }`}
                  onClick={() => apply(opt.patch)}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </section>

          <section className="srs-section">
            <h3 className="srs-section__title">Wünsche ergänzen</h3>
            <div className="srs-grid">
              {REFINE_ITEMS.map((item) => {
                const active = item.featureId && activeFeatures.has(item.featureId);
                return (
                  <button
                    key={item.id}
                    type="button"
                    className={`srs-item${active ? ' is-active' : ''}`}
                    onClick={() => handleItem(item)}
                  >
                    <span className="srs-item__emoji" aria-hidden>{item.emoji}</span>
                    <span className="srs-item__label">{item.label}</span>
                  </button>
                );
              })}
            </div>
          </section>

          {onEditSearch && (
            <button type="button" className="srs-edit-query" onClick={() => { onEditSearch(); onClose?.(); }}>
              Suchtext ändern
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
