import fs from 'fs';
import path from 'path';
import { info, warning } from './Console';

/**
 * Initialize configuration files from samples if they don't exist
 */
export class ConfigInitializer {
    /**
     * Copy sample file to actual config file if it doesn't exist
     */
    private static copySampleFile(samplePath: string, targetPath: string): boolean {
        try {
            if (!fs.existsSync(targetPath) && fs.existsSync(samplePath)) {
                fs.copyFileSync(samplePath, targetPath);
                info(`Created ${targetPath} from sample file`);
                return true;
            }
            return false;
        } catch (err) {
            warning(`Failed to copy ${samplePath} to ${targetPath}: ${err instanceof Error ? err.message : 'Unknown error'}`);
            return false;
        }
    }

    /**
     * Initialize all required config files from samples
     */
    public static initialize(basePath: string): void {
        const configFiles = [
            {
                sample: path.join(basePath, 'config/settings.json.sample'),
                target: path.join(basePath, 'config/settings.json')
            },
            {
                sample: path.join(basePath, 'config/databases/staging.json.sample'),
                target: path.join(basePath, 'config/databases/staging.json')
            },
            {
                sample: path.join(basePath, 'config/databases/production.json.sample'),
                target: path.join(basePath, 'config/databases/production.json')
            }
        ];

        let anyCreated = false;
        for (const config of configFiles) {
            if (this.copySampleFile(config.sample, config.target)) {
                anyCreated = true;
            }
        }

        if (anyCreated) {
            info('Please review and update the configuration files with your settings');
        }
    }
}
