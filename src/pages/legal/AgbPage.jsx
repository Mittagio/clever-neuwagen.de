import LegalPageLayout from '../../components/legal/LegalPageLayout.jsx';
import LegalSection from '../../components/legal/LegalSection.jsx';
import { agbSections } from '../../data/legalContent.js';
import { LEGAL_SEO } from '../../constants/legal.js';

export default function AgbPage() {
  return (
    <LegalPageLayout
      title="Allgemeine Geschäftsbedingungen für Nutzer von Clever-Neuwagen"
      seoTitle={LEGAL_SEO.agb.title}
      seoDescription={LEGAL_SEO.agb.description}
      seoPath={LEGAL_SEO.agb.path}
    >
      {agbSections.map((section) => (
        <LegalSection key={section.id} section={section} />
      ))}
    </LegalPageLayout>
  );
}
