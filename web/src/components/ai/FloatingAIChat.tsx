/**
 * Floating AI Chat Widget
 * 
 * A portable, minimalist AI chat interface that:
 * - Floats above the page when outside AI Center
 * - Can be minimized to a glowing sphere
 * - Has semi-transparent glass design
 * - Can be dragged around the screen
 * - Maintains conversation state with backend persistence
 * - Supports file attachments (upload, drag & drop, paste)
 * - Has hierarchical memory (Global → Role → Company → User)
 * 
 * AI Roles:
 * - Super Admin AI: Full system knowledge, assists with admin tasks
 * - Admin AI: Knows environment, helps with account management
 * - User AI: Customer support, API help, technical assistance
 * - Internal AI (IAI): Facebook automation, lead interaction
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import type { DragEvent, ClipboardEvent } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  Minus,
  Send,
  Sparkles,
  Maximize2,
  GripHorizontal,
  ChevronDown,
  ChevronRight,
  Brain,
  Paperclip,
  Image as ImageIcon,
  FileText,
  Loader2,
  History,
  Plus,
  Trash2,
} from 'lucide-react';
import { AI_TRAINING_CONFIG, type AIRole, type AIRoleConfig } from '../../config/ai-training';
import { parseAIResponse, type ParsedAIResponse } from '../../utils/ai-response-parser';
import { api } from '../../lib/api';

// Use comprehensive AI training from config
const AI_ROLES: Record<AIRole, AIRoleConfig> = AI_TRAINING_CONFIG;

interface Attachment {
  id: string;
  filename: string;
  mimeType: string;
  size: number;
  category: string;
  preview?: string;
}

interface MessageWithThoughts {
  id?: string;
  role: 'user' | 'assistant';
  content: string;
  parsed?: ParsedAIResponse;
  showThoughts?: boolean;
  attachments?: Attachment[];
  createdAt?: string;
}

interface ChatSession {
  id: string;
  title: string;
  lastMessageAt: string;
  messageCount: number;
  isPinned: boolean;
}

interface FloatingAIChatProps {
  userRole?: AIRole;
  isAICenterTab?: boolean;
  onMaximize?: () => void;
  isImpersonating?: boolean;
  showThoughtsDefault?: boolean; // Super admin sees thoughts by default
}

// Allowed file types (gets refined by backend based on role)
const ACCEPTED_FILE_TYPES = 'image/jpeg,image/png,image/webp,image/gif,text/csv,application/xml,text/xml,application/pdf';

// Available AI models for selection
const AVAILABLE_MODELS = [
  { id: 'claude-sonnet-4', name: 'Claude Sonnet 4', provider: 'anthropic', icon: '🟣' },
  { id: 'gpt-4o', name: 'GPT-4o', provider: 'openai', icon: '🟢' },
  { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro', provider: 'google', icon: '🔵' },
  { id: 'claude-haiku-4.5', name: 'Claude Haiku 4.5', provider: 'anthropic', icon: '🟣' },
  { id: 'gpt-4o-mini', name: 'GPT-4o Mini', provider: 'openai', icon: '🟢' },
  { id: 'deepseek-chat', name: 'DeepSeek Chat', provider: 'deepseek', icon: '🔶' },
];

export default function FloatingAIChat({ 
  userRole = 'super_admin', 
  isAICenterTab = false,
  onMaximize,
  isImpersonating = false,
  showThoughtsDefault = false
}: FloatingAIChatProps) {
  // Super admins always see AI thoughts by default
  const shouldShowThoughts = userRole === 'super_admin' || showThoughtsDefault;
  // UI State
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [showSessions, setShowSessions] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [showModelSelector, setShowModelSelector] = useState(false);
  
  // Chat State
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<MessageWithThoughts[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [pendingAttachments, setPendingAttachments] = useState<Attachment[]>([]);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [selectedModel, setSelectedModel] = useState<string>('claude-sonnet-4');
  
  // Position State
  const [position, setPosition] = useState({ x: window.innerWidth - 420, y: window.innerHeight - 600 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  
  // Refs
  const inputRef = useRef<HTMLInputElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  const roleConfig = AI_ROLES[userRole];
  const currentModelInfo = AVAILABLE_MODELS.find(m => m.id === selectedModel) || AVAILABLE_MODELS[0];
  
  // Nova follows Super Admin even in impersonation mode
  const isNovaFollowing = userRole === 'super_admin' && isImpersonating;

  // ============================================
  // API Functions
  // ============================================
  
  const loadSessions = async () => {
    try {
      const response = await api.get('/api/ai/sessions?limit=20');
      setSessions(response.data?.data?.sessions || []);
    } catch (error) {
      console.error('Failed to load sessions:', error);
    }
  };

  const createNewSession = async () => {
    try {
      const response = await api.post('/api/ai/sessions', { title: 'New Conversation' });
      setCurrentSessionId(response.data.data.id);
      setMessages([]);
      setShowSessions(false);
      await loadSessions();
      return response.data.data.id;
    } catch (error) {
      console.error('Failed to create session:', error);
    }
    return null;
  };

  const loadSession = async (sessionId: string) => {
    try {
      const response = await api.get(`/api/ai/sessions/${sessionId}`);
      setCurrentSessionId(sessionId);
      setMessages(response.data.data.messages?.map((m: any) => ({
        id: m.id,
        role: m.role,
        content: m.content,
        attachments: m.attachments,
        createdAt: m.createdAt,
        parsed: m.role === 'assistant' ? parseAIResponse(m.content) : undefined,
        showThoughts: false,
      })) || []);
      setShowSessions(false);
    } catch (error) {
      console.error('Failed to load session:', error);
    }
  };

  const deleteSession = async (sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent loading the session when clicking delete
    if (!confirm('Delete this conversation? This cannot be undone.')) return;
    
    try {
      await api.delete(`/api/ai/sessions/${sessionId}`);
      // If we're deleting the current session, clear the chat
      if (currentSessionId === sessionId) {
        setCurrentSessionId(null);
        setMessages([]);
      }
      await loadSessions();
    } catch (error) {
      console.error('Failed to delete session:', error);
    }
  };

  const uploadFile = async (file: File): Promise<Attachment | null> => {
    setUploadingFile(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      
      const response = await api.post('/api/ai/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      
      const attachment: Attachment = {
        ...response.data.data,
        preview: file.type.startsWith('image/') ? URL.createObjectURL(file) : undefined,
      };
      return attachment;
    } catch (error: any) {
      console.error('Upload failed:', error);
      alert(error.response?.data?.error || 'Failed to upload file');
    } finally {
      setUploadingFile(false);
    }
    return null;
  };

  // ============================================
  // File Handling
  // ============================================

  const handleFileSelect = useCallback(async (files: FileList | File[]) => {
    const fileArray = Array.from(files);
    for (const file of fileArray) {
      const attachment = await uploadFile(file);
      if (attachment) {
        setPendingAttachments(prev => [...prev, attachment]);
      }
    }
  }, []);

  const handleDragOver = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback(async (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      await handleFileSelect(files);
    }
  }, [handleFileSelect]);

  const handlePaste = useCallback(async (e: ClipboardEvent<HTMLInputElement>) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    
    for (const item of Array.from(items)) {
      if (item.type.startsWith('image/')) {
        e.preventDefault();
        const file = item.getAsFile();
        if (file) {
          await handleFileSelect([file]);
        }
        break;
      }
    }
  }, [handleFileSelect]);

  const removeAttachment = useCallback((id: string) => {
    setPendingAttachments(prev => prev.filter(a => a.id !== id));
  }, []);

  // ============================================
  // Message Handling
  // ============================================

  const toggleThoughts = (index: number) => {
    setMessages(prev => prev.map((msg, i) => 
      i === index ? { ...msg, showThoughts: !msg.showThoughts } : msg
    ));
  };

  const handleSend = async () => {
    if ((!input.trim() && pendingAttachments.length === 0) || loading) return;

    const userMessage = input.trim();
    setInput('');
    setLoading(true);

    // Ensure we have a session
    let sessionId = currentSessionId;
    if (!sessionId) {
      sessionId = await createNewSession();
      if (!sessionId) {
        setLoading(false);
        return;
      }
    }

    // Add user message optimistically
    const userMsg: MessageWithThoughts = {
      role: 'user',
      content: userMessage || '[Attachment]',
      attachments: [...pendingAttachments],
    };
    setMessages(prev => [...prev, userMsg]);
    
    const attachmentIds = pendingAttachments.map(a => a.id);
    setPendingAttachments([]);

    try {
      const response = await api.post(`/api/ai/sessions/${sessionId}/messages`, { 
        content: userMessage, 
        attachmentIds,
        model: selectedModel, // Pass selected model for routing
      });

      const data = response.data;
      const parsed = parseAIResponse(data.data.assistantMessage.content);
      
      setMessages(prev => [
        ...prev.slice(0, -1), // Remove optimistic user message
        {
          ...userMsg,
          id: data.data.userMessage.id,
          createdAt: data.data.userMessage.createdAt,
        },
        {
          id: data.data.assistantMessage.id,
          role: 'assistant',
          content: data.data.assistantMessage.content,
          parsed,
          showThoughts: shouldShowThoughts, // Auto-show for super admin
          createdAt: data.data.assistantMessage.createdAt,
        },
      ]);
      
      // Refresh sessions list to update last message
      loadSessions();
    } catch (error: any) {
      const errorMsg = error.response?.data?.error || error.message;
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: `I apologize, but I encountered an error: ${errorMsg}. Please try again.` 
      }]);
    }
    setLoading(false);
  };

  // ============================================
  // Effects
  // ============================================

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen && !isMinimized && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen, isMinimized, loading]);

  // Load sessions when opened
  useEffect(() => {
    if (isOpen) {
      loadSessions();
    }
  }, [isOpen]);

  // ============================================
  // Drag Handling
  // ============================================

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
    setDragOffset({
      x: e.clientX - position.x,
      y: e.clientY - position.y,
    });
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging) {
        const sphereSize = 56;
        const chatWidth = 400;
        const chatHeight = 500;
        const sphereOffsetX = 175;
        const sphereOffsetY = 225;
        
        if (isMinimized) {
          const newX = e.clientX - dragOffset.x - sphereOffsetX;
          const newY = e.clientY - dragOffset.y - sphereOffsetY;
          setPosition({
            x: Math.max(-sphereOffsetX, Math.min(window.innerWidth - sphereSize - sphereOffsetX, newX)),
            y: Math.max(-sphereOffsetY, Math.min(window.innerHeight - sphereSize - sphereOffsetY, newY)),
          });
        } else {
          setPosition({
            x: Math.max(0, Math.min(window.innerWidth - chatWidth, e.clientX - dragOffset.x)),
            y: Math.max(0, Math.min(window.innerHeight - chatHeight, e.clientY - dragOffset.y)),
          });
        }
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      document.body.style.userSelect = 'none';
      document.body.style.cursor = 'grabbing';
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, dragOffset, isMinimized]);

  // Don't render if we're in AI Center tab
  if (isAICenterTab) return null;

  const handleSphereDrag = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
    setDragOffset({
      x: e.clientX - (position.x + 175),
      y: e.clientY - (position.y + 225),
    });
  };

  return (
    <>
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept={ACCEPTED_FILE_TYPES}
        className="hidden"
        onChange={(e) => e.target.files && handleFileSelect(e.target.files)}
        multiple
      />

      {/* Minimized Sphere - Now Draggable */}
      <AnimatePresence>
        {isMinimized && (
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            className="fixed z-50 select-none"
            style={{ left: position.x + 175, top: position.y + 225 }}
          >
            <div 
              className="relative cursor-grab active:cursor-grabbing select-none"
              onMouseDown={handleSphereDrag}
              onClick={(e) => {
                if (!isDragging) setIsMinimized(false);
                e.stopPropagation();
              }}
            >
              {/* Radioactive glow effect */}
              <div className={`absolute inset-0 w-14 h-14 rounded-full bg-gradient-to-r ${roleConfig.color} blur-lg opacity-60 animate-pulse`} />
              <div className={`absolute inset-0 w-14 h-14 rounded-full bg-gradient-to-r ${roleConfig.color} blur-md opacity-40 animate-ping`} />
              
              {/* Main sphere */}
              <motion.div
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.95 }}
                className={`relative w-14 h-14 rounded-full bg-gradient-to-r ${roleConfig.color} flex items-center justify-center shadow-2xl`}
              >
                <span className="text-2xl">{roleConfig.icon}</span>
                
                {/* Notification dot */}
                {messages.length > 0 && (
                  <div className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full flex items-center justify-center">
                    <span className="text-[10px] text-white font-bold">{messages.length}</span>
                  </div>
                )}
              </motion.div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Chat Toggle Button (when closed) */}
      {!isOpen && !isMinimized && (
        <motion.button
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => setIsOpen(true)}
          className={`fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full bg-gradient-to-r ${roleConfig.color} shadow-lg flex items-center justify-center hover:shadow-lg transition-shadow`}
        >
          <span className="text-2xl">{roleConfig.icon}</span>
          <div className="absolute -top-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-gray-900" />
        </motion.button>
      )}

      {/* Chat Window */}
      <AnimatePresence>
        {isOpen && !isMinimized && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 50, scale: 0.9 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed z-50"
            style={{ left: position.x, top: position.y }}
          >
            {/* Glass container with drag & drop overlay */}
            <div 
              ref={chatContainerRef}
              className={`w-[400px] h-[500px] rounded-2xl overflow-hidden backdrop-blur-xl bg-gray-900/80 border border-white/10 shadow-2xl flex flex-col relative ${isDragOver ? 'ring-2 ring-purple-500' : ''}`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              {/* Drag overlay */}
              {isDragOver && (
                <div className="absolute inset-0 z-50 bg-purple-900/50 backdrop-blur-sm flex items-center justify-center">
                  <div className="text-center">
                    <ImageIcon className="w-12 h-12 text-purple-400 mx-auto mb-2" />
                    <p className="text-white font-medium">Drop files here</p>
                    <p className="text-purple-300 text-sm">Images, CSV, XML, PDF</p>
                  </div>
                </div>
              )}

              {/* Header - Draggable */}
              <div
                onMouseDown={handleMouseDown}
                className={`flex items-center justify-between px-4 py-3 bg-gradient-to-r ${roleConfig.color} cursor-move`}
              >
                <div className="flex items-center gap-2">
                  <GripHorizontal className="w-4 h-4 text-white/50" />
                  <span className="text-xl">{roleConfig.icon}</span>
                  <div>
                    <h3 className="text-sm font-semibold text-white">{roleConfig.name}</h3>
                    <p className="text-[10px] text-white/70">
                      {isNovaFollowing ? (
                        <span className="flex items-center gap-1">
                          <span className="w-1.5 h-1.5 bg-yellow-400 rounded-full animate-pulse" />
                          Following Super Admin
                        </span>
                      ) : (
                        'AI Assistant'
                      )}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  {/* History button */}
                  <button
                    onClick={() => setShowSessions(!showSessions)}
                    className={`p-1.5 hover:bg-white/20 rounded-lg transition ${showSessions ? 'bg-white/20' : ''}`}
                    title="Conversation history"
                  >
                    <History className="w-4 h-4 text-white" />
                  </button>
                  {/* New chat button */}
                  <button
                    onClick={createNewSession}
                    className="p-1.5 hover:bg-white/20 rounded-lg transition"
                    title="New conversation"
                  >
                    <Plus className="w-4 h-4 text-white" />
                  </button>
                  {onMaximize && (
                    <button
                      onClick={onMaximize}
                      className="p-1.5 hover:bg-white/20 rounded-lg transition"
                      title="Open in AI Center"
                    >
                      <Maximize2 className="w-4 h-4 text-white" />
                    </button>
                  )}
                  <button
                    onClick={() => setIsMinimized(true)}
                    className="p-1.5 hover:bg-white/20 rounded-lg transition"
                    title="Minimize to sphere"
                  >
                    <Minus className="w-4 h-4 text-white" />
                  </button>
                  <button
                    onClick={() => setIsOpen(false)}
                    className="p-1.5 hover:bg-white/20 rounded-lg transition"
                    title="Close"
                  >
                    <X className="w-4 h-4 text-white" />
                  </button>
                </div>
              </div>

              {/* Sessions Sidebar */}
              <AnimatePresence>
                {showSessions && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden bg-gray-800/50 border-b border-white/5"
                  >
                    <div className="p-2 max-h-48 overflow-y-auto">
                      {sessions.length === 0 ? (
                        <p className="text-gray-500 text-xs text-center py-2">No previous conversations</p>
                      ) : (
                        sessions.map((session) => (
                          <div
                            key={session.id}
                            onClick={() => loadSession(session.id)}
                            className={`group relative w-full text-left p-2 rounded-lg hover:bg-gray-700/50 transition text-xs cursor-pointer ${
                              currentSessionId === session.id ? 'bg-purple-600/20 border border-purple-500/30' : ''
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex-1 min-w-0">
                                <div className="font-medium text-white truncate">{session.title}</div>
                                <div className="text-gray-500 text-[10px]">
                                  {session.messageCount} messages • {new Date(session.lastMessageAt).toLocaleDateString()}
                                </div>
                              </div>
                              <button
                                onClick={(e) => deleteSession(session.id, e)}
                                className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-red-500/20 text-gray-400 hover:text-red-400 transition-all"
                                title="Delete conversation"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Model Selector Bar */}
              <div className="px-3 py-2 bg-gray-800/30 border-b border-white/5 flex items-center justify-between">
                <div className="relative">
                  <button
                    onClick={() => setShowModelSelector(!showModelSelector)}
                    className="flex items-center gap-2 px-2 py-1 bg-gray-700/50 hover:bg-gray-600/50 rounded-lg text-xs transition"
                  >
                    <span>{currentModelInfo.icon}</span>
                    <span className="text-gray-300">{currentModelInfo.name}</span>
                    <ChevronDown className={`w-3 h-3 text-gray-400 transition-transform ${showModelSelector ? 'rotate-180' : ''}`} />
                  </button>
                  
                  {/* Model Dropdown */}
                  <AnimatePresence>
                    {showModelSelector && (
                      <motion.div
                        initial={{ opacity: 0, y: -5 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -5 }}
                        className="absolute top-full left-0 mt-1 w-48 bg-gray-800 border border-gray-700 rounded-lg shadow-xl z-50 overflow-hidden"
                      >
                        {AVAILABLE_MODELS.map((model) => (
                          <button
                            key={model.id}
                            onClick={() => {
                              setSelectedModel(model.id);
                              setShowModelSelector(false);
                            }}
                            className={`w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-gray-700/50 transition text-left ${
                              selectedModel === model.id ? 'bg-purple-600/20 text-purple-300' : 'text-gray-300'
                            }`}
                          >
                            <span>{model.icon}</span>
                            <div>
                              <div className="font-medium">{model.name}</div>
                              <div className="text-[10px] text-gray-500">{model.provider}</div>
                            </div>
                            {selectedModel === model.id && (
                              <span className="ml-auto text-purple-400">✓</span>
                            )}
                          </button>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
                
                <span className="text-[10px] text-gray-500">
                  {loading ? 'Processing...' : 'Ready'}
                </span>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {messages.length === 0 && (
                  <div className="text-center py-8">
                    <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-r from-purple-500/20 to-pink-500/20 flex items-center justify-center">
                      <Sparkles className="w-8 h-8 text-purple-400" />
                    </div>
                    <p className="text-gray-400 text-sm">Hi! I'm {roleConfig.name.split(' ')[0]}</p>
                    <p className="text-gray-500 text-xs mt-1">How can I help you today?</p>
                    <p className="text-gray-600 text-[10px] mt-2">Drop files or paste images to share</p>
                  </div>
                )}

                {messages.map((msg, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[85%] rounded-2xl shadow-lg ${
                        msg.role === 'user'
                          ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white px-4 py-3'
                          : 'bg-gray-800 text-white border border-gray-600'
                      }`}
                    >
                      {/* Attachments preview */}
                      {msg.attachments && msg.attachments.length > 0 && (
                        <div className={`${msg.role === 'user' ? 'px-4 pt-2' : 'px-4 pt-3'} flex flex-wrap gap-2`}>
                          {msg.attachments.map((att) => (
                            <div key={att.id} className="flex items-center gap-1 bg-black/20 rounded px-2 py-1 text-xs">
                              {att.category === 'image' ? (
                                <ImageIcon className="w-3 h-3" />
                              ) : (
                                <FileText className="w-3 h-3" />
                              )}
                              <span className="truncate max-w-[100px]">{att.filename}</span>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* AI Response with Thoughts */}
                      {msg.role === 'assistant' && msg.parsed?.hasTools && (
                        <div className="border-b border-white/10">
                          <button
                            onClick={() => toggleThoughts(i)}
                            className="w-full flex items-center gap-2 px-4 py-2 text-xs text-purple-400 hover:text-purple-300 transition"
                          >
                            {msg.showThoughts ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                            <Brain className="w-3 h-3" />
                            <span>AI Thoughts ({msg.parsed.thoughts.length} tools)</span>
                          </button>
                          
                          {/* Collapsible Thoughts Section */}
                          <AnimatePresence>
                            {msg.showThoughts && (
                              <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                className="overflow-hidden"
                              >
                                <div className="px-4 pb-3 space-y-2 bg-gray-900/50 text-xs font-mono">
                                  {msg.parsed.thoughts.map((thought, ti) => (
                                    <div key={ti} className="text-yellow-400/80">{thought}</div>
                                  ))}
                                  {msg.parsed.toolResults.map((result, ri) => (
                                    <div key={ri} className="text-green-400/70 whitespace-pre-wrap max-h-32 overflow-y-auto">
                                      {result}
                                    </div>
                                  ))}
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      )}
                      
                      {/* Main Answer */}
                      <div className={`px-4 py-3 ${msg.role === 'assistant' ? 'text-gray-100' : ''}`}>
                        <p className="text-sm whitespace-pre-wrap leading-relaxed">
                          {msg.role === 'assistant' && msg.parsed ? msg.parsed.answer : msg.content}
                        </p>
                      </div>
                    </div>
                  </motion.div>
                ))}

                {loading && (
                  <div className="flex justify-start">
                    <div className="bg-gray-800/80 rounded-2xl px-4 py-3 border border-white/5">
                      <div className="flex gap-1">
                        <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" />
                        <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '0.15s' }} />
                        <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '0.3s' }} />
                      </div>
                    </div>
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>

              {/* Pending Attachments Preview */}
              {pendingAttachments.length > 0 && (
                <div className="px-3 py-2 border-t border-white/5 bg-gray-800/30">
                  <div className="flex flex-wrap gap-2">
                    {pendingAttachments.map((att) => (
                      <div key={att.id} className="relative group">
                        {att.preview ? (
                          <img src={att.preview} alt={att.filename} className="w-12 h-12 object-cover rounded-lg" />
                        ) : (
                          <div className="w-12 h-12 bg-gray-700 rounded-lg flex items-center justify-center">
                            <FileText className="w-5 h-5 text-gray-400" />
                          </div>
                        )}
                        <button
                          onClick={() => removeAttachment(att.id)}
                          className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition"
                        >
                          <X className="w-3 h-3 text-white" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Input */}
              <div className="p-3 border-t border-white/5">
                <div className="flex gap-2">
                  {/* Attachment button */}
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploadingFile}
                    className="p-2.5 bg-gray-800/50 border border-white/10 rounded-xl hover:bg-gray-700/50 transition disabled:opacity-50"
                    title="Attach file"
                  >
                    {uploadingFile ? (
                      <Loader2 className="w-4 h-4 text-gray-400 animate-spin" />
                    ) : (
                      <Paperclip className="w-4 h-4 text-gray-400" />
                    )}
                  </button>
                  
                  <input
                    ref={inputRef}
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
                    onPaste={handlePaste}
                    placeholder="Ask me anything... (paste images!)"
                    className="flex-1 px-4 py-2.5 bg-gray-800/50 border border-white/10 rounded-xl text-sm text-white placeholder-gray-500 focus:outline-none focus:border-purple-500/50 transition"
                    disabled={loading}
                  />
                  <button
                    onClick={handleSend}
                    disabled={loading || (!input.trim() && pendingAttachments.length === 0)}
                    className="px-4 py-2.5 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 disabled:opacity-50 rounded-xl transition flex items-center justify-center"
                  >
                    <Send className="w-4 h-4 text-white" />
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
