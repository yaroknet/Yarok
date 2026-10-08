import { lazy, Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/employees/components/ui/sonner";
import { Toaster } from "@/employees/components/ui/toaster";
import { TooltipProvider } from "@/employees/components/ui/tooltip";
import { AuthProvider } from "@/employees/contexts/AuthContext";
import { ProtectedRoute } from "@/employees/components/ProtectedRoute";
import LoginPage from "./pages/LoginPage";
import { WhatsAppFab } from "@/employees/components/WhatsAppFab";

const NotFound = lazy(() => import("./pages/NotFound"));
const AdminDashboard = lazy(() => import("./pages/AdminDashboard"));
const AdminTasks = lazy(() => import("./pages/AdminTasks"));
const AdminTeamLeaders = lazy(() => import("./pages/AdminTeamLeaders"));
const AdminNetworks = lazy(() => import("./pages/AdminNetworks"));
const AdminImportExport = lazy(() => import("./pages/AdminImportExport"));
const AdminSettings = lazy(() => import("./pages/AdminSettings"));
const AdminMessages = lazy(() => import("./pages/AdminMessages"));
const TeamLeaderView = lazy(() => import("./pages/TeamLeaderView"));
const AdminUserTasks = lazy(() => import("./pages/AdminUserTasks"));
const AdminCalendar = lazy(() => import("./pages/AdminCalendar"));
const AdminServices = lazy(() => import("./pages/AdminServices"));
const AdminPersonalTasks = lazy(() => import("./pages/AdminPersonalTasks"));
const AdminQuotes = lazy(() => import("./pages/AdminQuotes"));
const AdminPriceList = lazy(() => import("./pages/AdminPriceList"));
const PublicQuoteView = lazy(() => import("./pages/PublicQuoteView"));
const EnterPage = lazy(() => import("./pages/EnterPage"));


const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter basename="/employees">
        <AuthProvider>
          <Suspense fallback={<div className="flex items-center justify-center min-h-screen"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>}>
            <Routes>
              <Route path="/" element={<LoginPage />} />
              <Route path="/enter" element={<EnterPage />} />
              <Route path="/admin" element={
                <ProtectedRoute allowedRoles={["super_admin", "office_manager"]}>
                  <AdminDashboard />
                </ProtectedRoute>
              } />
              <Route path="/admin/tasks" element={
                <ProtectedRoute allowedRoles={["super_admin", "office_manager"]}>
                  <AdminTasks />
                </ProtectedRoute>
              } />
              <Route path="/admin/team" element={
                <ProtectedRoute allowedRoles={["super_admin", "office_manager"]}>
                  <AdminTeamLeaders />
                </ProtectedRoute>
              } />
              <Route path="/admin/networks" element={
                <ProtectedRoute allowedRoles={["super_admin", "office_manager"]}>
                  <AdminNetworks />
                </ProtectedRoute>
              } />
              <Route path="/admin/data" element={
                <ProtectedRoute allowedRoles={["super_admin", "office_manager"]}>
                  <AdminImportExport />
                </ProtectedRoute>
              } />
              <Route path="/admin/settings" element={
                <ProtectedRoute allowedRoles={["super_admin", "office_manager"]}>
                  <AdminSettings />
                </ProtectedRoute>
              } />
              <Route path="/admin/messages" element={
                <ProtectedRoute allowedRoles={["super_admin", "office_manager", "team_leader", "contractor", "contractor_worker"]}>
                  <AdminMessages />
                </ProtectedRoute>
              } />
              <Route path="/admin/user-tasks/:userId" element={
                <ProtectedRoute allowedRoles={["super_admin", "office_manager"]}>
                  <AdminUserTasks />
                </ProtectedRoute>
              } />
              <Route path="/admin/calendar" element={
                <ProtectedRoute allowedRoles={["super_admin", "office_manager"]}>
                  <AdminCalendar />
                </ProtectedRoute>
              } />
              <Route path="/admin/services" element={
                <ProtectedRoute allowedRoles={["super_admin", "office_manager"]}>
                  <AdminServices />
                </ProtectedRoute>
              } />
              <Route path="/admin/personal-tasks" element={
                <ProtectedRoute allowedRoles={["super_admin", "office_manager"]}>
                  <AdminPersonalTasks />
                </ProtectedRoute>
              } />
              <Route path="/admin/quotes" element={
                <ProtectedRoute
                  allowedRoles={["super_admin", "office_manager"]}
                  allowedUserIds={[
                    "d0175b71-1a13-4a93-93b2-d984738cf346", // אורית
                    "78e34772-303e-469e-9771-a38aa93ddc2c", // מאיה
                    "5a5d0194-6ce1-448b-a1a7-da4466fcdffc", // עוזי
                  ]}
                >
                  <AdminQuotes />
                </ProtectedRoute>
              } />
              <Route path="/admin/price-list" element={
                <ProtectedRoute allowedRoles={["super_admin", "office_manager"]}>
                  <AdminPriceList />
                </ProtectedRoute>
              } />
              <Route path="/quote/:token" element={<PublicQuoteView />} />
              <Route path="/team" element={
                <ProtectedRoute allowedRoles={["team_leader", "contractor", "contractor_worker"]}>
                  <TeamLeaderView />
                </ProtectedRoute>
              } />
              <Route path="/customer" element={
                <ProtectedRoute allowedRoles={["customer"]}>
                  <TeamLeaderView />
                </ProtectedRoute>
              } />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
          <WhatsAppFab />
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
