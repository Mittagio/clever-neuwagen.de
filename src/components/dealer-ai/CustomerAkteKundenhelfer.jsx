import { buildAttributedWishChips } from '../../services/dealer/customerUnderstanding.js';
import {
  buildKundenwissenOverview,
} from '../../services/kundenwissenCategories.js';
import { resolveSellerAttribution } from '../../services/dealer/sellerInsights.js';
import { filterNotepadChipsExcludingKonditionen } from '../../services/customerAkte.js';
import CustomerAkteNotepadCapture from './CustomerAkteNotepadCapture.jsx';
import './CustomerAkte.css';

/**
 * Notizzettel in der Kundenakte – Wunsch-Chips (Kunde / VK-Kürzel).
 * Memo / Scan im Verlauf; E-Mail-Start über Verkaufsassistent „Anfrage einfügen“.
 * Memo: Stichwort-Vorschläge (Sitzh → Sitzheizung).
 */
export default function CustomerAkteKundenhelfer({
  notes = '',
  chipCategories = {},
  conversationNotes = [],
  voiceMemos = [],
  lead = null,
  onOpenSheet,
  onCaptureCommit = null,
  isSavingCapture = false,
  variant = 'profile',
  subdued = false,
  hasCustomerUnderstanding = false,
}) {
  const conversationCount = conversationNotes?.length ?? 0;
  const memoCount = voiceMemos?.length ?? 0;

  if (variant !== 'profile') {
    return null;
  }

  const attribution = resolveSellerAttribution({}, lead ?? {});
  const attributed = lead
    ? buildAttributedWishChips(lead)
    : [];

  const fallbackChips = attributed.length
    ? []
    : buildKundenwissenOverview(notes, lead, chipCategories, { includeUnterlagen: false })
      .flatMap((category) => category.items.map((item) => ({
        label: item.display || item.raw,
        origin: 'customer',
        badge: null,
        sellerName: null,
      })));

  const chips = filterNotepadChipsExcludingKonditionen(
    attributed.length ? attributed : fallbackChips,
  );

  return (
    <div
      className={`cust-akte-kw cust-akte-kw--notepad${subdued ? ' cust-akte-kw--subdued' : ''}`}
      aria-label="Notizzettel"
    >
      <div className="cust-akte-kw__head">
        <p className="cust-akte-kw__title">Notizzettel</p>
      </div>

      {chips.length > 0 ? (
        <ul className="cust-akte-kw__chips">
          {chips.map((chip) => {
            const isSeller = chip.origin === 'seller';
            const title = isSeller
              ? (chip.sellerName
                ? `Vom Verkäufer ergänzt (${chip.sellerName})`
                : 'Vom Verkäufer ergänzt')
              : 'Vom Kunden';
            return (
              <li key={`${chip.origin}-${chip.label}`}>
                <button
                  type="button"
                  className={`cust-akte-kw__chip${isSeller ? ' cust-akte-kw__chip--seller' : ''}`}
                  title={title}
                  onClick={() => onOpenSheet?.()}
                >
                  <span>{chip.label}</span>
                  {isSeller && chip.badge ? (
                    <span className="cust-akte-kw__chip-badge" aria-label={title}>
                      {chip.badge}
                    </span>
                  ) : null}
                </button>
              </li>
            );
          })}
        </ul>
      ) : (
        <button type="button" className="cust-akte-kw__add" onClick={() => onOpenSheet?.()}>
          +
        </button>
      )}

      {onCaptureCommit && (
        <CustomerAkteNotepadCapture
          sellerInitials={attribution.sellerInitials}
          sellerName={attribution.sellerName}
          onCommit={onCaptureCommit}
          isSaving={isSavingCapture}
        />
      )}

      {hasCustomerUnderstanding && (conversationCount > 0 || memoCount > 0) && (
        <div className="cust-akte-kw__meta-row">
          {conversationCount > 0 && (
            <button type="button" className="cust-akte-kw__meta-link" onClick={() => onOpenSheet?.()}>
              📝 {conversationCount}
            </button>
          )}
          {memoCount > 0 && (
            <button type="button" className="cust-akte-kw__meta-link" onClick={() => onOpenSheet?.()}>
              🎙 {memoCount}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
