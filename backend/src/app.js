import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import dotenv from 'dotenv';

// Import des services et configurations
import { logger } from './config/logger.js';
import { connectDatabase } from './config/database.js';
import { initializeModels } from './models/index.js';
import { mqttService } from './services/mqttService.js';
import { deviceSimulator } from './services/deviceSimulator.js';
import { databaseService } from './services/databaseService.js';

// Import des routes et middleware
import apiRoutes from './routes/api.js';
import deviceRoutes from './routes/devices.js';
import { rateLimiterMiddleware } from './middleware/rateLimiter.js';
import { errorHandler } from './middleware/errorHandler.js';

// Configuration
dotenv.config();

class IoTApplication {
    constructor() {
        this.app = express();
        this.server = createServer(this.app);
        this.io = new Server(this.server, {
            cors: {
                origin: process.env.FRONTEND_URL || "http://localhost:3000",
                methods: ["GET", "POST", "PUT", "DELETE"]
            }
        });
        this.port = process.env.PORT || 8000;
    }

    async initialize() {
        logger.info('🚀 Initialisation de l\'application IoT...');
        
        try {
            await this.setupMiddleware();
            await this.setupDatabase();
            await this.setupMQTT();
            await this.setupRoutes();
            await this.setupSocketIO();
            await this.startDeviceSimulation();
            await this.startServer();
            
            logger.info('✅ Application IoT démarrée avec succès');
        } catch (error) {
            logger.error('❌ Erreur lors de l\'initialisation:', error);
            process.exit(1);
        }
    }

    async setupMiddleware() {
        // Sécurité
        this.app.use(helmet({
            contentSecurityPolicy: false
        }));
        
        // Compression
        this.app.use(compression());
        
        // CORS
        this.app.use(cors({
            origin: process.env.FRONTEND_URL || "http://localhost:3000",
            credentials: true
        }));
        
        // Rate limiting
        this.app.use(rateLimiterMiddleware);
        
        // Parsing JSON
        this.app.use(express.json({ limit: '10mb' }));
        this.app.use(express.urlencoded({ extended: true }));
        
        // Logs des requêtes
        this.app.use((req, res, next) => {
            logger.info(`${req.method} ${req.path} - ${req.ip}`);
            next();
        });
        
        logger.info('✅ Middleware configurés');
    }

    async setupDatabase() {
        await connectDatabase();
        initializeModels();
        databaseService.initialize();
        logger.info('✅ Base de données initialisée');
    }

    async setupMQTT() {
        await mqttService.initialize();
        
        // Écouter les données des capteurs
        mqttService.on('sensorData', (data) => {
            databaseService.saveSensorData(data);
            this.io.emit('sensorUpdate', data);
        });

        // Écouter les alertes
        mqttService.on('alert', (alertData) => {
            databaseService.saveAlert(alertData.alert);
            this.io.emit('alert', alertData);
        });
        
        logger.info('✅ Service MQTT initialisé');
    }

    async setupRoutes() {
        // Route de santé
        this.app.get('/health', (req, res) => {
            res.json({
                status: 'healthy',
                timestamp: new Date().toISOString(),
                uptime: process.uptime()
            });
        });

        // Routes API
        this.app.use('/api', apiRoutes);
        this.app.use('/api/devices', deviceRoutes);
        
        // Route 404
        this.app.use('*', (req, res) => {
            res.status(404).json({ error: 'Route non trouvée' });
        });
        
        // Gestionnaire d'erreurs
        this.app.use(errorHandler);
        
        logger.info('✅ Routes configurées');
    }

    async setupSocketIO() {
        this.io.on('connection', (socket) => {
            logger.info(`🔌 Client connecté: ${socket.id}`);
            
            // Envoyer les données initiales
            socket.emit('initialData', {
                devices: deviceSimulator.getDeviceStates(),
                recentData: await databaseService.getRecentData(50)
            });
            
            // Gérer les commandes des actionneurs
            socket.on('actuatorCommand', (command) => {
                const success = deviceSimulator.controlActuator(
                    command.deviceId, 
                    command.actuator, 
                    command.state
                );
                
                socket.emit('commandResult', {
                    success,
                    command,
                    timestamp: new Date().toISOString()
                });
                
                logger.info(`🎛️ Commande WebSocket: ${JSON.stringify(command)}`);
            });

            // Gérer les demandes de données historiques
            socket.on('requestHistory', async (request) => {
                const history = await databaseService.getDeviceHistory(
                    request.deviceId, 
                    request.hours || 24
                );
                
                socket.emit('historyData', {
                    deviceId: request.deviceId,
                    data: history
                });
            });
            
            socket.on('disconnect', () => {
                logger.info(`🔌 Client déconnecté: ${socket.id}`);
            });
        });
        
        logger.info('✅ WebSocket configuré');
    }

    async startDeviceSimulation() {
        await deviceSimulator.initialize();
        deviceSimulator.startSimulation();
        logger.info('✅ Simulation des dispositifs démarrée');
    }

    async startServer() {
        this.server.listen(this.port, () => {
            logger.info(`🌐 Serveur IoT écoute sur http://localhost:${this.port}`);
            logger.info(`📊 Dashboard: http://localhost:3000`);
            logger.info(`🔧 API Health: http://localhost:${this.port}/health`);
            logger.info(`📡 API Status: http://localhost:${this.port}/api/status`);
        });

        // Gestion propre de l'arrêt
        process.on('SIGTERM', this.gracefulShutdown.bind(this));
        process.on('SIGINT', this.gracefulShutdown.bind(this));
    }

    async gracefulShutdown(signal) {
        logger.info(`📴 Arrêt gracieux du serveur (${signal})`);
        
        deviceSimulator.stopSimulation();
        mqttService.disconnect();
        
        this.server.close(() => {
            logger.info('✅ Serveur arrêté proprement');
            process.exit(0);
        });
    }
}

// Démarrage de l'application
const app = new IoTApplication();
app.initialize();

export default app;