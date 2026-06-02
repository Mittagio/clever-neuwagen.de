import { RefineSearchPanel } from './SearchFlowComponents.jsx';
import { MARKETPLACE_RADIUS_OPTIONS } from '../../data/marketplaceVehicles.js';
import {
  MAGIC_LENS_MILEAGE_OPTIONS,
  MAGIC_LENS_SORT_OPTIONS,
  MAGIC_LENS_TERM_OPTIONS,
} from '../../data/magicLensOptions.js';
import './desktopSearchRefine.css';

const RADIUS_OPTIONS = MARKETPLACE_RADIUS_OPTIONS.map((o) => ({
  label: o.label,
  value: o.value,
}));

export default function DesktopSearchRefine({ filters, onPatch, open, onToggleOpen }) {
  return (
    <details
      className="desktop-search-refine"
      open={open}
      onToggle={(e) => onToggleOpen?.(e.target.open)}
    >
      <summary className="desktop-search-refine__summary">Suche verfeinern</summary>
      <div className="desktop-search-refine__body">
        <RefineSearchPanel
          filters={filters}
          onChangeTerm={(termMonths) => onPatch({ termMonths })}
          onChangeMileage={(mileagePerYear) => onPatch({ mileagePerYear })}
          onChangeRadius={(radius) => onPatch({ radius })}
          onChangeSort={(sort) => onPatch({ sort })}
          termOptions={MAGIC_LENS_TERM_OPTIONS}
          mileageOptions={MAGIC_LENS_MILEAGE_OPTIONS}
          radiusOptions={RADIUS_OPTIONS}
          sortOptions={MAGIC_LENS_SORT_OPTIONS}
          variant="refine"
        />
      </div>
    </details>
  );
}
