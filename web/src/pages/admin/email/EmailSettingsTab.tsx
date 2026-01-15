import { useState, useEffect } from 'react';
import {
  CheckCircle,
  AlertCircle,
  Loader2,
  Eye,
  EyeOff,
  Save,
  TestTube,
  Server,
  Mail,
  Shield,
} from 'lucide-react';

interface EmailConfig {
  smtpHost: string;
  smtpPort: number;
  smtpUser: string;
  smtpSecure: boolean;
  fromEmail: string;
  fromName: string;
  isConfigured: boolean;
}

interface TestResult {
  success: boolean;
  message: string;
}

export default function EmailSettingsTab() {
  const [config, setConfig] = useState<EmailConfig>({
    smtpHost: '',
    smtpPort: 587,
    smtpUser: '',
    smtpSecure: false,
    fromEmail: '',
    fromName: '',
    isConfigured: false,
  });
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [saveResult, setSaveResult] = useState<TestResult | null>(null);
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const [testEmail, setTestEmail] = useState('');

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/email/config', {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      const data = await response.json();
      
      if (data.success && data.data) {
        setConfig({
          smtpHost: data.data.smtpHost || '',
          smtpPort: data.data.smtpPort || 587,
          smtpUser: data.data.smtpUser || '',
          smtpSecure: data.data.smtpSecure || false,
          fromEmail: data.data.defaultFromEmail || 'fb-api@dealersface.com',
          fromName: data.data.defaultFromName || 'DealersFace',
          isConfigured: data.data.isConfigured || false,
        });
      }
    } catch (error) {
      console.error('Failed to load email config:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setIsSaving(true);
      setSaveResult(null);

      // Sanitize inputs
      const sanitizedConfig = {
        smtpHost: config.smtpHost.trim(),
        smtpPort: Math.max(1, Math.min(65535, config.smtpPort)),
        smtpUser: config.smtpUser.trim(),
        smtpPassword: password || undefined,
        smtpSecure: config.smtpSecure,
        fromEmail: config.fromEmail.trim().toLowerCase(),
        fromName: config.fromName.trim(),
      };

      // Basic validation
      if (!sanitizedConfig.smtpHost) {
        setSaveResult({ success: false, message: 'SMTP Host is required' });
        return;
      }
      if (!sanitizedConfig.fromEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(sanitizedConfig.fromEmail)) {
        setSaveResult({ success: false, message: 'Valid From Email is required' });
        return;
      }

      const response = await fetch('/api/email/config', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify(sanitizedConfig),
      });

      const data = await response.json();

      if (data.success) {
        setSaveResult({ success: true, message: 'Email configuration saved successfully' });
        setPassword(''); // Clear password after save
        loadConfig(); // Reload to get updated status
      } else {
        setSaveResult({ success: false, message: data.error || 'Failed to save configuration' });
      }
    } catch (error) {
      console.error('Failed to save config:', error);
      setSaveResult({ success: false, message: 'Failed to save configuration' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleTestConnection = async () => {
    if (!testEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(testEmail.trim())) {
      setTestResult({ success: false, message: 'Please enter a valid test email address' });
      return;
    }

    try {
      setIsTesting(true);
      setTestResult(null);

      const response = await fetch('/api/email/test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({
          to: testEmail.trim().toLowerCase(),
          subject: 'DealersFace - SMTP Test Email',
          body: `
            <h2>SMTP Configuration Test</h2>
            <p>This is a test email from DealersFace to verify your SMTP configuration is working correctly.</p>
            <p><strong>Sent at:</strong> ${new Date().toLocaleString()}</p>
            <p><strong>From:</strong> ${config.fromEmail}</p>
            <hr>
            <p style="color: #6b7280; font-size: 12px;">
              If you received this email, your SMTP settings are configured correctly.
            </p>
          `,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setTestResult({ success: true, message: `Test email sent successfully to ${testEmail}` });
      } else {
        setTestResult({ success: false, message: data.error || 'Failed to send test email' });
      }
    } catch (error) {
      console.error('Failed to test connection:', error);
      setTestResult({ success: false, message: 'Failed to send test email. Check SMTP configuration.' });
    } finally {
      setIsTesting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Status Banner */}
      <div
        className={`flex items-center gap-3 p-4 rounded-xl ${
          config.isConfigured
            ? 'bg-green-50 border border-green-200'
            : 'bg-yellow-50 border border-yellow-200'
        }`}
      >
        {config.isConfigured ? (
          <>
            <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
            <div>
              <p className="font-medium text-green-800">SMTP Configured</p>
              <p className="text-sm text-green-600">
                Email system is ready. Emails will be sent from: {config.fromEmail}
              </p>
            </div>
          </>
        ) : (
          <>
            <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0" />
            <div>
              <p className="font-medium text-yellow-800">SMTP Not Configured</p>
              <p className="text-sm text-yellow-600">
                Configure SMTP settings below to enable email functionality
              </p>
            </div>
          </>
        )}
      </div>

      {/* Result Messages */}
      {saveResult && (
        <div
          className={`flex items-center gap-3 p-4 rounded-xl ${
            saveResult.success
              ? 'bg-green-50 border border-green-200'
              : 'bg-red-50 border border-red-200'
          }`}
        >
          {saveResult.success ? (
            <CheckCircle className="w-5 h-5 text-green-600" />
          ) : (
            <AlertCircle className="w-5 h-5 text-red-600" />
          )}
          <p className={saveResult.success ? 'text-green-800' : 'text-red-800'}>
            {saveResult.message}
          </p>
        </div>
      )}

      {/* SMTP Configuration Form */}
      <div className="bg-gray-50 rounded-xl p-6 space-y-6">
        <div className="flex items-center gap-2 text-gray-700 font-medium">
          <Server className="w-5 h-5" />
          <span>SMTP Server Configuration</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* SMTP Host */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              SMTP Host *
            </label>
            <input
              type="text"
              value={config.smtpHost}
              onChange={(e) => setConfig({ ...config, smtpHost: e.target.value })}
              placeholder="smtp.gmail.com"
              className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          {/* SMTP Port */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              SMTP Port *
            </label>
            <input
              type="number"
              value={config.smtpPort}
              onChange={(e) => setConfig({ ...config, smtpPort: parseInt(e.target.value) || 587 })}
              min={1}
              max={65535}
              className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            <p className="text-xs text-gray-500 mt-1">Common: 587 (TLS), 465 (SSL), 25 (Unencrypted)</p>
          </div>

          {/* SMTP User */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              SMTP Username
            </label>
            <input
              type="text"
              value={config.smtpUser}
              onChange={(e) => setConfig({ ...config, smtpUser: e.target.value })}
              placeholder="your-email@gmail.com"
              className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          {/* SMTP Password */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              SMTP Password
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={config.isConfigured ? '••••••••' : 'Enter password'}
                className="w-full px-4 py-2 pr-10 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-1">Leave blank to keep existing password</p>
          </div>
        </div>

        {/* SSL/TLS */}
        <div className="flex items-center gap-3">
          <Shield className="w-5 h-5 text-gray-400" />
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={config.smtpSecure}
              onChange={(e) => setConfig({ ...config, smtpSecure: e.target.checked })}
              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            />
            <span className="text-sm text-gray-700">Use SSL/TLS (port 465)</span>
          </label>
        </div>
      </div>

      {/* Sender Configuration */}
      <div className="bg-gray-50 rounded-xl p-6 space-y-6">
        <div className="flex items-center gap-2 text-gray-700 font-medium">
          <Mail className="w-5 h-5" />
          <span>Sender Configuration</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* From Email */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              From Email *
            </label>
            <input
              type="email"
              value={config.fromEmail}
              onChange={(e) => setConfig({ ...config, fromEmail: e.target.value })}
              placeholder="fb-api@dealersface.com"
              className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          {/* From Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              From Name
            </label>
            <input
              type="text"
              value={config.fromName}
              onChange={(e) => setConfig({ ...config, fromName: e.target.value })}
              placeholder="DealersFace"
              className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        </div>
      </div>

      {/* Save Button */}
      <div className="flex justify-end">
        <button
          onClick={handleSave}
          disabled={isSaving}
          className="inline-flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium transition-colors"
        >
          {isSaving ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Save className="w-4 h-4" />
          )}
          Save Configuration
        </button>
      </div>

      {/* Test Connection Section */}
      <div className="border-t border-gray-200 pt-6 space-y-4">
        <div className="flex items-center gap-2 text-gray-700 font-medium">
          <TestTube className="w-5 h-5" />
          <span>Test SMTP Connection</span>
        </div>

        {testResult && (
          <div
            className={`flex items-center gap-3 p-4 rounded-xl ${
              testResult.success
                ? 'bg-green-50 border border-green-200'
                : 'bg-red-50 border border-red-200'
            }`}
          >
            {testResult.success ? (
              <CheckCircle className="w-5 h-5 text-green-600" />
            ) : (
              <AlertCircle className="w-5 h-5 text-red-600" />
            )}
            <p className={testResult.success ? 'text-green-800' : 'text-red-800'}>
              {testResult.message}
            </p>
          </div>
        )}

        <div className="flex items-end gap-4">
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Test Email Address
            </label>
            <input
              type="email"
              value={testEmail}
              onChange={(e) => setTestEmail(e.target.value)}
              placeholder="your-email@example.com"
              className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <button
            onClick={handleTestConnection}
            disabled={isTesting || !config.isConfigured}
            className="inline-flex items-center gap-2 px-6 py-2.5 bg-gray-800 text-white rounded-lg hover:bg-gray-900 disabled:opacity-50 font-medium transition-colors"
          >
            {isTesting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <TestTube className="w-4 h-4" />
            )}
            Send Test Email
          </button>
        </div>
        {!config.isConfigured && (
          <p className="text-sm text-yellow-600">
            Save your SMTP configuration first to send test emails
          </p>
        )}
      </div>
    </div>
  );
}
