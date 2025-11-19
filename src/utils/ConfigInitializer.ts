import fs from 'fs';
import path from 'path';
import { info, warning } from './Console';
import { ConfigPathResolver } from './ConfigPathResolver';

/**
 * Initialize configuration files from samples if they don't exist
 * 
 * Priority:
 * 1. User config: ~/.mage-db-sync/config/
 * 2. Package config: <npm-install-path>/config/ (fallback)
 */
export class ConfigInitializer {
    /**
     * Copy sample file to actual config file if it doesn't exist
     * Now copies to user config directory (~/.mage-db-sync/config/) by default
     * Preserves symlinks if present
     */
    private static copySampleFile(samplePath: string, targetRelativePath: string): boolean {
        try {
            // Ensure user config directory exists
            ConfigPathResolver.ensureUserConfigDir();
            
            const userConfigDir = ConfigPathResolver.getUserConfigDir();
            const targetPath = path.join(userConfigDir, targetRelativePath);
            
            // Check if file already exists (in user or package config)
            const existingConfig = ConfigPathResolver.resolveConfigPath(targetRelativePath);
            if (existingConfig) {
                return false; // Config already exists
            }

            // Copy sample to user config directory (preserving symlinks)
            if (fs.existsSync(samplePath)) {
                // Ensure target directory exists
                const targetDir = path.dirname(targetPath);
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

                    fs.symlinkSync(absoluteTarget, targetPath);
                    info(`Created symlink ${targetPath} -> ${absoluteTarget}`);
                } else {
                    // Copy regular file
                    fs.copyFileSync(samplePath, targetPath);
                    info(`Created ${targetPath} from sample file`);
                }
                return true;
            }
            return false;
        } catch (err) {
            warning(`Failed to copy sample to user config: ${err instanceof Error ? err.message : 'Unknown error'}`);
            return false;
        }
    }

    /**
     * Initialize all required config files from samples
     * Copies to ~/.mage-db-sync/config/ by default
     */
    public static initialize(basePath: string): void {
        // Set package config directory for resolver
        ConfigPathResolver.setPackageConfigDir(basePath);
        ConfigPathResolver.ensureUserConfigDir();

        const configFiles = [
            {
                sample: path.join(basePath, 'config/settings.json.sample'),
                targetRelative: 'settings.json'
            },
            {
                sample: path.join(basePath, 'config/databases/staging.json.sample'),
                targetRelative: 'databases/staging.json'
            },
            {
                sample: path.join(basePath, 'config/databases/production.json.sample'),
                targetRelative: 'databases/production.json'
            }
        ];

        let anyCreated = false;
        for (const config of configFiles) {
            if (this.copySampleFile(config.sample, config.targetRelative)) {
                anyCreated = true;
            }
        }

        if (anyCreated) {
            const userConfigDir = ConfigPathResolver.getUserConfigDir();
            info(`Configuration files created in: ${userConfigDir}`);
            info('Please review and update the configuration files with your settings');
        }
    }
}
