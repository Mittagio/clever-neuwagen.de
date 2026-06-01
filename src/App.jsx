import { BrowserRouter } from 'react-router-dom';
import { DealerConditionsProvider } from './context/DealerConditionsContext';
import { CustomerAuthProvider } from './context/CustomerAuthContext';
import { LeadsProvider } from './context/LeadsContext';
import { TemplatesProvider } from './context/TemplatesContext';
import { OffersProvider } from './context/OffersContext';
import { PartnerOnboardingProvider } from './context/PartnerOnboardingContext';
import { VoucherPartnersProvider } from './context/VoucherPartnersContext';
import { PriceListImportProvider } from './context/PriceListImportContext';
import { BillingProvider } from './context/BillingContext.jsx';
import { DealerAdminProvider } from './context/DealerAdminContext.jsx';
import { DealerRegistrationProvider } from './context/DealerRegistrationContext.jsx';
import { LaunchAdminProvider } from './context/LaunchAdminContext.jsx';
import { DealerSubdomainProvider } from './context/DealerSubdomainContext.jsx';
import AppRouter from './AppRouter.jsx';

export default function App() {
  return (
    <DealerConditionsProvider>
      <CustomerAuthProvider>
        <LeadsProvider>
          <VoucherPartnersProvider>
          <TemplatesProvider>
            <OffersProvider>
              <PartnerOnboardingProvider>
              <PriceListImportProvider>
              <BillingProvider>
              <DealerAdminProvider>
              <DealerRegistrationProvider>
              <LaunchAdminProvider>
              <BrowserRouter>
                <DealerSubdomainProvider>
                  <AppRouter />
                </DealerSubdomainProvider>
              </BrowserRouter>
              </LaunchAdminProvider>
              </DealerRegistrationProvider>
              </DealerAdminProvider>
              </BillingProvider>
              </PriceListImportProvider>
              </PartnerOnboardingProvider>
            </OffersProvider>
          </TemplatesProvider>
          </VoucherPartnersProvider>
        </LeadsProvider>
      </CustomerAuthProvider>
    </DealerConditionsProvider>
  );
}
