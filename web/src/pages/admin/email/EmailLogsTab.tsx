import { useState, useEffect, useCallback } from 'react';
import {
  Mail,
  Search,
  CheckCircle,
  XCircle,
  Clock,
  RefreshCw,
  Eye,
  ChevronLeft,
  ChevronRight,
  Send,
  X,
  Loader2,
  AlertCircle,
} from 'lucide-react';

interface EmailLog {
  id: string;
  recipient: string;
  subject: string;
  status: string;
  messageId?: string;
  errorMessage?: string;
  metadata?: {
    provider?: string;
    type?: string;
    templateSlug?: string;
    sentBy?: string;
  };
  createdAt: string;
}

interface TestEmailForm {
  to: string;
  subject: string;
  body: string;
}

// Email validation regex
const EMAIL_REGEX = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;

export default function EmailLogsTab() {
  const [emails, setEmails] = useState<EmailLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [selectedEmail, setSelectedEmail] = useState<EmailLog | null>(null);
  
  // Test Email Modal State
  const [showTestModal, setShowTestModal] = useState(false);
  const [testEmail, setTestEmail] = useState<TestEmailForm>({ to: '', subject: '', body: '' });
  const [isSendingTest, setIsSendingTest] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [testEmailError, setTestEmailError] = useState('');
  
  const limit = 20;

  const loadEmails = useCallback(async () => {
    try {
      setIsLoading(true);
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
      });
      if (statusFilter !== 'all') {
        params.append('status', statusFilter);
      }

      const response = await fetch(`/api/email/logs?${params}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      const data = await response.json();
      
      if (data.success) {
        setEmails(data.data?.logs || []);
        setTotal(data.data?.pagination?.total || 0);
      }
    } catch (err) {
      console.error('Failed to load emails:', err);
    } finally {
      setIsLoading(false);
    }
  }, [page, statusFilter]);

  useEffect(() => {
    loadEmails();
  }, [loadEmails]);

  const handleResend = async (emailId: string) => {
    try {
      const response = await fetch(`/api/email/resend/${emailId}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      const data = await response.json();
      
      if (data.success) {
        loadEmails();
      }
    } catch (err) {
      console.error('Failed to resend email:', err);
    }
  };

  const handleSendTestEmail = async () => {
    // Clear previous errors
    setTestEmailError('');
    setTestResult(null);

    // Validation
    const trimmedTo = testEmail.to.trim().toLowerCase();
    const trimmedSubject = testEmail.subject.trim();
    const trimmedBody = testEmail.body.trim();

    if (!trimmedTo) {
      setTestEmailError('Recipient email is required');
      return;
    }
    if (!EMAIL_REGEX.test(trimmedTo)) {
      setTestEmailError('Please enter a valid email address');
      return;
    }
    if (!trimmedSubject) {
      setTestEmailError('Subject is required');
      return;
    }
    if (!trimmedBody) {
      setTestEmailError('Email body is required');
      return;
    }

    try {
      setIsSendingTest(true);

      const response = await fetch('/api/email/test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({
          to: trimmedTo,
          subject: trimmedSubject,
          body: trimmedBody,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setTestResult({ success: true, message: `Test email sent successfully to ${trimmedTo}` });
        // Reset form after success
        setTimeout(() => {
          setShowTestModal(false);
          setTestEmail({ to: '', subject: '', body: '' });
          setTestResult(null);
          loadEmails(); // Refresh logs
        }, 2000);
      } else {
        setTestResult({ success: false, message: data.error || 'Failed to send test email' });
      }
    } catch (err) {
      console.error('Failed to send test email:', err);
      setTestResult({ success: false, message: 'Failed to send test email. Check your SMTP configuration.' });
    } finally {
      setIsSendingTest(false);
    }
  };

  const closeTestModal = () => {
    setShowTestModal(false);
    setTestEmail({ to: '', subject: '', body: '' });
    setTestEmailError('');
    setTestResult(null);
  };

  const totalPages = Math.ceil(total / limit);

  const statusBadge = (status: string) => {
    const statusLower = status.toLowerCase();
    switch (statusLower) {
      case 'sent':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">
            <CheckCircle className="w-3 h-3" /> Sent
          </span>
        );
      case 'pending':
      case 'queued':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-700">
            <Clock className="w-3 h-3" /> {status}
          </span>
        );
      case 'failed':
      case 'bounced':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700">
            <XCircle className="w-3 h-3" /> {status}
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
            {status}
          </span>
        );
    }
  };

  // Filter emails by search term (client-side filtering)
  const filteredEmails = searchTerm
    ? emails.filter(
        (e) =>
          e.recipient.toLowerCase().includes(searchTerm.toLowerCase()) ||
          e.subject.toLowerCase().includes(searchTerm.toLowerCase())
      )
    : emails;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">
          Total: <span className="font-medium text-gray-700">{total}</span> emails
        </p>
        <button
          onClick={() => setShowTestModal(true)}
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Send className="w-4 h-4" />
          Send Test Email
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-gray-50 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Mail className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-xl font-bold text-gray-900">{total}</p>
              <p className="text-xs text-gray-500">Total Emails</p>
            </div>
          </div>
        </div>
        <div className="bg-gray-50 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <CheckCircle className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-xl font-bold text-gray-900">
                {emails.filter((e) => e.status.toLowerCase() === 'sent').length}
              </p>
              <p className="text-xs text-gray-500">Sent</p>
            </div>
          </div>
        </div>
        <div className="bg-gray-50 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-yellow-100 rounded-lg">
              <Clock className="w-5 h-5 text-yellow-600" />
            </div>
            <div>
              <p className="text-xl font-bold text-gray-900">
                {emails.filter((e) => ['pending', 'queued'].includes(e.status.toLowerCase())).length}
              </p>
              <p className="text-xs text-gray-500">Pending</p>
            </div>
          </div>
        </div>
        <div className="bg-gray-50 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-100 rounded-lg">
              <XCircle className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <p className="text-xl font-bold text-gray-900">
                {emails.filter((e) => ['failed', 'bounced'].includes(e.status.toLowerCase())).length}
              </p>
              <p className="text-xs text-gray-500">Failed</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-gray-50 rounded-xl p-4">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by recipient or subject..."
              className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            className="px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="all">All Status</option>
            <option value="SENT">Sent</option>
            <option value="QUEUED">Queued</option>
            <option value="FAILED">Failed</option>
            <option value="BOUNCED">Bounced</option>
          </select>
          <button
            onClick={loadEmails}
            className="inline-flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
        </div>
      </div>

      {/* Email Logs Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Recipient
                </th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Subject
                </th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Type
                </th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Date
                </th>
                <th className="text-right px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center">
                    <Loader2 className="w-8 h-8 animate-spin text-blue-600 mx-auto" />
                  </td>
                </tr>
              ) : filteredEmails.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                    No email logs found
                  </td>
                </tr>
              ) : (
                filteredEmails.map((email) => (
                  <tr key={email.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <p className="text-sm font-medium text-gray-900 truncate max-w-xs">
                        {email.recipient}
                      </p>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-sm text-gray-700 truncate max-w-xs">{email.subject}</p>
                    </td>
                    <td className="px-6 py-4">{statusBadge(email.status)}</td>
                    <td className="px-6 py-4">
                      <span className="text-sm text-gray-500">
                        {email.metadata?.type || email.metadata?.provider || 'smtp'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {new Date(email.createdAt).toLocaleString()}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => setSelectedEmail(email)}
                          className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="View Details"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        {email.status.toLowerCase() === 'failed' && (
                          <button
                            onClick={() => handleResend(email.id)}
                            className="p-2 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                            title="Resend"
                          >
                            <RefreshCw className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between">
            <p className="text-sm text-gray-500">
              Showing {(page - 1) * limit + 1} to {Math.min(page * limit, total)} of {total} emails
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="p-2 text-gray-400 hover:text-gray-600 disabled:opacity-50"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <span className="text-sm text-gray-600">
                Page {page} of {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="p-2 text-gray-400 hover:text-gray-600 disabled:opacity-50"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Email Details Modal */}
      {selectedEmail && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-100">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold text-gray-900">Email Details</h2>
                <button
                  onClick={() => setSelectedEmail(null)}
                  className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-500">Recipient</p>
                  <p className="text-gray-900 font-medium break-all">{selectedEmail.recipient}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Status</p>
                  <div className="mt-1">{statusBadge(selectedEmail.status)}</div>
                </div>
                <div className="col-span-2">
                  <p className="text-sm text-gray-500">Subject</p>
                  <p className="text-gray-900">{selectedEmail.subject}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Type</p>
                  <p className="text-gray-900">{selectedEmail.metadata?.type || 'smtp'}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Date</p>
                  <p className="text-gray-900">
                    {new Date(selectedEmail.createdAt).toLocaleString()}
                  </p>
                </div>
                {selectedEmail.messageId && (
                  <div className="col-span-2">
                    <p className="text-sm text-gray-500">Message ID</p>
                    <code className="text-xs text-gray-600 bg-gray-100 px-2 py-1 rounded break-all">
                      {selectedEmail.messageId}
                    </code>
                  </div>
                )}
                {selectedEmail.errorMessage && (
                  <div className="col-span-2">
                    <p className="text-sm text-gray-500">Error</p>
                    <p className="text-red-600 bg-red-50 p-3 rounded-lg text-sm">
                      {selectedEmail.errorMessage}
                    </p>
                  </div>
                )}
              </div>
              <div className="flex gap-3 pt-4">
                {selectedEmail.status.toLowerCase() === 'failed' && (
                  <button
                    onClick={() => {
                      handleResend(selectedEmail.id);
                      setSelectedEmail(null);
                    }}
                    className="flex-1 py-2 px-4 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700"
                  >
                    Resend Email
                  </button>
                )}
                <button
                  onClick={() => setSelectedEmail(null)}
                  className="flex-1 py-2 px-4 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Send Test Email Modal */}
      {showTestModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full">
            <div className="p-6 border-b border-gray-100">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold text-gray-900">Send Test Email</h2>
                <button
                  onClick={closeTestModal}
                  className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            <div className="p-6 space-y-4">
              {/* Error/Success Messages */}
              {testEmailError && (
                <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                  <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
                  <p className="text-sm text-red-700">{testEmailError}</p>
                </div>
              )}
              {testResult && (
                <div
                  className={`flex items-center gap-2 p-3 rounded-lg ${
                    testResult.success
                      ? 'bg-green-50 border border-green-200'
                      : 'bg-red-50 border border-red-200'
                  }`}
                >
                  {testResult.success ? (
                    <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
                  )}
                  <p className={`text-sm ${testResult.success ? 'text-green-700' : 'text-red-700'}`}>
                    {testResult.message}
                  </p>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Recipient Email *
                </label>
                <input
                  type="email"
                  value={testEmail.to}
                  onChange={(e) => {
                    setTestEmail({ ...testEmail, to: e.target.value });
                    setTestEmailError('');
                  }}
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="test@example.com"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Subject *
                </label>
                <input
                  type="text"
                  value={testEmail.subject}
                  onChange={(e) => {
                    setTestEmail({ ...testEmail, subject: e.target.value });
                    setTestEmailError('');
                  }}
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Test Email Subject"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Body *
                </label>
                <textarea
                  value={testEmail.body}
                  onChange={(e) => {
                    setTestEmail({ ...testEmail, body: e.target.value });
                    setTestEmailError('');
                  }}
                  rows={4}
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="<p>This is a test email from DealersFace.</p>"
                />
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  onClick={handleSendTestEmail}
                  disabled={isSendingTest}
                  className="flex-1 inline-flex items-center justify-center gap-2 py-2 px-4 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSendingTest ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                  Send Test Email
                </button>
                <button
                  onClick={closeTestModal}
                  className="flex-1 py-2 px-4 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
