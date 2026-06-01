import { BACKEND_AREAS, BACKEND_AREA_SECTIONS, areaHasSubNav } from './backendAreas.js';
import './BackendNav.css';

export default function BackendNav({
  activeArea,
  activeSection,
  onAreaChange,
  onSectionChange,
}) {
  const sections = BACKEND_AREA_SECTIONS[activeArea] ?? [];
  const showSubNav = areaHasSubNav(activeArea);

  return (
    <div className="backend-nav-wrap">
      <nav className="backend-area-nav" aria-label="Hauptnavigation">
        {BACKEND_AREAS.map((area) => (
          <button
            key={area.id}
            type="button"
            className={`backend-area-nav__item${activeArea === area.id ? ' is-active' : ''}`}
            onClick={() => onAreaChange(area.id)}
          >
            <span className="backend-area-nav__icon" aria-hidden="true">{area.icon}</span>
            <span className="backend-area-nav__label">{area.label}</span>
          </button>
        ))}
      </nav>

      {showSubNav && (
        <nav className="backend-sub-nav" aria-label="Unternavigation">
          <div className="backend-sub-nav__scroll">
            {sections.map((section) => (
              <button
                key={section.id}
                type="button"
                className={`backend-sub-nav__item${activeSection === section.id ? ' is-active' : ''}`}
                onClick={() => onSectionChange(section.id)}
              >
                {section.icon && (
                  <span className="backend-sub-nav__icon" aria-hidden="true">{section.icon}</span>
                )}
                {section.label}
              </button>
            ))}
          </div>
        </nav>
      )}
    </div>
  );
}
