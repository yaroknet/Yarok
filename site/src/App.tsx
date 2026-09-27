import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { InstallPrompt } from "@/components/pwa/InstallPrompt";
import { OfflineIndicator } from "@/components/pwa/OfflineIndicator";
import { GlobalLayout } from "@/components/layout/GlobalLayout";
import { MainLayout } from "@/components/layout/MainLayout";
import SkipToContent from "@/components/accessibility/SkipToContent";
import AccessibilityWidget from "@/components/accessibility/AccessibilityWidget";
import { Loader2 } from "lucide-react";

// Landing page is a static route - loaded immediately but doesn't need auth
import LandingPage from "./pages/LandingPage";

// Auth pages lazy loaded
const PurchaseOrderForm = lazy(() => import("./pages/PurchaseOrderForm"));
const KmMonthlyReportForm = lazy(() => import("./pages/fleet/KmMonthlyReportForm"));
const KmReportPublic = lazy(() => import("./pages/fleet/KmReportPublic"));
const IncidentReportPublic = lazy(() => import("./pages/fleet/IncidentReportPublic"));

// Lazy loaded pages for better performance
const AccessibilityStatement = lazy(() => import("./pages/AccessibilityStatement"));
const ClientAuth = lazy(() => import("./pages/ClientAuth"));
const ClientPortal = lazy(() => import("./pages/ClientPortal"));
const Portal = lazy(() => import("./pages/Portal"));
const AdminPanel = lazy(() => import("./pages/AdminPanel"));
// Fleet module — rebuilt hub replaces the legacy fleet/handover/incident/km/notifications pages.
const FleetHub = lazy(() => import("./pages/fleet/FleetHub"));
const ClientsManagement = lazy(() => import("./pages/ClientsManagement"));
const ProcurementManagement = lazy(() => import("./pages/ProcurementManagement"));
const ComplaintsManagement = lazy(() => import("./pages/ComplaintsManagement"));
const ProposalsManagement = lazy(() => import("./pages/ProposalsManagement"));
const ProposalClientView = lazy(() => import("./pages/ProposalClientView"));
const LogisticsManagement = lazy(() => import("./pages/LogisticsManagement"));
const MachinesManagement = lazy(() => import("./pages/MachinesManagement"));
const EmployeesManagement = lazy(() => import("./pages/EmployeesManagement"));
const EmployeeFormPage = lazy(() => import("./pages/EmployeeFormPage"));
const ContactInquiriesManagement = lazy(() => import("./pages/ContactInquiriesManagement"));
const ClientRelationsHub = lazy(() => import("./pages/ClientRelationsHub"));
const SatisfactionSurveyManagement = lazy(() => import("./pages/SatisfactionSurveyManagement"));
const AreaManagerAudits = lazy(() => import("./pages/AreaManagerAudits"));
const PublicAuditForm = lazy(() => import("./pages/PublicAuditForm"));
const PublicSurvey = lazy(() => import("./pages/PublicSurvey"));
const NotFound = lazy(() => import("./pages/NotFound"));
const PublicPrices = lazy(() => import("./pages/PublicPrices"));
const About = lazy(() => import("./pages/About"));
const Knowledge = lazy(() => import("./pages/Knowledge"));
const ArticleOfficeCleaningGuide = lazy(() => import("./pages/ArticleOfficeCleaningGuide"));
const ArticleEmployerResponsibility = lazy(() => import("./pages/ArticleEmployerResponsibility"));
const ArticleHeightCleaning = lazy(() => import("./pages/ArticleHeightCleaning"));
const ArticleAcFilters = lazy(() => import("./pages/ArticleAcFilters"));
const FAQ = lazy(() => import("./pages/FAQ"));
const OfficeCleaning = lazy(() => import("./pages/services/OfficeCleaning"));
const MedicalCleaning = lazy(() => import("./pages/services/MedicalCleaning"));
const InstitutionalCleaning = lazy(() => import("./pages/services/InstitutionalCleaning"));
const RetailCleaning = lazy(() => import("./pages/services/RetailCleaning"));
const CleanroomCleaning = lazy(() => import("./pages/services/CleanroomCleaning"));
const PolishFloors = lazy(() => import("./pages/services/PolishFloors"));
const CarpetCleaning = lazy(() => import("./pages/services/CarpetCleaning"));
const AcCleaning = lazy(() => import("./pages/services/AcCleaning"));

