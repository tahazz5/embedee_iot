// ===========================
// backend/src/models/index.js
// ===========================
import { defineDeviceModel } from './Device.js';
import { defineSensorDataModel } from './SensorData.js';
import { defineAlertModel } from './Alert.js';

let models = {};

export function initializeModels() {
    models.Device = defineDeviceModel();
    models.SensorData = defineSensorDataModel();
    models.Alert = defineAlertModel();

    // Définir les associations
    models.Device.hasMany(models.SensorData, { 
        foreignKey: 'deviceId',
        as: 'sensorData'
    });
    models.SensorData.belongsTo(models.Device, { 
        foreignKey: 'deviceId',
        as: 'device'
    });

    models.Device.hasMany(models.Alert, { 
        foreignKey: 'deviceId',
        as: 'alerts'
    });
    models.Alert.belongsTo(models.Device, { 
        foreignKey: 'deviceId',
        as: 'device'
    });

    return models;
}

export function getModels() {
    return models;
}

export default { initializeModels, getModels };