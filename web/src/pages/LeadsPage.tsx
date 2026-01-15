import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { sanitizeString, sanitizeEmail, sanitizePhone } from '../lib/sanitize';
import {
  Users,
  Search,
  Filter,
  Phone,
  Mail,
  Calendar,
  Car,
  MoreHorizontal,
  CheckCircle,
  Clock,
  XCircle,
  ArrowUpRight,
  ChevronDown,
  Star,
  StarOff,
  Loader2,
  RefreshCw,
  Download,
  User,
} from 'lucide-react';
import { cn } from '../lib/utils';

// Types
interface Lead {
  id: string;
  name: string;
  email: string;
  phone: string;
  status: 'new' | 'contacted' | 'qualified' | 'converted' | 'lost';
  source: 'facebook' | 'website' | 'referral' | 'walk_in' | 'phone';
  priority: 'low' | 'medium' | 'high';
  vehicleInterest?: {
    id: string;
    year: number;
    make: string;
    model: string;
    price: number;
  };
  assignedTo?: {
    id: string;
    name: string;
  };
  notes?: string;
  lastContactedAt?: string;
  createdAt: string;
  isStarred?: boolean;
}

// Status configuration
const statusConfig = {
  new: { label: 'New', color: 'bg-blue-100 text-blue-700', icon: Clock },
  contacted: { label: 'Contacted', color: 'bg-yellow-100 text-yellow-700', icon: Phone },
  qualified: { label: 'Qualified', color: 'bg-purple-100 text-purple-700', icon: CheckCircle },
  converted: { label: 'Converted', color: 'bg-green-100 text-green-700', icon: CheckCircle },
  lost: { label: 'Lost', color: 'bg-gray-100 text-gray-500', icon: XCircle },
};

const sourceConfig = {
  facebook: { label: 'Facebook', color: 'bg-blue-500' },
  website: { label: 'Website', color: 'bg-green-500' },
  referral: { label: 'Referral', color: 'bg-purple-500' },
  walk_in: { label: 'Walk-in', color: 'bg-orange-500' },
  phone: { label: 'Phone', color: 'bg-gray-500' },
};

const priorityConfig = {
  low: { label: 'Low', color: 'text-gray-500' },
  medium: { label: 'Medium', color: 'text-yellow-600' },
  high: { label: 'High', color: 'text-red-600' },
};

