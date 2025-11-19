/**
 * ChecksTask - Parallel checks for better performance
 */
import * as fs from 'fs';
import { Listr } from 'listr2';
import { consoleCommand, localhostMagentoRootExec } from '../utils/Console';
import { ServiceContainer } from '../core/ServiceContainer';
import { ConfigPathResolver } from '../utils/ConfigPathResolver';
import { UI } from '../utils/UI';

interface CheckResult {
    success: boolean;
    error?: string;
    duration?: number;
}

interface TaskItem {
    title: string;
    /* eslint-disable @typescript-eslint/no-unused-vars, no-unused-vars */
    task: (ctx?: any, task?: any) => Promise<void | boolean>;
    skip?: string | (() => boolean);
}

class ChecksTask {
    private checkTasks: TaskItem[] = [];
    private services: ServiceContainer;

    constructor() {
        this.services = ServiceContainer.getInstance();
    }

    configure = async (list: any, config: any, ssh: any) => {
        await this.addTasks(list, config, ssh);
        return list;
    };

    /**
     * Run independent checks in parallel for better performance
     */
    private async runParallelChecks(config: any): Promise<void> {
        const startTime = Date.now();

        // Define all independent checks that can run in parallel
        const parallelChecks: Array<{ name: string; check: () => Promise<CheckResult> }> = [];

        // Check: Download folder exists
        parallelChecks.push({
            name: 'Download folder',
            check: async () => {
                const exists = fs.existsSync(config.customConfig.localDatabaseFolderLocation);
                const configPath = ConfigPathResolver.resolveConfigPath('settings.json') || ConfigPathResolver.getUserConfigDir() + '/settings.json';
                return {
                    success: exists,
                    error: exists ? undefined : `${config.customConfig.localDatabaseFolderLocation} does not exist\n[TIP] Check ${configPath} (general.databaseLocation)`
                };
            }
        });

        // Check: SSH key exists (if configured)
        if (config.customConfig.sshKeyLocation) {
            parallelChecks.push({
                name: 'SSH key file',
                check: async () => {
                    const exists = fs.existsSync(config.customConfig.sshKeyLocation);
                    const configPath = ConfigPathResolver.resolveConfigPath('settings.json') || ConfigPathResolver.getUserConfigDir() + '/settings.json';
                    return {
                        success: exists,
                        error: exists ? undefined : `${config.customConfig.sshKeyLocation} does not exist\n[TIP] Check ${configPath} (ssh.keyLocation)`
                    };
                }
            });
        }

        // Check: Config validation (if import is enabled)
        if (config.settings.import === 'yes' || config.settings.wordpressImport === 'yes') {
            parallelChecks.push({
                name: 'Configuration validation',
                check: async () => {
                    const errors: string[] = [];
                    const settingsConfig = this.services.getConfig().getSettingsConfig();

                    if (!settingsConfig.magentoBackend.adminUsername) {
                        errors.push('Admin username is missing (magentoBackend.adminUsername)');
                    }
                    if (!settingsConfig.magentoBackend.adminPassword) {
                        errors.push('Admin password is missing (magentoBackend.adminPassword)');
                    }
                    if (!settingsConfig.magentoBackend.adminEmailAddress) {
                        errors.push('Admin email address is missing (magentoBackend.adminEmailAddress)');
                    }
                    if (!settingsConfig.general.localDomainExtension) {
                        errors.push('Local domain extension is missing (general.localDomainExtension)');
                    }
                    if (!settingsConfig.general.elasticsearchPort) {
                        errors.push('ElasticSearch port is missing (general.elasticsearchPort)');
                    }

                    const configPath = ConfigPathResolver.resolveConfigPath('settings.json') || ConfigPathResolver.getUserConfigDir() + '/settings.json';
                    return {
                        success: errors.length === 0,
                        error: errors.length > 0 ? `${errors.join(', ')}\n[TIP] Check ${configPath}` : undefined
                    };
                }
            });

            // Check: vendor/autoload.php exists
            parallelChecks.push({
                name: 'Vendor autoload',
                check: async () => {
                    const vendorFileLocation = config.settings.currentFolder + '/vendor/autoload.php';
                    const exists = fs.existsSync(vendorFileLocation);
                    return {
                        success: exists,
                        error: exists ? undefined : `vendor/autoload.php is missing at ${vendorFileLocation}`
                    };
                }
            });

            // Check: env.php exists (for Magento import)
            if (config.settings.import === 'yes') {
                parallelChecks.push({
                    name: 'Magento env.php',
                    check: async () => {
                        const envFileLocation = config.settings.currentFolder + '/app/etc/env.php';
                        const exists = fs.existsSync(envFileLocation);
                        return {
                            success: exists,
                            error: exists ? undefined : `env.php is missing at ${envFileLocation}`
                        };
                    }
                });
            }
        }

        // Run all checks in parallel
        const results = await Promise.allSettled(
            parallelChecks.map(async ({ name, check }) => {
                const checkStart = Date.now();
                const result = await check();
                return {
                    name,
                    ...result,
                    duration: Date.now() - checkStart
                };
            })
        );

        // Process results and throw error if any check failed
        const failedChecks: string[] = [];
        results.forEach((result, index) => {
            if (result.status === 'fulfilled') {
                const checkResult = result.value;
                if (!checkResult.success && checkResult.error) {
                    failedChecks.push(`${checkResult.name}: ${checkResult.error}`);
                }
            } else {
                failedChecks.push(`${parallelChecks[index].name}: ${result.reason}`);
            }
        });

        if (failedChecks.length > 0) {
            throw new Error(failedChecks.join('\n'));
        }
    }

