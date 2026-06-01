import { Routes, Route, Navigate } from 'react-router-dom';
import { useDealerSubdomain } from './context/DealerSubdomainContext.jsx';
import AppLayout from './components/layout/AppLayout';
import PartnerVerwaltungPage from './pages/PartnerVerwaltungPage';
import LandingPage from './pages/LandingPage';
import DealerPage from './pages/DealerPage';
import BackendPage from './pages/BackendPage';
import AdminPage from './pages/AdminPage';
import SalesPage from './pages/SalesPage';
import AccountPage from './pages/sprint7/AccountPage.jsx';
import AngebotPage from './pages/sprint7/AngebotPage.jsx';
import InsertGeneratorPage from './pages/InsertGeneratorPage';
import EquipmentAdvisorPage from './pages/EquipmentAdvisorPage';
import AdvisorPage from './pages/AdvisorPage';
import LeadsPage from './pages/LeadsPage';
import CommunicationCenterPage from './pages/communication/CommunicationCenterPage.jsx';
import CommunicationEmailPage from './pages/communication/CommunicationEmailPage.jsx';
import CommunicationWhatsAppPage from './pages/communication/CommunicationWhatsAppPage.jsx';
import CommunicationTemplatesPage from './pages/communication/CommunicationTemplatesPage.jsx';
import TemplatesPage from './pages/TemplatesPage';
import OfferPage from './pages/OfferPage';
import OffersPage from './pages/OffersPage';
import DashboardPage from './pages/DashboardPage';
import PartnerOnboardingPage from './pages/PartnerOnboardingPage';
import PartnerRegisterPage from './pages/sprint6/PartnerRegisterPage.jsx';
import DeliveryConfirmPage from './pages/DeliveryConfirmPage';
import RecommendationPage from './pages/RecommendationPage';
import TrendIndexPage from './pages/TrendIndexPage';
import TrendArticlePage from './pages/TrendArticlePage';
import GuideIndexPage from './pages/GuideIndexPage';
import GuideArticlePage from './pages/GuideArticlePage';
import IntelligencePage from './pages/IntelligencePage';
import IntelligenceApiDocsPage from './pages/IntelligenceApiDocsPage';
import IntelligenceApiJsonPage from './pages/IntelligenceApiJsonPage';
import AssistantPage from './pages/AssistantPage';
import DealerAIPage from './pages/DealerAIPage.jsx';
import ImpressumPage from './pages/legal/ImpressumPage';
import DatenschutzPage from './pages/legal/DatenschutzPage';
import AgbPage from './pages/legal/AgbPage';
import HaendlerAgbPage from './pages/legal/HaendlerAgbPage';
import PriceListImportPage from './pages/PriceListImportPage';
import PriceListImportHistoryPage from './pages/PriceListImportHistoryPage';
import AdminBillingPage from './pages/billing/AdminBillingPage.jsx';
import AdminBillingDealerPage from './pages/billing/AdminBillingDealerPage.jsx';
import AdminDeliveriesPage from './pages/billing/AdminDeliveriesPage.jsx';
import AdminRewardsPage from './pages/billing/AdminRewardsPage.jsx';
import AdminInvoicesPage from './pages/billing/AdminInvoicesPage.jsx';
import BackendBillingPage from './pages/billing/BackendBillingPage.jsx';
import AdminDealersPage from './pages/dealer-admin/AdminDealersPage.jsx';
import AdminDealerDetailPage from './pages/dealer-admin/AdminDealerDetailPage.jsx';
import AdminApprovalsPage from './pages/dealer-admin/AdminApprovalsPage.jsx';
import AdminOnboardingPage from './pages/dealer-admin/AdminOnboardingPage.jsx';
import AdminLaunchPage from './pages/launch-admin/AdminLaunchPage.jsx';
import AdminAnalyticsPage from './pages/launch-admin/AdminAnalyticsPage.jsx';
import AdminPilotPage from './pages/launch-admin/AdminPilotPage.jsx';
import AdminRolesPage from './pages/launch-admin/AdminRolesPage.jsx';
import AdminEmailPage from './pages/launch-admin/AdminEmailPage.jsx';
import AdminSystemPage from './pages/launch-admin/AdminSystemPage.jsx';
import AdminAuditPage from './pages/launch-admin/AdminAuditPage.jsx';
import AdminBackupPage from './pages/launch-admin/AdminBackupPage.jsx';
import AdminDomainsPage from './pages/launch-admin/AdminDomainsPage.jsx';
import BackendDocumentsPage from './pages/sprint5/BackendDocumentsPage.jsx';
import BackendPublishingPage from './pages/sprint5/BackendPublishingPage.jsx';
import SelbstauskunftPage from './pages/sprint5/SelbstauskunftPage.jsx';
import AdminCompliancePage from './pages/sprint5/AdminCompliancePage.jsx';
export default function AppRouter() {
  const { isSubdomain, dealerId } = useDealerSubdomain();

  if (isSubdomain && dealerId) {
    return (
      <AppLayout>
        <Routes>
          <Route path="/" element={<DealerPage />} />
          <Route path="/haendler/:slug" element={<DealerPage />} />
          <Route path="/legal/impressum" element={<ImpressumPage />} />
          <Route path="/legal/datenschutz" element={<DatenschutzPage />} />
          <Route path="*" element={<DealerPage />} />
        </Routes>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/partner" element={<PartnerOnboardingPage />} />
        <Route path="/partner/register" element={<PartnerRegisterPage />} />
        <Route path="/haendler/autohaus-trinkle" element={<DealerPage />} />
        <Route path="/haendler/:slug" element={<DealerPage />} />
        <Route path="/backend" element={<BackendPage />} />
        <Route path="/partner-verwaltung" element={<PartnerVerwaltungPage />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/intelligence" element={<IntelligencePage />} />
        <Route path="/intelligence/api" element={<IntelligenceApiDocsPage />} />
        <Route path="/api/v1/intelligence/:resource" element={<IntelligenceApiJsonPage />} />
        <Route path="/admin" element={<AdminPage />} />
        <Route path="/admin/import" element={<PriceListImportPage />} />
        <Route path="/admin/import/history" element={<PriceListImportHistoryPage />} />
        <Route path="/admin/billing" element={<AdminBillingPage />} />
        <Route path="/admin/billing/dealer/:id" element={<AdminBillingDealerPage />} />
        <Route path="/admin/dealers" element={<AdminDealersPage />} />
        <Route path="/admin/dealers/:id" element={<AdminDealerDetailPage />} />
        <Route path="/admin/approvals" element={<AdminApprovalsPage />} />
        <Route path="/admin/onboarding" element={<AdminOnboardingPage />} />
        <Route path="/admin/deliveries" element={<AdminDeliveriesPage />} />
        <Route path="/admin/rewards" element={<AdminRewardsPage />} />
        <Route path="/admin/invoices" element={<AdminInvoicesPage />} />
        <Route path="/admin/launch" element={<AdminLaunchPage />} />
        <Route path="/admin/analytics" element={<AdminAnalyticsPage />} />
        <Route path="/admin/pilot" element={<AdminPilotPage />} />
        <Route path="/admin/roles" element={<AdminRolesPage />} />
        <Route path="/admin/email" element={<AdminEmailPage />} />
        <Route path="/admin/system" element={<AdminSystemPage />} />
        <Route path="/admin/audit" element={<AdminAuditPage />} />
        <Route path="/admin/backup" element={<AdminBackupPage />} />
        <Route path="/admin/domains" element={<AdminDomainsPage />} />
        <Route path="/backend/billing" element={<BackendBillingPage />} />
        <Route path="/backend/documents" element={<BackendDocumentsPage />} />
        <Route path="/backend/publishing" element={<BackendPublishingPage />} />
        <Route path="/selbstauskunft" element={<SelbstauskunftPage />} />
        <Route path="/admin/compliance" element={<AdminCompliancePage />} />
        <Route path="/sales" element={<SalesPage />} />
        <Route path="/assistant" element={<AssistantPage />} />
        <Route path="/dealer-ai" element={<DealerAIPage />} />
        <Route path="/empfehlung" element={<RecommendationPage />} />
        <Route path="/insert-generator" element={<InsertGeneratorPage />} />
        <Route path="/ratgeber" element={<GuideIndexPage />} />
        <Route path="/ratgeber/:slug" element={<GuideArticlePage />} />
        <Route path="/trends" element={<TrendIndexPage />} />
        <Route path="/trends/:slug" element={<TrendArticlePage />} />
        <Route path="/berater" element={<AdvisorPage />} />
        <Route path="/berater/ausstattung" element={<EquipmentAdvisorPage />} />
        <Route path="/communication" element={<CommunicationCenterPage />} />
        <Route path="/communication/email" element={<CommunicationEmailPage />} />
        <Route path="/communication/whatsapp" element={<CommunicationWhatsAppPage />} />
        <Route path="/communication/templates" element={<CommunicationTemplatesPage />} />
        <Route path="/leads" element={<Navigate to="/communication" replace />} />
        <Route path="/leads/classic" element={<LeadsPage />} />
        <Route path="/offers" element={<OffersPage />} />
        <Route path="/templates" element={<TemplatesPage />} />
        <Route path="/angebot/:code" element={<AngebotPage />} />
        <Route path="/offer/:code" element={<OfferPage />} />
        <Route path="/account" element={<AccountPage />} />
        <Route path="/auslieferung/:token" element={<DeliveryConfirmPage />} />
        <Route path="/kunde" element={<Navigate to="/account" replace />} />
        <Route path="/legal/impressum" element={<ImpressumPage />} />
        <Route path="/legal/datenschutz" element={<DatenschutzPage />} />
        <Route path="/legal/agb" element={<AgbPage />} />
        <Route path="/legal/haendler-agb" element={<HaendlerAgbPage />} />
      </Routes>
    </AppLayout>
  );
}
