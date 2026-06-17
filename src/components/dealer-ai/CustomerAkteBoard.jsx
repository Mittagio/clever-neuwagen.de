import CustomerAkteVehicleCard from './CustomerAkteVehicleCard.jsx';
import './CustomerAkte.css';

export default function CustomerAkteBoard({
  cards = [],
  animateNew = false,
  onCardClick,
  onCardMenu,
  onAddVehicle,
}) {
  const countLabel = cards.length === 1 ? '1 Option' : `${cards.length} Optionen`;

  return (
    <section className="cust-akte-section cust-akte-board" aria-labelledby="cust-akte-board-title">
      <div className="cust-akte-section__head">
        <div className="cust-akte-board__title-row">
          <h2 id="cust-akte-board-title" className="cust-akte-section__title">Auf dem Tisch</h2>
          {cards.length > 0 && (
            <span className="cust-akte-board__count">{countLabel}</span>
          )}
        </div>
        <button type="button" className="cust-akte-section__link" onClick={onAddVehicle}>
          + Auto hinzufügen
        </button>
      </div>

      {cards.length === 0 ? (
        <div className="cust-akte-board__empty">
          <p className="cust-akte-board__empty-title">Noch kein Fahrzeug auf dem Tisch</p>
          <button type="button" className="cust-akte-board__empty-cta" onClick={onAddVehicle}>
            Neuen Wunsch erfassen
          </button>
        </div>
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
