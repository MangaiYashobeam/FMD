/**
 * Facebook Settings Page - Session-Based Authentication
 * 
 * Uses browser session cookies captured via Chrome extension instead of
 * storing email/password credentials. This is the new auth system that
 * replaces the deprecated OAuth approach.
 */

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/services/api';
import { useAuth } from '@/contexts/AuthContext';
import { 
  Lock, 
  AlertCircle, 
  CheckCircle, 
  Chrome, 
  Cookie, 
  Shield, 
  ShieldCheck, 
  RefreshCw,
  QrCode,
  Smartphone,
  Download,
  Trash2,
  Clock,
  AlertTriangle,
  Key,
  Info
} from 'lucide-react';

interface SessionData {
  id: string;
  accountId: string;
  facebookUserId: string;
  facebookUserName: string | null;
  status: 'ACTIVE' | 'EXPIRED' | 'INVALID' | 'PENDING_2FA';
  source: 'EXTENSION' | 'MANUAL' | 'RECOVERY';
  lastValidatedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
}

interface SessionStatusResponse {
  success: boolean;
  accountId: string;
  sessions: SessionData[];
  activeSessionCount: number;
  hasTotp: boolean;
  totpActive: boolean;
}

interface TotpSetupResponse {
  success: boolean;
  qrCode: string;
  secret: string;
  backupCodes: string[];
  message: string;
}

