/**
 * Floating AI Chat Widget
 * 
 * A portable, minimalist AI chat interface that:
 * - Floats above the page when outside AI Center
 * - Can be minimized to a glowing sphere
 * - Has semi-transparent glass design
 * - Can be dragged around the screen
 * - Maintains conversation state
 * 
 * AI Roles:
 * - Super Admin AI: Full system knowledge, assists with admin tasks
 * - Admin AI: Knows environment, helps with account management
 * - User AI: Customer support, API help, technical assistance
 * - Internal AI (IAI): Facebook automation, lead interaction
 */

import { useState, useEffect, useRef } from 'react';
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
} from 'lucide-react';
import { aiCenterService, type ChatMessage } from '../../services/ai-center.service';
import { AI_TRAINING_CONFIG, type AIRole, type AIRoleConfig } from '../../config/ai-training';
import { parseAIResponse, type ParsedAIResponse } from '../../utils/ai-response-parser';

// Use comprehensive AI training from config
const AI_ROLES: Record<AIRole, AIRoleConfig> = AI_TRAINING_CONFIG;

interface MessageWithThoughts {
  role: 'user' | 'assistant';
  content: string;
  parsed?: ParsedAIResponse;
  showThoughts?: boolean;
}

interface FloatingAIChatProps {
  userRole?: AIRole;
  isAICenterTab?: boolean;
  onMaximize?: () => void;
  isImpersonating?: boolean;
}

export default function FloatingAIChat({ 
  userRole = 'super_admin', 
  isAICenterTab = false,
  onMaximize,
  isImpersonating = false
}: FloatingAIChatProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [messages, setMessages] = useState<MessageWithThoughts[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [position, setPosition] = useState({ x: window.innerWidth - 420, y: window.innerHeight - 600 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const inputRef = useRef<HTMLInputElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const roleConfig = AI_ROLES[userRole];
  
  // Nova follows Super Admin even in impersonation mode
  const isNovaFollowing = userRole === 'super_admin' && isImpersonating;

  // Toggle thoughts visibility for a message
  const toggleThoughts = (index: number) => {
    setMessages(prev => prev.map((msg, i) => 
      i === index ? { ...msg, showThoughts: !msg.showThoughts } : msg
    ));
  };

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

  // Handle drag
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
        // Different bounds for minimized sphere vs expanded chat
        const sphereSize = 56; // w-14 = 56px
        const chatWidth = 400;
        const chatHeight = 500;
        const sphereOffsetX = 175;
        const sphereOffsetY = 225;
        
        if (isMinimized) {
          // For sphere: calculate bounds based on sphere position with offset
          const newX = e.clientX - dragOffset.x - sphereOffsetX;
          const newY = e.clientY - dragOffset.y - sphereOffsetY;
          setPosition({
            x: Math.max(-sphereOffsetX, Math.min(window.innerWidth - sphereSize - sphereOffsetX, newX)),
            y: Math.max(-sphereOffsetY, Math.min(window.innerHeight - sphereSize - sphereOffsetY, newY)),
          });
        } else {
          // For chat window: use chat dimensions
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

  const handleSend = async () => {
    if (!input.trim() || loading) return;

    const userMessage = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setLoading(true);

    try {
      const chatMessages: ChatMessage[] = [
        { role: 'system', content: roleConfig.systemPrompt },
        ...messages.map(m => ({ role: m.role, content: m.content })),
        { role: 'user' as const, content: userMessage },
      ];

      const result = await aiCenterService.chat.send(chatMessages, { provider: 'anthropic' });
      
      // Parse the response to separate thoughts from answer
      const parsed = parseAIResponse(result.content);
      
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: result.content,
        parsed,
        showThoughts: false // Collapsed by default
      }]);
    } catch (error: any) {
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: `I apologize, but I encountered an error: ${error.message}. Please try again.` 
      }]);
    }
    setLoading(false);
  };

  // Don't render if we're in AI Center tab (that has its own chat)
  if (isAICenterTab) return null;

  // Handle sphere drag
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
            {/* Glass container */}
            <div className="w-[400px] h-[500px] rounded-2xl overflow-hidden backdrop-blur-xl bg-gray-900/80 border border-white/10 shadow-2xl flex flex-col">
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

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {messages.length === 0 && (
                  <div className="text-center py-8">
                    <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-r from-purple-500/20 to-pink-500/20 flex items-center justify-center">
                      <Sparkles className="w-8 h-8 text-purple-400" />
                    </div>
                    <p className="text-gray-400 text-sm">Hi! I'm {roleConfig.name.split(' ')[0]}</p>
                    <p className="text-gray-500 text-xs mt-1">How can I help you today?</p>
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
                      className={`max-w-[85%] rounded-2xl ${
                        msg.role === 'user'
                          ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white px-4 py-2'
                          : 'bg-gray-800/80 text-gray-100 border border-white/5'
                      }`}
                    >
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
                      <div className={`px-4 py-2 ${msg.role === 'assistant' && msg.parsed?.hasTools ? 'text-emerald-100' : ''}`}>
                        <p className="text-sm whitespace-pre-wrap">
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

              {/* Input */}
              <div className="p-3 border-t border-white/5">
                <div className="flex gap-2">
                  <input
                    ref={inputRef}
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
                    placeholder="Ask me anything..."
                    className="flex-1 px-4 py-2.5 bg-gray-800/50 border border-white/10 rounded-xl text-sm text-white placeholder-gray-500 focus:outline-none focus:border-purple-500/50 transition"
                    disabled={loading}
                  />
                  <button
                    onClick={handleSend}
                    disabled={loading || !input.trim()}
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
