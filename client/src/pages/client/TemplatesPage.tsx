import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/services/api';
import { FileText, Plus, Edit, Trash2 } from 'lucide-react';

interface Template {
  id: string;
  name: string;
  content: string;
  variables: string[];
  isDefault: boolean;
  createdAt: string;
}

export const TemplatesPage: React.FC = () => {
  const [showModal, setShowModal] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);
  const [formData, setFormData] = useState({ name: '', content: '' });
  const queryClient = useQueryClient();

  const { data: templates, isLoading } = useQuery({
    queryKey: ['templates'],
    queryFn: async () => {
      const response = await api.get<{ success: boolean; data: Template[] }>('/accounts/settings/templates');
      return response.data.data || [];
    },
  });

  const saveTemplateMutation = useMutation({
    mutationFn: async (data: typeof formData & { id?: string }) => {
      if (data.id) {
        return api.put(`/accounts/settings/templates/${data.id}`, data);
      }
      return api.post('/accounts/settings/templates', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['templates'] });
      setShowModal(false);
      setEditingTemplate(null);
      setFormData({ name: '', content: '' });
    },
  });

  const deleteTemplateMutation = useMutation({
    mutationFn: async (id: string) => {
      return api.delete(`/accounts/settings/templates/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['templates'] });
    },
  });

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    saveTemplateMutation.mutate({
      ...formData,
      id: editingTemplate?.id,
    });
  };

  const handleEdit = (template: Template) => {
    setEditingTemplate(template);
    setFormData({ name: template.name, content: template.content });
    setShowModal(true);
  };

  const handleNew = () => {
    setEditingTemplate(null);
    setFormData({ name: '', content: '' });
    setShowModal(true);
  };

  if (isLoading) {
    return <div className="flex items-center justify-center h-64">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Templates</h1>
          <p className="mt-1 text-sm text-gray-500">
            Create and manage vehicle description templates
          </p>
        </div>
        <button
          onClick={handleNew}
          className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700"
        >
          <Plus className="h-4 w-4 mr-2" />
          New Template
        </button>
      </div>

      {/* Templates Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {templates?.map((template) => (
          <div key={template.id} className="bg-white shadow rounded-lg p-6">
            <div className="flex items-start justify-between">
              <div className="flex items-center">
                <FileText className="h-8 w-8 text-primary-600" />
                <div className="ml-3">
                  <h3 className="text-lg font-medium text-gray-900">{template.name}</h3>
                  {template.isDefault && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                      Default
                    </span>
                  )}
                </div>
              </div>
              <div className="flex space-x-2">
                <button
                  onClick={() => handleEdit(template)}
                  className="text-gray-400 hover:text-gray-500"
                >
                  <Edit className="h-4 w-4" />
                </button>
                {!template.isDefault && (
                  <button
                    onClick={() => {
                      if (confirm('Delete this template?')) {
                        deleteTemplateMutation.mutate(template.id);
                      }
                    }}
                    className="text-red-400 hover:text-red-500"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>
            <div className="mt-4">
              <p className="text-sm text-gray-500 line-clamp-3">{template.content}</p>
            </div>
            {template.variables && template.variables.length > 0 && (
              <div className="mt-4">
                <p className="text-xs text-gray-500">Variables:</p>
                <div className="mt-1 flex flex-wrap gap-1">
                  {template.variables.map((v) => (
                    <span key={v} className="inline-flex items-center px-2 py-0.5 rounded text-xs font-mono bg-gray-100 text-gray-800">
                      {`{{${v}}}`}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {(!templates || templates.length === 0) && (
        <div className="text-center py-12 bg-white shadow rounded-lg">
          <FileText className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900">No templates</h3>
          <p className="mt-1 text-sm text-gray-500">Get started by creating a new template.</p>
        </div>
      )}

      {/* Template Modal */}
      {showModal && (
        <div className="fixed z-10 inset-0 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4">
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75" onClick={() => setShowModal(false)}></div>
            
            <div className="relative bg-white rounded-lg max-w-2xl w-full p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                {editingTemplate ? 'Edit Template' : 'New Template'}
              </h3>
              
              <form onSubmit={handleSave} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Template Name</label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm px-3 py-2 border"
                    placeholder="e.g., Standard Vehicle Description"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Template Content</label>
                  <textarea
                    required
                    rows={10}
                    value={formData.content}
                    onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm px-3 py-2 border font-mono text-sm"
                    placeholder="{{year}} {{make}} {{model}} - {{description}}"
                  />
                  <p className="mt-2 text-xs text-gray-500">
                    Use variables like {`{{year}}, {{make}}, {{model}}, {{price}}, {{mileage}}, {{description}}`}
                  </p>
                </div>

                <div className="flex justify-end space-x-3 mt-6">
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={saveTemplateMutation.isPending}
                    className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 disabled:opacity-50"
                  >
                    {saveTemplateMutation.isPending ? 'Saving...' : 'Save Template'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
