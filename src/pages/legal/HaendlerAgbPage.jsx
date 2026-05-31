import LegalPageLayout from '../../components/legal/LegalPageLayout.jsx';
import LegalSection from '../../components/legal/LegalSection.jsx';
import { haendlerAgbSections } from '../../data/legalContent.js';
import { LEGAL_SEO } from '../../constants/legal.js';

export default function HaendlerAgbPage() {
  return (
    <LegalPageLayout
      title="Nutzungsbedingungen für Händler"
      seoTitle={LEGAL_SEO.haendlerAgb.title}
      seoDescription={LEGAL_SEO.haendlerAgb.description}
      seoPath={LEGAL_SEO.haendlerAgb.path}
      subtitle="Regelungen für teilnehmende Autohäuser auf Clever-Neuwagen"
    >
      {haendlerAgbSections.map((section) => (
        <LegalSection key={section.id} section={section} />
      ))}
    </LegalPageLayout>
  );
}
