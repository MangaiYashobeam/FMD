/**
 * Nova HTML Code Editor
 * 
 * Production-grade code editor with syntax highlighting,
 * DOM analysis, document fetching, and real-time validation.
 */

import React, { useState, useCallback, useEffect, useRef } from 'react';

interface CodeEditorProps {
  initialValue?: string;
  language?: 'html' | 'css' | 'javascript' | 'json' | 'typescript';
  onChange?: (value: string) => void;
  onSave?: (value: string) => Promise<void>;
  readOnly?: boolean;
  filePath?: string;
}

interface DOMAnalysis {
  totalElements: number;
  tagCounts: Record<string, number>;
  uniqueTags: { tag: string; count: number }[];
  ids: string[];
  classes: string[];
  size: number;
  lines: number;
  hasDoctype: boolean;
  hasHead: boolean;
  hasBody: boolean;
}

interface ValidationIssue {
  type: 'error' | 'warning';
  message: string;
  line?: number;
}

interface ValidationResult {
  valid: boolean;
  errorCount: number;
  warningCount: number;
  issues: ValidationIssue[];
}

// Syntax highlighting themes
const SYNTAX_COLORS = {
  tag: '#e06c75',
  attribute: '#d19a66',
  string: '#98c379',
  comment: '#5c6370',
  keyword: '#c678dd',
  function: '#61afef',
  number: '#d19a66',
  punctuation: '#abb2bf',
  default: '#abb2bf',
};

// Token types for syntax highlighting
type TokenType = keyof typeof SYNTAX_COLORS;

interface Token {
  type: TokenType;
  value: string;
}

