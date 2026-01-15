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

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (data: { email: string; password: string; firstName: string; lastName: string; accountName?: string }) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Check for existing session on mount
  useEffect(() => {
    const checkAuth = async () => {
      const token = localStorage.getItem('accessToken');
      if (token) {
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
        } catch (error) {
          // Token invalid - clear storage
          localStorage.removeItem('accessToken');
          localStorage.removeItem('refreshToken');
        }
      }
      setIsLoading(false);
    };

    checkAuth();
  }, []);

  const login = async (email: string, password: string) => {
    const response = await authApi.login(email, password);
    const { accessToken, refreshToken, user: userData, accounts } = response.data.data;
    
    localStorage.setItem('accessToken', accessToken);
    localStorage.setItem('refreshToken', refreshToken);
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
      setUser(null);
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

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        login,
        register,
        logout,
        refreshUser,
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
