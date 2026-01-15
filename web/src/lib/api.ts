import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://fmd-production.up.railway.app';

export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true,
});

// Request interceptor - add auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('accessToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor - handle token refresh
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // If 401 and not already retried, try to refresh token
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        const refreshToken = localStorage.getItem('refreshToken');
        if (refreshToken) {
          const response = await axios.post(`${API_BASE_URL}/api/auth/refresh`, {
            refreshToken,
          });

          const { accessToken, refreshToken: newRefreshToken } = response.data.data;
          
          localStorage.setItem('accessToken', accessToken);
          localStorage.setItem('refreshToken', newRefreshToken);
          
          originalRequest.headers.Authorization = `Bearer ${accessToken}`;
          return api(originalRequest);
        }
      } catch (refreshError) {
        // Refresh failed - logout user
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        window.location.href = '/login';
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

// Auth API
export const authApi = {
  login: (email: string, password: string) =>
    api.post('/api/auth/login', { email, password }),
  
  register: (data: { email: string; password: string; firstName: string; lastName: string; accountName?: string }) =>
    api.post('/api/auth/register', data),
  
  logout: () => {
    const refreshToken = localStorage.getItem('refreshToken');
    return api.post('/api/auth/logout', { refreshToken });
  },
  
  getProfile: () => api.get('/api/auth/me'),
  
  forgotPassword: (email: string) =>
    api.post('/api/auth/forgot-password', { email }),
  
  resetPassword: (token: string, password: string) =>
    api.post('/api/auth/reset-password', { token, password }),
};

// Vehicles API
export const vehiclesApi = {
  getAll: (params?: { page?: number; limit?: number; search?: string; status?: string }) =>
    api.get('/api/vehicles', { params }),
  
  getById: (id: string) => api.get(`/api/vehicles/${id}`),
  
  create: (data: any) => api.post('/api/vehicles', data),
  
  update: (id: string, data: any) => api.put(`/api/vehicles/${id}`, data),
  
  delete: (id: string) => api.delete(`/api/vehicles/${id}`),
  
  bulkDelete: (ids: string[]) => api.post('/api/vehicles/bulk-delete', { ids }),
  
  generateDescription: (id: string) => api.post(`/api/vehicles/${id}/generate-description`),
};

// Accounts API
export const accountsApi = {
  getAll: () => api.get('/api/accounts'),
  
  getCurrent: () => api.get('/api/accounts/current'),
  
  update: (id: string, data: any) => api.put(`/api/accounts/${id}`, data),
  
  updateSettings: (id: string, data: any) => api.put(`/api/accounts/${id}/settings`, data),
  
  testFtp: (data: { host: string; username: string; password: string; path: string }) =>
    api.post('/api/accounts/test-ftp', data),
};

// Facebook API
export const facebookApi = {
  getAuthUrl: () => api.get('/api/facebook/auth-url'),
  
  getConnections: () => api.get('/api/facebook/connections'),
  
  disconnect: (connectionId: string) => api.delete(`/api/facebook/connections/${connectionId}`),
  
  getGroups: () => api.get('/api/facebook/groups'),
  
  addGroup: (data: { groupId: string; groupName: string }) =>
    api.post('/api/facebook/groups', data),
  
  removeGroup: (groupId: string) => api.delete(`/api/facebook/groups/${groupId}`),
  
  postVehicle: (vehicleId: string, groupIds?: string[]) =>
    api.post('/api/facebook/post', { vehicleId, groupIds }),
  
  getPostHistory: (vehicleId?: string) =>
    api.get('/api/facebook/posts', { params: { vehicleId } }),
};

// Sync API
export const syncApi = {
  triggerSync: () => api.post('/api/sync/trigger'),
  
  getStatus: () => api.get('/api/sync/status'),
  
  getHistory: (params?: { page?: number; limit?: number }) =>
    api.get('/api/sync/history', { params }),
  
  getJobDetails: (jobId: string) => api.get(`/api/sync/jobs/${jobId}`),
};

// Admin API
export const adminApi = {
  // Users
  getUsers: (params?: { page?: number; limit?: number; offset?: number; role?: string; search?: string }) =>
    api.get('/api/admin/users', { params }),
  
  updateUser: (userId: string, data: any) => api.put(`/api/admin/users/${userId}`, data),
  
  deleteUser: (userId: string) => api.delete(`/api/admin/users/${userId}`),

  // Accounts
  getAccounts: (params?: { limit?: number; offset?: number; search?: string; status?: string }) =>
    api.get('/api/admin/accounts', { params }),
  
  createAccount: (data: any) => api.post('/api/admin/accounts', data),
  
  updateAccountStatus: (accountId: string, isActive: boolean) =>
    api.put(`/api/admin/accounts/${accountId}/status`, { isActive }),
  
  deleteAccount: (accountId: string) => api.delete(`/api/admin/accounts/${accountId}`),

  // Stats & Analytics
  getStats: () => api.get('/api/admin/stats'),
  
  getRevenue: (params?: { period?: string }) => api.get('/api/admin/revenue', { params }),

  // Payments
  getPayments: (params?: { limit?: number; offset?: number; status?: string; startDate?: string; endDate?: string }) =>
    api.get('/api/admin/payments', { params }),

  // Audit Logs
  getAuditLogs: (params?: { page?: number; limit?: number; offset?: number; action?: string; userId?: string }) =>
    api.get('/api/admin/audit-logs', { params }),

  // Email Logs
  getEmailLogs: (params?: { page?: number; limit?: number; status?: string }) =>
    api.get('/api/email/logs', { params }),
  
  getEmailStats: (period?: string) => api.get('/api/email/stats', { params: { period } }),
  
  sendTestEmail: (data: { to: string; subject: string; body: string }) =>
    api.post('/api/email/test', data),
  
  resendEmail: (logId: string) => api.post(`/api/email/resend/${logId}`),
};

export default api;

