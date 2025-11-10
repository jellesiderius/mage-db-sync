/**
 * mage-db-sync v2 - Main entry point
 *
 * Clean V2 architecture with services and dependency injection
 */

import { Command } from 'commander';
import kleur from 'kleur';
import process from 'process';
import fs from 'fs';
import { getInstalledPath } from 'get-installed-path';
import { error } from './utils/Console';
import VersionCheck from './utils/VersionCheck';
import { StartController } from './controllers/StartController';
import { OpenFolderController } from './controllers/OpenFolderController';
import { SelfUpdateController } from './controllers/SelfUpdateController';
import { ServiceContainer } from './core/ServiceContainer';
import { ConfigInitializer } from './utils/ConfigInitializer';

// Remove warning listeners
process.removeAllListeners('warning');

/**
 * Main application entry
 */
async function main() {
    try {
        // Initialize ServiceContainer first
        const container = ServiceContainer.getInstance();
        await container.initialize();

        // Get npm installation path
        const npmPath = await getInstalledPath('mage-db-sync');

        // Initialize config files from samples if they don't exist
        ConfigInitializer.initialize(npmPath);

        // Check for required files
        let missingFiles = false;
        const requiredFiles = [
            'config/static-settings.json',
            'config/settings.json',
            'config/databases/staging.json',
            'config/databases/production.json'
        ];

        for (const filePath of requiredFiles) {
            if (!fs.existsSync(`${npmPath}/${filePath}`)) {
                error(`${filePath} was not found. Make sure this file exists (${npmPath}/${filePath})`);
                missingFiles = true;
            }
        }

        // If there are files missing, stop the program
        if (missingFiles) {
            return;
        }

        // Get package version
        const packageJson = require('../package.json');
        const versionCheck = new VersionCheck();
        await versionCheck.getToolVersions();

        // Build description
        let description = `mage-db-sync - Magento Database Synchronizer - ${packageJson.version}\n\n`;
        description += `${kleur.gray('Resources:')}\n`;
        description += `• Github: https://github.com/jellesiderius/mage-db-sync\n`;
        description += `• Docs: https://github.com/jellesiderius/mage-db-sync/wiki\n`;
        description += `• Issues: https://github.com/jellesiderius/mage-db-sync/issues`;

        if (versionCheck.config.currentVersion < versionCheck.config.latestVersion) {
            description += `\n\n${kleur.yellow('Update available!')} Run 'mage-db-sync self-update' for version ${versionCheck.config.latestVersion}`;
        }

        description += `\n\n${kleur.bgYellow(kleur.bold(' Sponsored by '))} ${kleur.bold('HYPER')} (https://www.hypershop.nl)`;

        // Setup CLI
        const program = new Command();

        program
            .version(packageJson.version)
            .usage('<command> [options]')
            .description(description);

        // Start command - main sync operation
        program
            .command('start')
            .description('Start database synchronization')
            .action(async () => {
                const controller = new StartController();
                await controller.execute();
            });

        // Open folder command
        program
            .command('open-folder')
            .description('Open the database download folder')
            .action(async () => {
                const controller = new OpenFolderController();
                await controller.execute();
            });

        // Self update command
        program
            .command('self-update')
            .description('Update mage-db-sync to the latest version')
            .action(async () => {
                const controller = new SelfUpdateController();
                await controller.execute();
            });

        // Handle unknown commands
        program.on('command:*', () => {
            program.help();
        });

        // Parse arguments
        program.parse(process.argv);

        // Show help if no command provided
        if (!process.argv.slice(2).length) {
            program.outputHelp();
            process.exit(0);
        }
    } catch (err) {
        error(`Unexpected error: ${err instanceof Error ? err.message : 'Unknown error'}`);
        if (process.env.DEBUG && err instanceof Error) {
            console.error(err.stack);
        }
        process.exit(1);
    }
}

// Run the application
main();
