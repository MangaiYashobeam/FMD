/**
 * Session Management Card Component
 * 
 * Admin UI for managing Facebook session-based authentication.
 * Replaces OAuth management with cookie/session management and 2FA setup.
 */

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Cookie,
  Key,
  RefreshCw,
  Shield,
  ShieldCheck,
  Trash2,
  AlertTriangle,
  QrCode,
  Smartphone,
  Download,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';

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
  updatedAt: string;
}

interface TotpData {
  id: string;
  accountId: string;
  isActive: boolean;
  lastUsedAt: string | null;
  recoveryEmail: string | null;
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

interface SessionManagementCardProps {
  accountId: string;
  accountName?: string;
}

export function SessionManagementCard({ accountId, accountName }: SessionManagementCardProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [showTotpSetup, setShowTotpSetup] = useState(false);
  const [totpSetupData, setTotpSetupData] = useState<TotpSetupResponse | null>(null);
  const [verificationCode, setVerificationCode] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);

  // Fetch session status
  const { data: sessionStatus, isLoading, error, refetch } = useQuery<SessionStatusResponse>({
    queryKey: ['fb-session-status', accountId],
    queryFn: async () => {
      const response = await apiRequest('GET', `/api/fb-session/status/${accountId}`);
      return response.json();
    },
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  // Validate session mutation
  const validateMutation = useMutation({
    mutationFn: async (sessionId: string) => {
      const response = await apiRequest('POST', '/api/fb-session/validate', {
        sessionId,
      });
      return response.json();
    },
    onSuccess: (data) => {
      if (data.valid) {
        toast({
          title: 'Session Valid',
          description: 'Facebook session is active and working.',
        });
      } else {
        toast({
          title: 'Session Invalid',
          description: data.reason || 'Session may be expired or revoked.',
          variant: 'destructive',
        });
      }
      queryClient.invalidateQueries({ queryKey: ['fb-session-status', accountId] });
    },
    onError: (error) => {
      toast({
        title: 'Validation Failed',
        description: error instanceof Error ? error.message : 'Could not validate session',
        variant: 'destructive',
      });
    },
  });

  // Delete session mutation
  const deleteMutation = useMutation({
    mutationFn: async (sessionId: string) => {
      const response = await apiRequest('DELETE', `/api/fb-session/${sessionId}`);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: 'Session Deleted',
        description: 'Facebook session has been removed.',
      });
      queryClient.invalidateQueries({ queryKey: ['fb-session-status', accountId] });
    },
    onError: (error) => {
      toast({
        title: 'Delete Failed',
        description: error instanceof Error ? error.message : 'Could not delete session',
        variant: 'destructive',
      });
    },
  });

