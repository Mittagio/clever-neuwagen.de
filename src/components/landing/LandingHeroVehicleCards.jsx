import { useMemo } from 'react';
import { usePublishedDealerConditions } from '../../context/DealerConditionsContext.jsx';
import { getAdvisorRecommendations, formatAdvisorRate } from '../../services/advisorEngine.js';
import { buildAdvisorUrl } from '../../services/landingAdvisorBridge.js';
import { LANDING_HERO_VEHICLES } from '../../data/landingHeroVehicles.js';
import LandingHeroVehicleCard from './LandingHeroVehicleCard.jsx';

export default function LandingHeroVehicleCards() {
  const { publishedConditions: conditions } = usePublishedDealerConditions();

  const cards = useMemo(() => {
    return LANDING_HERO_VEHICLES.map((vehicle) => {
      const recs = getAdvisorRecommendations(
        {
          ...vehicle.profile,
          mileage: vehicle.profile.mileage ?? '10k-15k',
          fuelPreference: vehicle.profile.fuelPreference ?? 'egal',
          bodyType: vehicle.profile.bodyType ?? 'suv',
          wishes: vehicle.profile.wishes ?? [],
        },
        conditions,
      );

      const modelMatch = recs.find(
        (r) => r.model?.toLowerCase() === vehicle.model.toLowerCase(),
      ) ?? recs[0];

      return {
        vehicle,
        href: buildAdvisorUrl(vehicle.profile),
        rate: modelMatch
          ? formatAdvisorRate(modelMatch.monthlyRate)
          : vehicle.mockRate,
        delivery: modelMatch?.deliveryTime ?? vehicle.mockDelivery,
        availability: {
          type: modelMatch?.availabilityType ?? vehicle.mockAvailability.type,
          label: modelMatch?.availabilityLabel ?? vehicle.mockAvailability.label,
        },
      };
    });
  }, [conditions]);

  return (
    <div className="lp-hero-cards" aria-label="Aktuelle Kia-Modelle mit Preisen und Verfügbarkeit">
      <div className="lp-hero-cards__stage">
        {cards.map((card) => (
          <LandingHeroVehicleCard
            key={card.vehicle.id}
            vehicle={card.vehicle}
            href={card.href}
            rate={card.rate}
            delivery={card.delivery}
            availability={card.availability}
          />
        ))}
      </div>
    </div>
  );
}
