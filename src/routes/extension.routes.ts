/**
 * Chrome Extension API Routes
 * 
 * Handles communication between the extension and the server:
 * - AI element finding
 * - Conversation analysis
 * - Response generation
 */

import { Router, Request, Response } from 'express';
import { AINavigationAgent } from '../services/ai-agent.service';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();
const aiAgent = new AINavigationAgent();

// ============================================
// AI Element Finding
// ============================================

/**
 * POST /api/extension/find-element
 * Use AI to find element selector
 */
router.post('/find-element', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { description, pageHtml } = req.body;
    
    if (!description || !pageHtml) {
      res.status(400).json({ error: 'description and pageHtml are required' });
      return;
    }
    
    const result = await aiAgent.findElement({
      description,
      pageHtml,
    });
    
    res.json(result);
  } catch (error) {
    console.error('Find element error:', error);
    res.status(500).json({ error: 'Failed to find element' });
  }
});

/**
 * POST /api/extension/analyze-conversation
 * Use AI to analyze lead conversation
 */
router.post('/analyze-conversation', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { messages, vehicleInfo } = req.body;
    
    if (!messages) {
      res.status(400).json({ error: 'messages array is required' });
      return;
    }
    
    const analysis = await aiAgent.analyzeConversation(messages, vehicleInfo || null);
    
    res.json(analysis);
  } catch (error) {
    console.error('Analyze conversation error:', error);
    res.status(500).json({ error: 'Failed to analyze conversation' });
  }
});

/**
 * POST /api/extension/generate-response
 * Use AI to generate lead response
 */
router.post('/generate-response', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { 
      messages, 
      vehicleInfo, 
      dealerName,
      dealerPhone,
      dealerAddress,
      lastBuyerMessage 
    } = req.body;
    
    // First analyze the conversation to get lead analysis
    const leadAnalysis = await aiAgent.analyzeConversation(messages || [], vehicleInfo || null);
    
    const response = await aiAgent.generateLeadResponse({
      dealerName: dealerName || 'Our Dealership',
      dealerPhone: dealerPhone || '',
      dealerAddress: dealerAddress || '',
      vehicleInfo: vehicleInfo || { year: 0, make: 'Unknown', model: 'Vehicle', price: 0 },
      conversationHistory: messages || [],
      lastBuyerMessage: lastBuyerMessage || messages?.[messages.length - 1]?.text || '',
      leadAnalysis,
    });
    
    res.json(response);
  } catch (error) {
    console.error('Generate response error:', error);
    res.status(500).json({ error: 'Failed to generate response' });
  }
});

/**
 * POST /api/extension/generate-description
 * Use AI to generate vehicle listing description
 */
router.post('/generate-description', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { vehicle } = req.body;
    
    if (!vehicle) {
      res.status(400).json({ error: 'vehicle object is required' });
      return;
    }
    
    const description = await aiAgent.generateVehicleDescription(vehicle);
    
    res.json({ description });
  } catch (error) {
    console.error('Generate description error:', error);
    res.status(500).json({ error: 'Failed to generate description' });
  }
});

/**
 * POST /api/extension/detect-ui-changes
 * Use AI to detect Facebook UI changes
 */
router.post('/detect-ui-changes', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { oldSelectors, newPageHtml } = req.body;
    
    if (!oldSelectors || !newPageHtml) {
      res.status(400).json({ error: 'oldSelectors and newPageHtml are required' });
      return;
    }
    
    const result = await aiAgent.detectUIChanges(oldSelectors, newPageHtml);
    
    res.json(result);
  } catch (error) {
    console.error('Detect UI changes error:', error);
    res.status(500).json({ error: 'Failed to detect UI changes' });
  }
});

/**
 * GET /api/extension/ai-provider
 * Get current AI provider info
 */
router.get('/ai-provider', authenticate, async (_req: AuthRequest, res: Response) => {
  try {
    const providerInfo = aiAgent.getProviderInfo();
    res.json(providerInfo);
  } catch (error) {
    console.error('Get AI provider error:', error);
    res.status(500).json({ error: 'Failed to get AI provider info' });
  }
});

/**
 * POST /api/extension/ai-provider
 * Switch AI provider
 */
router.post('/ai-provider', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { provider } = req.body;
    
    if (!provider || !['anthropic', 'openai'].includes(provider)) {
      res.status(400).json({ error: 'Valid provider (anthropic or openai) is required' });
      return;
    }
    
    const success = aiAgent.setProvider(provider);
    
    if (success) {
      res.json({ success: true, provider });
    } else {
      res.status(400).json({ error: `Provider ${provider} is not available. Check API keys.` });
    }
  } catch (error) {
    console.error('Set AI provider error:', error);
    res.status(500).json({ error: 'Failed to set AI provider' });
  }
});

/**
 * GET /api/extension/health
 * Health check for extension
 */
router.get('/health', (_req: Request, res: Response) => {
  const providerInfo = aiAgent.getProviderInfo();
  res.json({
    status: 'ok',
    aiProvider: providerInfo.current,
    availableProviders: providerInfo.available,
    timestamp: new Date().toISOString(),
  });
});

export default router;
