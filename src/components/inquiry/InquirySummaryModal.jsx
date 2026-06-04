import CustomerInquiryModal from '../customer/CustomerInquiryModal.jsx';
import DealerInquiryBriefView from './DealerInquiryBriefView.jsx';
import { buildDealerInquiryBrief } from '../../logic/dealerInquiryBrief.js';

/**
 * Anfrage-Modal – Kunde und Händler sehen dieselbe Brief-Struktur (Sprint 40).
 */
export default function InquirySummaryModal({
  open,
  title,
  detailSelection,
  recommendationResult,
  displayPrice,
  displayTitle,
  dealer,
  cleverQuote,
  wishes,
  wishAlternatives = [],
  vehicle,
  onClose,
  onSubmit,
}) {
  if (!open) return null;

  const brief = buildDealerInquiryBrief({
    displayTitle,
    displayPrice,
    detailSelection,
    recommendationResult,
    cleverQuote,
    wishes,
    wishAlternatives,
    dealer,
    vehicle,
    pricing: displayPrice?.raw,
  });

  return (
    <CustomerInquiryModal
      title={title}
      inquirySummary={{ brief, pricing: displayPrice?.raw }}
      briefPreview={<DealerInquiryBriefView brief={brief} />}
      onClose={onClose}
      onSubmit={onSubmit}
    />
  );
}
