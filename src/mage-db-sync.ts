import { Command } from 'commander';
import kleur from 'kleur';
import process from 'process';
import fs from 'fs';
import { getInstalledPath } from 'get-installed-path';
import { error } from './utils/Console';
import VersionCheck from './utils/VersionCheck';
import { StartController } from './controllers/StartController';
import { OpenFolderController } from './controllers/OpenFolderController';
import { OpenConfigController } from './controllers/OpenConfigController';
import { SelfUpdateController } from './controllers/SelfUpdateController';
import { ServiceContainer } from './core/ServiceContainer';
import { ConfigInitializer } from './utils/ConfigInitializer';
import { ConfigPathResolver } from './utils/ConfigPathResolver';
import {UI} from "./utils/UI";
import { NonInteractiveOptions } from './types';

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

        // Initialize config path resolver
        ConfigPathResolver.setPackageConfigDir(npmPath);
        ConfigPathResolver.ensureUserConfigDir();

        // Initialize config files from samples if they don't exist
        ConfigInitializer.initialize(npmPath);

        // Check for required files (with fallback support)
        let missingFiles = false;
        const requiredFiles = [
            'static-settings.json',  // Always from package
            'settings.json',
            'databases/staging.json',
            'databases/production.json'
        ];

        for (const relativePath of requiredFiles) {
            // static-settings.json is always from package directory
            if (relativePath === 'static-settings.json') {
                const packagePath = `${npmPath}/config/${relativePath}`;
                if (!fs.existsSync(packagePath)) {
                    error(`${relativePath} was not found in package: ${packagePath}`);
                    missingFiles = true;
                }
                continue;
            }

            // Other files use fallback mechanism
            const resolvedPath = ConfigPathResolver.resolveConfigPath(relativePath);
            if (!resolvedPath) {
                const userPath = ConfigPathResolver.getUserConfigDir();
                const packagePath = `${npmPath}/config`;
                error(
                    `${relativePath} was not found.\n` +
                    `  Checked: ${userPath}/${relativePath}\n` +
                    `  Checked: ${packagePath}/${relativePath}\n` +
                    `  Please create this file in one of these locations.`
                );
                missingFiles = true;
            }
        }

        // If there are files missing, stop the program
        if (missingFiles) {
            return;
        }

        UI.showBanner();
        console.log('');

        // Show config location info
        const userConfigDir = ConfigPathResolver.getUserConfigDir();
        const settingsLocation = ConfigPathResolver.getConfigLocation('settings.json');
        if (settingsLocation === 'user') {
            console.log(kleur.gray(`Using config from: ${userConfigDir}`));
        } else {
            console.log(kleur.gray(`Using config from: ${npmPath}/config`));
            console.log(kleur.dim(`(You can override by creating configs in: ${userConfigDir})`));
        }

        // Get package version
        const packageJson = require('../package.json');
        
        // Start version check in background (non-blocking)
        const versionCheck = new VersionCheck();
        const versionCheckPromise = versionCheck.getToolVersions().catch(() => {
            // Silently fail - not critical for operation
        });

        // Build description (without update message initially)
        let description = `mage-db-sync - Magento Database Synchronizer - ${packageJson.version}\n\n`;
        description += `${kleur.gray('Resources:')}\n`;
        description += `• Github: https://github.com/jellesiderius/mage-db-sync\n`;
        description += `• Docs: https://github.com/jellesiderius/mage-db-sync/wiki\n`;
        description += `• Issues: https://github.com/jellesiderius/mage-db-sync/issues`;
        description += `\n\n${kleur.bgYellow(kleur.bold(' Sponsored by '))} ${kleur.bold('HYPER')} (https://www.hypershop.nl)`;
        
        // Wait up to 1.5 seconds for version check (reasonable timeout)
        const raceResult = await Promise.race([
            versionCheckPromise.then(() => 'completed'),
            new Promise(resolve => setTimeout(() => resolve('timeout'), 1500))
        ]);
        
        // If version check completed, add update message
        if (raceResult === 'completed' && versionCheck.config.currentVersion < versionCheck.config.latestVersion) {
            description = description.replace(
                `\n\n${kleur.bgYellow(kleur.bold(' Sponsored by '))}`,
                `\n\n${kleur.yellow('Update available!')} Run 'mage-db-sync self-update' for version ${versionCheck.config.latestVersion}\n\n${kleur.bgYellow(kleur.bold(' Sponsored by '))}`
            );
        }

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
            .option('-y, --non-interactive', 'Skip all prompts; fail if required flags are missing')
            .option('--database-type <type>', 'Database type: staging | production')
            .option('--database <key>', 'Exact key from databases JSON config')
            .option('--strip <mode>', 'Strip mode: stripped | "keep customer data" | full | "full and human readable" | none')
            .option('--import <yes|no>', 'Whether to import the DB locally after download')
            .option('--no-import', 'Shorthand for --import=no')
            .option('--sync-types <types>', 'Comma-separated sync types: "Magento database,media" etc.')
            .option('--target <target>', 'Target: local | staging (default: local)')
            .option('--staging-base-url <url>', 'Base URL to set on staging after import (optional)')
            .option('--source-ssh <user@host>', 'SSH login for source server (skips config file lookup)')
            .option('--source-path <path>', 'Absolute Magento root path on source server')
            .option('--source-port <n>', 'SSH port for source (default: 22)', parseInt)
            .option('--ssh-key <path>', 'SSH private key path (applies to both source and target)')
            .option('--target-ssh <user@host>', 'SSH login for remote staging target')
            .option('--target-path <path>', 'Absolute Magento root path on staging target')
            .option('--target-port <n>', 'SSH port for target (default: 22)', parseInt)
            .option('--local-path <path>', 'Local Magento root path (for --target=local inline mode)')
            .option('--local-magerun2 <cmd>', 'Override local magerun2 command (e.g. "docker exec mycontainer magerun2")')
            .option('--backup', 'Dump the target database before overwriting it')
            .action(async (cmdOptions) => {
                const opts: NonInteractiveOptions = {};

                if (cmdOptions.nonInteractive) {
                    opts.nonInteractive = true;
                }
                if (cmdOptions.databaseType) {
                    opts.databaseType = cmdOptions.databaseType as 'staging' | 'production';
                }
                if (cmdOptions.database) {
                    opts.database = cmdOptions.database;
                }
                if (cmdOptions.strip) {
                    opts.strip = cmdOptions.strip as NonInteractiveOptions['strip'];
                }
                // --no-import sets cmdOptions.import to false; explicit --import <yes|no> gives a string
                if (cmdOptions.import === false) {
                    opts.import = 'no';
                } else if (typeof cmdOptions.import === 'string') {
                    opts.import = cmdOptions.import as 'yes' | 'no';
                }
                if (cmdOptions.syncTypes) {
                    opts.syncTypes = (cmdOptions.syncTypes as string).split(',').map((s: string) => s.trim());
                }
                if (cmdOptions.target) {
                    opts.target = cmdOptions.target as 'local' | 'staging';
                }
                if (cmdOptions.stagingBaseUrl) {
                    opts.stagingBaseUrl = cmdOptions.stagingBaseUrl;
                }
                if (cmdOptions.sourceSsh) {
                    opts.sourceSsh = cmdOptions.sourceSsh;
                    opts.inlineMode = true;
                    opts.nonInteractive = true;
                }
                if (cmdOptions.sourcePath) {
                    opts.sourcePath = cmdOptions.sourcePath;
                }
                if (cmdOptions.sourcePort) {
                    opts.sourcePort = cmdOptions.sourcePort;
                }
                if (cmdOptions.sshKey) {
                    opts.sshKey = cmdOptions.sshKey;
                }
                if (cmdOptions.targetSsh) {
                    opts.targetSsh = cmdOptions.targetSsh;
                }
                if (cmdOptions.targetPath) {
                    opts.targetPath = cmdOptions.targetPath;
                }
                if (cmdOptions.targetPort) {
                    opts.targetPort = cmdOptions.targetPort;
                }
                if (cmdOptions.localPath) {
                    opts.localPath = cmdOptions.localPath;
                }
                if (cmdOptions.localMagerun2) {
                    opts.localMagerun2 = cmdOptions.localMagerun2;
                }
                if (cmdOptions.backup) {
                    opts.backup = true;
                }

                // Self-sync guard for inline mode
                if (opts.inlineMode && opts.sourceSsh && opts.targetSsh) {
                    if (opts.sourceSsh === opts.targetSsh && opts.sourcePath === opts.targetPath) {
                        error('Source and target are identical — refusing to sync a server to itself.');
                        process.exit(1);
                    }
                }

                if (opts.nonInteractive && !opts.inlineMode) {
                    if (!opts.databaseType || !opts.database) {
                        error('--non-interactive requires both --database-type and --database to be set.');
                        process.exit(1);
                    }
                }

                const controller = new StartController();
                await controller.execute(opts);
            });

        // Open folder command
        program
            .command('open-folder')
            .description('Open the database download folder')
            .action(async () => {
                const controller = new OpenFolderController();
                await controller.execute();
            });

        // Open config folder command
        program
            .command('open-config')
            .description('Open the configuration folder')
            .action(async () => {
                const controller = new OpenConfigController();
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
