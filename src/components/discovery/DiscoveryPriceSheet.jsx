import MobileBottomSheet from '../shared/MobileBottomSheet.jsx';
import { formatMatchPrimaryPrice } from '../../logic/discoveryDisplay.js';
import './discovery-results.css';

const MODES = [
  { id: 'leasing', label: 'Leasing', hint: 'Monatsrate' },
  { id: 'cash', label: 'Kauf', hint: 'Barpreis' },
];

export default function DiscoveryPriceSheet({
  open,
  onClose,
  match,
  paymentMode = 'leasing',
  onSelectMode,
}) {
  if (!match) return null;

  return (
    <MobileBottomSheet
      open={open}
      onClose={onClose}
      title="Leasing oder Kauf"
      titleId="disc-price-sheet-title"
      className="disc-price-sheet"
    >
      <p className="disc-price-sheet__intro">
        Wählen Sie, wie der Preis angezeigt werden soll.
      </p>
      <div className="disc-price-sheet__options" role="radiogroup" aria-label="Zahlungsart">
        {MODES.map((mode) => {
          const price = formatMatchPrimaryPrice(match, mode.id);
          const active = paymentMode === mode.id;
          return (
            <button
              key={mode.id}
              type="button"
              role="radio"
              aria-checked={active}
              className={`disc-price-sheet__option${active ? ' is-active' : ''}`}
              onClick={() => {
                onSelectMode?.(mode.id);
                onClose?.();
              }}
            >
              <span className="disc-price-sheet__option-head">
                <span className="disc-price-sheet__option-label">{mode.label}</span>
                <span className="disc-price-sheet__option-hint">{mode.hint}</span>
              </span>
              <span className="disc-price-sheet__option-price">
                {price.label}
                {price.suffix && <span>{price.suffix}</span>}
              </span>
            </button>
          );
        })}
      </div>
    </MobileBottomSheet>
  );
}
