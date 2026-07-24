import { resolveManufacturerImageUrl } from '../../services/media/manufacturerMediaService.js';
import { enrichDirectionsWithCardData } from '../../services/consultation/vehicleModelCardPresentation.js';
import CleverVehicleModelRail from './CleverVehicleModelRail.jsx';
import './clever-conversation.css';

export default function CleverVehicleDirections({
  directionsView,
  needProfile = {},
  notepadLabels = [],
  onReact,
  onOpenPriceList,
}) {
  if (!directionsView?.directions?.length) return null;

  const { intro, directions = [], reactions = {} } = directionsView;
  const enriched = enrichDirectionsWithCardData(directions, { needProfile, notepadLabels });
  const cards = enriched.map((direction) => {
    const card = direction.card;
    if (card) return card;
    const imageUrl = resolveManufacturerImageUrl('Kia', direction.label, { view: 'hero' })
      ?? resolveManufacturerImageUrl('Kia', direction.modelKey, { view: 'hero' });
    return {
      modelKey: direction.modelKey,
      name: direction.label,
      image: imageUrl,
      subtitle: direction.subtitle,
      fitHints: direction.fitHints,
      highlighted: direction.highlighted,
      uvpLabel: null,
      powerLabel: null,
      contextAnswer: null,
      metaLine: null,
    };
  });

  return (
    <CleverVehicleModelRail
      intro={intro || 'Passende Richtungen'}
      cards={cards}
      reactions={reactions}
      needProfile={needProfile}
      notepadLabels={notepadLabels}
      onReact={onReact}
      onOpenPriceList={onOpenPriceList}
      ariaLabel="Passende Fahrzeugrichtungen"
    />
  );
}
