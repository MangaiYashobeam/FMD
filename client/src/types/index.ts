export interface User {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  role: UserRole;
  isActive: boolean;
  createdAt: string;
}

export const UserRole = {
  SUPER_ADMIN: 'SUPER_ADMIN',
  ACCOUNT_OWNER: 'ACCOUNT_OWNER',
  ADMIN: 'ADMIN',
  SALES_REP: 'SALES_REP',
  VIEWER: 'VIEWER',
} as const;

export type UserRole = typeof UserRole[keyof typeof UserRole];

export interface Account {
  id: string;
  name: string;
  dealershipName?: string;
  subscriptionStatus: string;
  subscriptionPlan?: SubscriptionPlan;
  isActive: boolean;
  activeUserCount: number;
  createdAt: string;
  currentPeriodEnd?: string;
}

export interface SubscriptionPlan {
  id: string;
  name: string;
  price: number;
  interval: string;
  maxUsers: number | null;
  features: string[];
}

export interface Payment {
  id: string;
  accountId: string;
  amount: number;
  status: string;
  description?: string;
  paidAt?: string;
  createdAt: string;
}

export interface SystemStats {
  totalAccounts: number;
  activeAccounts: number;
  totalUsers: number;
  activeUsers: number;
  monthlyRevenue: number;
  totalRevenue: number;
  accountsGrowth: number;
  revenueGrowth: number;
}

export interface RevenueData {
  month: string;
  revenue: number;
  subscriptions: number;
}

export interface AuditLog {
  id: string;
  userId: string;
  action: string;
  entityType: string;
  entityId: string;
  metadata?: any;
  createdAt: string;
  user: {
    email: string;
    firstName?: string;
    lastName?: string;
  };
}

export interface EmailLog {
  id: string;
  recipient: string;
  subject: string;
  status: string;
  messageId?: string;
  errorMessage?: string;
  createdAt: string;
}

export interface EmailStats {
  period: string;
  stats: Array<{
    status: string;
    count: number;
    date: string;
  }>;
  totals: Array<{
    status: string;
    count: number;
  }>;
}
