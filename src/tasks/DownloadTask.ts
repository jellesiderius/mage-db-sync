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
     * Detect best compression available on remote server
     * Priority: zstd > gzip > none
     */
    private async detectBestCompression(ssh: any): Promise<{ type: 'zstd' | 'gzip' | 'none'; level: string; extension: string }> {
        const logger = this.services.getLogger();
        
        // Check for zstd
        try {
            const zstdCheck = await ssh.execCommand('which zstd');
            if (zstdCheck.code === 0) {
                logger.info('Using zstd compression (best performance)', { level: '-3' });
                return { type: 'zstd', level: '-3', extension: '.zst' };
            }
        } catch (e) {
            // zstd not available
        }
        
        // Check for gzip
        try {
            const gzipCheck = await ssh.execCommand('which gzip');
            if (gzipCheck.code === 0) {
                logger.info('Using gzip compression (zstd not available)', { level: '-6' });
                return { type: 'gzip', level: '-6', extension: '.gz' };
            }
        } catch (e) {
            // gzip not available
        }
        
        // No compression available
        logger.warn('No compression tools available on server, using uncompressed SQL');
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
                task.output = '✓ SSH connection established';

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
                    
                    // Detect best compression available on remote server
                    task.output = EnhancedProgress.step(5, 6, `Detecting compression tools...`);
                    const compression = await this.detectBestCompression(ssh);
                    
                    task.output = EnhancedProgress.step(5, 6, `Creating ${compression.type === 'none' ? 'uncompressed' : compression.type} ${stripType} database dump...`);

                    let dumpCommand: string;
                    const databaseFileName = `${config.serverVariables.databaseName}.sql${compression.extension}`;
                    
                    // Store compression info for later use
                    config.compressionInfo = compression;
                    
                    // Build dump command with best available compression
                    let stripOptions = '';
                    let humanReadable = '';
                    
                    if (config.settings.strip === 'keep customer data') {
                        const keepCustomerOptions = (staticConfigFile as any).settings?.databaseStripKeepCustomerData || '';
                        stripOptions = keepCustomerOptions ? `--strip="${keepCustomerOptions}"` : '';
                    } else if (config.settings.strip === 'full and human readable') {
                        const fullStripOptions = (staticConfigFile as any).settings?.databaseStripDevelopment || '';
                        stripOptions = fullStripOptions ? `--strip="${fullStripOptions}"` : '';
                        humanReadable = '--human-readable';
                    } else if (config.settings.strip === 'full') {
                        const fullStripOptions = (staticConfigFile as any).settings?.databaseStripDevelopment || '';
                        stripOptions = fullStripOptions ? `--strip="${fullStripOptions}"` : '';
                    } else {
                        const developmentStripOptions = (staticConfigFile as any).settings?.databaseStripDevelopment || '';
                        stripOptions = developmentStripOptions ? `--strip="${developmentStripOptions}"` : '';
                    }
                    
                    // Build compression command based on what's available
                    if (compression.type === 'zstd') {
                        dumpCommand = `db:dump --stdout -n --no-tablespaces ${humanReadable} ${stripOptions} | zstd ${compression.level} -o ${databaseFileName}`;
                    } else if (compression.type === 'gzip') {
                        dumpCommand = `db:dump --stdout -n --no-tablespaces ${humanReadable} ${stripOptions} | gzip ${compression.level} > ${databaseFileName}`;
                    } else {
                        // No compression - just dump to file
                        dumpCommand = `db:dump --stdout -n --no-tablespaces ${humanReadable} ${stripOptions} > ${databaseFileName}`;
                    }
                    
                    logger.info('Using compression for database dump', { 
                        compression: compression.type,
                        level: compression.level,
                        file: databaseFileName,
                        stripType 
                    });

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
                    
                    // Use the compression info determined during dump
                    const compression = config.compressionInfo || { type: 'none', extension: '' };
                    const databaseFileName = `${config.serverVariables.databaseName}.sql${compression.extension}`;
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
                                
                                // Show compression type
                                if (compression.type !== 'none') {
                                    displayText += ` ${chalk.yellow(`⚡ ${compression.type}`)}`;
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
                    
                    // Use actual downloaded filename with compression extension
                    const downloadedFile = `${config.customConfig.localDatabaseFolderLocation}/${databaseFileName}`;
                    const fileSize = fs.existsSync(downloadedFile)
                        ? fs.statSync(downloadedFile).size
                        : 0;
                    const sizeMB = (fileSize / (1024 * 1024)).toFixed(2);
                    const speedMBps = (parseFloat(sizeMB) / (duration / 1000)).toFixed(2);
                    
                    task.title = `✓ Downloaded database (${sizeMB}MB in ${UI.duration(duration)} @ ${speedMBps} MB/s)`;
                    
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

        // Media sync task - only runs if syncImages is enabled
        if (config.settings.syncImages === 'yes' && config.settings.syncImageTypes && config.settings.syncImageTypes.length > 0) {
            this.downloadTasks.push({
                title: 'Synchronizing media images to localhost',
                task: async (ctx: any, task: any): Promise<void> => {
                    PerformanceMonitor.start('media-sync');
                    const logger = this.services.getLogger();
                    
                    task.output = EnhancedProgress.step(1, 4, 'Preparing media sync...');
                    
                    const databaseUsername = config.databases.databaseData.username;
                    const databaseServer = config.databases.databaseData.server;
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
                        sshCommand = `${sshCommand} -i ${config.customConfig.sshKeyLocation}`;
                    }
                    
                    // Sync each folder
                    let folderIndex = 0;
                    let syncedCount = 0;
                    
                    for (const folder of foldersToSync) {
                        folderIndex++;
                        const source = `${config.serverVariables.magentoRoot}/${folder}`;
                        
                        // Remove trailing slash from folder for destination
                        const folderPath = folder.endsWith('/') ? folder.slice(0, -1) : folder;
                        const destFolder = `${destination}/${folderPath}`;
                        
                        task.output = EnhancedProgress.step(folderIndex + 1, foldersToSync.length + 2, `Checking ${folder}...`);
                        
                        // Check if remote folder exists
                        const checkResult = await ssh.execCommand(`test -d ${source} && echo "EXISTS" || echo "MISSING"`);
                        const folderExists = checkResult.stdout.trim() === 'EXISTS';
                        
                        if (!folderExists) {
                            logger.info('Remote folder does not exist, skipping', { folder, source });
                            task.output = `${chalk.yellow('⚠')} ${chalk.gray(folder)} ${chalk.yellow('(not found on server)')}`;
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
                        let rsyncCommand = `rsync -avz --compress-level=6 --progress --partial --ignore-errors -e "${sshCommand}" ${databaseUsername}@${databaseServer}:${source} ${destFolder}`;
                        
                        if (config.databases.databaseData.password) {
                            rsyncCommand = `sshpass -p "${config.databases.databaseData.password}" ` + rsyncCommand;
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
                                        
                                        let displayText = `${chalk.gray(folder)} ${chalk.green('↓')} ${chalk.cyan(speedValue + ' ' + unit + '/s')} ${chalk.yellow('⚡')}`;
                                        
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
                            task.output = `${chalk.yellow('⚠')} ${chalk.gray(folder)} ${chalk.red('(sync failed)')}`;
                            await new Promise(resolve => setTimeout(resolve, 1000)); // Brief pause so user can see message
                        }
                    }
                    
                    const duration = PerformanceMonitor.end('media-sync');
                    
                    if (syncedCount === 0) {
                        task.title = `⚠️  No media folders synced (${ProgressDisplay.formatDuration(duration)})`;
                    } else if (syncedCount < foldersToSync.length) {
                        task.title = `✓ Synced ${syncedCount}/${foldersToSync.length} media folder(s) (${ProgressDisplay.formatDuration(duration)})`;
                    } else {
                        task.title = `✓ Synced ${syncedCount} media folder(s) (${ProgressDisplay.formatDuration(duration)})`;
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
            title: 'Cleaning up and closing SSH connection',
            task: async (): Promise<void> => {
                PerformanceMonitor.start('cleanup');

                const databaseFileName = `${config.serverVariables.databaseName}.sql`;
                await ssh.execCommand(`rm -f ~/${databaseFileName}`);

                PerformanceMonitor.end('cleanup');
            }
        });
    };
}

export default DownloadTask;
