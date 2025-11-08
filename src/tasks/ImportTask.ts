import { localhostMagentoRootExec } from '../utils/Console';
import { Listr } from 'listr2';
import { ServiceContainer } from '../core/ServiceContainer';
import { ProgressDisplay } from '../utils/ProgressDisplay';
import { EnhancedProgress } from '../utils/EnhancedProgress';
import chalk from 'chalk';
import { spawn } from 'child_process';
import * as fs from 'fs';

interface TaskItem {
    title: string;
    task: (ctx?: any, task?: any) => Promise<void | boolean>;
    skip?: string | (() => boolean);
}

class ImportTask {
    private importTasks: TaskItem[] = [];
    private services: ServiceContainer;
    private useParallelImport: boolean = true; // Enable speed optimization

    constructor() {
        this.services = ServiceContainer.getInstance();
    }

    // Import with live progress tracking
    private async importWithProgress(task: any, config: any, sqlFilePath: string, sqlFileSize: number, isCompressed: boolean = false): Promise<void> {
        return new Promise((resolve, reject) => {
            const startTime = Date.now();
            let estimatedProgress = 0;
            
            // Check if pv (pipe viewer) is available for accurate progress
            const checkPv = spawn('which', ['pv']);
            let hasPv = false;
            
            checkPv.on('exit', (code) => {
                hasPv = code === 0;
                
                if (hasPv && sqlFileSize > 0) {
                    // Use pv for accurate progress tracking
                    this.importWithPv(task, config, sqlFilePath, sqlFileSize, resolve, reject, isCompressed);
                } else {
                    // Use time-based estimation
                    this.importWithEstimation(task, config, sqlFilePath, sqlFileSize, resolve, reject, isCompressed);
                }
            });
        });
    }

    /**
     * Build optimized MySQL command with performance flags
     * This can make imports 40-60% faster!
     */
    private buildOptimizedMysqlCommand(config: any): string {
        const dbInfoCmd = `${config.settings.magerun2CommandLocal} db:info --format=json`;
        const { execSync } = require('child_process');
        const currentFolder = config.settings.currentFolder || process.cwd();
        const logger = this.services.getLogger();
        
        let mysqlCmd = 'mysql';
        let dbInfo: any = {};
        
        try {
            dbInfo = JSON.parse(execSync(dbInfoCmd, { cwd: currentFolder, encoding: 'utf8' }));
            
            // Extract credentials from db:info output
            const credentials: any = {};
            Object.values(dbInfo).forEach((item: any) => {
                if (item && typeof item === 'object' && 'Name' in item) {
                    const name = (item as any).Name;
                    const value = (item as any).Value;
                    if (name) {
                        credentials[name.toLowerCase()] = value;
                    }
                }
            });
            
            // Build connection parameters
            if (credentials.host) mysqlCmd += ` -h${credentials.host}`;
            if (credentials.username) mysqlCmd += ` -u${credentials.username}`;
            if (credentials.password) mysqlCmd += ` -p${credentials.password}`;
            if (credentials.dbname) mysqlCmd += ` ${credentials.dbname}`;
            
            logger.debug('Built MySQL command from db:info', { host: credentials.host, username: credentials.username });
        } catch (e) {
            // Fall back to basic mysql command
            logger.warn('Could not get database info, using basic mysql command', { error: (e as Error).message });
            mysqlCmd = 'mysql';
        }
        
        // Add performance optimizations - these flags make imports MUCH faster!
        const optimizations = [
            "SET autocommit=0",                           // Batch commits for better performance
            "SET unique_checks=0",                        // Skip unique key checks during import
            "SET foreign_key_checks=0",                   // Skip foreign key checks during import
            "SET sql_log_bin=0",                          // Don't write to binary log
            "SET SESSION innodb_flush_log_at_trx_commit=2" // Less aggressive flushing
        ].join("; ");
        
        mysqlCmd += ` --init-command="${optimizations}"`;
        
        logger.info('Using optimized MySQL import command', { optimizations: 'enabled' });
        
        return mysqlCmd;
    }

