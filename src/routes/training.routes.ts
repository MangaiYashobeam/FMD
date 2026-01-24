/**
 * Training Routes - API endpoints for recording and training management
 * 
 * Handles:
 * - Training session CRUD
 * - Training data processing
 * - Training injection to IAI and Soldier workers
 * - Pattern extraction and code generation
 */

import { Router, Response } from 'express';
import prisma from '../config/database';
import { authenticate, AuthRequest } from '../middleware/auth';
import { requireSuperAdmin } from '../middleware/rbac';

const router = Router();

// ============================================
// ALL ROUTES REQUIRE SUPER ADMIN
// ============================================

router.use(authenticate);
router.use(requireSuperAdmin);

// ============================================
// TRAINING SESSIONS CRUD
// ============================================

/**
 * GET /training/sessions - List all training sessions
 */
router.get('/sessions', async (req: AuthRequest, res: Response) => {
  try {
    const { type, mode, limit = 50 } = req.query;
    
    const where: any = {};
    if (type) where.recordingType = type;
    if (mode) where.mode = mode;
    
    const sessions = await prisma.trainingSession.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: Number(limit),
      select: {
        id: true,
        sessionId: true,
        mode: true,
        recordingType: true,
        totalEvents: true,
        markedElementsCount: true,
        duration: true,
        createdAt: true,
        status: true,
        isActive: true,
      },
    });
    
    res.json({ success: true, sessions });
  } catch (error) {
    console.error('Error fetching training sessions:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch sessions' });
  }
});

/**
 * GET /training/sessions/:id - Get a specific training session
 */
router.get('/sessions/:id', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    
    const session = await prisma.trainingSession.findFirst({
      where: {
        OR: [
          { id: id },
          { sessionId: id },
        ],
      },
      include: {
        events: {
          orderBy: { timestamp: 'asc' },
        },
        markedElements: true,
        patterns: true,
        fieldMappings: true,
      },
    });
    
    if (!session) {
      res.status(404).json({ success: false, error: 'Session not found' });
      return;
    }
    
    res.json({ success: true, session });
  } catch (error) {
    console.error('Error fetching training session:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch session' });
  }
});

/**
 * POST /training/sessions - Create a new training session
 */
