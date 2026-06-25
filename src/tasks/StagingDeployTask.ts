/**
 * StagingDeployTask - Transfer and import a production dump into the staging server.
 *
 * This task runs AFTER DownloadTask has created the dump on the production server
 * (config.databaseFileName) and left it at ~/config.databaseFileName on prod.
 * It opens a second SSH connection to staging, pipes the file across, imports it,
 * updates base URLs, flushes cache, and cleans up both servers.
 */
import {
    sshNavigateToMagentoRootCommand,
    sshMagentoRootFolderMagerunCommand,
    stripOutputString,
    shellEscape
} from '../utils/Console';
import { Listr } from 'listr2';
import { SSHConnectionPool } from '../utils/Performance';
import { UI } from '../utils/UI';
import { ServiceContainer } from '../core/ServiceContainer';
import fs from 'fs';
import os from 'os';
import chalk from 'chalk';
import { spawn } from 'child_process';

function expandHome(p: string): string {
    if (!p) return p;
    if (p === '~') return os.homedir();
    if (p.startsWith('~/')) return os.homedir() + p.slice(1);
    return p;
}

interface TaskItem {
    title: string;
    /* eslint-disable @typescript-eslint/no-unused-vars, no-unused-vars */
    task: (ctx?: any, task?: any) => Promise<void | boolean>;
    skip?: string | (() => boolean);
}

// -----------------------------------------------------------------------
// Helper: build navigate-to-magento-root commands for the STAGING server.
// The util functions always read from config.databases.databaseData, so we
// temporarily swap in stagingDatabaseData and swap it back, OR we just
// replicate the tiny logic inline (simpler, no mutation risk).
// -----------------------------------------------------------------------

function stagingNavigateToMagentoRootCommand(command: string, config: any): string {
    const d = config.databases.stagingDatabaseData;
    if (!d) {
        throw new Error('stagingDatabaseData is not set in config');
    }
    if (d.externalProjectFolder && d.externalProjectFolder.length > 0) {
        const escapedFolder = shellEscape(d.externalProjectFolder);
        return `cd ${escapedFolder} > /dev/null 2>&1; ${command}`;
    }
    const escapedDomainFolder = shellEscape(d.domainFolder);
    return (
        'cd domains > /dev/null 2>&1;' +
        'cd ' + escapedDomainFolder + ' > /dev/null 2>&1;' +
        'cd application > /dev/null 2>&1;' +
        'cd public_html > /dev/null 2>&1;' +
        'cd current > /dev/null 2>&1;' +
        command
    );
}

function stagingMagerunCommand(command: string, config: any): string {
    const phpPath = config.serverVariables.secondDatabaseExternalPhpPath || 'php';
    const magerunFile = config.serverVariables.secondDatabaseMagerun2 || config.serverVariables.magerunFile;
    return stagingNavigateToMagentoRootCommand(`${phpPath} ${magerunFile} ${command}`, config);
}

// -----------------------------------------------------------------------

class StagingDeployTask {
    private stagingTasks: TaskItem[] = [];
    private services: ServiceContainer;

    constructor() {
        this.services = ServiceContainer.getInstance();
    }

    /**
     * Build NodeSSH config object from a DatabaseConfig entry + customConfig.
     * Mirrors DownloadTask.createSSHConfig exactly.
     */
    private createSSHConfig(databaseConfig: any, customConfig: any): any {
        const sshConfig: any = {
            host: databaseConfig.server,
            password: databaseConfig.password,
            username: databaseConfig.username,
            port: databaseConfig.port,
            readyTimeout: 20000,
            keepaliveInterval: 10000,
            keepaliveCountMax: 3
        };

        // Prefer the key stored on the staging database entry; fall back to global key
        const keyLocation =
            databaseConfig.sshKeyLocation ||
            customConfig.sshKeyLocation;

        const expandedKey = expandHome(keyLocation);
        if (expandedKey && fs.existsSync(expandedKey)) {
            sshConfig.privateKey = fs.readFileSync(expandedKey, 'utf8');
            if (customConfig.sshPassphrase) {
                sshConfig.passphrase = customConfig.sshPassphrase;
            }
        }

        return sshConfig;
    }

