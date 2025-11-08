import {localhostMagentoRootExec, success} from '../utils/Console';
import { Listr } from 'listr2';
import { ServiceContainer } from '../core/ServiceContainer';
import { ProgressDisplay } from '../utils/ProgressDisplay';
import { EnhancedProgress } from '../utils/EnhancedProgress';
import { UI } from '../utils/UI';
import chalk from 'chalk';

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
                        
                        task.output = EnhancedProgress.step(3, 3, 'Importing database...');
                        await localhostMagentoRootExec(`ddev import-db --src=${config.serverVariables.databaseName}.sql`, config);
                    } else {
                        // Standard environment with speed optimizations
                        task.output = EnhancedProgress.step(1, 3, 'Creating database...');
                        await localhostMagentoRootExec(`${config.settings.magerun2CommandLocal} db:create -q`, config);
                        
                        task.output = EnhancedProgress.step(2, 3, 'Importing SQL file (this may take a few minutes)...');
                        logger.info('Starting SQL import', { file: `${config.serverVariables.databaseName}.sql` });
                        
                        // Import with optimized flags
                        await localhostMagentoRootExec(`${config.settings.magerun2CommandLocal} db:import ${config.serverVariables.databaseName}.sql --force --skip-authorization-entry-creation -q --drop`, config);
                        
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
                    
                    // Remove local SQL file
                    await localhostMagentoRootExec('rm ' + config.serverVariables.databaseName + '.sql', config);
                    
                    task.output = '✓ Cleanup complete';
                    logger.info('Cleanup complete', { removed: `${config.serverVariables.databaseName}.sql` });
                }
            }
        );
    }
}

export default ImportTask
