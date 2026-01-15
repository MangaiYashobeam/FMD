import api from './api';
import type { User, Account, SystemStats, RevenueData, Payment, AuditLog, EmailLog, EmailStats } from '@/types';

// Auth
export const login = async (email: string, password: string) => {
  const response = await api.post('/auth/login', { email, password });
  return response.data;
};

export const register = async (data: { email: string; password: string; firstName: string; lastName: string; accountName: string }) => {
  const response = await api.post('/auth/register', data);
  return response.data;
};

export const logout = () => {
  localStorage.removeItem('accessToken');
  localStorage.removeItem('refreshToken');
  window.location.href = '/login';
};

// Admin - Accounts
export const getAllAccounts = async () => {
  const response = await api.get<{ success: boolean; data: Account[] }>('/admin/accounts');
  return response.data.data;
};

export const createAccount = async (data: { name: string; dealershipName?: string; ownerEmail: string; ownerPassword: string }) => {
  const response = await api.post('/admin/accounts', data);
  return response.data;
};

export const updateAccountStatus = async (accountId: string, isActive: boolean) => {
  const response = await api.patch(`/admin/accounts/${accountId}/status`, { isActive });
  return response.data;
};

export const deleteAccount = async (accountId: string) => {
  const response = await api.delete(`/admin/accounts/${accountId}`);
  return response.data;
};

// Admin - Users
export const getAllUsers = async () => {
  const response = await api.get<{ success: boolean; data: User[] }>('/admin/users');
  return response.data.data;
};

export const updateUserRole = async (userId: string, role: string) => {
  const response = await api.patch(`/admin/users/${userId}/role`, { role });
  return response.data;
};

// Admin - System Stats
export const getSystemStats = async () => {
  const response = await api.get<{ success: boolean; data: SystemStats }>('/admin/stats');
  return response.data.data;
};

export const getRevenueAnalytics = async (period: string = '12m') => {
  const response = await api.get<{ success: boolean; data: { monthlyData: RevenueData[] } }>(`/admin/revenue?period=${period}`);
  return response.data.data.monthlyData;
};

// Admin - Payments
export const getAllPayments = async (page: number = 1, limit: number = 50) => {
  const response = await api.get<{ success: boolean; data: { payments: Payment[]; pagination: any } }>(`/admin/payments?page=${page}&limit=${limit}`);
  return response.data.data;
};

// Admin - Audit Logs
export const getAuditLogs = async (page: number = 1, limit: number = 50) => {
  const response = await api.get<{ success: boolean; data: { logs: AuditLog[]; pagination: any } }>(`/admin/audit-logs?page=${page}&limit=${limit}`);
  return response.data.data;
};

// Email Management
export const getEmailLogs = async (page: number = 1, limit: number = 50, status?: string) => {
  const params = new URLSearchParams({ page: String(page), limit: String(limit) });
  if (status) params.append('status', status);
  
  const response = await api.get<{ success: boolean; data: { logs: EmailLog[]; pagination: any } }>(`/email/logs?${params}`);
  return response.data.data;
};

export const getEmailStats = async (period: string = '7d') => {
  const response = await api.get<{ success: boolean; data: EmailStats }>(`/email/stats?period=${period}`);
  return response.data.data;
};

export const sendTestEmail = async (data: { to: string; subject: string; body: string }) => {
  const response = await api.post('/email/test', data);
  return response.data;
};

export const sendBulkEmail = async (data: { recipients: string[]; subject: string; body: string }) => {
  const response = await api.post('/email/bulk', data);
  return response.data;
};
