import { useState, useRef, useEffect } from 'react';
import {
  X,
  Send,
  Bot,
  User,
  Loader2,
  Minimize2,
  Maximize2,
  Sparkles,
  HelpCircle,
  ArrowRight,
} from 'lucide-react';
import { cn } from '../../lib/utils';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface CloudChatProps {
  position?: 'bottom-right' | 'bottom-left';
  defaultOpen?: boolean;
}

const API_BASE_URL = import.meta.env.VITE_API_URL ?? '';

const QUICK_QUESTIONS = [
  'How does posting to Marketplace work?',
  'What are the pricing plans?',
  'Can you use Facebook API?',
  'How do I get started?',
];

export function CloudChat({ position = 'bottom-right', defaultOpen = false }: CloudChatProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const [isMinimized, setIsMinimized] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Focus input when chat opens
  useEffect(() => {
    if (isOpen && !isMinimized) {
      inputRef.current?.focus();
    }
  }, [isOpen, isMinimized]);

  // Add initial greeting
  useEffect(() => {
    if (isOpen && messages.length === 0) {
      setMessages([
        {
          id: 'welcome',
          role: 'assistant',
          content: `Hi there! 👋 I'm **Cloud**, your DealersFace assistant.\n\nI can help you with:\n- Learning about our features\n- Understanding how Marketplace posting works\n- Pricing information\n- Getting started\n\nWhat would you like to know?`,
          timestamp: new Date(),
        },
      ]);
    }
  }, [isOpen]);

  const sendMessage = async (message: string) => {
    if (!message.trim() || isLoading) return;

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: message.trim(),
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setIsLoading(true);

    try {
      const response = await fetch(`${API_BASE_URL}/api/cloud/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: message.trim(),
          conversationHistory: messages.map(m => ({
            role: m.role,
            content: m.content,
          })),
          sessionId,
        }),
      });

      const data = await response.json();

      if (data.success) {
        if (data.data.sessionId) {
          setSessionId(data.data.sessionId);
        }

        const assistantMessage: Message = {
          id: `assistant-${Date.now()}`,
          role: 'assistant',
          content: data.data.response,
          timestamp: new Date(),
        };

        setMessages(prev => [...prev, assistantMessage]);
      } else {
        throw new Error(data.error || 'Failed to get response');
      }
    } catch (error) {
      console.error('Cloud chat error:', error);
      
      const errorMessage: Message = {
        id: `error-${Date.now()}`,
        role: 'assistant',
        content: 'I apologize, but I encountered an issue. Please try again or contact support@dealersface.com for help.',
        timestamp: new Date(),
      };

      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(inputValue);
  };

  const handleQuickQuestion = (question: string) => {
    sendMessage(question);
  };

  const positionClasses = {
    'bottom-right': 'right-4 sm:right-6',
    'bottom-left': 'left-4 sm:left-6',
  };

  // Floating button when closed
  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className={cn(
          'fixed bottom-4 sm:bottom-6 z-50',
          positionClasses[position],
          'flex items-center gap-2 px-4 py-3 rounded-full',
          'bg-gradient-to-r from-blue-600 to-indigo-600 text-white',
          'shadow-lg hover:shadow-xl transition-all duration-300',
          'hover:scale-105 active:scale-95',
          'group'
        )}
      >
        <div className="relative">
          <Bot className="h-5 w-5" />
          <Sparkles className="h-3 w-3 absolute -top-1 -right-1 text-yellow-300 animate-pulse" />
        </div>
        <span className="font-medium hidden sm:inline">Chat with Cloud</span>
        <span className="font-medium sm:hidden">Chat</span>
      </button>
    );
  }

  // Chat window
  return (
    <div
      className={cn(
        'fixed bottom-4 sm:bottom-6 z-50',
        positionClasses[position],
        'w-[calc(100vw-2rem)] sm:w-96',
        'bg-white rounded-2xl shadow-2xl',
        'border border-gray-200',
        'flex flex-col',
        'transition-all duration-300',
        isMinimized ? 'h-14' : 'h-[500px] max-h-[80vh]'
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-t-2xl">
        <div className="flex items-center gap-2">
          <div className="relative">
            <Bot className="h-5 w-5" />
            <span className="absolute -bottom-0.5 -right-0.5 h-2 w-2 bg-green-400 rounded-full border border-white" />
          </div>
          <div>
            <h3 className="font-semibold text-sm">Cloud</h3>
            <p className="text-xs text-blue-100">AI Sales Assistant</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setIsMinimized(!isMinimized)}
            className="p-1.5 hover:bg-white/10 rounded-lg transition-colors"
          >
            {isMinimized ? <Maximize2 className="h-4 w-4" /> : <Minimize2 className="h-4 w-4" />}
          </button>
          <button
            onClick={() => setIsOpen(false)}
            className="p-1.5 hover:bg-white/10 rounded-lg transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Chat content (hidden when minimized) */}
      {!isMinimized && (
        <>
          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.map((message) => (
              <div
                key={message.id}
                className={cn(
                  'flex gap-2',
                  message.role === 'user' ? 'flex-row-reverse' : 'flex-row'
                )}
              >
                <div
                  className={cn(
                    'flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center',
                    message.role === 'user'
                      ? 'bg-blue-100 text-blue-600'
                      : 'bg-gradient-to-br from-indigo-500 to-purple-500 text-white'
                  )}
                >
                  {message.role === 'user' ? (
                    <User className="h-4 w-4" />
                  ) : (
                    <Bot className="h-4 w-4" />
                  )}
                </div>
                <div
                  className={cn(
                    'max-w-[75%] px-4 py-2 rounded-2xl text-sm',
                    message.role === 'user'
                      ? 'bg-blue-600 text-white rounded-br-md'
                      : 'bg-gray-100 text-gray-800 rounded-bl-md'
                  )}
                >
                  {/* Render markdown-like content */}
                  <div className="prose prose-sm max-w-none">
                    {message.content.split('\n').map((line, i) => {
                      // Handle bold text
                      const parts = line.split(/\*\*(.*?)\*\*/g);
                      return (
                        <p key={i} className={cn('mb-1 last:mb-0', message.role === 'user' && 'text-white')}>
                          {parts.map((part, j) =>
                            j % 2 === 1 ? (
                              <strong key={j}>{part}</strong>
                            ) : (
                              <span key={j}>{part}</span>
                            )
                          )}
                        </p>
                      );
                    })}
                  </div>
                </div>
              </div>
            ))}

            {/* Loading indicator */}
            {isLoading && (
              <div className="flex gap-2">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center">
                  <Bot className="h-4 w-4 text-white" />
                </div>
                <div className="bg-gray-100 rounded-2xl rounded-bl-md px-4 py-3">
                  <div className="flex gap-1">
                    <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Quick questions (show only initially) */}
          {messages.length <= 1 && (
            <div className="px-4 pb-2">
              <p className="text-xs text-gray-500 mb-2 flex items-center gap-1">
                <HelpCircle className="h-3 w-3" />
                Quick questions
              </p>
              <div className="flex flex-wrap gap-2">
                {QUICK_QUESTIONS.map((question) => (
                  <button
                    key={question}
                    onClick={() => handleQuickQuestion(question)}
                    disabled={isLoading}
                    className={cn(
                      'text-xs px-3 py-1.5 rounded-full',
                      'bg-blue-50 text-blue-600 border border-blue-100',
                      'hover:bg-blue-100 transition-colors',
                      'disabled:opacity-50 disabled:cursor-not-allowed',
                      'flex items-center gap-1'
                    )}
                  >
                    {question}
                    <ArrowRight className="h-3 w-3" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Input */}
          <form onSubmit={handleSubmit} className="p-4 border-t border-gray-100">
            <div className="flex gap-2">
              <input
                ref={inputRef}
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder="Ask Cloud anything..."
                disabled={isLoading}
                className={cn(
                  'flex-1 px-4 py-2 rounded-full text-sm',
                  'border border-gray-200 focus:border-blue-400',
                  'focus:outline-none focus:ring-2 focus:ring-blue-100',
                  'disabled:bg-gray-50 disabled:cursor-not-allowed'
                )}
              />
              <button
                type="submit"
                disabled={!inputValue.trim() || isLoading}
                className={cn(
                  'p-2 rounded-full',
                  'bg-blue-600 text-white',
                  'hover:bg-blue-700 transition-colors',
                  'disabled:bg-gray-300 disabled:cursor-not-allowed',
                  'flex items-center justify-center'
                )}
              >
                {isLoading ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <Send className="h-5 w-5" />
                )}
              </button>
            </div>
            <p className="text-xs text-gray-400 mt-2 text-center">
              Cloud can help with sales questions • Powered by AI
            </p>
          </form>
        </>
      )}
    </div>
  );
}

export default CloudChat;