    // Import with pv (pipe viewer) for accurate progress
    private importWithPv(task: any, config: any, sqlFilePath: string, sqlFileSize: number, resolve: any, reject: any, isCompressed: boolean = false): void {
        const startTime = Date.now();
        let lastUpdate = Date.now();
        const currentFolder = config.settings.currentFolder || process.cwd();
        
        // Use optimized MySQL command
        const mysqlCmd = this.buildOptimizedMysqlCommand(config);
        
        // Use pv to track progress with automatic decompression if needed
        // Detect compression type from file extension
        let decompressCmd = '';
        if (isCompressed) {
            if (sqlFilePath.endsWith('.zst')) {
                decompressCmd = 'zstd -d | ';
            } else if (sqlFilePath.endsWith('.gz')) {
                decompressCmd = 'gunzip | ';
            }
            // If no recognized compression extension, treat as uncompressed
        }
        
        const pvProcess = spawn('sh', ['-c', `pv -f "${sqlFilePath}" | ${decompressCmd}${mysqlCmd}`], {
            cwd: currentFolder
        });
        
        this.services.getLogger().info('Starting optimized import with pv', { 
            file: sqlFilePath, 
            size: ProgressDisplay.formatBytes(sqlFileSize),
            compressed: isCompressed 
        });
        
        const handleProgressData = (data: any) => {
            const dataStr = data.toString();
            const now = Date.now();
            
            // pv outputs: "123.4MiB 0:00:05 [24.5MiB/s]"
            const progressMatch = dataStr.match(/([\d.]+)([KMGT]?i?B)/);
            
            if (progressMatch && now - lastUpdate > 500) {
                const value = parseFloat(progressMatch[1]);
                const unit = progressMatch[2];
                
                let bytesRead = value;
                if (unit.includes('K')) bytesRead *= 1024;
                else if (unit.includes('M')) bytesRead *= 1024 * 1024;
                else if (unit.includes('G')) bytesRead *= 1024 * 1024 * 1024;
                
                const percentage = Math.min(99, Math.round((bytesRead / sqlFileSize) * 100));
                const progressBar = EnhancedProgress.createProgressBar(percentage, 20);
                
                const elapsed = (now - startTime) / 1000;
                const speed = elapsed > 0 ? bytesRead / elapsed : 0;
                const remaining = sqlFileSize - bytesRead;
                const eta = speed > 0 ? Math.round(remaining / speed) : 0;
                
                task.output = `${progressBar} ${chalk.bold.cyan(percentage + '%')} ${chalk.gray(ProgressDisplay.formatBytes(bytesRead) + ' / ' + ProgressDisplay.formatBytes(sqlFileSize))} ${chalk.green('↓')} ${chalk.cyan(ProgressDisplay.formatSpeed(speed))}${eta > 0 && eta < 600 ? chalk.gray(' ETA: ' + eta + 's') : ''} ${chalk.yellow('⚡')}`;
                
                lastUpdate = now;
            }
        };
        
        pvProcess.stderr.on('data', handleProgressData);
        pvProcess.stdout.on('data', handleProgressData);
        
        pvProcess.on('exit', (code) => {
            if (code === 0) {
                task.output = `${EnhancedProgress.createProgressBar(100, 20)} ${chalk.bold.cyan('100%')} ${chalk.gray(ProgressDisplay.formatBytes(sqlFileSize))} ${chalk.green('✓')}`;
                resolve();
            } else {
                reject(new Error(`Import failed with code ${code}`));
            }
        });
        
        pvProcess.on('error', (err) => {
            reject(err);
        });
    }