const PostConstruction = lazy(() => import("./pages/services/PostConstruction"));
const WindowsHeight = lazy(() => import("./pages/services/WindowsHeight"));
const IndustrialCleaning = lazy(() => import("./pages/services/IndustrialCleaning"));
const Manpower = lazy(() => import("./pages/services/Manpower"));
const Contact = lazy(() => import("./pages/Contact"));

// Loading fallback component
const PageLoader = () => (
  <div className="min-h-screen flex items-center justify-center bg-background">
    <Loader2 className="h-8 w-8 animate-spin text-primary" />
  </div>
);

const queryClient = new QueryClient();

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, isLoading } = useAuth();
  
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }
  
  if (!user) {
    return <Navigate to="/auth" replace />;
  }
  
  return <>{children}</>;
};

const AdminRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, isLoading, isSuperAdmin } = useAuth();
  
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }
  
  if (!user) {
    return <Navigate to="/auth" replace />;
  }
  
  if (!isSuperAdmin) {
    return <Navigate to="/" replace />;
  }
  
  return <>{children}</>;
};

// Auth route component - handles redirect if already logged in
const AuthRoute = () => {
  const { user, isLoading } = useAuth();
  
  if (isLoading) {
    return <PageLoader />;
  }
  
  if (user) {
    return <Navigate to="/portal" replace />;
  }

  // Employees sign in through the employees area (Yarok 360), which shares this login
  window.location.replace("/employees/");
  return <PageLoader />;
};