    /**
     * Build the SSH CLI flags used in local spawn commands (transfer pipe).
     * Returns a string like: -p 22 -o StrictHostKeyChecking=no -i /path/key
     */
    private buildSshFlags(databaseConfig: any, customConfig: any): string {
        const port = databaseConfig.port;
        const keyLocation = databaseConfig.sshKeyLocation || customConfig.sshKeyLocation;

        let flags = port
            ? `-p ${port} -o StrictHostKeyChecking=no -o BatchMode=yes`
            : `-o StrictHostKeyChecking=no -o BatchMode=yes`;

        const expandedKey = expandHome(keyLocation);
        if (expandedKey && fs.existsSync(expandedKey)) {
            flags += ` -i ${shellEscape(expandedKey)}`;
        }

        return flags;
    }

    configure = async (list: any, config: any, sshProd: any, sshStaging: any) => {
        await this.addTasks(list, config, sshProd, sshStaging);
        return list;
    };

    addTasks = async (list: any, config: any, sshProd: any, sshStaging: any) => {
        const stagingHost = config.databases.stagingDatabaseData?.server || 'staging';

        list.add({
            title: `Deploying to staging server (${stagingHost})`,
            task: (ctx: any, task: any): Listr => task.newListr(this.stagingTasks)
        });

        // ----------------------------------------------------------------
        // 1. Connect to staging server
        // ----------------------------------------------------------------
        this.stagingTasks.push({
            title: 'Connecting to staging server through SSH',
            task: async (_ctx: any, task: any): Promise<void> => {
                const logger = this.services.getLogger();
                const stagingDb = config.databases.stagingDatabaseData;

                if (!stagingDb) {
                    throw UI.createError(
                        'No stagingDatabaseData found in config.\n' +
                        '[TIP] Make sure the staging server is configured in your databases file.'
                    );
                }

                task.output = `Connecting to ${stagingDb.server}...`;
                logger.info('Connecting to staging SSH', { host: stagingDb.server });

                const sshConfig = this.createSSHConfig(stagingDb, config.customConfig);

                try {
                    await SSHConnectionPool.getConnection(stagingDb.server, sshConfig, async () => {
                        await sshStaging.connect(sshConfig);

                        if (sshStaging && sshStaging.connection) {
                            sshStaging.connection.on('error', (err: Error) => {
                                if (err.message && err.message.includes('ECONNRESET')) {
                                    logger.debug('Staging SSH connection reset', { host: stagingDb.server });
                                } else {
                                    logger.error('Staging SSH connection error', err, { host: stagingDb.server });
                                }
                            });
                        }

                        return sshStaging;
                    });
                } catch (error) {
                    const err = error as Error;
                    throw UI.createError(
                        `Failed to connect to staging server ${stagingDb.server}\n` +
                        `[TIP] Check your SSH credentials and key format\n` +
                        `Error: ${err.message}`
                    );
                }

                task.title = 'Connected to staging server through SSH';
                task.output = 'SSH connection to staging established';
                logger.info('Connected to staging SSH', { host: stagingDb.server });
            }
        });

        // ----------------------------------------------------------------
        // 2. Detect PHP + magerun on staging
        // ----------------------------------------------------------------
        this.stagingTasks.push({
            title: 'Retrieving staging server settings',
            task: async (_ctx: any, task: any): Promise<void> => {
                const logger = this.services.getLogger();
                task.output = 'Detecting Magento version on staging...';

                const detectCmd = stagingNavigateToMagentoRootCommand(
                    'test -e vendor/magento && echo 2 || echo 1; pwd; which php;',
                    config
                );

                await sshStaging.execCommand(detectCmd).then((result: any) => {
                    if (result && result.stdout) {
                        const string = stripOutputString(result.stdout);
                        const parts = string.split('\n');
                        // parts[0] = magento version, parts[1] = root, parts[2] = php path
                        const phpPath = (parts[2] || '').trim() || 'php';
                        config.serverVariables.secondDatabaseExternalPhpPath = phpPath;

                        task.output = `Detected Magento ${(parts[0] || '').trim()} on staging`;
                        logger.info('Staging server settings retrieved', {
                            magentoVersion: parts[0],
                            root: parts[1],
                            phpPath
                        });
                    }
                });

                // Override PHP path if explicitly set on the staging database config
                const stagingDb = config.databases.stagingDatabaseData;
                if (stagingDb?.externalPhpPath && stagingDb.externalPhpPath.length > 0) {
                    config.serverVariables.secondDatabaseExternalPhpPath = stagingDb.externalPhpPath;
                }

                // Determine magerun2 file to use on staging (same version as prod)
                const magerunFile = config.serverVariables.magerunFile || `n98-magerun2-${config.requirements.magerun2Version}.phar`;
                config.serverVariables.secondDatabaseMagerun2 = magerunFile;

                // Ensure magerun2 exists on staging — download if missing
                task.output = 'Checking magerun2 on staging...';
                const magerunExists = await sshStaging
                    .execCommand(
                        stagingNavigateToMagentoRootCommand(
                            `test -s ${shellEscape(magerunFile)} && echo "EXISTS"`,
                            config
                        )
                    )
                    .then((r: any) => stripOutputString(r.stdout).includes('EXISTS'));

                if (!magerunExists) {
                    task.output = 'Downloading magerun2 to staging...';
                    const forkUrl = `https://github.com/jellesiderius/mage-db-sync/raw/refs/heads/master/files/${magerunFile}`;
                    const version = config.requirements.magerun2Version;
                    const officialUrl = `https://github.com/netz98/n98-magerun2/releases/download/${version}/n98-magerun2.phar`;
                    const escapedTarget = shellEscape(magerunFile);
                    const dlCmd = stagingNavigateToMagentoRootCommand(
                        `curl -fsSL -o ${escapedTarget} ${shellEscape(forkUrl)} || ` +
                        `curl -fsSL -o ${escapedTarget} ${shellEscape(officialUrl)} || ` +
                        `wget -q -O ${escapedTarget} ${shellEscape(officialUrl)}`,
                        config
                    );
                    const dlResult = await sshStaging.execCommand(dlCmd);
                    if (dlResult.code !== 0) {
                        throw UI.createError(
                            `Failed to download magerun2 to staging\n` +
                            `URL: ${forkUrl} (also tried: ${officialUrl})\n` +
                            `[TIP] Check internet connectivity on the staging server\n` +
                            `Error: ${dlResult.stderr || dlResult.stdout}`
                        );
                    }
                }

                task.title = 'Retrieved staging server settings';
                logger.info('Staging magerun2 ready', { file: magerunFile });
            }
        });

        // ----------------------------------------------------------------
        // 2.5. Backup current staging DB (only when --backup is set)
        // ----------------------------------------------------------------
        if (config.settings.nonInteractiveOptions?.backup) {
            this.stagingTasks.push({
                title: 'Backing up current staging database',
                task: async (_ctx: any, task: any): Promise<void> => {
                    const logger = this.services.getLogger();
                    const ts = new Date().toISOString().replace(/[^0-9]/g, '').slice(0, 14);
                    const backupFile = `staging-backup-${ts}.sql.gz`;
                    config.settings.stagingBackupFile = backupFile;

                    task.output = `Dumping staging database to ~/${backupFile}...`;
                    logger.info('Starting staging database backup', { file: backupFile });

                    const startTime = Date.now();
                    const cmd = stagingMagerunCommand(
                        `db:dump --stdout -n --no-tablespaces | gzip -1 > ~/${shellEscape(backupFile)}`,
                        config
                    );
                    const result = await sshStaging.execCommand(cmd);

                    if (result.code !== 0) {
                        throw UI.createError(
                            `Staging database backup failed\n` +
                            `Error: ${result.stderr || result.stdout}`
                        );
                    }

                    const elapsed = Math.round((Date.now() - startTime) / 1000);
                    task.title = `Staging database backed up → ~/${backupFile} (${elapsed}s)`;
                    logger.info('Staging backup complete', { file: backupFile, elapsed });
                }
            });
        }

        // ----------------------------------------------------------------
        // 3. Transfer dump from prod → staging via local pipe
        // ----------------------------------------------------------------
        this.stagingTasks.push({
            title: 'Transferring database dump to staging',
            task: async (_ctx: any, task: any): Promise<void> => {
                const logger = this.services.getLogger();

                const dumpFileName = config.databaseFileName;
                if (!dumpFileName) {
                    throw UI.createError(
                        'No dumpFileName found in config (config.databaseFileName).\n' +
                        '[TIP] Make sure DownloadTask ran successfully before StagingDeployTask.'
                    );
                }

                const prodDb = config.databases.databaseData;
                const stagingDb = config.databases.stagingDatabaseData;

                // Same server/user: file is already at ~/dumpFileName — no transfer needed
                if (prodDb.server === stagingDb.server && prodDb.username === stagingDb.username) {
                    task.title = `Dump already on staging server (same host as production)`;
                    logger.info('Skipping transfer — prod and staging share the same host/user', {
                        host: prodDb.server
                    });
                    return;
                }

                const prodFlags = this.buildSshFlags(prodDb, config.customConfig);
                const stagingFlags = this.buildSshFlags(stagingDb, config.customConfig);

                const prodUser = shellEscape(prodDb.username);
                const prodHost = shellEscape(prodDb.server);
                const stagingUser = shellEscape(stagingDb.username);
                const stagingHost = shellEscape(stagingDb.server);
                // Keep ~/ unquoted so the remote shell expands home dir
                const escapedFile = `~/${shellEscape(dumpFileName)}`;

                // Build: ssh [prod] "cat ~/file" | ssh [staging] "cat > ~/file"
                let prodSshCmd = `ssh ${prodFlags} ${prodUser}@${prodHost} "cat ${escapedFile}"`;
                let stagingSshCmd = `ssh ${stagingFlags} ${stagingUser}@${stagingHost} "cat > ${escapedFile}"`;

                // If password auth is needed, prefix with sshpass
                if (prodDb.password) {
                    prodSshCmd = `sshpass -p ${shellEscape(prodDb.password)} ${prodSshCmd}`;
                }
                if (stagingDb.password) {
                    stagingSshCmd = `sshpass -p ${shellEscape(stagingDb.password)} ${stagingSshCmd}`;
                }

                const pipeCommand = `${prodSshCmd} | ${stagingSshCmd}`;

                task.output = `Piping ${chalk.cyan(dumpFileName)} from prod to staging...`;
                logger.info('Starting prod→staging transfer', { file: dumpFileName });

                await new Promise<void>((resolve, reject) => {
                    const proc = spawn('sh', ['-c', pipeCommand]);

                    proc.stderr.on('data', (data: Buffer) => {
                        // ssh may emit progress or warnings to stderr — log but don't fail
                        logger.debug('Transfer stderr', { output: data.toString().trim() });
                    });

                    proc.on('close', (code: number) => {
                        if (code === 0) {
                            resolve();
                        } else {
                            reject(
                                UI.createError(
                                    `Transfer pipe failed with exit code ${code}\n` +
                                    `[TIP] Verify SSH keys/passwords are valid for both servers and that sshpass is installed if using password auth.`
                                )
                            );
                        }
                    });

                    proc.on('error', (err: Error) => {
                        reject(err);
                    });
                });

                task.title = `Transferred dump to staging (${dumpFileName})`;
                task.output = `✓ ${dumpFileName} transferred to staging home dir`;
                logger.info('Transfer complete', { file: dumpFileName });
            }
        });

        // ----------------------------------------------------------------
        // 4. Create DB on staging if needed
        // ----------------------------------------------------------------
        this.stagingTasks.push({
            title: 'Creating staging database (if needed)',
            task: async (_ctx: any, task: any): Promise<void> => {
                const logger = this.services.getLogger();
                task.output = 'Running magerun2 db:create on staging...';

                const cmd = stagingMagerunCommand('db:create -q', config);
                const result = await sshStaging.execCommand(cmd);

                // db:create returns non-zero if the DB already exists — that's fine
                if (result.code !== 0) {
                    const msg = (result.stderr || result.stdout || '').toLowerCase();
                    if (!msg.includes('already exists') && !msg.includes('exist')) {
                        logger.warn('db:create returned non-zero (may already exist)', {
                            code: result.code,
                            stderr: result.stderr
                        });
                    }
                }

                task.title = 'Staging database ready';
                logger.info('db:create on staging complete');
            }
        });

        // ----------------------------------------------------------------
        // 5. Import dump on staging
        // ----------------------------------------------------------------
        this.stagingTasks.push({
            title: 'Importing database on staging',
            task: async (_ctx: any, task: any): Promise<void> => {
                const logger = this.services.getLogger();
                const dumpFileName = config.databaseFileName;
                const isGzip = dumpFileName && dumpFileName.endsWith('.gz');

                // Keep ~/ outside quotes so the shell expands it; only escape the filename part
                let importCmd = `db:import ~/${shellEscape(dumpFileName)}`;
                if (isGzip) {
                    importCmd += ' --compression=gzip';
                } else {
                    importCmd += ' --optimize';
                }
                importCmd += ' --drop --force --skip-authorization-entry-creation';

                const fullCmd = stagingMagerunCommand(importCmd, config);

                task.output = `Importing ${chalk.cyan(dumpFileName)} on staging...`;
                logger.info('Starting staging database import', { file: dumpFileName, compressed: isGzip });

                const startTime = Date.now();
                const result = await sshStaging.execCommand(fullCmd);

                if (result.code !== 0) {
                    throw UI.createError(
                        `Database import on staging failed\n` +
                        `[TIP] Check that magerun2 can connect to the staging database\n` +
                        `Error: ${result.stderr || result.stdout}`
                    );
                }

                const elapsed = Math.round((Date.now() - startTime) / 1000);
                task.title = `Imported database on staging (${elapsed}s)`;
                logger.info('Staging database import complete', { elapsed });
            }
        });

        // ----------------------------------------------------------------
        // 5.5. Anonymize customer data on staging (when strip=anonymized)
        // Uses direct SQL via db:query so no Magento core bootstrap needed.
        // ----------------------------------------------------------------
        if (config.settings.strip === 'anonymized') {
            // Each entry: [display label, SQL statement]
            const anonymizationQueries: Array<[string, string]> = [
                [
                    'customer_entity',
                    `UPDATE customer_entity SET
                        email      = CONCAT(MD5(email), '@example.com'),
                        firstname  = CONCAT('First', entity_id),
                        lastname   = CONCAT('Last', entity_id)`
                ],
                [
                    'customer_address_entity',
                    `UPDATE customer_address_entity SET
                        firstname  = CONCAT('First', entity_id),
                        lastname   = CONCAT('Last', entity_id),
                        telephone  = '0000000000',
                        street     = CONCAT('Street ', entity_id),
                        city       = 'City',
                        postcode   = '00000'`
                ],
                [
                    'sales_order',
                    `UPDATE sales_order SET
                        customer_email      = CONCAT(MD5(IFNULL(customer_email, entity_id)), '@example.com'),
                        customer_firstname  = CONCAT('First', entity_id),
                        customer_lastname   = CONCAT('Last', entity_id)`
                ],
                [
                    'sales_order_address',
                    `UPDATE sales_order_address SET
                        firstname  = CONCAT('First', entity_id),
                        lastname   = CONCAT('Last', entity_id),
                        email      = CONCAT(MD5(IFNULL(email, entity_id)), '@example.com'),
                        telephone  = '0000000000',
                        street     = CONCAT('Street ', entity_id),
                        city       = 'City',
                        postcode   = '00000'`
                ],
                [
                    'quote',
                    `UPDATE quote SET
                        customer_email      = CONCAT(MD5(IFNULL(customer_email, entity_id)), '@example.com'),
                        customer_firstname  = CONCAT('First', entity_id),
                        customer_lastname   = CONCAT('Last', entity_id)`
                ],
                [
                    'quote_address',
                    `UPDATE quote_address SET
                        firstname  = CONCAT('First', address_id),
                        lastname   = CONCAT('Last', address_id),
                        email      = CONCAT(MD5(IFNULL(email, address_id)), '@example.com'),
                        telephone  = '0000000000',
                        street     = CONCAT('Street ', address_id),
                        city       = 'City',
                        postcode   = '00000'`
                ],
                [
                    'sales_order_grid',
                    `UPDATE sales_order_grid SET
                        billing_name   = CONCAT('First', entity_id, ' Last', entity_id),
                        shipping_name  = CONCAT('First', entity_id, ' Last', entity_id),
                        customer_email = CONCAT(MD5(IFNULL(customer_email, entity_id)), '@example.com')`
                ],
            ];

            this.stagingTasks.push({
                title: 'Anonymizing customer data on staging',
                task: async (_ctx: any, task: any): Promise<void> => {
                    const logger = this.services.getLogger();
                    logger.info('Starting SQL anonymization on staging');
                    const startTime = Date.now();

                    for (const [label, sql] of anonymizationQueries) {
                        task.output = `Anonymizing ${label}...`;
                        // Collapse whitespace and escape for shell single-quote wrapping
                        const normalised = sql.replace(/\s+/g, ' ').trim();
                        const cmd = stagingMagerunCommand(
                            `db:query ${shellEscape(normalised)}`,
                            config
                        );
                        const result = await sshStaging.execCommand(cmd);
                        if (result.code !== 0) {
                            throw UI.createError(
                                `Anonymization failed on table ${label}\n` +
                                `Error: ${result.stderr || result.stdout}`
                            );
                        }
                        logger.info(`Anonymized ${label}`);
                    }

                    const elapsed = Math.round((Date.now() - startTime) / 1000);
                    task.title = `Customer data anonymized on staging (${elapsed}s)`;
                    logger.info('SQL anonymization on staging complete', { elapsed });
                }
            });
        }

        // ----------------------------------------------------------------
        // 6. Update base URLs on staging (optional)
        // ----------------------------------------------------------------
        this.stagingTasks.push({
            title: 'Updating base URLs on staging',
            skip: () => {
                const stagingBaseUrl =
                    config.settings?.nonInteractiveOptions?.stagingBaseUrl ||
                    config.databases.stagingDatabaseData?.localProjectUrl;
                return !stagingBaseUrl;
            },
            task: async (_ctx: any, task: any): Promise<void> => {
                const logger = this.services.getLogger();

                const rawUrl =
                    config.settings?.nonInteractiveOptions?.stagingBaseUrl ||
                    config.databases.stagingDatabaseData?.localProjectUrl ||
                    '';

                // Ensure URL ends with trailing slash (Magento requirement)
                const baseUrl = rawUrl.endsWith('/') ? rawUrl : `${rawUrl}/`;

                task.output = `Setting base URLs to ${chalk.cyan(baseUrl)}...`;
                logger.info('Updating staging base URLs', { baseUrl });

                const setUnsecure = stagingMagerunCommand(
                    `config:set web/unsecure/base_url ${shellEscape(baseUrl)}`,
                    config
                );
                const setSecure = stagingMagerunCommand(
                    `config:set web/secure/base_url ${shellEscape(baseUrl)}`,
                    config
                );

                const unsecureResult = await sshStaging.execCommand(setUnsecure);
                if (unsecureResult.code !== 0) {
                    logger.warn('Failed to set web/unsecure/base_url', {
                        code: unsecureResult.code,
                        stderr: unsecureResult.stderr
                    });
                }

                const secureResult = await sshStaging.execCommand(setSecure);
                if (secureResult.code !== 0) {
                    logger.warn('Failed to set web/secure/base_url', {
                        code: secureResult.code,
                        stderr: secureResult.stderr
                    });
                }

                task.title = `Updated base URLs on staging (${baseUrl})`;
                logger.info('Staging base URLs updated', { baseUrl });
            }
        });

        // ----------------------------------------------------------------
        // 7. Cache flush on staging
        // ----------------------------------------------------------------
        this.stagingTasks.push({
            title: 'Flushing cache on staging',
            task: async (_ctx: any, task: any): Promise<void> => {
                const logger = this.services.getLogger();
                task.output = 'Running magerun2 cache:flush on staging...';

                const cmd = stagingMagerunCommand('cache:flush', config);
                const result = await sshStaging.execCommand(cmd);

                if (result.code !== 0) {
                    // Non-fatal — warn but don't abort
                    logger.warn('cache:flush on staging returned non-zero', {
                        code: result.code,
                        stderr: result.stderr
                    });
                    task.title = 'Cache flush on staging (warnings — check logs)';
                } else {
                    task.title = 'Flushed cache on staging';
                }

                logger.info('Staging cache:flush complete');
            }
        });

        // ----------------------------------------------------------------
        // 8. Cleanup — remove dump from staging (and attempt prod cleanup)
        // ----------------------------------------------------------------
        this.stagingTasks.push({
            title: 'Cleaning up dump files',
            task: async (_ctx: any, task: any): Promise<void> => {
                const logger = this.services.getLogger();
                const dumpFileName = config.databaseFileName;

                if (!dumpFileName) {
                    return;
                }

                // Remove from staging
                task.output = `Removing ${dumpFileName} from staging...`;
                await sshStaging.execCommand(`rm -f ~/${shellEscape(dumpFileName)}`);
                logger.info('Removed dump from staging', { file: dumpFileName });

                // Attempt to remove from prod (connection may already be closed by DownloadTask cleanup)
                if (sshProd && typeof sshProd.isConnected === 'function' && sshProd.isConnected()) {
                    task.output = `Removing ${dumpFileName} from prod...`;
                    try {
                        await sshProd.execCommand(`rm -f ~/${shellEscape(dumpFileName)}`);
                        logger.info('Removed dump from prod', { file: dumpFileName });
                    } catch (err) {
                        logger.warn('Could not remove dump from prod (connection may be closed)', {
                            file: dumpFileName
                        });
                    }
                }

                task.title = 'Cleaned up dump files';
            }
        });
    };
}

export default StagingDeployTask;
