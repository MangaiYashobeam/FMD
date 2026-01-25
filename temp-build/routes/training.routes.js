"use strict";
/**
 * Training Routes - API endpoints for recording and training management
 *
 * Handles:
 * - Training session CRUD
 * - Training data processing
 * - Training injection to IAI and Soldier workers
 * - Pattern extraction and code generation
 */
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getConsoleStatus = exports.handleHeartbeat = void 0;
var express_1 = require("express");
var database_1 = __importDefault(require("../config/database"));
var auth_1 = require("../middleware/auth");
var rbac_1 = require("../middleware/rbac");
var router = (0, express_1.Router)();
// In-memory store for ROOT console connection state
var rootConsoleState = {
    connected: false,
    lastHeartbeat: null,
    browserId: null,
    version: null,
    currentTab: null,
    recordingActive: false,
};
// Heartbeat timeout - consider disconnected after 30 seconds
var HEARTBEAT_TIMEOUT_MS = 30000;
function isRootConsoleConnected() {
    if (!rootConsoleState.lastHeartbeat)
        return false;
    var timeSinceHeartbeat = Date.now() - rootConsoleState.lastHeartbeat.getTime();
    return timeSinceHeartbeat < HEARTBEAT_TIMEOUT_MS;
}
// ============================================
// PUBLIC HEARTBEAT ENDPOINT (no auth for extension)
// ============================================
/**
 * POST /training/console/heartbeat - ROOT Console heartbeat
 * Called by extension-recorder to maintain connection
 */
router.post('/console/heartbeat', function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var _a, browserId, version, currentTab, recordingActive;
    return __generator(this, function (_b) {
        try {
            _a = req.body, browserId = _a.browserId, version = _a.version, currentTab = _a.currentTab, recordingActive = _a.recordingActive;
            console.log('[DEBUG TRAINING] Heartbeat received:', {
                browserId: browserId,
                version: version,
                currentTab: currentTab,
                recordingActive: recordingActive,
                timestamp: new Date().toISOString()
            });
            rootConsoleState.connected = true;
            rootConsoleState.lastHeartbeat = new Date();
            rootConsoleState.browserId = browserId || null;
            rootConsoleState.version = version || null;
            rootConsoleState.currentTab = currentTab || null;
            rootConsoleState.recordingActive = recordingActive || false;
            console.log('[ROOT Console] Heartbeat received:', {
                browserId: browserId,
                version: version,
                currentTab: currentTab,
                recordingActive: recordingActive,
            });
            res.json({
                success: true,
                message: 'Heartbeat acknowledged',
                serverTime: new Date().toISOString(),
            });
        }
        catch (error) {
            console.error('[ROOT Console] Heartbeat error:', error);
            res.status(500).json({ success: false, error: 'Heartbeat failed' });
        }
        return [2 /*return*/];
    });
}); });
/**
 * GET /training/console/status - Get ROOT Console connection status
 * Called by IAI Training Panel to check if extension is connected
 */
router.get('/console/status', function (_req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var connected;
    var _a;
    return __generator(this, function (_b) {
        try {
            connected = isRootConsoleConnected();
            res.json({
                success: true,
                connected: connected,
                lastHeartbeat: ((_a = rootConsoleState.lastHeartbeat) === null || _a === void 0 ? void 0 : _a.toISOString()) || null,
                browserId: rootConsoleState.browserId,
                version: rootConsoleState.version,
                currentTab: rootConsoleState.currentTab,
                recordingActive: rootConsoleState.recordingActive,
                timeSinceHeartbeat: rootConsoleState.lastHeartbeat
                    ? Date.now() - rootConsoleState.lastHeartbeat.getTime()
                    : null,
            });
        }
        catch (error) {
            console.error('[ROOT Console] Status check error:', error);
            res.status(500).json({ success: false, error: 'Status check failed' });
        }
        return [2 /*return*/];
    });
}); });
// ============================================
// ALL OTHER ROUTES REQUIRE SUPER ADMIN
// ============================================
router.use(auth_1.authenticate);
router.use(rbac_1.requireSuperAdmin);
// ============================================
// TRAINING SESSIONS CRUD
// ============================================
/**
 * GET /training/sessions - List all training sessions
 */
