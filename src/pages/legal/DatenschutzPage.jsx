import LegalPageLayout from '../../components/legal/LegalPageLayout.jsx';
import LegalSection from '../../components/legal/LegalSection.jsx';
import { datenschutzSections } from '../../data/legalContent.js';
import { LEGAL_SEO } from '../../constants/legal.js';

export default function DatenschutzPage() {
  return (
    <LegalPageLayout
      title="Datenschutzerklärung"
      seoTitle={LEGAL_SEO.datenschutz.title}
      seoDescription={LEGAL_SEO.datenschutz.description}
      seoPath={LEGAL_SEO.datenschutz.path}
      subtitle="Informationen zur Verarbeitung personenbezogener Daten gemäß DSGVO"
    >
      {datenschutzSections.map((section) => (
        <LegalSection key={section.id} section={section} />
      ))}
    </LegalPageLayout>
  );
}
