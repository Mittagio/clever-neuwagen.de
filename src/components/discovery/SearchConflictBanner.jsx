import './search-conflict-banner.css';

export default function SearchConflictBanner({ conflict, onResolve }) {
  if (!conflict?.message) return null;

  const actionLabel = conflict.resolveBrandId
    ? `${conflict.resolveBrandId === 'kia' ? 'Kia' : conflict.resolveBrandId} einblenden`
    : conflict.clearAllExclusions
      ? 'Alle Marken einblenden'
      : null;

  return (
    <aside className="search-conflict-banner" role="status">
      {conflict.title && (
        <p className="search-conflict-banner__title">{conflict.title}</p>
      )}
      <p className="search-conflict-banner__text">{conflict.message}</p>
      {actionLabel && onResolve && (
        <button type="button" className="search-conflict-banner__btn" onClick={onResolve}>
          {actionLabel}
        </button>
      )}
    </aside>
  );
}
