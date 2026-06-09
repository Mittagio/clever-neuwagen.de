import { useMemo, useState } from 'react';
import { buildCustomerStatedChips } from '../../services/search/chipConfig.js';
import SearchRefineSheet from './SearchRefineSheet.jsx';
import './CustomerSearchHub.css';

function StatedChip({ chip }) {
  return (
    <span className="csh-stated-chip">
      {chip.emoji && <span className="csh-stated-chip__emoji" aria-hidden>{chip.emoji}</span>}
      <span>{chip.label}</span>
    </span>
  );
}

export default function CustomerSearchHub({
  filters,
  wishes,
  onEditSearch,
  onEditChip,
  onPatchFilters,
  sticky = false,
  refineLabel = 'Verfeinern',
}) {
  const [refineOpen, setRefineOpen] = useState(false);

  const statedChips = useMemo(
    () => buildCustomerStatedChips(filters, wishes),
    [filters, wishes],
  );

  if (!statedChips.length) return null;

  return (
    <>
      <section
        className={`csh csh--minimal${sticky ? ' csh--sticky' : ''}`}
        aria-label="Ihre Suche"
      >
        <div className="csh-block csh-block--stated">
          <div className="csh-block__head">
            <h2 className="csh-block__title">Ihre Suche</h2>
            <button
              type="button"
              className="csh-refine-trigger"
              onClick={() => setRefineOpen(true)}
            >
              <span aria-hidden>✨</span> {refineLabel}
            </button>
          </div>
          <div className="csh-stated-row">
            {statedChips.map((chip) => (
              <StatedChip key={chip.id} chip={chip} />
            ))}
          </div>
        </div>
      </section>

      <SearchRefineSheet
        open={refineOpen}
        onClose={() => setRefineOpen(false)}
        filters={filters}
        wishes={wishes}
        onPatchFilters={onPatchFilters}
        onEditChip={onEditChip}
        onEditSearch={onEditSearch}
      />
    </>
  );
}
