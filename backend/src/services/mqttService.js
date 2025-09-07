// backend/src/services/mqttService.js
// ===========================
import mqtt from 'mqtt';
import { EventEmitter } from 'events';
import { logger } from '../config/logger.js';

class MQTTService extends EventEmitter {
    constructor() {
        super();
        this.client = null;
        this.topics = {
            SENSOR_DATA: 'sensors/+/data',
            ACTUATOR_COMMAND: 'actuators/+/command',
            DEVICE_STATUS: 'devices/+/status',
            SYSTEM_HEALTH: 'system/health',
            ALERTS: 'alerts/+'
        };
        this.isConnected = false;
    }

    async initialize() {
        const options = {
            host: process.env.MQTT_HOST || 'localhost',
            port: process.env.MQTT_PORT || 1883,
            username: process.env.MQTT_USERNAME,
            password: process.env.MQTT_PASSWORD,
            clientId: `iot_server_${Math.random().toString(16).substr(2, 8)}`,
            clean: true,
            reconnectPeriod: 5000,
            keepalive: 60
        };

        this.client = mqtt.connect(options);

        this.client.on('connect', () => {
            logger.info('✅ Connecté au broker MQTT');
            this.isConnected = true;
            this.subscribeToTopics();
            this.emit('connected');
        });

        this.client.on('message', (topic, message) => {
            this.handleMessage(topic, message);
        });

        this.client.on('error', (error) => {
            logger.error('❌ Erreur MQTT:', error);
            this.isConnected = false;
        });

        this.client.on('offline', () => {
            logger.warn('⚠️ MQTT hors ligne');
            this.isConnected = false;
        });

        this.client.on('reconnect', () => {
            logger.info('🔄 Reconnexion MQTT...');
        });
    }

    subscribeToTopics() {
        Object.values(this.topics).forEach(topic => {
            this.client.subscribe(topic, (err) => {
                if (err) {
                    logger.error(`Erreur souscription ${topic}:`, err);
                } else {
                    logger.info(`📡 Souscrit à ${topic}`);
                }
            });
        });
    }

    handleMessage(topic, message) {
        try {
            const data = JSON.parse(message.toString());
            const topicParts = topic.split('/');

            switch (topicParts[0]) {
                case 'sensors':
                    this.emit('sensorData', {
                        deviceId: topicParts[1],
                        type: 'sensor',
                        data: data,
                        timestamp: new Date(),
                        topic: topic
                    });
                    break;

                case 'actuators':
                    this.emit('actuatorResponse', {
                        deviceId: topicParts[1],
                        type: 'actuator',
                        data: data,
                        timestamp: new Date()
                    });
                    break;

                case 'devices':
                    this.emit('deviceStatus', {
                        deviceId: topicParts[1],
                        status: data,
                        timestamp: new Date()
                    });
                    break;

                case 'alerts':
                    this.emit('alert', {
                        deviceId: topicParts[1],
                        alert: data,
                        timestamp: new Date()
                    });
                    break;

                case 'system':
                    this.emit('systemHealth', data);
                    break;
            }
        } catch (error) {
            logger.error('Erreur parsing message MQTT:', error);
        }
    }

    publishCommand(command) {
        if (!this.isConnected) {
            logger.error('MQTT non connecté, impossible d\'envoyer la commande');
            return false;
        }

        const topic = `actuators/${command.deviceId}/command`;
        const message = JSON.stringify({
            command: command.action,
            value: command.value,
            timestamp: new Date().toISOString(),
            requestId: command.requestId
        });

        this.client.publish(topic, message, { qos: 1 }, (err) => {
            if (err) {
                logger.error('Erreur publication commande:', err);
            } else {
                logger.info(`📤 Commande envoyée: ${topic}`);
            }
        });

        return true;
    }

    publishSensorData(deviceId, sensorData) {
        if (!this.isConnected) return false;

        const topic = `sensors/${deviceId}/data`;
        const message = JSON.stringify({
            ...sensorData,
            timestamp: new Date().toISOString()
        });

        this.client.publish(topic, message, { qos: 0 });
        return true;
    }

    publishAlert(deviceId, alertData) {
        if (!this.isConnected) return false;

        const topic = `alerts/${deviceId}`;
        const message = JSON.stringify({
            ...alertData,
            timestamp: new Date().toISOString()
        });

        this.client.publish(topic, message, { qos: 1 });
        return true;
    }

    disconnect() {
        if (this.client) {
            this.client.end();
            this.isConnected = false;
            logger.info('🔌 MQTT déconnecté');
        }
    }
}

export const mqttService = new MQTTService();



