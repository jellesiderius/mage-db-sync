import { z } from 'zod';
import { ValidationError } from '../types/errors';
import { LoggerService } from './LoggerService';

/**
 * Validation schemas
 */
export const ValidationSchemas = {
    // SSH Configuration
    sshConfig: z.object({
        host: z.string().min(1, 'SSH host is required'),
        port: z.number().int().min(1).max(65535),
        username: z.string().min(1, 'SSH username is required'),
        password: z.string().optional(),
        privateKey: z.string().optional(),
        passphrase: z.string().optional()
    }).refine(
        data => data.password || data.privateKey,
        { message: 'Either password or privateKey must be provided' }
    ),

    // Database Configuration
    databaseConfig: z.object({
        username: z.string().min(1, 'Database username is required'),
        password: z.string().min(1, 'Database password is required'),
        server: z.string().min(1, 'Database server is required'),
        domainFolder: z.string().min(1),
        port: z.number().int().min(1).max(65535),
        localProjectFolder: z.string().optional(),
        externalProjectFolder: z.string().min(1),
        wordpress: z.boolean().optional(),
        externalPhpPath: z.string().optional(),
        localProjectUrl: z.string().url().optional(),
        commandsFolder: z.string().optional(),
        stagingUsername: z.string().optional(),
        externalElasticsearchPort: z.string().optional(),
        sshKeyName: z.string().optional(),
        sshKeyLocation: z.string().optional()
    }),

    // Settings Configuration
    settingsConfig: z.object({
        general: z.object({
            localDomainExtension: z.string().min(1, 'Local domain extension is required'),
            elasticsearchPort: z.string().min(1, 'Elasticsearch port is required'),
            databaseLocation: z.string().min(1, 'Database location is required')
        }),
        ssh: z.object({
            keyLocation: z.string(),
            passphrase: z.string().optional().default('')
        }),
        magentoBackend: z.object({
            adminUsername: z.string().min(1, 'Admin username is required'),
            adminPassword: z.string().min(8, 'Admin password must be at least 8 characters'),
            adminEmailAddress: z.string().email('Valid email address is required')
        })
    }),

    // File path validation
    filePath: z.string().min(1).refine(
        (path) => !path.includes('..'),
        { message: 'File path cannot contain ..' }
    ),

    // Port validation
    port: z.number().int().min(1).max(65535),

    // Email validation
    email: z.string().email(),

    // URL validation
    url: z.string().url(),

    // Database strip type
    stripType: z.enum([
        'development',
        'keep customer data',
        'full and human readable',
        'full',
        'staging'
    ]),

    // Database type
    databaseType: z.enum(['staging', 'production']),

    // Sync types
    syncTypes: z.array(z.enum([
        'Magento database',
        'WordPress database',
        'media',
        'pub/media',
        'var/import'
    ])).optional()
};

export class ValidationService {
    private static instance: ValidationService;
    private logger: LoggerService;

    private constructor() {
        this.logger = LoggerService.getInstance();
    }

    public static getInstance(): ValidationService {
        if (!ValidationService.instance) {
            ValidationService.instance = new ValidationService();
        }
        return ValidationService.instance;
    }

    /**
     * Validate data against a schema
     */
    public validate<T>(schema: z.ZodSchema<T>, data: unknown, context?: string): T {
        try {
            return schema.parse(data);
        } catch (error) {
            if (error instanceof z.ZodError) {
                const issues = error.issues.map(issue =>
                    `${issue.path.join('.')}: ${issue.message}`
                ).join(', ');

                const message = context
                    ? `Validation failed for ${context}: ${issues}`
                    : `Validation failed: ${issues}`;

                this.logger.error(message, error);
                throw new ValidationError(message);
            }
            throw error;
        }
    }

    /**
     * Validate SSH configuration
     */
    public validateSSHConfig(config: unknown): z.infer<typeof ValidationSchemas.sshConfig> {
        return this.validate(ValidationSchemas.sshConfig, config, 'SSH configuration');
    }

    /**
     * Validate database configuration
     */
    public validateDatabaseConfig(config: unknown): z.infer<typeof ValidationSchemas.databaseConfig> {
        return this.validate(ValidationSchemas.databaseConfig, config, 'Database configuration');
    }

    /**
     * Validate settings configuration
     */
    public validateSettingsConfig(config: unknown): any {
        // Use safeParse to handle optional passphrase
        const result = ValidationSchemas.settingsConfig.safeParse(config);
        if (!result.success) {
            const issues = result.error.issues.map(issue =>
                `${issue.path.join('.')}: ${issue.message}`
            ).join(', ');
            throw new ValidationError(`Settings configuration validation failed: ${issues}`);
        }
        return result.data;
    }

    /**
     * Validate file path
     */
    public validateFilePath(path: string): string {
        return this.validate(ValidationSchemas.filePath, path, 'File path');
    }

    /**
     * Validate port number
     */
    public validatePort(port: number): number {
        return this.validate(ValidationSchemas.port, port, 'Port number');
    }

    /**
     * Validate email address
     */
    public validateEmail(email: string): string {
        return this.validate(ValidationSchemas.email, email, 'Email address');
    }

    /**
     * Validate URL
     */
    public validateURL(url: string): string {
        return this.validate(ValidationSchemas.url, url, 'URL');
    }

    /**
     * Check if value is defined and not null
     */
    public isDefined<T>(value: T | null | undefined, fieldName: string): T {
        if (value === null || value === undefined) {
            throw new ValidationError(`${fieldName} is required but was not provided`);
        }
        return value;
    }

    /**
     * Validate array is not empty
     */
    public validateNotEmpty<T>(array: T[], fieldName: string): T[] {
        if (array.length === 0) {
            throw new ValidationError(`${fieldName} cannot be empty`);
        }
        return array;
    }

    /**
     * Safe parse - returns success/error object instead of throwing
     */
    public safeParse<T>(schema: z.ZodSchema<T>, data: unknown): {
        success: boolean;
        data?: T;
        error?: string
    } {
        try {
            const result = schema.parse(data);
            return { success: true, data: result };
        } catch (error) {
            if (error instanceof z.ZodError) {
                const issues = error.issues.map(issue =>
                    `${issue.path.join('.')}: ${issue.message}`
                ).join(', ');
                return { success: false, error: issues };
            }
            return { success: false, error: 'Unknown validation error' };
        }
    }
}
