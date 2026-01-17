import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { authApi } from '../lib/api';

interface User {
  id: string;
  email: string;
  name: string;
  role: string;
  accounts: Array<{
    id: string;
    name: string;
    role: string;
  }>;
}

interface ImpersonationState {
  isImpersonating: boolean;
  originalToken: string | null;
  impersonator: {
    id: string;
    email: string;
  } | null;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  impersonation: ImpersonationState;
  login: (email: string, password: string) => Promise<void>;
  register: (data: { email: string; password: string; firstName: string; lastName: string; accountName?: string }) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  impersonateUser: (userId: string) => Promise<void>;
  endImpersonation: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [impersonation, setImpersonation] = useState<ImpersonationState>({
    isImpersonating: false,
    originalToken: null,
    impersonator: null,
  });

  // Clean up corrupted tokens on mount
  useEffect(() => {
    const accessToken = localStorage.getItem('accessToken');
    const refreshToken = localStorage.getItem('refreshToken');
    
    // Remove corrupted tokens (stored as "undefined" or "null" strings)
    if (accessToken === 'undefined' || accessToken === 'null' || accessToken === '') {
      localStorage.removeItem('accessToken');
    }
    if (refreshToken === 'undefined' || refreshToken === 'null' || refreshToken === '') {
      localStorage.removeItem('refreshToken');
    }

    // Check for existing impersonation state
    const storedImpersonation = localStorage.getItem('impersonationState');
    if (storedImpersonation) {
      try {
        const state = JSON.parse(storedImpersonation);
        setImpersonation(state);
      } catch {
        localStorage.removeItem('impersonationState');
      }
    }
  }, []);

  // Check for existing session on mount
  useEffect(() => {
    const checkAuth = async () => {
      const token = localStorage.getItem('accessToken');
      if (token && token !== 'undefined' && token !== 'null') {
        try {
          const response = await authApi.getProfile();
          // The profile endpoint returns user data directly in data (not data.user)
          const userData = response.data.data;
          setUser({
            id: userData.id,
            email: userData.email,
            name: `${userData.firstName || ''} ${userData.lastName || ''}`.trim(),
            role: userData.accounts?.[0]?.role || 'USER',
            accounts: userData.accounts || [],
          });
        } catch (error: any) {
          // Only clear tokens if it's a definitive auth failure (401)
          // The interceptor will have already tried to refresh
          // Network errors should NOT clear tokens
          console.error('[AuthContext] checkAuth failed:', error?.response?.status || error.message);
          
          if (error?.response?.status === 401) {
            // Interceptor already tried refresh and failed - tokens are invalid
            localStorage.removeItem('accessToken');
            localStorage.removeItem('refreshToken');
          }
          // For other errors (network, 500, etc.), keep tokens - might be temporary
        }
      }
      setIsLoading(false);
    };

    checkAuth();
  }, []);

  const login = async (email: string, password: string) => {
    // Clear any existing corrupted tokens before login
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('impersonationState');
    
    const response = await authApi.login(email, password);
    const { accessToken, refreshToken, user: userData, accounts } = response.data.data;
    
    // Only store valid tokens
    if (accessToken && accessToken !== 'undefined') {
      localStorage.setItem('accessToken', accessToken);
    }
    if (refreshToken && refreshToken !== 'undefined') {
      localStorage.setItem('refreshToken', refreshToken);
    }
    // Reset impersonation state on fresh login
    setImpersonation({
      isImpersonating: false,
      originalToken: null,
      impersonator: null,
    });
    // Construct user object with accounts
    setUser({
      id: userData.id,
      email: userData.email,
      name: `${userData.firstName || ''} ${userData.lastName || ''}`.trim(),
      role: accounts?.[0]?.role || 'USER',
      accounts: accounts || [],
    });
  };

  const register = async (data: { email: string; password: string; firstName: string; lastName: string; accountName?: string }) => {
    const response = await authApi.register(data);
    const { accessToken, refreshToken, user: userData, account } = response.data.data;
    
    localStorage.setItem('accessToken', accessToken);
    localStorage.setItem('refreshToken', refreshToken);
    // Construct user object with single account
    setUser({
      id: userData.id,
      email: userData.email,
      name: `${userData.firstName || ''} ${userData.lastName || ''}`.trim(),
      role: 'ACCOUNT_OWNER',
      accounts: account ? [{ id: account.id, name: account.name, role: 'ACCOUNT_OWNER' }] : [],
    });
  };

  const logout = async () => {
    try {
      await authApi.logout();
    } catch (error) {
      // Ignore logout errors
    } finally {
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      localStorage.removeItem('impersonationState');
      setUser(null);
      setImpersonation({
        isImpersonating: false,
        originalToken: null,
        impersonator: null,
      });
    }
  };

  const refreshUser = async () => {
    try {
      const response = await authApi.getProfile();
      setUser(response.data.data.user);
    } catch (error) {
      setUser(null);
    }
  };

  const impersonateUser = async (userId: string) => {
    const currentToken = localStorage.getItem('accessToken');
    const currentRefreshToken = localStorage.getItem('refreshToken');
    
    if (!currentToken) {
      throw new Error('No access token available');
    }

    const response = await authApi.impersonateUser(userId);
    const { accessToken, user: userData, accounts, impersonator } = response.data.data;

    // Store original tokens for restoration
    const impersonationState: ImpersonationState = {
      isImpersonating: true,
      originalToken: currentToken,
      impersonator: impersonator,
    };
    
    // Store original refresh token separately for end impersonation
    localStorage.setItem('originalRefreshToken', currentRefreshToken || '');
    localStorage.setItem('impersonationState', JSON.stringify(impersonationState));
    localStorage.setItem('accessToken', accessToken);
    // Remove refresh token during impersonation (security)
    localStorage.removeItem('refreshToken');
    
    setImpersonation(impersonationState);
    setUser({
      id: userData.id,
      email: userData.email,
      name: `${userData.firstName || ''} ${userData.lastName || ''}`.trim(),
      role: accounts?.[0]?.role || 'USER',
      accounts: accounts || [],
    });
  };

  const endImpersonation = async () => {
    if (!impersonation.isImpersonating || !impersonation.originalToken) {
      throw new Error('Not currently impersonating');
    }

    // Restore original token
    localStorage.setItem('accessToken', impersonation.originalToken);
    const originalRefreshToken = localStorage.getItem('originalRefreshToken');
    if (originalRefreshToken) {
      localStorage.setItem('refreshToken', originalRefreshToken);
    }
    localStorage.removeItem('originalRefreshToken');
    localStorage.removeItem('impersonationState');

    // Fetch original user profile
    try {
      const response = await authApi.getProfile();
      const userData = response.data.data;
      setUser({
        id: userData.id,
        email: userData.email,
        name: `${userData.firstName || ''} ${userData.lastName || ''}`.trim(),
        role: userData.accounts?.[0]?.role || 'USER',
        accounts: userData.accounts || [],
      });
    } catch (error) {
      console.error('Failed to restore admin session:', error);
    }

    setImpersonation({
      isImpersonating: false,
      originalToken: null,
      impersonator: null,
    });
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        impersonation,
        login,
        register,
        logout,
        refreshUser,
        impersonateUser,
        endImpersonation,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
