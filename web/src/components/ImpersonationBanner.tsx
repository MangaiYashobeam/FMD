import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { UserCheck, Users, X, ChevronDown, Search, Shield, Building2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { authApi } from '../lib/api';

interface ImpersonationTarget {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  accounts: Array<{
    id: string;
    name: string;
    role: string;
  }>;
  highestRole: string;
  lastLoginAt: string | null;
}

const roleColors: Record<string, string> = {
  SUPER_ADMIN: 'bg-purple-100 text-purple-700',
  ACCOUNT_OWNER: 'bg-blue-100 text-blue-700',
  ADMIN: 'bg-green-100 text-green-700',
  SALES_REP: 'bg-yellow-100 text-yellow-700',
  VIEWER: 'bg-gray-100 text-gray-700',
};

export default function ImpersonationBanner() {
  const { user, impersonation, impersonateUser, endImpersonation } = useAuth();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Check if current user is super admin
  const isSuperAdmin = user?.accounts?.some(a => a.role === 'SUPER_ADMIN');

  // Fetch impersonation targets
  const { data: targetsResponse } = useQuery({
    queryKey: ['impersonation-targets'],
    queryFn: () => authApi.getImpersonationTargets(),
    enabled: isSuperAdmin && isDropdownOpen,
  });

  const targets: ImpersonationTarget[] = targetsResponse?.data?.data || [];

  const filteredTargets = targets.filter(target => {
    const searchLower = searchTerm.toLowerCase();
    const fullName = `${target.firstName || ''} ${target.lastName || ''}`.toLowerCase();
    return (
      target.email.toLowerCase().includes(searchLower) ||
      fullName.includes(searchLower) ||
      target.accounts.some(a => a.name.toLowerCase().includes(searchLower))
    );
  });

  // Group targets by role
  const groupedTargets = filteredTargets.reduce((groups, target) => {
    const role = target.highestRole;
    if (!groups[role]) groups[role] = [];
    groups[role].push(target);
    return groups;
  }, {} as Record<string, ImpersonationTarget[]>);

  const handleImpersonate = async (userId: string) => {
    setIsLoading(true);
    try {
      await impersonateUser(userId);
      setIsDropdownOpen(false);
      setSearchTerm('');
    } catch (error) {
      console.error('Failed to impersonate:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleEndImpersonation = async () => {
    setIsLoading(true);
    try {
      await endImpersonation();
    } catch (error) {
      console.error('Failed to end impersonation:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // If impersonating, show the banner
  if (impersonation.isImpersonating) {
    return (
      <div className="fixed top-0 left-0 right-0 z-50 bg-gradient-to-r from-amber-500 to-orange-500 text-white px-4 py-2 shadow-lg">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <UserCheck className="w-5 h-5" />
            <span className="font-medium">
              Viewing as: <span className="font-bold">{user?.email}</span>
            </span>
            <span className="text-amber-100 text-sm">
              (Impersonated by {impersonation.impersonator?.email})
            </span>
          </div>
          <button
            onClick={handleEndImpersonation}
            disabled={isLoading}
            className="flex items-center gap-2 px-4 py-1.5 bg-white/20 hover:bg-white/30 rounded-lg transition-colors disabled:opacity-50"
          >
            <X className="w-4 h-4" />
            End Impersonation
          </button>
        </div>
      </div>
    );
  }

  // If super admin, show the user switcher button
  if (isSuperAdmin) {
    return (
      <div className="relative">
        <button
          onClick={() => setIsDropdownOpen(!isDropdownOpen)}
          className="flex items-center gap-2 px-3 py-1.5 bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200 transition-colors"
        >
          <Users className="w-4 h-4" />
          <span className="font-medium text-sm">Impersonate</span>
          <ChevronDown className={`w-4 h-4 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} />
        </button>

        {isDropdownOpen && (
          <>
            {/* Backdrop */}
            <div 
              className="fixed inset-0 z-40"
              onClick={() => setIsDropdownOpen(false)}
            />
            
            {/* Dropdown */}
            <div className="absolute right-0 mt-2 w-96 bg-white rounded-xl shadow-2xl border border-gray-200 z-50 overflow-hidden">
              <div className="p-3 border-b border-gray-100 bg-gray-50">
                <div className="flex items-center gap-2 text-gray-600 mb-2">
                  <Shield className="w-4 h-4" />
                  <span className="font-medium text-sm">Super Admin Impersonation</span>
                </div>
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Search users, emails, accounts..."
                    className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                    autoFocus
                  />
                </div>
              </div>

              <div className="max-h-80 overflow-y-auto">
                {Object.entries(groupedTargets).map(([role, roleTargets]) => (
                  <div key={role}>
                    <div className="px-3 py-2 bg-gray-50 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      {role.replace('_', ' ')} ({roleTargets.length})
                    </div>
                    {roleTargets.map(target => (
                      <button
                        key={target.id}
                        onClick={() => handleImpersonate(target.id)}
                        disabled={isLoading}
                        className="w-full px-3 py-3 flex items-center gap-3 hover:bg-purple-50 transition-colors text-left disabled:opacity-50"
                      >
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-400 to-blue-500 flex items-center justify-center text-white font-semibold text-sm">
                          {(target.firstName?.[0] || target.email[0]).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-gray-900 truncate">
                              {target.firstName && target.lastName 
                                ? `${target.firstName} ${target.lastName}`
                                : target.email}
                            </span>
                            <span className={`px-2 py-0.5 rounded text-xs font-medium ${roleColors[target.highestRole] || roleColors.VIEWER}`}>
                              {target.highestRole}
                            </span>
                          </div>
                          <div className="text-xs text-gray-500 truncate">{target.email}</div>
                          {target.accounts.length > 0 && (
                            <div className="flex items-center gap-1 mt-1">
                              <Building2 className="w-3 h-3 text-gray-400" />
                              <span className="text-xs text-gray-400 truncate">
                                {target.accounts.map(a => a.name).join(', ')}
                              </span>
                            </div>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                ))}

                {filteredTargets.length === 0 && (
                  <div className="p-6 text-center text-gray-500">
                    <Users className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">
                      {searchTerm ? 'No users found matching your search' : 'No users available'}
                    </p>
                  </div>
                )}
              </div>

              <div className="p-3 border-t border-gray-100 bg-gray-50">
                <p className="text-xs text-gray-500 text-center">
                  ⚠️ All impersonation actions are logged for security audits
                </p>
              </div>
            </div>
          </>
        )}
      </div>
    );
  }

  return null;
}
