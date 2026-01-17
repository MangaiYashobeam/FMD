import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Mail,
  Shield,
  FileText,
  Bell,
  Send,
  Clock,
  Calendar,
  Users,
  Building,
  AlertTriangle,
  Play,
  Eye,
  Download,
  RefreshCw,
  Bug,
  Bot,
  Skull,
  Fingerprint,
  FileDown,
} from 'lucide-react';
import { reportsApi } from '../../lib/api';
import { useToast } from '../../contexts/ToastContext';

// ============================================
// Types
// ============================================

interface NotificationConfig {
  enabled: boolean;
  superAdminEmail: string;
  notifyOnAttack: boolean;
  notifyOnMitigation: boolean;
  notifyOnSQLInjection: boolean;
  notifyOnXSS: boolean;
  notifyOnBot: boolean;
  notifyOnHoneypot: boolean;
  cooldownMinutes: number;
}

// ============================================
// Email Settings Page Component
// ============================================

export default function EmailSettingsPage() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [activeTab, setActiveTab] = useState<'notifications' | 'reports' | 'preview'>('notifications');
  const [selectedPeriod, setSelectedPeriod] = useState<'daily' | 'weekly' | 'monthly'>('weekly');
  const [previewType, setPreviewType] = useState<string>('');
  const [previewHtml, setPreviewHtml] = useState<string>('');
  const [loadingPreview, setLoadingPreview] = useState(false);

  // Fetch notification config
  const { data: notificationConfig, isLoading: loadingConfig } = useQuery({
    queryKey: ['notification-config'],
    queryFn: async () => {
      const res = await reportsApi.getNotificationConfig();
      return res.data as NotificationConfig;
    },
  });

  // Update notification config mutation
  const updateConfigMutation = useMutation({
    mutationFn: (config: Partial<NotificationConfig>) => reportsApi.updateNotificationConfig(config),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notification-config'] });
      toast.success('Configuration updated');
    },
    onError: () => {
      toast.error('Failed to update configuration');
    },
  });

  // Send test notification mutation
  const testNotificationMutation = useMutation({
    mutationFn: (type: string) => reportsApi.sendTestNotification(type),
    onSuccess: (_, type) => {
      toast.success(`Test ${type} notification sent!`);
    },
    onError: () => {
      toast.error('Failed to send test notification');
    },
  });

  // Generate report mutation
  const generateReportMutation = useMutation({
    mutationFn: (data: { type: string; period: string; sendEmail: boolean }) => {
      switch (data.type) {
        case 'super-admin':
          return reportsApi.generateSuperAdminReport({ period: data.period, sendEmail: data.sendEmail });
        case 'security':
          return reportsApi.generateSecurityReport({ period: data.period, sendEmail: data.sendEmail });
        case 'admin':
          return reportsApi.generateAdminReport({ period: data.period, sendEmail: data.sendEmail });
        case 'user':
          return reportsApi.generateUserReport({ period: data.period, sendEmail: data.sendEmail });
        default:
          throw new Error('Invalid report type');
      }
    },
    onSuccess: (res, vars) => {
      toast.success(`${vars.type} report generated${vars.sendEmail ? ' and sent!' : ''}`);
      if (!vars.sendEmail && res.data?.html) {
        setPreviewHtml(res.data.html);
        setPreviewType(vars.type);
        setActiveTab('preview');
      }
    },
    onError: () => {
      toast.error('Failed to generate report');
    },
  });

  // Trigger scheduled reports mutation
  const triggerScheduledMutation = useMutation({
    mutationFn: (period: string) => reportsApi.triggerScheduledReports(period),
    onSuccess: (_, period) => {
      toast.success(`Triggered ${period} reports for all accounts`);
    },
    onError: () => {
      toast.error('Failed to trigger scheduled reports');
    },
  });

  // Download PDF
  const downloadPDF = async (type: string) => {
    try {
      toast.info('Generating PDF...');
      const response = await reportsApi.downloadReportPDF(type, selectedPeriod);
      
      // Create blob from response
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      
      // Create temporary link and trigger download
      const link = document.createElement('a');
      link.href = url;
      link.download = `${type}-report-${new Date().toISOString().split('T')[0]}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      toast.success('PDF downloaded successfully!');
    } catch {
      toast.error('Failed to download PDF');
    }
  };

  // Load preview
  const loadPreview = async (type: string) => {
    setLoadingPreview(true);
    try {
      const res = await reportsApi.previewReport(type, selectedPeriod);
      setPreviewHtml(res.data);
      setPreviewType(type);
      setActiveTab('preview');
    } catch {
      toast.error('Failed to load preview');
    } finally {
      setLoadingPreview(false);
    }
  };

  const tabs = [
    { id: 'notifications' as const, label: 'Security Notifications', icon: Bell },
    { id: 'reports' as const, label: 'Reports', icon: FileText },
    { id: 'preview' as const, label: 'Preview', icon: Eye },
  ];

  const testNotificationTypes = [
    { id: 'attack', label: 'Attack Detection', icon: AlertTriangle, color: 'red' },
    { id: 'mitigation', label: 'Mitigation Activated', icon: Shield, color: 'yellow' },
    { id: 'sql', label: 'SQL Injection', icon: Bug, color: 'red' },
    { id: 'xss', label: 'XSS Attack', icon: Fingerprint, color: 'red' },
    { id: 'bot', label: 'Bot Detection', icon: Bot, color: 'yellow' },
    { id: 'honeypot', label: 'Honeypot Trigger', icon: Skull, color: 'red' },
  ];

  const reportTypes = [
    { id: 'super-admin', label: 'Platform Report', description: 'All accounts, users, revenue, security', icon: Building, scope: 'Super Admin' },
    { id: 'security', label: 'Security Report', description: 'Attacks, threats, blocked IPs', icon: Shield, scope: 'Super Admin' },
    { id: 'admin', label: 'Account Report', description: 'Inventory, team, Facebook stats', icon: Users, scope: 'Admin' },
    { id: 'user', label: 'Activity Report', description: 'Personal posts and performance', icon: FileText, scope: 'User' },
  ];

  if (loadingConfig) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-8 h-8 text-blue-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Email & Reports Settings</h1>
          <p className="text-gray-500 mt-1">Configure security notifications and automated reports</p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={selectedPeriod}
            onChange={(e) => setSelectedPeriod(e.target.value as any)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
          </select>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex gap-6">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 pb-3 border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Notifications Tab */}
      {activeTab === 'notifications' && notificationConfig && (
        <div className="space-y-6">
          {/* Global Toggle */}
          <div className="bg-white p-6 rounded-xl border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-gray-900">Security Notifications</h3>
                <p className="text-sm text-gray-500">Receive email alerts for security events</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={notificationConfig.enabled}
                  onChange={(e) => updateConfigMutation.mutate({ enabled: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>

            {/* Admin Email */}
            <div className="mt-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Super Admin Email
              </label>
              <div className="flex gap-2">
                <input
                  type="email"
                  value={notificationConfig.superAdminEmail}
                  onChange={(e) => updateConfigMutation.mutate({ superAdminEmail: e.target.value })}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="admin@example.com"
                />
              </div>
              <p className="text-xs text-gray-500 mt-1">All security notifications will be sent to this email</p>
            </div>

            {/* Cooldown */}
            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Notification Cooldown (minutes)
              </label>
              <input
                type="number"
                value={notificationConfig.cooldownMinutes}
                onChange={(e) => updateConfigMutation.mutate({ cooldownMinutes: parseInt(e.target.value) })}
                className="w-32 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                min="1"
                max="60"
              />
              <p className="text-xs text-gray-500 mt-1">Minimum time between same notification types</p>
            </div>
          </div>

          {/* Notification Types */}
          <div className="bg-white p-6 rounded-xl border border-gray-200">
            <h3 className="font-semibold text-gray-900 mb-4">Notification Types</h3>
            <div className="space-y-4">
              {[
                { key: 'notifyOnAttack', label: 'Attack Detection', description: 'When traffic exceeds thresholds' },
                { key: 'notifyOnMitigation', label: 'Mitigation Activated', description: 'When smart mitigation kicks in' },
                { key: 'notifyOnSQLInjection', label: 'SQL Injection Attempts', description: 'Blocked SQL injection attacks' },
                { key: 'notifyOnXSS', label: 'XSS Attempts', description: 'Blocked cross-site scripting attacks' },
                { key: 'notifyOnBot', label: 'Bot Detection', description: 'Automated traffic detected' },
                { key: 'notifyOnHoneypot', label: 'Honeypot Triggers', description: 'Attackers hitting trap endpoints' },
              ].map((item) => (
                <div key={item.key} className="flex items-center justify-between py-3 border-b border-gray-100 last:border-0">
                  <div>
                    <p className="font-medium text-gray-900">{item.label}</p>
                    <p className="text-sm text-gray-500">{item.description}</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={(notificationConfig as any)[item.key]}
                      onChange={(e) => updateConfigMutation.mutate({ [item.key]: e.target.checked })}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                  </label>
                </div>
              ))}
            </div>
          </div>

          {/* Test Notifications */}
          <div className="bg-white p-6 rounded-xl border border-gray-200">
            <h3 className="font-semibold text-gray-900 mb-4">Test Notifications</h3>
            <p className="text-sm text-gray-500 mb-4">Send a test notification to verify email delivery</p>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {testNotificationTypes.map((type) => (
                <button
                  key={type.id}
                  onClick={() => testNotificationMutation.mutate(type.id)}
                  disabled={testNotificationMutation.isPending}
                  className={`flex items-center gap-2 px-4 py-3 rounded-lg border transition-all hover:shadow-md ${
                    type.color === 'red' 
                      ? 'border-red-200 bg-red-50 text-red-700 hover:bg-red-100' 
                      : 'border-yellow-200 bg-yellow-50 text-yellow-700 hover:bg-yellow-100'
                  }`}
                >
                  <type.icon className="w-4 h-4" />
                  <span className="text-sm font-medium">{type.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Reports Tab */}
      {activeTab === 'reports' && (
        <div className="space-y-6">
          {/* Generate Reports */}
          <div className="bg-white p-6 rounded-xl border border-gray-200">
            <h3 className="font-semibold text-gray-900 mb-4">Generate Reports</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {reportTypes.map((report) => (
                <div key={report.id} className="p-4 border border-gray-200 rounded-lg hover:border-blue-300 transition-colors">
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-blue-100 rounded-lg">
                      <report.icon className="w-5 h-5 text-blue-600" />
                    </div>
                    <div className="flex-1">
                      <h4 className="font-medium text-gray-900">{report.label}</h4>
                      <p className="text-sm text-gray-500">{report.description}</p>
                      <span className="inline-block mt-1 px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded">
                        {report.scope}
                      </span>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 mt-4">
                    <button
                      onClick={() => loadPreview(report.id)}
                      disabled={loadingPreview}
                      className="flex items-center justify-center gap-2 px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm"
                    >
                      <Eye className="w-4 h-4" />
                      Preview
                    </button>
                    <button
                      onClick={() => downloadPDF(report.id)}
                      className="flex items-center justify-center gap-2 px-3 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors text-sm"
                    >
                      <FileDown className="w-4 h-4" />
                      PDF
                    </button>
                    <button
                      onClick={() => generateReportMutation.mutate({ type: report.id, period: selectedPeriod, sendEmail: false })}
                      disabled={generateReportMutation.isPending}
                      className="flex items-center justify-center gap-2 px-3 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors text-sm"
                    >
                      <Download className="w-4 h-4" />
                      HTML
                    </button>
                    <button
                      onClick={() => generateReportMutation.mutate({ type: report.id, period: selectedPeriod, sendEmail: true })}
                      disabled={generateReportMutation.isPending}
                      className="flex items-center justify-center gap-2 px-3 py-2 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition-colors text-sm"
                    >
                      <Send className="w-4 h-4" />
                      Email
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Scheduled Reports */}
          <div className="bg-white p-6 rounded-xl border border-gray-200">
            <h3 className="font-semibold text-gray-900 mb-4">Scheduled Reports</h3>
            <p className="text-sm text-gray-500 mb-4">Automatically sends reports to all account admins</p>
            
            <div className="grid grid-cols-3 gap-4">
              {['daily', 'weekly', 'monthly'].map((period) => (
                <div key={period} className="p-4 border border-gray-200 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    {period === 'daily' && <Clock className="w-5 h-5 text-gray-500" />}
                    {period === 'weekly' && <Calendar className="w-5 h-5 text-gray-500" />}
                    {period === 'monthly' && <Calendar className="w-5 h-5 text-gray-500" />}
                    <span className="font-medium text-gray-900 capitalize">{period}</span>
                  </div>
                  <p className="text-xs text-gray-500 mb-3">
                    {period === 'daily' && 'Runs at 6:00 AM'}
                    {period === 'weekly' && 'Runs Monday at 7:00 AM'}
                    {period === 'monthly' && 'Runs 1st of month at 8:00 AM'}
                  </p>
                  <button
                    onClick={() => triggerScheduledMutation.mutate(period)}
                    disabled={triggerScheduledMutation.isPending}
                    className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200 transition-colors text-sm"
                  >
                    <Play className="w-4 h-4" />
                    Run Now
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Preview Tab */}
      {activeTab === 'preview' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-gray-900">
              {previewType ? `${previewType.charAt(0).toUpperCase() + previewType.slice(1)} Report Preview` : 'Select a report to preview'}
            </h3>
            {previewHtml && (
              <a
                href={`data:text/html;charset=utf-8,${encodeURIComponent(previewHtml)}`}
                download={`${previewType}-report.html`}
                className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
              >
                <Download className="w-4 h-4" />
                Download HTML
              </a>
            )}
          </div>
          
          {previewHtml ? (
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              <iframe
                srcDoc={previewHtml}
                className="w-full h-[800px] border-0"
                title="Email Preview"
              />
            </div>
          ) : (
            <div className="bg-white p-12 rounded-xl border border-gray-200 text-center">
              <Mail className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">Select a report from the Reports tab to preview</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
