import { usePublishedDealerConditions } from '../context/DealerConditionsContext.jsx';
import { PILOT_DEALER_ID } from '../config/pilotLive.js';
import CleverConversationExperience from '../components/conversation/CleverConversationExperience.jsx';

/**
 * Phase 2 – Clever Beratung (Happy Path 1 → Welt 3 Übergabe).
 * Route: /beratung
 */
export default function CleverBeratungPage() {
  const { publishedConditions: conditions } = usePublishedDealerConditions(PILOT_DEALER_ID);
  const dealerName = conditions?.dealerName ?? 'Autohaus';

  return (
    <main className="cc-page">
      <CleverConversationExperience
        dealerName={dealerName}
        dealerConditions={conditions}
      />
    </main>
  );
}
