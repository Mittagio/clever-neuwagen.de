import VehicleImage from '../shared/VehicleImage.jsx';
import { vehicleImagePropsFromOffer } from '../../services/vehicle/vehicleImageService.js';

/** Angebots-Vorschau – zentral über VehicleImage / ManufacturerMediaSystem */
export default function OfferVehicleImage({
  offer,
  dealerId,
  variant = 'card',
  className = '',
  imageClassName = '',
}) {
  if (!offer) return null;

  const props = vehicleImagePropsFromOffer(offer, { dealerId, variant });

  return (
    <VehicleImage
      {...props}
      className={className}
      imageClassName={imageClassName}
    />
  );
}
