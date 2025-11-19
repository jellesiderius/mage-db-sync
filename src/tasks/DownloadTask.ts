/**
 * DownloadTask - Enhanced with connection pooling and progress tracking
 */
import {
    sshMagentoRootFolderMagerunCommand,
    sshNavigateToMagentoRootCommand,
    stripOutputString,
    shellEscape
} from '../utils/Console';
import { Listr } from 'listr2';
import { SSHConnectionPool, PerformanceMonitor } from '../utils/Performance';
import { UI } from '../utils/UI';
import { ServiceContainer } from '../core/ServiceContainer';
import { ProgressDisplay } from '../utils/ProgressDisplay';
import { EnhancedProgress } from '../utils/EnhancedProgress';
import fs from 'fs';
import chalk from 'chalk';

interface TaskItem {
    title: string;
    /* eslint-disable @typescript-eslint/no-unused-vars, no-unused-vars */
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
     * Detect gzip compression available on remote server
     * Using gzip for maximum compatibility and stability
     */
    private async detectCompression(ssh: any): Promise<{ type: 'gzip' | 'none'; level: string; extension: string }> {
        const logger = this.services.getLogger();

        // Check for gzip
        try {
            const gzipCheck = await ssh.execCommand('which gzip');
            if (gzipCheck.code === 0) {
                logger.info('Using gzip compression', { level: '-6' });
                return { type: 'gzip', level: '-6', extension: '.gz' };
            }
        } catch (_e) {
            // gzip not available
        }

        // No compression available
        logger.warn('Gzip not available on server, using uncompressed SQL');
        return { type: 'none', level: '', extension: '' };
    }

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
        const databaseConfig = config.databases.databaseData;

        const sshConfig = this.createSSHConfig(databaseConfig, config.customConfig);
        const host = databaseConfig.server;