router.get('/sessions', function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var type, mode, limit, where, sessions, error_1;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 2, , 3]);
                type = req.query.type;
                mode = req.query.mode;
                limit = Number(req.query.limit) || 50;
                where = {};
                if (type)
                    where.recordingType = type;
                if (mode)
                    where.mode = mode;
                return [4 /*yield*/, database_1.default.trainingSession.findMany({
                        where: where,
                        orderBy: { createdAt: 'desc' },
                        take: limit,
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
                    })];
            case 1:
                sessions = _a.sent();
                res.json({ success: true, sessions: sessions });
                return [3 /*break*/, 3];
            case 2:
                error_1 = _a.sent();
                console.error('Error fetching training sessions:', error_1);
                res.status(500).json({ success: false, error: 'Failed to fetch sessions' });
                return [3 /*break*/, 3];
            case 3: return [2 /*return*/];
        }
    });
}); });
/**
 * GET /training/sessions/:id - Get a specific training session
 */
router.get('/sessions/:id', function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var id, session, error_2;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 2, , 3]);
                id = req.params.id;
                return [4 /*yield*/, database_1.default.trainingSession.findFirst({
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
                    })];
            case 1:
                session = _a.sent();
                if (!session) {
                    res.status(404).json({ success: false, error: 'Session not found' });
                    return [2 /*return*/];
                }
                res.json({ success: true, session: session });
                return [3 /*break*/, 3];
            case 2:
                error_2 = _a.sent();
                console.error('Error fetching training session:', error_2);
                res.status(500).json({ success: false, error: 'Failed to fetch session' });
                return [3 /*break*/, 3];
            case 3: return [2 /*return*/];
        }
    });
}); });
/**
 * POST /training/sessions - Create a new training session
 */
