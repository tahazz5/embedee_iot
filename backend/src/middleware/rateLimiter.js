import { RateLimiterMemory } from 'rate-limiter-flexible';
import { logger } from '../config/logger.js';

const rateLimiter = new RateLimiterMemory({
    keyGenerator: (req) => req.ip,
    points: 100, // Nombre de requêtes
    duration: 60, // Par minute
});

export const rateLimiterMiddleware = async (req, res, next) => {
    try {
        await rateLimiter.consume(req.ip);
        next();
    } catch (rejRes) {
        logger.warn(`Rate limit dépassé pour ${req.ip}`);
        res.status(429).json({
            error: 'Trop de requêtes',
            retryAfter: Math.round(rejRes.msBeforeNext / 1000)
        });
    }
};
