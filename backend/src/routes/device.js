import express from 'express';
import { deviceSimulator } from '../services/deviceSimulator.js';
import { databaseService } from '../services/databaseService.js';
import { logger } from '../config/logger.js';
import Joi from 'joi';

const router = express.Router();

// Validation schemas
const controlSchema = Joi.object({
    actuator: Joi.string().required(),
    state: Joi.alternatives().try(Joi.boolean(), Joi.number(), Joi.string()).required()
});

const validateDeviceId = (req, res, next) => {
    const { deviceId } = req.params;
    if (!deviceId || deviceId.length < 3) {
        return res.status(400).json({ error: 'Device ID invalide' });
    }
    next();
};

// GET /api/devices - Liste des dispositifs
router.get('/', async (req, res) => {
    try {
        const devices = deviceSimulator.getDeviceStates();
        res.json(devices);
    } catch (error) {
        logger.error('Erreur récupération dispositifs:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// GET /api/devices/:deviceId - Détails d'un dispositif
router.get('/:deviceId', validateDeviceId, async (req, res) => {
    try {
        const { deviceId } = req.params;
        const device = deviceSimulator.getDevice(deviceId);
        
        if (!device) {
            return res.status(404).json({ error: 'Dispositif non trouvé' });
        }

        const recentData = await databaseService.getDeviceHistory(deviceId, 1);
        
        res.json({
            ...device,
            recentData: recentData.slice(-10)
        });
    } catch (error) {
        logger.error('Erreur détails dispositif:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// GET /api/devices/:deviceId/history - Historique d'un dispositif
router.get('/:deviceId/history', validateDeviceId, async (req, res) => {
    try {
        const { deviceId } = req.params;
        const { hours = 24, sensor } = req.query;
        
        let history = await databaseService.getDeviceHistory(deviceId, parseInt(hours));
        
        if (sensor) {
            history = history.filter(record => record.sensorType === sensor);
        }

        res.json(history);
    } catch (error) {
        logger.error('Erreur historique dispositif:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// GET /api/devices/:deviceId/stats - Statistiques d'un dispositif
router.get('/:deviceId/stats', validateDeviceId, async (req, res) => {
    try {
        const { deviceId } = req.params;
        const { sensor, period = '24h' } = req.query;
        
        if (!sensor) {
            return res.status(400).json({ error: 'Paramètre sensor requis' });
        }

        const stats = await databaseService.getStatistics(deviceId, sensor, period);
        res.json(stats);
    } catch (error) {
        logger.error('Erreur statistiques dispositif:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// POST /api/devices/:deviceId/control - Contrôler un actionneur
router.post('/:deviceId/control', validateDeviceId, async (req, res) => {
    try {
        const { error, value } = controlSchema.validate(req.body);
        if (error) {
            return res.status(400).json({ error: error.details[0].message });
        }

        const { deviceId } = req.params;
        const { actuator, state } = value;

        const success = deviceSimulator.controlActuator(deviceId, actuator, state);
        
        if (!success) {
            return res.status(404).json({ 
                error: 'Dispositif ou actionneur non trouvé' 
            });
        }

        logger.info(`🎛️ Contrôle ${actuator}=${state} sur ${deviceId}`);
        
        res.json({
            success: true,
            deviceId,
            actuator,
            state,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        logger.error('Erreur contrôle dispositif:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

export default router;