router.post('/sessions', function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var _a, sessionId, mode, recordingType, duration, metadata, events, markedElements, patterns, fieldMappings, clickSequence, typingPatterns, automationCode, session_1, eventData, markedData, mappingData, patternTypes, _i, patternTypes_1, patternType, _b, _c, pattern, error_3;
    var _d, _e;
    return __generator(this, function (_f) {
        switch (_f.label) {
            case 0:
                _f.trys.push([0, 16, , 17]);
                console.log('[DEBUG TRAINING] POST /sessions received');
                console.log('[DEBUG TRAINING] Request body keys:', Object.keys(req.body));
                console.log('[DEBUG TRAINING] User:', (_d = req.user) === null || _d === void 0 ? void 0 : _d.email, (_e = req.user) === null || _e === void 0 ? void 0 : _e.id);
                _a = req.body, sessionId = _a.sessionId, mode = _a.mode, recordingType = _a.recordingType, duration = _a.duration, metadata = _a.metadata, events = _a.events, markedElements = _a.markedElements, patterns = _a.patterns, fieldMappings = _a.fieldMappings, clickSequence = _a.clickSequence, typingPatterns = _a.typingPatterns, automationCode = _a.automationCode;
                console.log('[DEBUG TRAINING] Session data:', {
                    sessionId: sessionId,
                    mode: mode,
                    recordingType: recordingType,
                    duration: duration,
                    eventsCount: (events === null || events === void 0 ? void 0 : events.length) || 0,
                    markedElementsCount: (markedElements === null || markedElements === void 0 ? void 0 : markedElements.length) || 0
                });
                return [4 /*yield*/, database_1.default.trainingSession.create({
                        data: {
                            sessionId: sessionId,
                            mode: mode || 'listing',
                            recordingType: recordingType || 'iai',
                            duration: duration || 0,
                            metadata: metadata || {},
                            totalEvents: (events === null || events === void 0 ? void 0 : events.length) || 0,
                            markedElementsCount: (markedElements === null || markedElements === void 0 ? void 0 : markedElements.length) || 0,
                            clickSequence: clickSequence || [],
                            typingPatterns: typingPatterns || [],
                            automationCode: automationCode || {},
                            status: 'RECORDED',
                            createdById: req.user.id,
                        },
                    })];
            case 1:
                session_1 = _f.sent();
                if (!(events && events.length > 0)) return [3 /*break*/, 3];
                eventData = events.map(function (event) { return ({
                    sessionId: session_1.id,
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
                }); });
                return [4 /*yield*/, database_1.default.trainingEvent.createMany({
                        data: eventData,
                    })];
            case 2:
                _f.sent();
                _f.label = 3;
            case 3:
                if (!(markedElements && markedElements.length > 0)) return [3 /*break*/, 5];
                markedData = markedElements.map(function (marked, index) {
                    var _a, _b, _c, _d, _e;
                    return ({
                        sessionId: session_1.id,
                        fieldType: marked.fieldType || marked.markedAs || 'unknown',
                        order: index + 1,
                        elementData: marked.elementInfo || {},
                        selectors: ((_a = marked.elementInfo) === null || _a === void 0 ? void 0 : _a.selectors) || [],
                        ariaLabel: (_b = marked.elementInfo) === null || _b === void 0 ? void 0 : _b.ariaLabel,
                        role: (_c = marked.elementInfo) === null || _c === void 0 ? void 0 : _c.role,
                        isDropdown: ((_d = marked.elementInfo) === null || _d === void 0 ? void 0 : _d.isDropdown) || false,
                        isInput: ((_e = marked.elementInfo) === null || _e === void 0 ? void 0 : _e.isInput) || false,
                        timestamp: new Date(marked.timestamp),
                        relativeTime: marked.relativeTime || 0,
                    });
                });
                return [4 /*yield*/, database_1.default.trainingMarkedElement.createMany({
                        data: markedData,
                    })];
            case 4:
                _f.sent();
                _f.label = 5;
            case 5:
                if (!fieldMappings) return [3 /*break*/, 7];
                mappingData = Object.entries(fieldMappings).map(function (_a) {
                    var fieldType = _a[0], mapping = _a[1];
                    return ({
                        sessionId: session_1.id,
                        fieldType: fieldType,
                        primarySelector: Array.isArray(mapping.selectors) ? mapping.selectors[0] : mapping.selectors,
                        fallbackSelectors: Array.isArray(mapping.selectors) ? mapping.selectors.slice(1) : [],
                        ariaLabel: mapping.ariaLabel,
                        role: mapping.role,
                        isDropdown: mapping.isDropdown || false,
                        isInput: mapping.isInput || false,
                        placeholder: mapping.placeholder,
                        parentContext: mapping.parentContext || [],
                    });
                });
                return [4 /*yield*/, database_1.default.trainingFieldMapping.createMany({
                        data: mappingData,
                    })];
            case 6:
                _f.sent();
                _f.label = 7;
            case 7:
                if (!patterns) return [3 /*break*/, 15];
                patternTypes = ['dropdowns', 'inputs', 'buttons', 'navigation', 'fileUploads'];
                _i = 0, patternTypes_1 = patternTypes;
                _f.label = 8;
            case 8:
                if (!(_i < patternTypes_1.length)) return [3 /*break*/, 13];
                patternType = patternTypes_1[_i];
                if (!(patterns[patternType] && patterns[patternType].length > 0)) return [3 /*break*/, 12];
                _b = 0, _c = patterns[patternType];
                _f.label = 9;
            case 9:
                if (!(_b < _c.length)) return [3 /*break*/, 12];
                pattern = _c[_b];
                return [4 /*yield*/, database_1.default.trainingPattern.create({
                        data: {
                            sessionId: session_1.id,
                            patternType: patternType,
                            fieldType: pattern.fieldType,
                            selectors: pattern.selectors || [],
                            ariaLabel: pattern.ariaLabel,
                            text: pattern.text,
                            timestamp: pattern.timestamp,
                            additionalData: pattern,
                        },
                    })];
            case 10:
                _f.sent();
                _f.label = 11;
            case 11:
                _b++;
                return [3 /*break*/, 9];
            case 12:
                _i++;
                return [3 /*break*/, 8];
            case 13:
                if (!patterns.timing) return [3 /*break*/, 15];
                return [4 /*yield*/, database_1.default.trainingPattern.create({
                        data: {
                            sessionId: session_1.id,
                            patternType: 'timing',
                            additionalData: patterns.timing,
                        },
                    })];
            case 14:
                _f.sent();
                _f.label = 15;
            case 15:
                res.json({
                    success: true,
                    session: {
                        id: session_1.id,
                        sessionId: session_1.sessionId,
                        totalEvents: session_1.totalEvents,
                        markedElementsCount: session_1.markedElementsCount,
                    },
                });
                return [3 /*break*/, 17];
            case 16:
                error_3 = _f.sent();
                console.error('Error creating training session:', error_3);
                res.status(500).json({ success: false, error: 'Failed to create session' });
                return [3 /*break*/, 17];
            case 17: return [2 /*return*/];
        }
    });
}); });
/**
 * DELETE /training/sessions/:id - Delete a training session
 */
