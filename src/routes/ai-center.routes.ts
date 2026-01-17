/**
 * AI Center Routes
 * 
 * API routes for the AI Center functionality
 */

import { Router } from 'express';
import * as aiCenterController from '@/controllers/ai-center.controller';
import { authenticate, authorize } from '@/middleware/auth';

const router = Router();

// All routes require authentication and super admin
router.use(authenticate);
router.use(authorize('superadmin'));

// ============================================
// Dashboard
// ============================================

router.get('/dashboard/:accountId', aiCenterController.getDashboard);

// ============================================
// Provider Routes
// ============================================

router.get('/providers', aiCenterController.getProviders);
router.get('/providers/:providerId', aiCenterController.getProvider);
router.post('/providers', aiCenterController.createProvider);
router.put('/providers/:providerId', aiCenterController.updateProvider);
router.delete('/providers/:providerId', aiCenterController.deleteProvider);

// ============================================
// Memory Routes
// ============================================

router.post('/memory', aiCenterController.storeMemory);
router.get('/memory/:providerId/:accountId/:key', aiCenterController.retrieveMemory);
router.get('/memory/search', aiCenterController.searchMemories);
router.post('/memory/semantic-search', aiCenterController.semanticSearchMemories);
router.delete('/memory/:memoryId', aiCenterController.deleteMemory);
router.get('/memory/context/:providerId/:accountId/:conversationId', aiCenterController.getConversationContext);

// ============================================
// Training Routes
// ============================================

router.get('/training/types', aiCenterController.getTrainingTypes);
router.get('/training/curriculum/:trainingType', aiCenterController.getCurriculum);
router.post('/training/sessions', aiCenterController.createTrainingSession);
router.post('/training/sessions/:sessionId/start', aiCenterController.startTrainingSession);
router.get('/training/sessions/:sessionId/progress', aiCenterController.getTrainingProgress);
router.get('/training/sessions/account/:accountId', aiCenterController.getTrainingSessions);
router.post('/training/sessions/:sessionId/examples', aiCenterController.addTrainingExample);

// ============================================
// Threat Detection Routes
// ============================================

router.post('/threats/analyze', aiCenterController.analyzeMessageThreats);
router.get('/threats/:accountId', aiCenterController.getThreats);
router.get('/threats/:accountId/stats', aiCenterController.getThreatStats);
router.put('/threats/:threatId/status', aiCenterController.updateThreatStatus);
router.post('/threats/:threatId/escalate', aiCenterController.escalateThreat);
router.get('/threats/patterns', aiCenterController.getThreatPatterns);
router.post('/threats/patterns', aiCenterController.addThreatPattern);

// ============================================
// Learning Patterns Routes
// ============================================

router.post('/patterns/match', aiCenterController.findMatchingPatterns);
router.post('/patterns/best', aiCenterController.getBestPattern);
router.post('/patterns/usage', aiCenterController.recordPatternUsage);
router.get('/patterns', aiCenterController.getPatterns);
router.post('/patterns', aiCenterController.createPattern);
router.get('/patterns/performance', aiCenterController.getPatternPerformanceReport);
router.post('/patterns/:patternId/optimize', aiCenterController.optimizePattern);

// ============================================
// Task Routes
// ============================================

router.post('/tasks', aiCenterController.createTask);
router.get('/tasks/:taskId', aiCenterController.getTask);
router.get('/tasks/account/:accountId', aiCenterController.getTasks);
router.get('/tasks/account/:accountId/summary', aiCenterController.getTaskSummary);
router.post('/tasks/:taskId/execute', aiCenterController.executeTask);
router.post('/tasks/:taskId/approve', aiCenterController.approveTask);
router.post('/tasks/:taskId/reject', aiCenterController.rejectTask);
router.post('/tasks/:taskId/cancel', aiCenterController.cancelTask);
router.get('/tasks/approvals/pending', aiCenterController.getPendingApprovals);
router.get('/tasks/capabilities', aiCenterController.getTaskCapabilities);

// ============================================
// Audit Logs Routes
// ============================================

router.get('/audit/:accountId', aiCenterController.getAuditLogs);

export default router;
