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

// Leads API
export const leadsApi = {
  getAll: (params?: { 
    page?: number; 
    limit?: number; 
    search?: string; 
    status?: string; 
    source?: string;
    starred?: boolean;
    startDate?: string;
    endDate?: string;
  }) => api.get('/api/leads', { params }),
  
  getById: (id: string) => api.get(`/api/leads/${id}`),
  
  create: (data: {
    firstName: string;
    lastName: string;
    email?: string;
    phone?: string;
    source: string;
    vehicleId?: string;
    notes?: string;
  }) => api.post('/api/leads', data),
  
  update: (id: string, data: {
    firstName?: string;
    lastName?: string;
    email?: string;
    phone?: string;
    status?: string;
    notes?: string;
    isStarred?: boolean;
  }) => api.put(`/api/leads/${id}`, data),
  
  updateStatus: (id: string, status: string) => 
    api.patch(`/api/leads/${id}/status`, { status }),
  
  toggleStar: (id: string) => api.patch(`/api/leads/${id}/star`),
  
  delete: (id: string) => api.delete(`/api/leads/${id}`),
  
  bulkDelete: (ids: string[]) => api.post('/api/leads/bulk-delete', { ids }),
  
  export: (params?: { format?: 'csv' | 'xlsx'; status?: string }) =>
    api.get('/api/leads/export', { params, responseType: 'blob' }),
  
  getStats: () => api.get('/api/leads/stats'),
};

// Messages API
export const messagesApi = {
  getConversations: (params?: {
    page?: number;
    limit?: number;
    search?: string;
    unreadOnly?: boolean;
    starred?: boolean;
    archived?: boolean;
  }) => api.get('/api/messages/conversations', { params }),
  
  getConversation: (conversationId: string) => 
    api.get(`/api/messages/conversations/${conversationId}`),
  
  getMessages: (conversationId: string, params?: { 
    page?: number; 
    limit?: number; 
    before?: string;
  }) => api.get(`/api/messages/conversations/${conversationId}/messages`, { params }),
  
  sendMessage: (conversationId: string, data: { 
    content: string; 
    attachments?: string[];
  }) => api.post(`/api/messages/conversations/${conversationId}/messages`, data),
  
  markAsRead: (conversationId: string) => 
    api.patch(`/api/messages/conversations/${conversationId}/read`),
  
  toggleStar: (conversationId: string) => 
    api.patch(`/api/messages/conversations/${conversationId}/star`),
  
  archive: (conversationId: string) => 
    api.patch(`/api/messages/conversations/${conversationId}/archive`),
  
  unarchive: (conversationId: string) => 
    api.patch(`/api/messages/conversations/${conversationId}/unarchive`),
  
  getUnreadCount: () => api.get('/api/messages/unread-count'),
  
  syncFromFacebook: () => api.post('/api/messages/sync'),
};

// Analytics API
export const analyticsApi = {
  getOverview: (params?: { 
    startDate?: string; 
    endDate?: string; 
    period?: 'day' | 'week' | 'month';
  }) => api.get('/api/analytics/overview', { params }),
  
  getLeadsTrend: (params?: { 
    startDate?: string; 
    endDate?: string;
    groupBy?: 'day' | 'week' | 'month';
  }) => api.get('/api/analytics/leads-trend', { params }),
  
  getViewsTrend: (params?: { 
    startDate?: string; 
    endDate?: string;
    groupBy?: 'day' | 'week' | 'month';
  }) => api.get('/api/analytics/views-trend', { params }),
  
  getLeadSources: (params?: { startDate?: string; endDate?: string }) =>
    api.get('/api/analytics/lead-sources', { params }),
  
  getTopVehicles: (params?: { 
    limit?: number; 
    sortBy?: 'views' | 'leads' | 'conversions';
    startDate?: string; 
    endDate?: string;
  }) => api.get('/api/analytics/top-vehicles', { params }),
  
  getKeyMetrics: (params?: { startDate?: string; endDate?: string }) =>
    api.get('/api/analytics/metrics', { params }),
  
  getActivityFeed: (params?: { limit?: number }) =>
    api.get('/api/analytics/activity', { params }),
  
  export: (params?: { 
    format?: 'csv' | 'pdf'; 
    startDate?: string; 
    endDate?: string;
    sections?: string[];
  }) => api.get('/api/analytics/export', { params, responseType: 'blob' }),
};

