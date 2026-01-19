/**
 * Cloud Controller - AI Sales Assistant Chat System
 * 
 * Cloud is the AI-powered sales assistant that:
 * - Knows everything about the DealersFace platform
 * - Understands the 3 posting methods (IAI, API, Pixel)
 * - Can help potential customers learn about features
 * - Handles pre-sales questions
 * - Guides users through the platform
 * - Has deep product knowledge but no root access
 */

import { Response, Request } from 'express';
import { logger } from '@/utils/logger';

// Cloud's Knowledge Base - The "brain" of the sales assistant
const CLOUD_KNOWLEDGE_BASE = {
  identity: {
    name: 'Cloud',
    role: 'AI Sales Assistant',
    personality: 'Friendly, knowledgeable, professional, helpful',
    constraints: 'No system access, cannot make changes, sales-focused',
  },
  
  product: {
    name: 'DealersFace',
    tagline: 'Professional Facebook Marketplace Automation for Auto Dealers',
    description: 'DealersFace helps auto dealerships automate their Facebook Marketplace listings, manage leads, and grow their online presence.',
    
    features: [
      {
        name: 'Inventory Sync',
        description: 'Automatically sync your inventory from your DMS via FTP/API',
        benefits: ['Save hours of manual data entry', 'Real-time inventory updates', 'Automatic sold status tracking'],
      },
      {
        name: 'Facebook Marketplace Posting',
        description: 'Post vehicles to Facebook Marketplace using our IAI automation',
        benefits: ['Reach millions of buyers', 'Automated posting', 'Professional listings'],
      },
      {
        name: 'Lead Management',
        description: 'Capture and manage leads from Facebook inquiries',
        benefits: ['Never miss a lead', 'AI-powered responses', 'CRM integration'],
      },
      {
        name: 'AI Message Response',
        description: 'AI generates responses to Facebook messages about your vehicles',
        benefits: ['24/7 response capability', 'Consistent messaging', 'Qualify leads automatically'],
      },
    ],
  },
  
  postingMethods: {
    iai: {
      name: 'IAI Soldier (Browser Automation)',
      status: 'RECOMMENDED',
      description: 'Our intelligent browser automation system that mimics human behavior to post listings on Facebook Marketplace',
      howItWorks: [
        'Install our Chrome Extension',
        'Log into Facebook in Chrome',
        'Select vehicles to post from your dashboard',
        'IAI Soldier fills out the Marketplace form automatically',
        'Review and click Publish',
      ],
      pros: ['Works with any Facebook account', 'Creates actual Marketplace listings', 'Human-like behavior avoids detection', 'Full feature support'],
      cons: ['Requires Chrome extension', 'Requires Facebook tab open', 'Manual publish step for safety'],
      successRate: '95%+',
    },
    api: {
      name: 'Facebook Graph API',
      status: 'LIMITED',
      description: 'Official Facebook API integration for posting to Facebook Pages',
      howItWorks: [
        'Connect your Facebook Business Page',
        'Authorize DealersFace app permissions',
        'Post directly to your Page (not Marketplace)',
      ],
      pros: ['Official API', 'No extension needed', 'Reliable for Page posts'],
      cons: ['CANNOT post to Marketplace (Facebook does not offer this API)', 'Requires Business verification', 'Limited to Page posts only'],
      important: 'Facebook has NO public API for Marketplace listings. This is an industry-wide limitation.',
    },
    pixel: {
      name: 'Facebook Pixel',
      status: 'TRACKING ONLY',
      description: 'Track conversions and enable retargeting, but cannot create listings',
      howItWorks: [
        'Add your Facebook Pixel ID in settings',
        'Pixel fires when users view vehicles',
        'Track leads and conversions',
        'Enable Facebook retargeting ads',
      ],
      pros: ['Great for analytics', 'Enables retargeting', 'Tracks ROI'],
      cons: ['Cannot create listings', 'Cannot post to Marketplace'],
      note: 'Pixel is for tracking, not posting. Use IAI for actual Marketplace listings.',
    },
  },
  
  pricing: {
    trial: {
      name: 'Free Trial',
      duration: '14 days',
      features: ['Full access to all features', 'Up to 50 vehicle listings', 'Email support'],
    },
    starter: {
      name: 'Starter',
      price: '$99/month',
      features: ['Up to 100 listings', 'Inventory sync', 'Basic lead management', 'Email support'],
    },
    professional: {
      name: 'Professional',
      price: '$199/month',
      features: ['Up to 500 listings', 'AI message responses', 'Advanced analytics', 'Priority support'],
      popular: true,
    },
    enterprise: {
      name: 'Enterprise',
      price: 'Custom',
      features: ['Unlimited listings', 'Multi-location support', 'API access', 'Dedicated account manager'],
    },
  },
  
  faq: [
    {
      question: 'Can DealersFace automatically post to Facebook Marketplace?',
      answer: 'Yes! Our IAI Soldier uses browser automation to create Marketplace listings. Facebook does not offer a public API for Marketplace, so browser automation is the only way to achieve this.',
    },
    {
      question: 'Is this against Facebook terms of service?',
      answer: 'Browser automation tools are used industry-wide for legitimate business purposes. Our IAI system mimics human behavior and operates within reasonable usage limits. However, users are responsible for their own Facebook account compliance.',
    },
    {
      question: 'Why can\'t you use Facebook\'s API to post to Marketplace?',
      answer: 'Facebook does not offer a public API for Marketplace listings. This is intentional on Facebook\'s part. The Graph API only allows posting to Pages, not Marketplace. Every tool claiming to "API post" to Marketplace is actually using browser automation.',
    },
    {
      question: 'How do I get started?',
      answer: '1) Sign up for a free trial, 2) Connect your inventory source (FTP or manual), 3) Install our Chrome extension, 4) Log into Facebook, 5) Start posting vehicles!',
    },
    {
      question: 'Do you offer refunds?',
      answer: 'We offer a 14-day free trial so you can test everything before paying. After subscribing, we offer prorated refunds within the first 30 days if you\'re not satisfied.',
    },
  ],
  
  security: {
    dataProtection: 'All data is encrypted at rest and in transit using AES-256 and TLS 1.3',
    passwordStorage: 'Passwords are hashed using bcrypt with cost factor 12',
    fbCredentials: 'We never store Facebook passwords. Authentication happens locally in your browser.',
    compliance: 'SOC2 Type II compliant data handling practices',
  },
};

