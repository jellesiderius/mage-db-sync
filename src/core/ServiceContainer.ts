/**
 * ServiceContainer - Dependency Injection Container
 * 
 * Features:
 * - Singleton service management
 * - Lazy initialization
 * - Type-safe service resolution
 * - Lifecycle management
 */

import { ConfigService } from '../services/ConfigService';
import { LoggerService } from '../services/LoggerService';
import { ValidationService } from '../services/ValidationService';
import { CacheService } from '../services/CacheService';
import { RetryService } from '../services/RetryService';
import { SSHService } from '../services/SSHService';
import { DatabaseService } from '../services/DatabaseService';
import { CommandService } from '../services/CommandService';
import { FileSystemService } from '../services/FileSystemService';
import { VersionCheckService } from '../services/VersionCheckService';

/**
 * Service container for dependency injection
 */
export class ServiceContainer {
    private static instance: ServiceContainer;
    private services: Map<string, unknown>;
    private initialized: boolean = false;

    private constructor() {
        this.services = new Map();
    }

    public static getInstance(): ServiceContainer {
        if (!ServiceContainer.instance) {
            ServiceContainer.instance = new ServiceContainer();
        }
        return ServiceContainer.instance;
    }

    /**
     * Initialize all core services
     */
    public async initialize(): Promise<void> {
        if (this.initialized) {
            return;
        }

        const logger = LoggerService.getInstance();
        logger.info('Initializing ServiceContainer...');

        // Initialize core services in correct order
        this.services.set('logger', logger);
        this.services.set('validation', ValidationService.getInstance());
        this.services.set('cache', CacheService.getInstance());
        this.services.set('retry', RetryService.getInstance());

        // Initialize config service
        const configService = ConfigService.getInstance();
        await configService.initialize();
        this.services.set('config', configService);

        // Initialize remaining services
        this.services.set('ssh', SSHService.getInstance());
        this.services.set('database', DatabaseService.getInstance());
        this.services.set('command', CommandService.getInstance());
        this.services.set('filesystem', FileSystemService.getInstance());
        this.services.set('versionCheck', VersionCheckService.getInstance());

        this.initialized = true;
        logger.info('ServiceContainer initialized successfully');
    }

    /**
     * Get service by name
     */
    private getService<T>(name: string): T {
        const service = this.services.get(name);

        if (!service) {
            throw new Error(`Service ${name} not found in container. Did you call initialize()?`);
        }

        return service as T;
    }

    /**
     * Get logger service
     */
    public getLogger(): LoggerService {
        return this.getService<LoggerService>('logger');
    }

    /**
     * Get config service
     */
    public getConfig(): ConfigService {
        return this.getService<ConfigService>('config');
    }

    /**
     * Get validation service
     */
    public getValidation(): ValidationService {
        return this.getService<ValidationService>('validation');
    }

    /**
     * Get cache service
     */
    public getCache(): CacheService {
        return this.getService<CacheService>('cache');
    }

    /**
     * Get retry service
     */
    public getRetry(): RetryService {
        return this.getService<RetryService>('retry');
    }

    /**
     * Get SSH service
     */
    public getSSH(): SSHService {
        return this.getService<SSHService>('ssh');
    }

    /**
     * Get database service
     */
    public getDatabase(): DatabaseService {
        return this.getService<DatabaseService>('database');
    }

    /**
     * Get command service
     */
    public getCommand(): CommandService {
        return this.getService<CommandService>('command');
    }

    /**
     * Get filesystem service
     */
    public getFileSystem(): FileSystemService {
        return this.getService<FileSystemService>('filesystem');
    }

    /**
     * Get version check service
     */
    public getVersionCheck(): VersionCheckService {
        return this.getService<VersionCheckService>('versionCheck');
    }

    /**
     * Cleanup all services (for shutdown)
     */
    public async cleanup(): Promise<void> {
        const logger = this.getLogger();
        logger.info('Cleaning up ServiceContainer...');

        // Close SSH connections
        const ssh = this.getSSH();
        await ssh.closeAll();

        // Stop cache cleanup
        const cache = this.getCache();
        cache.stopCleanup();

        this.services.clear();
        this.initialized = false;

        logger.info('ServiceContainer cleaned up');
    }

    /**
     * Map service class name to service key
     */
    private getServiceKey(className: string): string {
        const mapping: Record<string, string> = {
            'LoggerService': 'logger',
            'ValidationService': 'validation',
            'CacheService': 'cache',
            'RetryService': 'retry',
            'ConfigService': 'config',
            'SSHService': 'ssh',
            'DatabaseService': 'database',
            'CommandService': 'command',
            'FileSystemService': 'filesystem',
            'VersionCheckService': 'versionCheck'
        };

        return mapping[className] || className.toLowerCase();
    }

    /**
     * Check if container is initialized
     */
    public isInitialized(): boolean {
        return this.initialized;
    }

    /**
     * Reset container (for testing)
     */
    public reset(): void {
        this.services.clear();
        this.initialized = false;
    }
}
