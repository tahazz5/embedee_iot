import winston from 'winston';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const logFormat = winston.format.combine(
    winston.format.timestamp({
        format: 'YYYY-MM-DD HH:mm:ss'
    }),
    winston.format.errors({ stack: true }),
    winston.format.colorize({
        all: process.env.NODE_ENV === 'development'
    }),
    winston.format.printf(({ timestamp, level, message, stack }) => {
        return `${timestamp} [${level}]: ${stack || message}`;
    })
);

const transports = [
    new winston.transports.Console({
        level: process.env.LOG_LEVEL || 'info'
    })
];

if (process.env.NODE_ENV === 'production') {
    transports.push(
        new winston.transports.File({
            filename: path.join(__dirname, '../../logs/error.log'),
            level: 'error'
        }),
        new winston.transports.File({
            filename: path.join(__dirname, '../../logs/combined.log'),
            level: 'info'
        })
    );
}

export const logger = winston.createLogger({
    format: logFormat,
    transports,
    exceptionHandlers: [
        new winston.transports.Console(),
        ...(process.env.NODE_ENV === 'production' ? [
            new winston.transports.File({
                filename: path.join(__dirname, '../../logs/exceptions.log')
            })
        ] : [])
    ],
    rejectionHandlers: [
        new winston.transports.Console(),
        ...(process.env.NODE_ENV === 'production' ? [
            new winston.transports.File({
                filename: path.join(__dirname, '../../logs/rejections.log')
            })
        ] : [])
    ]
});

logger.defaultMeta = {
    service: 'iot-simulator',
    version: process.env.npm_package_version || '1.0.0'
};

export default logger;