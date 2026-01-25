"use strict";
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
exports.authorize = exports.authenticate = void 0;
var jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
var errorHandler_1 = require("@/middleware/errorHandler");
var database_1 = __importDefault(require("@/config/database"));
var rbac_1 = require("./rbac");
var logger_1 = require("@/utils/logger");
var authenticate = function (req, _res, next) { return __awaiter(void 0, void 0, void 0, function () {
    var authHeader, token, decoded, userId, user, isSuperAdmin, error_1;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 2, , 3]);
                authHeader = req.headers.authorization;
                if (!authHeader || !authHeader.startsWith('Bearer ')) {
                    throw new errorHandler_1.AppError('No token provided', 401);
                }
                token = authHeader.split(' ')[1];
                if (!token) {
                    throw new errorHandler_1.AppError('Invalid token format', 401);
                }
                decoded = jsonwebtoken_1.default.verify(token, process.env.JWT_SECRET);
                userId = decoded.id || decoded.userId;
                if (!userId) {
                    logger_1.logger.error('Token missing user ID', { decoded: { hasId: !!decoded.id, hasUserId: !!decoded.userId }, path: req.path });
                    throw new errorHandler_1.AppError('Invalid token: missing user ID', 401);
                }
                return [4 /*yield*/, database_1.default.user.findUnique({
                        where: { id: userId },
                        include: {
                            accountUsers: {
                                include: {
                                    account: true,
                                },
                            },
                        },
                    })];
            case 1:
                user = _a.sent();
                if (!user || !user.isActive) {
                    throw new errorHandler_1.AppError('User not found or inactive', 401);
                }
                isSuperAdmin = user.accountUsers.some(function (au) { return au.role === 'SUPER_ADMIN'; });
                // Update last login (async, don't wait)
                database_1.default.user.update({
                    where: { id: user.id },
                    data: { lastLoginAt: new Date() },
                }).catch(function () { }); // Ignore errors
                // Attach user to request
                req.user = {
                    id: user.id,
                    email: user.email,
                    accountIds: user.accountUsers.map(function (au) { return au.accountId; }),
                    role: isSuperAdmin ? rbac_1.UserRole.SUPER_ADMIN : undefined,
                };
                next();
                return [3 /*break*/, 3];
            case 2:
                error_1 = _a.sent();
                if (error_1 instanceof jsonwebtoken_1.default.TokenExpiredError) {
                    return [2 /*return*/, next(new errorHandler_1.AppError('Token expired', 401))];
                }
                if (error_1 instanceof jsonwebtoken_1.default.JsonWebTokenError) {
                    return [2 /*return*/, next(new errorHandler_1.AppError('Invalid token', 401))];
                }
                next(error_1);
                return [3 /*break*/, 3];
            case 3: return [2 /*return*/];
        }
    });
}); };
exports.authenticate = authenticate;
var authorize = function () {
    var roles = [];
    for (var _i = 0; _i < arguments.length; _i++) {
        roles[_i] = arguments[_i];
    }
    return function (req, _res, next) { return __awaiter(void 0, void 0, void 0, function () {
        var accountId, accountUser, error_2;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 2, , 3]);
                    accountId = req.params.accountId || req.body.accountId;
                    if (!accountId) {
                        throw new errorHandler_1.AppError('Account ID required', 400);
                    }
                    return [4 /*yield*/, database_1.default.accountUser.findUnique({
                            where: {
                                accountId_userId: {
                                    accountId: accountId,
                                    userId: req.user.id,
                                },
                            },
                        })];
                case 1:
                    accountUser = _a.sent();
                    if (!accountUser) {
                        throw new errorHandler_1.AppError('Access denied', 403);
                    }
                    if (roles.length && !roles.includes(accountUser.role)) {
                        throw new errorHandler_1.AppError('Insufficient permissions', 403);
                    }
                    next();
                    return [3 /*break*/, 3];
                case 2:
                    error_2 = _a.sent();
                    next(error_2);
                    return [3 /*break*/, 3];
                case 3: return [2 /*return*/];
            }
        });
    }); };
};
exports.authorize = authorize;
