"use strict";
var __extends = (this && this.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (Object.prototype.hasOwnProperty.call(b, p)) d[p] = b[p]; };
        return extendStatics(d, b);
    };
    return function (d, b) {
        if (typeof b !== "function" && b !== null)
            throw new TypeError("Class extends value " + String(b) + " is not a constructor or null");
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
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
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.asyncHandler = exports.errorHandler = exports.AppError = void 0;
var logger_1 = require("@/utils/logger");
var AppError = /** @class */ (function (_super) {
    __extends(AppError, _super);
    function AppError(message, statusCode) {
        var _this = _super.call(this, message) || this;
        _this.statusCode = statusCode;
        _this.isOperational = true;
        Error.captureStackTrace(_this, _this.constructor);
        return _this;
    }
    return AppError;
}(Error));
exports.AppError = AppError;
var errorHandler = function (err, req, res, _next) {
    var statusCode = 500;
    var message = 'Internal Server Error';
    if (err instanceof AppError) {
        statusCode = err.statusCode;
        message = err.message;
    }
    // Log error to console
    logger_1.logger.error('Error occurred:', {
        message: err.message,
        stack: err.stack,
        statusCode: statusCode,
        path: req.path,
        method: req.method,
        ip: req.ip,
    });
    // Log error to Error Monitoring System for AI intervention
    logErrorToMonitoring(req, err, statusCode).catch(function (e) {
        logger_1.logger.warn('Failed to log error to monitoring:', e);
    });
    // Send error response
    res.status(statusCode).json(__assign({ success: false, message: message, error: message }, (process.env.NODE_ENV === 'development' && {
        stack: err.stack,
        details: err,
    })));
};
exports.errorHandler = errorHandler;
/**
 * Log error to the Error Monitoring Service for AI analysis
 */
function logErrorToMonitoring(req, err, statusCode) {
    return __awaiter(this, void 0, void 0, function () {
        var errorMonitoringService, severity, userId, sessionToken, errorType, error_1;
        var _a, _b;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    _c.trys.push([0, 3, , 4]);
                    return [4 /*yield*/, Promise.resolve().then(function () { return __importStar(require('@/services/error-monitoring.service')); })];
                case 1:
                    errorMonitoringService = (_c.sent()).errorMonitoringService;
                    severity = 'ERROR';
                    if (statusCode >= 500) {
                        severity = statusCode === 503 ? 'CRITICAL' : 'ERROR';
                    }
                    else if (statusCode === 401 || statusCode === 403) {
                        severity = 'WARNING';
                    }
                    else if (statusCode === 404) {
                        severity = 'WARNING'; // Don't escalate 404s
                    }
                    // Don't log repeated auth failures (too noisy)
                    if (statusCode === 401 && err.message === 'Invalid token') {
                        return [2 /*return*/]; // Skip noisy auth failures
                    }
                    userId = ((_a = req.user) === null || _a === void 0 ? void 0 : _a.id) || 'anonymous';
                    sessionToken = ((_b = req.headers.authorization) === null || _b === void 0 ? void 0 : _b.replace('Bearer ', '')) || 'no-token';
                    errorType = 'SERVER_ERROR';
                    if (statusCode === 400)
                        errorType = 'VALIDATION_ERROR';
                    else if (statusCode === 401)
                        errorType = 'AUTH_ERROR';
                    else if (statusCode === 403)
                        errorType = 'PERMISSION_ERROR';
                    else if (statusCode === 404)
                        errorType = 'NOT_FOUND';
                    else if (statusCode === 429)
                        errorType = 'RATE_LIMIT';
                    else if (statusCode >= 500)
                        errorType = 'SERVER_ERROR';
                    return [4 /*yield*/, errorMonitoringService.logError({
                            userId: userId,
                            sessionToken: sessionToken.substring(0, 50), // Truncate for storage
                            errorType: errorType,
                            errorCode: "HTTP_".concat(statusCode),
                            errorMessage: err.message,
                            stackTrace: err.stack,
                            endpoint: req.path,
                            httpMethod: req.method,
                            httpStatus: statusCode,
                            requestPayload: req.body && Object.keys(req.body).length > 0
                                ? JSON.stringify(req.body).substring(0, 500)
                                : undefined,
                            userAction: "".concat(req.method, " ").concat(req.path),
                            pageUrl: req.headers.referer || req.headers.origin || 'API',
                            severity: severity,
                        })];
                case 2:
                    _c.sent();
                    logger_1.logger.debug("Error logged to monitoring: ".concat(errorType, " (").concat(statusCode, ") - ").concat(err.message));
                    return [3 /*break*/, 4];
                case 3:
                    error_1 = _c.sent();
                    // Don't let monitoring failures break the error handler
                    logger_1.logger.warn('Error monitoring logging failed:', error_1);
                    return [3 /*break*/, 4];
                case 4: return [2 /*return*/];
            }
        });
    });
}
var asyncHandler = function (fn) {
    return function (req, res, next) {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
};
exports.asyncHandler = asyncHandler;
