import {localhostMagentoRootExec, sshNavigateToMagentoRootCommand} from '../utils/console';
import { Listr } from 'listr2';

class SyncImportTask {
    private importTasks = [];

    configure = async (list: any, config: any, ssh: any) => {
        await this.addTasks(list, config, ssh);
        return list;
    }

    // Add tasks
    addTasks = async (list: any, config: any, ssh: any) => {
        list.add(
            {
                title: `Import Magento database to (${config.databases.databaseDataSecond.username}@${config.databases.databaseDataSecond.server}:${config.databases.databaseDataSecond.port} | ${config.databases.databaseDataSecond.domainFolder})`,
                task: (ctx: any, task: any): Listr =>
                task.newListr(
                    this.importTasks
                )
            }
        )

        this.importTasks.push(
            {
                title: 'Connecting to server through SSH',
                task: async (): Promise<void> => {
                    // Open connection to SSH server
                    await ssh.connect({
                        host: config.databases.databaseDataSecond.server,
                        password: config.databases.databaseDataSecond.password,
                        username: config.databases.databaseDataSecond.username,
                        port: config.databases.databaseDataSecond.port,
                        privateKey: config.customConfig.sshKeyLocation,
                        passphrase: config.customConfig.sshPassphrase
                    });
                }
            }
        );

        this.importTasks.push(
            {
                title: 'Retrieving server settings',
                task: async (): Promise<void> => {
                    // Retrieve settings from server to use
                    await ssh.execCommand(sshNavigateToMagentoRootCommand('test -e vendor/magento && echo 2 || echo 1; pwd; which php;', config, true)).then((result: any) => {
                        if (result) {
                            console.log(result);
                            let serverValues = result.stdout.split("\n");
                            // Check if Magento 1 or Magento 2
                            config.serverVariables.magentoVersion = parseInt(serverValues[0]);
                            // Get Magento root
                            config.serverVariables.magentoRoot = serverValues[1];
                            // Get PHP path
                            config.serverVariables.externalPhpPath = serverValues[2];
                        }
                    });

                    // Use custom PHP path instead if given
                    if (config.databases.databaseDataSecond.externalPhpPath && config.databases.databaseDataSecond.externalPhpPath.length > 0) {
                        config.serverVariables.externalPhpPath = config.databases.databaseDataSecond.externalPhpPath;
                    }

                    // Determine Magerun version based on magento version
                    config.serverVariables.magerunFile = `n98-magerun2-${config.requirements.magerun2Version}.phar`;

                    if (config.serverVariables.magentoVersion == 1) {
                        config.serverVariables.magerunFile = 'n98-magerun-1.98.0.phar';
                    }
                }
            }
        );

        this.importTasks.push(
            {
                title: 'Downloading Magerun to server',
                task: async (): Promise<void> => {
                    // Download Magerun to the server
                    await ssh.execCommand(sshNavigateToMagentoRootCommand('curl -O https://files.magerun.net/' + config.serverVariables.magerunFile, config, true));
                }
            },
        );

        this.importTasks.push(
            {
                title: 'Uploading database file to server',
                task: async (): Promise<void> => {
                    // Download Magerun to the server
                    await localhostMagentoRootExec(`rsync -avz -e "ssh -p ${config.databases.databaseData.port}" ${config.finalMessages.magentoDatabaseLocation} ${config.databases.databaseData.username}@${config.databases.databaseData.server}:${config.serverVariables.magentoRoot}`, config, true);
                }
            },
        );

        this.importTasks.push(
            {
                title: 'Cleaning up',
                task: async (): Promise<void> => {

                }
            }
        );
    }
}

export default SyncImportTask
