import { Navigate, useParams, useSearchParams } from 'react-router-dom';
import { buildOfferPath } from '../logic/offerService.js';

/** Mein Bereich → Angebot mit optionalem Token aus Query */
export default function MeinBereichOfferPage() {
  const { code } = useParams();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const target = token
    ? `${buildOfferPath(code)}?token=${encodeURIComponent(token)}`
    : buildOfferPath(code);
  return <Navigate to={target} replace />;
}
