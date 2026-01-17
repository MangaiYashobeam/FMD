/**
 * AI Agent Service for Facebook Navigation
 * 
 * Uses Claude/GPT to:
 * 1. Understand Facebook UI changes
 * 2. Find elements when selectors fail
 * 3. Generate human-like responses to leads
 * 4. Extract and qualify lead information
 * 5. Adapt to UI changes automatically
 */

import { logger } from '@/utils/logger';
import Anthropic from '@anthropic-ai/sdk';

// ============================================
// Types
// ============================================

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
// AI Navigation Agent
// ============================================

export class AINavigationAgent {
  private anthropic: Anthropic;
  
  constructor() {
    this.anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY || '',
    });
  }
  
  /**
   * Find element using AI when CSS selector fails
   */
  async findElement(request: ElementFindRequest): Promise<ElementFindResult> {
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
      const response = await this.anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1000,
        messages: [{ role: 'user', content: prompt }],
      });
      
      const text = response.content[0].type === 'text' ? response.content[0].text : '';
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
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
  async analyzeConversation(messages: { sender: string; text: string; timestamp: string }[], vehicleInfo: {
    year: number;
    make: string;
    model: string;
    price: number;
    mileage: number;
  }): Promise<LeadAnalysis> {
    const prompt = `You are an expert automotive sales AI assistant. Analyze this Facebook Marketplace conversation about a vehicle.

Vehicle Being Discussed:
- ${vehicleInfo.year} ${vehicleInfo.make} ${vehicleInfo.model}
- Price: $${vehicleInfo.price.toLocaleString()}
- Mileage: ${vehicleInfo.mileage.toLocaleString()} miles

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
      const response = await this.anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1500,
        messages: [{ role: 'user', content: prompt }],
      });
      
      const text = response.content[0].type === 'text' ? response.content[0].text : '';
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
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
  async generateLeadResponse(context: {
    dealerName: string;
    dealerPhone: string;
    dealerAddress: string;
    vehicleInfo: { year: number; make: string; model: string; price: number };
    conversationHistory: { sender: string; text: string }[];
    lastBuyerMessage: string;
    leadAnalysis: LeadAnalysis;
    tone?: 'friendly' | 'professional' | 'urgent';
  }): Promise<ResponseGeneration> {
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
      const response = await this.anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 500,
        messages: [{ role: 'user', content: prompt }],
      });
      
      const text = response.content[0].type === 'text' ? response.content[0].text : '';
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
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
  async detectUIChanges(oldSelectors: Record<string, string>, newPageHtml: string): Promise<{
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
      const response = await this.anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2000,
        messages: [{ role: 'user', content: prompt }],
      });
      
      const text = response.content[0].type === 'text' ? response.content[0].text : '';
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
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
  async generateVehicleDescription(vehicle: {
    year: number;
    make: string;
    model: string;
    trim?: string;
    mileage: number;
    price: number;
    features?: string[];
    condition?: string;
  }): Promise<string> {
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
      const response = await this.anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 300,
        messages: [{ role: 'user', content: prompt }],
      });
      
      return response.content[0].type === 'text' ? response.content[0].text : '';
    } catch (error) {
      logger.error('AI description generation failed:', error);
      return `${vehicle.year} ${vehicle.make} ${vehicle.model} - ${vehicle.mileage.toLocaleString()} miles. Great condition! Message for details.`;
    }
  }
}

// ============================================
// Export
// ============================================

export const aiAgent = new AINavigationAgent();
export default aiAgent;
