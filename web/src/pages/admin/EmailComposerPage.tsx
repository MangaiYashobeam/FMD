import { useState, useEffect } from 'react';
import {
  Send,
  Search,
  X,
  Eye,
  Loader2,
  CheckCircle,
  AlertCircle,
  Building,
  User,
} from 'lucide-react';
import { adminApi } from '../../lib/api';

interface Recipient {
  id: string;
  email: string;
  name: string;
  type: 'user' | 'account';
}

interface EmailTemplate {
  id: string;
  name: string;
  slug: string;
  subject: string;
  variables: string[];
  description?: string;
}

interface EmailConfig {
  systemDomain: string;
  defaultFromEmail: string;
  defaultFromName: string;
  supportEmail: string;
  isConfigured: boolean;
}

export default function EmailComposerPage() {
  const [emailConfig, setEmailConfig] = useState<EmailConfig | null>(null);
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [selectedRecipients, setSelectedRecipients] = useState<Recipient[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [sendResult, setSendResult] = useState<{ success: boolean; message: string } | null>(null);

  // Compose form state
  const [composeData, setComposeData] = useState({
    subject: '',
    body: '',
    cc: '',
    bcc: '',
    templateSlug: '',
    replyTo: '',
  });

  // Recipient search
  const [recipientSearch, setRecipientSearch] = useState('');
  const [recipientType, setRecipientType] = useState<'all' | 'users' | 'admins' | 'accounts'>('all');
  const [showRecipientDropdown, setShowRecipientDropdown] = useState(false);

  // Template preview
  const [showPreview, setShowPreview] = useState(false);
  const [previewHtml, setPreviewHtml] = useState('');

  useEffect(() => {
    loadInitialData();
  }, []);

  useEffect(() => {
    if (recipientSearch.length >= 2) {
      searchRecipients();
    }
  }, [recipientSearch, recipientType]);

  const loadInitialData = async () => {
    try {
      setIsLoading(true);
      const [configRes, templatesRes] = await Promise.all([
        fetch('/api/email/config', {
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
        }).then((r) => r.json()),
        adminApi.getEmailTemplates(),
      ]);

      if (configRes.success) {
        setEmailConfig(configRes.data);
      }
      setTemplates(templatesRes.data.data?.templates || []);
    } catch (error) {
      console.error('Failed to load initial data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const searchRecipients = async () => {
    try {
      const response = await fetch(
        `/api/email/recipients?type=${recipientType}&search=${encodeURIComponent(recipientSearch)}`,
        {
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
        }
      );
      const data = await response.json();

      if (data.success) {
        const allRecipients: Recipient[] = [
          ...(data.data.users || []).map((u: any) => ({
            id: u.id,
            email: u.email,
            name: u.name,
            type: 'user' as const,
          })),
          ...(data.data.accounts || []).flatMap((a: any) =>
            a.emails.map((email: string) => ({
              id: `${a.id}-${email}`,
              email,
              name: a.name,
              type: 'account' as const,
            }))
          ),
        ];
        setRecipients(allRecipients);
        setShowRecipientDropdown(true);
      }
    } catch (error) {
      console.error('Failed to search recipients:', error);
    }
  };

  const addRecipient = (recipient: Recipient) => {
    if (!selectedRecipients.find((r) => r.email === recipient.email)) {
      setSelectedRecipients([...selectedRecipients, recipient]);
    }
    setRecipientSearch('');
    setShowRecipientDropdown(false);
  };

  const removeRecipient = (email: string) => {
    setSelectedRecipients(selectedRecipients.filter((r) => r.email !== email));
  };

  const handleTemplateSelect = (slug: string) => {
    const template = templates.find((t) => t.slug === slug);
    if (template) {
      setComposeData({
        ...composeData,
        templateSlug: slug,
        subject: template.subject,
      });
    } else {
      setComposeData({
        ...composeData,
        templateSlug: '',
      });
    }
  };

  const handlePreview = () => {
    // Wrap body in basic email template for preview
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #2563eb 0%, #1e40af 100%); padding: 20px; border-radius: 8px 8px 0 0; text-align: center;">
          <h1 style="margin: 0; color: white; font-size: 24px;">🚗 DealersFace</h1>
        </div>
        <div style="background: white; padding: 30px; border: 1px solid #e5e7eb;">
          ${composeData.body}
        </div>
        <div style="background: #f9fafb; padding: 20px; border-radius: 0 0 8px 8px; text-align: center; border: 1px solid #e5e7eb; border-top: none;">
          <p style="margin: 0; color: #6b7280; font-size: 12px;">
            Sent from DealersFace • dealersface.com
          </p>
        </div>
      </div>
    `;
    setPreviewHtml(html);
    setShowPreview(true);
  };

  const handleSend = async () => {
    if (selectedRecipients.length === 0) {
      alert('Please add at least one recipient');
      return;
    }
    if (!composeData.subject.trim()) {
      alert('Please enter a subject');
      return;
    }
    if (!composeData.body.trim()) {
      alert('Please enter email content');
      return;
    }

    try {
      setIsSending(true);
      setSendResult(null);

      const response = await fetch('/api/email/compose', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({
          to: selectedRecipients.map((r) => r.email),
          subject: composeData.subject,
          body: composeData.body,
          cc: composeData.cc ? composeData.cc.split(',').map((e) => e.trim()) : undefined,
          bcc: composeData.bcc ? composeData.bcc.split(',').map((e) => e.trim()) : undefined,
          templateSlug: composeData.templateSlug || undefined,
          replyTo: composeData.replyTo || undefined,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setSendResult({ success: true, message: data.message });
        // Reset form
        setSelectedRecipients([]);
        setComposeData({
          subject: '',
          body: '',
          cc: '',
          bcc: '',
          templateSlug: '',
          replyTo: '',
        });
      } else {
        setSendResult({ success: false, message: data.error || 'Failed to send email' });
      }
    } catch (error) {
      console.error('Failed to send email:', error);
      setSendResult({ success: false, message: 'Failed to send email. Please try again.' });
    } finally {
      setIsSending(false);
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
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Email Composer</h1>
          <p className="text-gray-500 mt-1">
            Compose and send emails to users • Sender: fb-api@dealersface.com
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handlePreview}
            disabled={!composeData.body}
            className="inline-flex items-center gap-2 px-4 py-2 border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50"
          >
            <Eye className="w-4 h-4" />
            Preview
          </button>
          <button
            onClick={handleSend}
            disabled={isSending || selectedRecipients.length === 0}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {isSending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
            Send Email
          </button>
        </div>
      </div>

      {/* Email Config Status */}
      {emailConfig && (
        <div
          className={`flex items-center gap-3 p-4 rounded-xl ${
            emailConfig.isConfigured ? 'bg-green-50 border border-green-200' : 'bg-yellow-50 border border-yellow-200'
          }`}
        >
          {emailConfig.isConfigured ? (
            <>
              <CheckCircle className="w-5 h-5 text-green-600" />
              <div>
                <p className="font-medium text-green-800">SMTP Configured</p>
                <p className="text-sm text-green-600">
                  Emails will be sent from: {emailConfig.defaultFromEmail}
                </p>
              </div>
            </>
          ) : (
            <>
              <AlertCircle className="w-5 h-5 text-yellow-600" />
              <div>
                <p className="font-medium text-yellow-800">SMTP Not Configured</p>
                <p className="text-sm text-yellow-600">
                  Configure SMTP in System Settings to send emails
                </p>
              </div>
            </>
          )}
        </div>
      )}

      {/* Result Message */}
      {sendResult && (
        <div
          className={`flex items-center gap-3 p-4 rounded-xl ${
            sendResult.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'
          }`}
        >
          {sendResult.success ? (
            <CheckCircle className="w-5 h-5 text-green-600" />
          ) : (
            <AlertCircle className="w-5 h-5 text-red-600" />
          )}
          <p className={sendResult.success ? 'text-green-800' : 'text-red-800'}>
            {sendResult.message}
          </p>
          <button
            onClick={() => setSendResult(null)}
            className="ml-auto text-gray-400 hover:text-gray-600"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Main Composer */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        {/* Recipients */}
        <div className="p-4 border-b border-gray-100">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            To:
          </label>
          <div className="flex flex-wrap items-center gap-2 mb-2">
            {selectedRecipients.map((r) => (
              <span
                key={r.email}
                className="inline-flex items-center gap-1 px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm"
              >
                {r.type === 'user' ? (
                  <User className="w-3 h-3" />
                ) : (
                  <Building className="w-3 h-3" />
                )}
                {r.name} &lt;{r.email}&gt;
                <button
                  onClick={() => removeRecipient(r.email)}
                  className="ml-1 text-blue-600 hover:text-blue-800"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
          </div>
          <div className="relative">
            <div className="flex items-center gap-2">
              <select
                value={recipientType}
                onChange={(e) => setRecipientType(e.target.value as any)}
                className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All</option>
                <option value="users">Users</option>
                <option value="admins">Admins</option>
                <option value="accounts">Accounts</option>
              </select>
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={recipientSearch}
                  onChange={(e) => setRecipientSearch(e.target.value)}
                  onFocus={() => recipientSearch.length >= 2 && setShowRecipientDropdown(true)}
                  placeholder="Search users or accounts..."
                  className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            {showRecipientDropdown && recipients.length > 0 && (
              <div className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                {recipients.map((r) => (
                  <button
                    key={r.email}
                    onClick={() => addRecipient(r)}
                    className="w-full px-4 py-2 text-left hover:bg-gray-50 flex items-center gap-3"
                  >
                    {r.type === 'user' ? (
                      <User className="w-4 h-4 text-gray-400" />
                    ) : (
                      <Building className="w-4 h-4 text-gray-400" />
                    )}
                    <div>
                      <p className="text-sm font-medium text-gray-900">{r.name}</p>
                      <p className="text-xs text-gray-500">{r.email}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* CC/BCC */}
        <div className="grid grid-cols-2 gap-4 p-4 border-b border-gray-100 bg-gray-50">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              CC: (optional, comma-separated)
            </label>
            <input
              type="text"
              value={composeData.cc}
              onChange={(e) => setComposeData({ ...composeData, cc: e.target.value })}
              placeholder="cc@example.com, cc2@example.com"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              BCC: (optional, comma-separated)
            </label>
            <input
              type="text"
              value={composeData.bcc}
              onChange={(e) => setComposeData({ ...composeData, bcc: e.target.value })}
              placeholder="bcc@example.com"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
            />
          </div>
        </div>

        {/* Template Selection */}
        <div className="p-4 border-b border-gray-100">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Use Template (optional):
          </label>
          <select
            value={composeData.templateSlug}
            onChange={(e) => handleTemplateSelect(e.target.value)}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            <option value="">-- No Template (Custom Email) --</option>
            {templates.map((t) => (
              <option key={t.slug} value={t.slug}>
                {t.name} ({t.slug})
              </option>
            ))}
          </select>
        </div>

        {/* Subject */}
        <div className="p-4 border-b border-gray-100">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Subject: *
          </label>
          <input
            type="text"
            value={composeData.subject}
            onChange={(e) => setComposeData({ ...composeData, subject: e.target.value })}
            placeholder="Enter email subject..."
            className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Body */}
        <div className="p-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Email Body (HTML supported): *
          </label>
          <textarea
            value={composeData.body}
            onChange={(e) => setComposeData({ ...composeData, body: e.target.value })}
            rows={15}
            placeholder="<p>Dear User,</p>
<p>Your email content here...</p>
<p>Best regards,<br>The DealersFace Team</p>"
            className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 font-mono text-sm"
          />
          <div className="flex items-center gap-4 mt-3 text-sm text-gray-500">
            <span>💡 Tips:</span>
            <span>Use &lt;p&gt; for paragraphs</span>
            <span>Use &lt;strong&gt; for bold</span>
            <span>Use &lt;a href=""&gt; for links</span>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="p-4 bg-gray-50 border-t border-gray-100">
          <p className="text-sm font-medium text-gray-700 mb-3">Quick Insert:</p>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setComposeData({ ...composeData, body: composeData.body + '<p></p>' })}
              className="px-3 py-1.5 text-sm bg-white border border-gray-200 rounded-lg hover:bg-gray-50"
            >
              Paragraph
            </button>
            <button
              onClick={() => setComposeData({ ...composeData, body: composeData.body + '<a href="">Link Text</a>' })}
              className="px-3 py-1.5 text-sm bg-white border border-gray-200 rounded-lg hover:bg-gray-50"
            >
              Link
            </button>
            <button
              onClick={() => setComposeData({ ...composeData, body: composeData.body + '<strong>Bold Text</strong>' })}
              className="px-3 py-1.5 text-sm bg-white border border-gray-200 rounded-lg hover:bg-gray-50"
            >
              Bold
            </button>
            <button
              onClick={() =>
                setComposeData({
                  ...composeData,
                  body:
                    composeData.body +
                    '\n<div style="background: #f3f4f6; padding: 15px; border-radius: 8px; margin: 15px 0;">Info Box</div>',
                })
              }
              className="px-3 py-1.5 text-sm bg-white border border-gray-200 rounded-lg hover:bg-gray-50"
            >
              Info Box
            </button>
            <button
              onClick={() =>
                setComposeData({
                  ...composeData,
                  body:
                    composeData.body +
                    '\n<a href="" style="display: inline-block; background: #2563eb; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none;">Button Text</a>',
                })
              }
              className="px-3 py-1.5 text-sm bg-white border border-gray-200 rounded-lg hover:bg-gray-50"
            >
              Button
            </button>
            <button
              onClick={() => setComposeData({ ...composeData, body: composeData.body + '<br>' })}
              className="px-3 py-1.5 text-sm bg-white border border-gray-200 rounded-lg hover:bg-gray-50"
            >
              Line Break
            </button>
            <button
              onClick={() => setComposeData({ ...composeData, body: composeData.body + '<hr style="border: 1px solid #e5e7eb; margin: 20px 0;">' })}
              className="px-3 py-1.5 text-sm bg-white border border-gray-200 rounded-lg hover:bg-gray-50"
            >
              Divider
            </button>
          </div>
        </div>
      </div>

      {/* Preview Modal */}
      {showPreview && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">Email Preview</h2>
              <button
                onClick={() => setShowPreview(false)}
                className="p-2 text-gray-400 hover:text-gray-600 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 bg-gray-100">
              <div className="mb-4 p-4 bg-white rounded-lg shadow-sm">
                <p className="text-sm">
                  <strong>From:</strong> {emailConfig?.defaultFromEmail || 'fb-api@dealersface.com'}
                </p>
                <p className="text-sm">
                  <strong>To:</strong> {selectedRecipients.map((r) => r.email).join(', ') || '(no recipients)'}
                </p>
                <p className="text-sm">
                  <strong>Subject:</strong> {composeData.subject || '(no subject)'}
                </p>
              </div>
              <div
                className="bg-white rounded-lg shadow-sm"
                dangerouslySetInnerHTML={{ __html: previewHtml }}
              />
            </div>

            <div className="flex items-center justify-end gap-3 p-4 border-t border-gray-200 bg-gray-50">
              <button
                onClick={() => setShowPreview(false)}
                className="px-4 py-2 text-gray-600 hover:text-gray-800"
              >
                Close
              </button>
              <button
                onClick={() => {
                  setShowPreview(false);
                  handleSend();
                }}
                disabled={isSending || selectedRecipients.length === 0}
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                <Send className="w-4 h-4" />
                Send Email
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
