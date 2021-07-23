import { localhostMagentoRootExec } from '../utils/console';
import { Listr } from 'listr2';
import * as shelljs from "shelljs";

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
                title: 'Preparing database file',
                task: async (): Promise<void> => {
                    let localDatabaseCheck = await localhostMagentoRootExec('magerun2 db:info --format=json', config);
                    // @ts-ignore
                    if (localDatabaseCheck && localDatabaseCheck.length > 0) {
                        try {
                            const obj = JSON.parse(<string>localDatabaseCheck);
                            if (obj && typeof obj === `object`) {
                                let localDatabaseName = JSON.parse(localDatabaseCheck)[1].Value;
                                let from = 'ALTER DATABASE `' + config.serverVariables.databaseName + '`'
                                let to = 'ALTER DATABASE `' + localDatabaseName + '`'

                                // @ts-ignore
                                await shelljs.sed('-i', from, to, `${config.settings.currentFolder}/${config.serverVariables.databaseName}.sql`).a;
                            }
                        } catch (err) {}
                    }
                }
            }
        )
        
        this.importTasks.push(
            {
                title: 'Importing database',
                task: async (): Promise<void> => {
                    // Import SQL file to database
                    await localhostMagentoRootExec(`magerun2 db:import ${config.serverVariables.databaseName}.sql --drop`, config);
                    // Add default admin authorization rules (Fix for missing auth roles)
                    await localhostMagentoRootExec(`magerun2 db:add-default-authorization-entries`, config);
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