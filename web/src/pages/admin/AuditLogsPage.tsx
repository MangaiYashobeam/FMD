import { useState, useEffect } from 'react';
import {
  Activity,
  User,
  Building2,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Eye,
  Download,
  XCircle,
} from 'lucide-react';
import { adminApi } from '../../lib/api';

interface AuditLog {
  id: string;
  userId: string;
  action: string;
  entityType: string;
  entityId: string;
  metadata?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
  createdAt: string;
  user?: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
  };
}

const actionColors: Record<string, { bg: string; text: string }> = {
  USER_REGISTERED: { bg: 'bg-green-100', text: 'text-green-700' },
  USER_LOGIN: { bg: 'bg-blue-100', text: 'text-blue-700' },
  USER_LOGOUT: { bg: 'bg-gray-100', text: 'text-gray-700' },
  ACCOUNT_CREATED: { bg: 'bg-green-100', text: 'text-green-700' },
  ACCOUNT_UPDATED: { bg: 'bg-yellow-100', text: 'text-yellow-700' },
  ACCOUNT_DELETED: { bg: 'bg-red-100', text: 'text-red-700' },
  ACCOUNT_ACTIVATED: { bg: 'bg-green-100', text: 'text-green-700' },
  ACCOUNT_DEACTIVATED: { bg: 'bg-red-100', text: 'text-red-700' },
  USER_ROLE_UPDATED: { bg: 'bg-purple-100', text: 'text-purple-700' },
  VEHICLE_POSTED: { bg: 'bg-blue-100', text: 'text-blue-700' },
  SUBSCRIPTION_UPDATED: { bg: 'bg-indigo-100', text: 'text-indigo-700' },
  PAYMENT_RECEIVED: { bg: 'bg-emerald-100', text: 'text-emerald-700' },
};

export default function AuditLogsPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [actionFilter, setActionFilter] = useState('all');
  const [entityFilter, setEntityFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);
  const limit = 20;

  useEffect(() => {
    loadLogs();
  }, [page, actionFilter, entityFilter]);

  const loadLogs = async () => {
    try {
      setIsLoading(true);
      const response = await adminApi.getAuditLogs({
        limit,
        offset: (page - 1) * limit,
        action: actionFilter !== 'all' ? actionFilter : undefined,
      });
      setLogs(response.data.data || []);
      setTotal(response.data.pagination?.total || 0);
    } catch (err) {
      console.error('Failed to load audit logs:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const totalPages = Math.ceil(total / limit);

  const actionBadge = (action: string) => {
    const colors = actionColors[action] || { bg: 'bg-gray-100', text: 'text-gray-700' };
    return (
      <span
        className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${colors.bg} ${colors.text}`}
      >
        {action.replace(/_/g, ' ')}
      </span>
    );
  };

  const entityIcon = (entityType: string) => {
    switch (entityType.toLowerCase()) {
      case 'user':
        return <User className="w-4 h-4 text-blue-600" />;
      case 'account':
        return <Building2 className="w-4 h-4 text-purple-600" />;
      default:
        return <Activity className="w-4 h-4 text-gray-600" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Audit Logs</h1>
          <p className="text-gray-500 mt-1">Track all system activities</p>
        </div>
        <button className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors">
          <Download className="w-4 h-4" />
          Export Logs
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
        <div className="flex flex-col md:flex-row gap-4">
          <select
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            className="px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="all">All Actions</option>
            <option value="USER_REGISTERED">User Registered</option>
            <option value="USER_LOGIN">User Login</option>
            <option value="ACCOUNT_CREATED">Account Created</option>
            <option value="ACCOUNT_ACTIVATED">Account Activated</option>
            <option value="ACCOUNT_DEACTIVATED">Account Deactivated</option>
            <option value="ACCOUNT_DELETED">Account Deleted</option>
            <option value="USER_ROLE_UPDATED">Role Updated</option>
            <option value="VEHICLE_POSTED">Vehicle Posted</option>
            <option value="PAYMENT_RECEIVED">Payment Received</option>
          </select>
          <select
            value={entityFilter}
            onChange={(e) => setEntityFilter(e.target.value)}
            className="px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="all">All Entities</option>
            <option value="user">User</option>
            <option value="account">Account</option>
            <option value="vehicle">Vehicle</option>
            <option value="payment">Payment</option>
          </select>
        </div>
      </div>

      {/* Audit Logs Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                  User
                </th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Action
                </th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Entity
                </th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Date
                </th>
                <th className="text-right px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Details
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center">
                    <div className="flex items-center justify-center">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                    </div>
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                    No audit logs found
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center">
                          <User className="w-4 h-4 text-gray-600" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-900">
                            {log.user?.firstName} {log.user?.lastName}
                          </p>
                          <p className="text-xs text-gray-500">{log.user?.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">{actionBadge(log.action)}</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        {entityIcon(log.entityType)}
                        <span className="text-sm text-gray-600">{log.entityType}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2 text-sm text-gray-500">
                        <Calendar className="w-4 h-4" />
                        {new Date(log.createdAt).toLocaleString()}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-end">
                        <button
                          onClick={() => setSelectedLog(log)}
                          className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="View Details"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
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
              Showing {(page - 1) * limit + 1} to {Math.min(page * limit, total)} of {total} logs
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

      {/* Log Details Modal */}
      {selectedLog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-100">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold text-gray-900">Audit Log Details</h2>
                <button
                  onClick={() => setSelectedLog(null)}
                  className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"
                >
                  <XCircle className="w-5 h-5" />
                </button>
              </div>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-500">User</p>
                  <p className="text-gray-900 font-medium">
                    {selectedLog.user?.firstName} {selectedLog.user?.lastName}
                  </p>
                  <p className="text-sm text-gray-500">{selectedLog.user?.email}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Action</p>
                  <div className="mt-1">{actionBadge(selectedLog.action)}</div>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Entity Type</p>
                  <p className="text-gray-900">{selectedLog.entityType}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Entity ID</p>
                  <code className="text-xs text-gray-600 bg-gray-100 px-2 py-1 rounded">
                    {selectedLog.entityId}
                  </code>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Timestamp</p>
                  <p className="text-gray-900">{new Date(selectedLog.createdAt).toLocaleString()}</p>
                </div>
                {selectedLog.ipAddress && (
                  <div>
                    <p className="text-sm text-gray-500">IP Address</p>
                    <p className="text-gray-900">{selectedLog.ipAddress}</p>
                  </div>
                )}
              </div>

              {selectedLog.metadata && Object.keys(selectedLog.metadata).length > 0 && (
                <div>
                  <p className="text-sm text-gray-500 mb-2">Metadata</p>
                  <pre className="bg-gray-50 p-4 rounded-lg text-sm text-gray-700 overflow-x-auto">
                    {JSON.stringify(selectedLog.metadata, null, 2)}
                  </pre>
                </div>
              )}

              {selectedLog.userAgent && (
                <div>
                  <p className="text-sm text-gray-500 mb-1">User Agent</p>
                  <p className="text-xs text-gray-600 bg-gray-50 p-2 rounded break-all">
                    {selectedLog.userAgent}
                  </p>
                </div>
              )}

              <div className="flex justify-end pt-4">
                <button
                  onClick={() => setSelectedLog(null)}
                  className="py-2 px-4 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
