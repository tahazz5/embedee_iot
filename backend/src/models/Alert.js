// ===========================
// backend/src/models/Alert.js
// ===========================
import { DataTypes } from 'sequelize';
import { getDatabase } from '../config/database.js';

export function defineAlertModel() {
    const sequelize = getDatabase();
    
    const Alert = sequelize.define('alerts', {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true
        },
        deviceId: {
            type: DataTypes.STRING,
            allowNull: false
        },
        type: {
            type: DataTypes.STRING,
            allowNull: false
        },
        severity: {
            type: DataTypes.ENUM('low', 'medium', 'high', 'critical'),
            defaultValue: 'medium'
        },
        message: {
            type: DataTypes.TEXT
        },
        acknowledged: {
            type: DataTypes.BOOLEAN,
            defaultValue: false
        },
        value: {
            type: DataTypes.FLOAT
        },
        timestamp: {
            type: DataTypes.DATE,
            defaultValue: DataTypes.NOW
        }
    });

    return Alert;
}
