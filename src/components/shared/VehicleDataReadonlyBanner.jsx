import {
  DEALER_VEHICLE_NOTE,
  CENTRAL_MAINTAINED_FIELDS,
  getModelDataStatus,
} from '../../data/vehicleDataService.js';
import DataStatusCard from '../admin/DataStatusCard.jsx';
import './VehicleDataReadonlyBanner.css';

export default function VehicleDataReadonlyBanner({ modelId = 'sportage', compact = false }) {
  const dataStatus = getModelDataStatus(modelId);

  if (compact) {
    return (
      <aside className="vehicle-data-banner vehicle-data-banner--compact">
        <span className="vehicle-data-banner-icon" aria-hidden="true">🔒</span>
        <p className="vehicle-data-banner-text">{DEALER_VEHICLE_NOTE}</p>
      </aside>
    );
  }

  return (
    <aside className="vehicle-data-banner">
      <div className="vehicle-data-banner-head">
        <span className="vehicle-data-banner-icon" aria-hidden="true">🔒</span>
        <div>
          <p className="vehicle-data-banner-title">Fahrzeugdaten · Nur lesen</p>
          <p className="vehicle-data-banner-text">{DEALER_VEHICLE_NOTE}</p>
        </div>
      </div>

      <DataStatusCard status={dataStatus} />

      <div className="vehicle-data-split">
        <div className="vehicle-data-column">
          <p className="vehicle-data-column-label">Clever-Neuwagen pflegt</p>
          <ul className="vehicle-data-list">
            {CENTRAL_MAINTAINED_FIELDS.map((field) => (
              <li key={field}>{field}</li>
            ))}
          </ul>
        </div>
      </div>
    </aside>
  );
}