    // Add tasks
    addTasks = async (list: any, config: any, _ssh: any) => {
        list.add({
            title: 'Running parallel validation checks',
            task: (ctx: any, task: any): Listr =>
                task.newListr(this.checkTasks)
        });

        // Parallel checks (fast!)
        this.checkTasks.push({
            title: 'File system & configuration checks',
            task: async (ctx: any, task: any): Promise<void> => {
                task.output = 'Running parallel checks (0%)...';
                await this.runParallelChecks(config);
                const _duration = Date.now() - Date.now();
                task.title = `File system & configuration checks`;
            }
        });

        // Sequential checks that depend on external commands
        if (
            config.settings.import === 'yes' ||
            (config.settings.wordpressImport === 'yes' && config.settings.currentFolderhasWordpress)
        ) {
            // Check if DDEV is running when isDdevActive is true
            if (config.settings.isDdevActive) {
                this.checkTasks.push({
                    title: 'Checking DDEV project status',
                    task: async (ctx: any, task: any): Promise<boolean> => {
                        task.output = 'Verifying DDEV is running...';
                        const commandService = this.services.getCommand();

                        // Check DDEV status in the import directory
                        const importDir = config.settings.currentFolder;
                        const isRunning = await commandService.isDdevActive(importDir);

                        if (!isRunning) {
                            throw UI.createError(
                                `DDEV project is not running in ${importDir}\n` +
                                `[TIP] Start your DDEV project with: ddev start`
                            );
                        }

                        task.output = 'DDEV project is running';
                        return true;
                    }
                });
            }

            // Check Magerun 2 version (requires command execution)
            this.checkTasks.push({
                title: 'Checking Magerun2 version',
                task: async (ctx: any, task: any): Promise<boolean> => {
                    task.output = 'Verifying Magerun2 installation...';
                    if (config.settings.isDdevActive) {
                        return true;
                    }

                    let installedMagerun2Version: any = await consoleCommand('magerun2 -V', false);
                    installedMagerun2Version = String(installedMagerun2Version).split(' ')[1];

                    task.output = `Found Magerun2 v${installedMagerun2Version}`;

                    if (installedMagerun2Version < config.requirements.magerun2Version) {
                        throw new Error(
                            `Your current Magerun2 version (${installedMagerun2Version}) is too low. ` +
                            `Version ${config.requirements.magerun2Version} is required.\n` +
                            `[TIP] Update with: magerun2 self-update`
                        );
                    }

                    return true;
                }
            });

            if (config.settings.import === 'yes') {
                // Check database host configuration (requires magerun command)
                this.checkTasks.push({
                    title: 'Checking database host configuration',
                    task: async (ctx: any, task: any): Promise<boolean> => {
                        task.output = 'Checking local database configuration...';
                        if (config.settings.isDdevActive) {
                            return true;
                        }

                        let host = await localhostMagentoRootExec(
                            `magerun2 db:info --format=json`,
                            config
                        );
                        host = JSON.parse(host as string);

                        let envHost = null;

                        for (const [key, value] of Object.entries(host as Record<string, any>)) {
                            const hostName = (value as any)['Name'];
                            const hostValue = (value as any)['Value'];
                            if (hostName.toLowerCase() === 'host') {
                                envHost = hostValue;
                                break;
                            }
                        }

                        // db = ddev
                        if (envHost === 'localhost' || envHost === '127.0.0.1' || envHost === 'db') {
                            task.output = `Database host: ${envHost}`;
                            return true;
                        }

                        throw new Error(
                            `Database host is not configured correctly.\n` +
                            `Current value: ${envHost}\n` +
                            `Expected: localhost, 127.0.0.1, or db\n` +
                            `[TIP] Check your env.php configuration`
                        );
                    }
                });
            }
        }
    };
}

export default ChecksTask;
