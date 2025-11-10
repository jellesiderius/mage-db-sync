/**
 * LoggerService - Structured logging with Winston
 * 
 * Features:
 * - Multiple log levels (debug, info, warn, error)
 * - Colorized console output
 * - File logging with rotation
 * - Context tracking
 * - Performance timing
 */

import winston from 'winston';
import path from 'path';
import fs from 'fs';
import os from 'os';

export enum LogLevel {
    _DEBUG = 'debug',
    _INFO = 'info',
    _WARN = 'warn',
    _ERROR = 'error'
}

export interface LogContext {
    operation?: string;
    component?: string;
    duration?: number;
    [key: string]: unknown;
}

export class LoggerService {
    private static instance: LoggerService;
    private logger: winston.Logger;
    private readonly logDir: string;

    private constructor() {
        // Create logs directory in user's home
        this.logDir = path.join(os.homedir(), '.mage-db-sync', 'logs');
        if (!fs.existsSync(this.logDir)) {
            fs.mkdirSync(this.logDir, { recursive: true });
        }

        // Configure Winston
        this.logger = winston.createLogger({
            level: process.env.LOG_LEVEL || 'info',
            format: winston.format.combine(
                winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
                winston.format.errors({ stack: true }),
                winston.format.json()
            ),
            transports: [
                // File transport for all logs
                new winston.transports.File({
                    filename: path.join(this.logDir, 'mage-db-sync.log'),
                    maxsize: 5242880, // 5MB
                    maxFiles: 5
                }),
                // Separate file for errors
                new winston.transports.File({
                    filename: path.join(this.logDir, 'error.log'),
                    level: 'error',
                    maxsize: 5242880,
                    maxFiles: 5
                })
            ]
        });

        // Add console transport in development
        if (process.env.DEBUG === 'true') {
            this.logger.add(
                new winston.transports.Console({
                    format: winston.format.combine(
                        winston.format.colorize(),
                        winston.format.simple()
                    )
                })
            );
        }
    }

    public static getInstance(): LoggerService {
        if (!LoggerService.instance) {
            LoggerService.instance = new LoggerService();
        }
        return LoggerService.instance;
    }

    /**
     * Log debug message
     */
    public debug(message: string, context?: LogContext): void {
        this.logger.debug(message, this.formatContext(context));
    }

    /**
     * Log info message
     */
    public info(message: string, context?: LogContext): void {
        this.logger.info(message, this.formatContext(context));
    }

    /**
     * Log warning message
     */
    public warn(message: string, context?: LogContext): void {
        this.logger.warn(message, this.formatContext(context));
    }

    /**
     * Log error message
     */
    public error(message: string, error?: Error, context?: LogContext): void {
        const errorContext = {
            ...this.formatContext(context),
            error: error ? {
                message: error.message,
                stack: error.stack,
                name: error.name
            } : undefined
        };
        this.logger.error(message, errorContext);
    }

    /**
     * Start timing an operation
     */
    public startTimer(operation: string): () => void {
        const start = Date.now();
        return () => {
            const duration = Date.now() - start;
            this.info(`Operation completed: ${operation}`, { operation, duration });
        };
    }

    /**
     * Get log directory path
     */
    public getLogDir(): string {
        return this.logDir;
    }

    /**
     * Get latest log file content
     */
    public getLatestLog(lines: number = 100): string {
        const logFile = path.join(this.logDir, 'mage-db-sync.log');
        if (!fs.existsSync(logFile)) {
            return 'No logs available';
        }

        const content = fs.readFileSync(logFile, 'utf-8');
        const logLines = content.split('\n');
        return logLines.slice(-lines).join('\n');
    }

    /**
     * Clear all logs
     */
    public clearLogs(): void {
        const files = fs.readdirSync(this.logDir);
        files.forEach(file => {
            fs.unlinkSync(path.join(this.logDir, file));
        });
        this.info('Logs cleared');
    }

    /**
     * Format context for logging
     */
    private formatContext(context?: LogContext): Record<string, unknown> {
        if (!context) return {};
        
        return {
            ...context,
            pid: process.pid,
            timestamp: new Date().toISOString()
        };
    }
}
