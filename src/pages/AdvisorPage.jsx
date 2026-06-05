import { Navigate, useSearchParams } from 'react-router-dom';
import { buildDiscoveryFiltersFromBeraterParams } from '../services/advisor/advisorRouteBridge.js';

/**
 * Legacy /berater → Discovery-Pipeline auf /fahrzeuge (Clever-Search + Modelllinien).
 */
export default function AdvisorPage() {
  const [searchParams] = useSearchParams();
  const target = buildDiscoveryFiltersFromBeraterParams(searchParams);
  return <Navigate to={target} replace />;
}
