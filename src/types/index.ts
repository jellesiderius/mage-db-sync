/**
 * Core type definitions for mage-db-sync v2
 */

export interface DatabaseConfig {
    username: string;
    password: string;
    server: string;
    domainFolder: string;
    port: number;
    localProjectFolder?: string;
    externalProjectFolder: string;
    wordpress?: boolean;
    externalPhpPath?: string;
    localProjectUrl?: string;
    commandsFolder?: string;
    stagingUsername?: string;
    externalElasticsearchPort?: string;
    sshKeyName?: string;
    sshKeyLocation?: string;
}

export interface DatabaseListItem {
    key: string;
    domainFolder: string;
    username: string;
    displayName: string;
}

export interface SettingsConfig {
    general: {
        localDomainExtension: string;
        elasticsearchPort: string;
        databaseLocation: string;
    };
    ssh: {
        keyLocation: string;
        passphrase: string;
    };
    magentoBackend: {
        adminUsername: string;
        adminPassword: string;
        adminEmailAddress: string;
    };
}

export interface StaticSettings {
    settings: {
        databaseStripDevelopment: string;
        databaseStripKeepCustomerData: string;
        databaseStripStaging: string;
        databaseIncludeStaging: string;
    };
}

export interface ProjectConfig {
    core_config_data?: Record<string, Record<string, string | number>>;
    databaseStripDevelopment?: string;
    databaseStripFull?: string;
    wordpress_domains?: Record<string, string>;  // blog_id -> local domain
}

export interface AppConfig {
    customConfig: {
        sshKeyLocation: string;
        sshPassphrase: string;
        localDatabaseFolderLocation: string;
        localDomainExtension: string;
    };
    requirements: {
        magerun2Version: string;
    };
    serverVariables: {
        magentoVersion: number;
        externalPhpPath: string;
        magentoRoot: string;
        magerunFile: string;
        databaseName: string;
        secondDatabaseMagerun2: string;
        secondDatabaseExternalPhpPath: string;
        wordpress?: boolean;
    };
    settings: {
        currentFolder: string;
        currentFolderName: string;
        strip: string;
        syncImages: string;
        magentoLocalhostDomainName: string;
        rsyncInstalled: boolean;
        elasticSearchUsed: boolean;
        searchEngine?: string; // Detected search engine: 'opensearch', 'elasticsearch7', 'elasticsearch8', etc.
        isDdevProject: boolean;
        isDdevActive: boolean;
        import: string;
        wordpressImport: string;
        wordpressDownload: string;
        wordpressUploadsSync?: string;
        currentFolderIsMagento: boolean;
        currentFolderhasWordpress: boolean;
        runCommands: boolean;
        magerun2Command: string;
        magerun2CommandLocal: string;
        wpCommandLocal: string;
        databaseCommand: string;
        syncImageTypes: string[] | null;
        syncTypes: string[] | null;
    };
    finalMessages: {
        magentoDatabaseLocation: string;
        magentoDatabaseIncludeLocation: string;
        wordpressDatabaseLocation: string;
        importDomain: string;
        domains: string[];
        syncDomain?: string;
        syncDomains?: string[];
        wordpressBlogUrls?: Array<{blogId: string, domain: string}>;
    };
    databases: {
        databasesList: DatabaseListItem[] | null;
        databaseType: string | null;
        databaseData: DatabaseConfig | null;
    };
    wordpressConfig: {
        prefix: string;
        username: string;
        password: string;
        host: string;
        database: string;
        isMultisite?: boolean;
        multisiteType?: 'subdomain' | 'subdirectory';
        configuredSites?: Array<{blog_id: string, domain: string, path: string, newDomain: string}>;
    };
}

export interface SSHConnection {
    host: string;
    port: number;
    username: string;
    password?: string;
    privateKey?: string;
    passphrase?: string;
}

export interface CommandResult {
    stdout: string;
    stderr: string;
    exitCode: number;
}

export type DatabaseType = 'staging' | 'production';
export type StripType = 'development' | 'keep customer data' | 'full and human readable' | 'staging';
export type SyncType = 'media' | 'pub/media' | 'var/import';
