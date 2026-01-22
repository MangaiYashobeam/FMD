import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from './contexts/AuthContext';
import { ToastProvider } from './contexts/ToastContext';
import ProtectedRoute from './components/ProtectedRoute';
import SuperAdminRoute from './components/SuperAdminRoute';
import DashboardLayout from './layouts/DashboardLayout';
import AdminLayout from './layouts/AdminLayout';
import { CloudChat } from './components/ai/CloudChat';
// Public Pages
import LandingPage from './pages/LandingPage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import ResetPasswordPage from './pages/ResetPasswordPage';
// Feature Pages
import {
  FeaturesIndexPage,
  FacebookMarketplacePage,
  DMSFTPSyncPage,
  MultiAccountPage,
  LeadManagementPage,
  ChromeExtensionPage,
  AnalyticsTrackingPage,
} from './pages/features';
// Market Pages
import { MarketsIndexPage, StateMarketPage } from './pages/markets';
// Legal Pages
import {
  PrivacyPolicyPage,
  TermsOfServicePage,
  CookiePolicyPage,
  DMCAPolicyPage,
} from './pages/legal';
// Dashboard Pages
import DashboardPage from './pages/DashboardPage';
import InventoryPage from './pages/InventoryPage';
import FacebookPage from './pages/FacebookPage';
import SyncPage from './pages/SyncPage';
import SettingsPage from './pages/SettingsPage';
import TeamPage from './pages/TeamPage';
import LeadsPage from './pages/LeadsPage';
import MessagesPage from './pages/MessagesPage';
import AnalyticsPage from './pages/AnalyticsPage';
import PostingSettingsPage from './pages/PostingSettingsPage';
// Admin Pages
import AdminDashboardPage from './pages/admin/AdminDashboardPage';
import AccountsPage from './pages/admin/AccountsPage';
import UsersPage from './pages/admin/UsersPage';
import PaymentsPage from './pages/admin/PaymentsPage';
import EmailManagementPage from './pages/admin/EmailManagementPage';
import AuditLogsPage from './pages/admin/AuditLogsPage';
import SystemSettingsPage from './pages/admin/SystemSettingsPage';
import IntelliceilPage from './pages/admin/IntelliceilPage';
import IIPCPage from './pages/admin/IIPCPage';
import AICenterPage from './pages/admin/AICenterPage';
import EmailSettingsPage from './pages/admin/EmailSettingsPage';
import FacebookConfigPage from './pages/admin/FacebookConfigPage';
import ExtensionConfigPage from './pages/admin/ExtensionConfigPage';
import APIDashboardPage from './pages/admin/APIDashboardPage';
import ErrorMonitoringPage from './pages/admin/ErrorMonitoringPage';
import './index.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 1000 * 60 * 5, // 5 minutes
      refetchOnWindowFocus: false,
    },
  },
});

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <AuthProvider>
          <BrowserRouter>
            <Routes>
              {/* Public routes */}
              <Route path="/" element={<LandingPage />} />
              <Route path="/login" element={<LoginPage />} />
              <Route path="/register" element={<RegisterPage />} />
              <Route path="/forgot-password" element={<ForgotPasswordPage />} />
              <Route path="/reset-password" element={<ResetPasswordPage />} />
              
              {/* Feature Pages */}
              <Route path="/features" element={<FeaturesIndexPage />} />
              <Route path="/features/facebook-marketplace" element={<FacebookMarketplacePage />} />
              <Route path="/features/dms-ftp-sync" element={<DMSFTPSyncPage />} />
              <Route path="/features/multi-account" element={<MultiAccountPage />} />
              <Route path="/features/lead-management" element={<LeadManagementPage />} />
              <Route path="/features/chrome-extension" element={<ChromeExtensionPage />} />
              <Route path="/features/analytics" element={<AnalyticsTrackingPage />} />
              
              {/* Market Pages (52 states) */}
              <Route path="/markets" element={<MarketsIndexPage />} />
              <Route path="/markets/:stateSlug" element={<StateMarketPage />} />

              {/* Legal Pages */}
              <Route path="/privacy" element={<PrivacyPolicyPage />} />
              <Route path="/terms" element={<TermsOfServicePage />} />
              <Route path="/cookies" element={<CookiePolicyPage />} />
              <Route path="/dmca" element={<DMCAPolicyPage />} />

              {/* Protected dashboard routes */}
              <Route
              path="/app"
              element={
                <ProtectedRoute>
                  <DashboardLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<Navigate to="/app/dashboard" replace />} />
              <Route path="dashboard" element={<DashboardPage />} />
              <Route path="inventory" element={<InventoryPage />} />
              <Route path="facebook" element={<FacebookPage />} />
              <Route path="sync" element={<SyncPage />} />
              <Route path="leads" element={<LeadsPage />} />
              <Route path="messages" element={<MessagesPage />} />
              <Route path="analytics" element={<AnalyticsPage />} />
              <Route path="team" element={<TeamPage />} />
              <Route path="settings" element={<SettingsPage />} />
              <Route path="posting" element={<PostingSettingsPage />} />
            </Route>

            {/* Admin routes (Super Admin only) */}
            <Route
              path="/admin"
              element={
                <SuperAdminRoute>
                  <AdminLayout />
                </SuperAdminRoute>
              }
            >
              <Route index element={<AdminDashboardPage />} />
              <Route path="accounts" element={<AccountsPage />} />
              <Route path="users" element={<UsersPage />} />
              <Route path="payments" element={<PaymentsPage />} />
              <Route path="email" element={<EmailManagementPage />} />
              <Route path="email-settings" element={<EmailSettingsPage />} />
              <Route path="audit" element={<AuditLogsPage />} />
              <Route path="settings" element={<SystemSettingsPage />} />
              <Route path="security" element={<IntelliceilPage />} />
              <Route path="iipc" element={<IIPCPage />} />
              <Route path="ai-center" element={<AICenterPage />} />
              <Route path="facebook" element={<FacebookConfigPage />} />
              <Route path="extension" element={<ExtensionConfigPage />} />
              <Route path="api-dashboard" element={<APIDashboardPage />} />
              <Route path="errors" element={<ErrorMonitoringPage />} />
            </Route>

            {/* Catch all - redirect to landing */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
          
          {/* Cloud Chat - AI Sales Assistant visible on public pages */}
          <CloudChatWrapper />
        </BrowserRouter>
      </AuthProvider>
      </ToastProvider>
    </QueryClientProvider>
  );
}

// Wrapper component to conditionally show Cloud Chat only on public pages
function CloudChatWrapper() {
  const location = useLocation();
  
  // Show Cloud Chat only on public pages (not logged in area or admin)
  const publicPaths = ['/', '/login', '/register', '/features', '/markets', '/privacy', '/terms', '/cookies', '/dmca', '/forgot-password'];
  const isPublicPage = publicPaths.some(path => 
    location.pathname === path || 
    location.pathname.startsWith('/features/') || 
    location.pathname.startsWith('/markets/')
  );
  
  if (!isPublicPage) return null;
  
  return <CloudChat position="bottom-right" />;
}

export default App;