// System prompt for Cloud AI
function buildCloudSystemPrompt(): string {
  return `You are Cloud, the AI Sales Assistant for DealersFace.

YOUR IDENTITY:
- Name: Cloud
- Role: AI Sales Assistant & Product Expert
- Personality: Friendly, professional, knowledgeable, helpful
- You work for DealersFace, a platform that helps auto dealers post vehicles to Facebook Marketplace

YOUR KNOWLEDGE:
${JSON.stringify(CLOUD_KNOWLEDGE_BASE, null, 2)}

YOUR CAPABILITIES:
- Answer questions about DealersFace features and pricing
- Explain how the posting methods work (IAI, API, Pixel)
- Help users understand Facebook Marketplace limitations
- Guide users through getting started
- Handle pre-sales questions
- Provide technical support guidance

YOUR LIMITATIONS (IMPORTANT):
- You CANNOT access the system or make changes
- You CANNOT view user data or accounts
- You CANNOT process payments or modify subscriptions
- You are a sales assistant only
- For account issues, direct users to support@dealersface.com

RESPONSE GUIDELINES:
1. Be concise but thorough
2. Use emojis sparingly for friendliness 😊
3. Be honest about limitations (especially FB Marketplace API)
4. Always recommend IAI for Marketplace posting
5. If asked about technical issues, suggest checking docs or contacting support
6. If asked to do something you can't, politely explain your limitations

IMPORTANT FACTS TO EMPHASIZE:
- Facebook has NO public Marketplace API - this is industry-wide
- IAI (browser automation) is the ONLY way to post to Marketplace
- Graph API can only post to Pages, not Marketplace
- Pixel is for tracking, not posting`;
}

export class CloudController {
  /**
   * Chat with Cloud - Main endpoint for sales chat
   * This is a PUBLIC endpoint (no auth required for potential customers)
   */
  async chat(req: Request, res: Response): Promise<void> {
    const { message, conversationHistory = [], sessionId } = req.body;

    if (!message || typeof message !== 'string') {
      res.status(400).json({
        success: false,
        error: 'Message is required',
      });
      return;
    }

    try {
      // Build conversation context
      const messages = [
        { role: 'system', content: buildCloudSystemPrompt() },
        ...conversationHistory.slice(-10).map((msg: { role: string; content: string }) => ({
          role: msg.role,
          content: msg.content,
        })),
        { role: 'user', content: message },
      ];

      // Call AI service (using SAG endpoint or fallback)
      const aiResponse = await this.generateAIResponse(messages);

      // Log conversation for analytics (anonymized)
      logger.info(`Cloud chat: ${message.slice(0, 50)}... -> ${aiResponse.slice(0, 50)}...`);

      // Store conversation if sessionId provided
      if (sessionId) {
        await this.storeConversation(sessionId, message, aiResponse);
      }

      res.json({
        success: true,
        data: {
          response: aiResponse,
          sessionId: sessionId || `cloud_${Date.now()}`,
        },
      });
    } catch (error) {
      logger.error('Cloud chat error:', error);
      
      // Fallback response
      res.json({
        success: true,
        data: {
          response: this.getFallbackResponse(message),
          sessionId: sessionId || `cloud_${Date.now()}`,
        },
      });
    }
  }

