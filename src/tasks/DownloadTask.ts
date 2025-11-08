/**
 * DownloadTask - Enhanced with connection pooling and progress tracking
 */
import {
    sshMagentoRootFolderMagerunCommand,
    sshMagentoRootFolderPhpCommand,
    sshNavigateToMagentoRootCommand,
    stripOutputString
} from '../utils/Console';
import { Listr } from 'listr2';
import { SSHConnectionPool, PerformanceMonitor } from '../utils/Performance';
import { UI } from '../utils/UI';
import { ServiceContainer } from '../core/ServiceContainer';
import { ProgressDisplay } from '../utils/ProgressDisplay';
import { EnhancedProgress } from '../utils/EnhancedProgress';
import staticConfigFile from '../../config/static-settings.json';
import configFile from '../../config/settings.json';
import fs from 'fs';
import chalk from 'chalk';

interface TaskItem {
    title: string;
    task: (ctx?: any, task?: any) => Promise<void | boolean>;
    skip?: string | (() => boolean);
}

class DownloadTask {
    private downloadTasks: TaskItem[] = [];
    private services: ServiceContainer;
    private useCompression: boolean = true; // Enable speed optimization

    constructor() {
        this.services = ServiceContainer.getInstance();
    }

    configure = async (list: any, config: any, ssh: any, sshSecondDatabase: any) => {
        await this.addTasks(list, config, ssh, sshSecondDatabase);
        return list;
    };

    /**
     * Create SSH configuration object with key file reading
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

        if (customConfig.sshKeyLocation && fs.existsSync(customConfig.sshKeyLocation)) {
            sshConfig.privateKey = fs.readFileSync(customConfig.sshKeyLocation, 'utf8');
            if (customConfig.sshPassphrase) {
                sshConfig.passphrase = customConfig.sshPassphrase;
            }
        }

        return sshConfig;
    }

    /**
     * Connect to SSH with connection pooling
     */
    private async connectSSH(ssh: any, config: any, isSecondary: boolean = false): Promise<void> {
        const databaseConfig = isSecondary
            ? config.databases.databaseDataSecond
            : config.databases.databaseData;

        const sshConfig = this.createSSHConfig(databaseConfig, config.customConfig);
        const host = databaseConfig.server;

        try {
            await SSHConnectionPool.getConnection(host, sshConfig, async () => {
                await ssh.connect(sshConfig);
                return ssh;
            });
        } catch (error) {
            const err = error as Error;
            throw new Error(
                `Failed to connect to ${host}\n` +
                `💡 Check your SSH credentials and key format\n` +
                `Error: ${err.message}`
            );
        }
    }

