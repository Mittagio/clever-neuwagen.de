import { resolveManufacturerImageUrl } from '../../services/media/manufacturerMediaService.js';
import { VEHICLE_DIRECTION_REACTIONS } from '../../services/consultation/vehicleDirectionService.js';
import './clever-conversation.css';

export default function CleverVehicleDirections({
  directionsView,
  onReact,
}) {
  if (!directionsView?.directions?.length) return null;

  const { intro, directions = [], reactions = {} } = directionsView;

  return (
    <section className="cc-directions cc-turn-enter" aria-label="Fahrzeugrichtungen">
      <p className="cc-directions__intro">{intro}</p>

      <ul className="cc-directions__list">
        {directions.map((direction) => {
          const reaction = reactions[direction.modelKey] ?? null;
          const imageUrl = resolveManufacturerImageUrl('Kia', direction.label, { view: 'hero' })
            ?? resolveManufacturerImageUrl('Kia', direction.modelKey, { view: 'hero' });

          return (
            <li
              key={direction.modelKey}
              className={[
                'cc-directions__card',
                direction.highlighted ? ' cc-directions__card--highlighted' : '',
                reaction === 'not_fit' ? ' cc-directions__card--dismissed' : '',
                reaction === 'interested' ? ' cc-directions__card--interested' : '',
              ].join('')}
            >
              {imageUrl && (
                <img
                  src={imageUrl}
                  alt=""
                  className="cc-directions__image"
                  loading="lazy"
                />
              )}
              <div className="cc-directions__body">
                <p className="cc-directions__name">{direction.label}</p>
                {direction.subtitle && (
                  <p className="cc-directions__subtitle">{direction.subtitle}</p>
                )}
                {direction.fitHints?.length > 0 && (
                  <ul className="cc-directions__hints">
                    {direction.fitHints.map((hint) => (
                      <li key={hint}>{hint}</li>
                    ))}
                  </ul>
                )}
                <div className="cc-directions__actions">
                  {VEHICLE_DIRECTION_REACTIONS.map((option) => (
                    <button
                      key={option.id}
                      type="button"
                      className={[
                        'cc-directions__action',
                        reaction === option.id ? ' cc-directions__action--active' : '',
                      ].join('')}
                      aria-pressed={reaction === option.id}
                      onClick={() => onReact?.(direction.modelKey, option.id)}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
