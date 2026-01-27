import axios, { AxiosError } from 'axios';

// Use same origin (empty baseURL) in production, fallback to Railway URL for development
const API_BASE_URL = import.meta.env.VITE_API_URL ?? '';

// Store CSRF token for state-changing requests
let csrfToken: string | null = null;

export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true,
});

// Request interceptor - add auth token and CSRF token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('accessToken');
    if (token && token !== 'undefined' && token !== 'null') {
      config.headers.Authorization = `Bearer ${token}`;
    }
    
    // Add CSRF token for state-changing requests (POST, PUT, PATCH, DELETE)
    if (csrfToken && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(config.method?.toUpperCase() || '')) {
      config.headers['X-CSRF-Token'] = csrfToken;
    }
    
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor - handle token refresh and improved error handling
let isRefreshing = false;
let failedQueue: Array<{ resolve: (value: any) => void; reject: (reason?: any) => void }> = [];

const processQueue = (error: any, token: string | null = null) => {
  failedQueue.forEach(prom => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

// Improved error handler with better messages
const handleApiError = (error: AxiosError<any>) => {
  const status = error.response?.status;
  const url = error.config?.url || 'unknown';
  
  // Log for debugging
  console.error(`[API Error] ${status} on ${url}:`, error.response?.data || error.message);
  
  // Enhanced error messages based on status
  if (status === 404) {
    const isApiRoute = url.includes('/api/');
    if (isApiRoute) {
      console.warn(`[API] Route not found: ${url}. Server may need to be updated or restarted.`);
    }
  } else if (status === 500) {
    console.error(`[API] Server error on ${url}. Check server logs for details.`);
  } else if (!error.response) {
    console.error(`[API] Network error - server may be unavailable`);
  }
  
  return error;
};

api.interceptors.response.use(
  (response) => {
    // Capture CSRF token from response header
    const newCsrfToken = response.headers['x-csrf-token'];
    if (newCsrfToken) {
      csrfToken = newCsrfToken;
    }
    return response;
  },
  async (error) => {
    // Capture CSRF token from error responses
    const newCsrfToken = error.response?.headers?.['x-csrf-token'];
    if (newCsrfToken) {
      csrfToken = newCsrfToken;
    }
    
    const originalRequest = error.config;
    
    // Enhanced error handling
    handleApiError(error);

    // If 401 and not already retried, try to refresh token
    if (error.response?.status === 401 && !originalRequest._retry) {
      // Skip refresh for auth endpoints (login, register, etc.)
      if (originalRequest.url?.includes('/api/auth/login') || 
          originalRequest.url?.includes('/api/auth/register') ||
          originalRequest.url?.includes('/api/auth/refresh-token')) {
        return Promise.reject(error);
      }

      if (isRefreshing) {
        // Queue the request while refreshing
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then(token => {
          originalRequest.headers.Authorization = `Bearer ${token}`;
          return api(originalRequest);
        }).catch(err => {
          return Promise.reject(err);
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const refreshToken = localStorage.getItem('refreshToken');
        const impersonationState = localStorage.getItem('impersonationState');
        
        // If impersonating without refresh token, don't attempt refresh - just fail silently
        // Impersonation sessions are intentionally short-lived without refresh capability
        if (impersonationState) {
          const state = JSON.parse(impersonationState);
          if (state.isImpersonating && (!refreshToken || refreshToken === 'undefined' || refreshToken === 'null' || refreshToken === '')) {
            console.log('[Auth] Impersonation session - skipping refresh, token may have expired');
            isRefreshing = false;
            // Don't redirect - let the component handle the error
            return Promise.reject(error);
          }
        }
        
        // Only attempt refresh if we have a valid refresh token
        if (!refreshToken || refreshToken === 'undefined' || refreshToken === 'null' || refreshToken === '') {
          throw new Error('No valid refresh token available');
        }

        console.log('[Auth] Attempting token refresh...');
        
        const response = await axios.post(`${API_BASE_URL}/api/auth/refresh-token`, {
          refreshToken,
        }, {
          headers: { 'Content-Type': 'application/json' },
        });

        const { accessToken, refreshToken: newRefreshToken } = response.data.data;
        
        console.log('[Auth] Token refresh successful');
        
        if (accessToken && accessToken !== 'undefined') {
          localStorage.setItem('accessToken', accessToken);
        }
        if (newRefreshToken && newRefreshToken !== 'undefined') {
          localStorage.setItem('refreshToken', newRefreshToken);
        }
        
        processQueue(null, accessToken);
        originalRequest.headers.Authorization = `Bearer ${accessToken}`;
        return api(originalRequest);
      } catch (refreshError: any) {
        console.error('[Auth] Token refresh failed:', refreshError?.response?.data || refreshError.message);
        processQueue(refreshError, null);
        
        // Only logout if refresh genuinely failed with 401/400, not network errors
        const refreshStatus = refreshError?.response?.status;
        if (refreshStatus === 401 || refreshStatus === 400) {
          // Refresh token is invalid/expired - must logout
          const isAuthPage = window.location.pathname.includes('/login') || 
                            window.location.pathname.includes('/register') ||
                            window.location.pathname.includes('/forgot-password');
          
          if (!isAuthPage) {
            console.log('[Auth] Refresh failed with', refreshStatus, '- logging out');
            localStorage.removeItem('accessToken');
            localStorage.removeItem('refreshToken');
            window.location.href = '/login';
          }
        }
        // For network errors (no response), don't logout - might be temporary
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    // For non-401 errors, reject and let the caller handle it
    return Promise.reject(error);
  }
);

// Auth API is defined below with extended methods

// Vehicles API
export const vehiclesApi = {
  getAll: (params?: { page?: number; limit?: number; search?: string; status?: string; accountId?: string }) =>
    api.get('/api/vehicles', { params }),
  
  getById: (id: string) => api.get(`/api/vehicles/${id}`),
  
  create: (data: any) => api.post('/api/vehicles', data),
  
  update: (id: string, data: any) => api.put(`/api/vehicles/${id}`, data),
  
  delete: (id: string) => api.delete(`/api/vehicles/${id}`),
  
  bulkDelete: (ids: string[]) => api.post('/api/vehicles/bulk-delete', { ids }),
  
  generateDescription: (id: string) => api.post(`/api/vehicles/${id}/generate-description`),
  
  refreshFromSource: (id: string) => api.post(`/api/vehicles/${id}/refresh-from-source`),
  
  postToFacebook: (id: string, data: {
    title: string;
    price: number;
    description: string;
    photos: string[];
    method: string;
    ultraSpeed?: boolean; // Ultra Speed mode for IAI (Chrome Extension only)
    includePixelTracking?: boolean;
  }) => api.post(`/api/vehicles/${id}/post-to-facebook`, data),
};

// Accounts API
export const accountsApi = {
  getAll: () => api.get('/api/accounts'),
  
  getCurrent: () => api.get('/api/accounts/current'),
  
  getById: (id: string) => api.get(`/api/accounts/${id}`),
  
  update: (id: string, data: {
    ftpHost?: string;
    ftpPort?: number;
    ftpUsername?: string;
    ftpPassword?: string;
    csvPath?: string;
    autoSync?: boolean;
    syncInterval?: number;
  }) => api.put(`/api/accounts/${id}/settings`, data),
  
  updateSettings: (id: string, data: {
    ftpHost?: string;
    ftpPort?: number;
    ftpUsername?: string;
    ftpPassword?: string;
    csvPath?: string;
    autoSync?: boolean;
    syncInterval?: number;
  }) => api.put(`/api/accounts/${id}/settings`, data),
  
  updateDealership: (id: string, data: {
    name?: string;
    dealershipName?: string;
    address?: string;
    city?: string;
    state?: string;
    zip?: string;
    phone?: string;
    website?: string;
    logo?: string;
  }) => api.put(`/api/accounts/${id}/dealership`, data),
  
  getNotificationSettings: (id: string) => api.get(`/api/accounts/${id}/notifications`),
  
  updateNotificationSettings: (id: string, data: {
    emailSyncComplete?: boolean;
    emailSyncError?: boolean;
    emailNewLead?: boolean;
    pushNotifications?: boolean;
  }) => api.put(`/api/accounts/${id}/notifications`, data),
  
  testFtp: (data: { host: string; port?: number; username: string; password: string; path: string }) =>
    api.post('/api/accounts/test-ftp', data),
};

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
  
  updateProfile: (data: { firstName?: string; lastName?: string; email?: string; phone?: string }) =>
    api.put('/api/auth/profile', data),
  
  changePassword: (currentPassword: string, newPassword: string) =>
    api.post('/api/auth/change-password', { currentPassword, newPassword }),
  
  // Impersonation endpoints
  getImpersonationTargets: () => api.get('/api/auth/impersonation/targets'),
  
  impersonateUser: (userId: string) =>
    api.post(`/api/auth/impersonate/${userId}`),
  
  endImpersonation: () =>
    api.post('/api/auth/end-impersonation'),
  
  getSessions: () => api.get('/api/auth/sessions'),
  
  revokeOtherSessions: () => api.post('/api/auth/sessions/revoke-others'),
  
  forgotPassword: (email: string) => api.post('/api/auth/forgot-password', { email }),
  
  resetPassword: (token: string, password: string) =>
    api.post('/api/auth/reset-password', { token, password }),
  
  refreshToken: (refreshToken: string) =>
    api.post('/api/auth/refresh-token', { refreshToken }),
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
  triggerSync: (accountId?: string) => api.post('/api/sync/manual', { accountId }),
  
  getStatus: (jobId: string) => api.get(`/api/sync/status/${jobId}`),
  
  getHistory: (params?: { page?: number; limit?: number; accountId?: string }) =>
    api.get('/api/sync/history', { params }),
  
  getJobDetails: (jobId: string) => api.get(`/api/sync/jobs/${jobId}`),
  
  uploadFile: (
    file: File,
    accountId: string,
    options?: {
      skipHeader?: boolean;
      updateExisting?: boolean;
      markMissingSold?: boolean;
      delimiter?: 'comma' | 'semicolon' | 'tab';
    }
  ) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('accountId', accountId);
    if (options?.skipHeader !== undefined) formData.append('skipHeader', String(options.skipHeader));
    if (options?.updateExisting !== undefined) formData.append('updateExisting', String(options.updateExisting));
    if (options?.markMissingSold !== undefined) formData.append('markMissingSold', String(options.markMissingSold));
    if (options?.delimiter) formData.append('delimiter', options.delimiter);
    
    return api.post('/api/sync/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
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

  // System Settings
  getSystemSettings: () => api.get('/api/admin/system-settings'),
  
  updateSystemSettings: (data: { type: string; settings: any }) =>
    api.put('/api/admin/system-settings', data),
  
  testEmailConfiguration: (config: any) =>
    api.post('/api/admin/system-settings/test-email', config),

  // Subscription Plans Management
  getSubscriptionPlans: () => api.get('/api/admin/subscription-plans'),
  
  createSubscriptionPlan: (data: any) => api.post('/api/admin/subscription-plans', data),
  
  updateSubscriptionPlan: (planId: string, data: any) =>
    api.put(`/api/admin/subscription-plans/${planId}`, data),
  
  deleteSubscriptionPlan: (planId: string) =>
    api.delete(`/api/admin/subscription-plans/${planId}`),

  // Email Templates Management
  getEmailTemplates: () => api.get('/api/admin/email-templates'),
  
  createEmailTemplate: (data: any) => api.post('/api/admin/email-templates', data),
  
  updateEmailTemplate: (templateId: string, data: any) =>
    api.put(`/api/admin/email-templates/${templateId}`, data),
  
  deleteEmailTemplate: (templateId: string) =>
    api.delete(`/api/admin/email-templates/${templateId}`),

  // Facebook Configuration Management
  getFacebookConfig: () => api.get('/api/admin/facebook/config'),
  
  updateFacebookConfig: (data: { appId?: string; appSecret?: string }) =>
    api.put('/api/admin/facebook/config', data),
  
  testFacebookConfig: () => api.post('/api/admin/facebook/config/test'),
  
  getFacebookProfiles: (params?: { status?: string; search?: string; limit?: number; offset?: number }) =>
    api.get('/api/admin/facebook/profiles', { params }),
  
  revokeFacebookProfile: (profileId: string) =>
    api.post(`/api/admin/facebook/profiles/${profileId}/revoke`),

  // Extension Configuration Management
  getExtensionConfig: () => api.get('/api/admin/extension/config'),
  
  updateExtensionConfig: (data: { 
    extensionId?: string; 
    facebookAppId?: string; 
    facebookAppSecret?: string;
  }) => api.put('/api/admin/extension/config', data),
  
  testExtensionConfig: () => api.post('/api/admin/extension/config/test'),
  
  // Facebook Session Management
  importFacebookSession: (data: { accountId: string; cookies: any[] }) =>
    api.post('/api/facebook/session/import', data),
  
  getFacebookSessionStatus: (accountId: string) =>
    api.get(`/api/facebook/session/status/${accountId}`),
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
    source?: string;
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
  }) => api.get(`/api/messages/conversations/${conversationId}`, { params }),
  
  sendMessage: (conversationId: string, data: { 
    text: string; 
    attachments?: string[];
  }) => api.post(`/api/messages/conversations/${conversationId}`, data),
  
  markAsRead: (conversationId: string) => 
    api.patch(`/api/messages/conversations/${conversationId}/read`),
  
  toggleStar: (conversationId: string) => 
    api.post(`/api/messages/conversations/${conversationId}/star`),
  
  archive: (conversationId: string) => 
    api.post(`/api/messages/conversations/${conversationId}/archive`),
  
  unarchive: (conversationId: string) => 
    api.patch(`/api/messages/conversations/${conversationId}/unarchive`),
  
  getUnreadCount: () => api.get('/api/messages/stats'),
  
  syncFromFacebook: () => api.post('/api/messages/sync'),
  
  getStats: () => api.get('/api/messages/stats'),
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
  
  // Manual create member with password
  createMember: (data: {
    email: string;
    firstName: string;
    lastName: string;
    password: string;
    role: string;
  }) => api.post('/api/team/members', data),
  
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

// Intelliceil Security API
export const intelliceilApi = {
  // Get full status (dashboard data)
  getStatus: () => api.get('/api/intelliceil/status'),
  
  // Get geo locations for map
  getGeoLocations: () => api.get('/api/intelliceil/geo-locations'),
  
  // Get traffic history for charts
  getTrafficHistory: () => api.get('/api/intelliceil/traffic-history'),
  
  // Get configuration
  getConfig: () => api.get('/api/intelliceil/config'),
  
  // Update configuration
  updateConfig: (config: {
    enabled?: boolean;
    alertThreshold?: number;
    mitigationThreshold?: number;
    autoMitigate?: boolean;
    notifyOnAttack?: boolean;
    notifyEmail?: string;
    maxRequestsPerIP?: number;
    windowSeconds?: number;
    // Enterprise Security Settings
    enableSignatureValidation?: boolean;
    enableTokenFingerprinting?: boolean;
    enableSQLInjectionDetection?: boolean;
    enableXSSDetection?: boolean;
    enableBotDetection?: boolean;
    enableIPReputation?: boolean;
    botDetectionThreshold?: number;
  }) => api.put('/api/intelliceil/config', config),
  
  // Block an IP
  blockIP: (ip: string) => api.post('/api/intelliceil/block-ip', { ip }),
  
  // Unblock an IP
  unblockIP: (ip: string) => api.post('/api/intelliceil/unblock-ip', { ip }),
  
  // Activate mitigation manually
  activateMitigation: () => api.post('/api/intelliceil/mitigation/activate'),
  
  // Deactivate mitigation
  deactivateMitigation: () => api.post('/api/intelliceil/mitigation/deactivate'),
  
  // Add trusted domain
  addTrustedDomain: (domain: string) => api.post('/api/intelliceil/trusted-domains', { domain }),
  
  // Remove trusted domain
  removeTrustedDomain: (domain: string) => api.delete('/api/intelliceil/trusted-domains', { data: { domain } }),
};

// IIPC (Internal IP Controller) API
export const iipcApi = {
  // Get full status with rules
  getStatus: () => api.get('/api/iipc/status'),
  
  // Get configuration
  getConfig: () => api.get('/api/iipc/config'),
  
  // Update configuration
  updateConfig: (config: {
    enabled?: boolean;
    enforceIPMatching?: boolean;
    allowEmergencyAccess?: boolean;
    emergencyCodeExpireMinutes?: number;
  }) => api.put('/api/iipc/config', config),
  
  // Get role settings
  getRoleSettings: (role?: string) => api.get('/api/iipc/roles', { params: { role } }),
  
  // Update role settings
  updateRoleSettings: (data: { role: string; settings: Record<string, unknown> }) =>
    api.put('/api/iipc/roles', data),
  
  // Get all IP rules
  getRules: (params?: { scope?: string; type?: string }) =>
    api.get('/api/iipc/rules', { params }),
  
  // Add new IP rule
  addRule: (rule: {
    ip: string;
    type: 'WHITELIST' | 'BLACKLIST';
    scope: 'GLOBAL' | 'ROLE' | 'USER' | 'NETWORK';
    scopeValue?: string;
    computerName?: string;
    description?: string;
    canOverrideRateLimit?: boolean;
    canOverrideLoginBlock?: boolean;
    canOverrideAllSecurity?: boolean;
    expiresAt?: string;
  }) => api.post('/api/iipc/rules', rule),
  
  // Update IP rule
  updateRule: (id: string, updates: Record<string, unknown>) =>
    api.put(`/api/iipc/rules/${id}`, updates),
  
  // Delete IP rule
  deleteRule: (id: string) => api.delete(`/api/iipc/rules/${id}`),
  
  // Get super admin IPs
  getSuperAdminIPs: () => api.get('/api/iipc/super-admin-ips'),
  
  // Add super admin IP
  addSuperAdminIP: (ip: string) => api.post('/api/iipc/super-admin-ips', { ip }),
  
  // Remove super admin IP
  removeSuperAdminIP: (ip: string) => api.delete('/api/iipc/super-admin-ips', { data: { ip } }),
  
  // Request emergency access
  requestEmergencyAccess: (email: string) =>
    api.post('/api/iipc/emergency/request', { email }),
  
  // Verify emergency access code
  verifyEmergencyAccess: (email: string, code: string) =>
    api.post('/api/iipc/emergency/verify', { email, code }),
  
  // Whitelist own IP (self-service)
  whitelistOwnIP: (data?: { computerName?: string; description?: string }) =>
    api.post('/api/iipc/whitelist-own-ip', data),
  
  // Get user's whitelisted IPs
  getUserIPs: (userId?: string) =>
    api.get('/api/iipc/user-ips', { params: { userId } }),
  
  // Check current IP status
  checkCurrentIP: () => api.get('/api/iipc/check-ip'),
  
  // Reset rate limits for IP (Super Admin)
  resetRateLimits: (ip?: string) =>
    api.post('/api/iipc/reset-rate-limits', { ip }),
  
  // Reset ALL rate limits (Super Admin - use with caution)
  resetAllRateLimits: () =>
    api.post('/api/iipc/reset-all-rate-limits'),
};

// Reports & Email API
export const reportsApi = {
  // Super Admin Reports
  generateSuperAdminReport: (data: { period: string; sendEmail?: boolean; customRange?: { start: string; end: string } }) =>
    api.post('/api/reports/super-admin', data),
  
  // Security Reports
  generateSecurityReport: (data: { period: string; sendEmail?: boolean }) =>
    api.post('/api/reports/security', data),
  
  // Admin (Dealer) Reports
  generateAdminReport: (data: { period: string; sendEmail?: boolean; customRange?: { start: string; end: string } }) =>
    api.post('/api/reports/admin', data),
  
  generateAdminReportForAccount: (accountId: string, data: { period: string; sendEmail?: boolean; recipientEmail?: string }) =>
    api.post(`/api/reports/admin/${accountId}`, data),
  
  // User Reports
  generateUserReport: (data: { period: string; sendEmail?: boolean }) =>
    api.post('/api/reports/user', data),
  
  generateUserReportForUser: (userId: string, data: { period: string; sendEmail?: boolean; recipientEmail?: string }) =>
    api.post(`/api/reports/user/${userId}`, data),
  
  // Preview Reports (returns HTML)
  previewReport: (type: string, period: string = 'weekly') =>
    api.get(`/api/reports/preview/${type}?period=${period}`),
  
  // Notification Config
  getNotificationConfig: () =>
    api.get('/api/reports/notification-config'),
  
  updateNotificationConfig: (config: {
    enabled?: boolean;
    superAdminEmail?: string;
    notifyOnAttack?: boolean;
    notifyOnMitigation?: boolean;
    notifyOnSQLInjection?: boolean;
    notifyOnXSS?: boolean;
    notifyOnBot?: boolean;
    notifyOnHoneypot?: boolean;
    cooldownMinutes?: number;
  }) => api.put('/api/reports/notification-config', config),
  
  // Test Notifications
  sendTestNotification: (type: string) =>
    api.post('/api/reports/test-notification', { type }),
  
  // Trigger Scheduled Reports
  triggerScheduledReports: (period: string = 'weekly') =>
    api.post('/api/reports/trigger-scheduled', { period }),

  // PDF Downloads
  downloadReportPDF: (type: string, period: string = 'weekly') =>
    api.get(`/api/reports/download/${type}?period=${period}`, { responseType: 'blob' }),

  // Invoice endpoints
  createInvoice: (data: {
    accountId: string;
    items: { description: string; quantity: number; unitPrice: number }[];
    taxRate?: number;
    notes?: string;
    paymentTerms?: string;
    dueInDays?: number;
  }) => api.post('/api/reports/invoices', data),
  
  getInvoicePDF: (invoiceId: string) =>
    api.get(`/api/reports/invoices/${invoiceId}/pdf`, { responseType: 'blob' }),
  
  sendInvoice: (invoiceId: string) =>
    api.post(`/api/reports/invoices/${invoiceId}/send`),
  
  markInvoicePaid: (invoiceId: string, data?: { paymentMethod?: string; transactionId?: string }) =>
    api.post(`/api/reports/invoices/${invoiceId}/paid`, data),
};

// Cloud AI Sales Assistant API (Public - no auth required)
export const cloudApi = {
  // Chat with Cloud
  chat: (data: { 
    message: string; 
    conversationHistory?: Array<{ role: string; content: string }>; 
    sessionId?: string;
  }) => api.post('/api/cloud/chat', data),
  
  // Get product information
  getProductInfo: () => api.get('/api/cloud/product-info'),
  
  // Get FAQ
  getFaq: () => api.get('/api/cloud/faq'),
  
  // Check Cloud status
  getStatus: () => api.get('/api/cloud/status'),
};

// API Dashboard API (Super Admin Only)
export const apiDashboardApi = {
  // Get comprehensive dashboard data
  getDashboard: async () => {
    const response = await api.get('/api/admin/api-dashboard');
    return response.data;
  },
  
  // Get endpoint categories summary
  getCategories: async () => {
    const response = await api.get('/api/admin/api-dashboard/categories');
    return response.data;
  },
  
  // Get all endpoints
  getEndpoints: async (category?: string) => {
    const response = await api.get('/api/admin/api-dashboard/endpoints', { params: { category } });
    return response.data;
  },
  
  // Get single endpoint details
  getEndpointDetails: async (endpointId: string) => {
    const response = await api.get(`/api/admin/api-dashboard/endpoints/${endpointId}`);
    return response.data;
  },
  
  // Health check specific endpoint
  checkEndpointHealth: async (endpointId: string) => {
    const response = await api.post(`/api/admin/api-dashboard/endpoints/${endpointId}/health-check`);
    return response.data;
  },
  
  // Get all services
  getServices: async () => {
    const response = await api.get('/api/admin/api-dashboard/services');
    return response.data;
  },
  
  // Get single service details
  getServiceDetails: async (serviceId: string) => {
    const response = await api.get(`/api/admin/api-dashboard/services/${serviceId}`);
    return response.data;
  },
  
  // Control a service (start, stop, restart, pause)
  controlService: async (serviceId: string, action: string) => {
    const response = await api.post(`/api/admin/api-dashboard/services/${serviceId}/control`, { action });
    return response.data;
  },
  
  // Run full health check on all endpoints
  runFullHealthCheck: async () => {
    const response = await api.post('/api/admin/api-dashboard/health-check');
    return response.data;
  },
  
  // Activate PANIC mode
  activatePanicMode: async (reason?: string) => {
    const response = await api.post('/api/admin/api-dashboard/panic', { reason });
    return response.data;
  },
  
  // Deactivate PANIC mode
  deactivatePanicMode: async () => {
    const response = await api.delete('/api/admin/api-dashboard/panic');
    return response.data;
  },
};

export default api;
