import { localhostMagentoRootExec } from '../utils/console';
import { Listr } from 'listr2';
import configFile from '../../config/settings.json'

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
                title: 'Checking if config/settings.json is correctly filled',
                task: async (): Promise<void> => {
                    // Lets make sure everything is filled in
                    if (configFile.magentoBackend.adminUsername.length == 0) {
                        throw new Error('Admin username is missing config/settings.json');
                    }

                    if (configFile.magentoBackend.adminPassword.length == 0) {
                        throw new Error('Admin password is missing in config/settings.json');
                    }

                    if (configFile.magentoBackend.adminEmailAddress.length == 0) {
                        throw new Error('Admin email address is missing in config/settings.json');
                    }

                    if (configFile.general.localDomainExtension.length == 0) {
                        throw new Error('Local domain extension is missing in config/settings.json');
                    }

                    if (configFile.general.elasticsearchPort.length == 0) {
                        throw new Error('ElasticSearch port is missing in config/settings.json');
                    }
                }
            }
        );
        
        this.importTasks.push(
            {
                title: 'Creating database',
                task: async (): Promise<void> => {
                    // Create a database
                    await localhostMagentoRootExec('magerun2 db:create', config);
                }
            }
        );
        
        this.importTasks.push(
            {
                title: 'Importing database',
                task: async (): Promise<void> => {
                    // Import SQL file to database
                    await localhostMagentoRootExec('magerun2 db:import ' + config.serverVariables.databaseName + '.sql', config);
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