import CustomerAkteVehicleCard from './CustomerAkteVehicleCard.jsx';
import './CustomerAkte.css';

export default function CustomerAkteBoard({
  cards = [],
  animateNew = false,
  onCardClick,
  onCardMenu,
  onAddVehicle,
}) {
  return (
    <section className="cust-akte-section cust-akte-board" aria-labelledby="cust-akte-board-title">
      <div className="cust-akte-section__head">
        <h2 id="cust-akte-board-title" className="cust-akte-section__title">Auf dem Tisch</h2>
        <button type="button" className="cust-akte-section__link" onClick={onAddVehicle}>
          + Auto hinzufügen
        </button>
      </div>

      {cards.length === 0 ? (
        <button type="button" className="cust-akte-board__empty" onClick={onAddVehicle}>
          Noch kein Fahrzeug – Auto hinzufügen
        </button>
      ) : (
        <div className="cust-akte-board__stack">
          {cards.map((card, index) => (
            <CustomerAkteVehicleCard
              key={card.id}
              card={card}
              index={index}
              animateIn={animateNew}
              onClick={onCardClick}
              onMenu={onCardMenu}
            />
          ))}
        </div>
      )}
    </section>
  );
}
