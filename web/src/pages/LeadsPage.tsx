/**
 * Leads Page - Comprehensive Lead Management with ADF Integration
 * Production-grade lead management system
 */

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import { sanitizeString, sanitizeEmail, sanitizePhone } from '../lib/sanitize';
import {
  Users,
  Search,
  Phone,
  Mail,
  Calendar,
  Car,
  CheckCircle,
  Clock,
  XCircle,
  Loader2,
  RefreshCw,
  Download,
  User,
  Plus,
  Send,
  MessageSquare,
  FileText,
  TrendingUp,
  ExternalLink,
  Trash2,
  X,
  ChevronRight,
} from 'lucide-react';
import { cn } from '../lib/utils';

// Types
interface Lead {
  id: string;
  leadNumber: string;
  firstName?: string;
  lastName?: string;
  fullName?: string;
  email?: string;
  phone?: string;
  altPhone?: string;
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
  status: LeadStatus;
  priority: LeadPriority;
  source: LeadSource;
  facebookUsername?: string;
  facebookDisplayName?: string;
  facebookProfileUrl?: string;
  vehicleId?: string;
  interestedVehicle?: string;
  interestedYear?: number;
  interestedMake?: string;
  interestedModel?: string;
  hasTradeIn: boolean;
  tradeYear?: number;
  tradeMake?: string;
  tradeModel?: string;
  customerComments?: string;
  internalNotes?: string;
  adfSent: boolean;
  adfSentAt?: string;
  assignedToId?: string;
  assignedTo?: {
    id: string;
    firstName?: string;
    lastName?: string;
    email: string;
  };
  vehicle?: {
    id: string;
    year: number;
    make: string;
    model: string;
    trim?: string;
    stockNumber?: string;
    listPrice?: number;
  };
  nextFollowUpAt?: string;
  appointmentAt?: string;
  lastContactedAt?: string;
  createdAt: string;
  updatedAt: string;
  _count?: {
    communications: number;
    activities: number;
  };
}

type LeadStatus = 'NEW' | 'ASSIGNED' | 'CONTACTED' | 'QUALIFIED' | 'APPOINTMENT' | 'NEGOTIATING' | 'WON' | 'LOST' | 'ARCHIVED';
type LeadPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
type LeadSource = 'FACEBOOK_MARKETPLACE' | 'FACEBOOK_PAGE' | 'WEBSITE' | 'WALK_IN' | 'PHONE' | 'EMAIL' | 'REFERRAL' | 'THIRD_PARTY' | 'ADF_IMPORT' | 'MANUAL';

// Status configuration
const statusConfig: Record<LeadStatus, { label: string; color: string; bgColor: string; icon: any }> = {
  NEW: { label: 'New', color: 'text-blue-700', bgColor: 'bg-blue-100', icon: Clock },
  ASSIGNED: { label: 'Assigned', color: 'text-indigo-700', bgColor: 'bg-indigo-100', icon: User },
  CONTACTED: { label: 'Contacted', color: 'text-yellow-700', bgColor: 'bg-yellow-100', icon: Phone },
  QUALIFIED: { label: 'Qualified', color: 'text-purple-700', bgColor: 'bg-purple-100', icon: CheckCircle },
  APPOINTMENT: { label: 'Appointment', color: 'text-cyan-700', bgColor: 'bg-cyan-100', icon: Calendar },
  NEGOTIATING: { label: 'Negotiating', color: 'text-orange-700', bgColor: 'bg-orange-100', icon: TrendingUp },
  WON: { label: 'Won', color: 'text-green-700', bgColor: 'bg-green-100', icon: CheckCircle },
  LOST: { label: 'Lost', color: 'text-gray-700', bgColor: 'bg-gray-100', icon: XCircle },
  ARCHIVED: { label: 'Archived', color: 'text-gray-500', bgColor: 'bg-gray-50', icon: FileText },
};

const sourceConfig: Record<LeadSource, { label: string; color: string }> = {
  FACEBOOK_MARKETPLACE: { label: 'FB Marketplace', color: 'bg-blue-500' },
  FACEBOOK_PAGE: { label: 'Facebook', color: 'bg-blue-600' },
  WEBSITE: { label: 'Website', color: 'bg-green-500' },
  WALK_IN: { label: 'Walk-in', color: 'bg-orange-500' },
  PHONE: { label: 'Phone', color: 'bg-purple-500' },
  EMAIL: { label: 'Email', color: 'bg-red-500' },
  REFERRAL: { label: 'Referral', color: 'bg-teal-500' },
  THIRD_PARTY: { label: 'Third Party', color: 'bg-indigo-500' },
  ADF_IMPORT: { label: 'ADF Import', color: 'bg-cyan-500' },
  MANUAL: { label: 'Manual', color: 'bg-gray-500' },
};

