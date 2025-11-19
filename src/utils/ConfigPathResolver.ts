/**
 * ConfigPathResolver - Resolves configuration file paths with fallback mechanism
 * 
 * Priority:
 * 1. User config: ~/.mage-db-sync/config/
 * 2. Package config: <npm-install-path>/config/ (fallback)
 */

import fs from 'fs';
import path from 'path';
import os from 'os';

export class ConfigPathResolver {
    private static userConfigDir: string | null = null;
    private static packageConfigDir: string | null = null;

    /**
     * Get the user config directory path
     */
    public static getUserConfigDir(): string {
        if (!this.userConfigDir) {
            this.userConfigDir = path.join(os.homedir(), '.mage-db-sync', 'config');
        }
        return this.userConfigDir;
    }

    /**
     * Set the package config directory (npm installation path)
     */
    public static setPackageConfigDir(npmPath: string): void {
        this.packageConfigDir = path.join(npmPath, 'config');
    }

    /**
     * Get the package config directory path
     */
    public static getPackageConfigDir(): string {
        if (!this.packageConfigDir) {
            throw new Error('Package config directory not set. Call setPackageConfigDir() first.');
        }
        return this.packageConfigDir;
    }

    /**
     * Ensure user config directory exists
     */
    public static ensureUserConfigDir(): void {
        const userConfigDir = this.getUserConfigDir();
        
        // Create main config directory
        if (!fs.existsSync(userConfigDir)) {
            fs.mkdirSync(userConfigDir, { recursive: true });
        }

        // Create databases subdirectory
        const databasesDir = path.join(userConfigDir, 'databases');
        if (!fs.existsSync(databasesDir)) {
            fs.mkdirSync(databasesDir, { recursive: true });
        }
    }

    /**
     * Resolve config file path with fallback
     * 
     * Checks in order:
     * 1. ~/.mage-db-sync/config/{relativePath}
     * 2. <npm-install-path>/config/{relativePath}
     * 
     * @param relativePath - Relative path within config directory (e.g., 'settings.json', 'databases/staging.json')
     * @returns Full path to config file, or null if not found
     */
    public static resolveConfigPath(relativePath: string): string | null {
        const userConfigPath = path.join(this.getUserConfigDir(), relativePath);
        const packageConfigPath = path.join(this.getPackageConfigDir(), relativePath);

        // Check user config directory first
        if (fs.existsSync(userConfigPath)) {
            return userConfigPath;
        }

        // Fallback to package config directory
        if (fs.existsSync(packageConfigPath)) {
            return packageConfigPath;
        }

        // Not found in either location
        return null;
    }

    /**
     * Resolve config file path with fallback, throws if not found
     * 
     * @param relativePath - Relative path within config directory
     * @returns Full path to config file
     * @throws Error if config file not found
     */
    public static resolveConfigPathOrThrow(relativePath: string): string {
        const resolvedPath = this.resolveConfigPath(relativePath);
        
        if (!resolvedPath) {
            const userPath = path.join(this.getUserConfigDir(), relativePath);
            const packagePath = path.join(this.getPackageConfigDir(), relativePath);
            
            throw new Error(
                `Config file not found: ${relativePath}\n` +
                `Searched locations:\n` +
                `  1. ${userPath}\n` +
                `  2. ${packagePath}\n\n` +
                `Please create the configuration file in one of these locations.`
            );
        }

        return resolvedPath;
    }

    /**
     * Get all possible locations for a config file
     */
    public static getConfigLocations(relativePath: string): string[] {
        return [
            path.join(this.getUserConfigDir(), relativePath),
            path.join(this.getPackageConfigDir(), relativePath)
        ];
    }

    /**
     * Check if config exists in user directory
     */
    public static existsInUserConfig(relativePath: string): boolean {
        const userConfigPath = path.join(this.getUserConfigDir(), relativePath);
        return fs.existsSync(userConfigPath);
    }

    /**
     * Check if config exists in package directory
     */
    public static existsInPackageConfig(relativePath: string): boolean {
        const packageConfigPath = path.join(this.getPackageConfigDir(), relativePath);
        return fs.existsSync(packageConfigPath);
    }

    /**
     * Get the location where a config file was found
     */
    public static getConfigLocation(relativePath: string): 'user' | 'package' | null {
        if (this.existsInUserConfig(relativePath)) {
            return 'user';
        }
        if (this.existsInPackageConfig(relativePath)) {
            return 'package';
        }
        return null;
    }

    /**
     * Copy sample file to target with fallback support (preserving symlinks)
     */
    public static copySampleFile(sampleRelativePath: string, targetRelativePath: string): boolean {
        const samplePath = path.join(this.getPackageConfigDir(), sampleRelativePath);
        
        // Try user config directory first
        const userTargetPath = path.join(this.getUserConfigDir(), targetRelativePath);
        
        // Check if file already exists in user config
        if (fs.existsSync(userTargetPath)) {
            return false;
        }

        // Check if file exists in package config (fallback location)
        const packageTargetPath = path.join(this.getPackageConfigDir(), targetRelativePath);
        if (fs.existsSync(packageTargetPath)) {
            return false; // Already exists in fallback
        }

        // Copy sample to user config directory (preserving symlinks)
        if (fs.existsSync(samplePath)) {
            try {
                this.ensureUserConfigDir();
                
                // Ensure target directory exists
                const targetDir = path.dirname(userTargetPath);
                if (!fs.existsSync(targetDir)) {
                    fs.mkdirSync(targetDir, { recursive: true });
                }

                // Check if source is a symlink
                const stats = fs.lstatSync(samplePath);
                if (stats.isSymbolicLink()) {
                    // Preserve symlink
                    const linkTarget = fs.readlinkSync(samplePath);

                    // Convert to absolute path if it's relative
                    const absoluteTarget = path.isAbsolute(linkTarget)
                        ? linkTarget
                        : path.resolve(path.dirname(samplePath), linkTarget);

                    fs.symlinkSync(absoluteTarget, userTargetPath);
                } else {
                    // Copy regular file
                    fs.copyFileSync(samplePath, userTargetPath);
                }
                
                return true;
            } catch (err) {
                console.error(`Failed to copy sample file: ${err instanceof Error ? err.message : 'Unknown error'}`);
                return false;
            }
        }

        return false;
    }
}