router.post('/sessions', async (req: AuthRequest, res: Response) => {
  try {
    const {
      sessionId,
      mode,
      recordingType,
      duration,
      metadata,
      events,
      markedElements,
      patterns,
      fieldMappings,
      clickSequence,
      typingPatterns,
      automationCode,
    } = req.body;
    
    // Create the session
    const session = await prisma.trainingSession.create({
      data: {
        sessionId,
        mode: mode || 'listing',
        recordingType: recordingType || 'iai',
        duration: duration || 0,
        metadata: metadata || {},
        totalEvents: events?.length || 0,
        markedElementsCount: markedElements?.length || 0,
        clickSequence: clickSequence || [],
        typingPatterns: typingPatterns || [],
        automationCode: automationCode || {},
        status: 'RECORDED',
        createdById: req.user!.id,
      },
    });
    
    // Create events in batch
    if (events && events.length > 0) {
      const eventData = events.map((event: any) => ({
        sessionId: session.id,
        eventId: event.id,
        type: event.type,
        timestamp: new Date(event.timestamp),
        relativeTime: event.relativeTime || 0,
        url: event.url,
        fieldType: event.fieldType,
        isMarked: event.isMarked || false,
        elementData: event.element || {},
        mousePosition: event.mousePosition || {},
        modifiers: event.modifiers || {},
        additionalData: event,
      }));
      
      await prisma.trainingEvent.createMany({
        data: eventData,
      });
    }
    
    // Create marked elements
    if (markedElements && markedElements.length > 0) {
      const markedData = markedElements.map((marked: any, index: number) => ({
        sessionId: session.id,
        fieldType: marked.fieldType || marked.markedAs || 'unknown',
        order: index + 1,
        elementData: marked.elementInfo || {},
        selectors: marked.elementInfo?.selectors || [],
        ariaLabel: marked.elementInfo?.ariaLabel,
        role: marked.elementInfo?.role,
        isDropdown: marked.elementInfo?.isDropdown || false,
        isInput: marked.elementInfo?.isInput || false,
        timestamp: new Date(marked.timestamp),
        relativeTime: marked.relativeTime || 0,
      }));
      
      await prisma.trainingMarkedElement.createMany({
        data: markedData,
      });
    }
    
    // Create field mappings
    if (fieldMappings) {
      const mappingData = Object.entries(fieldMappings).map(([fieldType, mapping]: [string, any]) => ({
        sessionId: session.id,
        fieldType,
        primarySelector: Array.isArray(mapping.selectors) ? mapping.selectors[0] : mapping.selectors,
        fallbackSelectors: Array.isArray(mapping.selectors) ? mapping.selectors.slice(1) : [],
        ariaLabel: mapping.ariaLabel,
        role: mapping.role,
        isDropdown: mapping.isDropdown || false,
        isInput: mapping.isInput || false,
        placeholder: mapping.placeholder,
        parentContext: mapping.parentContext || [],
      }));
      
      await prisma.trainingFieldMapping.createMany({
        data: mappingData,
      });
    }
    
    // Create patterns
    if (patterns) {
      const patternTypes = ['dropdowns', 'inputs', 'buttons', 'navigation', 'fileUploads'];
      
      for (const patternType of patternTypes) {
        if (patterns[patternType] && patterns[patternType].length > 0) {
          for (const pattern of patterns[patternType]) {
            await prisma.trainingPattern.create({
              data: {
                sessionId: session.id,
                patternType,
                fieldType: pattern.fieldType,
                selectors: pattern.selectors || [],
                ariaLabel: pattern.ariaLabel,
                text: pattern.text,
                timestamp: pattern.timestamp,
                additionalData: pattern,
              },
            });
          }
        }
      }
      
      // Save timing patterns
      if (patterns.timing) {
        await prisma.trainingPattern.create({
          data: {
            sessionId: session.id,
            patternType: 'timing',
            additionalData: patterns.timing,
          },
        });
      }
    }
    
    res.json({ 
      success: true, 
      session: {
        id: session.id,
        sessionId: session.sessionId,
        totalEvents: session.totalEvents,
        markedElementsCount: session.markedElementsCount,
      },
    });
  } catch (error) {
    console.error('Error creating training session:', error);
    res.status(500).json({ success: false, error: 'Failed to create session' });
  }
});

/**
 * DELETE /training/sessions/:id - Delete a training session
 */
router.delete('/sessions/:id', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    
    // Delete related records first
    await prisma.trainingEvent.deleteMany({ where: { sessionId: id } });
    await prisma.trainingMarkedElement.deleteMany({ where: { sessionId: id } });
    await prisma.trainingFieldMapping.deleteMany({ where: { sessionId: id } });
    await prisma.trainingPattern.deleteMany({ where: { sessionId: id } });
    
    // Delete the session
    await prisma.trainingSession.delete({ where: { id } });
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting training session:', error);
    res.status(500).json({ success: false, error: 'Failed to delete session' });
  }
});

// ============================================
// TRAINING DATA PROCESSING
// ============================================

/**
 * POST /training/sessions/:id/process - Process a session and extract patterns
 */
router.post('/sessions/:id/process', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    
    const session = await prisma.trainingSession.findUnique({
      where: { id },
      include: {
        events: { orderBy: { timestamp: 'asc' } },
        markedElements: { orderBy: { order: 'asc' } },
      },
    });
    
    if (!session) {
      res.status(404).json({ success: false, error: 'Session not found' });
      return;
    }
    
    // Process events and generate optimized automation code
    const processedData = processTrainingSession(session);
    
    // Update session with processed data
    await prisma.trainingSession.update({
      where: { id },
      data: {
        automationCode: processedData.automationCode,
        status: 'PROCESSED',
        processedAt: new Date(),
      },
    });
    
    res.json({ success: true, processedData });
  } catch (error) {
    console.error('Error processing training session:', error);
    res.status(500).json({ success: false, error: 'Failed to process session' });
  }
});