// API Keys API
export const apiKeysApi = {
  getAll: () => api.get('/api/api-keys'),
  
  create: (data: { 
    name: string; 
    permissions: string[];
    expiresIn?: number; // days
  }) => api.post('/api/api-keys', data),
  
  revoke: (id: string) => api.delete(`/api/api-keys/${id}`),
  
  regenerate: (id: string) => api.post(`/api/api-keys/${id}/regenerate`),
  
  getUsage: (id: string, params?: { startDate?: string; endDate?: string }) =>
    api.get(`/api/api-keys/${id}/usage`, { params }),
};

// Team/Users API (for dealership team management)
export const teamApi = {
  getMembers: (params?: { page?: number; limit?: number; role?: string }) =>
    api.get('/api/team/members', { params }),
  
  invite: (data: { 
    email: string; 
    firstName: string; 
    lastName: string; 
    role: string;
  }) => api.post('/api/team/invite', data),
  
  updateMember: (userId: string, data: { role?: string; isActive?: boolean }) =>
    api.put(`/api/team/members/${userId}`, data),
  
  removeMember: (userId: string) => api.delete(`/api/team/members/${userId}`),
  
  resendInvite: (userId: string) => api.post(`/api/team/members/${userId}/resend-invite`),
  
  getPendingInvites: () => api.get('/api/team/invites'),
  
  cancelInvite: (inviteId: string) => api.delete(`/api/team/invites/${inviteId}`),
};

// Subscription API
export const subscriptionApi = {
  getCurrent: () => api.get('/api/subscription'),
  
  getPlans: () => api.get('/api/subscription/plans'),
  
  subscribe: (planId: string, paymentMethodId?: string) =>
    api.post('/api/subscription/subscribe', { planId, paymentMethodId }),
  
  updatePlan: (planId: string) => api.put('/api/subscription/plan', { planId }),
  
  cancel: (immediately?: boolean) => 
    api.post('/api/subscription/cancel', { immediately }),
  
  resume: () => api.post('/api/subscription/resume'),
  
  getBillingHistory: (params?: { page?: number; limit?: number }) =>
    api.get('/api/subscription/billing-history', { params }),
  
  updatePaymentMethod: (paymentMethodId: string) =>
    api.put('/api/subscription/payment-method', { paymentMethodId }),
  
  getInvoices: (params?: { page?: number; limit?: number }) =>
    api.get('/api/subscription/invoices', { params }),
  
  downloadInvoice: (invoiceId: string) =>
    api.get(`/api/subscription/invoices/${invoiceId}/download`, { responseType: 'blob' }),
};

// Notifications API
export const notificationsApi = {
  getAll: (params?: { page?: number; limit?: number; unreadOnly?: boolean }) =>
    api.get('/api/notifications', { params }),
  
  markAsRead: (id: string) => api.patch(`/api/notifications/${id}/read`),
  
  markAllAsRead: () => api.patch('/api/notifications/read-all'),
  
  getPreferences: () => api.get('/api/notifications/preferences'),
  
  updatePreferences: (data: {
    emailNotifications?: boolean;
    pushNotifications?: boolean;
    newLeadNotifications?: boolean;
    syncStatusNotifications?: boolean;
    weeklyReportNotifications?: boolean;
  }) => api.put('/api/notifications/preferences', data),
  
  delete: (id: string) => api.delete(`/api/notifications/${id}`),
  
  deleteAll: () => api.delete('/api/notifications'),
};

export default api;

