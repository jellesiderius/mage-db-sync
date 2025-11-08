import {localhostMagentoRootExec, success} from '../utils/Console';
import { Listr } from 'listr2';
import { ServiceContainer } from '../core/ServiceContainer';
import { ProgressDisplay } from '../utils/ProgressDisplay';
import { EnhancedProgress } from '../utils/EnhancedProgress';
import { UI } from '../utils/UI';
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

    // Import with pv (pipe viewer) for accurate progress
    private importWithPv(task: any, config: any, sqlFilePath: string, sqlFileSize: number, resolve: any, reject: any, isCompressed: boolean = false): void {
        const startTime = Date.now();
        let lastUpdate = Date.now();
        
        // Get MySQL credentials from magerun
        const dbInfoCmd = `${config.settings.magerun2CommandLocal} db:info --format=json`;
        const { execSync } = require('child_process');
        const currentFolder = config.settings.currentFolder || process.cwd();
        
        let mysqlCmd = 'mysql';
        try {
            const dbInfo = JSON.parse(execSync(dbInfoCmd, { cwd: currentFolder, encoding: 'utf8' }));
            mysqlCmd = `mysql -h${dbInfo.host || 'localhost'} -u${dbInfo.username || 'root'} ${dbInfo.password ? '-p' + dbInfo.password : ''} ${dbInfo.database || ''}`;
        } catch (e) {
            // Fall back to basic mysql command
        }
        
        // Use pv to track progress with automatic decompression if needed
        const decompressCmd = isCompressed ? 'gunzip | ' : '';
        const pvProcess = spawn('sh', ['-c', `pv -f "${sqlFilePath}" | ${decompressCmd}${mysqlCmd}`], {
            cwd: currentFolder
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
            // Run the actual import with decompression if needed
            const filename = isCompressed ? 
                `<(gunzip < ${config.serverVariables.databaseName}.sql.gz)` : 
                `${config.serverVariables.databaseName}.sql`;
            
            await localhostMagentoRootExec(`${config.settings.magerun2CommandLocal} db:import ${filename} --force --skip-authorization-entry-creation -q --drop`, config);
            
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
        
        // Use pv to track progress with automatic decompression if needed
        const currentFolder = config.settings.currentFolder || process.cwd();
        const decompressCmd = isCompressed ? 'gunzip | ' : '';
        const pvProcess = spawn('sh', ['-c', `pv -f "${sqlFilePath}" | ${decompressCmd}ddev mysql -uroot -proot -hdb ${config.serverVariables.databaseName}`], {
            cwd: currentFolder
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
                
                task.output = `${progressBar} ${chalk.bold.cyan(percentage + '%')} ${chalk.gray(ProgressDisplay.formatBytes(bytesRead) + ' / ' + ProgressDisplay.formatBytes(sqlFileSize))} ${chalk.green('↓')} ${chalk.cyan(ProgressDisplay.formatSpeed(speed))}${eta > 0 && eta < 600 ? chalk.gray(' ETA: ' + eta + 's') : ''} ${chalk.magenta('🐳 DDEV')}`;
                
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
            
            const estimatedBytes = Math.min(sqlFileSize, (percentage / 100) * sqlFileSize);
            const speed = elapsed > 0 ? (estimatedBytes / (elapsed / 1000)) : 0;
            
            const statusText = percentage >= 95 ? chalk.yellow('(finishing up...)') : '';
            task.output = `${progressBar} ${chalk.bold.cyan(percentage + '%')} ${chalk.gray(ProgressDisplay.formatBytes(estimatedBytes) + ' / ' + ProgressDisplay.formatBytes(sqlFileSize))} ${chalk.cyan('~' + ProgressDisplay.formatSpeed(speed))} ${statusText} ${chalk.magenta('🐳 DDEV')}`;
        }, 1000);
        
        try {
            // Run the actual DDEV import (DDEV handles .gz automatically)
            const filename = isCompressed ? 
                `${config.serverVariables.databaseName}.sql.gz` : 
                `${config.serverVariables.databaseName}.sql`;
            await localhostMagentoRootExec(`ddev import-db --src=${filename}`, config);
            
            clearInterval(progressInterval);
            task.output = `${EnhancedProgress.createProgressBar(100, 20)} ${chalk.bold.cyan('100%')} ${chalk.gray(ProgressDisplay.formatBytes(sqlFileSize))} ${chalk.green('✓')}`;
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
                            `${currentFolder}/${config.serverVariables.databaseName}.sql.gz`,
                            `${currentFolder}/${config.serverVariables.databaseName}.sql`,
                            `${currentFolder}/${config.databases.databaseData.database}.sql.gz`,
                            `${currentFolder}/${config.databases.databaseData.database}.sql`,
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
                                isCompressed = path.endsWith('.gz');
                                logger.info('Found SQL file', { path, size: sqlFileSize, compressed: isCompressed });
                                task.output = `Found SQL file: ${ProgressDisplay.formatBytes(sqlFileSize)}${isCompressed ? ' (compressed)' : ''}`;
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
                                const sqlFiles = files.filter((f: string) => f.endsWith('.sql') || f.endsWith('.sql.gz'));
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
                            `${currentFolder}/${config.serverVariables.databaseName}.sql.gz`,
                            `${currentFolder}/${config.serverVariables.databaseName}.sql`,
                            `${currentFolder}/${config.databases.databaseData.database}.sql.gz`,
                            `${currentFolder}/${config.databases.databaseData.database}.sql`,
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
                    
                    // Remove local SQL file (both .sql and .sql.gz)
                    await localhostMagentoRootExec(`rm -f ${config.serverVariables.databaseName}.sql ${config.serverVariables.databaseName}.sql.gz`, config, true);
                    
                    task.output = '✓ Cleanup complete';
                    logger.info('Cleanup complete', { removed: `${config.serverVariables.databaseName}.sql.gz` });
                }
            }
        );
    }
}

export default ImportTask