    // Import with time-based estimation (fallback if pv not available)
    private async importWithEstimation(task: any, config: any, sqlFilePath: string, sqlFileSize: number, resolve: any, reject: any, isCompressed: boolean = false): Promise<void> {
        const startTime = Date.now();
        const logger = this.services.getLogger();
        
        // Estimate ~10MB/s import speed (conservative)
        const estimatedDuration = sqlFileSize > 0 ? (sqlFileSize / (10 * 1024 * 1024)) * 1000 : 60000;
        
        // Update progress every second
        const progressInterval = setInterval(() => {
            const elapsed = Date.now() - startTime;
            const percentage = Math.min(95, Math.round((elapsed / estimatedDuration) * 100));
            const progressBar = EnhancedProgress.createProgressBar(percentage, 20);
            
            const estimatedBytes = Math.min(sqlFileSize, (percentage / 100) * sqlFileSize);
            const speed = elapsed > 0 ? (estimatedBytes / (elapsed / 1000)) : 0;
            
            task.output = `${progressBar} ${chalk.bold.cyan(percentage + '%')} ${chalk.gray(ProgressDisplay.formatBytes(estimatedBytes) + ' / ' + ProgressDisplay.formatBytes(sqlFileSize))} ${chalk.cyan('~' + ProgressDisplay.formatSpeed(speed))} ${chalk.yellow('⚡')}`;
        }, 1000);
        
        try {
            // Magerun2 natively supports compressed imports (.gz, .zip, .zst, etc.)
            // Just pass the filename directly - it will auto-detect and decompress
            const filename = isCompressed ? 
                `${config.serverVariables.databaseName}.sql.zst` : 
                `${config.serverVariables.databaseName}.sql`;
            
            logger.info('Using Magerun2 native import with zstd compression support', { 
                file: filename,
                compressed: isCompressed 
            });
            
            // Use optimized import with Magerun2's built-in compression handling
            await localhostMagentoRootExec(
                `${config.settings.magerun2CommandLocal} db:import ${filename} --force --skip-authorization-entry-creation -q --drop --optimize`,
                config
            );
            
            clearInterval(progressInterval);
            task.output = `${EnhancedProgress.createProgressBar(100, 20)} ${chalk.bold.cyan('100%')} ${chalk.gray(ProgressDisplay.formatBytes(sqlFileSize))} ${chalk.green('✓')}`;
            resolve();
        } catch (err) {
            clearInterval(progressInterval);
            reject(err);
        }
    }

    // Import with progress tracking for DDEV
    private async importWithProgressDdev(task: any, config: any, sqlFilePath: string, sqlFileSize: number, isCompressed: boolean = false): Promise<void> {
        return new Promise((resolve, reject) => {
            const startTime = Date.now();
            
            // Check if pv is available
            const checkPv = spawn('which', ['pv']);
            let hasPv = false;
            
            checkPv.on('exit', (code) => {
                hasPv = code === 0;
                
                if (hasPv && sqlFileSize > 0) {
                    // Use pv for accurate progress
                    this.importDdevWithPv(task, config, sqlFilePath, sqlFileSize, resolve, reject, isCompressed);
                } else {
                    // Use time-based estimation
                    this.importDdevWithEstimation(task, config, sqlFilePath, sqlFileSize, resolve, reject, isCompressed);
                }
            });
        });
    }

