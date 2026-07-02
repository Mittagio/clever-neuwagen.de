import CustomerAkteVehicleCard from './CustomerAkteVehicleCard.jsx';
import CustomerAkteSelectionGroupCard from './CustomerAkteSelectionGroupCard.jsx';
import { countSendableBoardItems } from '../../services/dealer/boardOfferModel.js';
import './CustomerAkte.css';

export default function CustomerAkteBoard({
  items = [],
  cards = [],
  lead = null,
  animateNew = false,
  onCardClick,
  onCardMenu,
  onCardAction,
  onSelectionGroupClick,
  onAddProposal,
}) {
  const boardItems = items.length > 0
    ? items
    : cards.map((card) => ({ type: 'vehicle', id: card.id, card }));

  const sendableCount = countSendableBoardItems(boardItems, lead);

  return (
    <section className="cust-akte-section cust-akte-board cust-akte-tier-2" aria-labelledby="cust-akte-board-title">
      <div className="cust-akte-section__head">
        <div className="cust-akte-board__head-copy">
          <h2 id="cust-akte-board-title" className="cust-akte-section__title cust-akte-section__title--eyebrow">
            Angebots-Arbeitsbereich
          </h2>
          <p className="cust-akte-board__subline">
            {boardItems.length > 0
              ? `${sendableCount} versandbereit · ${boardItems.length} gesamt`
              : 'Angebote vorbereiten und dem Kunden zusenden'}
          </p>
        </div>
        <button
          type="button"
          className="cust-akte-section__link"
          onClick={onAddProposal}
        >
          + Angebot erstellen
        </button>
      </div>

      {boardItems.length === 0 ? (
        <button type="button" className="cust-akte-board__empty" onClick={onAddProposal}>
          Noch kein Angebot – Angebot erstellen
        </button>
      ) : (
        <div className="cust-akte-board__stack">
          {boardItems.map((item, index) => (
            item.type === 'selection_group' ? (
              <CustomerAkteSelectionGroupCard
                key={item.id}
                group={item.group}
                index={index}
                animateIn={animateNew}
                onClick={onSelectionGroupClick}
              />
            ) : (
              <CustomerAkteVehicleCard
                key={item.id}
                card={item.card}
                lead={lead}
                index={index}
                animateIn={animateNew}
                onClick={onCardClick}
                onMenu={onCardMenu}
                onAction={onCardAction}
              />
            )
          ))}
        </div>
      )}
    </section>
  );
}