const AppRoutes = () => {
  // Auth check is non-blocking for landing page
  // Protected routes handle their own auth checks
  return (
    <Suspense fallback={<PageLoader />}>
    <Routes>
      {/* Public Landing Page - renders immediately without auth check */}
      <Route path="/" element={<LandingPage />} />
      
      {/* Accessibility Statement */}
      <Route path="/accessibility" element={<AccessibilityStatement />} />
      
      {/* Public Service Pages */}
      <Route path="/about" element={<About />} />
      <Route path="/knowledge" element={<Navigate to="/articles" replace />} />
      <Route path="/articles" element={<Knowledge />} />
      <Route path="/articles/office-cleaning-guide" element={<ArticleOfficeCleaningGuide />} />
      <Route path="/articles/employer-responsibility" element={<ArticleEmployerResponsibility />} />
      <Route path="/articles/height-cleaning" element={<ArticleHeightCleaning />} />
      <Route path="/articles/ac-filters" element={<ArticleAcFilters />} />
      <Route path="/faq" element={<FAQ />} />
      <Route path="/services/office-cleaning" element={<OfficeCleaning />} />
      <Route path="/services/medical-cleaning" element={<MedicalCleaning />} />
      <Route path="/services/institutional-cleaning" element={<InstitutionalCleaning />} />
      <Route path="/services/retail-cleaning" element={<RetailCleaning />} />
      <Route path="/services/cleanroom-cleaning" element={<CleanroomCleaning />} />
      <Route path="/services/polish-floors" element={<PolishFloors />} />
      <Route path="/services/carpet-cleaning" element={<CarpetCleaning />} />
      <Route path="/services/ac-cleaning" element={<AcCleaning />} />
      
      <Route path="/services/post-construction" element={<PostConstruction />} />
      <Route path="/services/windows-height" element={<WindowsHeight />} />
      <Route path="/services/industrial-cleaning" element={<IndustrialCleaning />} />
      <Route path="/services/manpower" element={<Manpower />} />
      <Route path="/contact" element={<Contact />} />
      
      {/* Auth route - lazy loaded with its own redirect logic */}
      <Route path="/auth" element={<AuthRoute />} />

      {/* Public purchase order form (mobile, generic link) */}
      <Route path="/purchase-order-form" element={<PurchaseOrderForm />} />
      <Route path="/purchase-order-form/:token" element={<PurchaseOrderForm />} />

      {/* Public token-based monthly KM report (mobile) */}
      <Route path="/km-report/:token" element={<KmMonthlyReportForm />} />

      {/* Public generic report links (no login, driver-selects) */}
      <Route path="/fleet-report/km" element={<KmReportPublic />} />
      <Route path="/fleet-report/incident" element={<IncidentReportPublic />} />

      {/* Public read-only price list — no auth */}
      <Route path="/public-prices" element={<PublicPrices />} />
      <Route path="/price-list" element={<Navigate to="/public-prices" replace />} />


      {/* Client Auth routes */}
      <Route path="/client-auth" element={<ClientAuth />} />
      <Route path="/client-portal" element={<ClientPortal />} />
      {/* Portal - main hub after login */}
      <Route path="/portal" element={
        <ProtectedRoute>
          <GlobalLayout>
            <Portal />
          </GlobalLayout>
        </ProtectedRoute>
      } />
      
      {/* Admin Panel - super admins only */}
      <Route path="/admin" element={
        <AdminRoute>
          <GlobalLayout>
            <AdminPanel />
          </GlobalLayout>
        </AdminRoute>
      } />
      
      {/* Fleet Management Module — single hub with sectioned tabs */}
      <Route path="/fleet" element={
        <ProtectedRoute>
          <GlobalLayout>
            <MainLayout><FleetHub /></MainLayout>
          </GlobalLayout>
        </ProtectedRoute>
      } />
      <Route path="/fleet/:section" element={
        <ProtectedRoute>
          <GlobalLayout>
            <MainLayout><FleetHub /></MainLayout>
          </GlobalLayout>
        </ProtectedRoute>
      } />

      {/* Legacy field-service pages removed with fleet rebuild — redirect to hub */}
      <Route path="/field-journal" element={<Navigate to="/fleet" replace />} />
      <Route path="/field-tasks" element={<Navigate to="/fleet" replace />} />

      <Route path="/clients" element={
        <ProtectedRoute>
          <GlobalLayout>
            <ClientsManagement />
          </GlobalLayout>
        </ProtectedRoute>
      } />
      <Route path="/procurement" element={
        <ProtectedRoute>
          <GlobalLayout>
            <ProcurementManagement />
          </GlobalLayout>
        </ProtectedRoute>
      } />
      <Route path="/crm" element={
        <ProtectedRoute>
          <GlobalLayout>
            <ClientRelationsHub />
          </GlobalLayout>
        </ProtectedRoute>
      } />
      <Route path="/complaints" element={
        <ProtectedRoute>
          <GlobalLayout>
            <ComplaintsManagement />
          </GlobalLayout>
        </ProtectedRoute>
      } />
      <Route path="/proposals" element={
        <ProtectedRoute>
          <GlobalLayout>
            <ProposalsManagement />
          </GlobalLayout>
        </ProtectedRoute>
      } />
      <Route path="/logistics" element={
        <ProtectedRoute>
          <GlobalLayout>
            <LogisticsManagement />
          </GlobalLayout>
        </ProtectedRoute>
      } />
      <Route path="/machines" element={
        <ProtectedRoute>
          <GlobalLayout>
            <MachinesManagement />
          </GlobalLayout>
        </ProtectedRoute>
      } />
      <Route path="/payroll" element={
        <ProtectedRoute>
          <GlobalLayout>
            <EmployeesManagement />
          </GlobalLayout>
        </ProtectedRoute>
      } />
      <Route path="/payroll/:formType" element={
        <ProtectedRoute>
          <GlobalLayout>
            <EmployeeFormPage />
          </GlobalLayout>
        </ProtectedRoute>
      } />
      <Route path="/contact-inquiries" element={
        <AdminRoute>
          <GlobalLayout>
            <ContactInquiriesManagement />
          </GlobalLayout>
        </AdminRoute>
      } />
      <Route path="/satisfaction-surveys" element={
        <AdminRoute>
          <GlobalLayout>
            <SatisfactionSurveyManagement />
          </GlobalLayout>
        </AdminRoute>
      } />
      
      {/* Public route for client proposal view */}
      <Route path="/proposal/:id" element={<ProposalClientView />} />
      
      {/* Public survey form */}
      <Route path="/survey" element={<PublicSurvey />} />

      {/* Area Manager Audits — CRM sub-module */}
      <Route path="/area-audits" element={
        <ProtectedRoute>
          <GlobalLayout>
            <AreaManagerAudits />
          </GlobalLayout>
        </ProtectedRoute>
      } />

      
      {/* Legacy routes - redirect to new structure */}
      {/* Legacy route removed - /portal is now the main internal app hub */}
      <Route path="/dashboard" element={<Navigate to="/fleet" replace />} />
      <Route path="/vehicles" element={<Navigate to="/fleet/vehicles" replace />} />
      <Route path="/drivers" element={<Navigate to="/fleet/drivers" replace />} />
      <Route path="/documents" element={<Navigate to="/fleet/documents" replace />} />
      <Route path="/fines" element={<Navigate to="/fleet/fines" replace />} />
      <Route path="/handovers" element={<Navigate to="/fleet/handovers" replace />} />
      <Route path="/handovers/new" element={<Navigate to="/fleet/handovers/new" replace />} />
      <Route path="/incidents" element={<Navigate to="/fleet/incidents" replace />} />
      <Route path="/incidents/new" element={<Navigate to="/fleet/incidents/new" replace />} />
      <Route path="/users" element={<Navigate to="/admin" replace />} />
      <Route path="/session-logs" element={<Navigate to="/admin" replace />} />
      <Route path="/tasks" element={<Navigate to="/fleet/tasks" replace />} />
      <Route path="/km-tracking" element={<Navigate to="/fleet/km-tracking" replace />} />
      <Route path="/km-history" element={<Navigate to="/fleet/km-history" replace />} />
      <Route path="/km-deviation" element={<Navigate to="/fleet/km-deviation" replace />} />
      <Route path="/notifications-log" element={<Navigate to="/fleet/notifications-log" replace />} />
      <Route path="/messages" element={<Navigate to="/fleet/messages" replace />} />
      <Route path="/messages-management" element={<Navigate to="/fleet/messages-management" replace />} />
      <Route path="/settings" element={<Navigate to="/fleet/settings" replace />} />
      <Route path="/general-info" element={<Navigate to="/fleet/general-info" replace />} />
      
      <Route path="*" element={<NotFound />} />
    </Routes>
    </Suspense>
  );
};

const PublicAuditRoute = () => (
  <>
    <Toaster />
    <Sonner />
    <Suspense fallback={<PageLoader />}>
      <PublicAuditForm />
    </Suspense>
  </>
);

const AppContent = () => {
  const location = useLocation();
  const normalizedPath = location.pathname.replace(/\/+$/, "") || "/";

  if (normalizedPath === "/public/audit-form") {
    return <PublicAuditRoute />;
  }

  return (
    <>
      <SkipToContent />
      <Toaster />
      <Sonner />
      <AuthProvider>
        <AppRoutes />
        <AccessibilityWidget />
        <InstallPrompt />
        <OfflineIndicator />
      </AuthProvider>
    </>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider delayDuration={0}>
      <BrowserRouter>
        <AppContent />
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
