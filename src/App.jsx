import { BrowserRouter } from 'react-router-dom';
import InternalTestEnvHead from './components/shared/InternalTestEnvHead.jsx';
import { DealerConditionsProvider } from './context/DealerConditionsContext';
import { CustomerAuthProvider } from './context/CustomerAuthContext';
import { LeadsProvider } from './context/LeadsContext';
import CleverInboxBridge from './context/CleverInboxBridge.jsx';
import { TemplatesProvider } from './context/TemplatesContext';
import { OffersProvider } from './context/OffersContext';
import { CommunicationProvider } from './context/CommunicationContext.jsx';
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
    <>
      <InternalTestEnvHead />
      <DealerConditionsProvider>
      <CustomerAuthProvider>
        <LeadsProvider>
          <CleverInboxBridge>
          <VoucherPartnersProvider>
          <TemplatesProvider>
            <OffersProvider>
              <CommunicationProvider>
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
              </CommunicationProvider>
            </OffersProvider>
          </TemplatesProvider>
          </VoucherPartnersProvider>
          </CleverInboxBridge>
        </LeadsProvider>
      </CustomerAuthProvider>
    </DealerConditionsProvider>
    </>
  );
}
