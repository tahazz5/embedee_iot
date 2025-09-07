// ===========================
// backend/src/services/deviceSimulator.js
// ===========================
import { mqttService } from './mqttService.js';
import { logger } from '../config/logger.js';

class DeviceSimulator {
    constructor() {
        this.devices = new Map();
        this.simulationInterval = null;
        this.isRunning = false;
        this.simulationSpeed = 2000; // ms
    }

    async initialize() {
        this.addDevice({
            id: 'ESP32_001',
            type: 'environmental_sensor',
            location: 'Salon',
            sensors: ['temperature', 'humidity', 'pressure'],
            actuators: ['ventilateur', 'chauffage']
        });

        this.addDevice({
            id: 'ESP32_002', 
            type: 'security_sensor',
            location: 'Entrée',
            sensors: ['motion', 'door', 'light'],
            actuators: ['alarm', 'led']
        });

        this.addDevice({
            id: 'RASPBERRY_001',
            type: 'gateway',
            location: 'Bureau',
            sensors: ['cpu_temp', 'memory', 'network'],
            actuators: ['wifi', 'bluetooth']
        });

        logger.info(`🔧 ${this.devices.size} dispositifs virtuels initialisés`);
    }

    addDevice(config) {
        const device = {
            ...config,
            status: 'online',
            lastSeen: new Date(),
            sensorData: {},
            actuatorStates: {},
            simulationParams: this.getSimulationParams(config.type)
        };

        config.sensors?.forEach(sensor => {
            device.sensorData[sensor] = this.getInitialSensorValue(sensor);
        });

        config.actuators?.forEach(actuator => {
            device.actuatorStates[actuator] = false;
        });

        this.devices.set(config.id, device);
    }

    getSimulationParams(deviceType) {
        const params = {
            environmental_sensor: {
                temperature: { min: 18, max: 26, variance: 0.5, trend: 0 },
                humidity: { min: 40, max: 70, variance: 2, trend: 0 },
                pressure: { min: 1000, max: 1030, variance: 0.1, trend: 0 }
            },
            security_sensor: {
                motion: { probability: 0.05 },
                door: { probability: 0.02 },
                light: { min: 0, max: 1000, variance: 50 }
            },
            gateway: {
                cpu_temp: { min: 40, max: 70, variance: 2 },
                memory: { min: 20, max: 90, variance: 5 },
                network: { min: 1, max: 100, variance: 10 }
            }
        };

        return params[deviceType] || {};
    }

    getInitialSensorValue(sensorType) {
        const initialValues = {
            temperature: 22,
            humidity: 55,
            pressure: 1013.25,
            motion: false,
            door: false,
            light: 500,
            cpu_temp: 45,
            memory: 50,
            network: 85
        };

        return initialValues[sensorType] || 0;
    }

    startSimulation() {
        if (this.isRunning) return;

        this.isRunning = true;
        this.simulationInterval = setInterval(() => {
            this.updateAllDevices();
        }, this.simulationSpeed);

        logger.info('🎮 Simulation des dispositifs démarrée');
    }

    stopSimulation() {
        if (this.simulationInterval) {
            clearInterval(this.simulationInterval);
            this.simulationInterval = null;
        }
        this.isRunning = false;
        logger.info('⏹️ Simulation des dispositifs arrêtée');
    }

    updateAllDevices() {
        for (const [deviceId, device] of this.devices) {
            this.updateDevice(deviceId, device);
            this.publishDeviceData(deviceId, device);
        }
    }

    updateDevice(deviceId, device) {
        const params = device.simulationParams;

        for (const sensor of device.sensors) {
            if (params[sensor]) {
                device.sensorData[sensor] = this.simulateSensorValue(
                    sensor, 
                    device.sensorData[sensor], 
                    params[sensor]
                );
            }
        }

        this.simulateRandomEvents(device);
        device.lastSeen = new Date();
    }

    simulateSensorValue(sensorType, currentValue, params) {
        if (sensorType === 'motion' || sensorType === 'door') {
            return Math.random() < params.probability;
        }

        const { min, max, variance, trend = 0 } = params;
        let newValue = currentValue;

        newValue += trend + (Math.random() - 0.5) * variance * 2;
        newValue = Math.max(min, Math.min(max, newValue));

        const precision = {
            temperature: 1,
            humidity: 0,
            pressure: 2,
            light: 0,
            cpu_temp: 1,
            memory: 0,
            network: 0
        };

        return Math.round(newValue * Math.pow(10, precision[sensorType] || 0)) / 
               Math.pow(10, precision[sensorType] || 0);
    }

    simulateRandomEvents(device) {
        if (Math.random() < 0.001) {
            device.status = 'offline';
            setTimeout(() => {
                device.status = 'online';
            }, 30000);
        }

        if (device.type === 'environmental_sensor') {
            if (device.sensorData.temperature > 25) {
                this.triggerAlert(device.id, 'temperature_high', device.sensorData.temperature);
            }
            if (device.sensorData.humidity > 65) {
                this.triggerAlert(device.id, 'humidity_high', device.sensorData.humidity);
            }
        }
    }

    triggerAlert(deviceId, alertType, value) {
        const alert = {
            deviceId,
            type: alertType,
            value,
            severity: this.getAlertSeverity(alertType, value),
            timestamp: new Date().toISOString(),
            message: `Alerte ${alertType}: ${value}`
        };

        mqttService.publishAlert(deviceId, alert);
        logger.warn(`🚨 Alerte déclenchée: ${alertType} sur ${deviceId}`);
    }

    getAlertSeverity(alertType, value) {
        const severityRules = {
            temperature_high: value > 30 ? 'critical' : value > 27 ? 'high' : 'medium',
            humidity_high: value > 80 ? 'critical' : value > 70 ? 'high' : 'medium'
        };

        return severityRules[alertType] || 'medium';
    }

    publishDeviceData(deviceId, device) {
        if (device.status !== 'online') return;

        const payload = {
            device_id: deviceId,
            type: device.type,
            location: device.location,
            timestamp: device.lastSeen.toISOString(),
            sensors: device.sensorData,
            actuators: device.actuatorStates,
            status: device.status,
            metadata: {
                uptime: Date.now() - device.lastSeen.getTime() + Math.random() * 86400000,
                signal_strength: -30 - Math.random() * 40,
                battery_level: device.type.includes('ESP32') ? 
                    Math.max(0, 100 - Math.random() * 2) : null
            }
        };

        mqttService.publishSensorData(deviceId, payload);
    }

    getDeviceStates() {
        const states = {};
        for (const [deviceId, device] of this.devices) {
            states[deviceId] = {
                id: deviceId,
                type: device.type,
                location: device.location,
                status: device.status,
                lastSeen: device.lastSeen,
                sensors: device.sensorData,
                actuators: device.actuatorStates
            };
        }
        return states;
    }

    getDevice(deviceId) {
        return this.devices.get(deviceId);
    }

    controlActuator(deviceId, actuator, state) {
        const device = this.devices.get(deviceId);
        if (device && device.actuators.includes(actuator)) {
            device.actuatorStates[actuator] = state;
            
            mqttService.publishCommand({
                deviceId,
                action: actuator,
                value: state,
                requestId: `cmd_${Date.now()}`
            });

            return true;
        }
        return false;
    }
}

export const deviceSimulator = new DeviceSimulator();