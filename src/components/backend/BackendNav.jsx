import { BACKEND_SECTIONS } from './backendSections.js';
import './BackendNav.css';

export default function BackendNav({ activeSection, onSectionChange }) {
  return (
    <nav className="backend-nav" aria-label="Backend-Bereiche">
      <div className="backend-nav-scroll">
        {BACKEND_SECTIONS.map((section) => (
          <button
            key={section.id}
            type="button"
            className={`backend-nav-item ${activeSection === section.id ? 'is-active' : ''}`}
            onClick={() => onSectionChange(section.id)}
          >
            <span className="backend-nav-icon" aria-hidden="true">{section.icon}</span>
            <span className="backend-nav-label">{section.label}</span>
          </button>
        ))}
      </div>
    </nav>
  );
}
