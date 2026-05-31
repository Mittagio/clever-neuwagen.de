import VehicleImage from '../shared/VehicleImage.jsx';
import { vehicleImagePropsFromLead } from '../../services/vehicle/vehicleImageService.js';

/** CRM Lead-Vorschau – zentral über VehicleImage / ManufacturerMediaSystem */
export default function LeadVehicleImage({
  lead,
  dealerId,
  variant = 'card',
  className = '',
  imageClassName = '',
}) {
  if (!lead?.vehicle) return null;

  const props = vehicleImagePropsFromLead(lead, { dealerId, variant });

  return (
    <VehicleImage
      {...props}
      className={className}
      imageClassName={imageClassName}
    />
  );
}