export const FacebookSettingsPage: React.FC = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  
  // Get the user's account ID from their context
  const accountId = user?.accountId || '';
  
  const [showTotpSetup, setShowTotpSetup] = useState(false);
  const [totpSetupData, setTotpSetupData] = useState<TotpSetupResponse | null>(null);
  const [verificationCode, setVerificationCode] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Fetch session status
  const { data: sessionStatus, isLoading, refetch } = useQuery<SessionStatusResponse>({
    queryKey: ['fb-session-status', accountId],
    queryFn: async () => {
      const response = await api.get(`/fb-session/status/${accountId}`);
      return response.data;
    },
    enabled: !!accountId,
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  // Validate session mutation
  const validateMutation = useMutation({
    mutationFn: async (sessionId: string) => {
      const response = await api.post('/fb-session/validate', { sessionId });
      return response.data;
    },
    onSuccess: (data) => {
      if (data.valid) {
        setSuccessMessage('Session is valid and active!');
      } else {
        setErrorMessage(data.reason || 'Session may be expired or revoked.');
      }
      setTimeout(() => { setSuccessMessage(null); setErrorMessage(null); }, 5000);
      queryClient.invalidateQueries({ queryKey: ['fb-session-status', accountId] });
    },
    onError: () => {
      setErrorMessage('Failed to validate session');
      setTimeout(() => setErrorMessage(null), 5000);
    },
  });

  // Delete session mutation
  const deleteMutation = useMutation({
    mutationFn: async (sessionId: string) => {
      const response = await api.delete(`/fb-session/${sessionId}`);
      return response.data;
    },
    onSuccess: () => {
      setSuccessMessage('Session deleted successfully');
      setTimeout(() => setSuccessMessage(null), 5000);
      queryClient.invalidateQueries({ queryKey: ['fb-session-status', accountId] });
    },
    onError: () => {
      setErrorMessage('Failed to delete session');
      setTimeout(() => setErrorMessage(null), 5000);
    },
  });

  // Setup TOTP mutation
  const setupTotpMutation = useMutation({
    mutationFn: async () => {
      const response = await api.post('/fb-session/totp/setup', { accountId });
      return response.data;
    },
    onSuccess: (data: TotpSetupResponse) => {
      setTotpSetupData(data);
      setShowTotpSetup(true);
    },
    onError: () => {
      setErrorMessage('Failed to setup 2FA');
      setTimeout(() => setErrorMessage(null), 5000);
    },
  });

  // Verify TOTP mutation
  const verifyTotpMutation = useMutation({
    mutationFn: async (code: string) => {
      const response = await api.post('/fb-session/totp/verify', { accountId, code, activate: true });
      return response.data;
    },
    onSuccess: (data) => {
      if (data.valid) {
        setSuccessMessage('2FA has been enabled successfully!');
        setShowTotpSetup(false);
        setTotpSetupData(null);
        setVerificationCode('');
        queryClient.invalidateQueries({ queryKey: ['fb-session-status', accountId] });
      } else {
        setErrorMessage('Invalid verification code. Please try again.');
      }
      setTimeout(() => { setSuccessMessage(null); setErrorMessage(null); }, 5000);
    },
    onError: () => {
      setErrorMessage('Failed to verify 2FA code');
      setTimeout(() => setErrorMessage(null), 5000);
    },
  });

  // Delete TOTP mutation
  const deleteTotpMutation = useMutation({
    mutationFn: async () => {
      const response = await api.delete(`/fb-session/totp/${accountId}`);
      return response.data;
    },
    onSuccess: () => {
      setSuccessMessage('2FA has been disabled');
      setTimeout(() => setSuccessMessage(null), 5000);
      queryClient.invalidateQueries({ queryKey: ['fb-session-status', accountId] });
    },
    onError: () => {
      setErrorMessage('Failed to disable 2FA');
      setTimeout(() => setErrorMessage(null), 5000);
    },
  });

  const handleVerifyCode = async () => {
    if (verificationCode.length !== 6) {
      setErrorMessage('Please enter a 6-digit code');
      setTimeout(() => setErrorMessage(null), 3000);
      return;
    }
    setIsVerifying(true);
    await verifyTotpMutation.mutateAsync(verificationCode);
    setIsVerifying(false);
  };

  const getStatusBadge = (status: SessionData['status']) => {
    switch (status) {
      case 'ACTIVE':
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800"><CheckCircle className="h-3 w-3 mr-1" /> Active</span>;
      case 'EXPIRED':
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800"><Clock className="h-3 w-3 mr-1" /> Expired</span>;
      case 'INVALID':
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800"><AlertCircle className="h-3 w-3 mr-1" /> Invalid</span>;
      case 'PENDING_2FA':
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800"><Shield className="h-3 w-3 mr-1" /> Pending 2FA</span>;
      default:
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">{status}</span>;
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Never';
    return new Date(dateString).toLocaleString();
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Facebook Settings</h1>
          <p className="mt-1 text-sm text-gray-500">Configure your Facebook Marketplace session</p>
        </div>
        <div className="flex items-center justify-center py-12">
          <RefreshCw className="h-8 w-8 animate-spin text-gray-400" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Facebook Settings</h1>
        <p className="mt-1 text-sm text-gray-500">Manage your Facebook Marketplace posting session</p>
      </div>

      {/* Success/Error Messages */}
      {successMessage && (
        <div className="rounded-md bg-green-50 p-4">
          <div className="flex">
            <CheckCircle className="h-5 w-5 text-green-400" />
            <p className="ml-3 text-sm text-green-800">{successMessage}</p>
          </div>
        </div>
      )}
      {errorMessage && (
        <div className="rounded-md bg-red-50 p-4">
          <div className="flex">
            <AlertCircle className="h-5 w-5 text-red-400" />
            <p className="ml-3 text-sm text-red-800">{errorMessage}</p>
          </div>
        </div>
      )}

      {/* Security Notice */}
      <div className="bg-blue-50 border-l-4 border-blue-400 p-4">
        <div className="flex">
          <Lock className="h-5 w-5 text-blue-400" />
          <div className="ml-3">
            <p className="text-sm text-blue-700">
              Your session cookies are encrypted with AES-256-GCM encryption and stored securely.
              No passwords are stored - we only use your logged-in browser session.
            </p>
          </div>
        </div>
      </div>

      {/* Chrome Extension Notice */}
      <div className="bg-purple-50 border-l-4 border-purple-400 p-4">
        <div className="flex">
          <Chrome className="h-5 w-5 text-purple-400" />
          <div className="ml-3">
            <h3 className="text-sm font-medium text-purple-800">Chrome Extension Required</h3>
            <p className="mt-1 text-sm text-purple-700">
              To capture your Facebook session, install the Dealers Face Chrome extension.
              Log into Facebook in Chrome, then click "Capture Session" in the extension.
            </p>
            <a
              href="/chrome-extension"
              className="mt-2 inline-flex items-center text-sm font-medium text-purple-700 hover:text-purple-600"
            >
              Download Chrome Extension →
            </a>
          </div>
        </div>
      </div>

      {/* Session Status */}
      <div className="bg-white shadow rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-medium text-gray-900 flex items-center gap-2">
            <Cookie className="h-5 w-5" />
            Session Status
          </h2>
          <button
            onClick={() => refetch()}
            className="inline-flex items-center px-3 py-1.5 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
          >
            <RefreshCw className="h-4 w-4 mr-1" />
            Refresh
          </button>
        </div>

        {/* Overview Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-gray-50 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold text-primary-600">
              {sessionStatus?.activeSessionCount || 0}
            </div>
            <div className="text-xs text-gray-500">Active Sessions</div>
          </div>
          <div className="bg-gray-50 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold">
              {sessionStatus?.sessions?.length || 0}
            </div>
            <div className="text-xs text-gray-500">Total Sessions</div>
          </div>
          <div className="bg-gray-50 rounded-lg p-3 text-center flex flex-col items-center">
            {sessionStatus?.totpActive ? (
              <ShieldCheck className="h-6 w-6 text-green-600" />
            ) : sessionStatus?.hasTotp ? (
              <Shield className="h-6 w-6 text-yellow-600" />
            ) : (
              <AlertTriangle className="h-6 w-6 text-red-600" />
            )}
            <div className="text-xs text-gray-500 mt-1">
              {sessionStatus?.totpActive ? '2FA Active' : sessionStatus?.hasTotp ? '2FA Pending' : 'No 2FA'}
            </div>
          </div>
          <div className="bg-gray-50 rounded-lg p-3 text-center">
            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
              sessionStatus?.activeSessionCount ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
            }`}>
              {sessionStatus?.activeSessionCount ? 'Ready to Post' : 'Setup Needed'}
            </span>
            <div className="text-xs text-gray-500 mt-1">Posting Status</div>
          </div>
        </div>

        {/* Sessions List */}
        {!sessionStatus?.sessions?.length ? (
          <div className="text-center py-8 border-2 border-dashed border-gray-200 rounded-lg">
            <Cookie className="h-12 w-12 mx-auto text-gray-300 mb-3" />
            <h3 className="text-sm font-medium text-gray-900 mb-1">No Sessions Found</h3>
            <p className="text-sm text-gray-500 mb-4">
              Use the Chrome extension to capture a Facebook session.
            </p>
            <div className="bg-blue-50 border border-blue-200 rounded p-3 text-sm text-blue-800 max-w-md mx-auto">
              <strong>How to capture a session:</strong>
              <ol className="list-decimal list-inside mt-2 text-left space-y-1">
                <li>Install the Dealers Face Chrome extension</li>
                <li>Log into Facebook in Chrome</li>
                <li>Click the extension icon</li>
                <li>Click "Capture Session"</li>
              </ol>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {sessionStatus.sessions.map((session) => (
              <div
                key={session.id}
                className="border rounded-lg p-4 hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">
                        {session.facebookUserName || session.facebookUserId}
                      </span>
                      {getStatusBadge(session.status)}
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border border-gray-200">
                        {session.source === 'EXTENSION' && <Cookie className="h-3 w-3 mr-1" />}
                        {session.source === 'MANUAL' && <Key className="h-3 w-3 mr-1" />}
                        {session.source === 'RECOVERY' && <RefreshCw className="h-3 w-3 mr-1" />}
                        {session.source}
                      </span>
                    </div>
                    <div className="text-xs text-gray-500 space-y-0.5">
                      <div>FB ID: {session.facebookUserId}</div>
                      <div>Created: {formatDate(session.createdAt)}</div>
                      <div>Last Validated: {formatDate(session.lastValidatedAt)}</div>
                      {session.expiresAt && (
                        <div>Expires: {formatDate(session.expiresAt)}</div>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => validateMutation.mutate(session.id)}
                      disabled={validateMutation.isPending}
                      className="inline-flex items-center px-2.5 py-1.5 border border-gray-300 shadow-sm text-xs font-medium rounded text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
                      title="Validate Session"
                    >
                      {validateMutation.isPending ? (
                        <RefreshCw className="h-4 w-4 animate-spin" />
                      ) : (
                        <CheckCircle className="h-4 w-4" />
                      )}
                    </button>
                    <button
                      onClick={() => deleteMutation.mutate(session.id)}
                      disabled={deleteMutation.isPending}
                      className="inline-flex items-center px-2.5 py-1.5 border border-red-300 shadow-sm text-xs font-medium rounded text-red-700 bg-white hover:bg-red-50 disabled:opacity-50"
                      title="Delete Session"
                    >
                      {deleteMutation.isPending ? (
                        <RefreshCw className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 2FA Section */}
      <div className="bg-white shadow rounded-lg p-6">
        <h2 className="text-lg font-medium text-gray-900 flex items-center gap-2 mb-4">
          <Shield className="h-5 w-5" />
          Two-Factor Authentication (2FA)
        </h2>
        
        {sessionStatus?.totpActive ? (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-green-600">
              <ShieldCheck className="h-5 w-5" />
              <span>2FA is enabled and active</span>
            </div>
            <p className="text-sm text-gray-500">
              Automatic session recovery is enabled. When Facebook requires verification,
              the system will automatically generate 2FA codes to recover your session.
            </p>
            <button
              onClick={() => {
                if (confirm('Are you sure you want to disable 2FA? You will need to manually re-authenticate when sessions expire.')) {
                  deleteTotpMutation.mutate();
                }
              }}
              disabled={deleteTotpMutation.isPending}
              className="inline-flex items-center px-4 py-2 border border-red-300 shadow-sm text-sm font-medium rounded-md text-red-700 bg-white hover:bg-red-50 disabled:opacity-50"
            >
              {deleteTotpMutation.isPending ? (
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4 mr-2" />
              )}
              Disable 2FA
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-yellow-600">
              <AlertTriangle className="h-5 w-5" />
              <span>2FA is not configured</span>
            </div>
            <p className="text-sm text-gray-500">
              Enable 2FA to allow automatic session recovery when Facebook requires verification.
              Without 2FA, you'll need to manually re-authenticate via the Chrome extension
              every time your session expires (typically every 90 days).
            </p>
            <button
              onClick={() => setupTotpMutation.mutate()}
              disabled={setupTotpMutation.isPending}
              className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700 disabled:opacity-50"
            >
              {setupTotpMutation.isPending ? (
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <QrCode className="h-4 w-4 mr-2" />
              )}
              Setup 2FA
            </button>
          </div>
        )}
      </div>

      {/* 2FA Setup Modal */}
      {showTotpSetup && totpSetupData && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full m-4 max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center gap-2 mb-4">
                <Smartphone className="h-5 w-5" />
                <h3 className="text-lg font-medium">Setup Two-Factor Authentication</h3>
              </div>
              
              <div className="bg-yellow-50 border border-yellow-200 rounded p-3 mb-4">
                <div className="flex">
                  <Info className="h-5 w-5 text-yellow-400 flex-shrink-0" />
                  <p className="ml-2 text-sm text-yellow-700">
                    This 2FA is for <strong>DealersFace session recovery</strong>, NOT your Facebook account.
                    Use a separate authenticator app entry for this.
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex justify-center">
                  <img
                    src={totpSetupData.qrCode}
                    alt="2FA QR Code"
                    className="w-48 h-48 border rounded"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Manual Entry Code
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={totpSetupData.secret}
                      readOnly
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm font-mono bg-gray-50"
                    />
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(totpSetupData.secret);
                        setSuccessMessage('Secret copied to clipboard');
                        setTimeout(() => setSuccessMessage(null), 3000);
                      }}
                      className="px-3 py-2 border border-gray-300 rounded-md text-sm hover:bg-gray-50"
                    >
                      Copy
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Backup Codes (Save these!)
                  </label>
                  <div className="bg-gray-50 p-2 rounded font-mono text-xs grid grid-cols-2 gap-1">
                    {totpSetupData.backupCodes.map((code, i) => (
                      <span key={i}>{code}</span>
                    ))}
                  </div>
                  <button
                    onClick={() => {
                      const text = totpSetupData.backupCodes.join('\n');
                      navigator.clipboard.writeText(text);
                      setSuccessMessage('Backup codes copied to clipboard');
                      setTimeout(() => setSuccessMessage(null), 3000);
                    }}
                    className="mt-2 w-full inline-flex justify-center items-center px-3 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                  >
                    <Download className="h-4 w-4 mr-1" />
                    Copy Backup Codes
                  </button>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Enter Code to Verify
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="000000"
                      value={verificationCode}
                      onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-center text-lg tracking-widest font-mono"
                      maxLength={6}
                    />
                    <button
                      onClick={handleVerifyCode}
                      disabled={isVerifying || verificationCode.length !== 6}
                      className="px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700 disabled:opacity-50"
                    >
                      {isVerifying ? (
                        <RefreshCw className="h-4 w-4 animate-spin" />
                      ) : (
                        'Verify'
                      )}
                    </button>
                  </div>
                </div>
              </div>

              <div className="mt-6 flex justify-end">
                <button
                  onClick={() => {
                    setShowTotpSetup(false);
                    setTotpSetupData(null);
                    setVerificationCode('');
                  }}
                  className="px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* How It Works */}
      <div className="bg-white shadow rounded-lg p-6">
        <h2 className="text-lg font-medium text-gray-900 mb-4">How It Works</h2>
        
        <ol className="list-decimal list-inside space-y-3 text-sm text-gray-700">
          <li><strong>Install the Chrome Extension</strong> - Download and install the Dealers Face extension</li>
          <li><strong>Log into Facebook</strong> - Sign into your Facebook account in Chrome</li>
          <li><strong>Capture Session</strong> - Click the extension icon and select "Capture Session"</li>
          <li><strong>Enable 2FA</strong> - Set up 2FA for automatic session recovery (recommended)</li>
          <li><strong>Post Vehicles</strong> - Select vehicles and post to Marketplace automatically!</li>
        </ol>

        <div className="mt-4 p-4 bg-green-50 rounded-md">
          <div className="flex">
            <Lock className="h-5 w-5 text-green-400 flex-shrink-0" />
            <div className="ml-3">
              <h4 className="text-sm font-medium text-green-800">Security First</h4>
              <p className="mt-1 text-sm text-green-700">
                We never store your Facebook password. Sessions are captured from your browser
                and encrypted with military-grade AES-256-GCM encryption. 2FA secrets are 
                stored securely and only used to recover expired sessions.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FacebookSettingsPage;