router.delete('/sessions/:id', function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var id, error_4;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 6, , 7]);
                id = req.params.id;
                // Delete related records first
                return [4 /*yield*/, database_1.default.trainingEvent.deleteMany({ where: { sessionId: id } })];
            case 1:
                // Delete related records first
                _a.sent();
                return [4 /*yield*/, database_1.default.trainingMarkedElement.deleteMany({ where: { sessionId: id } })];
            case 2:
                _a.sent();
                return [4 /*yield*/, database_1.default.trainingFieldMapping.deleteMany({ where: { sessionId: id } })];
            case 3:
                _a.sent();
                return [4 /*yield*/, database_1.default.trainingPattern.deleteMany({ where: { sessionId: id } })];
            case 4:
                _a.sent();
                // Delete the session
                return [4 /*yield*/, database_1.default.trainingSession.delete({ where: { id: id } })];
            case 5:
                // Delete the session
                _a.sent();
                res.json({ success: true });
                return [3 /*break*/, 7];
            case 6:
                error_4 = _a.sent();
                console.error('Error deleting training session:', error_4);
                res.status(500).json({ success: false, error: 'Failed to delete session' });
                return [3 /*break*/, 7];
            case 7: return [2 /*return*/];
        }
    });
}); });
// ============================================
// TRAINING DATA PROCESSING
// ============================================
/**
 * POST /training/sessions/:id/process - Process a session and extract patterns
 */
router.post('/sessions/:id/process', function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var id, session, processedData, error_5;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 3, , 4]);
                id = req.params.id;
                return [4 /*yield*/, database_1.default.trainingSession.findUnique({
                        where: { id: id },
                        include: {
                            events: { orderBy: { timestamp: 'asc' } },
                            markedElements: { orderBy: { order: 'asc' } },
                        },
                    })];
            case 1:
                session = _a.sent();
                if (!session) {
                    res.status(404).json({ success: false, error: 'Session not found' });
                    return [2 /*return*/];
                }
                processedData = processTrainingSession(session);
                // Update session with processed data
                return [4 /*yield*/, database_1.default.trainingSession.update({
                        where: { id: id },
                        data: {
                            automationCode: processedData.automationCode,
                            status: 'PROCESSED',
                            processedAt: new Date(),
                        },
                    })];
            case 2:
                // Update session with processed data
                _a.sent();
                res.json({ success: true, processedData: processedData });
                return [3 /*break*/, 4];
            case 3:
                error_5 = _a.sent();
                console.error('Error processing training session:', error_5);
                res.status(500).json({ success: false, error: 'Failed to process session' });
                return [3 /*break*/, 4];
            case 4: return [2 /*return*/];
        }
    });
}); });
/**
 * POST /training/sessions/:id/activate - Activate a training session for use
 */
router.post('/sessions/:id/activate', function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var id, target, error_6;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 6, , 7]);
                id = req.params.id;
                target = req.body.target;
                if (!(target === 'iai' || target === 'both')) return [3 /*break*/, 2];
                return [4 /*yield*/, database_1.default.trainingSession.updateMany({
                        where: { recordingType: 'iai', isActive: true },
                        data: { isActive: false },
                    })];
            case 1:
                _a.sent();
                _a.label = 2;
            case 2:
                if (!(target === 'soldier' || target === 'both')) return [3 /*break*/, 4];
                return [4 /*yield*/, database_1.default.trainingSession.updateMany({
                        where: { recordingType: 'soldier', isActive: true },
                        data: { isActive: false },
                    })];
            case 3:
                _a.sent();
                _a.label = 4;
            case 4: 
            // Activate this session
            return [4 /*yield*/, database_1.default.trainingSession.update({
                    where: { id: id },
                    data: { isActive: true, status: 'ACTIVE' },
                })];
            case 5:
                // Activate this session
                _a.sent();
                res.json({ success: true });
                return [3 /*break*/, 7];
            case 6:
                error_6 = _a.sent();
                console.error('Error activating training session:', error_6);
                res.status(500).json({ success: false, error: 'Failed to activate session' });
                return [3 /*break*/, 7];
            case 7: return [2 /*return*/];
        }
    });
}); });
/**
 * GET /training/active - Get currently active training configurations
 */
