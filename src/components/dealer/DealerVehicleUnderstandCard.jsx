import { useMemo } from 'react';

import VehicleImage from '../shared/VehicleImage.jsx';
import DealerPowertrainPicker from './DealerPowertrainPicker.jsx';
import CustomerPreConsultationWizard from './CustomerPreConsultationWizard.jsx';
import { buildVehicleBrief, buildVehicleContextLine } from '../../services/dealer/vehicleSalesJourney.js';
import './dealer-landing.css';
import '../vehicle-detail/vehicle-detail.css';

export default function DealerVehicleUnderstandCard({
  modelKey,
  dealerId,
  wishChipIds = [],
  searchProfile = null,
  searchFilters = null,
  searchChipIds = [],
  deliveryLabel = null,
  prefilledWishCount = 0,
  powertrainOptions = [],
  onPowertrainChange,
  onCustomerWishReserve,
  onContactRequest,
  onSpecialQuestionSubmit,
  onAdvisorPhaseChange,
  knownPurchaseType = null,
  dealerName = null,
}) {
  const brief = buildVehicleBrief(modelKey);
  const brand = 'Kia';
  const model = brief.title?.replace(/^Kia\s+/i, '') ?? modelKey?.toUpperCase();

  const contextLine = useMemo(
    () => buildVehicleContextLine(modelKey, { searchProfile, searchFilters, searchChipIds }),
    [modelKey, searchProfile, searchFilters, searchChipIds],
  );

  function handleWishPayloadChange(payload) {
    onCustomerWishReserve?.(payload);
  }

  function handleContactRequest(payload) {
    onCustomerWishReserve?.(payload);
    onContactRequest?.(payload);
  }

  return (
    <section className="dl-sales-understand dl-sales-understand--portal dl-sales-understand--preconsult" aria-labelledby="dl-sales-understand-title">
      <div className="dl-sales-understand__hero dl-sales-understand__hero--compact">
        <VehicleImage
          brand="Kia"
          model={modelKey}
          dealerId={dealerId}
          bodyType={brief.bodyType}
          className="dl-sales-understand__image-wrap"
          imageClassName="dl-sales-understand__image"
          variant="hero"
          glow
        />
        <div className="dl-sales-understand__intro">
          <h2 id="dl-sales-understand-title" className="dl-sales-understand__title">
            {brief.title}
          </h2>
          {contextLine && (
            <p className="dl-sales-understand__context dl-sales-understand__context--muted">{contextLine}</p>
          )}
          {deliveryLabel && (
            <p className="dl-sales-understand__delivery">
              <span className="dl-sales-understand__delivery-icon" aria-hidden>🚚</span>
              Lieferzeit ca. {deliveryLabel}
            </p>
          )}
        </div>
      </div>

      <DealerPowertrainPicker
        options={powertrainOptions}
        value={modelKey}
        onChange={onPowertrainChange}
      />

      <div className="dl-sales-understand__wishes dl-sales-understand__preconsult">
        {prefilledWishCount > 0 && (
          <p className="dl-sales-understand__prefill-hint">
            {prefilledWishCount} Hinweise aus Ihrer Suche – die Vorberatung baut darauf auf.
          </p>
        )}
        <CustomerPreConsultationWizard
          modelKey={modelKey}
          modelLabel={brief.title}
          vehicle={{ brand, model }}
          prefilledPriorityIds={wishChipIds}
          dealerId={dealerId}
          dealerName={dealerName}
          onWishPayloadChange={handleWishPayloadChange}
          onContactRequest={handleContactRequest}
          onSpecialQuestionSubmit={onSpecialQuestionSubmit}
          onStepChange={onAdvisorPhaseChange}
        />
      </div>
    </section>
  );
}
