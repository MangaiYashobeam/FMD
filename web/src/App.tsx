import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from './contexts/AuthContext';
import { ToastProvider } from './contexts/ToastContext';
import ProtectedRoute from './components/ProtectedRoute';
import DashboardLayout from './layouts/DashboardLayout';
import AdminLayout from './layouts/AdminLayout';
// Public Pages
import LandingPage from './pages/LandingPage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import ResetPasswordPage from './pages/ResetPasswordPage';
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
            </Route>

            {/* Admin routes (Super Admin only) */}
            <Route
              path="/admin"
              element={
                <ProtectedRoute>
                  <AdminLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<AdminDashboardPage />} />
              <Route path="accounts" element={<AccountsPage />} />
              <Route path="users" element={<UsersPage />} />
              <Route path="payments" element={<PaymentsPage />} />
              <Route path="email" element={<EmailManagementPage />} />
              <Route path="audit" element={<AuditLogsPage />} />
              <Route path="settings" element={<SystemSettingsPage />} />
              <Route path="security" element={<IntelliceilPage />} />
              <Route path="iipc" element={<IIPCPage />} />
            </Route>

            {/* Catch all - redirect to landing */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
      </ToastProvider>
    </QueryClientProvider>
  );
}

export default App;
