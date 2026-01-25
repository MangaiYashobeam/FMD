"use strict";
var _a;
Object.defineProperty(exports, "__esModule", { value: true });
var client_1 = require("@prisma/client");
var logger_1 = require("@/utils/logger");
var prismaClientSingleton = function () {
    return new client_1.PrismaClient({
        log: [
            {
                emit: 'event',
                level: 'query',
            },
            {
                emit: 'event',
                level: 'error',
            },
            {
                emit: 'event',
                level: 'info',
            },
            {
                emit: 'event',
                level: 'warn',
            },
        ],
    });
};
var prisma = (_a = globalThis.prisma) !== null && _a !== void 0 ? _a : prismaClientSingleton();
// Log queries in development
if (process.env.NODE_ENV === 'development') {
    prisma.$on('query', function (e) {
        logger_1.logger.debug('Query: ' + e.query);
        logger_1.logger.debug('Duration: ' + e.duration + 'ms');
    });
}
// Log errors
prisma.$on('error', function (e) {
    logger_1.logger.error('Prisma error:', e);
});
if (process.env.NODE_ENV !== 'production')
    globalThis.prisma = prisma;
exports.default = prisma;
