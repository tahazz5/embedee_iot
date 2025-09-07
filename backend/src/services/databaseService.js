// ===========================
// backend/src/services/databaseService.js
// ===========================
import { getModels } from '../models/index.js';
import { logger } from '../config/logger.js';
import { Sequelize } from 'sequelize';

class DatabaseService {
    constructor() {
        this.models = null;
    }

    initialize() {
        this.models = getModels();
        logger.info('✅ Service de base de données initialisé');
    }

    async saveSensorData(mqttData) {
        try {
            await this.models.Device.upsert({
                id: mqttData.deviceId,
                type: mqttData.data.type || 'unknown',
                location: mqttData.data.location || 'unknown',
                status: 'online',
                sensors: Object.keys(mqttData.data.sensors || {}),
                actuators: Object.keys(mqttData.data.actuators || {}),
                metadata: mqttData.data.metadata || {},
                lastSeen: new Date(mqttData.timestamp)
            });

            if (mqttData.data.sensors) {
                const sensorPromises = Object.entries(mqttData.data.sensors).map(
                    ([sensorType, value]) => {
                        return this.models.SensorData.create({
                            deviceId: mqttData.deviceId,
                            sensorType,
                            value: parseFloat(value) || 0,
                            unit: this.getSensorUnit(sensorType),
                            quality: mqttData.data.metadata?.signal_strength ? 
                                Math.max(0, 100 + mqttData.data.metadata.signal_strength) : 100,
                            timestamp: new Date(mqttData.timestamp)
                        });
                    }
                );

                await Promise.all(sensorPromises);
            }

            logger.debug(`💾 Données sauvegardées pour ${mqttData.deviceId}`);
        } catch (error) {
            logger.error('Erreur sauvegarde données:', error);
        }
    }

    getSensorUnit(sensorType) {
        const units = {
            temperature: '°C',
            humidity: '%',
            pressure: 'hPa',
            light: 'lux',
            motion: 'bool',
            door: 'bool',
            cpu_temp: '°C',
            memory: '%',
            network: '%'
        };
        return units[sensorType] || '';
    }

    async getRecentData(limit = 100) {
        try {
            const data = await this.models.SensorData.findAll({
                limit,
                order: [['timestamp', 'DESC']],
                include: [{
                    model: this.models.Device,
                    as: 'device'
                }]
            });

            return data.map(record => ({
                id: record.id,
                deviceId: record.deviceId,
                deviceType: record.device?.type,
                location: record.device?.location,
                sensorType: record.sensorType,
                value: record.value,
                unit: record.unit,
                quality: record.quality,
                timestamp: record.timestamp
            }));
        } catch (error) {
            logger.error('Erreur récupération données:', error);
            return [];
        }
    }

    async getDeviceHistory(deviceId, hours = 24) {
        const since = new Date(Date.now() - hours * 60 * 60 * 1000);
        
        try {
            const data = await this.models.SensorData.findAll({
                where: {
                    deviceId,
                    timestamp: {
                        [Sequelize.Op.gte]: since
                    }
                },
                order: [['timestamp', 'ASC']]
            });

            return data;
        } catch (error) {
            logger.error('Erreur historique dispositif:', error);
            return [];
        }
    }

    async getStatistics(deviceId, sensorType, period = '24h') {
        const hours = period === '24h' ? 24 : period === '7d' ? 168 : 1;
        const since = new Date(Date.now() - hours * 60 * 60 * 1000);

        try {
            const stats = await this.models.SensorData.findAll({
                where: {
                    deviceId,
                    sensorType,
                    timestamp: {
                        [Sequelize.Op.gte]: since
                    }
                },
                attributes: [
                    [Sequelize.fn('AVG', Sequelize.col('value')), 'average'],
                    [Sequelize.fn('MIN', Sequelize.col('value')), 'minimum'],
                    [Sequelize.fn('MAX', Sequelize.col('value')), 'maximum'],
                    [Sequelize.fn('COUNT', Sequelize.col('value')), 'count']
                ]
            });

            return stats[0] || { average: 0, minimum: 0, maximum: 0, count: 0 };
        } catch (error) {
            logger.error('Erreur calcul statistiques:', error);
            return { average: 0, minimum: 0, maximum: 0, count: 0 };
        }
    }

    async saveAlert(alertData) {
        try {
            await this.models.Alert.create({
                deviceId: alertData.deviceId,
                type: alertData.type,
                severity: alertData.severity,
                message: alertData.message || `Alerte ${alertData.type}`,
                value: alertData.value,
                timestamp: new Date(alertData.timestamp)
            });

            logger.info(`🚨 Alerte sauvegardée: ${alertData.type} sur ${alertData.deviceId}`);
        } catch (error) {
            logger.error('Erreur sauvegarde alerte:', error);
        }
    }

    async getActiveAlerts() {
        try {
            return await this.models.Alert.findAll({
                where: {
                    acknowledged: false
                },
                order: [['timestamp', 'DESC']]
            });
        } catch (error) {
            logger.error('Erreur récupération alertes:', error);
            return [];
        }
    }

    async acknowledgeAlert(alertId) {
        try {
            await this.models.Alert.update(
                { acknowledged: true },
                { where: { id: alertId } }
            );
            return true;
        } catch (error) {
            logger.error('Erreur acquittement alerte:', error);
            return false;
        }
    }
}

export const databaseService = new DatabaseService();