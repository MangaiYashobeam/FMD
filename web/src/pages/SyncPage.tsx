import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { syncApi } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import {
  RefreshCw,
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Settings,
  ChevronRight,
  Loader2,
  FileText,
  Database,
  ArrowDownToLine,
  Upload,
  File,
} from 'lucide-react';
import { cn } from '../lib/utils';

interface SyncJob {
  id: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  type: 'full' | 'incremental';
  startedAt: string;
  completedAt?: string;
  vehiclesProcessed: number;
  vehiclesAdded: number;
  vehiclesUpdated: number;
  vehiclesRemoved: number;
  errors: string[];
}

// SyncSettings interface reserved for future use

function StatusIcon({ status }: { status: string }) {
  switch (status) {
    case 'completed':
      return <CheckCircle className="w-5 h-5 text-green-500" />;
    case 'failed':
      return <XCircle className="w-5 h-5 text-red-500" />;
    case 'running':
      return <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />;
    default:
      return <Clock className="w-5 h-5 text-yellow-500" />;
  }
}

function SyncJobCard({ job }: { job: SyncJob }) {
  const duration = job.completedAt
    ? Math.round(
        (new Date(job.completedAt).getTime() - new Date(job.startedAt).getTime()) / 1000
      )
    : null;

  return (
    <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <StatusIcon status={job.status} />
          <div>
            <p className="font-medium text-gray-900 capitalize">{job.type} Sync</p>
            <p className="text-sm text-gray-500">
              {new Date(job.startedAt).toLocaleString()}
            </p>
          </div>
        </div>
        <span
          className={cn(
            'px-2 py-1 text-xs font-medium rounded-full capitalize',
            job.status === 'completed' && 'bg-green-100 text-green-700',
            job.status === 'failed' && 'bg-red-100 text-red-700',
            job.status === 'running' && 'bg-blue-100 text-blue-700',
            job.status === 'pending' && 'bg-yellow-100 text-yellow-700'
          )}
        >
          {job.status}
        </span>
      </div>

      {job.status === 'completed' || job.status === 'failed' ? (
        <div className="mt-4 grid grid-cols-4 gap-4">
          <div className="text-center">
            <p className="text-lg font-semibold text-gray-900">{job.vehiclesProcessed}</p>
            <p className="text-xs text-gray-500">Processed</p>
          </div>
          <div className="text-center">
            <p className="text-lg font-semibold text-green-600">+{job.vehiclesAdded}</p>
            <p className="text-xs text-gray-500">Added</p>
          </div>
          <div className="text-center">
            <p className="text-lg font-semibold text-blue-600">{job.vehiclesUpdated}</p>
            <p className="text-xs text-gray-500">Updated</p>
          </div>
          <div className="text-center">
            <p className="text-lg font-semibold text-red-600">-{job.vehiclesRemoved}</p>
            <p className="text-xs text-gray-500">Removed</p>
          </div>
        </div>
      ) : null}

      {duration && (
        <p className="mt-3 text-xs text-gray-500">Duration: {duration}s</p>
      )}

      {job.errors && job.errors.length > 0 && (
        <div className="mt-3 p-2 bg-red-50 rounded border border-red-200">
          <div className="flex items-center gap-2 text-red-700">
            <AlertTriangle className="w-4 h-4" />
            <p className="text-sm font-medium">{job.errors.length} error(s)</p>
          </div>
          <ul className="mt-1 text-xs text-red-600 space-y-1">
            {job.errors.slice(0, 3).map((error, i) => (
              <li key={i}>• {error}</li>
            ))}
            {job.errors.length > 3 && (
              <li>• ... and {job.errors.length - 3} more</li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}

export default function SyncPage() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const accountId = user?.accounts?.[0]?.id;
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadOptions, setUploadOptions] = useState({
    skipHeader: true,
    updateExisting: true,
    markMissingSold: false,
    delimiter: 'comma' as 'comma' | 'semicolon' | 'tab',
  });
  const [uploadResult, setUploadResult] = useState<{
    success: boolean;
    imported: number;
    updated: number;
    failed: number;
    message: string;
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch sync history (only poll if there's a running job)
  const { data, isLoading, error } = useQuery({
    queryKey: ['sync-history'],
    queryFn: async () => {
      const response = await syncApi.getHistory();
      return response.data;
    },
    refetchInterval: (query) => {
      // Only poll every 5s if there's a running job, otherwise 30s
      const jobs = query.state.data?.data?.jobs || [];
      const hasRunningJob = jobs.some((j: SyncJob) => j.status === 'running');
      return hasRunningJob ? 5000 : 30000;
    },
    staleTime: 5000,
  });

  const jobs: SyncJob[] = data?.data?.jobs || [];
  const currentJob = jobs.find((j) => j.status === 'running');
  const lastJob = jobs.find((j) => j.status === 'completed' || j.status === 'failed');

  // Trigger sync mutation
  const triggerSyncMutation = useMutation({
    mutationFn: async (_type: 'full' | 'incremental') => {
      return syncApi.triggerSync();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sync-history'] });
    },
  });

  // File upload mutation with improved error handling
  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      // Validate account selection
      if (!accountId) {
        throw new Error('No account selected. Please ensure you are logged in and have an active account.');
      }
      
      // Validate file type
      const allowedTypes = ['.csv', '.xlsx', '.xls', '.xml'];
      const fileExt = file.name.toLowerCase().substring(file.name.lastIndexOf('.'));
      if (!allowedTypes.includes(fileExt)) {
        throw new Error(`Invalid file type: ${fileExt}. Allowed: CSV, Excel (.xlsx, .xls), XML`);
      }
      
      // Validate file size (50MB max)
      const maxSize = 50 * 1024 * 1024;
      if (file.size > maxSize) {
        throw new Error(`File too large: ${(file.size / 1024 / 1024).toFixed(1)}MB. Maximum: 50MB`);
      }
      
      console.log('📤 Uploading file:', file.name, 'Size:', file.size, 'Account:', accountId);
      return syncApi.uploadFile(file, accountId, uploadOptions);
    },
    onSuccess: (response) => {
      const data = response.data.data || response.data;
      console.log('✅ Upload successful:', data);
      setUploadResult({
        success: true,
        imported: data.imported || 0,
        updated: data.updated || 0,
        failed: data.failed || 0,
        message: response.data.message || `Successfully processed ${data.imported || 0} new vehicles, ${data.updated || 0} updated`,
      });
      queryClient.invalidateQueries({ queryKey: ['sync-history'] });
      queryClient.invalidateQueries({ queryKey: ['vehicles'] });
    },
    onError: (error: any) => {
      console.error('❌ Upload failed:', error);
      
      // Extract meaningful error message
      let errorMessage = 'Upload failed. Please try again.';
      
      if (error.response?.status === 401) {
        errorMessage = 'Session expired. Please log in again.';
      } else if (error.response?.status === 403) {
        errorMessage = 'Access denied. You don\'t have permission to upload to this account.';
      } else if (error.response?.status === 404) {
        errorMessage = 'API endpoint not found. Please ensure the server is updated.';
      } else if (error.response?.status === 413) {
        errorMessage = 'File too large for server. Try a smaller file.';
      } else if (error.response?.status === 500) {
        errorMessage = error.response?.data?.error || 'Server error while processing file. Please check the file format.';
      } else if (error.response?.data?.error) {
        errorMessage = error.response.data.error;
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      setUploadResult({
        success: false,
        imported: 0,
        updated: 0,
        failed: 0,
        message: errorMessage,
      });
    },
  });

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setUploadFile(file);
      setUploadResult(null);
    }
  };

  const handleUpload = () => {
    if (uploadFile) {
      uploadMutation.mutate(uploadFile);
    }
  };

  const handleCloseUploadModal = () => {
    setShowUploadModal(false);
    setUploadFile(null);
    setUploadResult(null);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Data Sync</h1>
          <p className="text-gray-500">Sync your inventory from FTP/DMS feed</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowUploadModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition-colors"
          >
            <Upload className="w-4 h-4" />
            Upload CSV
          </button>
          <button
            onClick={() => setShowSettingsModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition-colors"
          >
            <Settings className="w-4 h-4" />
            Settings
          </button>
          <button
            onClick={() => triggerSyncMutation.mutate('incremental')}
            disabled={!!currentJob || triggerSyncMutation.isPending}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50"
          >
            {triggerSyncMutation.isPending || currentJob ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <RefreshCw className="w-5 h-5" />
            )}
            {currentJob ? 'Syncing...' : 'Sync Now'}
          </button>
        </div>
      </div>

      {/* Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
              <Database className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Last Sync</p>
              <p className="text-lg font-semibold text-gray-900">
                {lastJob
                  ? new Date(lastJob.completedAt || lastJob.startedAt).toLocaleString()
                  : 'Never'}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
              <CheckCircle className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Status</p>
              <p className="text-lg font-semibold text-gray-900">
                {currentJob ? 'Running' : lastJob?.status === 'failed' ? 'Last Failed' : 'Ready'}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
              <ArrowDownToLine className="w-6 h-6 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Last Imported</p>
              <p className="text-lg font-semibold text-gray-900">
                {lastJob?.vehiclesProcessed || 0} vehicles
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Current Sync Progress */}
      {currentJob && (
        <div className="bg-white rounded-xl shadow-sm border border-blue-200 p-6">
          <div className="flex items-center gap-4 mb-4">
            <Loader2 className="w-6 h-6 text-blue-600 animate-spin" />
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Sync in Progress</h3>
              <p className="text-gray-500">
                Started {new Date(currentJob.startedAt).toLocaleTimeString()}
              </p>
            </div>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-blue-600 h-2 rounded-full animate-pulse"
              style={{ width: '60%' }}
            ></div>
          </div>
          <p className="mt-2 text-sm text-gray-500">
            {currentJob.vehiclesProcessed} vehicles processed so far...
          </p>
        </div>
      )}

      {/* Quick Actions */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Sync Options</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <button
            onClick={() => triggerSyncMutation.mutate('incremental')}
            disabled={!!currentJob}
            className="flex items-center gap-4 p-4 rounded-lg border border-gray-200 hover:border-blue-300 hover:bg-blue-50 transition-colors text-left disabled:opacity-50"
          >
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <RefreshCw className="w-5 h-5 text-blue-600" />
            </div>
            <div className="flex-1">
              <p className="font-medium text-gray-900">Incremental Sync</p>
              <p className="text-sm text-gray-500">Only sync changed vehicles</p>
            </div>
            <ChevronRight className="w-5 h-5 text-gray-400" />
          </button>

          <button
            onClick={() => triggerSyncMutation.mutate('full')}
            disabled={!!currentJob}
            className="flex items-center gap-4 p-4 rounded-lg border border-gray-200 hover:border-blue-300 hover:bg-blue-50 transition-colors text-left disabled:opacity-50"
          >
            <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
              <Database className="w-5 h-5 text-purple-600" />
            </div>
            <div className="flex-1">
              <p className="font-medium text-gray-900">Full Sync</p>
              <p className="text-sm text-gray-500">Rebuild entire inventory</p>
            </div>
            <ChevronRight className="w-5 h-5 text-gray-400" />
          </button>
        </div>
      </div>

      {/* Sync History */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Sync History</h3>

        {isLoading ? (
          <div className="py-12 text-center">
            <Loader2 className="w-8 h-8 text-blue-600 animate-spin mx-auto" />
            <p className="mt-2 text-gray-500">Loading history...</p>
          </div>
        ) : error ? (
          <div className="py-12 text-center">
            <XCircle className="w-12 h-12 text-red-400 mx-auto" />
            <p className="mt-2 text-gray-500">Failed to load sync history</p>
          </div>
        ) : jobs.length === 0 ? (
          <div className="py-12 text-center">
            <FileText className="w-12 h-12 text-gray-300 mx-auto" />
            <h4 className="mt-4 text-lg font-medium text-gray-900">No sync history</h4>
            <p className="mt-1 text-gray-500">
              Run your first sync to see the history here
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {jobs.slice(0, 10).map((job) => (
              <SyncJobCard key={job.id} job={job} />
            ))}
          </div>
        )}
      </div>

      {/* Settings Modal */}
      {showSettingsModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Sync Settings</h3>

            <div className="space-y-4">
              <div className="flex items-center justify-between py-3 border-b border-gray-100">
                <div>
                  <p className="font-medium text-gray-900">Auto-sync</p>
                  <p className="text-sm text-gray-500">Automatically sync on schedule</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" className="sr-only peer" />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:ring-2 peer-focus:ring-blue-500 rounded-full peer peer-checked:bg-blue-600 transition-colors"></div>
                  <div className="absolute left-1 top-1 w-4 h-4 bg-white rounded-full transition-transform peer-checked:translate-x-5"></div>
                </label>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Sync Interval
                </label>
                <select className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
                  <option value="hourly">Every hour</option>
                  <option value="6hours">Every 6 hours</option>
                  <option value="12hours">Every 12 hours</option>
                  <option value="daily">Once per day</option>
                </select>
              </div>

              <div className="border-t border-gray-200 pt-4">
                <h4 className="font-medium text-gray-900 mb-3">FTP Connection</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Host
                    </label>
                    <input
                      type="text"
                      placeholder="ftp.example.com"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Port
                    </label>
                    <input
                      type="number"
                      placeholder="21"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Username
                    </label>
                    <input
                      type="text"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Password
                    </label>
                    <input
                      type="password"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                </div>
                <div className="mt-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    File Path
                  </label>
                  <input
                    type="text"
                    placeholder="/inventory/feed.xml"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowSettingsModal(false)}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => setShowSettingsModal(false)}
                className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
              >
                Save Settings
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Upload CSV Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Upload Inventory File</h3>

            {/* File Drop Zone */}
            <div
              onClick={() => fileInputRef.current?.click()}
              className={cn(
                'border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors',
                uploadFile
                  ? 'border-green-300 bg-green-50'
                  : 'border-gray-300 hover:border-blue-400 hover:bg-blue-50'
              )}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.xlsx,.xls,.xml"
                onChange={handleFileSelect}
                className="hidden"
              />
              {uploadFile ? (
                <div className="flex items-center justify-center gap-3">
                  <File className="w-8 h-8 text-green-600" />
                  <div className="text-left">
                    <p className="font-medium text-gray-900">{uploadFile.name}</p>
                    <p className="text-sm text-gray-500">
                      {(uploadFile.size / 1024).toFixed(1)} KB
                    </p>
                  </div>
                </div>
              ) : (
                <>
                  <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-600 mb-2">
                    Click to select or drag and drop your file
                  </p>
                  <p className="text-sm text-gray-500">
                    Supports CSV, Excel (.xlsx, .xls), and XML files
                  </p>
                </>
              )}
            </div>

            {/* Upload Options */}
            <div className="mt-6 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-gray-900">Skip Header Row</p>
                  <p className="text-sm text-gray-500">First row contains column names</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={uploadOptions.skipHeader}
                    onChange={(e) =>
                      setUploadOptions({ ...uploadOptions, skipHeader: e.target.checked })
                    }
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:ring-2 peer-focus:ring-blue-500 rounded-full peer peer-checked:bg-blue-600 transition-colors"></div>
                  <div className="absolute left-1 top-1 w-4 h-4 bg-white rounded-full transition-transform peer-checked:translate-x-5"></div>
                </label>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-gray-900">Update Existing</p>
                  <p className="text-sm text-gray-500">Update vehicles with matching VIN</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={uploadOptions.updateExisting}
                    onChange={(e) =>
                      setUploadOptions({ ...uploadOptions, updateExisting: e.target.checked })
                    }
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:ring-2 peer-focus:ring-blue-500 rounded-full peer peer-checked:bg-blue-600 transition-colors"></div>
                  <div className="absolute left-1 top-1 w-4 h-4 bg-white rounded-full transition-transform peer-checked:translate-x-5"></div>
                </label>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-gray-900">Mark Missing as Sold</p>
                  <p className="text-sm text-gray-500">Vehicles not in file will be marked sold</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={uploadOptions.markMissingSold}
                    onChange={(e) =>
                      setUploadOptions({ ...uploadOptions, markMissingSold: e.target.checked })
                    }
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:ring-2 peer-focus:ring-blue-500 rounded-full peer peer-checked:bg-blue-600 transition-colors"></div>
                  <div className="absolute left-1 top-1 w-4 h-4 bg-white rounded-full transition-transform peer-checked:translate-x-5"></div>
                </label>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  CSV Delimiter
                </label>
                <select
                  value={uploadOptions.delimiter}
                  onChange={(e) =>
                    setUploadOptions({
                      ...uploadOptions,
                      delimiter: e.target.value as 'comma' | 'semicolon' | 'tab',
                    })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="comma">Comma (,)</option>
                  <option value="semicolon">Semicolon (;)</option>
                  <option value="tab">Tab</option>
                </select>
              </div>
            </div>

            {/* Upload Result */}
            {uploadResult && (
              <div
                className={cn(
                  'mt-4 p-4 rounded-lg',
                  uploadResult.success
                    ? 'bg-green-50 border border-green-200'
                    : 'bg-red-50 border border-red-200'
                )}
              >
                <div className="flex items-center gap-2 mb-2">
                  {uploadResult.success ? (
                    <CheckCircle className="w-5 h-5 text-green-600" />
                  ) : (
                    <XCircle className="w-5 h-5 text-red-600" />
                  )}
                  <p
                    className={cn(
                      'font-medium',
                      uploadResult.success ? 'text-green-700' : 'text-red-700'
                    )}
                  >
                    {uploadResult.message}
                  </p>
                </div>
                {uploadResult.success && (
                  <div className="grid grid-cols-3 gap-4 text-center mt-3">
                    <div>
                      <p className="text-lg font-semibold text-green-600">
                        +{uploadResult.imported}
                      </p>
                      <p className="text-xs text-gray-500">Imported</p>
                    </div>
                    <div>
                      <p className="text-lg font-semibold text-blue-600">
                        {uploadResult.updated}
                      </p>
                      <p className="text-xs text-gray-500">Updated</p>
                    </div>
                    <div>
                      <p className="text-lg font-semibold text-red-600">
                        {uploadResult.failed}
                      </p>
                      <p className="text-xs text-gray-500">Failed</p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3 mt-6">
              <button
                onClick={handleCloseUploadModal}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition-colors"
              >
                {uploadResult?.success ? 'Close' : 'Cancel'}
              </button>
              {!uploadResult?.success && (
                <button
                  onClick={handleUpload}
                  disabled={!uploadFile || uploadMutation.isPending}
                  className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {uploadMutation.isPending ? (
                    <span className="flex items-center justify-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Uploading...
                    </span>
                  ) : (
                    'Upload & Process'
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
