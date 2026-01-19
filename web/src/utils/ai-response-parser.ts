/**
 * AI Response Parser
 * 
 * Parses Nova's responses to separate:
 * - AI Thoughts (tool calls like [[TOOL:...]])
 * - Tool Results (injected data)
 * - Final Answer (the actual response to show user)
 */

export interface ParsedAIResponse {
  thoughts: string[];      // Tool calls Nova made
  toolResults: string[];   // Results from tools
  answer: string;          // Clean answer without tool syntax
  hasTools: boolean;       // Whether response contains tool activity
}

/**
 * Parse an AI response to extract thoughts and clean answer
 */
export function parseAIResponse(content: string): ParsedAIResponse {
  const thoughts: string[] = [];
  const toolResults: string[] = [];
  
  // Extract [[TOOL:...]] commands
  const toolPattern = /\[\[TOOL:(\w+):?(.*?)\]\]/g;
  let match;
  while ((match = toolPattern.exec(content)) !== null) {
    const [, action, params] = match;
    thoughts.push(`🔧 ${action}: ${params || '(no params)'}`);
  }
  
  // Extract === TOOL RESULT: ... === sections
  const resultPattern = /=== TOOL RESULT: (\w+) ===([\s\S]*?)=== END TOOL RESULT ===/g;
  while ((match = resultPattern.exec(content)) !== null) {
    const [, tool, result] = match;
    toolResults.push(`📊 ${tool}:\n${result.trim().substring(0, 500)}${result.length > 500 ? '...' : ''}`);
  }
  
  // Clean the answer - remove tool syntax
  let answer = content
    // Remove [[TOOL:...]] calls
    .replace(/\[\[TOOL:\w+:?.*?\]\]/g, '')
    // Remove tool result blocks
    .replace(/=== TOOL RESULT:[\s\S]*?=== END TOOL RESULT ===/g, '')
    // Remove "Let me..." preambles about tools
    .replace(/Let me (start by |first |)?(check|explore|search|read|list|query).*?\n/gi, '')
    // Remove empty lines from removed content
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  
  // If answer is empty after cleaning, the whole thing was tool calls
  if (!answer || answer.length < 20) {
    answer = '🔄 Processing your request...';
  }
  
  return {
    thoughts,
    toolResults,
    answer,
    hasTools: thoughts.length > 0 || toolResults.length > 0
  };
}

/**
 * Format thoughts for display in collapsible section
 */
export function formatThoughtsForDisplay(parsed: ParsedAIResponse): string {
  const parts: string[] = [];
  
  if (parsed.thoughts.length > 0) {
    parts.push('🧠 Tool Calls:');
    parts.push(...parsed.thoughts.map(t => `  ${t}`));
  }
  
  if (parsed.toolResults.length > 0) {
    parts.push('\n📋 Results:');
    parts.push(...parsed.toolResults.map(r => `  ${r}`));
  }
  
  return parts.join('\n');
}
