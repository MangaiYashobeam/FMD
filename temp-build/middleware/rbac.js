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
var _a;
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireSalesRep = exports.requireAdmin = exports.requireAccountOwner = exports.requireSuperAdmin = exports.PERMISSIONS = exports.UserRole = void 0;
exports.getUserRole = getUserRole;
exports.hasPermission = hasPermission;
exports.isRoleHigherOrEqual = isRoleHigherOrEqual;
exports.requireRole = requireRole;
exports.requirePermission = requirePermission;
exports.canAccessUserResource = canAccessUserResource;
exports.logPermissionCheck = logPermissionCheck;
var errorHandler_1 = require("./errorHandler");
var database_1 = __importDefault(require("@/config/database"));
var logger_1 = require("@/utils/logger");
/**
 * Role hierarchy (higher = more permissions)
 */
var UserRole;
(function (UserRole) {
    UserRole["VIEWER"] = "VIEWER";
    UserRole["SALES_REP"] = "SALES_REP";
    UserRole["ADMIN"] = "ADMIN";
    UserRole["ACCOUNT_OWNER"] = "ACCOUNT_OWNER";
    UserRole["SUPER_ADMIN"] = "SUPER_ADMIN";
})(UserRole || (exports.UserRole = UserRole = {}));
var ROLE_HIERARCHY = (_a = {},
    _a[UserRole.VIEWER] = 0,
    _a[UserRole.SALES_REP] = 1,
    _a[UserRole.ADMIN] = 2,
    _a[UserRole.ACCOUNT_OWNER] = 3,
    _a[UserRole.SUPER_ADMIN] = 4,
    _a);
/**
 * Permission matrix defining what each role can do
 */
exports.PERMISSIONS = {
    // System-wide permissions (SUPER_ADMIN only)
    MANAGE_ALL_ACCOUNTS: [UserRole.SUPER_ADMIN],
    MANAGE_SUBSCRIPTION_PLANS: [UserRole.SUPER_ADMIN],
    VIEW_ALL_PAYMENTS: [UserRole.SUPER_ADMIN],
    MANAGE_SYSTEM_SETTINGS: [UserRole.SUPER_ADMIN],
    // Account management
    MANAGE_ACCOUNT_SETTINGS: [UserRole.SUPER_ADMIN, UserRole.ACCOUNT_OWNER, UserRole.ADMIN],
    MANAGE_USERS: [UserRole.SUPER_ADMIN, UserRole.ACCOUNT_OWNER, UserRole.ADMIN],
    VIEW_ACCOUNT_ANALYTICS: [UserRole.SUPER_ADMIN, UserRole.ACCOUNT_OWNER, UserRole.ADMIN, UserRole.VIEWER],
    // Subscription & Billing
    MANAGE_SUBSCRIPTION: [UserRole.SUPER_ADMIN, UserRole.ACCOUNT_OWNER],
    VIEW_PAYMENTS: [UserRole.SUPER_ADMIN, UserRole.ACCOUNT_OWNER, UserRole.ADMIN],
    // Vehicle management
    MANAGE_VEHICLES: [UserRole.SUPER_ADMIN, UserRole.ACCOUNT_OWNER, UserRole.ADMIN],
    VIEW_VEHICLES: [UserRole.SUPER_ADMIN, UserRole.ACCOUNT_OWNER, UserRole.ADMIN, UserRole.SALES_REP, UserRole.VIEWER],
    // Posting
    POST_TO_MARKETPLACE: [UserRole.SUPER_ADMIN, UserRole.ACCOUNT_OWNER, UserRole.ADMIN, UserRole.SALES_REP],
    MANAGE_ALL_POSTS: [UserRole.SUPER_ADMIN, UserRole.ACCOUNT_OWNER, UserRole.ADMIN],
    MANAGE_OWN_POSTS: [UserRole.SUPER_ADMIN, UserRole.ACCOUNT_OWNER, UserRole.ADMIN, UserRole.SALES_REP],
    // Templates & AI
    MANAGE_TEMPLATES: [UserRole.SUPER_ADMIN, UserRole.ACCOUNT_OWNER, UserRole.ADMIN],
    USE_TEMPLATES: [UserRole.SUPER_ADMIN, UserRole.ACCOUNT_OWNER, UserRole.ADMIN, UserRole.SALES_REP],
    MANAGE_AI_SETTINGS: [UserRole.SUPER_ADMIN, UserRole.ACCOUNT_OWNER, UserRole.ADMIN],
    // Facebook credentials (personal)
    MANAGE_OWN_FB_CREDENTIALS: [UserRole.SUPER_ADMIN, UserRole.ACCOUNT_OWNER, UserRole.ADMIN, UserRole.SALES_REP],
    VIEW_OTHERS_FB_CREDENTIALS: [UserRole.SUPER_ADMIN, UserRole.ACCOUNT_OWNER],
    // Sync operations
    TRIGGER_SYNC: [UserRole.SUPER_ADMIN, UserRole.ACCOUNT_OWNER, UserRole.ADMIN],
    VIEW_SYNC_STATUS: [UserRole.SUPER_ADMIN, UserRole.ACCOUNT_OWNER, UserRole.ADMIN, UserRole.SALES_REP, UserRole.VIEWER],
};
/**
 * Check if user has specific role in account
 */
