import VehicleImage from '../shared/VehicleImage.jsx';
import { AUTOHAUS_TRINKLE_ID } from '../../data/dealers/autohausTrinkle.js';

/** Hero-Fahrzeugbild: Priorität Händler → Hersteller → Standard */
export default function LandingHeroVisual() {
  return (
    <div className="lp-hero-visual" aria-hidden>
      <VehicleImage
        brand="Kia"
        model="Sportage"
        trim="Spirit"
        dealerId={AUTOHAUS_TRINKLE_ID}
        bodyType="suv"
        variant="hero"
        glow
        className="lp-hero-visual__frame"
        imageClassName="lp-hero-visual__img"
        placeholderVariant="sportage"
      />
    </div>
  );
}