router.get('/active', function (_req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var activeSessions, activeConfig, _i, activeSessions_1, session, error_7;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 2, , 3]);
                return [4 /*yield*/, database_1.default.trainingSession.findMany({
                        where: { isActive: true },
                        include: {
                            fieldMappings: true,
                        },
                    })];
            case 1:
                activeSessions = _a.sent();
                activeConfig = {
                    iai: null,
                    soldier: null,
                };
                for (_i = 0, activeSessions_1 = activeSessions; _i < activeSessions_1.length; _i++) {
                    session = activeSessions_1[_i];
                    if (session.recordingType === 'iai') {
                        activeConfig.iai = {
                            sessionId: session.sessionId,
                            automationCode: session.automationCode,
                            fieldMappings: session.fieldMappings,
                            clickSequence: session.clickSequence,
                        };
                    }
                    else if (session.recordingType === 'soldier') {
                        activeConfig.soldier = {
                            sessionId: session.sessionId,
                            automationCode: session.automationCode,
                            fieldMappings: session.fieldMappings,
                            clickSequence: session.clickSequence,
                        };
                    }
                }
                res.json({ success: true, activeConfig: activeConfig });
                return [3 /*break*/, 3];
            case 2:
                error_7 = _a.sent();
                console.error('Error fetching active training:', error_7);
                res.status(500).json({ success: false, error: 'Failed to fetch active training' });
                return [3 /*break*/, 3];
            case 3: return [2 /*return*/];
        }
    });
}); });
/**
 * GET /training/inject/:type - Get injectable training code
 */
router.get('/inject/:type', function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var type, activeSession, injectableCode, error_8;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 2, , 3]);
                type = req.params.type;
                return [4 /*yield*/, database_1.default.trainingSession.findFirst({
                        where: {
                            recordingType: type,
                            isActive: true,
                        },
                        include: {
                            fieldMappings: true,
                        },
                    })];
            case 1:
                activeSession = _a.sent();
                if (!activeSession) {
                    res.status(404).json({ success: false, error: 'No active training found' });
                    return [2 /*return*/];
                }
                injectableCode = generateInjectableCode(activeSession, type);
                res.json({ success: true, code: injectableCode });
                return [3 /*break*/, 3];
            case 2:
                error_8 = _a.sent();
                console.error('Error generating injectable code:', error_8);
                res.status(500).json({ success: false, error: 'Failed to generate code' });
                return [3 /*break*/, 3];
            case 3: return [2 /*return*/];
        }
    });
}); });
// ============================================
// FIELD MAPPING MANAGEMENT
// ============================================
/**
 * GET /training/field-mappings - Get all field mappings
 */
