import * as fs from 'fs'
import { consoleCommand } from '../utils/console';

class ChecksTask {
    configure = async (list: any, config: any) => {
        await this.addTasks(list, config);
        return list;
    }

    // Add tasks
    addTasks = async (list: any, config: any) => {
        if (config.settings.import && config.settings.import == 'yes') {
            // Check Magerun 2 version
            list.add(
                {
                    title: 'Checking Magerun2 version',
                    task: async (ctx: any, task: any): Promise<boolean> => {
                         // Check the local installed Magerun2 version before we continue and import the database
                         let installedMagerun2Version = await consoleCommand('magerun2 -V');
                         // @ts-ignore
                         installedMagerun2Version = installedMagerun2Version.split(' ')[1];
                         // @ts-ignore

                        if (installedMagerun2Version < config.requirements.magerun2Version) {
                            throw new Error(`Your current Magerun2 version is too low. Magerun version ${config.requirements.magerun2Version} is required`);
                        }
                        
                        return true;
                    }
                }
            );
        }

        // Check if target folder exists before downloading
        list.add(
            {
                title: 'Checking if download folder exists',
                task: async (): Promise<Boolean> => {
                    // Check if download folder exists
                    if (fs.existsSync(config.customConfig.localDatabaseFolderLocation)) {
                        return true;
                    }

                    throw new Error(`Download folder ${config.customConfig.localDatabaseFolderLocation} does not exist. This can be configured in config/settings.json`);
                }
            }
        );

        // Check if SSH key exists
        list.add(
            {
                title: 'Checking if SSH key exists',
                task: async (): Promise<Boolean> => {
                    if (fs.existsSync(config.customConfig.sshKeyLocation)) {
                        return true;
                    }

                    throw new Error(`SSH key ${config.customConfig.sshKeyLocation} does not exist. This can be configured in config/settings.json`);
                }
            }
        );

    }
}

export default ChecksTask