import express from 'express';
import { databaseService } from '../services/databaseService.js';
import { deviceSimulator } from '../services/deviceSimulator.js';
import { mqttService } from '../services/mqttService.js';
import { logger } from '../config/logger.js';

const router = express.Router();

// GET /api/status - Statut général du système
router.get('/status', async (req, res) => {
    try {
        const devices = deviceSimulator.getDeviceStates();
        const deviceCount = Object.keys(devices).length;
        const onlineCount = Object.values(devices).filter(d => d.status === 'online').length;
        const alerts = await databaseService.getActiveAlerts();

        res.json({
            status: 'healthy',
            timestamp: new Date().toISOString(),
            devices: {
                total: deviceCount,
                online: onlineCount,
                offline: deviceCount - onlineCount
            },
            alerts: {
                total: alerts.length,
                critical: alerts.filter(a => a.severity === 'critical').length
            },
            mqtt: {
                connected: mqttService.isConnected
            },
            uptime: process.uptime(),
            memory: process.memoryUsage(),
            version: process.env.npm_package_version || '1.0.0'
        });
    } catch (error) {
        logger.error('Erreur status API:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// GET /api/alerts - Alertes actives
router.get('/alerts', async (req, res) => {
    try {
        const alerts = await databaseService.getActiveAlerts();
        res.json(alerts);
    } catch (error) {
        logger.error('Erreur récupération alertes:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// POST /api/alerts/:alertId/acknowledge - Acquitter une alerte
router.post('/alerts/:alertId/acknowledge', async (req, res) => {
    try {
        const { alertId } = req.params;
        
        const success = await databaseService.acknowledgeAlert(alertId);
        
        if (!success) {
            return res.status(404).json({ error: 'Alerte non trouvée' });
        }

        res.json({ success: true, alertId });
    } catch (error) {
        logger.error('Erreur acquittement alerte:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// GET /api/data/recent - Données récentes de tous les dispositifs
router.get('/data/recent', async (req, res) => {
    try {
        const { limit = 100 } = req.query;
        const data = await databaseService.getRecentData(parseInt(limit));
        res.json(data);
    } catch (error) {
        logger.error('Erreur données récentes:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// POST /api/simulation/control - Contrôler la simulation
router.post('/simulation/control', async (req, res) => {
    try {
        const { action } = req.body;
        
        switch (action) {
            case 'start':
                deviceSimulator.startSimulation();
                break;
            case 'stop':
                deviceSimulator.stopSimulation();
                break;
            case 'restart':
                deviceSimulator.stopSimulation();
                setTimeout(() => deviceSimulator.startSimulation(), 1000);
                break;
            default:
                return res.status(400).json({ error: 'Action invalide' });
        }

        res.json({ 
            success: true, 
            action,
            isRunning: deviceSimulator.isRunning 
        });
    } catch (error) {
        logger.error('Erreur contrôle simulation:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// GET /api/simulation/status - Statut de la simulation
router.get('/simulation/status', (req, res) => {
    res.json({
        isRunning: deviceSimulator.isRunning,
        deviceCount: deviceSimulator.devices.size,
        simulationSpeed: deviceSimulator.simulationSpeed
    });
});

// POST /api/simulation/speed - Modifier la vitesse de simulation
router.post('/simulation/speed', (req, res) => {
    try {
        const { speed } = req.body;
        
        if (!speed || speed < 100 || speed > 10000) {
            return res.status(400).json({ 
                error: 'Vitesse invalide (100-10000ms)' 
            });
        }

        deviceSimulator.simulationSpeed = speed;
        
        if (deviceSimulator.isRunning) {
            deviceSimulator.stopSimulation();
            deviceSimulator.startSimulation();
        }

        res.json({ 
            success: true, 
            speed: deviceSimulator.simulationSpeed 
        });
    } catch (error) {
        logger.error('Erreur modification vitesse:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

export default router;
