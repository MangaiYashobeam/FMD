/**
 * AI Agent Service for Facebook Navigation
 * 
 * Uses Claude/GPT to:
 * 1. Understand Facebook UI changes
 * 2. Find elements when selectors fail
 * 3. Generate human-like responses to leads
 * 4. Extract and qualify lead information
 * 5. Adapt to UI changes automatically
 * 
 * Supports both Anthropic Claude and OpenAI GPT-4
 */

import { logger } from '@/utils/logger';
import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';

// ============================================
// Types
// ============================================

export type AIProvider = 'anthropic' | 'openai';

export interface AIConfig {
  provider?: AIProvider;
  model?: string;
}

interface ElementFindRequest {
  description: string;
  pageHtml: string;
  screenshot?: string;
  previousAttempts?: string[];
}

interface ElementFindResult {
  selector: string;
  confidence: number;
  alternativeSelectors: string[];
  explanation: string;
}

interface LeadAnalysis {
  score: number; // 1-100
  intent: 'hot' | 'warm' | 'cold' | 'spam';
  buyingTimeline: 'immediate' | 'this_week' | 'this_month' | 'browsing' | 'unknown';
  hasTradeIn: boolean;
  isPreapproved: boolean;
  concerns: string[];
  suggestedResponse: string;
  extractedInfo: {
    name?: string;
    phone?: string;
    email?: string;
    preferredContact?: string;
    budget?: string;
  };
}

interface ResponseGeneration {
  message: string;
  tone: 'friendly' | 'professional' | 'urgent';
  includesCTA: boolean;
  suggestedFollowUp?: string;
}

// ============================================
// AI Navigation Agent (Multi-Provider)
// ============================================

export class AINavigationAgent {
  private anthropic: Anthropic | null = null;
  private openai: OpenAI | null = null;
  private defaultProvider: AIProvider;
  
  // Model configurations
  private readonly models = {
    anthropic: {
      default: 'claude-sonnet-4-20250514',
      fast: 'claude-3-haiku-20240307',
      powerful: 'claude-sonnet-4-20250514',
    },
    openai: {
      default: 'gpt-4o',
      fast: 'gpt-4o-mini',
      powerful: 'gpt-4o',
    },
  };
  
