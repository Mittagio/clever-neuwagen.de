import LegalPageLayout from '../../components/legal/LegalPageLayout.jsx';
import LegalSection from '../../components/legal/LegalSection.jsx';
import { impressumSections } from '../../data/legalContent.js';
import { LEGAL_SEO } from '../../constants/legal.js';

export default function ImpressumPage() {
  return (
    <LegalPageLayout
      title="Impressum"
      seoTitle={LEGAL_SEO.impressum.title}
      seoDescription={LEGAL_SEO.impressum.description}
      seoPath={LEGAL_SEO.impressum.path}
    >
      {impressumSections.map((section) => (
        <LegalSection key={section.id} section={section} />
      ))}
    </LegalPageLayout>
  );
}