/**
 * POST /training/sessions/:id/activate - Activate a training session for use
 */
router.post('/sessions/:id/activate', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { target } = req.body; // 'iai' | 'soldier' | 'both'
    
    // Deactivate other sessions of the same type
    if (target === 'iai' || target === 'both') {
      await prisma.trainingSession.updateMany({
        where: { recordingType: 'iai', isActive: true },
        data: { isActive: false },
      });
    }
    
    if (target === 'soldier' || target === 'both') {
      await prisma.trainingSession.updateMany({
        where: { recordingType: 'soldier', isActive: true },
        data: { isActive: false },
      });
    }
    
    // Activate this session
    await prisma.trainingSession.update({
      where: { id },
      data: { isActive: true, status: 'ACTIVE' },
    });
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error activating training session:', error);
    res.status(500).json({ success: false, error: 'Failed to activate session' });
  }
});

/**
 * GET /training/active - Get currently active training configurations
 */
router.get('/active', async (_req: AuthRequest, res: Response) => {
  try {
    const activeSessions = await prisma.trainingSession.findMany({
      where: { isActive: true },
      include: {
        fieldMappings: true,
      },
    });
    
    const activeConfig: any = {
      iai: null,
      soldier: null,
    };
    
    for (const session of activeSessions) {
      if (session.recordingType === 'iai') {
        activeConfig.iai = {
          sessionId: session.sessionId,
          automationCode: session.automationCode,
          fieldMappings: session.fieldMappings,
          clickSequence: session.clickSequence,
        };
      } else if (session.recordingType === 'soldier') {
        activeConfig.soldier = {
          sessionId: session.sessionId,
          automationCode: session.automationCode,
          fieldMappings: session.fieldMappings,
          clickSequence: session.clickSequence,
        };
      }
    }
    
    res.json({ success: true, activeConfig });
  } catch (error) {
    console.error('Error fetching active training:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch active training' });
  }
});

/**
 * GET /training/inject/:type - Get injectable training code
 */
router.get('/inject/:type', async (req: AuthRequest, res: Response) => {
  try {
    const type = req.params.type as string; // 'iai' | 'soldier'
    
    const activeSession = await prisma.trainingSession.findFirst({
      where: { 
        recordingType: type,
        isActive: true,
      },
      include: {
        fieldMappings: true,
      },
    });
    
    if (!activeSession) {
      res.status(404).json({ success: false, error: 'No active training found' });
      return;
    }
    
    // Generate injectable code based on type
    const injectableCode = generateInjectableCode(activeSession, type);
    
    res.json({ success: true, code: injectableCode });
  } catch (error) {
    console.error('Error generating injectable code:', error);
    res.status(500).json({ success: false, error: 'Failed to generate code' });
  }
});

// ============================================
// FIELD MAPPING MANAGEMENT
// ============================================

/**
 * GET /training/field-mappings - Get all field mappings
 */
router.get('/field-mappings', async (req: AuthRequest, res: Response) => {
  try {
    const { active = 'true' } = req.query;
    
    let mappings: any[];
    
    if (active === 'true') {
      // Get mappings from active sessions
      const activeSessions = await prisma.trainingSession.findMany({
        where: { isActive: true },
        include: { fieldMappings: true },
      });
      
      mappings = activeSessions.flatMap((s: any) => s.fieldMappings);
    } else {
      mappings = await prisma.trainingFieldMapping.findMany({
        orderBy: { fieldType: 'asc' },
      });
    }
    
    // Group by field type
    const grouped: any = {};
    for (const mapping of mappings) {
      if (!grouped[mapping.fieldType]) {
        grouped[mapping.fieldType] = [];
      }
      grouped[mapping.fieldType].push(mapping);
    }
    
    res.json({ success: true, fieldMappings: grouped });
  } catch (error) {
    console.error('Error fetching field mappings:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch field mappings' });
  }
});

/**
 * PUT /training/field-mappings/:id - Update a field mapping
 */