  /**
   * Get product information - Public endpoint
   */
  async getProductInfo(_req: Request, res: Response): Promise<void> {
    res.json({
      success: true,
      data: {
        product: CLOUD_KNOWLEDGE_BASE.product,
        postingMethods: CLOUD_KNOWLEDGE_BASE.postingMethods,
        pricing: CLOUD_KNOWLEDGE_BASE.pricing,
      },
    });
  }

  /**
   * Get FAQ - Public endpoint
   */
  async getFaq(_req: Request, res: Response): Promise<void> {
    res.json({
      success: true,
      data: {
        faq: CLOUD_KNOWLEDGE_BASE.faq,
      },
    });
  }

  /**
   * Generate AI response using external service
   */
  private async generateAIResponse(messages: Array<{ role: string; content: string }>): Promise<string> {
    const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'https://sag.gemquery.com/api/v1';
    
    try {
      const response = await fetch(`${AI_SERVICE_URL}/generate-text`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages,
          model: 'claude-3-haiku',
          maxTokens: 500,
          temperature: 0.7,
        }),
      });

      if (!response.ok) {
        throw new Error(`AI service returned ${response.status}`);
      }

      const data = await response.json() as { text?: string; content?: string; response?: string };
      return data.text || data.content || data.response || this.getDefaultResponse();
    } catch (error) {
      logger.error('AI service error:', error);
      throw error;
    }
  }

  /**
   * Store conversation for analytics
   */
  private async storeConversation(sessionId: string, userMessage: string, _aiResponse: string): Promise<void> {
    try {
      // Store in database for analytics (optional - create model if needed)
      // For now, just log it
      logger.info(`Cloud session ${sessionId}: User: ${userMessage.slice(0, 100)}`);
    } catch (error) {
      // Non-critical, don't fail the request
      logger.debug('Failed to store conversation:', error);
    }
  }

  /**
   * Fallback response when AI service is unavailable
   */
  private getFallbackResponse(message: string): string {
    const lowerMessage = message.toLowerCase();

    // Simple keyword matching for fallback
    if (lowerMessage.includes('price') || lowerMessage.includes('cost') || lowerMessage.includes('pricing')) {
      return `Our pricing starts at $99/month for the Starter plan. We offer a 14-day free trial so you can test everything before committing! 

**Plans:**
- **Starter** - $99/month (up to 100 listings)
- **Professional** - $199/month (up to 500 listings, AI responses) ⭐ Most Popular
- **Enterprise** - Custom pricing (unlimited listings)

Would you like to start your free trial?`;
    }

    if (lowerMessage.includes('api') || lowerMessage.includes('marketplace')) {
      return `Great question! Here's the reality about Facebook Marketplace posting:

🔹 **Facebook has NO public API for Marketplace** - this is industry-wide
🔹 Our **IAI Soldier** uses browser automation to create actual Marketplace listings
🔹 The Graph API only works for Page posts, not Marketplace

Our IAI method is the recommended approach with a 95%+ success rate. Would you like me to explain how it works?`;
    }

    if (lowerMessage.includes('how') && (lowerMessage.includes('work') || lowerMessage.includes('start'))) {
      return `Getting started with DealersFace is easy! 🚀

1️⃣ **Sign up** for your free 14-day trial
2️⃣ **Connect your inventory** (FTP sync or manual upload)
3️⃣ **Install our Chrome Extension** (for IAI posting)
4️⃣ **Log into Facebook** in Chrome
5️⃣ **Select vehicles** and post to Marketplace!

The whole setup takes about 15 minutes. Want me to walk you through any step?`;
    }

    // Default response
    return `Hi there! I'm Cloud, your DealersFace assistant. 👋

I can help you with:
- Learning about our features
- Understanding how Marketplace posting works
- Pricing information
- Getting started with DealersFace

What would you like to know?`;
  }

  /**
   * Default response
   */
  private getDefaultResponse(): string {
    return `I'm Cloud, here to help you learn about DealersFace! What questions do you have about our Facebook Marketplace automation platform?`;
  }

  /**
   * Get Cloud's status - Health check
   */
  async getStatus(_req: Request, res: Response): Promise<void> {
    res.json({
      success: true,
      data: {
        name: 'Cloud',
        status: 'online',
        version: '1.0.0',
        capabilities: ['chat', 'faq', 'product-info'],
      },
    });
  }
}