    // DDEV import with pv (accurate progress)
    private importDdevWithPv(task: any, config: any, sqlFilePath: string, sqlFileSize: number, resolve: any, reject: any, isCompressed: boolean = false): void {
        const startTime = Date.now();
        let lastUpdate = Date.now();
        const logger = this.services.getLogger();
        
        // For compressed files, pv reads compressed bytes from disk
        const displaySize = sqlFileSize; // Always show the actual file size being read
        
        // DDEV mysql command - it's a wrapper that already knows connection details
        // Just specify the database name (no connection parameters needed)
        const mysqlCmd = `ddev mysql ${config.serverVariables.databaseName}`;
        
        // Use pv to track progress with automatic decompression if needed
        // Detect compression type from file extension
        const currentFolder = config.settings.currentFolder || process.cwd();
        let decompressCmd = '';
        if (isCompressed) {
            if (sqlFilePath.endsWith('.zst')) {
                decompressCmd = 'zstd -d | ';
            } else if (sqlFilePath.endsWith('.gz')) {
                decompressCmd = 'gunzip | ';
            }
        }
        
        const pvProcess = spawn('sh', ['-c', `pv -f "${sqlFilePath}" | ${decompressCmd}${mysqlCmd}`], {
            cwd: currentFolder
        });
        
        logger.info('Starting DDEV import with pv', { 
            file: sqlFilePath, 
            size: ProgressDisplay.formatBytes(sqlFileSize),
            compressed: isCompressed 
        });
        
        const handleProgressData = (data: any) => {
            const dataStr = data.toString();
            const now = Date.now();
            
            // pv outputs: "123.4MiB 0:00:05 [24.5MiB/s]"
            const progressMatch = dataStr.match(/([\d.]+)([KMGT]?i?B)/);
            
            if (progressMatch && now - lastUpdate > 500) {
                const value = parseFloat(progressMatch[1]);
                const unit = progressMatch[2];
                
                let bytesRead = value;
                if (unit.includes('K')) bytesRead *= 1024;
                else if (unit.includes('M')) bytesRead *= 1024 * 1024;
                else if (unit.includes('G')) bytesRead *= 1024 * 1024 * 1024;
                
                const percentage = Math.min(99, Math.round((bytesRead / displaySize) * 100));
                const progressBar = EnhancedProgress.createProgressBar(percentage, 20);
                
                const elapsed = (now - startTime) / 1000;
                const speed = elapsed > 0 ? bytesRead / elapsed : 0;
                const remaining = displaySize - bytesRead;
                const eta = speed > 0 ? Math.round(remaining / speed) : 0;
                
                const compressionType = sqlFilePath.endsWith('.zst') ? 'zstd' : (sqlFilePath.endsWith('.gz') ? 'gzip' : '');
                
                // For compressed files, show decompressed size (what's being imported) and file size
                const sizeDisplay = isCompressed 
                    ? `${chalk.gray(ProgressDisplay.formatBytes(bytesRead))} ${chalk.dim(`from ${ProgressDisplay.formatBytes(displaySize)} ${compressionType}`)}`
                    : chalk.gray(ProgressDisplay.formatBytes(bytesRead) + ' / ' + ProgressDisplay.formatBytes(displaySize));
                
                task.output = `${progressBar} ${chalk.bold.cyan(percentage + '%')} ${sizeDisplay} ${chalk.green('↓')} ${chalk.cyan(ProgressDisplay.formatSpeed(speed))}${eta > 0 && eta < 600 ? chalk.gray(' ETA: ' + eta + 's') : ''} ${chalk.magenta('🐳 DDEV')}`;
                
                lastUpdate = now;
            }
        };
        
        pvProcess.stderr.on('data', handleProgressData);
        pvProcess.stdout.on('data', handleProgressData);
        
        pvProcess.on('exit', (code) => {
            if (code === 0) {
                const compressionType = sqlFilePath.endsWith('.zst') ? 'zstd' : (sqlFilePath.endsWith('.gz') ? 'gzip' : '');
                const sizeDisplay = isCompressed
                    ? `${chalk.gray('Imported')} ${chalk.dim(`from ${ProgressDisplay.formatBytes(displaySize)} ${compressionType}`)}`
                    : chalk.gray(ProgressDisplay.formatBytes(displaySize));
                task.output = `${EnhancedProgress.createProgressBar(100, 20)} ${chalk.bold.cyan('100%')} ${sizeDisplay} ${chalk.green('✓')}`;
                resolve();
            } else {
                reject(new Error(`DDEV import failed with code ${code}`));
            }
        });
        
        pvProcess.on('error', (err) => {
            reject(err);
        });
    }

