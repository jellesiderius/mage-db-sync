import { localhostMagentoRootExec } from '../utils/console';
import { Listr } from 'listr2';

class ImportTask {
    private importTasks = [];

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

        this.importTasks.push(
            {
                title: 'Importing database',
                task: async (): Promise<void> => {
                    // Drop database
                    await localhostMagentoRootExec(`magerun2 db:drop -f -q`, config);
                    // Create database
                    await localhostMagentoRootExec(`magerun2 db:create -q`, config);
                    // Import SQL file to database
                    await localhostMagentoRootExec(`magerun2 db:import ${config.serverVariables.databaseName}.sql --force --skip-authorization-entry-creation -q`, config);
                    // Add default admin authorization rules (Fix for missing auth roles)
                    await localhostMagentoRootExec(`magerun2 db:add-default-authorization-entries -q`, config);
                }
            }
        );

        if (config.settings.syncImages == 'yes') {
            this.importTasks.push(
                {
                    title: 'Synchronizing media images',
                    task: async (): Promise<void> => {
                        // Sync media
                        await localhostMagentoRootExec(`rsync -avz -e "ssh -p ${config.databases.databaseData.port}" ${config.databases.databaseData.username}@${config.databases.databaseData.server}:${config.serverVariables.magentoRoot}/pub/media/* pub/media/ --exclude 'cache' --exclude 'catalog/product/cache' --exclude 'catalog/category/cache' --exclude 'custom_options' --exclude 'tmp' --exclude 'analytics'`, config, true);
                    }
                }
            );
        }

        this.importTasks.push(
            {
                title: 'Cleaning up',
                task: async (): Promise<void> => {
                    // Remove local SQL file
                    await localhostMagentoRootExec('rm ' + config.serverVariables.databaseName + '.sql', config);
                }
            }
        );
    }
}

export default ImportTask
