/**
 * DatabaseService - Database operations and metadata
 */

import fs from 'fs';
import path from 'path';
import { DatabaseListItem, DatabaseConfig } from '../types';
import { ConfigService } from './ConfigService';
import { DatabaseError } from '../types/errors';

export class DatabaseService {
    private static instance: DatabaseService;
    private configService: ConfigService;

    private constructor() {
        this.configService = ConfigService.getInstance();
    }

    public static getInstance(): DatabaseService {
        if (!DatabaseService.instance) {
            DatabaseService.instance = new DatabaseService();
        }
        return DatabaseService.instance;
    }

    /**
     * Get list of databases for a given type
     */
    public getDatabaseList(type: 'staging' | 'production'): DatabaseListItem[] {
        const npmPath = this.configService.getNpmPath();
        const filePath = path.join(npmPath, `config/databases/${type}.json`);

        if (!fs.existsSync(filePath)) {
            throw new DatabaseError(`Database config file not found: ${filePath}`);
        }

        try {
            const config = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
            const databases: DatabaseListItem[] = [];

            for (const [key, value] of Object.entries(config.databases)) {
                const db = value as DatabaseConfig;
                databases.push({
                    key,
                    domainFolder: db.domainFolder,
                    username: db.username,
                    displayName: `${key} (${db.server})`
                });
            }

            return databases;
        } catch (error) {
            throw new DatabaseError(`Failed to load database list: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    /**
     * Get database configuration
     */
    public getDatabaseConfig(type: 'staging' | 'production', key: string): DatabaseConfig {
        return this.configService.loadDatabaseConfig(type, key);
    }

    /**
     * Check if database exists
     */
    public databaseExists(type: 'staging' | 'production', key: string): boolean {
        try {
            this.getDatabaseConfig(type, key);
            return true;
        } catch {
            return false;
        }
    }
}
