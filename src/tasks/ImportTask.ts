import { localhostMagentoRootExec } from '../utils/Console';
import { Listr } from 'listr2';
import { ServiceContainer } from '../core/ServiceContainer';
import { ProgressDisplay } from '../utils/ProgressDisplay';
import { EnhancedProgress } from '../utils/EnhancedProgress';
import chalk from 'chalk';
import * as fs from 'fs';

interface TaskItem {
    title: string;
    task: (ctx?: any, task?: any) => Promise<void | boolean>;
    skip?: string | (() => boolean);
}

class ImportTask {
    private importTasks: TaskItem[] = [];
    private services: ServiceContainer;

    constructor() {
        this.services = ServiceContainer.getInstance();
    }

    /**
     * Simplified import using magerun2 db:import exclusively
     * magerun2 handles gzip compression natively!
     */
    private async importDatabase(
        task: any, 
        config: any, 
        sqlFilePath: string, 
        sqlFileSize: number
    ): Promise<void> {
        const logger = this.services.getLogger();
        const startTime = Date.now();
        
        // Detect compression type from filename (only gzip supported)
        const compressionType = sqlFilePath.endsWith('.gz') ? 'gzip' : 'none';
        const isCompressed = compressionType !== 'none';
        
        logger.info('Starting magerun2 database import', { 
            file: sqlFilePath,
            size: sqlFileSize,
            compressed: isCompressed,
            compressionType
        });
        
        // Estimate import duration (~10MB/s for compressed, ~5MB/s for uncompressed)
        const speed = isCompressed ? 10 * 1024 * 1024 : 5 * 1024 * 1024;
        const estimatedDuration = sqlFileSize > 0 ? (sqlFileSize / speed) * 1000 : 60000;
        
        // Show file info
        const sizeInfo = ProgressDisplay.formatBytes(sqlFileSize);
        const compressionInfo = isCompressed ? chalk.dim(` (${compressionType})`) : '';
        task.output = `Importing ${sizeInfo}${compressionInfo} database...`;
        
        // Start progress estimation
        let progressInterval: NodeJS.Timeout;
        let lastPercentage = 0;
        
        progressInterval = setInterval(() => {
            const elapsed = Date.now() - startTime;
            let percentage = Math.min(95, Math.round((elapsed / estimatedDuration) * 100));
            
            // Avoid going backwards
            if (percentage > lastPercentage) {
                lastPercentage = percentage;
            } else {
                percentage = lastPercentage;
            }
            
            const progressBar = EnhancedProgress.createProgressBar(percentage, 20);
            const estimatedBytes = Math.min(sqlFileSize, (percentage / 100) * sqlFileSize);
            const avgSpeed = elapsed > 0 ? (estimatedBytes / (elapsed / 1000)) : 0;
            
            const statusText = percentage >= 90 ? chalk.yellow('(finishing...)') : '';
            task.output = `${progressBar} ${chalk.bold.cyan(percentage + '%')} ${chalk.gray(ProgressDisplay.formatBytes(estimatedBytes) + ' / ' + sizeInfo)}${compressionInfo} ${chalk.cyan('~' + ProgressDisplay.formatSpeed(avgSpeed))} ${statusText}`;
        }, 1000);
        
        try {
            // Use magerun2 db:import with explicit compression flag
            // NOTE: --compression and --optimize are mutually exclusive!
            const filename = sqlFilePath.split('/').pop(); // Get just the filename
            
            // Build import command
            let importCommand = `${config.settings.magerun2CommandLocal} db:import ${filename}`;
            
            // Add compression flag if file is compressed
            // NOTE: --optimize doesn't work with compression, so we skip it for compressed files
            if (isCompressed) {
                importCommand += ` --compression=${compressionType}`;
            } else {
                // Only use --optimize for uncompressed files (not compatible with --compression)
                importCommand += ` --optimize`;
            }
            
            importCommand += ` --drop` +  // Drop and recreate database
                           ` --force` + // Continue on SQL errors
                           ` --skip-authorization-entry-creation` + // We'll add them later
                           ` -q`; // Quiet mode
            
            logger.info('Executing magerun2 db:import', { 
                command: importCommand,
                compressionType,
                hasCompressionFlag: isCompressed,
                hasOptimize: !isCompressed // Only optimize uncompressed files
            });
            
            await localhostMagentoRootExec(importCommand, config);
            
            clearInterval(progressInterval);
            
            // Add authorization entries
            task.output = 'Adding authorization entries...';
            await localhostMagentoRootExec(
                `${config.settings.magerun2CommandLocal} db:add-default-authorization-entries -q`, 
                config
            );
            
            const duration = Date.now() - startTime;
            const finalSize = sqlFileSize;
            task.output = `${EnhancedProgress.createProgressBar(100, 20)} ${chalk.bold.cyan('100%')} ${chalk.gray(ProgressDisplay.formatBytes(finalSize))}${compressionInfo} ${chalk.green('✓')}`;
            
            logger.info('Database import complete', { 
                duration,
                size: finalSize,
                compressionType
            });
            
        } catch (err) {
            clearInterval(progressInterval);
            logger.error('Database import failed', err as Error);
            throw err;
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
                        database: config.serverVariables.databaseName
                    });

