import { useMemo, useState } from 'react';
import VehicleImage from '../shared/VehicleImage.jsx';
import DealerModelPromotionBadges from '../shared/DealerModelPromotionBadges.jsx';
import {
  formatPreparationFeeSuffix,
  resolveModelSettings,
} from '../../services/dealer/dealerVehicleManagement.js';
import { buildModelTrimPricePresentation } from '../../services/dealer/dealerTrimPricing.js';
import './DealerVehicleManagement.css';

export default function DealerModelCustomerPreview({
  model,
  conditions,
}) {
  const [selectedTrimId, setSelectedTrimId] = useState(null);

  const settings = useMemo(
    () => resolveModelSettings(conditions, model.id),
    [conditions, model.id],
  );

  const presentation = useMemo(
    () => buildModelTrimPricePresentation(conditions, model, { paymentType: 'leasing' }),
    [conditions, model],
  );

  const activeLine = useMemo(() => {
    if (selectedTrimId) {
      return presentation.trimLines.find((line) => line.trimId === selectedTrimId)
        ?? presentation.lowestLine;
    }
    return presentation.lowestLine;
  }, [presentation, selectedTrimId]);

  const prepSuffix = formatPreparationFeeSuffix(conditions, model.id, 'leasing');

  return (
    <section className="dvm-preview-card" aria-label="Kundenvorschau">
      <header className="dvm-preview-card__head">
        <p className="dvm-preview-card__kicker">So sieht es der Kunde</p>
        <h3 className="dvm-preview-card__title">Landingpage-Vorschau</h3>
      </header>

      <article className="dvm-preview-vehicle">
        <div className="dvm-preview-vehicle__visual">
          <VehicleImage
            brand={model.brand ?? 'Kia'}
            model={model.id}
            bodyType="suv"
            variant="card"
            className="dvm-preview-vehicle__image-wrap"
            imageClassName="dvm-preview-vehicle__image"
          />
        </div>
        <div className="dvm-preview-vehicle__body">
          <p className="dvm-preview-vehicle__brand">{model.brand}</p>
          <h4 className="dvm-preview-vehicle__name">{model.name}</h4>

          {presentation.hasMultipleTrims && (
            <div className="dvm-preview-trim-tabs">
              {presentation.trimLines.map((line) => (
                <button
                  key={line.trimId}
                  type="button"
                  className={`dvm-preview-trim-tab${(selectedTrimId ?? presentation.lowestLine?.trimId) === line.trimId ? ' is-active' : ''}`}
                  onClick={() => setSelectedTrimId(line.trimId)}
                >
                  {line.trimName}
                </button>
              ))}
            </div>
          )}

          {activeLine && (
            <>
              <p className="dvm-preview-vehicle__trim">
                {activeLine.trimName}
                {activeLine.discountPercent > 0 && (
                  <span className="dvm-preview-vehicle__discount">
                    {' '}· {activeLine.discountPercent} % Rabatt
                  </span>
                )}
              </p>

              {activeLine.displayRate != null && (
                <p className="dvm-preview-vehicle__rate">
                  ab {Math.round(activeLine.displayRate).toLocaleString('de-DE')} € / Monat
                </p>
              )}

              {activeLine.listPrice > 0 && (
                <p className="dvm-preview-vehicle__cash">
                  Listenpreis ab {activeLine.listPrice.toLocaleString('de-DE')} €
                </p>
              )}

              {(activeLine.badgePresentation?.badges?.length > 0
                || activeLine.badges?.length > 0) && (
                <div className="dvm-preview-vehicle__badges">
                  <DealerModelPromotionBadges
                    badges={activeLine.badgePresentation?.badges ?? activeLine.badges}
                    overflowLabel={activeLine.badgePresentation?.overflowLabel}
                  />
                </div>
              )}
            </>
          )}

          {prepSuffix && (
            <p className="dvm-preview-vehicle__legal">{prepSuffix}</p>
          )}

          {settings.deliveryTime && (
            <p className="dvm-preview-vehicle__delivery">
              Lieferzeit: {settings.deliveryTime}
            </p>
          )}

          {settings.customerHint && (
            <p className="dvm-preview-vehicle__hint">{settings.customerHint}</p>
          )}
        </div>
      </article>

      {presentation.hasMultipleTrims && (
        <ul className="dvm-preview-trim-list">
          {presentation.trimLines.map((line) => (
            <li key={line.trimId} className="dvm-preview-trim-list__item">
              <span>{line.trimName}</span>
              <span className="dvm-preview-trim-list__rate">
                {line.displayRate != null
                  ? `ab ${Math.round(line.displayRate).toLocaleString('de-DE')} € / Monat`
                  : 'noch nicht gepflegt'}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