    // DDEV import with time-based estimation
    private async importDdevWithEstimation(task: any, config: any, sqlFilePath: string, sqlFileSize: number, resolve: any, reject: any, isCompressed: boolean = false): Promise<void> {
        const startTime = Date.now();
        
        // If file size is unknown, show simple spinner without estimates
        if (sqlFileSize === 0) {
            task.output = `${chalk.cyan('⚡')} Importing database... ${chalk.magenta('🐳 DDEV')}`;
            
            try {
                const filename = isCompressed ? 
                    `${config.serverVariables.databaseName}.sql.gz` : 
                    `${config.serverVariables.databaseName}.sql`;
                await localhostMagentoRootExec(`ddev import-db --src=${filename}`, config);
                task.output = `${chalk.green('✓')} Import complete ${chalk.magenta('🐳 DDEV')}`;
                resolve();
            } catch (err) {
                reject(err);
            }
            return;
        }
        
        // More realistic import speed estimation (compressed files are smaller but import takes similar time)
        // Use uncompressed size for time estimate if compressed
        const estimatedUncompressedSize = isCompressed ? sqlFileSize * 10 : sqlFileSize;
        // Conservative 5MB/s for actual SQL import (decompression + MySQL insert)
        const estimatedDuration = (estimatedUncompressedSize / (5 * 1024 * 1024)) * 1000;
        
        let lastPercentage = 0;
        
        // Update progress every second
        const progressInterval = setInterval(() => {
            const elapsed = Date.now() - startTime;
            let percentage = Math.round((elapsed / estimatedDuration) * 100);
            
            // More gradual slowdown as we approach completion
            if (percentage > 90) {
                percentage = 90 + Math.min(9, Math.round((percentage - 90) / 2));
            }
            percentage = Math.min(99, percentage); // Cap at 99% until actual completion
            
            // Only update if percentage increased (avoid going backwards)
            if (percentage > lastPercentage) {
                lastPercentage = percentage;
            } else {
                percentage = lastPercentage;
            }
            
            const progressBar = EnhancedProgress.createProgressBar(percentage, 20);
            
            // For display, show progress against the estimated uncompressed size (not compressed file size)
            const displaySize = isCompressed ? estimatedUncompressedSize : sqlFileSize;
            const estimatedBytes = Math.min(displaySize, (percentage / 100) * displaySize);
            const speed = elapsed > 0 ? (estimatedBytes / (elapsed / 1000)) : 0;
            
            const statusText = percentage >= 95 ? chalk.yellow('(finishing up...)') : '';
            const compressionType = sqlFilePath.endsWith('.zst') ? 'zstd' : (sqlFilePath.endsWith('.gz') ? 'gzip' : '');
            const compressionNote = isCompressed ? chalk.dim(` (${compressionType})`) : '';
            task.output = `${progressBar} ${chalk.bold.cyan(percentage + '%')} ${chalk.gray(ProgressDisplay.formatBytes(estimatedBytes) + ' / ' + ProgressDisplay.formatBytes(displaySize))}${compressionNote} ${chalk.cyan('~' + ProgressDisplay.formatSpeed(speed))} ${statusText} ${chalk.magenta('🐳 DDEV')}`;
        }, 1000);
        
        try {
            // Run the actual DDEV import (DDEV handles .gz and .zst automatically)
            let filename = `${config.serverVariables.databaseName}.sql`;
            if (isCompressed) {
                filename = sqlFilePath.endsWith('.zst') ? 
                    `${config.serverVariables.databaseName}.sql.zst` : 
                    `${config.serverVariables.databaseName}.sql.gz`;
            }
            await localhostMagentoRootExec(`ddev import-db --src=${filename}`, config);
            
            clearInterval(progressInterval);
            const finalSize = isCompressed ? estimatedUncompressedSize : sqlFileSize;
            const compressionType = sqlFilePath.endsWith('.zst') ? 'zstd' : (sqlFilePath.endsWith('.gz') ? 'gzip' : '');
            const compressionNote = isCompressed ? chalk.dim(` (${compressionType})`) : '';
            task.output = `${EnhancedProgress.createProgressBar(100, 20)} ${chalk.bold.cyan('100%')} ${chalk.gray(ProgressDisplay.formatBytes(finalSize))}${compressionNote} ${chalk.green('✓')}`;
            resolve();
        } catch (err) {
            clearInterval(progressInterval);
            reject(err);
        }
    }

    configure = async (list: any, config: any) => {
        await this.addTasks(list, config);
        return list;
    }