function getUserRole(userId, accountId) {
    return __awaiter(this, void 0, void 0, function () {
        var accountUser;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, database_1.default.accountUser.findUnique({
                        where: {
                            accountId_userId: {
                                accountId: accountId,
                                userId: userId,
                            },
                        },
                    })];
                case 1:
                    accountUser = _a.sent();
                    return [2 /*return*/, (accountUser === null || accountUser === void 0 ? void 0 : accountUser.role) || null];
            }
        });
    });
}
/**
 * Check if user has permission
 */
function hasPermission(userRole, permission) {
    var allowedRoles = exports.PERMISSIONS[permission];
    return allowedRoles.includes(userRole);
}
/**
 * Check if role1 is higher or equal to role2
 */
function isRoleHigherOrEqual(role1, role2) {
    return ROLE_HIERARCHY[role1] >= ROLE_HIERARCHY[role2];
}
/**
 * Middleware: Require specific role
 */
function requireRole() {
    var _this = this;
    var allowedRoles = [];
    for (var _i = 0; _i < arguments.length; _i++) {
        allowedRoles[_i] = arguments[_i];
    }
    return function (req, _res, next) { return __awaiter(_this, void 0, void 0, function () {
        var accountId, userRole_1, hasRequiredRole, error_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 2, , 3]);
                    if (!req.user) {
                        throw new errorHandler_1.AppError('Authentication required', 401);
                    }
                    accountId = req.params.accountId || req.body.accountId;
                    if (!accountId) {
                        // Super admin can access without account context
                        if (req.user.role === UserRole.SUPER_ADMIN && allowedRoles.includes(UserRole.SUPER_ADMIN)) {
                            return [2 /*return*/, next()];
                        }
                        throw new errorHandler_1.AppError('Account ID required', 400);
                    }
                    return [4 /*yield*/, getUserRole(req.user.id, accountId)];
                case 1:
                    userRole_1 = _a.sent();
                    if (!userRole_1) {
                        throw new errorHandler_1.AppError('Not a member of this account', 403);
                    }
                    hasRequiredRole = allowedRoles.some(function (role) {
                        return isRoleHigherOrEqual(userRole_1, role);
                    });
                    if (!hasRequiredRole) {
                        logger_1.logger.warn("Access denied: User ".concat(req.user.id, " (").concat(userRole_1, ") attempted to access ").concat(req.path, " requiring [").concat(allowedRoles.join(', '), "]"));
                        throw new errorHandler_1.AppError('Insufficient permissions', 403);
                    }
                    // Add role to request for downstream use
                    req.userRole = userRole_1;
                    next();
                    return [3 /*break*/, 3];
                case 2:
                    error_1 = _a.sent();
                    next(error_1);
                    return [3 /*break*/, 3];
                case 3: return [2 /*return*/];
            }
        });
    }); };
}
/**
 * Middleware: Require specific permission
 */
