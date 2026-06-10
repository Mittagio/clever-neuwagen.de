import { useMemo, useState } from 'react';
import { resolveVehicleImage } from '../../services/vehicle/vehicleImageService.js';
import VehicleImagePlaceholder from './VehicleImagePlaceholder.jsx';
import './VehicleImage.css';

export default function VehicleImage({
  brand,
  model,
  trim,
  dealerId,
  bodyType,
  variant = 'card',
  dealerImageUrl,
  vehicleId,
  color,
  allowAiRender = false,
  alt,
  className = '',
  imageClassName = '',
  placeholderVariant,
  showSourceBadge = false,
  glow = false,
}) {
  const [failed, setFailed] = useState(false);

  const resolved = useMemo(
    () => resolveVehicleImage({
      brand,
      model,
      trim,
      dealerId,
      bodyType,
      variant,
      dealerImageUrl,
      allowAiRender,
      vehicleId,
      color,
    }),
    [brand, model, trim, dealerId, bodyType, variant, dealerImageUrl, allowAiRender, vehicleId, color],
  );

  const label = alt ?? ([brand, model, trim].filter(Boolean).join(' ') || 'Fahrzeug');
  const showImage = resolved.url && !failed;

  return (
    <div
      className={`vehicle-image ${className}${glow ? ' vehicle-image--glow' : ''}`.trim()}
      data-image-source={resolved.source ?? 'placeholder'}
    >
      {showImage ? (
        <img
          src={resolved.url}
          alt={label}
          className={`vehicle-image__img ${imageClassName}`.trim()}
          loading="lazy"
          decoding="async"
          onError={() => setFailed(true)}
        />
      ) : (
        <VehicleImagePlaceholder variant={placeholderVariant ?? bodyType ?? 'suv'} />
      )}
      {showSourceBadge && resolved.source && (
        <span className="vehicle-image__badge" title={resolved.sourceLabel}>
          {resolved.sourceLabel}
        </span>
      )}
    </div>
  );
}
