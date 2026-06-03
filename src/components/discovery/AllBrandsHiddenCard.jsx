import './all-brands-hidden.css';

export default function AllBrandsHiddenCard({ onShowAllBrands, onResetSearch }) {
  return (
    <div className="all-brands-hidden">
      {onShowAllBrands && (
        <button
          type="button"
          className="all-brands-hidden__primary"
          onClick={onShowAllBrands}
        >
          Alle wieder anzeigen
        </button>
      )}
      {onResetSearch && (
        <button
          type="button"
          className="all-brands-hidden__secondary"
          onClick={onResetSearch}
        >
          Suche zurücksetzen
        </button>
      )}
    </div>
  );
}