// Simple HTML tokenizer
function tokenizeHTML(code: string): Token[] {
  const tokens: Token[] = [];
  const regex = /(<!--[\s\S]*?-->)|(<\/?[\w-]+)|(\s[\w-]+=)|(["'][^"']*["'])|([^<>"'=\s]+)/g;
  let match;
  let lastIndex = 0;

  while ((match = regex.exec(code)) !== null) {
    // Add any skipped text
    if (match.index > lastIndex) {
      tokens.push({ type: 'default', value: code.slice(lastIndex, match.index) });
    }
    lastIndex = regex.lastIndex;

    const [full, comment, tag, attr, str] = match;
    
    if (comment) {
      tokens.push({ type: 'comment', value: comment });
    } else if (tag) {
      tokens.push({ type: 'tag', value: tag });
    } else if (attr) {
      tokens.push({ type: 'attribute', value: attr });
    } else if (str) {
      tokens.push({ type: 'string', value: str });
    } else {
      tokens.push({ type: 'punctuation', value: full });
    }
  }

  // Add remaining text
  if (lastIndex < code.length) {
    tokens.push({ type: 'default', value: code.slice(lastIndex) });
  }

  return tokens;
}

export function NovaCodeEditor({
  initialValue = '',
  language = 'html',
  onChange,
  onSave,
  readOnly = false,
  filePath,
}: CodeEditorProps) {
  const [value, setValue] = useState(initialValue);
  const [domAnalysis, setDomAnalysis] = useState<DOMAnalysis | null>(null);
  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [fetchUrl, setFetchUrl] = useState('');
  const [isFetching, setIsFetching] = useState(false);
  const [showLineNumbers, setShowLineNumbers] = useState(true);
  const [activeTab, setActiveTab] = useState<'editor' | 'analysis' | 'validation'>('editor');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const preRef = useRef<HTMLPreElement>(null);

  // Sync scroll between textarea and highlighted view
  const syncScroll = useCallback(() => {
    if (textareaRef.current && preRef.current) {
      preRef.current.scrollTop = textareaRef.current.scrollTop;
      preRef.current.scrollLeft = textareaRef.current.scrollLeft;
    }
  }, []);

  // Handle value change
  const handleChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    setValue(newValue);
    onChange?.(newValue);
  }, [onChange]);

  // Get auth token
  const getAuthToken = () => {
    const stored = localStorage.getItem('auth_data');
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        return parsed.token;
      } catch {
        return null;
      }
    }
    return null;
  };

  // Analyze DOM
  const analyzeDOM = useCallback(async () => {
    if (!value.trim()) return;
    
    setIsAnalyzing(true);
    try {
      const token = getAuthToken();
      const response = await fetch('/api/ai-center/nova/dom/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ html: value }),
      });
      
      const result = await response.json();
      if (result.success) {
        setDomAnalysis(result.data);
        setActiveTab('analysis');
      }
    } catch (error) {
      console.error('DOM analysis failed:', error);
    } finally {
      setIsAnalyzing(false);
    }
  }, [value]);

  // Validate HTML
  const validateHTML = useCallback(async () => {
    if (!value.trim()) return;
    
    setIsValidating(true);
    try {
      const token = getAuthToken();
      const response = await fetch('/api/ai-center/nova/dom/validate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ html: value }),
      });
      
      const result = await response.json();
      if (result.success) {
        setValidation(result.data);
        setActiveTab('validation');
      }
    } catch (error) {
      console.error('Validation failed:', error);
    } finally {
      setIsValidating(false);
    }
  }, [value]);

  // Save file
  const handleSave = useCallback(async () => {
    if (!onSave) return;
    
    setIsSaving(true);
    try {
      await onSave(value);
    } catch (error) {
      console.error('Save failed:', error);
    } finally {
      setIsSaving(false);
    }
  }, [value, onSave]);

  // Fetch document from URL
  const fetchDocument = useCallback(async () => {
    if (!fetchUrl.trim()) return;
    
    setIsFetching(true);
    try {
      const token = getAuthToken();
      const response = await fetch('/api/ai-center/nova/fetch/document', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ url: fetchUrl, type: 'html' }),
      });
      
      const result = await response.json();
      if (result.success && result.data.content) {
        setValue(result.data.content);
        onChange?.(result.data.content);
      }
    } catch (error) {
      console.error('Fetch failed:', error);
    } finally {
      setIsFetching(false);
    }
  }, [fetchUrl, onChange]);

  // Format HTML
  const formatHTML = useCallback(async () => {
    try {
      const token = getAuthToken();
      const response = await fetch('/api/ai-center/nova/dom/transform', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          html: value,
          operations: [{ type: 'formatHtml' }],
        }),
      });
      
      const result = await response.json();
      if (result.success && result.data.result) {
        setValue(result.data.result);
        onChange?.(result.data.result);
      }
    } catch (error) {
      console.error('Format failed:', error);
    }
  }, [value, onChange]);

  // Minify HTML
  const minifyHTML = useCallback(async () => {
    try {
      const token = getAuthToken();
      const response = await fetch('/api/ai-center/nova/dom/transform', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          html: value,
          operations: [{ type: 'minify' }],
        }),
      });
      
      const result = await response.json();
      if (result.success && result.data.result) {
        setValue(result.data.result);
        onChange?.(result.data.result);
      }
    } catch (error) {
      console.error('Minify failed:', error);
    }
  }, [value, onChange]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        handleSave();
      }
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'F') {
        e.preventDefault();
        formatHTML();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleSave, formatHTML]);

  // Get line numbers
  const lines = value.split('\n');
  const lineCount = lines.length;

  // Render highlighted code
  const renderHighlightedCode = () => {
    if (language !== 'html') {
      return <span style={{ color: SYNTAX_COLORS.default }}>{value}</span>;
    }

    const tokens = tokenizeHTML(value);
    return tokens.map((token, i) => (
      <span key={i} style={{ color: SYNTAX_COLORS[token.type] }}>
        {token.value}
      </span>
    ));
  };

  return (
    <div className="nova-code-editor flex flex-col h-full bg-[#1e1e2e] rounded-lg overflow-hidden border border-purple-500/20">
      {/* Toolbar */}
      <div className="toolbar flex items-center gap-2 p-2 bg-[#181825] border-b border-purple-500/20">
        {filePath && (
          <span className="text-purple-300 text-sm px-2 py-1 bg-purple-500/10 rounded">
            📄 {filePath}
          </span>
        )}
        
        <div className="flex items-center gap-1 ml-auto">
          {/* Document Fetch */}
          <div className="flex items-center gap-1">
            <input
              type="text"
              placeholder="Enter URL to fetch..."
              value={fetchUrl}
              onChange={(e) => setFetchUrl(e.target.value)}
              className="px-2 py-1 text-sm bg-[#313244] text-white rounded border border-purple-500/30 focus:border-purple-500 focus:outline-none w-48"
            />
            <button
              onClick={fetchDocument}
              disabled={isFetching || !fetchUrl.trim()}
              className="px-3 py-1 text-sm bg-purple-600 hover:bg-purple-500 text-white rounded disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isFetching ? '...' : '🌐 Fetch'}
            </button>
          </div>

          <div className="w-px h-6 bg-purple-500/30 mx-2" />

          {/* Editor Actions */}
          <button
            onClick={formatHTML}
            className="px-3 py-1 text-sm bg-[#313244] hover:bg-[#45475a] text-purple-300 rounded transition-colors"
            title="Format HTML (Ctrl+Shift+F)"
          >
            ✨ Format
          </button>
          <button
            onClick={minifyHTML}
            className="px-3 py-1 text-sm bg-[#313244] hover:bg-[#45475a] text-purple-300 rounded transition-colors"
            title="Minify HTML"
          >
            📦 Minify
          </button>
          <button
            onClick={analyzeDOM}
            disabled={isAnalyzing}
            className="px-3 py-1 text-sm bg-[#313244] hover:bg-[#45475a] text-blue-300 rounded disabled:opacity-50 transition-colors"
          >
            {isAnalyzing ? '...' : '🔍 Analyze'}
          </button>
          <button
            onClick={validateHTML}
            disabled={isValidating}
            className="px-3 py-1 text-sm bg-[#313244] hover:bg-[#45475a] text-green-300 rounded disabled:opacity-50 transition-colors"
          >
            {isValidating ? '...' : '✓ Validate'}
          </button>
          <button
            onClick={() => setShowPreview(!showPreview)}
            className={`px-3 py-1 text-sm rounded transition-colors ${
              showPreview 
                ? 'bg-purple-600 text-white' 
                : 'bg-[#313244] hover:bg-[#45475a] text-purple-300'
            }`}
          >
            👁 Preview
          </button>

          {onSave && (
            <button
              onClick={handleSave}
              disabled={isSaving || readOnly}
              className="px-3 py-1 text-sm bg-green-600 hover:bg-green-500 text-white rounded disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              title="Save (Ctrl+S)"
            >
              {isSaving ? 'Saving...' : '💾 Save'}
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="tabs flex border-b border-purple-500/20 bg-[#181825]">
        <button
          onClick={() => setActiveTab('editor')}
          className={`px-4 py-2 text-sm transition-colors ${
            activeTab === 'editor'
              ? 'bg-[#1e1e2e] text-purple-300 border-b-2 border-purple-500'
              : 'text-gray-400 hover:text-gray-200'
          }`}
        >
          Editor
        </button>
        <button
          onClick={() => setActiveTab('analysis')}
          className={`px-4 py-2 text-sm transition-colors ${
            activeTab === 'analysis'
              ? 'bg-[#1e1e2e] text-purple-300 border-b-2 border-purple-500'
              : 'text-gray-400 hover:text-gray-200'
          }`}
        >
          Analysis {domAnalysis && `(${domAnalysis.totalElements})`}
        </button>
        <button
          onClick={() => setActiveTab('validation')}
          className={`px-4 py-2 text-sm transition-colors ${
            activeTab === 'validation'
              ? 'bg-[#1e1e2e] text-purple-300 border-b-2 border-purple-500'
              : 'text-gray-400 hover:text-gray-200'
          }`}
        >
          Validation {validation && (
            <span className={validation.valid ? 'text-green-400' : 'text-red-400'}>
              ({validation.errorCount}E/{validation.warningCount}W)
            </span>
          )}
        </button>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Editor Tab */}
        {activeTab === 'editor' && (
          <div className={`flex-1 flex ${showPreview ? 'w-1/2' : 'w-full'}`}>
            {/* Line Numbers */}
            {showLineNumbers && (
              <div className="line-numbers select-none bg-[#181825] text-gray-500 text-right px-2 py-3 text-sm font-mono border-r border-purple-500/20 overflow-hidden">
                {Array.from({ length: lineCount }, (_, i) => (
                  <div key={i + 1} className="leading-6">
                    {i + 1}
                  </div>
                ))}
              </div>
            )}

            {/* Code Editor */}
            <div className="code-area relative flex-1 overflow-hidden">
              {/* Highlighted Background */}
              <pre
                ref={preRef}
                className="absolute inset-0 p-3 text-sm font-mono leading-6 overflow-auto pointer-events-none whitespace-pre-wrap break-words"
                aria-hidden="true"
              >
                <code>{renderHighlightedCode()}</code>
              </pre>

              {/* Actual Textarea */}
              <textarea
                ref={textareaRef}
                value={value}
                onChange={handleChange}
                onScroll={syncScroll}
                readOnly={readOnly}
                spellCheck={false}
                className="absolute inset-0 w-full h-full p-3 text-sm font-mono leading-6 bg-transparent text-transparent caret-white resize-none focus:outline-none"
                style={{ WebkitTextFillColor: 'transparent' }}
              />
            </div>
          </div>
        )}

        {/* Analysis Tab */}
        {activeTab === 'analysis' && (
          <div className="flex-1 p-4 overflow-auto text-white">
            {domAnalysis ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-[#313244] p-3 rounded">
                    <div className="text-2xl font-bold text-purple-400">{domAnalysis.totalElements}</div>
                    <div className="text-sm text-gray-400">Total Elements</div>
                  </div>
                  <div className="bg-[#313244] p-3 rounded">
                    <div className="text-2xl font-bold text-blue-400">{domAnalysis.uniqueTags.length}</div>
                    <div className="text-sm text-gray-400">Unique Tags</div>
                  </div>
                  <div className="bg-[#313244] p-3 rounded">
                    <div className="text-2xl font-bold text-green-400">{domAnalysis.lines}</div>
                    <div className="text-sm text-gray-400">Lines</div>
                  </div>
                  <div className="bg-[#313244] p-3 rounded">
                    <div className="text-2xl font-bold text-yellow-400">{(domAnalysis.size / 1024).toFixed(1)}KB</div>
                    <div className="text-sm text-gray-400">Size</div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className={`p-2 rounded text-center ${domAnalysis.hasDoctype ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                    {domAnalysis.hasDoctype ? '✓' : '✗'} DOCTYPE
                  </div>
                  <div className={`p-2 rounded text-center ${domAnalysis.hasHead ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'}`}>
                    {domAnalysis.hasHead ? '✓' : '!'} &lt;head&gt;
                  </div>
                  <div className={`p-2 rounded text-center ${domAnalysis.hasBody ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'}`}>
                    {domAnalysis.hasBody ? '✓' : '!'} &lt;body&gt;
                  </div>
                </div>

                <div>
                  <h3 className="text-lg font-semibold text-purple-300 mb-2">Tag Distribution</h3>
                  <div className="space-y-1">
                    {domAnalysis.uniqueTags.slice(0, 15).map((tag) => (
                      <div key={tag.tag} className="flex items-center gap-2">
                        <span className="text-blue-400 font-mono text-sm w-20">&lt;{tag.tag}&gt;</span>
                        <div className="flex-1 bg-[#313244] rounded-full h-4 overflow-hidden">
                          <div
                            className="bg-purple-500 h-full rounded-full"
                            style={{ width: `${(tag.count / domAnalysis.totalElements) * 100}%` }}
                          />
                        </div>
                        <span className="text-gray-400 text-sm w-8">{tag.count}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {domAnalysis.ids.length > 0 && (
                  <div>
                    <h3 className="text-lg font-semibold text-purple-300 mb-2">IDs ({domAnalysis.ids.length})</h3>
                    <div className="flex flex-wrap gap-1">
                      {domAnalysis.ids.slice(0, 20).map((id) => (
                        <span key={id} className="px-2 py-1 bg-green-500/20 text-green-400 rounded text-sm font-mono">
                          #{id}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {domAnalysis.classes.length > 0 && (
                  <div>
                    <h3 className="text-lg font-semibold text-purple-300 mb-2">Classes ({domAnalysis.classes.length})</h3>
                    <div className="flex flex-wrap gap-1">
                      {domAnalysis.classes.slice(0, 30).map((cls, i) => (
                        <span key={`${cls}-${i}`} className="px-2 py-1 bg-blue-500/20 text-blue-400 rounded text-sm font-mono">
                          .{cls}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center text-gray-400 mt-10">
                Click "Analyze" to inspect the DOM structure
              </div>
            )}
          </div>
        )}

        {/* Validation Tab */}
        {activeTab === 'validation' && (
          <div className="flex-1 p-4 overflow-auto text-white">
            {validation ? (
              <div className="space-y-4">
                <div className={`p-4 rounded-lg ${validation.valid ? 'bg-green-500/20' : 'bg-red-500/20'}`}>
                  <div className="flex items-center gap-3">
                    <span className={`text-3xl ${validation.valid ? 'text-green-400' : 'text-red-400'}`}>
                      {validation.valid ? '✓' : '✗'}
                    </span>
                    <div>
                      <div className={`text-xl font-bold ${validation.valid ? 'text-green-400' : 'text-red-400'}`}>
                        {validation.valid ? 'Valid HTML' : 'Invalid HTML'}
                      </div>
                      <div className="text-sm text-gray-300">
                        {validation.errorCount} errors, {validation.warningCount} warnings
                      </div>
                    </div>
                  </div>
                </div>

                {validation.issues.length > 0 && (
                  <div className="space-y-2">
                    {validation.issues.map((issue, i) => (
                      <div
                        key={i}
                        className={`p-3 rounded flex items-start gap-3 ${
                          issue.type === 'error' ? 'bg-red-500/10 border-l-4 border-red-500' : 'bg-yellow-500/10 border-l-4 border-yellow-500'
                        }`}
                      >
                        <span className={issue.type === 'error' ? 'text-red-400' : 'text-yellow-400'}>
                          {issue.type === 'error' ? '✗' : '!'}
                        </span>
                        <div className="flex-1">
                          <div className={issue.type === 'error' ? 'text-red-300' : 'text-yellow-300'}>
                            {issue.message}
                          </div>
                          {issue.line && (
                            <div className="text-sm text-gray-400">Line {issue.line}</div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center text-gray-400 mt-10">
                Click "Validate" to check for HTML issues
              </div>
            )}
          </div>
        )}

        {/* Preview Panel */}
        {showPreview && activeTab === 'editor' && (
          <div className="w-1/2 border-l border-purple-500/20 overflow-auto bg-white">
            <iframe
              srcDoc={value}
              title="HTML Preview"
              className="w-full h-full"
              sandbox="allow-scripts"
            />
          </div>
        )}
      </div>

      {/* Status Bar */}
      <div className="status-bar flex items-center justify-between px-3 py-1 bg-[#181825] border-t border-purple-500/20 text-xs text-gray-400">
        <div className="flex items-center gap-4">
          <span>Lines: {lineCount}</span>
          <span>Characters: {value.length}</span>
          <span>Language: {language.toUpperCase()}</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowLineNumbers(!showLineNumbers)}
            className="hover:text-purple-300"
          >
            {showLineNumbers ? '✓' : '○'} Line Numbers
          </button>
          <span>Powered by Nova</span>
        </div>
      </div>
    </div>
  );
}

export default NovaCodeEditor;