export default function LeadsPage() {
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [sourceFilter, setSourceFilter] = useState<string>('all');
  const [showFilters, setShowFilters] = useState(false);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [showLeadModal, setShowLeadModal] = useState(false);

  // Fetch leads
  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['leads', statusFilter, sourceFilter],
    queryFn: async () => {
      const params: Record<string, string> = {};
      if (statusFilter !== 'all') params.status = statusFilter;
      if (sourceFilter !== 'all') params.source = sourceFilter;
      
      const response = await api.get('/api/leads', { params });
      return response.data;
    },
  });

  // Mock leads for demo (remove when backend is ready)
  const mockLeads: Lead[] = [
    {
      id: '1',
      name: 'John Smith',
      email: 'john.smith@email.com',
      phone: '(555) 123-4567',
      status: 'new',
      source: 'facebook',
      priority: 'high',
      vehicleInterest: { id: 'v1', year: 2024, make: 'Toyota', model: 'Camry', price: 28500 },
      createdAt: new Date().toISOString(),
      isStarred: true,
    },
    {
      id: '2',
      name: 'Sarah Johnson',
      email: 'sarah.j@email.com',
      phone: '(555) 987-6543',
      status: 'contacted',
      source: 'website',
      priority: 'medium',
      vehicleInterest: { id: 'v2', year: 2023, make: 'Honda', model: 'Accord', price: 32000 },
      lastContactedAt: new Date(Date.now() - 86400000).toISOString(),
      createdAt: new Date(Date.now() - 172800000).toISOString(),
    },
    {
      id: '3',
      name: 'Mike Davis',
      email: 'mdavis@email.com',
      phone: '(555) 456-7890',
      status: 'qualified',
      source: 'referral',
      priority: 'high',
      vehicleInterest: { id: 'v3', year: 2024, make: 'Ford', model: 'F-150', price: 45000 },
      assignedTo: { id: 'u1', name: 'Sales Rep' },
      lastContactedAt: new Date(Date.now() - 43200000).toISOString(),
      createdAt: new Date(Date.now() - 604800000).toISOString(),
    },
    {
      id: '4',
      name: 'Emily Wilson',
      email: 'emily.w@email.com',
      phone: '(555) 321-0987',
      status: 'converted',
      source: 'facebook',
      priority: 'medium',
      vehicleInterest: { id: 'v4', year: 2023, make: 'Chevrolet', model: 'Silverado', price: 48000 },
      createdAt: new Date(Date.now() - 1209600000).toISOString(),
    },
  ];

  const leads: Lead[] = data?.data?.leads || mockLeads;

  // Update lead status mutation
  const updateStatusMutation = useMutation({
    mutationFn: async ({ leadId, status }: { leadId: string; status: string }) => {
      return api.put(`/api/leads/${leadId}/status`, { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
    },
    onError: (error: any) => {
      console.error('Update status failed:', error?.response?.data || error.message);
    },
  });

  // Toggle star mutation
  const toggleStarMutation = useMutation({
    mutationFn: async ({ leadId, starred }: { leadId: string; starred: boolean }) => {
      return api.put(`/api/leads/${leadId}`, { isStarred: starred });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
    },
    onError: (error: any) => {
      console.error('Toggle star failed:', error?.response?.data || error.message);
    },
  });

  // Filter leads by search
  const filteredLeads = useMemo(() => {
    if (!searchQuery) return leads;
    
    const sanitizedQuery = sanitizeString(searchQuery).toLowerCase();
    return leads.filter(lead => 
      lead.name.toLowerCase().includes(sanitizedQuery) ||
      lead.email.toLowerCase().includes(sanitizedQuery) ||
      lead.phone.includes(sanitizedQuery) ||
      lead.vehicleInterest?.make.toLowerCase().includes(sanitizedQuery) ||
      lead.vehicleInterest?.model.toLowerCase().includes(sanitizedQuery)
    );
  }, [leads, searchQuery]);

  // Stats
  const stats = useMemo(() => ({
    total: leads.length,
    new: leads.filter(l => l.status === 'new').length,
    contacted: leads.filter(l => l.status === 'contacted').length,
    qualified: leads.filter(l => l.status === 'qualified').length,
    converted: leads.filter(l => l.status === 'converted').length,
  }), [leads]);

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffHours < 1) return 'Just now';
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = sanitizeString(e.target.value, { maxLength: 100 });
    setSearchQuery(value);
  };

  const handleViewLead = (lead: Lead) => {
    setSelectedLead(lead);
    setShowLeadModal(true);
  };

  const handleExportLeads = () => {
    // Generate CSV export
    const headers = ['Name', 'Email', 'Phone', 'Status', 'Source', 'Vehicle Interest', 'Created'];
    const rows = filteredLeads.map(lead => [
      sanitizeString(lead.name),
      sanitizeEmail(lead.email),
      sanitizePhone(lead.phone),
      lead.status,
      lead.source,
      lead.vehicleInterest ? `${lead.vehicleInterest.year} ${lead.vehicleInterest.make} ${lead.vehicleInterest.model}` : '',
      new Date(lead.createdAt).toLocaleDateString(),
    ]);

    const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `leads-export-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Leads Management</h1>
          <p className="text-gray-500">Track and manage customer inquiries from Facebook and other sources</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="inline-flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <RefreshCw className={cn('w-4 h-4', isFetching && 'animate-spin')} />
            Refresh
          </button>
          <button
            onClick={handleExportLeads}
            className="inline-flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <Download className="w-4 h-4" />
            Export
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
              <Users className="w-5 h-5 text-gray-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
              <p className="text-sm text-gray-500">Total Leads</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <Clock className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{stats.new}</p>
              <p className="text-sm text-gray-500">New</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-yellow-100 rounded-lg flex items-center justify-center">
              <Phone className="w-5 h-5 text-yellow-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{stats.contacted}</p>
              <p className="text-sm text-gray-500">Contacted</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
              <CheckCircle className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{stats.qualified}</p>
              <p className="text-sm text-gray-500">Qualified</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
              <ArrowUpRight className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{stats.converted}</p>
              <p className="text-sm text-gray-500">Converted</p>
            </div>
          </div>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={handleSearchChange}
              placeholder="Search leads by name, email, phone, or vehicle..."
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div className="flex gap-2">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="all">All Status</option>
              {Object.entries(statusConfig).map(([key, config]) => (
                <option key={key} value={key}>{config.label}</option>
              ))}
            </select>
            <select
              value={sourceFilter}
              onChange={(e) => setSourceFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="all">All Sources</option>
              {Object.entries(sourceConfig).map(([key, config]) => (
                <option key={key} value={key}>{config.label}</option>
              ))}
            </select>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={cn(
                'inline-flex items-center gap-2 px-3 py-2 border rounded-lg transition-colors',
                showFilters ? 'bg-blue-50 border-blue-500 text-blue-700' : 'border-gray-300 hover:bg-gray-50'
              )}
            >
              <Filter className="w-4 h-4" />
              Filters
              <ChevronDown className={cn('w-4 h-4 transition-transform', showFilters && 'rotate-180')} />
            </button>
          </div>
        </div>

        {/* Expanded Filters */}
        {showFilters && (
          <div className="mt-4 pt-4 border-t border-gray-100 grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
              <select className="w-full px-3 py-2 border border-gray-300 rounded-lg">
                <option value="all">All</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Date Range</label>
              <select className="w-full px-3 py-2 border border-gray-300 rounded-lg">
                <option value="all">All Time</option>
                <option value="today">Today</option>
                <option value="week">This Week</option>
                <option value="month">This Month</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Assigned To</label>
              <select className="w-full px-3 py-2 border border-gray-300 rounded-lg">
                <option value="all">All</option>
                <option value="unassigned">Unassigned</option>
                <option value="me">Assigned to Me</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Starred</label>
              <select className="w-full px-3 py-2 border border-gray-300 rounded-lg">
                <option value="all">All</option>
                <option value="starred">Starred Only</option>
              </select>
            </div>
          </div>
        )}
      </div>

      {/* Leads List */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          </div>
        ) : filteredLeads.length === 0 ? (
          <div className="text-center py-12">
            <Users className="w-12 h-12 mx-auto text-gray-300 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No leads found</h3>
            <p className="text-gray-500">
              {searchQuery ? 'Try adjusting your search or filters' : 'Leads will appear here when customers inquire from Facebook'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {filteredLeads.map((lead) => {
              return (
                <div
                  key={lead.id}
                  className="p-4 hover:bg-gray-50 transition-colors cursor-pointer"
                  onClick={() => handleViewLead(lead)}
                >
                  <div className="flex items-start gap-4">
                    {/* Star Button */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleStarMutation.mutate({ leadId: lead.id, starred: !lead.isStarred });
                      }}
                      className="mt-1 text-gray-400 hover:text-yellow-500 transition-colors"
                    >
                      {lead.isStarred ? (
                        <Star className="w-5 h-5 text-yellow-500 fill-yellow-500" />
                      ) : (
                        <StarOff className="w-5 h-5" />
                      )}
                    </button>

                    {/* Lead Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold text-gray-900 truncate">{lead.name}</h3>
                        <span className={cn('px-2 py-0.5 text-xs font-medium rounded-full', statusConfig[lead.status].color)}>
                          {statusConfig[lead.status].label}
                        </span>
                        <span className={cn('text-xs font-medium', priorityConfig[lead.priority].color)}>
                          {priorityConfig[lead.priority].label} Priority
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500 mb-2">
                        <span className="flex items-center gap-1">
                          <Mail className="w-4 h-4" />
                          {lead.email}
                        </span>
                        <span className="flex items-center gap-1">
                          <Phone className="w-4 h-4" />
                          {lead.phone}
                        </span>
                        <span className="flex items-center gap-1">
                          <div className={cn('w-2 h-2 rounded-full', sourceConfig[lead.source].color)} />
                          {sourceConfig[lead.source].label}
                        </span>
                      </div>

                      {/* Vehicle Interest */}
                      {lead.vehicleInterest && (
                        <div className="flex items-center gap-2 text-sm">
                          <Car className="w-4 h-4 text-gray-400" />
                          <span className="text-gray-700">
                            {lead.vehicleInterest.year} {lead.vehicleInterest.make} {lead.vehicleInterest.model}
                          </span>
                          <span className="font-medium text-green-600">
                            {formatCurrency(lead.vehicleInterest.price)}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Right Side Info */}
                    <div className="text-right">
                      <p className="text-sm text-gray-500 mb-1">
                        <Calendar className="w-4 h-4 inline mr-1" />
                        {formatDate(lead.createdAt)}
                      </p>
                      {lead.lastContactedAt && (
                        <p className="text-xs text-gray-400">
                          Last contact: {formatDate(lead.lastContactedAt)}
                        </p>
                      )}
                      {lead.assignedTo && (
                        <p className="text-xs text-gray-400 mt-1">
                          <User className="w-3 h-3 inline mr-1" />
                          {lead.assignedTo.name}
                        </p>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          window.location.href = `tel:${lead.phone}`;
                        }}
                        className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title="Call"
                      >
                        <Phone className="w-5 h-5" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          window.location.href = `mailto:${lead.email}`;
                        }}
                        className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title="Email"
                      >
                        <Mail className="w-5 h-5" />
                      </button>
                      <button
                        onClick={(e) => e.stopPropagation()}
                        className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                      >
                        <MoreHorizontal className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Lead Detail Modal */}
      {showLeadModal && selectedLead && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
            <div
              className="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75"
              onClick={() => setShowLeadModal(false)}
            />
            <div className="relative inline-block w-full max-w-2xl px-4 pt-5 pb-4 overflow-hidden text-left align-bottom transition-all transform bg-white rounded-xl shadow-xl sm:my-8 sm:align-middle sm:p-6">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h2 className="text-xl font-bold text-gray-900">{selectedLead.name}</h2>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={cn('px-2 py-0.5 text-xs font-medium rounded-full', statusConfig[selectedLead.status].color)}>
                      {statusConfig[selectedLead.status].label}
                    </span>
                    <span className="text-sm text-gray-500">
                      Added {formatDate(selectedLead.createdAt)}
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => setShowLeadModal(false)}
                  className="p-2 text-gray-400 hover:text-gray-600 rounded-lg"
                >
                  <XCircle className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-6">
                {/* Contact Info */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-500 mb-1">Email</label>
                    <p className="text-gray-900">{selectedLead.email}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-500 mb-1">Phone</label>
                    <p className="text-gray-900">{selectedLead.phone}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-500 mb-1">Source</label>
                    <p className="text-gray-900">{sourceConfig[selectedLead.source].label}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-500 mb-1">Priority</label>
                    <p className={priorityConfig[selectedLead.priority].color}>{priorityConfig[selectedLead.priority].label}</p>
                  </div>
                </div>

                {/* Vehicle Interest */}
                {selectedLead.vehicleInterest && (
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <h3 className="font-medium text-gray-900 mb-2">Vehicle Interest</h3>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-lg font-semibold text-gray-900">
                          {selectedLead.vehicleInterest.year} {selectedLead.vehicleInterest.make} {selectedLead.vehicleInterest.model}
                        </p>
                      </div>
                      <p className="text-xl font-bold text-green-600">
                        {formatCurrency(selectedLead.vehicleInterest.price)}
                      </p>
                    </div>
                  </div>
                )}

                {/* Status Update */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Update Status</label>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(statusConfig).map(([key, config]) => (
                      <button
                        key={key}
                        onClick={() => updateStatusMutation.mutate({ leadId: selectedLead.id, status: key })}
                        disabled={updateStatusMutation.isPending}
                        className={cn(
                          'px-3 py-1.5 text-sm font-medium rounded-lg transition-colors',
                          selectedLead.status === key
                            ? config.color
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        )}
                      >
                        {config.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Notes */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Notes</label>
                  <textarea
                    rows={3}
                    placeholder="Add notes about this lead..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    defaultValue={selectedLead.notes}
                  />
                </div>

                {/* Actions */}
                <div className="flex justify-end gap-3 pt-4 border-t">
                  <button
                    onClick={() => setShowLeadModal(false)}
                    className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                  >
                    Close
                  </button>
                  <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                    Save Changes
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
