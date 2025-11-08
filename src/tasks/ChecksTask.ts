/**
 * ChecksTask - Parallel checks for better performance
 */
import * as fs from 'fs';
import { Listr } from 'listr2';
import { consoleCommand, localhostMagentoRootExec } from '../utils/Console';
import { UI } from '../utils/UI';
import { ProgressDisplay } from '../utils/ProgressDisplay';
import configFile from '../../config/settings.json';

interface CheckResult {
    success: boolean;
    error?: string;
    duration?: number;
}

interface TaskItem {
    title: string;
    task: (ctx?: any, task?: any) => Promise<void | boolean>;
    skip?: string | (() => boolean);
}

class ChecksTask {
    private checkTasks: TaskItem[] = [];

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
                return {
                    success: exists,
                    error: exists ? undefined : `Download folder ${config.customConfig.localDatabaseFolderLocation} does not exist`
                };
            }
        });

        // Check: SSH key exists (if configured)
        if (config.customConfig.sshKeyLocation) {
            parallelChecks.push({
                name: 'SSH key file',
                check: async () => {
                    const exists = fs.existsSync(config.customConfig.sshKeyLocation);
                    return {
                        success: exists,
                        error: exists ? undefined : `SSH key ${config.customConfig.sshKeyLocation} does not exist`
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

                    if (!configFile.magentoBackend.adminUsername) {
                        errors.push('Admin username is missing');
                    }
                    if (!configFile.magentoBackend.adminPassword) {
                        errors.push('Admin password is missing');
                    }
                    if (!configFile.magentoBackend.adminEmailAddress) {
                        errors.push('Admin email address is missing');
                    }
                    if (!configFile.general.localDomainExtension) {
                        errors.push('Local domain extension is missing');
                    }
                    if (!configFile.general.elasticsearchPort) {
                        errors.push('ElasticSearch port is missing');
                    }

                    return {
                        success: errors.length === 0,
                        error: errors.length > 0 ? errors.join(', ') : undefined
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

        const totalDuration = Date.now() - startTime;

        if (failedChecks.length > 0) {
            throw new Error(`\n${failedChecks.join('\n')}\n\n💡 Completed ${parallelChecks.length} checks in ${totalDuration}ms (parallel)`);
        }
    }

    // Add tasks
    addTasks = async (list: any, config: any, ssh: any) => {
        list.add({
            title: 'Running parallel validation checks ⚡',
            task: (ctx: any, task: any): Listr =>
                task.newListr(this.checkTasks)
        });

        // Parallel checks (fast!)
        this.checkTasks.push({
            title: 'File system & configuration checks',
            task: async (ctx: any, task: any): Promise<void> => {
                task.output = 'Running parallel checks (0%)...';
                await this.runParallelChecks(config);
                const duration = Date.now() - Date.now();
                task.title = `File system & configuration checks`;
            }
        });

        // Sequential checks that depend on external commands
        if (
            config.settings.import === 'yes' ||
            (config.settings.wordpressImport === 'yes' && config.settings.currentFolderhasWordpress)
        ) {
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
                            `💡 Update with: magerun2 self-update`
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
                            `💡 Check your env.php configuration`
                        );
                    }
                });
            }
        }
    };
}

export default ChecksTask;
