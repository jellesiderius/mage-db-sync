/**
 * ConfigService - Centralized configuration management
 */

import fs from 'fs';
import path from 'path';
import { getInstalledPath } from 'get-installed-path';
import { SettingsConfig, StaticSettings, ProjectConfig, AppConfig, DatabaseConfig } from '../types';
import { ConfigurationError } from '../types/errors';
import { ConfigPathResolver } from '../utils/ConfigPathResolver';

export class ConfigService {
    private static instance: ConfigService;
    private npmPath: string = '';
    private settingsConfig!: SettingsConfig;
    private staticSettings!: StaticSettings;
    private projectConfig: ProjectConfig | null = null;

    private constructor() {}

    public static getInstance(): ConfigService {
        if (!ConfigService.instance) {
            ConfigService.instance = new ConfigService();
        }
        return ConfigService.instance;
    }

    /**
     * Initialize the config service
     */
    public async initialize(): Promise<void> {
        // Get npm installation path
        this.npmPath = await getInstalledPath('mage-db-sync');

        // Initialize config path resolver
        ConfigPathResolver.setPackageConfigDir(this.npmPath);
        ConfigPathResolver.ensureUserConfigDir();

        // Load all configuration files
        await this.loadConfigurations();
    }

    /**
     * Get npm installation path
     */
    public getNpmPath(): string {
        return this.npmPath;
    }

    /**
     * Get the active config location for a specific file
     */
    public getConfigLocation(relativePath: string): 'user' | 'package' | null {
        return ConfigPathResolver.getConfigLocation(relativePath);
    }

    /**
     * Get user config directory path
     */
    public getUserConfigDir(): string {
        return ConfigPathResolver.getUserConfigDir();
    }

    /**
     * Get package config directory path
     */
    public getPackageConfigDir(): string {
        return ConfigPathResolver.getPackageConfigDir();
    }

    /**
     * Get settings configuration
     */
    public getSettingsConfig(): SettingsConfig {
        return this.settingsConfig;
    }

    /**
     * Get static settings
     */
    public getStaticSettings(): StaticSettings {
        return this.staticSettings;
    }

    /**
     * Get project-specific configuration
     */
    public getProjectConfig(): ProjectConfig | null {
        return this.projectConfig;
    }

    /**
     * Load database configuration
     */
    public loadDatabaseConfig(type: 'staging' | 'production', databaseKey: string): DatabaseConfig {
        const relativePath = `databases/${type}.json`;
        const filePath = ConfigPathResolver.resolveConfigPathOrThrow(relativePath);
        
        try {
            const config = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
            const database = config.databases[databaseKey];
            
            if (!database) {
                throw new ConfigurationError(`Database '${databaseKey}' not found in ${type} config`);
            }

            return database;
        } catch (error) {
            if (error instanceof ConfigurationError) {
                throw error;
            }
            throw new ConfigurationError(`Failed to load database config: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    /**
     * Build complete app configuration
     */
    public buildAppConfig(): AppConfig {
        const currentFolder = process.cwd();
        const currentFolderName = path.basename(currentFolder);

        return {
            customConfig: {
                sshKeyLocation: this.settingsConfig.ssh.keyLocation,
                sshPassphrase: this.settingsConfig.ssh.passphrase,
                localDatabaseFolderLocation: this.settingsConfig.general.databaseLocation,
                localDomainExtension: this.settingsConfig.general.localDomainExtension
            },
            requirements: {
                magerun2Version: '7.4.0'
            },
            serverVariables: {
                magentoVersion: 2,
                externalPhpPath: '',
                magentoRoot: '',
                magerunFile: '',
                databaseName: '',
                secondDatabaseMagerun2: 'magerun2',
                secondDatabaseExternalPhpPath: ''
            },
            settings: {
                currentFolder,
                currentFolderName,
                strip: '',
                syncImages: '',
                magentoLocalhostDomainName: '',
                rsyncInstalled: false,
                elasticSearchUsed: false,
                isDdevProject: false,
                isDdevActive: false,
                import: '',
                wordpressImport: '',
                wordpressDownload: '',
                currentFolderIsMagento: false,
                currentFolderhasWordpress: false,
                runCommands: false,
                magerun2Command: '',
                magerun2CommandLocal: '',
                wpCommandLocal: '',
                databaseCommand: '',
                syncImageTypes: null,
                syncTypes: null
            },
            finalMessages: {
                magentoDatabaseLocation: '',
                magentoDatabaseIncludeLocation: '',
                wordpressDatabaseLocation: '',
                importDomain: '',
                domains: [],
                wordpressBlogUrls: []
            },
            databases: {
                databasesList: null,
                databaseType: null,
                databaseData: null
            },
            wordpressConfig: {
                prefix: '',
                username: '',
                password: '',
                host: '',
                database: ''
            }
        };
    }

    /**
     * Load all configuration files
     */
    private async loadConfigurations(): Promise<void> {
        // Load settings.json with fallback
        const settingsPath = ConfigPathResolver.resolveConfigPathOrThrow('settings.json');
        this.settingsConfig = JSON.parse(fs.readFileSync(settingsPath, 'utf-8'));

        // Load static-settings.json (always from package, no user override needed)
        const staticSettingsPath = path.join(this.npmPath, 'config/static-settings.json');
        if (!fs.existsSync(staticSettingsPath)) {
            throw new ConfigurationError(`Static settings file not found: ${staticSettingsPath}`);
        }
        this.staticSettings = JSON.parse(fs.readFileSync(staticSettingsPath, 'utf-8'));

        // Try to load project-specific config
        const projectConfigPath = path.join(process.cwd(), '.mage-db-sync-config.json');
        if (fs.existsSync(projectConfigPath)) {
            this.projectConfig = JSON.parse(fs.readFileSync(projectConfigPath, 'utf-8'));
        }
    }
}
