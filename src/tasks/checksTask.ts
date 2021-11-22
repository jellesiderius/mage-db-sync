import * as fs from 'fs'
import { Listr } from 'listr2';
import { consoleCommand } from '../utils/console';
import configFile from '../../config/settings.json'

class ChecksTask {
    private checkTasks = [];

    configure = async (list: any, config: any, ssh: any) => {
        await this.addTasks(list, config, ssh);
        return list;
    }

    // Add tasks
    addTasks = async (list: any, config: any, ssh: any) => {
        list.add(
            {
                title: 'Running some checks',
                task: (ctx: any, task: any): Listr =>
                task.newListr(
                    this.checkTasks
                )
            }
        )

        if (config.settings.import && config.settings.import == 'yes' || config.settings.wordpressImport && config.settings.wordpressImport == "yes" && config.settings.currentFolderhasWordpress) {
            // Check if all settings are filled in, if we import
            this.checkTasks.push(
                {
                    title: 'Checking if config/settings.json is correctly filled',
                    task: async (): Promise<void> => {
                        // Lets make sure everything is filled in
                        if (!configFile.magentoBackend.adminUsername || configFile.magentoBackend.adminUsername && configFile.magentoBackend.adminUsername.length == 0) {
                            throw new Error('Admin username is missing config/settings.json');
                        }

                        if (!configFile.magentoBackend.adminPassword || configFile.magentoBackend.adminPassword && configFile.magentoBackend.adminPassword.length == 0) {
                            throw new Error('Admin password is missing in config/settings.json');
                        }

                        if (!configFile.magentoBackend.adminEmailAddress || configFile.magentoBackend.adminEmailAddress && configFile.magentoBackend.adminEmailAddress.length == 0) {
                            throw new Error('Admin email address is missing in config/settings.json');
                        }

                        if (!configFile.general.localDomainExtension || configFile.general.localDomainExtension && configFile.general.localDomainExtension.length == 0) {
                            throw new Error('Local domain extension is missing in config/settings.json');
                        }

                        if (!configFile.general.elasticsearchPort || configFile.general.elasticsearchPort && configFile.general.elasticsearchPort.length == 0) {
                            throw new Error('ElasticSearch port is missing in config/settings.json');
                        }
                    }
                }
            );

            // Check Magerun 2 version
            this.checkTasks.push(
                {
                    title: 'Checking Magerun2 version',
                    task: async (ctx: any, task: any): Promise<boolean> => {
                         // Check the local installed Magerun2 version before we continue and import the database
                         let installedMagerun2Version = await consoleCommand('magerun2 -V', false);
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

            if (config.settings.import && config.settings.import == 'yes') {
                // Check if target folder exists before downloading
                this.checkTasks.push(
                    {
                        title: 'Checking if env.php file exists',
                        task: async (): Promise<Boolean> => {
                            let envFileLocation = config.settings.currentFolder + '/app/etc/env.php';
                            if (fs.existsSync(envFileLocation)) {
                                return true;
                            }

                            throw new Error(`env.php is missing, make sure ${envFileLocation} exists.`);
                        }
                    }
                );
            }
        }

        // Check if target folder exists before downloading
        this.checkTasks.push(
            {
                title: 'Checking if download folder exists',
                task: async (): Promise<Boolean> => {
                    if (fs.existsSync(config.customConfig.localDatabaseFolderLocation)) {
                        return true;
                    }

                    throw new Error(`Download folder ${config.customConfig.localDatabaseFolderLocation} does not exist. This can be configured in config/settings.json`);
                }
            }
        );

        // Check if SSH key exists
        this.checkTasks.push(
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
