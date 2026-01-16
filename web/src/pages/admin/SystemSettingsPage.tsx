import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminApi } from '../../lib/api';
import {
  Settings,
  Mail,
  Server,
  CreditCard,
  Shield,
  Database,
  Bell,
  Globe,
  Save,
  Loader2,
  CheckCircle,
  AlertCircle,
  Eye,
  EyeOff,
  Plus,
  Trash2,
  Edit2,
  FileText,
  DollarSign,
  Users,
  Zap,
} from 'lucide-react';
import { cn } from '../../lib/utils';

type SettingsTab = 'general' | 'email' | 'plans' | 'templates' | 'security' | 'integrations';

interface SystemConfig {
  siteName: string;
  siteUrl: string;
  supportEmail: string;
  maintenanceMode: boolean;
  allowRegistration: boolean;
  requireEmailVerification: boolean;
  maxAccountsPerUser: number;
  defaultTrialDays: number;
}

interface EmailConfig {
  provider: 'smtp' | 'sendgrid' | 'ses' | 'mailgun';
  smtpHost: string;
  smtpPort: number;
  smtpUser: string;
  smtpPassword: string;
  smtpSecure: boolean;
  fromEmail: string;
  fromName: string;
  apiKey?: string;
  region?: string;
}

interface SubscriptionPlan {
  id: string;
  name: string;
  slug: string;
  description: string;
  price: number;
  interval: 'month' | 'year';
  features: string[];
  vehicleLimit: number;
  userLimit: number;
  postLimit: number;
  isActive: boolean;
  isPopular: boolean;
  sortOrder: number;
}

interface EmailTemplate {
  id: string;
  name: string;
  slug: string;
  subject: string;
  htmlContent: string;
  textContent?: string;
  variables: string[];
  isActive: boolean;
}

