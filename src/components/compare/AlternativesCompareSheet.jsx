import MobileBottomSheet from '../shared/MobileBottomSheet.jsx';
import CleverQuoteBadge from '../cleverQuote/CleverQuoteBadge.jsx';
import { getMatchDisplayTitle, formatMatchPrimaryPrice } from '../../logic/discoveryDisplay.js';
import './compare-mobile.css';

function CompareRow({ row, paymentMode, isCurrent, onSelect }) {
  const title = row.title ?? getMatchDisplayTitle(row);
  const price = row.priceLabel ?? (() => {
    const p = formatMatchPrimaryPrice(row, paymentMode);
    return `${p.label}${p.suffix ?? ''}`;
  })();

  return (
    <button
      type="button"
      className={`alt-compare-row${isCurrent ? ' alt-compare-row--current' : ''}`}
      onClick={() => onSelect?.(row)}
      disabled={isCurrent}
    >
      <div className="alt-compare-row__head">
        <span className="alt-compare-row__title">{title}</span>
        {row.cleverQuote && (
          <CleverQuoteBadge cleverQuote={row.cleverQuote} size="sm" showTier={false} />
        )}
        {!row.cleverQuote && row.fulfillmentLabel && (
          <span className="alt-compare-row__fulfillment">{row.fulfillmentLabel}</span>
        )}
      </div>
      <span className="alt-compare-row__price">{price}</span>
      {isCurrent && <span className="alt-compare-row__badge">Aktuell</span>}
    </button>
  );
}

export default function AlternativesCompareSheet({
  open,
  onClose,
  currentTitle,
  currentRow = null,
  alternatives = [],
  paymentMode = 'leasing',
  onSelectAlternative,
}) {
  const rows = [
    ...(currentRow ? [{ ...currentRow, title: currentTitle ?? currentRow.title, _current: true }] : []),
    ...alternatives.filter((a) => a.slug !== currentRow?.slug),
  ].slice(0, 4);

  if (!rows.length) return null;

  return (
    <MobileBottomSheet
      open={open}
      onClose={onClose}
      title="Mit Alternativen vergleichen"
      titleId="alt-compare-sheet-title"
      className="alt-compare-sheet"
    >
      <p className="alt-compare-sheet__intro">
        CleverQuote vergleicht passende Modelle – nicht nur Preise.
      </p>
      <div className="alt-compare-sheet__list">
        {rows.map((row) => (
          <CompareRow
            key={row.slug ?? row.title}
            row={row}
            paymentMode={paymentMode}
            isCurrent={Boolean(row._current)}
            onSelect={onSelectAlternative}
          />
        ))}
      </div>
    </MobileBottomSheet>
  );
}