  // Setup TOTP mutation
  const setupTotpMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', '/api/fb-session/totp/setup', {
        accountId,
      });
      return response.json();
    },
    onSuccess: (data: TotpSetupResponse) => {
      setTotpSetupData(data);
      setShowTotpSetup(true);
    },
    onError: (error) => {
      toast({
        title: '2FA Setup Failed',
        description: error instanceof Error ? error.message : 'Could not setup 2FA',
        variant: 'destructive',
      });
    },
  });

  // Verify TOTP mutation
  const verifyTotpMutation = useMutation({
    mutationFn: async (code: string) => {
      const response = await apiRequest('POST', '/api/fb-session/totp/verify', {
        accountId,
        code,
        activate: true,
      });
      return response.json();
    },
    onSuccess: (data) => {
      if (data.valid) {
        toast({
          title: '2FA Activated',
          description: '2FA has been enabled for automatic session recovery.',
        });
        setShowTotpSetup(false);
        setTotpSetupData(null);
        setVerificationCode('');
        queryClient.invalidateQueries({ queryKey: ['fb-session-status', accountId] });
      } else {
        toast({
          title: 'Invalid Code',
          description: 'The verification code is incorrect. Please try again.',
          variant: 'destructive',
        });
      }
    },
    onError: (error) => {
      toast({
        title: 'Verification Failed',
        description: error instanceof Error ? error.message : 'Could not verify code',
        variant: 'destructive',
      });
    },
  });

  // Delete TOTP mutation
  const deleteTotpMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('DELETE', `/api/fb-session/totp/${accountId}`);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: '2FA Disabled',
        description: '2FA has been disabled. Manual session recovery will be required.',
      });
      queryClient.invalidateQueries({ queryKey: ['fb-session-status', accountId] });
    },
    onError: (error) => {
      toast({
        title: 'Disable Failed',
        description: error instanceof Error ? error.message : 'Could not disable 2FA',
        variant: 'destructive',
      });
    },
  });

  const handleVerifyCode = async () => {
    if (verificationCode.length !== 6) {
      toast({
        title: 'Invalid Code',
        description: 'Please enter a 6-digit code',
        variant: 'destructive',
      });
      return;
    }
    setIsVerifying(true);
    await verifyTotpMutation.mutateAsync(verificationCode);
    setIsVerifying(false);
  };

  const getStatusBadge = (status: SessionData['status']) => {
    switch (status) {
      case 'ACTIVE':
        return <Badge className="bg-green-100 text-green-800"><CheckCircle2 className="h-3 w-3 mr-1" /> Active</Badge>;
      case 'EXPIRED':
        return <Badge className="bg-yellow-100 text-yellow-800"><Clock className="h-3 w-3 mr-1" /> Expired</Badge>;
      case 'INVALID':
        return <Badge className="bg-red-100 text-red-800"><AlertCircle className="h-3 w-3 mr-1" /> Invalid</Badge>;
      case 'PENDING_2FA':
        return <Badge className="bg-blue-100 text-blue-800"><Shield className="h-3 w-3 mr-1" /> Pending 2FA</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  const getSourceBadge = (source: SessionData['source']) => {
    switch (source) {
      case 'EXTENSION':
        return <Badge variant="outline"><Cookie className="h-3 w-3 mr-1" /> Extension</Badge>;
      case 'MANUAL':
        return <Badge variant="outline"><Key className="h-3 w-3 mr-1" /> Manual</Badge>;
      case 'RECOVERY':
        return <Badge variant="outline"><RefreshCw className="h-3 w-3 mr-1" /> Recovery</Badge>;
      default:
        return <Badge variant="outline">{source}</Badge>;
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Never';
    return new Date(dateString).toLocaleString();
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Cookie className="h-5 w-5" />
            Session Management
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Cookie className="h-5 w-5" />
            Session Management
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 text-red-600">
            <AlertCircle className="h-5 w-5" />
            <span>Failed to load session status</span>
          </div>
          <Button onClick={() => refetch()} variant="outline" className="mt-4">
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Cookie className="h-5 w-5" />
              Facebook Session Management
            </CardTitle>
            <CardDescription>
              {accountName ? `${accountName} - ` : ''}
              Manage browser sessions for Facebook Marketplace posting
            </CardDescription>
          </div>
          <Button onClick={() => refetch()} variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-1" />
            Refresh
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Status Overview */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-muted rounded-lg p-3 text-center">
            <div className="text-2xl font-bold text-primary">
              {sessionStatus?.activeSessionCount || 0}
            </div>
            <div className="text-xs text-muted-foreground">Active Sessions</div>
          </div>
          <div className="bg-muted rounded-lg p-3 text-center">
            <div className="text-2xl font-bold">
              {sessionStatus?.sessions?.length || 0}
            </div>
            <div className="text-xs text-muted-foreground">Total Sessions</div>
          </div>
          <div className="bg-muted rounded-lg p-3 text-center">
            <div className="flex justify-center">
              {sessionStatus?.totpActive ? (
                <ShieldCheck className="h-6 w-6 text-green-600" />
              ) : sessionStatus?.hasTotp ? (
                <Shield className="h-6 w-6 text-yellow-600" />
              ) : (
                <AlertTriangle className="h-6 w-6 text-red-600" />
              )}
            </div>
            <div className="text-xs text-muted-foreground">
              {sessionStatus?.totpActive ? '2FA Active' : sessionStatus?.hasTotp ? '2FA Pending' : 'No 2FA'}
            </div>
          </div>
          <div className="bg-muted rounded-lg p-3 text-center">
            <Badge variant={sessionStatus?.activeSessionCount ? 'default' : 'destructive'}>
              {sessionStatus?.activeSessionCount ? 'Ready' : 'Setup Needed'}
            </Badge>
            <div className="text-xs text-muted-foreground mt-1">Posting Status</div>
          </div>
        </div>

        {/* 2FA Section */}
        <div className="border rounded-lg p-4">
          <h4 className="font-semibold flex items-center gap-2 mb-3">
            <Shield className="h-4 w-4" />
            Two-Factor Authentication (2FA)
          </h4>
          
          {sessionStatus?.totpActive ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-green-600">
                <ShieldCheck className="h-5 w-5" />
                <span>2FA is enabled and active</span>
              </div>
              <p className="text-sm text-muted-foreground">
                Automatic session recovery is enabled. When Facebook requires verification,
                the system will automatically generate 2FA codes.
              </p>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => deleteTotpMutation.mutate()}
                disabled={deleteTotpMutation.isPending}
              >
                {deleteTotpMutation.isPending ? (
                  <RefreshCw className="h-4 w-4 mr-1 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4 mr-1" />
                )}
                Disable 2FA
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-yellow-600">
                <AlertTriangle className="h-5 w-5" />
                <span>2FA is not configured</span>
              </div>
              <p className="text-sm text-muted-foreground">
                Enable 2FA to allow automatic session recovery when Facebook requires verification.
                Without 2FA, you'll need to manually re-authenticate via the Chrome extension.
              </p>
              <Dialog open={showTotpSetup} onOpenChange={setShowTotpSetup}>
                <DialogTrigger asChild>
                  <Button
                    onClick={() => setupTotpMutation.mutate()}
                    disabled={setupTotpMutation.isPending}
                  >
                    {setupTotpMutation.isPending ? (
                      <RefreshCw className="h-4 w-4 mr-1 animate-spin" />
                    ) : (
                      <QrCode className="h-4 w-4 mr-1" />
                    )}
                    Setup 2FA
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-md">
                  <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                      <Smartphone className="h-5 w-5" />
                      Setup Two-Factor Authentication
                    </DialogTitle>
                    <DialogDescription>
                      This 2FA is for DealersFace session recovery, NOT your Facebook account.
                      Use a separate authenticator app entry for this.
                    </DialogDescription>
                  </DialogHeader>
                  
                  {totpSetupData && (
                    <div className="space-y-4">
                      <div className="flex justify-center">
                        <img
                          src={totpSetupData.qrCode}
                          alt="2FA QR Code"
                          className="w-48 h-48 border rounded"
                        />
                      </div>
                      
                      <div className="space-y-2">
                        <Label>Manual Entry Code</Label>
                        <div className="flex items-center gap-2">
                          <Input
                            value={totpSetupData.secret}
                            readOnly
                            className="font-mono text-sm"
                          />
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              navigator.clipboard.writeText(totpSetupData.secret);
                              toast({ title: 'Copied!', description: 'Secret copied to clipboard' });
                            }}
                          >
                            Copy
                          </Button>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label>Backup Codes (Save these!)</Label>
                        <div className="bg-muted p-2 rounded font-mono text-xs grid grid-cols-2 gap-1">
                          {totpSetupData.backupCodes.map((code, i) => (
                            <span key={i}>{code}</span>
                          ))}
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full"
                          onClick={() => {
                            const text = totpSetupData.backupCodes.join('\n');
                            navigator.clipboard.writeText(text);
                            toast({ title: 'Copied!', description: 'Backup codes copied to clipboard' });
                          }}
                        >
                          <Download className="h-4 w-4 mr-1" />
                          Copy Backup Codes
                        </Button>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="verify-code">Enter Code to Verify</Label>
                        <div className="flex gap-2">
                          <Input
                            id="verify-code"
                            placeholder="000000"
                            value={verificationCode}
                            onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                            className="font-mono text-center text-lg tracking-widest"
                            maxLength={6}
                          />
                          <Button
                            onClick={handleVerifyCode}
                            disabled={isVerifying || verificationCode.length !== 6}
                          >
                            {isVerifying ? (
                              <RefreshCw className="h-4 w-4 animate-spin" />
                            ) : (
                              'Verify'
                            )}
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}
                  
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setShowTotpSetup(false)}>
                      Cancel
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          )}
        </div>

        {/* Sessions List */}
        <div className="space-y-3">
          <h4 className="font-semibold flex items-center gap-2">
            <Key className="h-4 w-4" />
            Active Sessions
          </h4>
          
          {!sessionStatus?.sessions?.length ? (
            <div className="border rounded-lg p-6 text-center">
              <Cookie className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
              <h5 className="font-medium mb-1">No Sessions Found</h5>
              <p className="text-sm text-muted-foreground mb-4">
                Use the Chrome extension to capture a Facebook session.
                Log into Facebook in Chrome, then click "Capture Session" in the extension.
              </p>
              <div className="bg-blue-50 border border-blue-200 rounded p-3 text-sm text-blue-800">
                <strong>How to capture a session:</strong>
                <ol className="list-decimal list-inside mt-2 text-left space-y-1">
                  <li>Install the DealersFace Chrome extension</li>
                  <li>Log into Facebook in Chrome</li>
                  <li>Click the extension icon</li>
                  <li>Click "Capture Session"</li>
                </ol>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              {sessionStatus.sessions.map((session) => (
                <div
                  key={session.id}
                  className="border rounded-lg p-4 hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">
                          {session.facebookUserName || session.facebookUserId}
                        </span>
                        {getStatusBadge(session.status)}
                        {getSourceBadge(session.source)}
                      </div>
                      <div className="text-xs text-muted-foreground space-y-0.5">
                        <div>FB ID: {session.facebookUserId}</div>
                        <div>Created: {formatDate(session.createdAt)}</div>
                        <div>Last Validated: {formatDate(session.lastValidatedAt)}</div>
                        {session.expiresAt && (
                          <div>Expires: {formatDate(session.expiresAt)}</div>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => validateMutation.mutate(session.id)}
                        disabled={validateMutation.isPending}
                      >
                        {validateMutation.isPending ? (
                          <RefreshCw className="h-4 w-4 animate-spin" />
                        ) : (
                          <CheckCircle2 className="h-4 w-4" />
                        )}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => deleteMutation.mutate(session.id)}
                        disabled={deleteMutation.isPending}
                        className="text-red-600 hover:text-red-700"
                      >
                        {deleteMutation.isPending ? (
                          <RefreshCw className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Info Box */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm">
          <h5 className="font-semibold text-blue-800 mb-2">
            ℹ️ About Session-Based Authentication
          </h5>
          <p className="text-blue-700 mb-2">
            Facebook Marketplace doesn't have a public API. To post vehicles, we use your
            logged-in browser session (cookies) captured via the Chrome extension.
          </p>
          <ul className="list-disc list-inside text-blue-600 space-y-1">
            <li>Sessions are encrypted and stored securely</li>
            <li>2FA enables automatic session recovery</li>
            <li>Sessions typically last 90 days</li>
            <li>No passwords are ever stored</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}

export default SessionManagementCard;