router.put('/field-mappings/:id', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    
    const mapping = await prisma.trainingFieldMapping.update({
      where: { id },
      data: updates,
    });
    
    res.json({ success: true, mapping });
  } catch (error) {
    console.error('Error updating field mapping:', error);
    res.status(500).json({ success: false, error: 'Failed to update field mapping' });
  }
});

// ============================================
// HELPER FUNCTIONS
// ============================================

function processTrainingSession(session: any) {
  const events = session.events || [];
  const markedElements = session.markedElements || [];
  
  // Build field selector map from marked elements
  const fieldSelectors: any = {};
  for (const marked of markedElements) {
    fieldSelectors[marked.fieldType] = {
      primary: marked.elementData?.selectors?.[0] || marked.ariaLabel,
      fallbacks: marked.elementData?.selectors?.slice(1) || [],
      ariaLabel: marked.ariaLabel,
      role: marked.role,
      isDropdown: marked.isDropdown,
      isInput: marked.isInput,
    };
  }
  
  // Build step sequence from click events
  const steps: any[] = [];
  const clickEvents = events.filter((e: any) => e.type === 'click');
  
  for (let i = 0; i < clickEvents.length; i++) {
    const event = clickEvents[i];
    const prevEvent = i > 0 ? clickEvents[i - 1] : null;
    
    const waitTime = prevEvent 
      ? Math.min(event.relativeTime - prevEvent.relativeTime, 3000)
      : 500;
    
    steps.push({
      step: i + 1,
      action: event.elementData?.isDropdown ? 'selectDropdown' :
              event.elementData?.isInput ? 'fillInput' :
              event.fieldType === 'publish' ? 'publish' : 'click',
      field: event.fieldType || 'unknown',
      waitBefore: waitTime,
      selector: event.elementData?.selectors?.[0],
      isMarked: event.isMarked,
    });
  }
  
  // Calculate timing recommendations
  const intervals = [];
  for (let i = 1; i < clickEvents.length; i++) {
    intervals.push(clickEvents[i].relativeTime - clickEvents[i - 1].relativeTime);
  }
  
  const timing = {
    averageDelay: intervals.length > 0 
      ? Math.round(intervals.reduce((a, b) => a + b, 0) / intervals.length)
      : 500,
    minDelay: intervals.length > 0 ? Math.min(...intervals) : 200,
    maxDelay: intervals.length > 0 ? Math.max(...intervals) : 2000,
    recommendedDelay: intervals.length > 0
      ? Math.round(intervals.reduce((a, b) => a + b, 0) / intervals.length * 0.8)
      : 400,
  };
  
  return {
    automationCode: {
      version: '2.0',
      generatedAt: new Date().toISOString(),
      type: session.recordingType,
      mode: session.mode,
      fieldSelectors,
      steps,
      timing,
    },
  };
}

function generateInjectableCode(session: any, type: string) {
  const automationCode = session.automationCode || {};
  const fieldMappings = session.fieldMappings || [];
  
  // Build selector map
  const selectors: any = {};
  for (const mapping of fieldMappings) {
    selectors[mapping.fieldType] = {
      primary: mapping.primarySelector,
      fallbacks: mapping.fallbackSelectors || [],
      ariaLabel: mapping.ariaLabel,
      role: mapping.role,
      isDropdown: mapping.isDropdown,
      isInput: mapping.isInput,
    };
  }
  
  const code = {
    _trainingVersion: '2.0',
    _sessionId: session.sessionId,
    _generatedAt: new Date().toISOString(),
    _type: type,
    
    // Field selectors for finding elements
    FIELD_SELECTORS: selectors,
    
    // Step sequence for automation
    STEPS: automationCode.steps || [],
    
    // Timing configuration
    TIMING: automationCode.timing || {
      averageDelay: 500,
      recommendedDelay: 400,
    },
    
    // For soldier workers - additional navigation data
    ...(type === 'soldier' && {
      NAVIGATION: {
        messagesUrl: '/marketplace/inbox',
        sellingsUrl: '/marketplace/you/selling',
        createListingUrl: '/marketplace/create/item',
      },
    }),
  };
  
  return code;
}

export default router;
