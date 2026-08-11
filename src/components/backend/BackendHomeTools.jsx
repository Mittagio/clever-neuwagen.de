import { Link } from 'react-router-dom';
import {
  IconCar,
  IconChevronRight,
  IconGlobe,
  IconHome,
  IconMegaphone,
} from '../dealer-ai/AkteIcons.jsx';
import './BackendHome.css';

const TOOLS = [
  {
    id: 'vehicles',
    kind: 'area',
    area: 'fahrzeuge',
    title: 'Fahrzeugverwaltung',
    subtitle: 'Modelle, Bestand und Konditionen verwalten',
    Icon: IconCar,
  },
  {
    id: 'ads',
    kind: 'area',
    area: 'marketing',
    title: 'Inseratsgenerator',
    subtitle: 'Anzeigen und Texte erstellen',
    Icon: IconMegaphone,
  },
  {
    id: 'showroom',
    kind: 'link',
    to: '/verkaufsassistent?view=showroom',
    title: 'Showroom',
    subtitle: 'Deine Fahrzeuge präsentieren',
    Icon: IconHome,
  },
  {
    id: 'model',
    kind: 'link',
    to: '/verkaufsassistent?view=model',
    title: 'Modellwelt',
    subtitle: 'Hersteller, Modelle und Highlights entdecken',
    Icon: IconGlobe,
  },
];

export default function BackendHomeTools({ onNavigateArea }) {
  function handleArea(area) {
    onNavigateArea?.(area);
  }

  return (
    <section className="backend-home__tools" aria-labelledby="backend-home-tools-title">
      <h2 id="backend-home-tools-title" className="backend-home__tools-heading">
        Werkzeuge
      </h2>
      <div className="backend-home__tools-grid">
        {TOOLS.map((tool) => {
          const Icon = tool.Icon;
          const content = (
            <>
              <span className="backend-home__tool-icon" aria-hidden>
                {Icon ? <Icon /> : null}
              </span>
              <span className="backend-home__tool-copy">
                <span className="backend-home__tool-title">{tool.title}</span>
                <span className="backend-home__tool-sub">{tool.subtitle}</span>
              </span>
              <span className="backend-home__tool-chevron" aria-hidden>
                <IconChevronRight />
              </span>
            </>
          );

          if (tool.kind === 'link') {
            return (
              <Link
                key={tool.id}
                to={tool.to}
                className="backend-home__tool"
                aria-label={tool.title}
              >
                {content}
              </Link>
            );
          }

          return (
            <button
              key={tool.id}
              type="button"
              className="backend-home__tool"
              onClick={() => handleArea(tool.area)}
              aria-label={tool.title}
            >
              {content}
            </button>
          );
        })}
      </div>
    </section>
  );
}