const priorityConfig: Record<LeadPriority, { label: string; color: string; bgColor: string }> = {
  LOW: { label: 'Low', color: 'text-gray-600', bgColor: 'bg-gray-100' },
  MEDIUM: { label: 'Medium', color: 'text-yellow-600', bgColor: 'bg-yellow-100' },
  HIGH: { label: 'High', color: 'text-orange-600', bgColor: 'bg-orange-100' },
  URGENT: { label: 'Urgent', color: 'text-red-600', bgColor: 'bg-red-100' },
};

export default function LeadsPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const accountId = user?.accounts?.[0]?.id;
  
  // State
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [sourceFilter, setSourceFilter] = useState<string>('all');
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [showLeadModal, setShowLeadModal] = useState(false);
  const [showNewLeadModal, setShowNewLeadModal] = useState(false);
  const [showADFModal, setShowADFModal] = useState(false);
  const [page, setPage] = useState(1);
  const [activeLeadTab, setActiveLeadTab] = useState<'details' | 'activity' | 'communications'>('details');

  // New Lead Form State
  const [newLeadForm, setNewLeadForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    source: 'MANUAL' as LeadSource,
    priority: 'MEDIUM' as LeadPriority,
    interestedVehicle: '',
    customerComments: '',
  });

  // Fetch leads
  const { data: leadsData, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['leads', accountId, statusFilter, sourceFilter, searchQuery, page],
    queryFn: async () => {
      if (!accountId) return { data: { leads: [], pagination: { total: 0, pages: 0 } } };
      const params: Record<string, string | number> = { accountId, page, limit: 20 };
      if (statusFilter !== 'all') params.status = statusFilter;
      if (sourceFilter !== 'all') params.source = sourceFilter;
      if (searchQuery) params.search = searchQuery;
      const response = await api.get('/api/leads', { params });
      return response.data;
    },
    enabled: !!accountId,
  });

  // Fetch lead stats
  const { data: statsData } = useQuery({
    queryKey: ['lead-stats', accountId],
    queryFn: async () => {
      if (!accountId) return null;
      const response = await api.get('/api/leads/stats', { params: { accountId } });
      return response.data;
    },
    enabled: !!accountId,
  });

  // Fetch team members for assignment
  const { data: teamData } = useQuery({
    queryKey: ['team', accountId],
    queryFn: async () => {
      if (!accountId) return { data: { users: [] } };
      const response = await api.get('/api/accounts/users', { params: { accountId } });
      return response.data;
    },
    enabled: !!accountId,
  });

  // Create lead mutation
  const createLeadMutation = useMutation({
    mutationFn: async (data: any) => {
      return api.post('/api/leads', { ...data, accountId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      queryClient.invalidateQueries({ queryKey: ['lead-stats'] });
      setShowNewLeadModal(false);
      setNewLeadForm({
        firstName: '',
        lastName: '',
        email: '',
        phone: '',
        source: 'MANUAL',
        priority: 'MEDIUM',
        interestedVehicle: '',
        customerComments: '',
      });
    },
  });

  // Update lead mutation
  const updateLeadMutation = useMutation({
    mutationFn: async ({ leadId, data }: { leadId: string; data: any }) => {
      return api.patch(`/api/leads/${leadId}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      queryClient.invalidateQueries({ queryKey: ['lead-stats'] });
    },
  });

  // Send ADF mutation
  const sendADFMutation = useMutation({
    mutationFn: async ({ leadId, method, recipients }: { leadId: string; method: string; recipients?: string[] }) => {
      return api.post(`/api/leads/${leadId}/adf`, { method, recipients });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      setShowADFModal(false);
    },
  });

  // Delete lead mutation
  const deleteLeadMutation = useMutation({
    mutationFn: async (leadId: string) => {
      return api.delete(`/api/leads/${leadId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      queryClient.invalidateQueries({ queryKey: ['lead-stats'] });
      setSelectedLead(null);
      setShowLeadModal(false);
    },
  });

  const leads: Lead[] = leadsData?.data?.leads || [];
  const pagination = leadsData?.data?.pagination || { total: 0, pages: 0, page: 1 };
  const stats = statsData?.data?.overview || { total: 0, new: 0, assigned: 0, won: 0, lost: 0, conversionRate: 0 };
  const teamMembers = teamData?.data?.users || [];

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

  const getLeadName = (lead: Lead) => {
    if (lead.fullName) return lead.fullName;
    if (lead.firstName || lead.lastName) return `${lead.firstName || ''} ${lead.lastName || ''}`.trim();
    return lead.facebookDisplayName || 'Unknown';
  };

  const getVehicleInterest = (lead: Lead) => {
    if (lead.vehicle) {
      return `${lead.vehicle.year} ${lead.vehicle.make} ${lead.vehicle.model}`;
    }
    if (lead.interestedYear) {
      return `${lead.interestedYear} ${lead.interestedMake || ''} ${lead.interestedModel || ''}`.trim();
    }
    return lead.interestedVehicle || 'Not specified';
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = sanitizeString(e.target.value, { maxLength: 100 });
    setSearchQuery(value);
    setPage(1);
  };

  const handleExportLeads = () => {
    const headers = ['Lead #', 'Name', 'Email', 'Phone', 'Status', 'Source', 'Priority', 'Vehicle Interest', 'ADF Sent', 'Created'];
    const rows = leads.map(lead => [
      lead.leadNumber,
      getLeadName(lead),
      lead.email || '',
      lead.phone || '',
      statusConfig[lead.status]?.label || lead.status,
      sourceConfig[lead.source]?.label || lead.source,
      priorityConfig[lead.priority]?.label || lead.priority,
      getVehicleInterest(lead),
      lead.adfSent ? 'Yes' : 'No',
      new Date(lead.createdAt).toLocaleDateString(),
    ]);

    const csv = [headers, ...rows].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `leads-export-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Lead Details Modal Content
  const renderLeadDetails = () => {
    if (!selectedLead) return null;

    return (
      <div className="space-y-6">
        {/* Customer Info */}
        <div className="bg-gray-50 rounded-lg p-4">
          <h4 className="font-medium text-gray-900 mb-3">Customer Information</h4>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <span className="text-sm text-gray-500">Name</span>
              <p className="font-medium">{getLeadName(selectedLead)}</p>
            </div>
            <div>
              <span className="text-sm text-gray-500">Email</span>
              <p className="font-medium">{selectedLead.email || 'Not provided'}</p>
            </div>
            <div>
              <span className="text-sm text-gray-500">Phone</span>
              <p className="font-medium">{selectedLead.phone || 'Not provided'}</p>
            </div>
            <div>
              <span className="text-sm text-gray-500">Location</span>
              <p className="font-medium">
                {selectedLead.city && selectedLead.state 
                  ? `${selectedLead.city}, ${selectedLead.state} ${selectedLead.zip || ''}`
                  : 'Not provided'}
              </p>
            </div>
          </div>
          {selectedLead.facebookProfileUrl && (
            <a 
              href={selectedLead.facebookProfileUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-700 text-sm mt-3"
            >
              <ExternalLink className="w-4 h-4" />
              View Facebook Profile
            </a>
          )}
        </div>

        {/* Vehicle Interest */}
        <div className="bg-gray-50 rounded-lg p-4">
          <h4 className="font-medium text-gray-900 mb-3">Vehicle Interest</h4>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <span className="text-sm text-gray-500">Vehicle</span>
              <p className="font-medium">{getVehicleInterest(selectedLead)}</p>
            </div>
            {selectedLead.vehicle?.stockNumber && (
              <div>
                <span className="text-sm text-gray-500">Stock #</span>
                <p className="font-medium">{selectedLead.vehicle.stockNumber}</p>
              </div>
            )}
            {selectedLead.vehicle?.listPrice && (
              <div>
                <span className="text-sm text-gray-500">Price</span>
                <p className="font-medium">{formatCurrency(Number(selectedLead.vehicle.listPrice))}</p>
              </div>
            )}
          </div>
        </div>

        {/* Trade-In */}
        {selectedLead.hasTradeIn && (
          <div className="bg-yellow-50 rounded-lg p-4">
            <h4 className="font-medium text-yellow-900 mb-3">Trade-In Vehicle</h4>
            <p className="font-medium">
              {selectedLead.tradeYear} {selectedLead.tradeMake} {selectedLead.tradeModel}
            </p>
          </div>
        )}

        {/* Customer Comments */}
        {selectedLead.customerComments && (
          <div className="bg-gray-50 rounded-lg p-4">
            <h4 className="font-medium text-gray-900 mb-2">Customer Comments</h4>
            <p className="text-gray-700 whitespace-pre-wrap">{selectedLead.customerComments}</p>
          </div>
        )}

        {/* ADF Status */}
        <div className="bg-gray-50 rounded-lg p-4">
          <h4 className="font-medium text-gray-900 mb-3">ADF Status</h4>
          <div className="flex items-center justify-between">
            <div>
              {selectedLead.adfSent ? (
                <div className="flex items-center gap-2 text-green-600">
                  <CheckCircle className="w-5 h-5" />
                  <span>ADF sent on {new Date(selectedLead.adfSentAt!).toLocaleString()}</span>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-gray-500">
                  <Clock className="w-5 h-5" />
                  <span>ADF not sent yet</span>
                </div>
              )}
            </div>
            <button
              onClick={() => setShowADFModal(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Send className="w-4 h-4 inline-block mr-2" />
              Send ADF
            </button>
          </div>
        </div>
      </div>
    );
  };

  if (!accountId) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-500">Please set up your account first.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Lead Management</h1>
          <p className="text-gray-500">Track leads, manage communications, and send ADF to your DMS</p>
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
          <button
            onClick={() => setShowNewLeadModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Lead
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
              <Users className="w-5 h-5 text-gray-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
              <p className="text-sm text-gray-500">Total</p>
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
            <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center">
              <User className="w-5 h-5 text-indigo-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{stats.assigned}</p>
              <p className="text-sm text-gray-500">Assigned</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
              <CheckCircle className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{stats.won}</p>
              <p className="text-sm text-gray-500">Won</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
              <XCircle className="w-5 h-5 text-gray-500" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{stats.lost}</p>
              <p className="text-sm text-gray-500">Lost</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{stats.conversionRate}%</p>
              <p className="text-sm text-gray-500">Conv. Rate</p>
            </div>
          </div>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search leads by name, email, phone..."
              value={searchQuery}
              onChange={handleSearchChange}
              className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500"
            />
          </div>
          <div className="flex items-center gap-2">
            <select
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
              className="px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/50"
            >
              <option value="all">All Status</option>
              {Object.entries(statusConfig).map(([key, config]) => (
                <option key={key} value={key}>{config.label}</option>
              ))}
            </select>
            <select
              value={sourceFilter}
              onChange={(e) => { setSourceFilter(e.target.value); setPage(1); }}
              className="px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/50"
            >
              <option value="all">All Sources</option>
              {Object.entries(sourceConfig).map(([key, config]) => (
                <option key={key} value={key}>{config.label}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Leads Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          </div>
        ) : leads.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-gray-500">
            <Users className="w-12 h-12 mb-4 text-gray-300" />
            <p className="text-lg font-medium">No leads found</p>
            <p className="text-sm">Start by adding your first lead or sync from Facebook</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Lead</th>
                  <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Contact</th>
                  <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Vehicle Interest</th>
                  <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Source</th>
                  <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">ADF</th>
                  <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Created</th>
                  <th className="text-right px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {leads.map((lead) => (
                  <tr 
                    key={lead.id} 
                    className="hover:bg-gray-50 cursor-pointer transition-colors"
                    onClick={() => { setSelectedLead(lead); setShowLeadModal(true); }}
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-medium">
                          {getLeadName(lead).charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">{getLeadName(lead)}</p>
                          <p className="text-sm text-gray-500">#{lead.leadNumber}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="space-y-1">
                        {lead.email && (
                          <div className="flex items-center gap-1 text-sm text-gray-600">
                            <Mail className="w-4 h-4" />
                            <span className="truncate max-w-[150px]">{lead.email}</span>
                          </div>
                        )}
                        {lead.phone && (
                          <div className="flex items-center gap-1 text-sm text-gray-600">
                            <Phone className="w-4 h-4" />
                            <span>{lead.phone}</span>
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <Car className="w-4 h-4 text-gray-400" />
                        <span className="text-sm text-gray-900">{getVehicleInterest(lead)}</span>
                      </div>
                      {lead.vehicle?.listPrice && (
                        <p className="text-sm text-green-600 font-medium mt-1">
                          {formatCurrency(Number(lead.vehicle.listPrice))}
                        </p>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <span className={cn(
                        'inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium',
                        statusConfig[lead.status]?.bgColor,
                        statusConfig[lead.status]?.color
                      )}>
                        {(() => {
                          const StatusIcon = statusConfig[lead.status]?.icon;
                          return StatusIcon && <StatusIcon className="w-3 h-3" />;
                        })()}
                        {statusConfig[lead.status]?.label}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={cn(
                        'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium text-white',
                        sourceConfig[lead.source]?.color
                      )}>
                        {sourceConfig[lead.source]?.label}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      {lead.adfSent ? (
                        <span className="inline-flex items-center gap-1 text-green-600 text-sm">
                          <CheckCircle className="w-4 h-4" />
                          Sent
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-gray-400 text-sm">
                          <Clock className="w-4 h-4" />
                          Pending
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {formatDate(lead.createdAt)}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                        <select
                          value={lead.status}
                          onChange={(e) => updateLeadMutation.mutate({ leadId: lead.id, data: { status: e.target.value } })}
                          className="text-xs border border-gray-200 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                        >
                          {Object.entries(statusConfig).map(([key, config]) => (
                            <option key={key} value={key}>{config.label}</option>
                          ))}
                        </select>
                        <button
                          onClick={() => { setSelectedLead(lead); setShowADFModal(true); }}
                          className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                          title="Send ADF"
                        >
                          <Send className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {pagination.pages > 1 && (
          <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between">
            <p className="text-sm text-gray-500">
              Showing {(page - 1) * 20 + 1} to {Math.min(page * 20, pagination.total)} of {pagination.total} leads
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-1 border border-gray-200 rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
              >
                Previous
              </button>
              <span className="text-sm text-gray-600">Page {page} of {pagination.pages}</span>
              <button
                onClick={() => setPage(p => Math.min(pagination.pages, p + 1))}
                disabled={page >= pagination.pages}
                className="px-3 py-1 border border-gray-200 rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Lead Details Modal */}
      {showLeadModal && selectedLead && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-3xl max-h-[90vh] overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold text-gray-900">{getLeadName(selectedLead)}</h2>
                <p className="text-sm text-gray-500">Lead #{selectedLead.leadNumber}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className={cn(
                  'px-3 py-1 rounded-full text-sm font-medium',
                  priorityConfig[selectedLead.priority]?.bgColor,
                  priorityConfig[selectedLead.priority]?.color
                )}>
                  {priorityConfig[selectedLead.priority]?.label} Priority
                </span>
                <button
                  onClick={() => setShowLeadModal(false)}
                  className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="border-b border-gray-100">
              <nav className="flex px-6">
                {[
                  { id: 'details', label: 'Details', icon: FileText },
                  { id: 'activity', label: 'Activity', icon: Clock },
                  { id: 'communications', label: 'Communications', icon: MessageSquare },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveLeadTab(tab.id as any)}
                    className={cn(
                      'px-4 py-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2',
                      activeLeadTab === tab.id
                        ? 'border-blue-600 text-blue-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700'
                    )}
                  >
                    <tab.icon className="w-4 h-4" />
                    {tab.label}
                  </button>
                ))}
              </nav>
            </div>

            <div className="p-6 overflow-y-auto max-h-[60vh]">
              {activeLeadTab === 'details' && renderLeadDetails()}
              {activeLeadTab === 'activity' && (
                <div className="text-gray-500 text-center py-8">
                  Activity timeline coming soon...
                </div>
              )}
              {activeLeadTab === 'communications' && (
                <div className="text-gray-500 text-center py-8">
                  Communications log coming soon...
                </div>
              )}
            </div>

            <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between">
              <button
                onClick={() => {
                  if (confirm('Are you sure you want to delete this lead?')) {
                    deleteLeadMutation.mutate(selectedLead.id);
                  }
                }}
                className="px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
              >
                <Trash2 className="w-4 h-4 inline-block mr-2" />
                Delete Lead
              </button>
              <div className="flex items-center gap-2">
                <select
                  value={selectedLead.assignedToId || ''}
                  onChange={(e) => updateLeadMutation.mutate({ 
                    leadId: selectedLead.id, 
                    data: { assignedToId: e.target.value || null } 
                  })}
                  className="px-3 py-2 border border-gray-200 rounded-lg text-sm"
                >
                  <option value="">Unassigned</option>
                  {teamMembers.map((member: any) => (
                    <option key={member.id} value={member.id}>
                      {member.firstName} {member.lastName}
                    </option>
                  ))}
                </select>
                <button
                  onClick={() => setShowADFModal(true)}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <Send className="w-4 h-4 inline-block mr-2" />
                  Send ADF
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* New Lead Modal */}
      {showNewLeadModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-lg">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">Add New Lead</h2>
              <button
                onClick={() => setShowNewLeadModal(false)}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                createLeadMutation.mutate(newLeadForm);
              }}
              className="p-6 space-y-4"
            >
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">First Name</label>
                  <input
                    type="text"
                    value={newLeadForm.firstName}
                    onChange={(e) => setNewLeadForm(f => ({ ...f, firstName: sanitizeString(e.target.value) }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Last Name</label>
                  <input
                    type="text"
                    value={newLeadForm.lastName}
                    onChange={(e) => setNewLeadForm(f => ({ ...f, lastName: sanitizeString(e.target.value) }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input
                  type="email"
                  value={newLeadForm.email}
                  onChange={(e) => setNewLeadForm(f => ({ ...f, email: sanitizeEmail(e.target.value) }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                <input
                  type="tel"
                  value={newLeadForm.phone}
                  onChange={(e) => setNewLeadForm(f => ({ ...f, phone: sanitizePhone(e.target.value) }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Source</label>
                  <select
                    value={newLeadForm.source}
                    onChange={(e) => setNewLeadForm(f => ({ ...f, source: e.target.value as LeadSource }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                  >
                    {Object.entries(sourceConfig).map(([key, config]) => (
                      <option key={key} value={key}>{config.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
                  <select
                    value={newLeadForm.priority}
                    onChange={(e) => setNewLeadForm(f => ({ ...f, priority: e.target.value as LeadPriority }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                  >
                    {Object.entries(priorityConfig).map(([key, config]) => (
                      <option key={key} value={key}>{config.label}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Vehicle Interest</label>
                <input
                  type="text"
                  value={newLeadForm.interestedVehicle}
                  onChange={(e) => setNewLeadForm(f => ({ ...f, interestedVehicle: sanitizeString(e.target.value) }))}
                  placeholder="e.g., 2024 Toyota Camry"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Comments</label>
                <textarea
                  value={newLeadForm.customerComments}
                  onChange={(e) => setNewLeadForm(f => ({ ...f, customerComments: sanitizeString(e.target.value) }))}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                />
              </div>
              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowNewLeadModal(false)}
                  className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createLeadMutation.isPending}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                >
                  {createLeadMutation.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin inline-block mr-2" />
                  ) : (
                    <Plus className="w-4 h-4 inline-block mr-2" />
                  )}
                  Create Lead
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Send ADF Modal */}
      {showADFModal && selectedLead && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-md">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">Send ADF Lead</h2>
              <button
                onClick={() => setShowADFModal(false)}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="bg-blue-50 rounded-lg p-4">
                <h4 className="font-medium text-blue-900 mb-2">Lead Information</h4>
                <p className="text-sm text-blue-700">
                  <strong>Customer:</strong> {getLeadName(selectedLead)}<br />
                  <strong>Vehicle:</strong> {getVehicleInterest(selectedLead)}
                </p>
              </div>
              
              <div className="space-y-3">
                <button
                  onClick={() => sendADFMutation.mutate({ 
                    leadId: selectedLead.id, 
                    method: 'EMAIL',
                    recipients: []
                  })}
                  disabled={sendADFMutation.isPending}
                  className="w-full px-4 py-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors flex items-center justify-between"
                >
                  <div className="flex items-center gap-3">
                    <Mail className="w-5 h-5 text-blue-600" />
                    <div className="text-left">
                      <p className="font-medium text-gray-900">Send via Email</p>
                      <p className="text-sm text-gray-500">Send ADF XML to configured recipients</p>
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-gray-400" />
                </button>
                
                <button
                  onClick={() => sendADFMutation.mutate({ 
                    leadId: selectedLead.id, 
                    method: 'DMS'
                  })}
                  disabled={sendADFMutation.isPending}
                  className="w-full px-4 py-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors flex items-center justify-between"
                >
                  <div className="flex items-center gap-3">
                    <ExternalLink className="w-5 h-5 text-green-600" />
                    <div className="text-left">
                      <p className="font-medium text-gray-900">Send to DMS</p>
                      <p className="text-sm text-gray-500">Push directly to your dealer management system</p>
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-gray-400" />
                </button>
              </div>

              {sendADFMutation.isPending && (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
                  <span className="ml-2 text-gray-600">Sending ADF...</span>
                </div>
              )}

              {sendADFMutation.isError && (
                <div className="bg-red-50 text-red-700 px-4 py-3 rounded-lg text-sm">
                  Failed to send ADF. Please check your configuration.
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