    addTasks = async (list: any, config: any, ssh: any, sshSecondDatabase: any) => {
        list.add({
            title: `Downloading from server (${config.databases.databaseData.username} | ${config.databases.databaseType})`,
            task: (ctx: any, task: any): Listr => task.newListr(this.downloadTasks)
        });

        this.downloadTasks.push({
            title: 'Connecting to server through SSH ⚡',
            task: async (ctx: any, task: any): Promise<void> => {
                PerformanceMonitor.start('ssh-connection');
                const logger = this.services.getLogger();
                
                task.output = EnhancedProgress.step(1, 6, 'Establishing SSH connection...');
                logger.info('Connecting to SSH', { host: config.databases.databaseData.server });
                
                await this.connectSSH(ssh, config, false);
                task.output = '✓ Primary SSH connection established';

                if (config.settings.syncDatabases === 'yes') {
                    task.output = EnhancedProgress.step(2, 6, 'Connecting to secondary database...');
                    await this.connectSSH(sshSecondDatabase, config, true);
                    task.output = '✓ Both SSH connections established';
                }

                const duration = PerformanceMonitor.end('ssh-connection');
                task.title = `✓ Connected to server through SSH (${ProgressDisplay.formatDuration(duration)})`;
            }
        });

        this.downloadTasks.push({
            title: 'Retrieving server settings',
            task: async (ctx: any, task: any): Promise<void> => {
                PerformanceMonitor.start('server-settings');
                const logger = this.services.getLogger();
                
                task.output = EnhancedProgress.step(2, 6, 'Detecting Magento version...');

                await ssh
                    .execCommand(
                        sshNavigateToMagentoRootCommand(
                            'test -e vendor/magento && echo 2 || echo 1; pwd; which php;',
                            config
                        )
                    )
                    .then((result: any) => {
                        if (result) {
                            let string = stripOutputString(result.stdout);
                            let serverValues = string.split('\n');
                            config.serverVariables.magentoVersion = parseInt(serverValues[0]);
                            config.serverVariables.magentoRoot = serverValues[1];
                            config.serverVariables.externalPhpPath = serverValues[2];
                            
                            task.output = `✓ Detected Magento ${config.serverVariables.magentoVersion}`;
                            logger.info('Server settings retrieved', { 
                                magentoVersion: config.serverVariables.magentoVersion,
                                root: config.serverVariables.magentoRoot
                            });
                        }
                    });

                if (
                    config.databases.databaseData.externalPhpPath &&
                    config.databases.databaseData.externalPhpPath.length > 0
                ) {
                    config.serverVariables.externalPhpPath = config.databases.databaseData.externalPhpPath;
                }

                config.serverVariables.magerunFile = `n98-magerun2-${config.requirements.magerun2Version}.phar`;

                if (config.settings.syncDatabases === 'yes') {
                    if (
                        config.databases.databaseDataSecond.externalPhpPath &&
                        config.databases.databaseDataSecond.externalPhpPath.length > 0
                    ) {
                        config.serverVariables.secondDatabaseExternalPhpPath =
                            config.databases.databaseDataSecond.externalPhpPath;
                    }
                }

                if (config.serverVariables.magentoVersion === 1) {
                    config.serverVariables.magerunFile = 'n98-magerun-1.98.0.phar';
                }

                const duration = PerformanceMonitor.end('server-settings');
                task.title = `✓ Retrieved server settings (${ProgressDisplay.formatDuration(duration)})`;
            }
        });

        this.downloadTasks.push({
            title: 'Downloading Magerun to server',
            task: async (ctx: any, task: any): Promise<void> => {
                PerformanceMonitor.start('magerun-download');
                const logger = this.services.getLogger();
                
                task.output = EnhancedProgress.step(3, 6, 'Checking if Magerun exists...');

                let magerunExists = await ssh
                    .execCommand(
                        sshNavigateToMagentoRootCommand(
                            'test -e ' + config.serverVariables.magerunFile + ' && echo "EXISTS"',
                            config
                        )
                    )
                    .then(function (result: any) {
                        let string = stripOutputString(result.stdout);
                        return string.includes('EXISTS');
                    });

                if (!magerunExists) {
                    task.output = '⚡ Uploading Magerun (0%)...';
                    logger.info('Uploading Magerun', { file: config.serverVariables.magerunFile });
                    
                    await ssh.putFile(
                        `${__dirname}/../../files/${config.serverVariables.magerunFile}`,
                        `${config.serverVariables.magentoRoot}/${config.serverVariables.magerunFile}`
                    );
                    
                    task.output = '✓ Magerun uploaded (100%)';
                } else {
                    logger.info('Magerun already exists', { file: config.serverVariables.magerunFile });
                    task.skip('Magerun already exists on server');
                }

                const duration = PerformanceMonitor.end('magerun-download');
                if (!magerunExists) {
                    task.title = `✓ Downloaded Magerun to server (${ProgressDisplay.formatDuration(duration)})`;
                }
            }
        });

        this.downloadTasks.push({
            title: 'Retrieving database name from server',
            task: async (ctx: any, task: any): Promise<void> => {
                const logger = this.services.getLogger();
                task.output = EnhancedProgress.step(4, 6, 'Querying database info...');
                await ssh
                    .execCommand(
                        sshMagentoRootFolderMagerunCommand('db:info --format=json', config)
                    )
                    .then((result: any) => {
                        if (result && result.stdout) {
                            const output = stripOutputString(result.stdout);
                            
                            try {
                                let jsonResult = JSON.parse(output);
                                
                                for (const key in jsonResult) {
                                    if (jsonResult[key].Name && jsonResult[key].Name.toLowerCase() === 'dbname') {
                                        config.serverVariables.databaseName = jsonResult[key].Value;
                                        break;
                                    }
                                }

                                if (config.serverVariables.magentoVersion === 1) {
                                    config.serverVariables.databaseName = jsonResult[3]?.Value;
                                }
                                
                                task.output = `✓ Found database: ${config.serverVariables.databaseName}`;
                                logger.info('Database name retrieved', { 
                                    database: config.serverVariables.databaseName 
                                });
                            } catch (e) {
                                throw new Error(
                                    `Could not retrieve database name from server.\n` +
                                    `Magerun output: ${output}\n` +
                                    `💡 Check if Magerun can connect to the database on the server`
                                );
                            }
                        }
                        
                        if (!config.serverVariables.databaseName) {
                            throw new Error(
                                `Database name could not be determined.\n` +
                                `💡 Check server Magento configuration and database connectivity`
                            );
                        }
                    });
            }
        });

        if (config.settings.syncTypes && config.settings.syncTypes.includes('Magento database')) {
            const stripType = config.settings.strip || 'full';
            this.downloadTasks.push({
                title: `Dumping Magento database and moving it to server root (${stripType})`,
                task: async (ctx: any, task: any): Promise<void> => {
                    PerformanceMonitor.start('database-dump');
                    const logger = this.services.getLogger();
                    
                    task.output = EnhancedProgress.step(5, 6, `Creating compressed ${stripType} database dump...`);

                    let dumpCommand: string;
                    const databaseFileName = `${config.serverVariables.databaseName}.sql.gz`;
                    
                    // Use Magerun's built-in compression (gzip) - typically 5-10x smaller!
                    if (config.settings.strip === 'keep customer data') {
                        const keepCustomerOptions = (staticConfigFile as any).settings?.databaseStripKeepCustomerData || '';
                        dumpCommand = `db:dump --compression=gzip -n --no-tablespaces --strip="${keepCustomerOptions}" ${databaseFileName}`;
                    } else if (config.settings.strip === 'full and human readable') {
                        const fullStripOptions = (staticConfigFile as any).settings?.databaseStripDevelopment || '';
                        if (fullStripOptions) {
                            dumpCommand = `db:dump --compression=gzip -n --no-tablespaces --human-readable --strip="${fullStripOptions}" ${databaseFileName}`;
                        } else {
                            dumpCommand = `db:dump --compression=gzip -n --no-tablespaces --human-readable ${databaseFileName}`;
                        }
                    } else if (config.settings.strip === 'full') {
                        const fullStripOptions = (staticConfigFile as any).settings?.databaseStripDevelopment || '';
                        if (fullStripOptions) {
                            dumpCommand = `db:dump --compression=gzip -n --no-tablespaces --strip="${fullStripOptions}" ${databaseFileName}`;
                        } else {
                            dumpCommand = `db:dump --compression=gzip -n --no-tablespaces ${databaseFileName}`;
                        }
                    } else {
                        const developmentStripOptions = (staticConfigFile as any).settings?.databaseStripDevelopment || '';
                        dumpCommand = `db:dump --compression=gzip -n --no-tablespaces --strip="${developmentStripOptions}" ${databaseFileName}`;
                    }

                    const fullCommand = sshMagentoRootFolderMagerunCommand(
                        `${dumpCommand}; mv ${databaseFileName} ~`,
                        config
                    );

                    task.output = '⚡ Dumping database (this may take a minute)...';
                    logger.info('Starting database dump', { 
                        database: config.serverVariables.databaseName,
                        stripType 
                    });

                    await ssh.execCommand(fullCommand).then(function (result: any) {
                        if (result.code && result.code !== 0) {
                            throw new Error(
                                `Database dump failed\n💡 Check database permissions and disk space\nError: ${result.stderr}`
                            );
                        }
                        task.output = '✓ Database dump completed';
                    });

                    const duration = PerformanceMonitor.end('database-dump');
                    logger.info('Database dump complete', { duration });
                    task.title = `✓ Dumped database (${ProgressDisplay.formatDuration(duration)})`;
                }
            });

            this.downloadTasks.push({
                title: 'Downloading Magento database to localhost',
                task: async (ctx: any, task: any): Promise<void> => {
                    PerformanceMonitor.start('database-download');
                    const logger = this.services.getLogger();
                    EnhancedProgress.resetDownload();

                    const databaseUsername = config.databases.databaseData.username;
                    const databaseServer = config.databases.databaseData.server;
                    const databasePort = config.databases.databaseData.port;
                    const databaseFileName = `${config.serverVariables.databaseName}.sql.gz`;
                    const source = `~/${databaseFileName}`;
                    const destination = config.customConfig.localDatabaseFolderLocation;

                    // ⚡ SPEED OPTIMIZED: Add compression to rsync
                    let sshCommand = databasePort 
                        ? `ssh -p ${databasePort} -o StrictHostKeyChecking=no -o Compression=yes`
                        : `ssh -o StrictHostKeyChecking=no -o Compression=yes`;

                    if (config.customConfig.sshKeyLocation) {
                        sshCommand = `${sshCommand} -i ${config.customConfig.sshKeyLocation}`;
                    }

                    // Use rsync with compression flag for 20-30% faster transfers
                    let rsyncCommand = `rsync -avz --compress-level=6 --progress -e "${sshCommand}" ${databaseUsername}@${databaseServer}:${source} ${destination}`;

                    if (config.databases.databaseData.password) {
                        rsyncCommand = `sshpass -p "${config.databases.databaseData.password}" ` + rsyncCommand;
                    }

                    logger.info('Starting compressed download', { 
                        compression: this.useCompression,
                        source: `${databaseServer}:${source}`
                    });

                    task.output = '⚡ Initializing download...';

                    let rsync = require('child_process').exec(rsyncCommand);

                    let lastUpdate = Date.now();
                    let startTime = Date.now();
                    let bytesTransferred = 0;
                    let lastBytes = 0;
                    let totalBytes = 0;

                    // Capture both stdout and stderr (rsync sends progress to stderr on some systems)
                    const handleRsyncData = function (data: any) {
                        const dataStr = data.toString();
                        const now = Date.now();
                        
                        // Simple percentage match - rsync always shows X%
                        const percentMatch = dataStr.match(/(\d+)%/);
                        
                        if (percentMatch) {
                            const percentage = parseInt(percentMatch[1]);
                            
                            // Only update display every 500ms for stability
                            if (now - lastUpdate > 500) {
                                const progressBar = EnhancedProgress.createProgressBar(percentage, 20);
                                
                                // Try to extract bytes and speed from rsync output
                                const bytesMatch = dataStr.match(/([\d,]+)\s+\d+%/);
                                const speedMatch = dataStr.match(/([\d.]+)(MB|KB|GB)\/s/);
                                
                                let displayText = `${progressBar} ${chalk.bold.cyan(percentage + '%')}`;
                                
                                if (bytesMatch) {
                                    const bytes = parseInt(bytesMatch[1].replace(/,/g, ''));
                                    bytesTransferred = bytes;
                                    displayText += ` ${chalk.gray(ProgressDisplay.formatBytes(bytes))}`;
                                }
                                
                                if (speedMatch) {
                                    const speedValue = parseFloat(speedMatch[1]);
                                    const unit = speedMatch[2];
                                    displayText += ` ${chalk.green('↓')} ${chalk.cyan(speedValue + ' ' + unit + '/s')}`;
                                }
                                
                                displayText += ` ${chalk.yellow('⚡ compressed')}`;
                                
                                task.output = displayText;
                                lastUpdate = now;
                            }
                        }
                    };

                    rsync.stdout.on('data', handleRsyncData);
                    rsync.stderr.on('data', handleRsyncData);

                    await new Promise((resolve, reject) => {
                        rsync.on('exit', function (code: any) {
                            if (code !== 0) {
                                reject(
                                    new Error(
                                        `Download failed with code ${code}\n💡 Check SSH connection and file permissions`
                                    )
                                );
                            } else {
                                resolve(null);
                            }
                        });
                    });

                    const duration = PerformanceMonitor.end('database-download');
                    const downloadedFile = `${config.customConfig.localDatabaseFolderLocation}/${config.serverVariables.databaseName}.sql`;
                    const fileSize = fs.existsSync(downloadedFile)
                        ? fs.statSync(downloadedFile).size
                        : 0;
                    const sizeMB = (fileSize / (1024 * 1024)).toFixed(2);
                    const speedMBps = (parseFloat(sizeMB) / (duration / 1000)).toFixed(2);
                    
                    task.title = `✓ Downloaded database (${sizeMB}MB in ${UI.duration(duration)} @ ${speedMBps} MB/s)`;
                    
                    logger.info('Download complete with compression', { 
                        size: `${sizeMB}MB`,
                        duration,
                        speed: `${speedMBps} MB/s`
                    });
                    
                    config.finalMessages.magentoDatabaseLocation = downloadedFile;
                }
            });
        }

        this.downloadTasks.push({
            title: 'Cleaning up and closing SSH connection',
            task: async (): Promise<void> => {
                PerformanceMonitor.start('cleanup');

                const databaseFileName = `${config.serverVariables.databaseName}.sql`;
                await ssh.execCommand(`rm -f ~/${databaseFileName}`);

                if (config.settings.syncDatabases === 'yes') {
                    if (sshSecondDatabase && typeof sshSecondDatabase.dispose === 'function') {
                        await sshSecondDatabase.dispose().catch(() => {});
                    }
                }

                PerformanceMonitor.end('cleanup');
            }
        });
    };
}

export default DownloadTask;
