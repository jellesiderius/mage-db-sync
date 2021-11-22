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
