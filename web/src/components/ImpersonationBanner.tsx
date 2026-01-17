import { useState } from 'react';
import { UserCheck, X } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

export default function ImpersonationBanner() {
  const { user, impersonation, endImpersonation } = useAuth();
  const [isLoading, setIsLoading] = useState(false);

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

  // Only show banner when impersonating
  if (!impersonation.isImpersonating) {
    return null;
  }

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
          {isLoading ? (
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <X className="w-4 h-4" />
          )}
          End Impersonation
        </button>
      </div>
    </div>
  );
}
