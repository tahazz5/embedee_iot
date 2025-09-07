import { Sequelize } from 'sequelize';
import { logger } from './logger.js';

let sequelize = null;

const dbConfig = {
    dialect: 'postgres',
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'iot_data',
    username: process.env.DB_USER || 'iot_user',
    password: process.env.DB_PASSWORD || 'iot_password',
    logging: process.env.NODE_ENV === 'development' ? 
        (msg) => logger.debug(`[SQL] ${msg}`) : false,
    pool: {
        max: 10,
        min: 0,
        acquire: 30000,
        idle: 10000
    },
    define: {
        freezeTableName: true,
        timestamps: true,
        underscored: true
    }
};

export async function connectDatabase() {
    try {
        sequelize = new Sequelize(dbConfig);
        
        await sequelize.authenticate();
        logger.info('✅ Connexion à PostgreSQL établie');
        
        if (process.env.NODE_ENV === 'development') {
            await sequelize.sync({ alter: true });
            logger.info('✅ Modèles synchronisés avec la base de données');
        }
        
        return sequelize;
    } catch (error) {
        logger.error('❌ Impossible de se connecter à la base de données:', error);
        throw error;
    }
}

export function getDatabase() {
    if (!sequelize) {
        throw new Error('Base de données non initialisée. Appelez connectDatabase() d\'abord.');
    }
    return sequelize;
}

export default { connectDatabase, getDatabase };