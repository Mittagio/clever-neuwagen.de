import VehicleImage from '../shared/VehicleImage.jsx';
import { vehicleImagePropsFromRecommendation } from '../../services/vehicle/vehicleImageService.js';

/**
 * Fahrzeugbild für KI-Berater-Ergebnisse – nutzt zentral resolveVehicleImage.
 */
export default function AdvisorVehicleImage({
  rec,
  dealerId,
  variant = 'card',
  className = '',
  imageClassName = '',
  allowAiRender = false,
}) {
  if (!rec) return null;

  const props = vehicleImagePropsFromRecommendation(rec, { dealerId, variant, allowAiRender });

  return (
    <VehicleImage
      {...props}
      allowAiRender={allowAiRender}
      className={className}
      imageClassName={imageClassName}
    />
  );
}
