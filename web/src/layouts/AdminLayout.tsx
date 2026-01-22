import { Link, useLocation, Outlet, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Building2,
  Users,
  CreditCard,
  Mail,
  Activity,
  Settings,
  LogOut,
  Shield,
  ChevronLeft,
  ShieldAlert,
  Network,
  FileText,
  Brain,
  Facebook,
  Puzzle,
  Terminal,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import ImpersonationBanner from '../components/ImpersonationBanner';
import FloatingAIChat from '../components/ai/FloatingAIChat';
import { FacebookConnectionStatus } from '../components/FacebookConnectionStatus';

const navigation = [
  { name: 'Dashboard', href: '/admin', icon: LayoutDashboard },
  { name: 'AI Center', href: '/admin/ai-center', icon: Brain },
  { name: 'API Dashboard', href: '/admin/api-dashboard', icon: Terminal },
  { name: 'Accounts', href: '/admin/accounts', icon: Building2 },
  { name: 'Users', href: '/admin/users', icon: Users },
  { name: 'Payments', href: '/admin/payments', icon: CreditCard },
  { name: 'Facebook', href: '/admin/facebook', icon: Facebook },
  { name: 'Extension', href: '/admin/extension', icon: Puzzle },
  { name: 'Email', href: '/admin/email', icon: Mail },
  { name: 'Reports & Alerts', href: '/admin/email-settings', icon: FileText },
  { name: 'Audit Logs', href: '/admin/audit', icon: Activity },
  { name: 'Intelliceil', href: '/admin/security', icon: ShieldAlert },
  { name: 'IIPC', href: '/admin/iipc', icon: Network },
  { name: 'Settings', href: '/admin/settings', icon: Settings },
];

export default function AdminLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout, impersonation } = useAuth();
  
  // Check if we're on the AI Center page
  const isAICenterPage = location.pathname === '/admin/ai-center';

  return (
    <div className={`flex h-screen bg-gray-50 ${impersonation.isImpersonating ? 'pt-10' : ''}`}>
      {/* Impersonation Banner */}
      <ImpersonationBanner />

      {/* Sidebar */}
      <div className="hidden md:flex md:w-64 md:flex-col">
        <div className="flex flex-col flex-grow pt-5 bg-slate-900 overflow-y-auto">
          {/* Logo */}
          <div className="flex items-center flex-shrink-0 px-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                <Shield className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-white">Dealers <span className="text-blue-300">Face</span></h1>
                <p className="text-xs text-slate-400">System Admin</p>
              </div>
            </div>
          </div>

          {/* Back to Dashboard Link */}
          <div className="mt-6 px-4">
            <Link
              to="/app/dashboard"
              className="flex items-center gap-2 text-sm text-slate-400 hover:text-white transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
              Back to Dashboard
            </Link>
          </div>

          {/* Navigation */}
          <div className="mt-6 flex-grow flex flex-col">
            <nav className="flex-1 px-2 space-y-1">
              {navigation.map((item) => {
                const isActive =
                  location.pathname === item.href ||
                  (item.href !== '/admin' && location.pathname.startsWith(item.href));
                const Icon = item.icon;
                return (
                  <Link
                    key={item.name}
                    to={item.href}
                    className={`group flex items-center px-3 py-2.5 text-sm font-medium rounded-lg transition-colors ${
                      isActive
                        ? 'bg-blue-600 text-white'
                        : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                    }`}
                  >
                    <Icon
                      className={`mr-3 flex-shrink-0 h-5 w-5 ${
                        isActive ? 'text-white' : 'text-slate-400 group-hover:text-white'
                      }`}
                    />
                    {item.name}
                  </Link>
                );
              })}
            </nav>
          </div>

          {/* User Section */}
          <div className="flex-shrink-0 border-t border-slate-700">
            {/* Facebook Status */}
            <div className="px-4 py-3 border-b border-slate-700">
              <FacebookConnectionStatus variant="compact" className="text-slate-300" />
            </div>
            
            {/* User Info */}
            <div className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 bg-slate-700 rounded-full flex items-center justify-center">
                    <span className="text-sm font-medium text-white">
                      {user?.email?.[0]?.toUpperCase() || 'A'}
                    </span>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-white truncate max-w-[120px]">
                      {user?.email || 'Admin'}
                    </p>
                    <p className="text-xs text-slate-400">Super Admin</p>
                  </div>
                </div>
                <button
                  onClick={logout}
                  className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
                  title="Logout"
                >
                  <LogOut className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Header */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-10 bg-slate-900 border-b border-slate-700 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="w-6 h-6 text-blue-500" />
            <span className="font-semibold text-white">Admin Panel</span>
          </div>
          <button
            onClick={logout}
            className="p-2 text-slate-400 hover:text-white"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Main content */}
      <div className="flex flex-col flex-1 overflow-hidden md:pt-0 pt-14">
        <main className="flex-1 relative overflow-y-auto focus:outline-none bg-gray-50">
          <Outlet />
        </main>
      </div>

      {/* Floating AI Chat - Hidden on AI Center page */}
      <FloatingAIChat 
        userRole="super_admin" 
        isAICenterTab={isAICenterPage}
        onMaximize={() => navigate('/admin/ai-center')}
      />
    </div>
  );
}
