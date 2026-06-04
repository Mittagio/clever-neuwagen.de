import { useNavigate } from 'react-router-dom';
import VehicleImage from '../shared/VehicleImage.jsx';
import './dealer-landing.css';

export default function DealerImmediateCard({ item }) {
  const navigate = useNavigate();

  function openVehicle() {
    if (item.slug) {
      navigate(`/fahrzeug/${item.slug}`);
      return;
    }
    navigate(`/fahrzeuge?q=${encodeURIComponent(item.model)}&brand=kia`);
  }

  return (
    <article className="dl-stock card">
      <div className="dl-stock__badge">🔥 Sofort verfügbar</div>
      <div className="dl-stock__image">
        <VehicleImage
          brand={item.brand}
          model={item.imageModel}
          dealerId={item.dealerId}
          bodyType="suv"
        />
      </div>
      <div className="dl-stock__body">
        <h4 className="dl-stock__title">{item.displayTitle}</h4>
        <p className="dl-stock__rate">{item.monthlyRate} €/Monat</p>
        <p className="dl-stock__delivery">{item.deliveryLabel}</p>
        <button type="button" className="btn btn-primary dl-stock__cta" onClick={openVehicle}>
          Ansehen
        </button>
      </div>
    </article>
  );
}
