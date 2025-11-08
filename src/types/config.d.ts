/**
 * Type declarations for JSON configuration files
 */

declare module '../../config/settings.json' {
    export interface SettingsJson {
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
    const value: SettingsJson;
    export default value;
}

declare module '../../config/static-settings.json' {
    export interface StaticSettingsJson {
        settings: {
            databaseStripDevelopment: string;
            databaseStripKeepCustomerData: string;
            databaseStripStaging: string;
            databaseIncludeStaging: string;
        };
    }
    const value: StaticSettingsJson;
    export default value;
}

declare module '../../config/databases/staging.json' {
    export interface DatabaseEntry {
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

    export interface DatabasesJson {
        databases: Record<string, DatabaseEntry>;
    }
    const value: DatabasesJson;
    export default value;
}

declare module '../../config/databases/production.json' {
    export interface DatabaseEntry {
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

    export interface DatabasesJson {
        databases: Record<string, DatabaseEntry>;
    }
    const value: DatabasesJson;
    export default value;
}

declare module '../../package.json' {
    export interface PackageJson {
        name: string;
        version: string;
        description: string;
        [key: string]: any;
    }
    const value: PackageJson;
    export default value;
}

declare module 'download-git-repo' {
    function download(repo: string, dest: string, callback: (err?: Error) => void): void;
    export default download;
}
