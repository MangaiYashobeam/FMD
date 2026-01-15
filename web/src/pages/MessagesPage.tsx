import { useState, useMemo, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { sanitizeString } from '../lib/sanitize';
import {
  MessageSquare,
  Search,
  Send,
  MoreHorizontal,
  Paperclip,
  Image,
  Smile,
  Check,
  CheckCheck,
  Clock,
  ArrowLeft,
  Facebook,
  User,
  Star,
  Archive,
  RefreshCw,
  Loader2,
  AlertCircle,
  Car,
  ExternalLink,
} from 'lucide-react';
import { cn } from '../lib/utils';

// Types
interface Conversation {
  id: string;
  contact: {
    id: string;
    name: string;
    avatar?: string;
    isOnline?: boolean;
  };
  lastMessage: {
    text: string;
    timestamp: string;
    isRead: boolean;
    isFromMe: boolean;
  };
  unreadCount: number;
  source: 'facebook' | 'messenger' | 'instagram';
  vehicleContext?: {
    id: string;
    year: number;
    make: string;
    model: string;
  };
  isStarred?: boolean;
  isArchived?: boolean;
}

interface Message {
  id: string;
  text: string;
  timestamp: string;
  isFromMe: boolean;
  status: 'sending' | 'sent' | 'delivered' | 'read' | 'failed';
  attachments?: {
    type: 'image' | 'file';
    url: string;
    name: string;
  }[];
}

// Source badge config
const sourceConfig = {
  facebook: { label: 'Facebook', icon: Facebook, color: 'text-blue-600 bg-blue-100' },
  messenger: { label: 'Messenger', icon: MessageSquare, color: 'text-purple-600 bg-purple-100' },
  instagram: { label: 'Instagram', icon: Image, color: 'text-pink-600 bg-pink-100' },
};

export default function MessagesPage() {
  const queryClient = useQueryClient();
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [messageText, setMessageText] = useState('');
  const [filterSource, setFilterSource] = useState<string>('all');
  const [showMobileChat, setShowMobileChat] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Fetch conversations
  const { data: conversationsData, isLoading: conversationsLoading, refetch: refetchConversations } = useQuery({
    queryKey: ['conversations', filterSource],
    queryFn: async () => {
      const params: Record<string, string> = {};
      if (filterSource !== 'all') params.source = filterSource;
      const response = await api.get('/api/messages/conversations', { params });
      return response.data;
    },
  });

  // Mock conversations for demo
  const mockConversations: Conversation[] = [
    {
      id: 'c1',
      contact: { id: 'u1', name: 'John Smith', isOnline: true },
      lastMessage: {
        text: 'Hi, I\'m interested in the 2024 Toyota Camry you posted. Is it still available?',
        timestamp: new Date().toISOString(),
        isRead: false,
        isFromMe: false,
      },
      unreadCount: 2,
      source: 'facebook',
      vehicleContext: { id: 'v1', year: 2024, make: 'Toyota', model: 'Camry' },
      isStarred: true,
    },
    {
      id: 'c2',
      contact: { id: 'u2', name: 'Sarah Johnson', isOnline: false },
      lastMessage: {
        text: 'Great, I\'ll come by tomorrow at 2pm for a test drive.',
        timestamp: new Date(Date.now() - 3600000).toISOString(),
        isRead: true,
        isFromMe: true,
      },
      unreadCount: 0,
      source: 'messenger',
      vehicleContext: { id: 'v2', year: 2023, make: 'Honda', model: 'Accord' },
    },
    {
      id: 'c3',
      contact: { id: 'u3', name: 'Mike Davis', isOnline: true },
      lastMessage: {
        text: 'What\'s your best price on the Ford F-150?',
        timestamp: new Date(Date.now() - 7200000).toISOString(),
        isRead: false,
        isFromMe: false,
      },
      unreadCount: 1,
      source: 'facebook',
      vehicleContext: { id: 'v3', year: 2024, make: 'Ford', model: 'F-150' },
    },
    {
      id: 'c4',
      contact: { id: 'u4', name: 'Emily Chen' },
      lastMessage: {
        text: 'Thank you for the quick response!',
        timestamp: new Date(Date.now() - 86400000).toISOString(),
        isRead: true,
        isFromMe: false,
      },
      unreadCount: 0,
      source: 'messenger',
    },
  ];

  const conversations = conversationsData?.data?.conversations || mockConversations;

  // Fetch messages for selected conversation
  const { data: messagesData, isLoading: messagesLoading } = useQuery({
    queryKey: ['messages', selectedConversation?.id],
    queryFn: async () => {
      if (!selectedConversation) return null;
      const response = await api.get(`/api/messages/conversations/${selectedConversation.id}`);
      return response.data;
    },
    enabled: !!selectedConversation,
  });

  // Mock messages for demo
  const mockMessages: Message[] = selectedConversation ? [
    {
      id: 'm1',
      text: 'Hi, I saw your listing for the ' + (selectedConversation.vehicleContext 
        ? `${selectedConversation.vehicleContext.year} ${selectedConversation.vehicleContext.make} ${selectedConversation.vehicleContext.model}` 
        : 'car') + '. Is it still available?',
      timestamp: new Date(Date.now() - 3600000).toISOString(),
      isFromMe: false,
      status: 'read',
    },
    {
      id: 'm2',
      text: 'Yes, it\'s still available! Would you like to schedule a test drive?',
      timestamp: new Date(Date.now() - 3500000).toISOString(),
      isFromMe: true,
      status: 'read',
    },
    {
      id: 'm3',
      text: 'That would be great! What times are available?',
      timestamp: new Date(Date.now() - 3400000).toISOString(),
      isFromMe: false,
      status: 'read',
    },
    {
      id: 'm4',
      text: 'We\'re open Monday-Saturday 9am-7pm. Would any of those times work for you?',
      timestamp: new Date(Date.now() - 3300000).toISOString(),
      isFromMe: true,
      status: 'read',
    },
    {
      id: 'm5',
      text: selectedConversation.lastMessage.text,
      timestamp: selectedConversation.lastMessage.timestamp,
      isFromMe: selectedConversation.lastMessage.isFromMe,
      status: selectedConversation.lastMessage.isRead ? 'read' : 'delivered',
    },
  ] : [];

  const messages = messagesData?.data?.messages || mockMessages;

  // Send message mutation
  const sendMessageMutation = useMutation({
    mutationFn: async ({ conversationId, text }: { conversationId: string; text: string }) => {
      return api.post(`/api/messages/conversations/${conversationId}`, { text });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['messages', selectedConversation?.id] });
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
    },
    onError: (error: any) => {
      console.error('Send message failed:', error?.response?.data || error.message);
    },
  });

  // Archive conversation mutation
  const archiveMutation = useMutation({
    mutationFn: async (conversationId: string) => {
      return api.put(`/api/messages/conversations/${conversationId}/archive`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
    },
    onError: (error: any) => {
      console.error('Archive conversation failed:', error?.response?.data || error.message);
    },
  });

  // Star conversation mutation
  const starMutation = useMutation({
    mutationFn: async ({ conversationId, starred }: { conversationId: string; starred: boolean }) => {
      return api.put(`/api/messages/conversations/${conversationId}`, { isStarred: starred });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
    },
    onError: (error: any) => {
      console.error('Star conversation failed:', error?.response?.data || error.message);
    },
  });

  // Filter conversations by search
  const filteredConversations = useMemo(() => {
    if (!searchQuery) return conversations;
    const query = sanitizeString(searchQuery).toLowerCase();
    return conversations.filter((conv: Conversation) =>
      conv.contact.name.toLowerCase().includes(query) ||
      conv.lastMessage.text.toLowerCase().includes(query) ||
      conv.vehicleContext?.make.toLowerCase().includes(query) ||
      conv.vehicleContext?.model.toLowerCase().includes(query)
    );
  }, [conversations, searchQuery]);

  // Scroll to bottom of messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Format timestamp
  const formatTimestamp = (dateStr: string, full = false) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (full) {
      return date.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      });
    }

    if (diffMins < 1) return 'Now';
    if (diffMins < 60) return `${diffMins}m`;
    if (diffHours < 24) return `${diffHours}h`;
    if (diffDays < 7) return `${diffDays}d`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  // Handle send message
  const handleSendMessage = () => {
    if (!messageText.trim() || !selectedConversation) return;

    const sanitizedMessage = sanitizeString(messageText, { maxLength: 2000 });
    sendMessageMutation.mutate({
      conversationId: selectedConversation.id,
      text: sanitizedMessage,
    });
    setMessageText('');
    inputRef.current?.focus();
  };

  // Handle key press in input
  const handleKeyPress = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Handle conversation select
  const handleSelectConversation = (conv: Conversation) => {
    setSelectedConversation(conv);
    setShowMobileChat(true);
  };

  // Stats
  const unreadCount = conversations.reduce((acc: number, conv: Conversation) => acc + conv.unreadCount, 0);

  // Message status icon
  const MessageStatus = ({ status }: { status: Message['status'] }) => {
    switch (status) {
      case 'sending':
        return <Clock className="w-3 h-3 text-gray-400" />;
      case 'sent':
        return <Check className="w-3 h-3 text-gray-400" />;
      case 'delivered':
        return <CheckCheck className="w-3 h-3 text-gray-400" />;
      case 'read':
        return <CheckCheck className="w-3 h-3 text-blue-500" />;
      case 'failed':
        return <AlertCircle className="w-3 h-3 text-red-500" />;
      default:
        return null;
    }
  };

  return (
    <div className="h-[calc(100vh-8rem)] flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Messages</h1>
          <p className="text-gray-500">
            {unreadCount > 0 ? `${unreadCount} unread messages` : 'Manage Facebook Marketplace conversations'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => refetchConversations()}
            className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <RefreshCw className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        {/* Conversations List */}
        <div className={cn(
          'w-full md:w-96 border-r border-gray-100 flex flex-col',
          showMobileChat && 'hidden md:flex'
        )}>
          {/* Search & Filter */}
          <div className="p-4 border-b border-gray-100">
            <div className="relative mb-3">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(sanitizeString(e.target.value, { maxLength: 100 }))}
                placeholder="Search conversations..."
                className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div className="flex gap-2">
              {['all', 'facebook', 'messenger'].map((source) => (
                <button
                  key={source}
                  onClick={() => setFilterSource(source)}
                  className={cn(
                    'px-3 py-1 text-xs font-medium rounded-full transition-colors',
                    filterSource === source
                      ? 'bg-blue-100 text-blue-700'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  )}
                >
                  {source === 'all' ? 'All' : source.charAt(0).toUpperCase() + source.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {/* Conversations */}
          <div className="flex-1 overflow-y-auto">
            {conversationsLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
              </div>
            ) : filteredConversations.length === 0 ? (
              <div className="text-center py-12 px-4">
                <MessageSquare className="w-12 h-12 mx-auto text-gray-300 mb-4" />
                <p className="text-gray-500">No conversations found</p>
              </div>
            ) : (
              filteredConversations.map((conv: Conversation) => {
                const SourceIcon = sourceConfig[conv.source].icon;
                return (
                  <div
                    key={conv.id}
                    onClick={() => handleSelectConversation(conv)}
                    className={cn(
                      'p-4 border-b border-gray-50 cursor-pointer transition-colors hover:bg-gray-50',
                      selectedConversation?.id === conv.id && 'bg-blue-50 hover:bg-blue-50'
                    )}
                  >
                    <div className="flex items-start gap-3">
                      {/* Avatar */}
                      <div className="relative flex-shrink-0">
                        <div className="w-12 h-12 bg-gray-200 rounded-full flex items-center justify-center">
                          {conv.contact.avatar ? (
                            <img src={conv.contact.avatar} alt="" className="w-full h-full rounded-full object-cover" />
                          ) : (
                            <User className="w-6 h-6 text-gray-500" />
                          )}
                        </div>
                        {conv.contact.isOnline && (
                          <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white rounded-full" />
                        )}
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-2">
                            <h3 className={cn(
                              'font-medium truncate',
                              conv.unreadCount > 0 ? 'text-gray-900' : 'text-gray-700'
                            )}>
                              {conv.contact.name}
                            </h3>
                            {conv.isStarred && <Star className="w-3 h-3 text-yellow-500 fill-yellow-500" />}
                          </div>
                          <span className="text-xs text-gray-500 flex-shrink-0">
                            {formatTimestamp(conv.lastMessage.timestamp)}
                          </span>
                        </div>

                        <div className="flex items-center gap-2 mb-1">
                          <div className={cn('p-1 rounded', sourceConfig[conv.source].color)}>
                            <SourceIcon className="w-3 h-3" />
                          </div>
                          {conv.vehicleContext && (
                            <span className="text-xs text-gray-500 flex items-center gap-1">
                              <Car className="w-3 h-3" />
                              {conv.vehicleContext.year} {conv.vehicleContext.make} {conv.vehicleContext.model}
                            </span>
                          )}
                        </div>

                        <div className="flex items-center justify-between">
                          <p className={cn(
                            'text-sm truncate',
                            conv.unreadCount > 0 ? 'text-gray-900 font-medium' : 'text-gray-500'
                          )}>
                            {conv.lastMessage.isFromMe && <span className="text-gray-400">You: </span>}
                            {conv.lastMessage.text}
                          </p>
                          {conv.unreadCount > 0 && (
                            <span className="flex-shrink-0 w-5 h-5 bg-blue-600 text-white text-xs font-medium rounded-full flex items-center justify-center">
                              {conv.unreadCount}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Chat Area */}
        <div className={cn(
          'flex-1 flex flex-col',
          !showMobileChat && 'hidden md:flex'
        )}>
          {selectedConversation ? (
            <>
              {/* Chat Header */}
              <div className="p-4 border-b border-gray-100 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setShowMobileChat(false)}
                    className="md:hidden p-2 -ml-2 text-gray-500 hover:text-gray-700"
                  >
                    <ArrowLeft className="w-5 h-5" />
                  </button>
                  <div className="relative">
                    <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center">
                      {selectedConversation.contact.avatar ? (
                        <img src={selectedConversation.contact.avatar} alt="" className="w-full h-full rounded-full object-cover" />
                      ) : (
                        <User className="w-5 h-5 text-gray-500" />
                      )}
                    </div>
                    {selectedConversation.contact.isOnline && (
                      <div className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 border-2 border-white rounded-full" />
                    )}
                  </div>
                  <div>
                    <h3 className="font-medium text-gray-900">{selectedConversation.contact.name}</h3>
                    <p className="text-xs text-gray-500">
                      {selectedConversation.contact.isOnline ? 'Online' : 'Offline'}
                      {selectedConversation.vehicleContext && (
                        <> • {selectedConversation.vehicleContext.year} {selectedConversation.vehicleContext.make} {selectedConversation.vehicleContext.model}</>
                      )}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => starMutation.mutate({ 
                      conversationId: selectedConversation.id, 
                      starred: !selectedConversation.isStarred 
                    })}
                    className={cn(
                      'p-2 rounded-lg transition-colors',
                      selectedConversation.isStarred 
                        ? 'text-yellow-500 hover:bg-yellow-50' 
                        : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
                    )}
                  >
                    <Star className={cn('w-5 h-5', selectedConversation.isStarred && 'fill-yellow-500')} />
                  </button>
                  <button
                    onClick={() => archiveMutation.mutate(selectedConversation.id)}
                    className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    <Archive className="w-5 h-5" />
                  </button>
                  <button className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
                    <MoreHorizontal className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Vehicle Context Banner */}
              {selectedConversation.vehicleContext && (
                <div className="px-4 py-2 bg-blue-50 border-b border-blue-100 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm text-blue-700">
                    <Car className="w-4 h-4" />
                    <span>
                      Conversation about: <strong>{selectedConversation.vehicleContext.year} {selectedConversation.vehicleContext.make} {selectedConversation.vehicleContext.model}</strong>
                    </span>
                  </div>
                  <button className="text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1">
                    View Listing <ExternalLink className="w-3 h-3" />
                  </button>
                </div>
              )}

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {messagesLoading ? (
                  <div className="flex items-center justify-center h-full">
                    <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
                  </div>
                ) : (
                  messages.map((msg: Message) => (
                    <div
                      key={msg.id}
                      className={cn('flex', msg.isFromMe ? 'justify-end' : 'justify-start')}
                    >
                      <div
                        className={cn(
                          'max-w-[70%] rounded-2xl px-4 py-2',
                          msg.isFromMe
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-100 text-gray-900'
                        )}
                      >
                        <p className="text-sm whitespace-pre-wrap">{msg.text}</p>
                        <div className={cn(
                          'flex items-center justify-end gap-1 mt-1',
                          msg.isFromMe ? 'text-blue-200' : 'text-gray-400'
                        )}>
                          <span className="text-xs">{formatTimestamp(msg.timestamp, true)}</span>
                          {msg.isFromMe && <MessageStatus status={msg.status} />}
                        </div>
                      </div>
                    </div>
                  ))
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Message Input */}
              <div className="p-4 border-t border-gray-100">
                <div className="flex items-end gap-2">
                  <button className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
                    <Paperclip className="w-5 h-5" />
                  </button>
                  <button className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
                    <Image className="w-5 h-5" />
                  </button>
                  <div className="flex-1 relative">
                    <textarea
                      ref={inputRef}
                      value={messageText}
                      onChange={(e) => setMessageText(e.target.value)}
                      onKeyPress={handleKeyPress}
                      placeholder="Type a message..."
                      rows={1}
                      className="w-full px-4 py-2 pr-10 border border-gray-200 rounded-xl resize-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      style={{ minHeight: '42px', maxHeight: '120px' }}
                    />
                    <button className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                      <Smile className="w-5 h-5" />
                    </button>
                  </div>
                  <button
                    onClick={handleSendMessage}
                    disabled={!messageText.trim() || sendMessageMutation.isPending}
                    className={cn(
                      'p-2 rounded-lg transition-colors',
                      messageText.trim()
                        ? 'bg-blue-600 text-white hover:bg-blue-700'
                        : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                    )}
                  >
                    {sendMessageMutation.isPending ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <Send className="w-5 h-5" />
                    )}
                  </button>
                </div>
                <p className="text-xs text-gray-400 mt-2">
                  Messages are sent through Facebook Messenger
                </p>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-center">
              <div>
                <MessageSquare className="w-16 h-16 mx-auto text-gray-300 mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">Select a Conversation</h3>
                <p className="text-gray-500 max-w-sm">
                  Choose a conversation from the list to start messaging with potential buyers
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
