import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { AdminLayout } from './components/AdminLayout';
import { ClientLayout } from './components/ClientLayout';
import { SalesRepLayout } from './components/SalesRepLayout';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { ClientDashboardPage } from './pages/client/ClientDashboardPage';
import { TeamManagementPage } from './pages/client/TeamManagementPage';
import { TemplatesPage } from './pages/client/TemplatesPage';
import { SettingsPage } from './pages/client/SettingsPage';
import { SubscriptionPage } from './pages/client/SubscriptionPage';
import { SalesRepDashboardPage } from './pages/sales/SalesRepDashboardPage';
import { VehicleListPage } from './pages/sales/VehicleListPage';
import { PostVehiclePage } from './pages/sales/PostVehiclePage';
import { PostHistoryPage } from './pages/sales/PostHistoryPage';
import { FacebookSettingsPage } from './pages/sales/FacebookSettingsPage';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
      staleTime: 5 * 60 * 1000, // 5 minutes
    },
  },
});

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};

function AppRoutes() {
  const { user } = useAuth();

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      
      {/* Super Admin Routes */}
      {user?.role === 'SUPER_ADMIN' && (
        <Route
          path="/admin/*"
          element={
            <ProtectedRoute>
              <AdminLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<DashboardPage />} />
          <Route path="accounts" element={<div className="p-6">Accounts Page (Coming Soon)</div>} />
          <Route path="users" element={<div className="p-6">Users Page (Coming Soon)</div>} />
          <Route path="payments" element={<div className="p-6">Payments Page (Coming Soon)</div>} />
          <Route path="emails" element={<div className="p-6">Emails Page (Coming Soon)</div>} />
          <Route path="audit-logs" element={<div className="p-6">Audit Logs Page (Coming Soon)</div>} />
          <Route path="settings" element={<div className="p-6">Settings Page (Coming Soon)</div>} />
        </Route>
      )}

      {/* Client Routes (ACCOUNT_OWNER, ADMIN) */}
      <Route
        path="/client/*"
        element={
          <ProtectedRoute>
            <ClientLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<ClientDashboardPage />} />
        <Route path="team" element={<TeamManagementPage />} />
        <Route path="templates" element={<TemplatesPage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="subscription" element={<SubscriptionPage />} />
      </Route>

      {/* Sales Rep Routes */}
      <Route
        path="/sales/*"
        element={
          <ProtectedRoute>
            <SalesRepLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<SalesRepDashboardPage />} />
        <Route path="vehicles" element={<VehicleListPage />} />
        <Route path="post/:vehicleId" element={<PostVehiclePage />} />
        <Route path="posts" element={<PostHistoryPage />} />
        <Route path="settings" element={<FacebookSettingsPage />} />
      </Route>

      {/* Root redirect based on role */}
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Navigate 
              to={
                user?.role === 'SUPER_ADMIN' ? '/admin' :
                user?.role === 'SALES_REP' ? '/sales' :
                '/client'
              } 
              replace 
            />
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;