router.get('/field-mappings', function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var _a, active, mappings, activeSessions, grouped, _i, mappings_1, mapping, error_9;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                _b.trys.push([0, 5, , 6]);
                _a = req.query.active, active = _a === void 0 ? 'true' : _a;
                mappings = void 0;
                if (!(active === 'true')) return [3 /*break*/, 2];
                return [4 /*yield*/, database_1.default.trainingSession.findMany({
                        where: { isActive: true },
                        include: { fieldMappings: true },
                    })];
            case 1:
                activeSessions = _b.sent();
                mappings = activeSessions.flatMap(function (s) { return s.fieldMappings; });
                return [3 /*break*/, 4];
            case 2: return [4 /*yield*/, database_1.default.trainingFieldMapping.findMany({
                    orderBy: { fieldType: 'asc' },
                })];
            case 3:
                mappings = _b.sent();
                _b.label = 4;
            case 4:
                grouped = {};
                for (_i = 0, mappings_1 = mappings; _i < mappings_1.length; _i++) {
                    mapping = mappings_1[_i];
                    if (!grouped[mapping.fieldType]) {
                        grouped[mapping.fieldType] = [];
                    }
                    grouped[mapping.fieldType].push(mapping);
                }
                res.json({ success: true, fieldMappings: grouped });
                return [3 /*break*/, 6];
            case 5:
                error_9 = _b.sent();
                console.error('Error fetching field mappings:', error_9);
                res.status(500).json({ success: false, error: 'Failed to fetch field mappings' });
                return [3 /*break*/, 6];
            case 6: return [2 /*return*/];
        }
    });
}); });
/**
 * PUT /training/field-mappings/:id - Update a field mapping
 */
