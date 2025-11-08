import {localhostMagentoRootExec, success} from '../utils/Console';
import { Listr } from 'listr2';

interface TaskItem {
    title: string;
    task: (ctx?: any, task?: any) => Promise<void | boolean>;
    skip?: string | (() => boolean);
}

class ImportTask {
    private importTasks: TaskItem[] = [];

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
                task: async (): Promise<void> => {
                    if (config.settings.isDdevActive) {
                        let mysqlCommand1 = `ddev mysql -uroot -proot -hdb -e "CREATE DATABASE IF NOT EXISTS ${config.serverVariables.databaseName};"""`;
                        let mysqlCommand2 = `ddev mysql -uroot -proot -hdb -e "GRANT ALL PRIVILEGES ON *.* TO 'db'@'localhost';"""`
                        let mysqlCommand3 = `ddev mysql -uroot -proot -hdb -e "GRANT ALL PRIVILEGES ON *.* TO 'db'@'%';"""`
                        await localhostMagentoRootExec(mysqlCommand1, config, true);
                        await localhostMagentoRootExec(mysqlCommand2, config, true);
                        await localhostMagentoRootExec(mysqlCommand3, config, true);
                        await localhostMagentoRootExec(`ddev exec /usr/bin/php8.1 /usr/local/bin/magerun2 self-update 7.5.0 > /dev/null 2>&1`, config, true);
                        await localhostMagentoRootExec(`ddev import-db --src=${config.serverVariables.databaseName}.sql`, config);
                    } else {
                        // Create database
                        await localhostMagentoRootExec(`${config.settings.magerun2CommandLocal} db:create -q`, config);
                        // Import SQL file to database
                        await localhostMagentoRootExec(`${config.settings.magerun2CommandLocal} db:import ${config.serverVariables.databaseName}.sql --force --skip-authorization-entry-creation -q --drop`, config);
                        // Add default admin authorization rules (Fix for missing auth roles)
                        await localhostMagentoRootExec(`${config.settings.magerun2CommandLocal} db:add-default-authorization-entries -q`, config);
                    }
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
