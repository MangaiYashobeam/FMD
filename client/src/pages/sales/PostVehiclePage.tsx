import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import api from '@/services/api';
import { ArrowLeft, Send, AlertCircle } from 'lucide-react';

interface Vehicle {
  id: string;
  vin: string;
  stockNumber: string;
  year: number;
  make: string;
  model: string;
  trim?: string;
  price: number;
  mileage: number;
  color?: string;
  description?: string;
  imageUrl?: string;
}

interface Template {
  id: string;
  name: string;
  content: string;
  isDefault: boolean;
}

export const PostVehiclePage: React.FC = () => {
  const { vehicleId } = useParams<{ vehicleId: string }>();
  const navigate = useNavigate();
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [customDescription, setCustomDescription] = useState('');
  const [useExtension, setUseExtension] = useState(true);

  const { data: vehicle } = useQuery({
    queryKey: ['vehicle', vehicleId],
    queryFn: async () => {
      const response = await api.get<{ success: boolean; data: Vehicle }>(`/vehicles/${vehicleId}`);
      return response.data.data;
    },
  });

  const { data: templates } = useQuery({
    queryKey: ['templates'],
    queryFn: async () => {
      const response = await api.get<{ success: boolean; data: Template[] }>('/accounts/settings/templates');
      return response.data.data;
    },
  });

  const { data: hasCredentials } = useQuery({
    queryKey: ['fbCredentials'],
    queryFn: async () => {
      const response = await api.get<{ success: boolean; data: { hasCredentials: boolean } }>('/users/me/credentials/status');
      return response.data.data.hasCredentials;
    },
  });

  const postMutation = useMutation({
    mutationFn: async (data: { vehicleId: string; description: string; method: 'extension' | 'api' }) => {
      return api.post('/facebook/post', data);
    },
    onSuccess: () => {
      navigate('/sales/posts');
    },
  });

  const handleSubmit = () => {
    if (!vehicle) return;

    let description = customDescription;
    
    // If template is selected, use it and replace variables
    if (selectedTemplateId) {
      const template = templates?.find(t => t.id === selectedTemplateId);
      if (template) {
        description = template.content
          .replace(/\{\{year\}\}/g, vehicle.year.toString())
          .replace(/\{\{make\}\}/g, vehicle.make)
          .replace(/\{\{model\}\}/g, vehicle.model)
          .replace(/\{\{price\}\}/g, vehicle.price.toString())
          .replace(/\{\{mileage\}\}/g, vehicle.mileage.toString())
          .replace(/\{\{description\}\}/g, vehicle.description || '');
      }
    }

    postMutation.mutate({
      vehicleId: vehicle.id,
      description,
      method: useExtension ? 'extension' : 'api',
    });
  };

  if (!vehicle) {
    return <div className="flex items-center justify-center h-64">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center">
        <button
          onClick={() => navigate('/sales/vehicles')}
          className="mr-4 text-gray-600 hover:text-gray-900"
        >
          <ArrowLeft className="h-6 w-6" />
        </button>
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Post Vehicle</h1>
          <p className="mt-1 text-sm text-gray-500">Create a Facebook Marketplace post</p>
        </div>
      </div>

      {!hasCredentials && (
        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4">
          <div className="flex">
            <AlertCircle className="h-5 w-5 text-yellow-400" />
            <div className="ml-3">
              <p className="text-sm text-yellow-700">
                You haven't configured your Facebook credentials yet.{' '}
                <a href="/sales/settings" className="font-medium underline text-yellow-700 hover:text-yellow-600">
                  Configure now
                </a>
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Vehicle Preview */}
        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4">Vehicle Details</h2>
          
          {vehicle.imageUrl && (
            <img
              src={vehicle.imageUrl}
              alt={`${vehicle.year} ${vehicle.make} ${vehicle.model}`}
              className="w-full h-48 object-cover rounded-lg mb-4"
            />
          )}

          <div className="space-y-3">
            <div>
              <h3 className="text-xl font-semibold text-gray-900">
                {vehicle.year} {vehicle.make} {vehicle.model}
              </h3>
              {vehicle.trim && (
                <p className="text-sm text-gray-500">{vehicle.trim}</p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-500">Stock #:</span>
                <span className="ml-2 font-medium text-gray-900">{vehicle.stockNumber}</span>
              </div>
              <div>
                <span className="text-gray-500">VIN:</span>
                <span className="ml-2 font-medium text-gray-900">{vehicle.vin}</span>
              </div>
              <div>
                <span className="text-gray-500">Mileage:</span>
                <span className="ml-2 font-medium text-gray-900">{vehicle.mileage.toLocaleString()} mi</span>
              </div>
              <div>
                <span className="text-gray-500">Color:</span>
                <span className="ml-2 font-medium text-gray-900">{vehicle.color || 'N/A'}</span>
              </div>
            </div>

            <div className="pt-3 border-t">
              <span className="text-2xl font-bold text-primary-600">${vehicle.price.toLocaleString()}</span>
            </div>
          </div>
        </div>

        {/* Post Configuration */}
        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4">Post Configuration</h2>

          <div className="space-y-4">
            {/* Template Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Description Template
              </label>
              <select
                value={selectedTemplateId}
                onChange={(e) => setSelectedTemplateId(e.target.value)}
                className="block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm rounded-md"
              >
                <option value="">Custom description</option>
                {templates?.map(template => (
                  <option key={template.id} value={template.id}>
                    {template.name} {template.isDefault && '(Default)'}
                  </option>
                ))}
              </select>
            </div>

            {/* Custom Description */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Description
              </label>
              <textarea
                rows={10}
                value={customDescription}
                onChange={(e) => setCustomDescription(e.target.value)}
                placeholder="Enter vehicle description..."
                className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
                disabled={!!selectedTemplateId}
              />
              <p className="mt-1 text-xs text-gray-500">
                {selectedTemplateId 
                  ? 'Template selected. Deselect to write custom description.' 
                  : 'Available variables: {{year}}, {{make}}, {{model}}, {{price}}, {{mileage}}'}
              </p>
            </div>

            {/* Posting Method */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Posting Method
              </label>
              <div className="space-y-2">
                <div className="flex items-center">
                  <input
                    type="radio"
                    id="extension"
                    checked={useExtension}
                    onChange={() => setUseExtension(true)}
                    className="focus:ring-primary-500 h-4 w-4 text-primary-600 border-gray-300"
                  />
                  <label htmlFor="extension" className="ml-3 block text-sm text-gray-700">
                    Chrome Extension (Personal Facebook Marketplace)
                  </label>
                </div>
                <div className="flex items-center">
                  <input
                    type="radio"
                    id="api"
                    checked={!useExtension}
                    onChange={() => setUseExtension(false)}
                    className="focus:ring-primary-500 h-4 w-4 text-primary-600 border-gray-300"
                  />
                  <label htmlFor="api" className="ml-3 block text-sm text-gray-700">
                    Facebook API (Groups only)
                  </label>
                </div>
              </div>
            </div>

            {/* Submit Button */}
            <button
              onClick={handleSubmit}
              disabled={postMutation.isPending || !hasCredentials}
              className="w-full inline-flex justify-center items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Send className="h-4 w-4 mr-2" />
              {postMutation.isPending ? 'Posting...' : 'Post to Facebook'}
            </button>

            {postMutation.isError && (
              <div className="rounded-md bg-red-50 p-4">
                <p className="text-sm text-red-800">Failed to post vehicle. Please try again.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
