import { Navigate, useParams } from 'react-router-dom';
import { buildOfferPath } from '../logic/offerService.js';

/** Legacy-Route – leitet auf /angebot/:code um */
export default function OfferPage() {
  const { code } = useParams();
  return <Navigate to={buildOfferPath(code)} replace />;
}