        try {
            await SSHConnectionPool.getConnection(host, sshConfig, async () => {
                await ssh.connect(sshConfig);

                // Add error handler to prevent unhandled ECONNRESET errors
                if (ssh && ssh.connection) {
                    const logger = this.services.getLogger();
                    ssh.connection.on('error', (err: Error) => {
                        // Catch and log connection errors to prevent process crash
                        if (err.message && err.message.includes('ECONNRESET')) {
                            logger.debug('SSH connection reset', { host });
                        } else {
                            logger.error('SSH connection error', err, { host });
                        }
                    });
                }

                return ssh;
            });
        } catch (error) {
            const err = error as Error;
            throw UI.createError(
                `Failed to connect to ${host}\n` +
                `[TIP] Check your SSH credentials and key format\n` +
                `Error: ${err.message}`
            );
        }
    }

    addTasks = async (list: any, config: any, ssh: any, _sshSecondDatabase: any) => {
        list.add({
            title: `Downloading from server (${config.databases.databaseData.username} | ${config.databases.databaseType})`,
            task: (ctx: any, task: any): Listr => task.newListr(this.downloadTasks)
        });

        this.downloadTasks.push({
            title: 'Connecting to server through SSH',
            task: async (ctx: any, task: any): Promise<void> => {
                PerformanceMonitor.start('ssh-connection');
                const logger = this.services.getLogger();

                task.output = EnhancedProgress.step(1, 6, 'Establishing SSH connection...');
                logger.info('Connecting to SSH', { host: config.databases.databaseData.server });

                await this.connectSSH(ssh, config, false);
                task.output = 'SSH connection established';

                const _duration = PerformanceMonitor.end('ssh-connection');
                task.title = `Connected to server through SSH`;
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
                            const string = stripOutputString(result.stdout);
                            const serverValues = string.split('\n');
                            config.serverVariables.magentoVersion = parseInt(serverValues[0]);
                            config.serverVariables.magentoRoot = serverValues[1];
                            config.serverVariables.externalPhpPath = serverValues[2];

                            task.output = `Detected Magento ${config.serverVariables.magentoVersion}`;
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


                if (config.serverVariables.magentoVersion === 1) {
                    config.serverVariables.magerunFile = 'n98-magerun-1.98.0.phar';
                }

                const _duration = PerformanceMonitor.end('server-settings');
                task.title = `Retrieved server settings`;
            }
        });

        this.downloadTasks.push({
            title: 'Downloading Magerun to server',
            task: async (ctx: any, task: any): Promise<void> => {
                PerformanceMonitor.start('magerun-download');
                const logger = this.services.getLogger();

                task.output = EnhancedProgress.step(3, 6, 'Checking if Magerun exists...');

                const magerunExists = await ssh
                    .execCommand(
                        sshNavigateToMagentoRootCommand(
                            'test -e ' + config.serverVariables.magerunFile + ' && echo "EXISTS"',
                            config
                        )
                    )
                    .then(function (result: any) {
                        const string = stripOutputString(result.stdout);
                        return string.includes('EXISTS');
                    });

                if (!magerunExists) {
                    task.output = 'Uploading Magerun (0%)...';
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

                const _duration = PerformanceMonitor.end('magerun-download');
                if (!magerunExists) {
                    task.title = `Downloaded Magerun to server`;
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
                                const jsonResult = JSON.parse(output);

                                for (const key in jsonResult) {
                                    if (jsonResult[key].Name && jsonResult[key].Name.toLowerCase() === 'dbname') {
                                        config.serverVariables.databaseName = jsonResult[key].Value;
                                        break;
                                    }
                                }

                                if (config.serverVariables.magentoVersion === 1) {
                                    config.serverVariables.databaseName = jsonResult[3]?.Value;
                                }

                                task.output = `Found database: ${config.serverVariables.databaseName}`;
                                logger.info('Database name retrieved', {
                                    database: config.serverVariables.databaseName
                                });
                            } catch (_e) {
                                throw UI.createError(
                                    `Could not retrieve database name from server.\n` +
                                    `Magerun output: ${output}\n` +
                                    `[TIP] Check if Magerun can connect to the database on the server`
                                );
                            }
                        }

                        if (!config.serverVariables.databaseName) {
                            throw UI.createError(
                                `Database name could not be determined.\n` +
                                `[TIP] Check server Magento configuration and database connectivity`
                            );
                        }
                    });
            }
        });

        if (config.settings.syncTypes && config.settings.syncTypes.includes('Magento database')) {
            const stripType = config.settings.strip || 'full';

            // Check if project-specific strip tables exist and import is enabled
            const projectConfig = this.services.getConfig().getProjectConfig();
            const hasProjectStripTables = projectConfig?.databaseStripDevelopment ? true : false;
            const isImporting = config.settings.import === 'yes';

            // Build title with custom strip info if applicable
            let taskTitle = `Dumping Magento database and moving it to server root (${stripType})`;
            if (stripType === 'custom' && config.settings.stripOptions) {
                const keepOptions = config.settings.stripOptions.join(', ');
                taskTitle = `Dumping Magento database and moving it to server root (custom: keeping ${keepOptions})`;
            } else if ((stripType === 'stripped' || stripType === 'keep customer data') && hasProjectStripTables && isImporting) {
                taskTitle = `Dumping Magento database and moving it to server root (${stripType} + project tables)`;
            }

            this.downloadTasks.push({
                title: taskTitle,
                task: async (ctx: any, task: any): Promise<void> => {
                    PerformanceMonitor.start('database-dump');
                    const logger = this.services.getLogger();

                    // Detect gzip compression available on remote server
                    task.output = EnhancedProgress.step(5, 6, `Detecting compression...`);
                    const compression = await this.detectCompression(ssh);

                    // Build output message with custom strip info if applicable
                    let dumpMessage = `Creating ${compression.type === 'none' ? 'uncompressed' : compression.type} ${stripType} database dump...`;
                    if (stripType === 'custom' && config.settings.stripOptions) {
                        const keepOptions = config.settings.stripOptions.join(', ');
                        dumpMessage = `Creating ${compression.type === 'none' ? 'uncompressed' : compression.type} custom database dump (keeping ${keepOptions})...`;
                    } else if ((stripType === 'stripped' || stripType === 'keep customer data') && hasProjectStripTables && isImporting) {
                        dumpMessage = `Creating ${compression.type === 'none' ? 'uncompressed' : compression.type} ${stripType} database dump (+ project tables)...`;
                    }
                    task.output = EnhancedProgress.step(5, 6, dumpMessage);

                    let dumpCommand: string;
                    const databaseFileName = `${config.serverVariables.databaseName}.sql${compression.extension}`;

                    // Store compression info for later use
                    config.compressionInfo = compression;

                    // Build dump command with best available compression
                    let stripOptions = '';
                    let humanReadable = '';

                    if (config.settings.strip === 'custom') {
                        // Build custom strip options based on user selection
                        // Uses official magerun2 table groups: https://github.com/netz98/n98-magerun2
                        const customStripParts: string[] = [];
                        const keepOptions = config.settings.stripOptions || [];

                        // Always strip these for development (safe to remove)
                        customStripParts.push(
                            '@log',              // Log tables
                            '@sessions',         // Session tables
                            '@temp',             // Temporary indexer tables
                            '@aggregated',       // Aggregated tables
                            '@replica',          // Replica tables
                            '@newrelic_reporting' // New Relic tables
                        );

                        // Strip based on what user wants to KEEP (unchecked = strip)
                        if (!keepOptions.includes('customers')) {
                            customStripParts.push('@customers');
                        }

                        if (!keepOptions.includes('admin')) {
                            customStripParts.push('@admin', '@oauth', '@2fa');
                        }

                        if (!keepOptions.includes('sales')) {
                            customStripParts.push('@sales');
                        }

                        if (!keepOptions.includes('quotes')) {
                            customStripParts.push('@quotes');
                        }

                        if (!keepOptions.includes('search')) {
                            customStripParts.push('@search', '@idx');
                        }

                        if (!keepOptions.includes('dotmailer')) {
                            customStripParts.push('@dotmailer', '@mailchimp');
                        }

                        // Note: We don't strip config even if unchecked, as it would break the database
                        // Configuration data (core_config_data) is not in any strip group - it's always kept
                        if (!keepOptions.includes('config')) {
                            logger.warn('Configuration settings are always kept as they are required for Magento to function');
                        }

                        const customStripString = customStripParts.join(' ');
                        stripOptions = customStripString ? `--strip="${customStripString}"` : '';

                        logger.info('Using custom strip configuration', {
                            keepOptions,
                            stripGroups: customStripParts,
                            stripCommand: customStripString
                        });
                    } else if (config.settings.strip === 'keep customer data') {
                        const staticSettings = this.services.getConfig().getStaticSettings();
                        const keepCustomerOptions = staticSettings.settings?.databaseStripKeepCustomerData || '';

                        // Add project-specific strip tables if available and importing
                        const projectConfig = this.services.getConfig().getProjectConfig();
                        const projectStripTables = (config.settings.import === 'yes' && projectConfig?.databaseStripDevelopment)
                            ? projectConfig.databaseStripDevelopment
                            : '';

                        const combinedStripOptions = [keepCustomerOptions, projectStripTables]
                            .filter(option => option.trim())
                            .join(' ');

                        stripOptions = combinedStripOptions ? `--strip="${combinedStripOptions}"` : '';

                        if (projectStripTables) {
                            logger.info('Added project-specific strip tables for keep customer data mode', {
                                projectTables: projectStripTables
                            });
                        }
                    } else if (config.settings.strip === 'full and human readable') {
                        // FULL dump with human-readable format - NO stripping
                        stripOptions = '';
                        humanReadable = '--human-readable';
                        logger.info('Using full database dump with human-readable format (no stripping)');
                    } else if (config.settings.strip === 'full') {
                        // FULL dump - NO stripping
                        stripOptions = '';
                        logger.info('Using full database dump (no stripping)');
                    } else {
                        // Default: apply development strip options
                        const staticSettings = this.services.getConfig().getStaticSettings();
                        const developmentStripOptions = staticSettings.settings?.databaseStripDevelopment || '';

                        // Add project-specific strip tables if available and importing
                        const projectConfig = this.services.getConfig().getProjectConfig();
                        const projectStripTables = (config.settings.import === 'yes' && projectConfig?.databaseStripDevelopment)
                            ? projectConfig.databaseStripDevelopment
                            : '';

                        const combinedStripOptions = [developmentStripOptions, projectStripTables]
                            .filter(option => option.trim())
                            .join(' ');

                        stripOptions = combinedStripOptions ? `--strip="${combinedStripOptions}"` : '';

                        if (projectStripTables) {
                            logger.info('Added project-specific strip tables for development mode', {
                                projectTables: projectStripTables
                            });
                        }
                    }

                    // Escape filename for shell usage
                    const escapedFileName = shellEscape(databaseFileName);

                    // Build compression command based on what's available
                    if (compression.type === 'gzip') {
                        dumpCommand = `db:dump --stdout -n --no-tablespaces ${humanReadable} ${stripOptions} | gzip ${compression.level} > ${escapedFileName}`;
                    } else {
                        // No compression - just dump to file
                        dumpCommand = `db:dump --stdout -n --no-tablespaces ${humanReadable} ${stripOptions} > ${escapedFileName}`;
                    }

                    logger.info('Using compression for database dump', {
                        compression: compression.type,
                        level: compression.level,
                        file: databaseFileName,
                        stripType
                    });

                    const fullCommand = sshMagentoRootFolderMagerunCommand(
                        `${dumpCommand}; mv ${escapedFileName} ~`,
                        config
                    );

                    task.output = 'Starting database dump...';
                    logger.info('Starting database dump', {
                        database: config.serverVariables.databaseName,
                        stripType
                    });

                    // Start the dump command (non-blocking)
                    const dumpPromise = ssh.execCommand(fullCommand);

                    // Monitor file size in real-time
                    const startTime = Date.now();
                    let lastSize = 0;
                    let lastSizeTime = Date.now();

                    const sizeCheckInterval = setInterval(async () => {
                        try {
                            // Check file size on server (in Magento root first, then home)
                            const sizeCommand = sshMagentoRootFolderMagerunCommand(
                                `stat -f%z ${escapedFileName} 2>/dev/null || stat -c%s ${escapedFileName} 2>/dev/null || echo "0"`,
                                config
                            );

                            const sizeResult = await ssh.execCommand(sizeCommand);
                            const currentSize = parseInt(sizeResult.stdout.trim() || '0');

                            if (currentSize > 0) {
                                const elapsed = Math.floor((Date.now() - startTime) / 1000);
                                const elapsedMinutes = Math.floor(elapsed / 60);
                                const elapsedSeconds = elapsed % 60;
                                const timeStr = elapsedMinutes > 0
                                    ? `${elapsedMinutes}m ${elapsedSeconds}s`
                                    : `${elapsedSeconds}s`;

                                // Calculate speed since last check
                                const timeDiff = (Date.now() - lastSizeTime) / 1000;
                                const sizeDiff = currentSize - lastSize;
                                const speed = timeDiff > 0 ? sizeDiff / timeDiff : 0;

                                lastSize = currentSize;
                                lastSizeTime = Date.now();

                                const sizeStr = ProgressDisplay.formatBytes(currentSize);
                                const speedStr = speed > 0 ? ` ${chalk.cyan('~' + ProgressDisplay.formatSpeed(speed))}` : '';

                                task.output = `Dumping database... ${chalk.bold.cyan(sizeStr)}${speedStr} ${chalk.gray(`(${timeStr} elapsed)`)}`;
                            }
                        } catch (err) {
                            // Ignore errors during size check (file might not exist yet)
                        }
                    }, 2000); // Check every 2 seconds

                    await dumpPromise.then(function (result: any) {
                        clearInterval(sizeCheckInterval);

                        if (result.code && result.code !== 0) {
                            throw UI.createError(
                                `Database dump failed\n[TIP] Check database permissions and disk space\nError: ${result.stderr}`
                            );
                        }

                        const elapsed = Math.floor((Date.now() - startTime) / 1000);
                        const finalSizeStr = lastSize > 0 ? ` (${ProgressDisplay.formatBytes(lastSize)})` : '';
                        task.output = `✓ Database dump completed${finalSizeStr} in ${elapsed}s`;
                    }).catch((err: Error) => {
                        clearInterval(sizeCheckInterval);
                        throw err;
                    });

                    const duration = PerformanceMonitor.end('database-dump');
                    logger.info('Database dump complete', { duration, finalSize: lastSize });
                    task.title = `Dumped database`;
                }
            });

            this.downloadTasks.push({
                title: 'Downloading Magento database to localhost',
                task: async (ctx: any, task: any): Promise<void> => {
                    PerformanceMonitor.start('database-download');
                    const logger = this.services.getLogger();
                    EnhancedProgress.resetDownload();

                    const databaseUsername = shellEscape(config.databases.databaseData.username);
                    const databaseServer = shellEscape(config.databases.databaseData.server);
                    const databasePort = config.databases.databaseData.port;

                    // Use the compression info determined during dump
                    const compression = config.compressionInfo || { type: 'none', extension: '' };
                    const databaseFileName = `${config.serverVariables.databaseName}.sql${compression.extension}`;
                    const source = `~/${databaseFileName}`;
                    const destination = config.customConfig.localDatabaseFolderLocation;
                    const escapedSource = shellEscape(source);
                    const escapedDestination = shellEscape(destination);

                    let sshCommand = databasePort
                        ? `ssh -p ${databasePort} -o StrictHostKeyChecking=no -o Compression=yes`
                        : `ssh -o StrictHostKeyChecking=no -o Compression=yes`;

                    if (config.customConfig.sshKeyLocation) {
                        const escapedKeyLocation = shellEscape(config.customConfig.sshKeyLocation);
                        sshCommand = `${sshCommand} -i ${escapedKeyLocation}`;
                    }

                    // Use rsync with compression flag for 20-30% faster transfers
                    let rsyncCommand = `rsync -avz --compress-level=6 --progress -e "${sshCommand}" ${databaseUsername}@${databaseServer}:${escapedSource} ${escapedDestination}`;

                    if (config.databases.databaseData.password) {
                        const escapedPassword = shellEscape(config.databases.databaseData.password);
                        rsyncCommand = `sshpass -p ${escapedPassword} ` + rsyncCommand;
                    }

                    logger.info('Starting compressed download', {
                        compression: this.useCompression,
                        source: `${databaseServer}:${source}`
                    });

                    task.output = 'Initializing download...';

                    const rsync = require('child_process').exec(rsyncCommand);

                    let lastUpdate = Date.now();
                    const _startTime = Date.now();
                    let bytesTransferred = 0;
                    const _lastBytes = 0;
                    const _totalBytes = 0;

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
                                    displayText += ` ${chalk.green('[DOWN]')} ${chalk.cyan(speedValue + ' ' + unit + '/s')}`;
                                }

                                // Show compression type
                                if (compression.type !== 'none') {
                                    displayText += ` ${chalk.yellow(`${compression.type}`)}`;
                                }

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
                                    UI.createError(
                                        `Download failed with code ${code}\n[TIP] Check SSH connection and file permissions`
                                    )
                                );
                            } else {
                                resolve(null);
                            }
                        });
                    });

                    const duration = PerformanceMonitor.end('database-download');

                    // Use actual downloaded filename with compression extension
                    const downloadedFile = `${config.customConfig.localDatabaseFolderLocation}/${databaseFileName}`;
                    const fileSize = fs.existsSync(downloadedFile)
                        ? fs.statSync(downloadedFile).size
                        : 0;
                    const sizeMB = (fileSize / (1024 * 1024)).toFixed(2);
                    const speedMBps = (parseFloat(sizeMB) / (duration / 1000)).toFixed(2);

                    task.title = `Downloaded database (${sizeMB}MB in ${UI.duration(duration)} @ ${speedMBps} MB/s)`;

                    logger.info('Download complete with compression', {
                        size: `${sizeMB}MB`,
                        duration,
                        speed: `${speedMBps} MB/s`,
                        compression: compression.type
                    });

                    config.finalMessages.magentoDatabaseLocation = downloadedFile;
                }
            });
        }

        // WordPress database download - only runs if wordpressDownload is enabled
        if (config.databases.databaseData.wordpress && config.settings.wordpressDownload === 'yes') {
            // First, retrieve WordPress config from server
            this.downloadTasks.push({
                title: 'Reading WordPress configuration from server',
                task: async (ctx: any, task: any): Promise<void> => {
                    const logger = this.services.getLogger();

                    task.output = 'Reading wp-config.php...';

                    // Import wordpressReplaces and stripOutputString utilities
                    const { wordpressReplaces, stripOutputString, sshNavigateToMagentoRootCommand } = require('../utils/Console');

                    // Read WordPress config file from server (try wp folder first, fallback to blog/wordpress)
                    const wpConfigCommand = sshNavigateToMagentoRootCommand('cd wp && cat wp-config.php || cd blog && cat wp-config.php || cd wordpress && cat wp-config.php', config);

                    await ssh.execCommand(wpConfigCommand).then((result: any) => {
                        if (result && result.stdout) {
                            const string = stripOutputString(result.stdout);
                            const resultValues = string.split("\n");

                            resultValues.forEach((entry: any) => {
                                // Get DB name from config file
                                if (entry.includes('DB_NAME')) {
                                    config.wordpressConfig.database = wordpressReplaces(entry, `DB_NAME`);
                                }

                                // Get DB user from config file
                                if (entry.includes('DB_USER')) {
                                    config.wordpressConfig.username = wordpressReplaces(entry, `DB_USER`);
                                }

                                // Get DB password from config file
                                if (entry.includes('DB_PASSWORD')) {
                                    config.wordpressConfig.password = wordpressReplaces(entry, `DB_PASSWORD`);
                                }

                                // Get DB host from config file
                                if (entry.includes('DB_HOST')) {
                                    config.wordpressConfig.host = wordpressReplaces(entry, `DB_HOST`);
                                }

                                // Get table prefix from config file
                                if (entry.includes('table_prefix')) {
                                    config.wordpressConfig.prefix = wordpressReplaces(entry, `table_prefix`);
                                }
                            });
                        }
                    }).catch((error: any) => {
                        throw UI.createError(
                            `Could not read wp-config.php from server\n[TIP] Make sure WordPress is installed in wp/, blog/, or wordpress/ folder\nError: ${error.message}`
                        );
                    });

                    if (!config.wordpressConfig.database) {
                        throw UI.createError(
                            `Could not parse WordPress database configuration from wp-config.php\n[TIP] Check if wp-config.php is properly formatted`
                        );
                    }

                    logger.info('WordPress configuration retrieved', {
                        database: config.wordpressConfig.database,
                        username: config.wordpressConfig.username,
                        host: config.wordpressConfig.host,
                        prefix: config.wordpressConfig.prefix
                    });

                    task.title = `Retrieved WordPress config (${config.wordpressConfig.database})`;
                }
            });

            this.downloadTasks.push({
                title: 'Dumping WordPress database on server',
                task: async (ctx: any, task: any): Promise<void> => {
                    PerformanceMonitor.start('wordpress-dump');
                    const logger = this.services.getLogger();

                    task.output = 'Creating WordPress database dump...';

                    const wpDatabase = config.wordpressConfig.database;
                    const wpUsername = config.wordpressConfig.username;
                    const wpPassword = config.wordpressConfig.password;
                    const wpHost = config.wordpressConfig.host;
                    const databaseFileName = `${wpDatabase}.sql`;

                    // Detect compression
                    const compression = await this.detectCompression(ssh);
                    const compressedFileName = `${wpDatabase}.sql${compression.extension}`;

                    // Build mysqldump command for WordPress database
                    let dumpCommand: string;
                    if (compression.type === 'gzip') {
                        dumpCommand = `mysqldump -h ${wpHost} -u ${wpUsername} -p'${wpPassword}' ${wpDatabase} | gzip ${compression.level} > ~/${compressedFileName}`;
                    } else {
                        dumpCommand = `mysqldump -h ${wpHost} -u ${wpUsername} -p'${wpPassword}' ${wpDatabase} > ~/${databaseFileName}`;
                    }

                    logger.info('Starting WordPress database dump', {
                        database: wpDatabase,
                        compression: compression.type
                    });

                    await ssh.execCommand(dumpCommand).then(function (result: any) {
                        if (result.code && result.code !== 0) {
                            throw UI.createError(
                                `WordPress database dump failed\n[TIP] Check WordPress database credentials and permissions\nError: ${result.stderr}`
                            );
                        }
                        task.output = '✓ WordPress database dump completed';
                    });

                    // Store the filename for download task
                    config.wordpressDumpFile = compression.type === 'gzip' ? compressedFileName : databaseFileName;
                    config.wordpressCompression = compression;

                    const duration = PerformanceMonitor.end('wordpress-dump');
                    logger.info('WordPress database dump complete', { duration });
                    task.title = `Dumped WordPress database`;
                }
            });

            this.downloadTasks.push({
                title: 'Downloading WordPress database to localhost',
                task: async (ctx: any, task: any): Promise<void> => {
                    PerformanceMonitor.start('wordpress-download');
                    const logger = this.services.getLogger();
                    EnhancedProgress.resetDownload();

                    const databaseUsername = shellEscape(config.databases.databaseData.username);
                    const databaseServer = shellEscape(config.databases.databaseData.server);
                    const databasePort = config.databases.databaseData.port;

                    const databaseFileName = config.wordpressDumpFile;
                    const source = `~/${databaseFileName}`;
                    const destination = config.settings.currentFolder;
                    const escapedSource = shellEscape(source);
                    const escapedDestination = shellEscape(destination);

                    let sshCommand = databasePort
                        ? `ssh -p ${databasePort} -o StrictHostKeyChecking=no -o Compression=yes`
                        : `ssh -o StrictHostKeyChecking=no -o Compression=yes`;

                    if (config.customConfig.sshKeyLocation) {
                        const escapedKeyLocation = shellEscape(config.customConfig.sshKeyLocation);
                        sshCommand = `${sshCommand} -i ${escapedKeyLocation}`;
                    }

                    let rsyncCommand = `rsync -avz --compress-level=6 --progress -e "${sshCommand}" ${databaseUsername}@${databaseServer}:${escapedSource} ${escapedDestination}`;

                    if (config.databases.databaseData.password) {
                        const escapedPassword = shellEscape(config.databases.databaseData.password);
                        rsyncCommand = `sshpass -p ${escapedPassword} ` + rsyncCommand;
                    }

                    logger.info('Starting WordPress database download', {
                        source,
                        destination
                    });

                    const spawn = require('child_process').spawn;
                    const rsync = spawn('sh', ['-c', rsyncCommand]);

                    let lastUpdate = 0;
                    const updateInterval = 100;

                    await new Promise<void>((resolve, reject) => {
                        rsync.stdout.on('data', function(data: any) {
                            const now = Date.now();
                            if (now - lastUpdate < updateInterval) return;

                            const output = data.toString();
                            const sizeMatch = output.match(/(\d+(?:,\d+)*)\s+(\d+)%\s+([\d.]+[KMG]B\/s)/);

                            if (sizeMatch) {
                                const percent = parseInt(sizeMatch[2]);
                                const speed = sizeMatch[3];
                                task.output = `${EnhancedProgress.createProgressBar(percent, 20)} ${chalk.bold.cyan(percent + '%')} ${chalk.gray(speed)}`;
                                lastUpdate = now;
                            }
                        });

                        rsync.stderr.on('data', function(data: any) {
                            // rsync outputs progress to stderr
                        });

                        rsync.on('exit', function (code: any) {
                            if (code === 0) {
                                resolve();
                            } else {
                                reject(new Error(`Rsync failed with exit code ${code}`));
                            }
                        });

                        rsync.on('error', function (err: any) {
                            logger.error('Rsync process error', err);
                            reject(err);
                        });
                    });

                    const downloadedFile = `${destination}/${databaseFileName}`;
                    const duration = PerformanceMonitor.end('wordpress-download');

                    task.title = `Downloaded WordPress database`;
                    logger.info('WordPress database download complete', {
                        file: downloadedFile,
                        compression: config.wordpressCompression.type,
                        duration
                    });

                    config.finalMessages.wordpressDatabaseLocation = downloadedFile;
                }
            });

            // Clean up WordPress dump on server
            this.downloadTasks.push({
                title: 'Cleaning up WordPress dump on server',
                task: async (): Promise<void> => {
                    const databaseFileName = config.wordpressDumpFile;
                    await ssh.execCommand(`rm -f ~/${databaseFileName}`);
                }
            });
        }

        // WordPress uploads sync task - only runs if wordpressUploadsSync is enabled
        if (config.settings.wordpressUploadsSync === 'yes' && config.settings.rsyncInstalled) {
            this.downloadTasks.push({
                title: 'Synchronizing WordPress uploads to localhost',
                task: async (ctx: any, task: any): Promise<void> => {
                    PerformanceMonitor.start('wordpress-uploads-sync');
                    const logger = this.services.getLogger();

                    task.output = 'Preparing WordPress uploads sync...';

                    const databaseUsername = shellEscape(config.databases.databaseData.username);
                    const databaseServer = shellEscape(config.databases.databaseData.server);
                    const databasePort = config.databases.databaseData.port;
                    const destination = config.settings.currentFolder;

                    // WordPress uploads paths (check common locations)
                    const wpUploadsPaths = [
                        'wp/wp-content/uploads/',
                        'blog/wp-content/uploads/',
                        'wordpress/wp-content/uploads/'
                    ];

                    logger.info('Starting WordPress uploads sync', {
                        destination
                    });

                    // Build SSH command
                    let sshCommand = databasePort
                        ? `ssh -p ${databasePort} -o StrictHostKeyChecking=no -o Compression=yes`
                        : `ssh -o StrictHostKeyChecking=no -o Compression=yes`;

                    if (config.customConfig.sshKeyLocation) {
                        const escapedKeyLocation = shellEscape(config.customConfig.sshKeyLocation);
                        sshCommand = `${sshCommand} -i ${escapedKeyLocation}`;
                    }

                    // Try each possible path
                    let synced = false;
                    for (const uploadsPath of wpUploadsPaths) {
                        const source = `${config.serverVariables.magentoRoot}/${uploadsPath}`;
                        const escapedSource = shellEscape(source);
                        const destFolder = `${destination}/${uploadsPath.replace(/\/$/, '')}`;
                        const escapedDestFolder = shellEscape(destFolder);

                        task.output = `Checking ${uploadsPath}...`;

                        // Check if remote folder exists (using escaped source for shell command)
                        const checkResult = await ssh.execCommand(`test -d ${escapedSource} && echo "EXISTS" || echo "MISSING"`);
                        const folderExists = checkResult.stdout.trim() === 'EXISTS';

                        if (!folderExists) {
                            logger.info('Remote uploads folder does not exist, trying next path', { path: uploadsPath, source });
                            continue;
                        }

                        // Found the uploads folder!
                        task.output = `Syncing WordPress uploads from ${uploadsPath}...`;

                        // Ensure destination directory exists
                        if (!fs.existsSync(destFolder)) {
                            fs.mkdirSync(destFolder, { recursive: true });
                            logger.info('Created destination directory', { path: destFolder });
                        }

                        // Build rsync command
                        let rsyncCommand = `rsync -avz --compress-level=6 --progress --partial --ignore-errors -e "${sshCommand}" ${databaseUsername}@${databaseServer}:${escapedSource} ${escapedDestFolder}`;

                        if (config.databases.databaseData.password) {
                            const escapedPassword = shellEscape(config.databases.databaseData.password);
                            rsyncCommand = `sshpass -p ${escapedPassword} ` + rsyncCommand;
                        }

                        logger.info('Syncing WordPress uploads', { source, destination: destFolder, command: rsyncCommand });

                        // Execute rsync
                        try {
                            await new Promise<void>((resolve, reject) => {
                                const { spawn } = require('child_process');
                                const rsyncParts = rsyncCommand.split(' ');
                                const rsync = spawn(rsyncParts[0], rsyncParts.slice(1), { shell: true });

                                rsync.on('close', function (code: number) {
                                    if (code === 0) {
                                        logger.info('WordPress uploads sync complete', { uploadsPath });
                                        resolve();
                                    } else {
                                        const errorMsg = `Rsync failed with exit code ${code}`;
                                        logger.error(errorMsg, new Error(errorMsg));
                                        reject(new Error(errorMsg));
                                    }
                                });

                                rsync.on('error', function (err: any) {
                                    logger.error('Rsync process error', err);
                                    reject(err);
                                });
                            });

                            synced = true;
                            break; // Successfully synced, stop trying other paths
                        } catch (error) {
                            const err = error as Error;
                            logger.warn('WordPress uploads sync failed', { path: uploadsPath, error: err.message });
                            task.output = `Failed to sync ${uploadsPath}: ${err.message}`;
                        }
                    }

                    const duration = PerformanceMonitor.end('wordpress-uploads-sync');

                    if (synced) {
                        task.title = `WordPress uploads synced in ${ProgressDisplay.formatDuration(duration)}`;
                    } else {
                        task.title = `[WARNING] WordPress uploads folder not found on server`;
                    }

                    logger.info('WordPress uploads sync complete', {
                        synced,
                        duration
                    });
                }
            });
        }

        // Media sync task - only runs if syncImages is enabled
        if (config.settings.syncImages === 'yes' && config.settings.syncImageTypes && config.settings.syncImageTypes.length > 0) {
            this.downloadTasks.push({
                title: 'Synchronizing media images to localhost',
                task: async (ctx: any, task: any): Promise<void> => {
                    PerformanceMonitor.start('media-sync');
                    const logger = this.services.getLogger();

                    task.output = EnhancedProgress.step(1, 4, 'Preparing media sync...');

                    const databaseUsername = shellEscape(config.databases.databaseData.username);
                    const databaseServer = shellEscape(config.databases.databaseData.server);
                    const databasePort = config.databases.databaseData.port;
                    const destination = config.settings.currentFolder;

                    // Map image types to folder paths
                    const folderMap: Record<string, string> = {
                        'Category images': 'pub/media/catalog/category/',
                        'Product images': 'pub/media/catalog/product/',
                        'WYSIWYG images': 'pub/media/wysiwyg/',
                        'Everything else': 'pub/media/'
                    };

                    // Build list of folders to sync
                    const foldersToSync: string[] = [];
                    const selectedTypes = config.settings.syncImageTypes;

                    if (selectedTypes.includes('Everything else')) {
                        // If "Everything else" is selected, sync entire pub/media
                        foldersToSync.push('pub/media/');
                    } else {
                        // Otherwise, sync individual folders
                        selectedTypes.forEach((type: string) => {
                            if (folderMap[type]) {
                                foldersToSync.push(folderMap[type]);
                            }
                        });
                    }

                    logger.info('Starting media sync', {
                        folders: foldersToSync,
                        destination
                    });

                    // Build SSH command
                    let sshCommand = databasePort
                        ? `ssh -p ${databasePort} -o StrictHostKeyChecking=no -o Compression=yes`
                        : `ssh -o StrictHostKeyChecking=no -o Compression=yes`;

                    if (config.customConfig.sshKeyLocation) {
                        const escapedKeyLocation = shellEscape(config.customConfig.sshKeyLocation);
                        sshCommand = `${sshCommand} -i ${escapedKeyLocation}`;
                    }

                    // Sync each folder
                    let folderIndex = 0;
                    let syncedCount = 0;

                    for (const folder of foldersToSync) {
                        folderIndex++;
                        const source = `${config.serverVariables.magentoRoot}/${folder}`;
                        const escapedSource = shellEscape(source);

                        // Remove trailing slash from folder for destination
                        const folderPath = folder.endsWith('/') ? folder.slice(0, -1) : folder;
                        const destFolder = `${destination}/${folderPath}`;
                        const escapedDestFolder = shellEscape(destFolder);

                        task.output = EnhancedProgress.step(folderIndex + 1, foldersToSync.length + 2, `Checking ${folder}...`);

                        // Check if remote folder exists (using escaped source for shell command)
                        const checkResult = await ssh.execCommand(`test -d ${escapedSource} && echo "EXISTS" || echo "MISSING"`);
                        const folderExists = checkResult.stdout.trim() === 'EXISTS';

                        if (!folderExists) {
                            logger.info('Remote folder does not exist, skipping', { folder, source });
                            task.output = `${chalk.yellow('[WARNING]')} ${chalk.gray(folder)} ${chalk.yellow('(not found on server)')}`;
                            await new Promise(resolve => setTimeout(resolve, 500)); // Brief pause so user can see message
                            continue;
                        }

                        // Ensure destination directory exists (create full path)
                        if (!fs.existsSync(destFolder)) {
                            fs.mkdirSync(destFolder, { recursive: true });
                            logger.info('Created destination directory', { path: destFolder });
                        }

                        task.output = EnhancedProgress.step(folderIndex + 1, foldersToSync.length + 2, `Syncing ${folder}...`);

                        // Build rsync command with compression
                        // Note: Using trailing slash on source to sync contents, not the folder itself
                        // Using --partial to keep partially transferred files, --ignore-errors to continue on errors
                        let rsyncCommand = `rsync -avz --compress-level=6 --progress --partial --ignore-errors -e "${sshCommand}" ${databaseUsername}@${databaseServer}:${escapedSource} ${escapedDestFolder}`;

                        if (config.databases.databaseData.password) {
                            const escapedPassword = shellEscape(config.databases.databaseData.password);
                            rsyncCommand = `sshpass -p ${escapedPassword} ` + rsyncCommand;
                        }

                        logger.info('Syncing folder', { folder, source, destination: destFolder, command: rsyncCommand });

                        // Execute rsync with progress tracking
                        try {
                            await new Promise<void>((resolve, reject) => {
                                const rsync = require('child_process').exec(rsyncCommand);
                                let lastUpdate = Date.now();
                                let stderrOutput = '';

                                const handleRsyncData = function (data: any) {
                                    const dataStr = data.toString();
                                    const now = Date.now();

                                    // Extract speed from rsync output
                                    const speedMatch = dataStr.match(/([\d.]+)(MB|KB|GB)\/s/);

                                    if (speedMatch && now - lastUpdate > 500) {
                                        const speedValue = parseFloat(speedMatch[1]);
                                        const unit = speedMatch[2];

                                        const displayText = `${chalk.gray(folder)} ${chalk.green('[DOWN]')} ${chalk.cyan(speedValue + ' ' + unit + '/s')}`;

                                        task.output = displayText;
                                        lastUpdate = now;
                                    }
                                };

                                rsync.stdout.on('data', handleRsyncData);
                                rsync.stderr.on('data', function(data: any) {
                                    stderrOutput += data.toString();
                                    handleRsyncData(data);
                                });

                                rsync.on('exit', function (code: any) {
                                    // Exit codes:
                                    // 0 = success
                                    // 23 = partial transfer (some files couldn't be transferred)
                                    // 24 = partial transfer due to vanished source files (files disappeared during transfer)
                                    // We'll accept these as success since some files being unavailable is okay
                                    if (code === 0 || code === 23 || code === 24) {
                                        if (code === 23) {
                                            logger.info('Partial transfer completed (some files skipped)', { folder });
                                        } else if (code === 24) {
                                            logger.info('Partial transfer completed (some source files vanished)', { folder });
                                        }
                                        resolve();
                                    } else if (code === 20) {
                                        // Exit code 20 often happens when destination has issues but transfer might have completed
                                        // Log as warning but don't fail
                                        logger.warn('Rsync exit code 20 (signal received or interrupted), checking if files transferred', { folder });

                                        // Check if destination directory has content (successful transfer)
                                        try {
                                            const files = fs.readdirSync(destFolder);
                                            if (files.length > 0) {
                                                logger.info('Files were transferred despite exit code 20, marking as success', { folder, fileCount: files.length });
                                                resolve();
                                            } else {
                                                logger.warn('No files transferred, treating as failure', { folder });
                                                reject(new Error(`Rsync failed for ${folder} with exit code ${code}`));
                                            }
                                        } catch (err) {
                                            logger.warn('Could not check destination directory', { folder, error: (err as Error).message });
                                            reject(new Error(`Rsync failed for ${folder} with exit code ${code}`));
                                        }
                                    } else {
                                        const errorMsg = `Rsync failed for ${folder} with exit code ${code}`;
                                        logger.error(errorMsg, new Error(errorMsg));
                                        logger.info('Failed rsync command', { command: rsyncCommand, source, destination: destFolder });
                                        if (stderrOutput) {
                                            logger.info('Rsync stderr output', { stderr: stderrOutput.substring(0, 500) });
                                        }
                                        reject(new Error(`${errorMsg}\nSource: ${source}\nDestination: ${destFolder}\nStderr: ${stderrOutput.substring(0, 200)}`));
                                    }
                                });

                                rsync.on('error', function (err: any) {
                                    logger.error('Rsync process error', err);
                                    reject(err);
                                });
                            });

                            syncedCount++;
                            logger.info('Folder sync complete', { folder });
                        } catch (error) {
                            // Log the error but continue with other folders
                            const err = error as Error;
                            logger.warn('Folder sync failed, continuing with remaining folders', { folder, error: err.message });
                            task.output = `${chalk.yellow('[WARNING]')} ${chalk.gray(folder)} ${chalk.red('(sync failed)')}`;
                            await new Promise(resolve => setTimeout(resolve, 1000)); // Brief pause so user can see message
                        }
                    }

                    const duration = PerformanceMonitor.end('media-sync');

                    if (syncedCount === 0) {
                        task.title = `[WARNING]  No media folders synced`;
                    } else if (syncedCount < foldersToSync.length) {
                        task.title = `Synced ${syncedCount}/${foldersToSync.length} media folder(s)`;
                    } else {
                        task.title = `Synced ${syncedCount} media folder(s)`;
                    }

                    logger.info('Media sync complete', {
                        foldersRequested: foldersToSync.length,
                        foldersSynced: syncedCount,
                        duration
                    });
                }
            });
        }

        this.downloadTasks.push({
            title: 'Cleaning up remote files',
            task: async (): Promise<void> => {
                PerformanceMonitor.start('cleanup');
                const logger = this.services.getLogger();

                // Clean up Magento database (use the actual filename with compression extension)
                if (config.serverVariables.databaseName) {
                    const compression = config.compressionInfo || { type: 'none', extension: '' };
                    const databaseFileName = `${config.serverVariables.databaseName}.sql${compression.extension}`;

                    logger.info('Cleaning up database file on server', { file: databaseFileName });
                    await ssh.execCommand(`rm -f ~/${databaseFileName}`);
                }

                // Clean up WordPress database if it was downloaded
                if (config.wordpressDumpFile) {
                    logger.info('Cleaning up WordPress database file on server', { file: config.wordpressDumpFile });
                    await ssh.execCommand(`rm -f ~/${config.wordpressDumpFile}`);
                }

                // Clean up uploaded Magerun file
                if (config.serverVariables.magerunFile) {
                    logger.info('Cleaning up Magerun file on server', { file: config.serverVariables.magerunFile });
                    await ssh.execCommand(
                        sshNavigateToMagentoRootCommand(
                            `rm -f ${config.serverVariables.magerunFile}`,
                            config
                        )
                    );
                }

                PerformanceMonitor.end('cleanup');
            }
        });

        // Close SSH connections as final step - no longer needed after download
        this.downloadTasks.push({
            title: 'Closing SSH connections',
            task: async (): Promise<void> => {
                const logger = this.services.getLogger();
                logger.info('Closing SSH connections after download');
                await SSHConnectionPool.closeAll();
                logger.info('SSH connections closed successfully');
            }
        });
    };
}

export default DownloadTask;