function requirePermission() {
    var _this = this;
    var permissions = [];
    for (var _i = 0; _i < arguments.length; _i++) {
        permissions[_i] = arguments[_i];
    }
    return function (req, _res, next) { return __awaiter(_this, void 0, void 0, function () {
        var accountId, userRole_2, hasAllPermissions, error_2;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 2, , 3]);
                    if (!req.user) {
                        throw new errorHandler_1.AppError('Authentication required', 401);
                    }
                    accountId = req.params.accountId || req.body.accountId;
                    // Super admin always has all permissions
                    if (req.user.role === UserRole.SUPER_ADMIN) {
                        req.userRole = UserRole.SUPER_ADMIN;
                        return [2 /*return*/, next()];
                    }
                    if (!accountId) {
                        throw new errorHandler_1.AppError('Account ID required', 400);
                    }
                    return [4 /*yield*/, getUserRole(req.user.id, accountId)];
                case 1:
                    userRole_2 = _a.sent();
                    if (!userRole_2) {
                        throw new errorHandler_1.AppError('Not a member of this account', 403);
                    }
                    hasAllPermissions = permissions.every(function (permission) {
                        return hasPermission(userRole_2, permission);
                    });
                    if (!hasAllPermissions) {
                        logger_1.logger.warn("Permission denied: User ".concat(req.user.id, " (").concat(userRole_2, ") lacks permissions [").concat(permissions.join(', '), "]"));
                        throw new errorHandler_1.AppError('Insufficient permissions', 403);
                    }
                    req.userRole = userRole_2;
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
}
/**
 * Middleware: Require super admin
 */
exports.requireSuperAdmin = requireRole(UserRole.SUPER_ADMIN);
/**
 * Middleware: Require account owner
 */
exports.requireAccountOwner = requireRole(UserRole.ACCOUNT_OWNER, UserRole.SUPER_ADMIN);
/**
 * Middleware: Require admin
 */
exports.requireAdmin = requireRole(UserRole.ADMIN, UserRole.ACCOUNT_OWNER, UserRole.SUPER_ADMIN);
/**
 * Middleware: Require sales rep or higher
 */
exports.requireSalesRep = requireRole(UserRole.SALES_REP, UserRole.ADMIN, UserRole.ACCOUNT_OWNER, UserRole.SUPER_ADMIN);
/**
 * Check if user can access resource owned by another user
 */
function canAccessUserResource(requestingUserId, resourceOwnerId, accountId) {
    return __awaiter(this, void 0, void 0, function () {
        var userRole;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    // Can always access own resources
                    if (requestingUserId === resourceOwnerId) {
                        return [2 /*return*/, true];
                    }
                    return [4 /*yield*/, getUserRole(requestingUserId, accountId)];
                case 1:
                    userRole = _a.sent();
                    if (!userRole) {
                        return [2 /*return*/, false];
                    }
                    // Admins and above can access all user resources in their account
                    return [2 /*return*/, isRoleHigherOrEqual(userRole, UserRole.ADMIN)];
            }
        });
    });
}
/**
 * Audit log for permission checks
 */
function logPermissionCheck(userId, action, accountId, granted, reason) {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, database_1.default.auditLog.create({
                        data: {
                            userId: userId,
                            action: action,
                            entityType: 'PERMISSION_CHECK',
                            entityId: accountId,
                            metadata: {
                                granted: granted,
                                reason: reason || (granted ? 'Permission granted' : 'Permission denied'),
                            },
                        },
                    })];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    });
}
