// ===========================
// backend/src/models/SensorData.js
// ===========================
import { DataTypes } from 'sequelize';
import { getDatabase } from '../config/database.js';

export function defineSensorDataModel() {
    const sequelize = getDatabase();
    
    const SensorData = sequelize.define('sensor_data', {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true
        },
        deviceId: {
            type: DataTypes.STRING,
            allowNull: false
        },
        sensorType: {
            type: DataTypes.STRING,
            allowNull: false
        },
        value: {
            type: DataTypes.FLOAT,
            allowNull: false
        },
        unit: {
            type: DataTypes.STRING,
            defaultValue: ''
        },
        quality: {
            type: DataTypes.INTEGER,
            defaultValue: 100
        },
        timestamp: {
            type: DataTypes.DATE,
            defaultValue: DataTypes.NOW
        }
    });

    return SensorData;
}
