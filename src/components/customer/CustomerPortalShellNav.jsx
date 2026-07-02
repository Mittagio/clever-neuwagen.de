export default function CustomerPortalShellNav({
  sections = [],
  activeId = 'offers',
  badges = {},
  onChange,
}) {
  if (!sections.length) return null;

  return (
    <nav className="cop-shell-nav" aria-label="Kundenbereich">
      {sections.map((section) => {
        const badge = section.badgeKey ? badges[section.badgeKey] : null;
        const isActive = section.id === activeId;
        return (
          <button
            key={section.id}
            type="button"
            className={`cop-shell-nav__item${isActive ? ' is-active' : ''}`}
            aria-current={isActive ? 'page' : undefined}
            onClick={() => onChange?.(section.id)}
          >
            <span>{section.label}</span>
            {badge ? (
              <span className="cop-shell-nav__badge" aria-label={`${badge} offen`}>
                {badge}
              </span>
            ) : null}
          </button>
        );
      })}
    </nav>
  );
}
