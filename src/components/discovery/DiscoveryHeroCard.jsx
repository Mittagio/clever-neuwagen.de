import VehicleImage from '../shared/VehicleImage.jsx';
import CleverQuoteBadge from '../cleverQuote/CleverQuoteBadge.jsx';
import { RecommendReasonsPanel } from '../cleverQuote/CleverQuoteWhyPanel.jsx';
import {
  getMatchDisplayTitle,
  formatMatchPrimaryPrice,
  formatMatchCashAlt,
} from '../../logic/discoveryDisplay.js';
import './discovery-results.css';

export default function DiscoveryHeroCard({
  match,
  paymentMode = 'leasing',
  onViewOffer,
  onUnderstandEquipment,
  onCleverQuoteWhy,
  recommendReasons = [],
  heroBadge = 'Empfohlen für Ihre Suche',
}) {
  if (!match) return null;

  const v = match.vehicle;
  const title = getMatchDisplayTitle(match);
  const price = formatMatchPrimaryPrice(match, paymentMode);
  const cashAlt = paymentMode !== 'cash' ? formatMatchCashAlt(match) : null;

  return (
    <article className="disc-hero disc-hero--premium disc-hero--mobile-first disc-hero--s36">
      <div className="disc-hero__s36">
        <div className="disc-hero__visual disc-hero__visual--s36">
          <VehicleImage
            brand={v.brand}
            model={v.imageModel ?? v.model}
            bodyType={v.bodyType}
            className="disc-hero__image-wrap"
            imageClassName="disc-hero__image"
            placeholderVariant="hero"
            glow
          />
        </div>
        <div className="disc-hero__s36-body">
          <span className="disc-hero__badge disc-hero__badge--s36">{heroBadge}</span>
          <h2 className="disc-hero__title">{title}</h2>
          {match.cleverQuote && (
            <div className="disc-hero__clever-quote">
              <CleverQuoteBadge
                cleverQuote={match.cleverQuote}
                size="md"
                showTier={false}
                onWhyClick={onCleverQuoteWhy ?? onUnderstandEquipment}
              />
            </div>
          )}
          <RecommendReasonsPanel
            reasons={recommendReasons}
            title="Warum passt er zu Ihnen?"
          />
          <div className="disc-hero__price-hero">
            <p className="disc-hero__rate disc-hero__rate--hero">
              Ab {price.label}
              {price.suffix && <span>{price.suffix}</span>}
            </p>
            {cashAlt && (
              <p className="disc-hero__rate-alt">oder ab {cashAlt}</p>
            )}
            {v.discountPercent > 0 && (
              <p className="disc-hero__discount">{v.discountPercent} % Ersparnis</p>
            )}
          </div>
          <button
            type="button"
            className="disc-hero__cta disc-hero__cta--hero"
            onClick={() => onViewOffer?.(v)}
          >
            Angebot ansehen
          </button>
          {(onUnderstandEquipment || onCleverQuoteWhy) && match.cleverQuote && (
            <button
              type="button"
              className="disc-hero__understand"
              onClick={onUnderstandEquipment ?? onCleverQuoteWhy}
            >
              Ausstattung verstehen
            </button>
          )}
        </div>
      </div>
    </article>
  );
}
