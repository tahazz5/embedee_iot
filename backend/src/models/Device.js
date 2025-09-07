import { DataTypes } from 'sequelize';
import { getDatabase } from '../config/database.js';

export function defineDeviceModel() {
    const sequelize = getDatabase();
    
    const Device = sequelize.define('devices', {
        id: {
            type: DataTypes.STRING,
            primaryKey: true
        },
        type: {
            type: DataTypes.STRING,
            allowNull: false
        },
        location: {
            type: DataTypes.STRING,
            allowNull: false
        },
        status: {
            type: DataTypes.ENUM('online', 'offline', 'maintenance'),
            defaultValue: 'offline'
        },
        sensors: {
            type: DataTypes.JSON,
            defaultValue: []
        },
        actuators: {
            type: DataTypes.JSON,
            defaultValue: []
        },
        metadata: {
            type: DataTypes.JSON,
            defaultValue: {}
        },
        lastSeen: {
            type: DataTypes.DATE,
            defaultValue: DataTypes.NOW
        }
    });

    return Device;
}



