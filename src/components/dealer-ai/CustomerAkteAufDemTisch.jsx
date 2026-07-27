import { useMemo } from 'react';
import { getLastCustomerActivityHint } from '../../services/customerActivityTimeline.js';
import { buildCustomerPortalStatusCardModel } from '../../services/crm/customerPortalAccessService.js';
import { buildBoardOfferCardModel } from '../../services/dealer/boardOfferModel.js';
import { formatVehicleCardTitle } from '../../services/customerAkte.js';
import './CustomerAkte.css';

/**
 * „Auf dem Tisch“ – kompakter Status aus bestehenden Offer/Activity/Unterlagen-Daten.
 * Keine neue Business-Logik.
 */
export default function CustomerAkteAufDemTisch({
  lead = null,
  boardItems = [],
  unterlagenSummary = null,
  unterlagenOpenCount = 0,
  selfDisclosureLabel = '',
  hasOpenInboxMessage = false,
  onOpenOffer,
  onOpenUnterlagen,
  onOpenSelfDisclosure,
  onOpenActivities,
}) {
  const primaryItem = boardItems.find((item) => item.type !== 'selection_group') ?? boardItems[0] ?? null;
  const offerModel = useMemo(() => {
    if (!primaryItem?.card) return null;
    return buildBoardOfferCardModel(primaryItem.card, lead);
  }, [primaryItem, lead]);

  const activityHint = useMemo(
    () => getLastCustomerActivityHint(lead?.history ?? []),
    [lead?.history],
  );

  const portalModel = useMemo(
    () => buildCustomerPortalStatusCardModel(lead, { hasOpenInboxMessage }),
    [lead, hasOpenInboxMessage],
  );

  const reactionText = activityHint
    || portalModel?.lastReactionLabel
    || null;

  const offerTitle = primaryItem?.type === 'selection_group'
    ? (primaryItem.group?.label || primaryItem.group?.title || 'Auswahl')
    : formatVehicleCardTitle(primaryItem?.card);

  const rateLine = offerModel?.primaryResult
    ? `${offerModel.primaryResult.value}${offerModel.primaryResult.suffix || ''}`
    : null;

  const conditionLine = (offerModel?.conditionChips ?? [])
    .map((c) => (typeof c === 'string' ? c : c?.label))
    .filter(Boolean)
    .slice(0, 3)
    .join(' · ');

  const docsDone = unterlagenSummary?.doneCount ?? 0;
  const docsTotal = unterlagenSummary?.totalCount ?? 0;
  const hasDocs = docsTotal > 0 || unterlagenOpenCount > 0 || selfDisclosureLabel;

  if (!primaryItem && !reactionText && !hasDocs) {
    return (
      <section className="cust-akte-tisch" aria-label="Auf dem Tisch">
        <p className="cust-akte-tisch__label">Auf dem Tisch</p>
        <p className="cust-akte-tisch__empty">Noch nichts Konkretes – Clever wartet auf den nächsten Schritt.</p>
      </section>
    );
  }

  return (
    <section className="cust-akte-tisch" aria-label="Auf dem Tisch">
      <p className="cust-akte-tisch__label">Auf dem Tisch</p>

      {primaryItem ? (
        <button
          type="button"
          className="cust-akte-tisch__offer"
          onClick={() => onOpenOffer?.(primaryItem)}
        >
          <span className="cust-akte-tisch__offer-eyebrow">Angebot</span>
          <span className="cust-akte-tisch__offer-title">{offerTitle || 'Angebot'}</span>
          {rateLine ? (
            <span className="cust-akte-tisch__offer-rate">{rateLine}</span>
          ) : null}
          {conditionLine ? (
            <span className="cust-akte-tisch__offer-meta">{conditionLine}</span>
          ) : null}
          <span className="cust-akte-tisch__offer-status">
            {offerModel?.badge?.label || offerModel?.metaLine || 'Offen'}
          </span>
        </button>
      ) : null}

      {reactionText ? (
        <button
          type="button"
          className="cust-akte-tisch__block"
          onClick={() => onOpenActivities?.()}
        >
          <span className="cust-akte-tisch__block-eyebrow">Letzte Kundenreaktion</span>
          <span className="cust-akte-tisch__block-text">{reactionText}</span>
        </button>
      ) : null}

      {hasDocs ? (
        <div className="cust-akte-tisch__docs">
          <button
            type="button"
            className="cust-akte-tisch__doc-link"
            onClick={() => onOpenUnterlagen?.()}
          >
            Unterlagen {docsDone}/{docsTotal || '–'}
            {unterlagenOpenCount > 0 ? ` · ${unterlagenOpenCount} offen` : ''}
          </button>
          {selfDisclosureLabel ? (
            <button
              type="button"
              className="cust-akte-tisch__doc-link"
              onClick={() => onOpenSelfDisclosure?.()}
            >
              Selbstauskunft {selfDisclosureLabel}
            </button>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
