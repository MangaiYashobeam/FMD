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
  MessageCircle,
  X,
  Minus,
  Send,
  Sparkles,
  Maximize2,
  GripHorizontal,
} from 'lucide-react';
import { aiCenterService, type ChatMessage } from '../../services/ai-center.service';

// AI Role definitions
export type AIRole = 'super_admin' | 'admin' | 'user' | 'internal';

interface AIRoleConfig {
  name: string;
  systemPrompt: string;
  color: string;
  icon: string;
}

const AI_ROLES: Record<AIRole, AIRoleConfig> = {
  super_admin: {
    name: 'Nova (Super Admin AI)',
    systemPrompt: `You are Nova, the Super Admin AI Assistant for DealersFace - a comprehensive automotive dealership management platform.

ABOUT YOUR EMPLOYER:
- Company: GAD Productions
- Platform: DealersFace (dealersface.com)
- Purpose: Complete SaaS solution for car dealerships to manage inventory, leads, Facebook marketplace integration, and customer communications

YOUR ROLE:
- You are the highest-level AI assistant serving the Super Admin
- You have full knowledge of the entire system architecture, codebase, and all features
- You help with system administration, debugging, user management, and platform optimization
- You can read and understand all system metrics, logs, and analytics

YOUR CAPABILITIES:
- Full access to understand all dashboard metrics and KPIs
- Knowledge of all API endpoints and their functions
- Understanding of the database schema and data relationships
- Ability to explain any feature or functionality
- Help with troubleshooting and system issues
- Provide insights on performance and optimization

YOUR PERSONALITY:
- Professional but friendly
- Proactive in offering solutions
- Thorough in explanations when needed
- Concise when appropriate
- Always focused on helping the admin succeed

CURRENT CONTEXT:
- The admin is logged in as Super Admin
- They have full platform access
- Help them manage and optimize the DealersFace platform`,
    color: 'from-purple-500 to-pink-500',
    icon: '🌟',
  },
  admin: {
    name: 'Atlas (Admin AI)',
    systemPrompt: `You are Atlas, the Admin AI Assistant for DealersFace.

YOUR ROLE:
- Help account administrators manage their dealership accounts
- Assist with inventory management, lead tracking, and Facebook integration
- Provide guidance on best practices for dealership operations
- Help understand reports and analytics

YOUR CAPABILITIES:
- Guide users through all admin features
- Help with account settings and configuration
- Assist with team member management
- Explain reports and metrics
- Troubleshoot common issues

Be helpful, professional, and focused on dealership success.`,
    color: 'from-blue-500 to-cyan-500',
    icon: '🔷',
  },
  user: {
    name: 'Echo (Support AI)',
    systemPrompt: `You are Echo, the Customer Support AI for DealersFace.

YOUR ROLE:
- Help users understand and use the DealersFace platform
- Provide step-by-step guidance for common tasks
- Assist with API integration questions
- Help troubleshoot issues

YOUR CAPABILITIES:
- Guide through platform features
- Explain how to connect APIs
- Help with dashboard navigation
- Answer questions about functionality
- Provide technical support

Be friendly, patient, and clear in your explanations.`,
    color: 'from-green-500 to-emerald-500',
    icon: '💬',
  },
  internal: {
    name: 'Nexus (Internal AI Agent)',
    systemPrompt: `You are Nexus, an Internal AI Agent for DealersFace.

YOUR ROLE:
- Navigate Facebook Marketplace on behalf of authorized users
- Interact with potential car buyers
- Collect and organize lead information
- Create and manage vehicle listings
- Handle customer inquiries professionally

YOUR CAPABILITIES:
- Facebook Marketplace automation
- Lead qualification and data collection
- Automated response generation
- Listing creation assistance
- Customer interaction management

Always represent the dealership professionally and follow Facebook's guidelines.`,
    color: 'from-orange-500 to-red-500',
    icon: '🤖',
  },
};

interface FloatingAIChatProps {
  userRole?: AIRole;
  isAICenterTab?: boolean;
  onMaximize?: () => void;
}

export default function FloatingAIChat({ 
  userRole = 'super_admin', 
  isAICenterTab = false,
  onMaximize 
}: FloatingAIChatProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [messages, setMessages] = useState<{ role: 'user' | 'assistant'; content: string }[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [position, setPosition] = useState({ x: window.innerWidth - 420, y: window.innerHeight - 600 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const inputRef = useRef<HTMLInputElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const roleConfig = AI_ROLES[userRole];

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
    setIsDragging(true);
    setDragOffset({
      x: e.clientX - position.x,
      y: e.clientY - position.y,
    });
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging) {
        setPosition({
          x: Math.max(0, Math.min(window.innerWidth - 400, e.clientX - dragOffset.x)),
          y: Math.max(0, Math.min(window.innerHeight - 500, e.clientY - dragOffset.y)),
        });
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, dragOffset]);

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
      setMessages(prev => [...prev, { role: 'assistant', content: result.content }]);
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

  return (
    <>
      {/* Minimized Sphere */}
      <AnimatePresence>
        {isMinimized && (
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            className="fixed z-50 cursor-pointer"
            style={{ left: position.x + 175, top: position.y + 225 }}
            onClick={() => setIsMinimized(false)}
          >
            <div className="relative">
              {/* Radioactive glow effect */}
              <div className="absolute inset-0 w-14 h-14 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 blur-lg opacity-60 animate-pulse" />
              <div className="absolute inset-0 w-14 h-14 rounded-full bg-gradient-to-r from-purple-600 to-pink-600 blur-md opacity-40 animate-ping" />
              
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
          className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full bg-gradient-to-r from-purple-600 to-pink-600 shadow-lg flex items-center justify-center hover:shadow-purple-500/50 transition-shadow"
        >
          <MessageCircle className="w-6 h-6 text-white" />
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
                    <p className="text-[10px] text-white/70">AI Assistant</p>
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
                      className={`max-w-[85%] rounded-2xl px-4 py-2 ${
                        msg.role === 'user'
                          ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white'
                          : 'bg-gray-800/80 text-gray-100 border border-white/5'
                      }`}
                    >
                      <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
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
