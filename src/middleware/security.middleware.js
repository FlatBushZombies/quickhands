import aj from "#config/arcjet.js";
import { slidingWindow } from "@arcjet/node";
import logger from '#config/logger.js'


export const securityMiddleware =  async (req, res, next) => {
    try {

        const role = req.user?.role || 'guest';

        let limit;
        let message;

        switch(role) {
            case 'admin':
                limit=20
                message='Admin request limit exceeded'
                break;
            case 'user':
                limit=10
                message='User request limit exceeded'
                break;
            case 'guest':
                limit=5
                message:'Guest request limit exceeded'
                break;
        }

        const client = aj.withRule(slidingWindow({ mode: 'LIVE', interval: '1m', max: limit, name: `${role}-rate-limit`}));

        const decision = await client.protect(req);

        if(decision.isDenied() && decision.reason.isBot()) {
            logger.warn('Bot request blocked', {
                ip: req.ip, userAgent: req.get('User-Agent'), path: req.path
            });

            return res.status(403).json({ error: 'Forbidden', message: 'Automated requests are not allowed'})
        }

        if(decision.isDenied() && decision.reason.isShield()) {
            logger.warn('Shield block request', {
                ip: req.ip, userAgent: req.get('User-Agent'), path: req.path, method: req.method
            });

            return res.status(403).json({ error: 'Forbidden', message: 'Request blocked by security policy'})
        }

        if(decision.isDenied() && decision.reason.isRateLimit()) {
            logger.warn('Rate Limit exceeded', {
                ip: req.ip, userAgent: req.get('User-Agent'), path: req.path
            })

            return res.status(403).json({ error: 'Forbidden', message: 'Too many requests'})
        }

        next();
        
    } catch (error) {
        console.error('Arcjet middleware error:', e);
        res.status(500).json({error: 'Internal server error', message: 'Something went wrong with security middleware'})
    }    
}