                    // Create database first
                    task.output = 'Creating database...';
                    await localhostMagentoRootExec(
                        `${config.settings.magerun2CommandLocal} db:create -q`, 
                        config
                    );
                    
                    // Find SQL file
                    task.output = 'Locating SQL file...';
                    
                    const currentFolder = config.settings.currentFolder || process.cwd();
                    const possibleExtensions = ['.sql.gz', '.sql'];
                    const possiblePaths = [];
                    
                    // Build list of possible paths with supported extensions
                    for (const ext of possibleExtensions) {
                        possiblePaths.push(`${currentFolder}/${config.serverVariables.databaseName}${ext}`);
                        if (config.databases?.databaseData?.database) {
                            possiblePaths.push(`${currentFolder}/${config.databases.databaseData.database}${ext}`);
                        }
                        possiblePaths.push(`${currentFolder}/database${ext}`);
                    }
                    
                    let sqlFilePath = '';
                    let sqlFileSize = 0;
                    
                    // Try to find the SQL file
                    for (const path of possiblePaths) {
                        if (fs.existsSync(path)) {
                            sqlFilePath = path;
                            sqlFileSize = fs.statSync(path).size;
                            
                            const compressionType = path.endsWith('.gz') ? 'gzip' : 'none';
                            const isCompressed = compressionType !== 'none';
                            
                            logger.info('Found SQL file', { 
                                path, 
                                size: sqlFileSize, 
                                compressed: isCompressed, 
                                compressionType 
                            });
                            
                            task.output = `Found SQL file: ${ProgressDisplay.formatBytes(sqlFileSize)}${isCompressed ? ` (${compressionType})` : ' (uncompressed)'}`;
                            break;
                        }
                    }
                    
                    // If not found, scan directory
                    if (!sqlFilePath || sqlFileSize === 0) {
                        logger.warn('SQL file not found in expected locations, scanning directory...', { 
                            tried: possiblePaths,
                            currentFolder
                        });
                        
                        try {
                            const files = fs.readdirSync(currentFolder);
                            const sqlFiles = files.filter((f: string) => 
                                f.endsWith('.sql') || 
                                f.endsWith('.sql.gz')
                            );
                            
                            if (sqlFiles.length > 0) {
                                // Prefer gzip compressed files over uncompressed
                                const gzFiles = sqlFiles.filter((f: string) => f.endsWith('.gz'));
                                const fileToUse = gzFiles.length > 0 ? gzFiles[0] : sqlFiles[0];
                                
                                sqlFilePath = `${currentFolder}/${fileToUse}`;
                                sqlFileSize = fs.statSync(sqlFilePath).size;
                                
                                const compressionType = fileToUse.endsWith('.gz') ? 'gzip' : 'none';
                                
                                logger.info('Using SQL file found in directory', { 
                                    path: sqlFilePath, 
                                    size: sqlFileSize, 
                                    compressionType 
                                });
                                
                                task.output = `Using: ${fileToUse} (${ProgressDisplay.formatBytes(sqlFileSize)})`;
                            } else {
                                throw new Error(`No SQL files found in: ${currentFolder}`);
                            }
                        } catch (e) {
                            logger.error('Error scanning directory', e as Error);
                            throw new Error(`Cannot find SQL file in: ${currentFolder}`);
                        }
                    }
                    
                    // Import the database using magerun2 db:import
                    await this.importDatabase(task, config, sqlFilePath, sqlFileSize);
                    
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
                    task.output = 'Removing temporary SQL files...';
                    
                    // Clean up SQL files (both compressed and uncompressed)
                    const cleanupFiles = `${config.serverVariables.databaseName}.sql ${config.serverVariables.databaseName}.sql.gz`;
                    
                    await localhostMagentoRootExec(
                        `rm -f ${cleanupFiles}`, 
                        config, 
                        true
                    );
                    
                    logger.info('Cleanup complete', { 
                        removed: cleanupFiles
                    });
                    
                    task.output = 'Cleanup complete ✓';
                }
            }
        );
    }
}

export default ImportTask