  constructor(config?: AIConfig) {
    // Initialize Anthropic if key exists
    if (process.env.ANTHROPIC_API_KEY) {
      this.anthropic = new Anthropic({
        apiKey: process.env.ANTHROPIC_API_KEY,
      });
    }
    
    // Initialize OpenAI if key exists
    if (process.env.OPENAI_API_KEY) {
      this.openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
      });
    }
    
    // Set default provider based on what's available
    if (config?.provider) {
      this.defaultProvider = config.provider;
    } else if (this.anthropic) {
      this.defaultProvider = 'anthropic';
    } else if (this.openai) {
      this.defaultProvider = 'openai';
    } else {
      logger.warn('No AI API keys configured. AI features will be disabled.');
      this.defaultProvider = 'anthropic'; // Fallback
    }
    
    logger.info(`AI Agent initialized with provider: ${this.defaultProvider}`);
  }
  
  /**
   * Generic completion method that works with both providers
   */
  private async complete(
    prompt: string,
    options: {
      maxTokens?: number;
      provider?: AIProvider;
      modelType?: 'default' | 'fast' | 'powerful';
      systemPrompt?: string;
    } = {}
  ): Promise<string> {
    const provider = options.provider || this.defaultProvider;
    const maxTokens = options.maxTokens || 1000;
    const modelType = options.modelType || 'default';
    
    if (provider === 'anthropic' && this.anthropic) {
      const model = this.models.anthropic[modelType];
      
      const response = await this.anthropic.messages.create({
        model,
        max_tokens: maxTokens,
        system: options.systemPrompt,
        messages: [{ role: 'user', content: prompt }],
      });
      
      return response.content[0].type === 'text' ? response.content[0].text : '';
    } else if (provider === 'openai' && this.openai) {
      const model = this.models.openai[modelType];
      
      const messages: OpenAI.ChatCompletionMessageParam[] = [];
      
      if (options.systemPrompt) {
        messages.push({ role: 'system', content: options.systemPrompt });
      }
      messages.push({ role: 'user', content: prompt });
      
      const response = await this.openai.chat.completions.create({
        model,
        max_tokens: maxTokens,
        messages,
      });
      
      return response.choices[0]?.message?.content || '';
    } else {
      throw new Error(`AI provider ${provider} not available. Check API keys.`);
    }
  }
  
  /**
   * Parse JSON from AI response (handles markdown code blocks)
   */
  private parseJSON<T>(text: string): T | null {
    // Try to find JSON in markdown code blocks
    const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (codeBlockMatch) {
      try {
        return JSON.parse(codeBlockMatch[1].trim());
      } catch {
        // Continue to other methods
      }
    }
    
    // Try to find raw JSON object
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        return JSON.parse(jsonMatch[0]);
      } catch {
        // Continue to other methods
      }
    }
    
    // Try parsing the whole response
    try {
      return JSON.parse(text);
    } catch {
      return null;
    }
  }
  
  /**
   * Find element using AI when CSS selector fails
   */
  async findElement(request: ElementFindRequest, provider?: AIProvider): Promise<ElementFindResult> {
    const prompt = `You are a web automation expert. A user is trying to find an element on a Facebook Marketplace page.

Element Description: "${request.description}"

Page HTML (truncated to relevant section):
\`\`\`html
${request.pageHtml.slice(0, 30000)}
\`\`\`

${request.previousAttempts?.length ? `
Previously tried selectors that failed:
${request.previousAttempts.map(s => `- ${s}`).join('\n')}
` : ''}

Find the CSS selector for this element. Consider:
1. ARIA labels and roles
2. Data attributes
3. Class names (Facebook uses generated classes, prefer stable attributes)
4. XPath if CSS is impossible
5. Text content matching

Return JSON only:
{
  "selector": "best CSS selector",
  "confidence": 0.0-1.0,
  "alternativeSelectors": ["backup1", "backup2"],
  "explanation": "why this selector works"
}`;

    try {
      const text = await this.complete(prompt, {
        maxTokens: 1000,
        provider,
        modelType: 'fast',
      });
      
      const result = this.parseJSON<ElementFindResult>(text);
      
      if (result) {
        return result;
      }
      
      throw new Error('Failed to parse AI response');
    } catch (error) {
      logger.error('AI element finding failed:', error);
      return {
        selector: '',
        confidence: 0,
        alternativeSelectors: [],
        explanation: 'AI failed to find element',
      };
    }
  }
  
  /**
   * Analyze conversation and extract lead information
   */
  async analyzeConversation(
    messages: { sender: string; text: string; timestamp?: string }[],
    vehicleInfo: {
      year: number;
      make: string;
      model: string;
      price: number;
      mileage: number;
    } | null,
    provider?: AIProvider
  ): Promise<LeadAnalysis> {
    const vehicleDescription = vehicleInfo 
      ? `Vehicle Being Discussed:
- ${vehicleInfo.year} ${vehicleInfo.make} ${vehicleInfo.model}
- Price: $${vehicleInfo.price.toLocaleString()}
- Mileage: ${vehicleInfo.mileage.toLocaleString()} miles`
      : 'Vehicle: Unknown (general inquiry)';

    const prompt = `You are an expert automotive sales AI assistant. Analyze this Facebook Marketplace conversation about a vehicle.

${vehicleDescription}

Conversation:
${messages.map(m => `${m.sender}: ${m.text}`).join('\n')}

Analyze the buyer's intent and extract information. Be realistic about intent - casual inquiries are "warm", specific questions about availability/test drives are "hot".

Return JSON only:
{
  "score": 1-100,
  "intent": "hot|warm|cold|spam",
  "buyingTimeline": "immediate|this_week|this_month|browsing|unknown",
  "hasTradeIn": boolean,
  "isPreapproved": boolean,
  "concerns": ["list of buyer concerns"],
  "suggestedResponse": "what to say next",
  "extractedInfo": {
    "name": "if mentioned",
    "phone": "if mentioned",
    "email": "if mentioned",
    "preferredContact": "phone/text/email if mentioned",
    "budget": "if mentioned"
  }
}`;

    try {
      const text = await this.complete(prompt, {
        maxTokens: 1500,
        provider,
        modelType: 'default',
      });
      
      const result = this.parseJSON<LeadAnalysis>(text);
      
      if (result) {
        return result;
      }
      
      throw new Error('Failed to parse AI response');
    } catch (error) {
      logger.error('AI conversation analysis failed:', error);
      return {
        score: 50,
        intent: 'warm',
        buyingTimeline: 'unknown',
        hasTradeIn: false,
        isPreapproved: false,
        concerns: [],
        suggestedResponse: 'Thank you for your interest! When would you like to come see it?',
        extractedInfo: {},
      };
    }
  }
  
  /**
   * Generate response to lead message
   */
  async generateLeadResponse(
    context: {
      dealerName: string;
      dealerPhone: string;
      dealerAddress: string;
      vehicleInfo: { year: number; make: string; model: string; price: number };
      conversationHistory: { sender: string; text: string }[];
      lastBuyerMessage: string;
      leadAnalysis: LeadAnalysis;
      tone?: 'friendly' | 'professional' | 'urgent';
    },
    provider?: AIProvider
  ): Promise<ResponseGeneration> {
    const prompt = `You are a friendly, professional auto sales assistant for ${context.dealerName}.

Vehicle: ${context.vehicleInfo.year} ${context.vehicleInfo.make} ${context.vehicleInfo.model} - $${context.vehicleInfo.price.toLocaleString()}

Previous conversation:
${context.conversationHistory.slice(-5).map(m => `${m.sender}: ${m.text}`).join('\n')}

Latest message from buyer: "${context.lastBuyerMessage}"

Lead Analysis:
- Intent: ${context.leadAnalysis.intent}
- Score: ${context.leadAnalysis.score}/100
- Concerns: ${context.leadAnalysis.concerns.join(', ') || 'None noted'}

Dealership Info:
- Phone: ${context.dealerPhone}
- Address: ${context.dealerAddress}

Write a response that:
1. Is friendly and conversational (not salesy)
2. Addresses their specific question or concern
3. Moves toward scheduling a visit/test drive if appropriate
4. Is 1-3 sentences max
5. ${context.leadAnalysis.intent === 'hot' ? 'Creates urgency - this is a hot lead!' : 'Builds rapport without pressure'}

Return JSON only:
{
  "message": "your response here",
  "tone": "friendly|professional|urgent",
  "includesCTA": boolean,
  "suggestedFollowUp": "what to do if no reply in 24h"
}`;

    try {
      const text = await this.complete(prompt, {
        maxTokens: 500,
        provider,
        modelType: 'default',
      });
      
      const result = this.parseJSON<ResponseGeneration>(text);
      
      if (result) {
        return result;
      }
      
      throw new Error('Failed to parse AI response');
    } catch (error) {
      logger.error('AI response generation failed:', error);
      return {
        message: `Thanks for reaching out! Yes, the ${context.vehicleInfo.year} ${context.vehicleInfo.make} ${context.vehicleInfo.model} is available. Would you like to come see it? Call us at ${context.dealerPhone}!`,
        tone: 'friendly',
        includesCTA: true,
      };
    }
  }
  
  /**
   * Detect UI changes and update selectors
   */
  async detectUIChanges(
    oldSelectors: Record<string, string>,
    newPageHtml: string,
    provider?: AIProvider
  ): Promise<{
    hasChanges: boolean;
    updatedSelectors: Record<string, string>;
    changes: string[];
  }> {
    const prompt = `You are a web automation expert. Facebook has potentially updated their Marketplace UI.

Old selectors we were using:
${JSON.stringify(oldSelectors, null, 2)}

New page HTML (truncated):
\`\`\`html
${newPageHtml.slice(0, 40000)}
\`\`\`

Check if the old selectors still work. If not, provide updated selectors.

Return JSON only:
{
  "hasChanges": boolean,
  "updatedSelectors": { "selectorName": "new selector" },
  "changes": ["description of what changed"]
}`;

    try {
      const text = await this.complete(prompt, {
        maxTokens: 2000,
        provider,
        modelType: 'powerful',
      });
      
      const result = this.parseJSON<{
        hasChanges: boolean;
        updatedSelectors: Record<string, string>;
        changes: string[];
      }>(text);
      
      if (result) {
        return result;
      }
      
      throw new Error('Failed to parse AI response');
    } catch (error) {
      logger.error('AI UI detection failed:', error);
      return {
        hasChanges: false,
        updatedSelectors: oldSelectors,
        changes: [],
      };
    }
  }
  
  /**
   * Generate vehicle description from images and data
   */
  async generateVehicleDescription(
    vehicle: {
      year: number;
      make: string;
      model: string;
      trim?: string;
      mileage: number;
      price: number;
      features?: string[];
      condition?: string;
    },
    provider?: AIProvider
  ): Promise<string> {
    const prompt = `Write a compelling but honest Facebook Marketplace listing description for this vehicle:

Vehicle: ${vehicle.year} ${vehicle.make} ${vehicle.model} ${vehicle.trim || ''}
Mileage: ${vehicle.mileage.toLocaleString()} miles
Price: $${vehicle.price.toLocaleString()}
${vehicle.features?.length ? `Features: ${vehicle.features.join(', ')}` : ''}
${vehicle.condition ? `Condition: ${vehicle.condition}` : ''}

Guidelines:
- Keep it under 500 characters
- Highlight key selling points
- Be honest, don't oversell
- Include a call to action
- Use emojis sparingly (1-2 max)
- Don't use ALL CAPS
- Sound like a real person, not a robot

Write the description only, no explanations:`;

    try {
      const text = await this.complete(prompt, {
        maxTokens: 300,
        provider,
        modelType: 'fast',
      });
      
      return text.trim();
    } catch (error) {
      logger.error('AI description generation failed:', error);
      return `${vehicle.year} ${vehicle.make} ${vehicle.model} - ${vehicle.mileage.toLocaleString()} miles. Great condition! Message for details.`;
    }
  }
  
  /**
   * Get current AI provider and available providers
   */
  getProviderInfo(): {
    current: AIProvider;
    available: AIProvider[];
    models: {
      anthropic: { default: string; fast: string; powerful: string };
      openai: { default: string; fast: string; powerful: string };
    };
  } {
    const available: AIProvider[] = [];
    if (this.anthropic) available.push('anthropic');
    if (this.openai) available.push('openai');
    
    return {
      current: this.defaultProvider,
      available,
      models: this.models,
    };
  }
  
  /**
   * Switch default provider
   */
  setProvider(provider: AIProvider): boolean {
    if (provider === 'anthropic' && this.anthropic) {
      this.defaultProvider = 'anthropic';
      return true;
    }
    if (provider === 'openai' && this.openai) {
      this.defaultProvider = 'openai';
      return true;
    }
    return false;
  }
}

// ============================================
// Export
// ============================================

export const aiAgent = new AINavigationAgent();
export default aiAgent;
