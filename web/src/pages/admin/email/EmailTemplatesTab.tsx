import { useState, useEffect, useCallback } from 'react';
import {
  Mail,
  Plus,
  Edit2,
  Trash2,
  Eye,
  Search,
  Loader2,
  Save,
  X,
  Download,
  RefreshCw,
  AlertCircle,
} from 'lucide-react';

interface EmailTemplate {
  id: string;
  name: string;
  slug: string;
  subject: string;
  htmlContent: string;
  textContent?: string;
  variables: string[];
  description?: string;
  isActive: boolean;
  isSystem: boolean;
  createdAt: string;
  updatedAt: string;
}

interface FormData {
  name: string;
  slug: string;
  subject: string;
  htmlContent: string;
  textContent: string;
  description: string;
  variables: string;
  isActive: boolean;
}

// Input sanitization
const sanitizeSlug = (input: string): string => {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 50);
};

export default function EmailTemplatesTab() {
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState<EmailTemplate | null>(null);
  const [showEditor, setShowEditor] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [previewHtml, setPreviewHtml] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isSeeding, setIsSeeding] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Form state for editor
  const [formData, setFormData] = useState<FormData>({
    name: '',
    slug: '',
    subject: '',
    htmlContent: '',
    textContent: '',
    description: '',
    variables: '',
    isActive: true,
  });

  // Preview variables
  const [previewVariables, setPreviewVariables] = useState<Record<string, string>>({});

  const loadTemplates = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/admin/email-templates', {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      const data = await response.json();
      if (data.success) {
        setTemplates(data.data?.templates || []);
      }
    } catch (error) {
      console.error('Failed to load templates:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTemplates();
  }, [loadTemplates]);

  const handleCreate = () => {
    setFormData({
      name: '',
      slug: '',
      subject: '',
      htmlContent: '',
      textContent: '',
      description: '',
      variables: '',
      isActive: true,
    });
    setSelectedTemplate(null);
    setErrorMessage('');
    setShowEditor(true);
  };

  const handleEdit = (template: EmailTemplate) => {
    setFormData({
      name: template.name,
      slug: template.slug,
      subject: template.subject,
      htmlContent: template.htmlContent,
      textContent: template.textContent || '',
      description: template.description || '',
      variables: template.variables.join(', '),
      isActive: template.isActive,
    });
    setSelectedTemplate(template);
    setErrorMessage('');
    setShowEditor(true);
  };

  const handleSave = async () => {
    // Validation
    if (!formData.name.trim()) {
      setErrorMessage('Template name is required');
      return;
    }
    if (!formData.slug.trim()) {
      setErrorMessage('Template slug is required');
      return;
    }
    if (!formData.subject.trim()) {
      setErrorMessage('Subject line is required');
      return;
    }
    if (!formData.htmlContent.trim()) {
      setErrorMessage('HTML content is required');
      return;
    }

    try {
      setIsSaving(true);
      setErrorMessage('');

      const payload = {
        name: formData.name.trim(),
        slug: sanitizeSlug(formData.slug),
        subject: formData.subject.trim(),
        htmlContent: formData.htmlContent,
        textContent: formData.textContent.trim() || undefined,
        description: formData.description.trim() || undefined,
        variables: formData.variables
          .split(',')
          .map((v) => v.trim())
          .filter(Boolean),
        isActive: formData.isActive,
      };

      const url = selectedTemplate
        ? `/api/admin/email-templates/${selectedTemplate.id}`
        : '/api/admin/email-templates';

      const response = await fetch(url, {
        method: selectedTemplate ? 'PUT' : 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (data.success) {
        setShowEditor(false);
        loadTemplates();
      } else {
        setErrorMessage(data.error || 'Failed to save template');
      }
    } catch (error) {
      console.error('Failed to save template:', error);
      setErrorMessage('Failed to save template. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (template: EmailTemplate) => {
    if (template.isSystem) {
      alert('System templates cannot be deleted');
      return;
    }

    if (!confirm(`Delete template "${template.name}"?`)) return;

    try {
      const response = await fetch(`/api/admin/email-templates/${template.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      const data = await response.json();

      if (data.success) {
        loadTemplates();
      } else {
        alert(data.error || 'Failed to delete template');
      }
    } catch (error) {
      console.error('Failed to delete template:', error);
      alert('Failed to delete template');
    }
  };

  const handlePreview = (template: EmailTemplate) => {
    setSelectedTemplate(template);

    // Set default preview variables
    const defaultVars: Record<string, string> = {};
    template.variables.forEach((v) => {
      defaultVars[v] = `{{${v}}}`;
    });
    setPreviewVariables(defaultVars);

    // Generate preview
    let html = template.htmlContent;
    Object.entries(defaultVars).forEach(([key, value]) => {
      const regex = new RegExp(`{{\\s*${key}\\s*}}`, 'g');
      html = html.replace(regex, value);
    });
    setPreviewHtml(html);
    setShowPreview(true);
  };

  const updatePreview = () => {
    if (!selectedTemplate) return;
    let html = selectedTemplate.htmlContent;
    Object.entries(previewVariables).forEach(([key, value]) => {
      const regex = new RegExp(`{{\\s*${key}\\s*}}`, 'g');
      html = html.replace(regex, value || `{{${key}}}`);
    });
    setPreviewHtml(html);
  };

  const handleSeedDefaults = async () => {
    if (
      !confirm(
        'Seed default system email templates? This will create templates that do not already exist.'
      )
    )
      return;

    try {
      setIsSeeding(true);
      const response = await fetch('/api/email/templates/seed-defaults', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
      });
      const data = await response.json();

      if (data.success) {
        alert(data.message || 'Default templates created successfully');
        loadTemplates();
      } else {
        alert(data.error || 'Failed to seed templates');
      }
    } catch (error) {
      console.error('Failed to seed templates:', error);
      alert('Failed to seed default templates');
    } finally {
      setIsSeeding(false);
    }
  };

  const filteredTemplates = templates.filter(
    (t) =>
      t.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.slug.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.subject.toLowerCase().includes(searchTerm.toLowerCase())
  );

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
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-4 text-sm text-gray-500">
            <span>
              <strong className="text-gray-700">{templates.length}</strong> templates
            </span>
            <span>
              <strong className="text-green-600">{templates.filter((t) => t.isActive).length}</strong>{' '}
              active
            </span>
            <span>
              <strong className="text-purple-600">{templates.filter((t) => t.isSystem).length}</strong>{' '}
              system
            </span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleSeedDefaults}
            disabled={isSeeding}
            className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
          >
            {isSeeding ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Download className="w-4 h-4" />
            )}
            Seed Defaults
          </button>
          <button
            onClick={handleCreate}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            New Template
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="bg-gray-50 rounded-xl p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search templates by name, slug, or subject..."
            className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
      </div>

      {/* Templates Grid */}
      {filteredTemplates.length === 0 ? (
        <div className="bg-gray-50 rounded-xl p-12 text-center">
          <Mail className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No templates found</h3>
          <p className="text-gray-500 mb-4">
            {searchTerm
              ? 'Try a different search term'
              : 'Create your first email template or seed defaults'}
          </p>
          {!searchTerm && (
            <button
              onClick={handleSeedDefaults}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              <Download className="w-4 h-4" />
              Seed Default Templates
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredTemplates.map((template) => (
            <div
              key={template.id}
              className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Mail className="w-5 h-5 text-blue-600" />
                  <span
                    className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                      template.isSystem
                        ? 'bg-purple-100 text-purple-700'
                        : 'bg-gray-100 text-gray-700'
                    }`}
                  >
                    {template.isSystem ? 'System' : 'Custom'}
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                      template.isActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                    }`}
                  >
                    {template.isActive ? 'Active' : 'Inactive'}
                  </span>
                </div>
              </div>

              <h3 className="font-semibold text-gray-900 mb-1">{template.name}</h3>
              <p className="text-sm text-gray-500 mb-2 font-mono">{template.slug}</p>
              <p className="text-sm text-gray-600 mb-3 line-clamp-2">{template.subject}</p>

              {template.description && (
                <p className="text-xs text-gray-500 mb-3 line-clamp-2">{template.description}</p>
              )}

              {template.variables.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-4">
                  {template.variables.slice(0, 4).map((v) => (
                    <span
                      key={v}
                      className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded text-xs font-mono"
                    >
                      {`{{${v}}}`}
                    </span>
                  ))}
                  {template.variables.length > 4 && (
                    <span className="px-2 py-0.5 bg-gray-50 text-gray-500 rounded text-xs">
                      +{template.variables.length - 4} more
                    </span>
                  )}
                </div>
              )}

              <div className="flex items-center gap-2 pt-3 border-t border-gray-100">
                <button
                  onClick={() => handlePreview(template)}
                  className="flex-1 inline-flex items-center justify-center gap-1 px-3 py-1.5 text-sm text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                >
                  <Eye className="w-4 h-4" />
                  Preview
                </button>
                <button
                  onClick={() => handleEdit(template)}
                  className="flex-1 inline-flex items-center justify-center gap-1 px-3 py-1.5 text-sm text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                >
                  <Edit2 className="w-4 h-4" />
                  Edit
                </button>
                {!template.isSystem && (
                  <button
                    onClick={() => handleDelete(template)}
                    className="inline-flex items-center justify-center p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Editor Modal */}
      {showEditor && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">
                {selectedTemplate ? 'Edit Template' : 'Create Template'}
              </h2>
              <button
                onClick={() => setShowEditor(false)}
                className="p-2 text-gray-400 hover:text-gray-600 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {errorMessage && (
                <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                  <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
                  <p className="text-sm text-red-700">{errorMessage}</p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Template Name *
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Welcome Email"
                    maxLength={100}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Slug * (unique identifier)
                  </label>
                  <input
                    type="text"
                    value={formData.slug}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        slug: sanitizeSlug(e.target.value),
                      })
                    }
                    placeholder="welcome-email"
                    maxLength={50}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 font-mono"
                    disabled={selectedTemplate?.isSystem}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Subject Line *
                </label>
                <input
                  type="text"
                  value={formData.subject}
                  onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                  placeholder="Welcome to DealersFace! 🚗"
                  maxLength={500}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Use variables like {'{{userName}}'} in the subject
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <input
                  type="text"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Sent to new users upon registration"
                  maxLength={200}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Variables (comma-separated)
                </label>
                <input
                  type="text"
                  value={formData.variables}
                  onChange={(e) => setFormData({ ...formData, variables: e.target.value })}
                  placeholder="userName, userEmail, tempPassword, loginUrl"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 font-mono"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Variables that can be replaced when sending
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  HTML Content *
                </label>
                <textarea
                  value={formData.htmlContent}
                  onChange={(e) => setFormData({ ...formData, htmlContent: e.target.value })}
                  rows={12}
                  placeholder="<h1>Welcome {{userName}}!</h1>..."
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Plain Text Content (optional fallback)
                </label>
                <textarea
                  value={formData.textContent}
                  onChange={(e) => setFormData({ ...formData, textContent: e.target.value })}
                  rows={4}
                  placeholder="Welcome {{userName}}!..."
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="isActive"
                  checked={formData.isActive}
                  onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                  className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                />
                <label htmlFor="isActive" className="text-sm text-gray-700">
                  Template is active
                </label>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 p-4 border-t border-gray-200 bg-gray-50">
              <button
                onClick={() => setShowEditor(false)}
                className="px-4 py-2 text-gray-600 hover:text-gray-800"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Save Template
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Preview Modal */}
      {showPreview && selectedTemplate && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">
                  Preview: {selectedTemplate.name}
                </h2>
                <p className="text-sm text-gray-500 font-mono">{selectedTemplate.slug}</p>
              </div>
              <button
                onClick={() => setShowPreview(false)}
                className="p-2 text-gray-400 hover:text-gray-600 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-hidden flex">
              {/* Variables Panel */}
              <div className="w-64 border-r border-gray-200 p-4 overflow-y-auto bg-gray-50">
                <h3 className="text-sm font-medium text-gray-700 mb-3">Test Variables</h3>
                <div className="space-y-3">
                  {selectedTemplate.variables.map((v) => (
                    <div key={v}>
                      <label className="block text-xs text-gray-500 mb-1 font-mono">{`{{${v}}}`}</label>
                      <input
                        type="text"
                        value={previewVariables[v] || ''}
                        onChange={(e) => {
                          setPreviewVariables({ ...previewVariables, [v]: e.target.value });
                        }}
                        placeholder={`Enter ${v}`}
                        className="w-full px-2 py-1.5 text-sm border border-gray-200 rounded focus:ring-1 focus:ring-blue-500"
                      />
                    </div>
                  ))}
                </div>
                <button
                  onClick={updatePreview}
                  className="w-full mt-4 inline-flex items-center justify-center gap-2 px-3 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700"
                >
                  <RefreshCw className="w-4 h-4" />
                  Update Preview
                </button>
              </div>

              {/* Preview Panel */}
              <div className="flex-1 overflow-y-auto p-4">
                <div className="mb-4 p-3 bg-gray-100 rounded-lg">
                  <p className="text-sm">
                    <strong>Subject:</strong>{' '}
                    {selectedTemplate.subject.replace(
                      /\{\{(\w+)\}\}/g,
                      (_, key) => previewVariables[key] || `{{${key}}}`
                    )}
                  </p>
                </div>
                <div className="prose max-w-none" dangerouslySetInnerHTML={{ __html: previewHtml }} />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