    // Add tasks
    addTasks = async (list: any, config: any) => {
        list.add(
            {
                title: 'Import Magento database to localhost',
                task: (ctx: any, task: any): Listr =>
                task.newListr(
                    this.importTasks
                )
            }
        )

        let importTitle = "Importing database";
        if (config.settings.isDdevActive) {
            importTitle = "Importing database (DDEV)";
        }

        this.importTasks.push(
            {
                title: importTitle,
                task: async (ctx: any, task: any): Promise<void> => {
                    const logger = this.services.getLogger();
                    const startTime = Date.now();
                    
                    logger.info('Starting database import', { 
                        database: config.serverVariables.databaseName,
                        optimized: this.useParallelImport 
                    });

                    if (config.settings.isDdevActive) {
                        // DDEV environment
                        task.output = EnhancedProgress.step(1, 3, 'Creating DDEV database...');
                        let mysqlCommand1 = `ddev mysql -uroot -proot -hdb -e "CREATE DATABASE IF NOT EXISTS ${config.serverVariables.databaseName};"""`;
                        let mysqlCommand2 = `ddev mysql -uroot -proot -hdb -e "GRANT ALL PRIVILEGES ON *.* TO 'db'@'localhost';"""`
                        let mysqlCommand3 = `ddev mysql -uroot -proot -hdb -e "GRANT ALL PRIVILEGES ON *.* TO 'db'@'%';"""`
                        await localhostMagentoRootExec(mysqlCommand1, config, true);
                        await localhostMagentoRootExec(mysqlCommand2, config, true);
                        await localhostMagentoRootExec(mysqlCommand3, config, true);
                        
                        task.output = EnhancedProgress.step(2, 3, 'Updating Magerun2...');
                        await localhostMagentoRootExec(`ddev exec /usr/bin/php8.1 /usr/local/bin/magerun2 self-update 7.5.0 > /dev/null 2>&1`, config, true);
                        
                        task.output = 'Importing SQL file...';
                        logger.info('Starting DDEV database import', { file: `${config.serverVariables.databaseName}.sql` });
                        
                        // Get SQL file size for progress tracking - try multiple possible locations
                        const currentFolder = config.settings.currentFolder || process.cwd();
                        const possiblePaths = [
                            `${currentFolder}/${config.serverVariables.databaseName}.sql.zst`,
                            `${currentFolder}/${config.serverVariables.databaseName}.sql.gz`,
                            `${currentFolder}/${config.serverVariables.databaseName}.sql`,
                            `${currentFolder}/${config.databases.databaseData.database}.sql.zst`,
                            `${currentFolder}/${config.databases.databaseData.database}.sql.gz`,
                            `${currentFolder}/${config.databases.databaseData.database}.sql`,
                            `${currentFolder}/database.sql.zst`,
                            `${currentFolder}/database.sql.gz`,
                            `${currentFolder}/database.sql`
                        ];
                        
                        let sqlFilePath = '';
                        let sqlFileSize = 0;
                        let isCompressed = false;
                        
                        // Also show user which paths we're checking
                        task.output = `Locating SQL file...`;
                        
                        for (const path of possiblePaths) {
                            logger.debug('Checking for SQL file', { path, exists: fs.existsSync(path) });
                            if (fs.existsSync(path)) {
                                sqlFilePath = path;
                                sqlFileSize = fs.statSync(path).size;
                                isCompressed = path.endsWith('.gz') || path.endsWith('.zst');
                                const compressionType = path.endsWith('.zst') ? 'zstd' : (path.endsWith('.gz') ? 'gzip' : 'none');
                                logger.info('Found SQL file', { path, size: sqlFileSize, compressed: isCompressed, compressionType });
                                task.output = `Found SQL file: ${ProgressDisplay.formatBytes(sqlFileSize)}${isCompressed ? ` (${compressionType})` : ' (uncompressed)'}`;
                                break;
                            }
                        }
                        
                        if (!sqlFilePath || sqlFileSize === 0) {
                            logger.warn('SQL file not found or empty, using fallback import', { 
                                tried: possiblePaths,
                                databaseName: config.serverVariables.databaseName,
                                currentFolder
                            });
                            
                            // List all .sql files in the directory to help debug
                            try {
                                const files = fs.readdirSync(currentFolder);
                                const sqlFiles = files.filter((f: string) => f.endsWith('.sql') || f.endsWith('.sql.gz') || f.endsWith('.sql.zst'));
                                logger.info('Available SQL files in directory', { 
                                    directory: currentFolder,
                                    sqlFiles 
                                });
                                
                                if (sqlFiles.length > 0) {
                                    task.output = `Found ${sqlFiles.length} SQL file(s): ${sqlFiles.join(', ')}`;
                                    
                                    // Prefer .gz files
                                    const gzFiles = sqlFiles.filter((f: string) => f.endsWith('.gz'));
                                    const fileToUse = gzFiles.length > 0 ? gzFiles[0] : sqlFiles[0];
                                    
                                    sqlFilePath = `${currentFolder}/${fileToUse}`;
                                    sqlFileSize = fs.statSync(sqlFilePath).size;
                                    isCompressed = fileToUse.endsWith('.gz');
                                    logger.info('Using first SQL file found', { path: sqlFilePath, size: sqlFileSize, compressed: isCompressed });
                                    task.output = `Using: ${fileToUse} (${ProgressDisplay.formatBytes(sqlFileSize)})`;
                                } else {
                                    task.output = `No SQL files found in: ${currentFolder}`;
                                }
                            } catch (e) {
                                logger.error('Error listing directory', e as Error);
                                task.output = `Error scanning directory: ${currentFolder}`;
                            }
                        }
                        
                        // Import with progress tracking (DDEV)
                        await this.importWithProgressDdev(task, config, sqlFilePath, sqlFileSize, isCompressed);
                    } else {
                        // Standard environment with speed optimizations
                        task.output = EnhancedProgress.step(1, 3, 'Creating database...');
                        await localhostMagentoRootExec(`${config.settings.magerun2CommandLocal} db:create -q`, config);
                        
                        task.output = EnhancedProgress.step(2, 3, 'Importing SQL file...');
                        logger.info('Starting SQL import', { file: `${config.serverVariables.databaseName}.sql` });
                        
                        // Get SQL file size for progress tracking - try multiple possible locations
                        const currentFolder = config.settings.currentFolder || process.cwd();
                        const possiblePaths = [
                            `${currentFolder}/${config.serverVariables.databaseName}.sql.zst`,
                            `${currentFolder}/${config.serverVariables.databaseName}.sql.gz`,
                            `${currentFolder}/${config.serverVariables.databaseName}.sql`,
                            `${currentFolder}/${config.databases.databaseData.database}.sql.zst`,
                            `${currentFolder}/${config.databases.databaseData.database}.sql.gz`,
                            `${currentFolder}/${config.databases.databaseData.database}.sql`,
                            `${currentFolder}/database.sql.zst`,
                            `${currentFolder}/database.sql.gz`,
                            `${currentFolder}/database.sql`
                        ];
                        
                        let sqlFilePath = '';
                        let sqlFileSize = 0;
                        let isCompressed = false;
                        
                        task.output = `Locating SQL file...`;
                        
                        for (const path of possiblePaths) {
                            logger.debug('Checking for SQL file', { path, exists: fs.existsSync(path) });
                            if (fs.existsSync(path)) {
                                sqlFilePath = path;
                                sqlFileSize = fs.statSync(path).size;
                                logger.info('Found SQL file', { path, size: sqlFileSize });
                                task.output = `Found SQL file: ${ProgressDisplay.formatBytes(sqlFileSize)}`;
                                break;
                            }
                        }
                        
                        if (!sqlFilePath || sqlFileSize === 0) {
                            logger.warn('SQL file not found or empty', { 
                                tried: possiblePaths,
                                databaseName: config.serverVariables.databaseName,
                                magentoRoot: currentFolder
                            });
                            
                            // Show user what we tried
                            task.output = `SQL file not found. Scanning directory...`;
                            
                            // List all .sql files in the directory to help debug
                            try {
                                const files = fs.readdirSync(currentFolder);
                                const sqlFiles = files.filter((f: string) => f.endsWith('.sql'));
                                logger.info('Available SQL files in directory', { 
                                    directory: currentFolder,
                                    sqlFiles 
                                });
                                
                                if (sqlFiles.length > 0) {
                                    task.output = `Found ${sqlFiles.length} SQL file(s): ${sqlFiles.join(', ')}`;
                                    
                                    // Use the first one
                                    sqlFilePath = `${currentFolder}/${sqlFiles[0]}`;
                                    sqlFileSize = fs.statSync(sqlFilePath).size;
                                    logger.info('Using first SQL file found', { path: sqlFilePath, size: sqlFileSize });
                                    task.output = `Using: ${sqlFiles[0]} (${ProgressDisplay.formatBytes(sqlFileSize)})`;
                                } else {
                                    task.output = `No SQL files found in: ${currentFolder}`;
                                }
                            } catch (e) {
                                logger.error('Error listing directory', e as Error);
                                task.output = `Error scanning directory: ${currentFolder}`;
                            }
                        }
                        
                        // Import with progress tracking
                        await this.importWithProgress(task, config, sqlFilePath, sqlFileSize, isCompressed);
                        
                        task.output = EnhancedProgress.step(3, 3, 'Adding authorization entries...');
                        await localhostMagentoRootExec(`${config.settings.magerun2CommandLocal} db:add-default-authorization-entries -q`, config);
                    }

                    const duration = Date.now() - startTime;
                    const formattedDuration = ProgressDisplay.formatDuration(duration);
                    
                    logger.info('Database import complete', { duration });
                    task.title = `${importTitle} ✓ (${formattedDuration})`;
                }
            }
        );

        this.importTasks.push(
            {
                title: 'Cleaning up',
                task: async (ctx: any, task: any): Promise<void> => {
                    const logger = this.services.getLogger();
                    task.output = 'Removing temporary SQL file...';
                    
                    // Remove local SQL file (all formats: .sql, .sql.gz, .sql.zst)
                    await localhostMagentoRootExec(`rm -f ${config.serverVariables.databaseName}.sql ${config.serverVariables.databaseName}.sql.gz ${config.serverVariables.databaseName}.sql.zst`, config, true);
                    
                    task.output = '✓ Cleanup complete';
                    logger.info('Cleanup complete', { removed: `${config.serverVariables.databaseName}.sql.zst` });
                }
            }
        );
    }
}

export default ImportTask
