import CustomerAkteVehicleCard from './CustomerAkteVehicleCard.jsx';
import CustomerAkteSelectionGroupCard from './CustomerAkteSelectionGroupCard.jsx';
import './CustomerAkte.css';

export default function CustomerAkteBoard({
  items = [],
  cards = [],
  lead = null,
  animateNew = false,
  onCardClick,
  onCardMenu,
  onSelectionGroupClick,
  onAddVehicle,
}) {
  const boardItems = items.length > 0
    ? items
    : cards.map((card) => ({ type: 'vehicle', id: card.id, card }));

  return (
    <section className="cust-akte-section cust-akte-board" aria-labelledby="cust-akte-board-title">
      <div className="cust-akte-section__head">
        <h2 id="cust-akte-board-title" className="cust-akte-section__title">Auf dem Tisch</h2>
        <button type="button" className="cust-akte-section__link" onClick={onAddVehicle}>
          + Auto hinzufügen
        </button>
      </div>

      {boardItems.length === 0 ? (
        <button type="button" className="cust-akte-board__empty" onClick={onAddVehicle}>
          Noch kein Fahrzeug – Auto hinzufügen
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
              />
            )
          ))}
        </div>
      )}
    </section>
  );
}