export default function SystemSettingsPage() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<SettingsTab>('general');
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  // General settings form
  const [generalForm, setGeneralForm] = useState<SystemConfig>({
    siteName: 'Dealers Face',
    siteUrl: 'https://dealersface.com',
    supportEmail: 'support@dealersface.com',
    maintenanceMode: false,
    allowRegistration: true,
    requireEmailVerification: true,
    maxAccountsPerUser: 3,
    defaultTrialDays: 14,
  });

  // Email settings form
  const [emailForm, setEmailForm] = useState<EmailConfig>({
    provider: 'smtp',
    smtpHost: '',
    smtpPort: 587,
    smtpUser: '',
    smtpPassword: '',
    smtpSecure: false,
    fromEmail: 'noreply@dealersface.com',
    fromName: 'Dealers Face',
  });

  // Plan editing
  const [editingPlan, setEditingPlan] = useState<SubscriptionPlan | null>(null);
  const [showPlanModal, setShowPlanModal] = useState(false);
  const [planForm, setPlanForm] = useState<Partial<SubscriptionPlan>>({
    name: '',
    slug: '',
    description: '',
    price: 0,
    interval: 'month',
    features: [],
    vehicleLimit: 100,
    userLimit: 5,
    postLimit: 500,
    isActive: true,
    isPopular: false,
  });
  const [newFeature, setNewFeature] = useState('');

  // Template editing - for future implementation
  const [_editingTemplate, setEditingTemplate] = useState<EmailTemplate | null>(null);
  const [_showTemplateModal, setShowTemplateModal] = useState(false);

  // Fetch system settings
  const { data: _settingsData } = useQuery({
    queryKey: ['system-settings'],
    queryFn: async () => {
      try {
        const response = await adminApi.getSystemSettings();
        return response.data;
      } catch {
        // Return defaults if endpoint doesn't exist yet
        return { data: { general: generalForm, email: emailForm } };
      }
    },
  });

  // Fetch subscription plans
  const { data: plansData } = useQuery({
    queryKey: ['subscription-plans'],
    queryFn: async () => {
      try {
        const response = await adminApi.getSubscriptionPlans();
        return response.data;
      } catch {
        return { data: { plans: mockPlans } };
      }
    },
    enabled: activeTab === 'plans',
  });

  // Fetch email templates
  const { data: templatesData } = useQuery({
    queryKey: ['email-templates'],
    queryFn: async () => {
      try {
        const response = await adminApi.getEmailTemplates();
        return response.data;
      } catch {
        return { data: { templates: mockTemplates } };
      }
    },
    enabled: activeTab === 'templates',
  });

  // Mock data for development
  const mockPlans: SubscriptionPlan[] = [
    {
      id: '1',
      name: 'Starter',
      slug: 'starter',
      description: 'Perfect for small dealerships',
      price: 49,
      interval: 'month',
      features: ['Up to 50 vehicles', '1 user', '100 posts/month', 'Basic analytics', 'Email support'],
      vehicleLimit: 50,
      userLimit: 1,
      postLimit: 100,
      isActive: true,
      isPopular: false,
      sortOrder: 1,
    },
    {
      id: '2',
      name: 'Professional',
      slug: 'professional',
      description: 'For growing dealerships',
      price: 99,
      interval: 'month',
      features: ['Up to 200 vehicles', '5 users', '500 posts/month', 'Advanced analytics', 'Priority support', 'API access'],
      vehicleLimit: 200,
      userLimit: 5,
      postLimit: 500,
      isActive: true,
      isPopular: true,
      sortOrder: 2,
    },
    {
      id: '3',
      name: 'Enterprise',
      slug: 'enterprise',
      description: 'For large dealership groups',
      price: 249,
      interval: 'month',
      features: ['Unlimited vehicles', 'Unlimited users', 'Unlimited posts', 'White-label options', 'Dedicated support', 'Custom integrations'],
      vehicleLimit: -1,
      userLimit: -1,
      postLimit: -1,
      isActive: true,
      isPopular: false,
      sortOrder: 3,
    },
  ];

  const mockTemplates: EmailTemplate[] = [
    {
      id: '1',
      name: 'Welcome Email',
      slug: 'welcome',
      subject: 'Welcome to {{siteName}}!',
      htmlContent: '<h1>Welcome {{firstName}}!</h1><p>Thank you for joining {{siteName}}.</p>',
      variables: ['firstName', 'siteName', 'loginUrl'],
      isActive: true,
    },
    {
      id: '2',
      name: 'Password Reset',
      slug: 'password-reset',
      subject: 'Reset Your Password - {{siteName}}',
      htmlContent: '<h1>Password Reset</h1><p>Click <a href="{{resetUrl}}">here</a> to reset your password.</p>',
      variables: ['firstName', 'resetUrl', 'siteName'],
      isActive: true,
    },
    {
      id: '3',
      name: 'Sync Complete',
      slug: 'sync-complete',
      subject: 'Inventory Sync Complete',
      htmlContent: '<h1>Sync Complete</h1><p>Your inventory sync has completed. {{vehicleCount}} vehicles processed.</p>',
      variables: ['firstName', 'vehicleCount', 'addedCount', 'updatedCount'],
      isActive: true,
    },
    {
      id: '4',
      name: 'New Lead Notification',
      slug: 'new-lead',
      subject: 'New Lead: {{vehicleName}}',
      htmlContent: '<h1>New Lead!</h1><p>You have a new lead for {{vehicleName}} from {{leadName}}.</p>',
      variables: ['vehicleName', 'leadName', 'leadEmail', 'leadPhone', 'message'],
      isActive: true,
    },
  ];

  const plans: SubscriptionPlan[] = plansData?.data?.plans || mockPlans;
  const templates: EmailTemplate[] = templatesData?.data?.templates || mockTemplates;

  // Save settings mutation
  const saveSettingsMutation = useMutation({
    mutationFn: async (data: { type: string; settings: any }) => {
      return adminApi.updateSystemSettings(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['system-settings'] });
      setSaveSuccess(true);
      setSaveError(null);
      setTimeout(() => setSaveSuccess(false), 3000);
    },
    onError: (error: any) => {
      setSaveError(error?.response?.data?.message || 'Failed to save settings');
    },
  });

  // Save plan mutation
  const savePlanMutation = useMutation({
    mutationFn: async (plan: Partial<SubscriptionPlan>) => {
      if (editingPlan?.id) {
        return adminApi.updateSubscriptionPlan(editingPlan.id, plan);
      }
      return adminApi.createSubscriptionPlan(plan);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subscription-plans'] });
      setShowPlanModal(false);
      setEditingPlan(null);
      resetPlanForm();
    },
  });

  // Delete plan mutation
  const deletePlanMutation = useMutation({
    mutationFn: async (planId: string) => {
      return adminApi.deleteSubscriptionPlan(planId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subscription-plans'] });
    },
  });

  // Test email mutation
  const testEmailMutation = useMutation({
    mutationFn: async () => {
      return adminApi.testEmailConfiguration(emailForm);
    },
    onSuccess: () => {
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    },
    onError: (error: any) => {
      setSaveError(error?.response?.data?.message || 'Email test failed');
    },
  });

  const resetPlanForm = () => {
    setPlanForm({
      name: '',
      slug: '',
      description: '',
      price: 0,
      interval: 'month',
      features: [],
      vehicleLimit: 100,
      userLimit: 5,
      postLimit: 500,
      isActive: true,
      isPopular: false,
    });
  };

  const handleEditPlan = (plan: SubscriptionPlan) => {
    setEditingPlan(plan);
    setPlanForm(plan);
    setShowPlanModal(true);
  };

  const handleAddFeature = () => {
    if (newFeature.trim()) {
      setPlanForm({
        ...planForm,
        features: [...(planForm.features || []), newFeature.trim()],
      });
      setNewFeature('');
    }
  };

  const handleRemoveFeature = (index: number) => {
    setPlanForm({
      ...planForm,
      features: planForm.features?.filter((_, i) => i !== index),
    });
  };

  const handleSaveGeneral = () => {
    saveSettingsMutation.mutate({ type: 'general', settings: generalForm });
  };

  const handleSaveEmail = () => {
    saveSettingsMutation.mutate({ type: 'email', settings: emailForm });
  };

  const tabs = [
    { id: 'general', label: 'General', icon: Settings },
    { id: 'email', label: 'Email Server', icon: Mail },
    { id: 'plans', label: 'Subscription Plans', icon: CreditCard },
    { id: 'templates', label: 'Email Templates', icon: FileText },
    { id: 'security', label: 'Security', icon: Shield },
    { id: 'integrations', label: 'Integrations', icon: Globe },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">System Settings</h1>
          <p className="text-gray-500">Configure global system settings and preferences</p>
        </div>
        {(activeTab === 'general' || activeTab === 'email' || activeTab === 'security') && (
          <button
            onClick={activeTab === 'general' ? handleSaveGeneral : handleSaveEmail}
            disabled={saveSettingsMutation.isPending}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50"
          >
            {saveSettingsMutation.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : saveSuccess ? (
              <CheckCircle className="w-4 h-4" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            {saveSuccess ? 'Saved!' : 'Save Changes'}
          </button>
        )}
      </div>

      {/* Error/Success Messages */}
      {saveError && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-500" />
          <span className="text-red-700">{saveError}</span>
        </div>
      )}

      <div className="flex gap-6">
        {/* Sidebar */}
        <div className="w-64 flex-shrink-0">
          <nav className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as SettingsTab)}
                className={cn(
                  'w-full flex items-center gap-3 px-4 py-3 text-left transition-colors',
                  activeTab === tab.id
                    ? 'bg-blue-50 text-blue-700 border-r-2 border-blue-600'
                    : 'text-gray-600 hover:bg-gray-50'
                )}
              >
                <tab.icon className="w-5 h-5" />
                <span className="font-medium">{tab.label}</span>
              </button>
            ))}
          </nav>
        </div>

        {/* Content */}
        <div className="flex-1 bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          {/* General Settings */}
          {activeTab === 'general' && (
            <div className="space-y-6">
              <h2 className="text-lg font-semibold text-gray-900">General Settings</h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Site Name</label>
                  <input
                    type="text"
                    value={generalForm.siteName}
                    onChange={(e) => setGeneralForm({ ...generalForm, siteName: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Site URL</label>
                  <input
                    type="url"
                    value={generalForm.siteUrl}
                    onChange={(e) => setGeneralForm({ ...generalForm, siteUrl: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Support Email</label>
                  <input
                    type="email"
                    value={generalForm.supportEmail}
                    onChange={(e) => setGeneralForm({ ...generalForm, supportEmail: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Default Trial Days</label>
                  <input
                    type="number"
                    value={generalForm.defaultTrialDays}
                    onChange={(e) => setGeneralForm({ ...generalForm, defaultTrialDays: parseInt(e.target.value) || 14 })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Max Accounts Per User</label>
                  <input
                    type="number"
                    value={generalForm.maxAccountsPerUser}
                    onChange={(e) => setGeneralForm({ ...generalForm, maxAccountsPerUser: parseInt(e.target.value) || 3 })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="border-t pt-6 space-y-4">
                <h3 className="font-medium text-gray-900">System Toggles</h3>
                <div className="space-y-3">
                  <label className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={generalForm.allowRegistration}
                      onChange={(e) => setGeneralForm({ ...generalForm, allowRegistration: e.target.checked })}
                      className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <span className="text-gray-700">Allow new user registration</span>
                  </label>
                  <label className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={generalForm.requireEmailVerification}
                      onChange={(e) => setGeneralForm({ ...generalForm, requireEmailVerification: e.target.checked })}
                      className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <span className="text-gray-700">Require email verification</span>
                  </label>
                  <label className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={generalForm.maintenanceMode}
                      onChange={(e) => setGeneralForm({ ...generalForm, maintenanceMode: e.target.checked })}
                      className="w-4 h-4 text-red-600 border-gray-300 rounded focus:ring-red-500"
                    />
                    <span className="text-gray-700">Maintenance Mode <span className="text-red-500">(Site will be inaccessible)</span></span>
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* Email Settings */}
          {activeTab === 'email' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-gray-900">Email Server Configuration</h2>
                <button
                  onClick={() => testEmailMutation.mutate()}
                  disabled={testEmailMutation.isPending}
                  className="inline-flex items-center gap-2 px-3 py-1.5 text-sm border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition-colors"
                >
                  {testEmailMutation.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Mail className="w-4 h-4" />
                  )}
                  Test Connection
                </button>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Email Provider</label>
                <div className="grid grid-cols-4 gap-3">
                  {(['smtp', 'sendgrid', 'ses', 'mailgun'] as const).map((provider) => (
                    <button
                      key={provider}
                      onClick={() => setEmailForm({ ...emailForm, provider })}
                      className={cn(
                        'px-4 py-3 border rounded-lg text-center font-medium transition-colors',
                        emailForm.provider === provider
                          ? 'border-blue-500 bg-blue-50 text-blue-700'
                          : 'border-gray-200 hover:border-gray-300'
                      )}
                    >
                      {provider.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>

              {emailForm.provider === 'smtp' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">SMTP Host</label>
                    <input
                      type="text"
                      value={emailForm.smtpHost}
                      onChange={(e) => setEmailForm({ ...emailForm, smtpHost: e.target.value })}
                      placeholder="smtp.gmail.com"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">SMTP Port</label>
                    <input
                      type="number"
                      value={emailForm.smtpPort}
                      onChange={(e) => setEmailForm({ ...emailForm, smtpPort: parseInt(e.target.value) || 587 })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">SMTP Username</label>
                    <input
                      type="text"
                      value={emailForm.smtpUser}
                      onChange={(e) => setEmailForm({ ...emailForm, smtpUser: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">SMTP Password</label>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={emailForm.smtpPassword}
                        onChange={(e) => setEmailForm({ ...emailForm, smtpPassword: e.target.value })}
                        className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                  <div className="col-span-2">
                    <label className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={emailForm.smtpSecure}
                        onChange={(e) => setEmailForm({ ...emailForm, smtpSecure: e.target.checked })}
                        className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                      />
                      <span className="text-gray-700">Use SSL/TLS (port 465)</span>
                    </label>
                  </div>
                </div>
              )}

              {(emailForm.provider === 'sendgrid' || emailForm.provider === 'mailgun') && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">API Key</label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={emailForm.apiKey || ''}
                      onChange={(e) => setEmailForm({ ...emailForm, apiKey: e.target.value })}
                      placeholder={`Enter your ${emailForm.provider} API key`}
                      className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              )}

              {emailForm.provider === 'ses' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">AWS Region</label>
                    <select
                      value={emailForm.region || 'us-east-1'}
                      onChange={(e) => setEmailForm({ ...emailForm, region: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="us-east-1">US East (N. Virginia)</option>
                      <option value="us-west-2">US West (Oregon)</option>
                      <option value="eu-west-1">EU (Ireland)</option>
                      <option value="ap-southeast-1">Asia Pacific (Singapore)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">API Key</label>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={emailForm.apiKey || ''}
                      onChange={(e) => setEmailForm({ ...emailForm, apiKey: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                </div>
              )}

              <div className="border-t pt-6">
                <h3 className="font-medium text-gray-900 mb-4">Sender Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">From Email</label>
                    <input
                      type="email"
                      value={emailForm.fromEmail}
                      onChange={(e) => setEmailForm({ ...emailForm, fromEmail: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">From Name</label>
                    <input
                      type="text"
                      value={emailForm.fromName}
                      onChange={(e) => setEmailForm({ ...emailForm, fromName: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Subscription Plans */}
          {activeTab === 'plans' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-gray-900">Subscription Plans</h2>
                <button
                  onClick={() => {
                    setEditingPlan(null);
                    resetPlanForm();
                    setShowPlanModal(true);
                  }}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  Add Plan
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {plans.map((plan) => (
                  <div
                    key={plan.id}
                    className={cn(
                      'relative border rounded-xl p-6',
                      plan.isPopular ? 'border-blue-500 ring-2 ring-blue-100' : 'border-gray-200'
                    )}
                  >
                    {plan.isPopular && (
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-blue-600 text-white text-xs font-semibold px-3 py-1 rounded-full">
                        MOST POPULAR
                      </div>
                    )}
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-semibold text-gray-900">{plan.name}</h3>
                      <div className="flex gap-1">
                        <button
                          onClick={() => handleEditPlan(plan)}
                          className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => deletePlanMutation.mutate(plan.id)}
                          className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                    <p className="text-gray-500 text-sm mb-4">{plan.description}</p>
                    <div className="mb-4">
                      <span className="text-3xl font-bold text-gray-900">${plan.price}</span>
                      <span className="text-gray-500">/{plan.interval}</span>
                    </div>
                    <div className="space-y-3 mb-4">
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <Database className="w-4 h-4" />
                        <span>{plan.vehicleLimit === -1 ? 'Unlimited' : plan.vehicleLimit} vehicles</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <Users className="w-4 h-4" />
                        <span>{plan.userLimit === -1 ? 'Unlimited' : plan.userLimit} users</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <Zap className="w-4 h-4" />
                        <span>{plan.postLimit === -1 ? 'Unlimited' : plan.postLimit} posts/month</span>
                      </div>
                    </div>
                    <ul className="space-y-2">
                      {plan.features.map((feature, i) => (
                        <li key={i} className="flex items-center gap-2 text-sm text-gray-600">
                          <CheckCircle className="w-4 h-4 text-green-500" />
                          <span>{feature}</span>
                        </li>
                      ))}
                    </ul>
                    <div className="mt-4 pt-4 border-t">
                      <span
                        className={cn(
                          'inline-flex items-center px-2 py-1 text-xs font-medium rounded-full',
                          plan.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                        )}
                      >
                        {plan.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Email Templates */}
          {activeTab === 'templates' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-gray-900">Email Templates</h2>
                <button
                  onClick={() => {
                    setEditingTemplate(null);
                    setShowTemplateModal(true);
                  }}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  Add Template
                </button>
              </div>

              <div className="space-y-4">
                {templates.map((template) => (
                  <div
                    key={template.id}
                    className="border border-gray-200 rounded-lg p-4 hover:border-gray-300 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                          <Mail className="w-5 h-5 text-blue-600" />
                        </div>
                        <div>
                          <h3 className="font-medium text-gray-900">{template.name}</h3>
                          <p className="text-sm text-gray-500">{template.subject}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span
                          className={cn(
                            'px-2 py-1 text-xs font-medium rounded-full',
                            template.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                          )}
                        >
                          {template.isActive ? 'Active' : 'Inactive'}
                        </span>
                        <button
                          onClick={() => {
                            setEditingTemplate(template);
                            setShowTemplateModal(true);
                          }}
                          className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {template.variables.map((variable) => (
                        <span
                          key={variable}
                          className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded font-mono"
                        >
                          {`{{${variable}}}`}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Security Settings */}
          {activeTab === 'security' && (
            <div className="space-y-6">
              <h2 className="text-lg font-semibold text-gray-900">Security Settings</h2>
              
              <div className="space-y-4">
                <div className="p-4 border border-gray-200 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-medium text-gray-900">Two-Factor Authentication</h3>
                      <p className="text-sm text-gray-500">Require 2FA for all admin accounts</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input type="checkbox" className="sr-only peer" />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                    </label>
                  </div>
                </div>

                <div className="p-4 border border-gray-200 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-medium text-gray-900">Session Timeout</h3>
                      <p className="text-sm text-gray-500">Auto-logout after inactivity</p>
                    </div>
                    <select className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500">
                      <option value="15">15 minutes</option>
                      <option value="30">30 minutes</option>
                      <option value="60">1 hour</option>
                      <option value="120">2 hours</option>
                    </select>
                  </div>
                </div>

                <div className="p-4 border border-gray-200 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-medium text-gray-900">Password Policy</h3>
                      <p className="text-sm text-gray-500">Minimum password requirements</p>
                    </div>
                    <select className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500">
                      <option value="basic">Basic (8+ chars)</option>
                      <option value="medium">Medium (8+ chars, mixed case)</option>
                      <option value="strong">Strong (12+ chars, mixed case, numbers, symbols)</option>
                    </select>
                  </div>
                </div>

                <div className="p-4 border border-gray-200 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-medium text-gray-900">IP Whitelist</h3>
                      <p className="text-sm text-gray-500">Restrict admin access to specific IPs</p>
                    </div>
                    <button className="px-4 py-2 text-sm border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50">
                      Configure
                    </button>
                  </div>
                </div>

                <div className="p-4 border border-gray-200 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-medium text-gray-900">Rate Limiting</h3>
                      <p className="text-sm text-gray-500">API request limits per user</p>
                    </div>
                    <select className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500">
                      <option value="100">100 req/min</option>
                      <option value="500">500 req/min</option>
                      <option value="1000">1000 req/min</option>
                      <option value="unlimited">Unlimited</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Integrations */}
          {activeTab === 'integrations' && (
            <div className="space-y-6">
              <h2 className="text-lg font-semibold text-gray-900">Third-Party Integrations</h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 border border-gray-200 rounded-lg">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
                      <span className="text-white font-bold text-sm">FB</span>
                    </div>
                    <div>
                      <h3 className="font-medium text-gray-900">Facebook</h3>
                      <p className="text-sm text-gray-500">Marketplace posting</p>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <input
                      type="text"
                      placeholder="App ID"
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg"
                    />
                    <input
                      type="password"
                      placeholder="App Secret"
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg"
                    />
                  </div>
                </div>

                <div className="p-4 border border-gray-200 rounded-lg">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 bg-purple-600 rounded-lg flex items-center justify-center">
                      <DollarSign className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <h3 className="font-medium text-gray-900">Stripe</h3>
                      <p className="text-sm text-gray-500">Payment processing</p>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <input
                      type="text"
                      placeholder="Publishable Key"
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg"
                    />
                    <input
                      type="password"
                      placeholder="Secret Key"
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg"
                    />
                  </div>
                </div>

                <div className="p-4 border border-gray-200 rounded-lg">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 bg-green-600 rounded-lg flex items-center justify-center">
                      <Server className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <h3 className="font-medium text-gray-900">AWS S3</h3>
                      <p className="text-sm text-gray-500">Image storage</p>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <input
                      type="text"
                      placeholder="Access Key ID"
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg"
                    />
                    <input
                      type="password"
                      placeholder="Secret Access Key"
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg"
                    />
                    <input
                      type="text"
                      placeholder="Bucket Name"
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg"
                    />
                  </div>
                </div>

                <div className="p-4 border border-gray-200 rounded-lg">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 bg-orange-600 rounded-lg flex items-center justify-center">
                      <Bell className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <h3 className="font-medium text-gray-900">Firebase</h3>
                      <p className="text-sm text-gray-500">Push notifications</p>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <input
                      type="text"
                      placeholder="Project ID"
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg"
                    />
                    <textarea
                      placeholder="Service Account JSON"
                      rows={3}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Plan Modal */}
      {showPlanModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto m-4">
            <div className="p-6 border-b">
              <h2 className="text-xl font-semibold text-gray-900">
                {editingPlan ? 'Edit Plan' : 'Create New Plan'}
              </h2>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Plan Name</label>
                  <input
                    type="text"
                    value={planForm.name || ''}
                    onChange={(e) => setPlanForm({ ...planForm, name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Slug</label>
                  <input
                    type="text"
                    value={planForm.slug || ''}
                    onChange={(e) => setPlanForm({ ...planForm, slug: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  value={planForm.description || ''}
                  onChange={(e) => setPlanForm({ ...planForm, description: e.target.value })}
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Price ($)</label>
                  <input
                    type="number"
                    value={planForm.price || 0}
                    onChange={(e) => setPlanForm({ ...planForm, price: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Billing Interval</label>
                  <select
                    value={planForm.interval || 'month'}
                    onChange={(e) => setPlanForm({ ...planForm, interval: e.target.value as 'month' | 'year' })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  >
                    <option value="month">Monthly</option>
                    <option value="year">Yearly</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Vehicle Limit</label>
                  <input
                    type="number"
                    value={planForm.vehicleLimit || 0}
                    onChange={(e) => setPlanForm({ ...planForm, vehicleLimit: parseInt(e.target.value) || 0 })}
                    placeholder="-1 for unlimited"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">User Limit</label>
                  <input
                    type="number"
                    value={planForm.userLimit || 0}
                    onChange={(e) => setPlanForm({ ...planForm, userLimit: parseInt(e.target.value) || 0 })}
                    placeholder="-1 for unlimited"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Post Limit</label>
                  <input
                    type="number"
                    value={planForm.postLimit || 0}
                    onChange={(e) => setPlanForm({ ...planForm, postLimit: parseInt(e.target.value) || 0 })}
                    placeholder="-1 for unlimited"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Features</label>
                <div className="flex gap-2 mb-2">
                  <input
                    type="text"
                    value={newFeature}
                    onChange={(e) => setNewFeature(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleAddFeature()}
                    placeholder="Add a feature"
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg"
                  />
                  <button
                    onClick={handleAddFeature}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    Add
                  </button>
                </div>
                <div className="space-y-2">
                  {planForm.features?.map((feature, i) => (
                    <div key={i} className="flex items-center justify-between bg-gray-50 px-3 py-2 rounded-lg">
                      <span className="text-gray-700">{feature}</span>
                      <button
                        onClick={() => handleRemoveFeature(i)}
                        className="text-red-500 hover:text-red-700"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex gap-4">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={planForm.isActive || false}
                    onChange={(e) => setPlanForm({ ...planForm, isActive: e.target.checked })}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded"
                  />
                  <span className="text-gray-700">Active</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={planForm.isPopular || false}
                    onChange={(e) => setPlanForm({ ...planForm, isPopular: e.target.checked })}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded"
                  />
                  <span className="text-gray-700">Mark as Popular</span>
                </label>
              </div>
            </div>
            <div className="p-6 border-t flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowPlanModal(false);
                  setEditingPlan(null);
                  resetPlanForm();
                }}
                className="px-4 py-2 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={() => savePlanMutation.mutate(planForm)}
                disabled={savePlanMutation.isPending}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg disabled:opacity-50"
              >
                {savePlanMutation.isPending ? 'Saving...' : 'Save Plan'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
