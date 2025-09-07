
import { logger } from '../config/logger.js';

export const errorHandler = (err, req, res, next) => {
    logger.error('Erreur non gérée:', {
        message: err.message,
        stack: err.stack,
        url: req.url,
        method: req.method,
        ip: req.ip
    });

    // Erreurs de validation Joi
    if (err.isJoi) {
        return res.status(400).json({
            error: 'Données invalides',
            details: err.details.map(d => d.message)
        });
    }

    // Erreurs Sequelize
    if (err.name === 'SequelizeValidationError') {
        return res.status(400).json({
            error: 'Erreur de validation',
            details: err.errors.map(e => e.message)
        });
    }

    // Erreur générique
    res.status(err.status || 500).json({
        error: process.env.NODE_ENV === 'development' ? 
            err.message : 'Erreur serveur interne'
    });
};
