import { useState } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import ImpersonationBanner from '../components/ImpersonationBanner';
import {
  LayoutDashboard,
  Package,
  Settings,
  Facebook,
  RefreshCw,
  Users,
  ChevronDown,
  LogOut,
  Menu,
  X,
  Bell,
  Shield,
  UserCheck,
  MessageCircle,
  BarChart3,
} from 'lucide-react';
import { cn } from '../lib/utils';
import { DealersFaceIcon } from '../components/ui/Logo';

const navigation = [
  { name: 'Dashboard', href: '/app/dashboard', icon: LayoutDashboard },
  { name: 'Inventory', href: '/app/inventory', icon: Package },
  { name: 'Leads', href: '/app/leads', icon: UserCheck },
  { name: 'Messages', href: '/app/messages', icon: MessageCircle },
  { name: 'Analytics', href: '/app/analytics', icon: BarChart3 },
  { name: 'Facebook', href: '/app/facebook', icon: Facebook },
  { name: 'Sync', href: '/app/sync', icon: RefreshCw },
  { name: 'Team', href: '/app/team', icon: Users },
  { name: 'Settings', href: '/app/settings', icon: Settings },
  { name: 'Admin Panel', href: '/admin', icon: Shield, adminOnly: true },
];

export default function DashboardLayout() {
  const { user, logout, impersonation } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div className={`min-h-screen bg-gray-50 ${impersonation.isImpersonating ? 'pt-10' : ''}`}>
      {/* Impersonation Banner */}
      <ImpersonationBanner />
      
      {/* Mobile sidebar backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed top-0 left-0 z-50 w-64 h-full bg-white border-r border-gray-200 transform transition-transform duration-200 ease-in-out lg:translate-x-0',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {/* Logo */}
        <div className="flex items-center gap-3 px-6 py-5 border-b border-gray-200">
          <DealersFaceIcon size={40} />
          <div>
            <h1 className="font-bold text-gray-900">Dealers <span className="text-blue-600">Face</span></h1>
            <p className="text-xs text-gray-500">Dealer Dashboard</p>
          </div>
        </div>

        {/* Navigation */}
        <nav className="px-4 py-4 space-y-1">
          {navigation.map((item) => {
            const isActive = location.pathname === item.href || 
              (item.href !== '/app/dashboard' && location.pathname.startsWith(item.href));
            
            // Only show Admin Panel for SUPER_ADMIN users
            if ((item as any).adminOnly) {
              const isSuperAdmin = user?.accounts?.some(a => a.role === 'SUPER_ADMIN');
              if (!isSuperAdmin) return null;
              
              return (
                <Link
                  key={item.name}
                  to={item.href}
                  onClick={() => setSidebarOpen(false)}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium mt-4 bg-slate-800 text-white hover:bg-slate-700 transition-colors"
                >
                  <item.icon className="w-5 h-5 text-blue-400" />
                  {item.name}
                </Link>
              );
            }
            
            return (
              <Link
                key={item.name}
                to={item.href}
                onClick={() => setSidebarOpen(false)}
                className={cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-blue-50 text-blue-700'
                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                )}
              >
                <item.icon className={cn('w-5 h-5', isActive ? 'text-blue-600' : 'text-gray-400')} />
                {item.name}
              </Link>
            );
          })}
        </nav>

        {/* Account Selector */}
        {user?.accounts && user.accounts.length > 0 && (
          <div className="absolute bottom-20 left-0 right-0 px-4">
            <div className="p-3 bg-gray-50 rounded-lg">
              <p className="text-xs font-medium text-gray-500 mb-1">Current Account</p>
              <p className="text-sm font-semibold text-gray-900 truncate">
                {user.accounts[0]?.name || 'My Dealership'}
              </p>
            </div>
          </div>
        )}

        {/* User info at bottom */}
        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-gray-200 bg-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
              <span className="text-blue-600 font-semibold">
                {user?.name?.charAt(0).toUpperCase() || 'U'}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">{user?.name}</p>
              <p className="text-xs text-gray-500 truncate">{user?.email}</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="lg:pl-64">
        {/* Top header */}
        <header className="sticky top-0 z-30 bg-white border-b border-gray-200">
          <div className="flex items-center justify-between px-4 py-3 lg:px-6">
            {/* Mobile menu button */}
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-2 text-gray-500 hover:text-gray-700 lg:hidden"
            >
              {sidebarOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>

            {/* Page title - can be customized */}
            <div className="hidden lg:block">
              <h2 className="text-lg font-semibold text-gray-900">
                {navigation.find((n) => n.href === location.pathname)?.name || 'Dashboard'}
              </h2>
            </div>

            {/* Right side actions */}
            <div className="flex items-center gap-4">
              {/* Notifications */}
              <button className="relative p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg">
                <Bell className="w-5 h-5" />
                <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />
              </button>

              {/* User dropdown */}
              <div className="relative">
                <button
                  onClick={() => setUserMenuOpen(!userMenuOpen)}
                  className="flex items-center gap-2 p-2 hover:bg-gray-100 rounded-lg"
                >
                  <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                    <span className="text-blue-600 font-semibold text-sm">
                      {user?.name?.charAt(0).toUpperCase() || 'U'}
                    </span>
                  </div>
                  <ChevronDown className="w-4 h-4 text-gray-500" />
                </button>

                {/* Dropdown menu */}
                {userMenuOpen && (
                  <>
                    <div
                      className="fixed inset-0 z-40"
                      onClick={() => setUserMenuOpen(false)}
                    />
                    <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50">
                      <div className="px-4 py-2 border-b border-gray-100">
                        <p className="text-sm font-medium text-gray-900">{user?.name}</p>
                        <p className="text-xs text-gray-500">{user?.email}</p>
                      </div>
                      <Link
                        to="/app/settings"
                        onClick={() => setUserMenuOpen(false)}
                        className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                      >
                        <Settings className="w-4 h-4" />
                        Settings
                      </Link>
                      <button
                        onClick={handleLogout}
                        className="flex items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50 w-full"
                      >
                        <LogOut className="w-4 h-4" />
                        Sign out
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="p-4 lg:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