router.put('/field-mappings/:id', function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var id, updates, mapping, error_10;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 2, , 3]);
                id = req.params.id;
                updates = req.body;
                return [4 /*yield*/, database_1.default.trainingFieldMapping.update({
                        where: { id: id },
                        data: updates,
                    })];
            case 1:
                mapping = _a.sent();
                res.json({ success: true, mapping: mapping });
                return [3 /*break*/, 3];
            case 2:
                error_10 = _a.sent();
                console.error('Error updating field mapping:', error_10);
                res.status(500).json({ success: false, error: 'Failed to update field mapping' });
                return [3 /*break*/, 3];
            case 3: return [2 /*return*/];
        }
    });
}); });
// ============================================
// HELPER FUNCTIONS
// ============================================
function processTrainingSession(session) {
    var _a, _b, _c, _d, _e, _f, _g, _h;
    var events = session.events || [];
    var markedElements = session.markedElements || [];
    // Build field selector map from marked elements
    var fieldSelectors = {};
    for (var _i = 0, markedElements_1 = markedElements; _i < markedElements_1.length; _i++) {
        var marked = markedElements_1[_i];
        fieldSelectors[marked.fieldType] = {
            primary: ((_b = (_a = marked.elementData) === null || _a === void 0 ? void 0 : _a.selectors) === null || _b === void 0 ? void 0 : _b[0]) || marked.ariaLabel,
            fallbacks: ((_d = (_c = marked.elementData) === null || _c === void 0 ? void 0 : _c.selectors) === null || _d === void 0 ? void 0 : _d.slice(1)) || [],
            ariaLabel: marked.ariaLabel,
            role: marked.role,
            isDropdown: marked.isDropdown,
            isInput: marked.isInput,
        };
    }
    // Build step sequence from click events
    var steps = [];
    var clickEvents = events.filter(function (e) { return e.type === 'click'; });
    for (var i = 0; i < clickEvents.length; i++) {
        var event_1 = clickEvents[i];
        var prevEvent = i > 0 ? clickEvents[i - 1] : null;
        var waitTime = prevEvent
            ? Math.min(event_1.relativeTime - prevEvent.relativeTime, 3000)
            : 500;
        steps.push({
            step: i + 1,
            action: ((_e = event_1.elementData) === null || _e === void 0 ? void 0 : _e.isDropdown) ? 'selectDropdown' :
                ((_f = event_1.elementData) === null || _f === void 0 ? void 0 : _f.isInput) ? 'fillInput' :
                    event_1.fieldType === 'publish' ? 'publish' : 'click',
            field: event_1.fieldType || 'unknown',
            waitBefore: waitTime,
            selector: (_h = (_g = event_1.elementData) === null || _g === void 0 ? void 0 : _g.selectors) === null || _h === void 0 ? void 0 : _h[0],
            isMarked: event_1.isMarked,
        });
    }
    // Calculate timing recommendations
    var intervals = [];
    for (var i = 1; i < clickEvents.length; i++) {
        intervals.push(clickEvents[i].relativeTime - clickEvents[i - 1].relativeTime);
    }
    var timing = {
        averageDelay: intervals.length > 0
            ? Math.round(intervals.reduce(function (a, b) { return a + b; }, 0) / intervals.length)
            : 500,
        minDelay: intervals.length > 0 ? Math.min.apply(Math, intervals) : 200,
        maxDelay: intervals.length > 0 ? Math.max.apply(Math, intervals) : 2000,
        recommendedDelay: intervals.length > 0
            ? Math.round(intervals.reduce(function (a, b) { return a + b; }, 0) / intervals.length * 0.8)
            : 400,
    };
    return {
        automationCode: {
            version: '2.0',
            generatedAt: new Date().toISOString(),
            type: session.recordingType,
            mode: session.mode,
            fieldSelectors: fieldSelectors,
            steps: steps,
            timing: timing,
        },
    };
}
function generateInjectableCode(session, type) {
    var automationCode = session.automationCode || {};
    var fieldMappings = session.fieldMappings || [];
    // Build selector map
    var selectors = {};
    for (var _i = 0, fieldMappings_1 = fieldMappings; _i < fieldMappings_1.length; _i++) {
        var mapping = fieldMappings_1[_i];
        selectors[mapping.fieldType] = {
            primary: mapping.primarySelector,
            fallbacks: mapping.fallbackSelectors || [],
            ariaLabel: mapping.ariaLabel,
            role: mapping.role,
            isDropdown: mapping.isDropdown,
            isInput: mapping.isInput,
        };
    }
    var code = __assign({ _trainingVersion: '2.0', _sessionId: session.sessionId, _generatedAt: new Date().toISOString(), _type: type, 
        // Field selectors for finding elements
        FIELD_SELECTORS: selectors, 
        // Step sequence for automation
        STEPS: automationCode.steps || [], 
        // Timing configuration
        TIMING: automationCode.timing || {
            averageDelay: 500,
            recommendedDelay: 400,
        } }, (type === 'soldier' && {
        NAVIGATION: {
            messagesUrl: '/marketplace/inbox',
            sellingsUrl: '/marketplace/you/selling',
            createListingUrl: '/marketplace/create/item',
        },
    }));
    return code;
}
// Export handlers for public access (bypassing ring5AuthBarrier)
var handleHeartbeat = function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var _a, browserId, version, currentTab, recordingActive;
    return __generator(this, function (_b) {
        try {
            _a = req.body, browserId = _a.browserId, version = _a.version, currentTab = _a.currentTab, recordingActive = _a.recordingActive;
            rootConsoleState.connected = true;
            rootConsoleState.lastHeartbeat = new Date();
            rootConsoleState.browserId = browserId || null;
            rootConsoleState.version = version || null;
            rootConsoleState.currentTab = currentTab || null;
            rootConsoleState.recordingActive = recordingActive || false;
            console.log('[ROOT Console] Heartbeat received (public):', {
                browserId: browserId,
                version: version,
                currentTab: currentTab,
                recordingActive: recordingActive,
            });
            res.json({
                success: true,
                message: 'Heartbeat acknowledged',
                serverTime: new Date().toISOString(),
            });
        }
        catch (error) {
            console.error('[ROOT Console] Heartbeat error:', error);
            res.status(500).json({ success: false, error: 'Heartbeat failed' });
        }
        return [2 /*return*/];
    });
}); };
exports.handleHeartbeat = handleHeartbeat;
var getConsoleStatus = function (_req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var connected;
    var _a;
    return __generator(this, function (_b) {
        try {
            connected = isRootConsoleConnected();
            res.json({
                success: true,
                connected: connected,
                lastHeartbeat: ((_a = rootConsoleState.lastHeartbeat) === null || _a === void 0 ? void 0 : _a.toISOString()) || null,
                browserId: rootConsoleState.browserId,
                version: rootConsoleState.version,
                currentTab: rootConsoleState.currentTab,
                recordingActive: rootConsoleState.recordingActive,
                timeSinceHeartbeat: rootConsoleState.lastHeartbeat
                    ? Date.now() - rootConsoleState.lastHeartbeat.getTime()
                    : null,
            });
        }
        catch (error) {
            console.error('[ROOT Console] Status error:', error);
            res.status(500).json({ success: false, error: 'Status check failed' });
        }
        return [2 /*return*/];
    });
}); };
exports.getConsoleStatus = getConsoleStatus;
exports.default = router;
