import { DEALER_PACKAGES, REGISTRATION_STATUS } from '../data/dealerRegistration.js';
import { slugifyDealerName } from './partnerOnboarding.js';

export function buildRegistrationSlug(company) {
  const base = company.tradeName?.trim() || company.legalName?.trim();
  return slugifyDealerName(base);
}

export function getRegistrationStatusMeta(statusId) {
  return REGISTRATION_STATUS[statusId] ?? REGISTRATION_STATUS.draft;
}

export function getPackageById(packageId) {
  return DEALER_PACKAGES.find((p) => p.id === packageId) ?? DEALER_PACKAGES[0];
}

export function validateRegistrationStep(step, draft) {
  switch (step) {
    case 1: {
      if (!draft.company.legalName?.trim()) return 'Bitte Firmenname (rechtlich) eingeben.';
      if (!draft.company.street?.trim()) return 'Bitte Straße eingeben.';
      if (!draft.company.zip?.trim()) return 'Bitte PLZ eingeben.';
      if (!draft.company.city?.trim()) return 'Bitte Ort eingeben.';
      const slug = buildRegistrationSlug(draft.company);
      if (!slug) return 'Bitte einen gültigen Firmennamen für die Subdomain eingeben.';
      return null;
    }
    case 2: {
      if (!draft.contact.firstName?.trim() || !draft.contact.lastName?.trim()) {
        return 'Bitte Vor- und Nachname des Ansprechpartners eingeben.';
      }
      if (!draft.contact.email?.trim() || !draft.contact.email.includes('@')) {
        return 'Bitte gültige E-Mail-Adresse eingeben.';
      }
      if (!draft.contact.phone?.trim()) return 'Bitte Telefonnummer eingeben.';
      return null;
    }
    case 3: {
      if (!draft.brands?.length) return 'Bitte mindestens eine Marke auswählen.';
      const pkg = getPackageById(draft.packageId);
      if (draft.brands.length > pkg.maxBrands) {
        return `Paket „${pkg.name}“ erlaubt maximal ${pkg.maxBrands} Marke(n).`;
      }
      return null;
    }
    case 4: {
      if (!draft.packageId) return 'Bitte ein Paket wählen.';
      return null;
    }
    case 5: {
      if (!draft.agbAccepted) return 'Bitte die Händler-AGB und Datenschutzhinweise akzeptieren.';
      return null;
    }
    case 6:
      return (
        validateRegistrationStep(1, draft)
        ?? validateRegistrationStep(2, draft)
        ?? validateRegistrationStep(3, draft)
        ?? validateRegistrationStep(4, draft)
        ?? validateRegistrationStep(5, draft)
      );
    default:
      return null;
  }
}

export function getNextRegistrationStatus(current) {
  const order = ['draft', 'submitted', 'review', 'approved', 'live'];
  const idx = order.indexOf(current);
  if (idx < 0 || idx >= order.length - 1) return null;
  return order[idx + 1];
}

export function formatRegistrationSummary(application) {
  const name = application.company.tradeName?.trim()
    || application.company.legalName?.trim()
    || 'Unbenannt';
  const contact = `${application.contact.firstName} ${application.contact.lastName}`.trim();
  return { name, contact };
}
