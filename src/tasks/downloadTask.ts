import {localhostRsyncDownloadCommand, sshMagentoRootFolderMagerunCommand, sshNavigateToMagentoRootCommand, wordpressReplaces } from '../utils/console';
import { Listr } from 'listr2';
// @ts-ignore
import staticConfigFile from '../../config/static-settings.json'
import configFile from "../../config/settings.json";

class DownloadTask {
    private downloadTasks = [];

    configure = async (list: any, config: any, ssh: any) => {
        await this.addTasks(list, config, ssh);
        return list;
    }

    // Add tasks
    addTasks = async (list: any, config: any, ssh: any) => {
        list.add(
            {
                title: 'Download database from server ' + '(' + config.databases.databaseData.username + ')',
                task: (ctx: any, task: any): Listr => 
                task.newListr(
                    this.downloadTasks
                )
            }
        )
        
        this.downloadTasks.push(
            {
                title: 'Connecting to server through SSH',
                task: async (): Promise<void> => {
                    // Open connection to SSH server
                    await ssh.connect({
                        host: config.databases.databaseData.server,
                        password: config.databases.databaseData.password,
                        username: config.databases.databaseData.username,
                        port: config.databases.databaseData.port,
                        privateKey: config.customConfig.sshKeyLocation,
                        passphrase: config.customConfig.sshPassphrase
                    });
                }
            }
        );

        this.downloadTasks.push(
            {
                title: 'Retrieving server settings',
                task: async (): Promise<void> => {
                    // Retrieve settings from server to use
                    await ssh.execCommand(sshNavigateToMagentoRootCommand('test -e vendor/magento && echo 2 || echo 1; pwd; which php;', config)).then((result: any) => {
                        if (result) {
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
                    if (config.databases.databaseData.externalPhpPath && config.databases.databaseData.externalPhpPath.length > 0) {
                        config.serverVariables.externalPhpPath = config.databases.databaseData.externalPhpPath;
                    }

                    // Determine Magerun version based on magento version
                    config.serverVariables.magerunFile = `n98-magerun2-${config.requirements.magerun2Version}.phar`;

                    if (config.serverVariables.magentoVersion == 1) {
                        config.serverVariables.magerunFile = 'n98-magerun-1.98.0.phar';
                    }
                }
            }
        );

        this.downloadTasks.push(
            {
                title: 'Downloading Magerun to server',
                task: async (): Promise<void> => {
                    // Download Magerun to the server
                    await ssh.execCommand(sshNavigateToMagentoRootCommand('curl -O https://files.magerun.net/' + config.serverVariables.magerunFile, config));
                }
            },
        );

        this.downloadTasks.push(
            {
                title: 'Dumping Magento database and moving it to server root (' + config.settings.strip + ')',
                task: async (): Promise<void> => {
                    // Retrieve database name
                    await ssh.execCommand(sshMagentoRootFolderMagerunCommand('db:info --format=json', config)).then((result: any) => {
                        if (result) {
                            // Get json format string and extract database names from values
                            let jsonResult = JSON.parse(result.stdout);
                            config.serverVariables.databaseName = jsonResult[1].Value;

                            if (config.serverVariables.magentoVersion == 1) {
                                config.serverVariables.databaseName = jsonResult[3].Value;
                            }
                        }
                    });

                    // Dump database and move database to root of server
                    let stripCommand = 'db:dump -n --no-tablespaces --strip="' + staticConfigFile.settings.databaseStripDevelopment + '" ' + config.serverVariables.databaseName + '.sql';

                    if (config.settings.strip == 'keep customer data') {
                        stripCommand = 'db:dump --strip="' + staticConfigFile.settings.databaseStripKeepCustomerData + '"' + config.serverVariables.databaseName + '.sql';
                    } else if (config.settings.strip == 'full') {
                        stripCommand = 'db:dump' + config.serverVariables.databaseName + '.sql';
                    }

                    // Dump database and move to user root on server
                    await ssh.execCommand(sshMagentoRootFolderMagerunCommand(stripCommand + '; mv ' + config.serverVariables.databaseName + '.sql ~', config)).then(function (Contents: any) {
                    }, function (error: any) {
                        throw new Error(error)
                    });
                }
            }
        );

        this.downloadTasks.push(
            {
                title: 'Downloading Magento database to localhost',
                task: async (): Promise<void> => {
                    // Download file and place it on localhost
                    let localDatabaseFolderLocation = config.customConfig.localDatabaseFolderLocation;

                    if (config.settings.import == 'no' && config.settings.wordpressImport == 'yes') {
                        localDatabaseFolderLocation = configFile.general.databaseLocation;
                    }

                    let localDatabaseLocation = localDatabaseFolderLocation + '/' + config.serverVariables.databaseName + '.sql';

                    if (config.settings.rsyncInstalled) {
                        await localhostRsyncDownloadCommand(`~/${config.serverVariables.databaseName}.sql`, `${localDatabaseFolderLocation}`, config);
                    } else {
                        await ssh.getFile(localDatabaseLocation, config.serverVariables.databaseName + '.sql').then(function (Contents: any) {
                        }, function (error: any) {
                            throw new Error(error)
                        });
                    }

                    // Set final message with Magento DB location
                    config.finalMessages.magentoDatabaseLocation = localDatabaseLocation;
                }
            }
        );

        if (config.databases.databaseData.wordpress && config.databases.databaseData.wordpress == true && config.settings.wordpressDownload && config.settings.wordpressDownload == 'yes') {
            this.downloadTasks.push(
                {
                    title: 'Dumping Wordpress database and moving it to server root',
                    task: async (): Promise<void> => {
                        // Download Wordpress database
                        await ssh.execCommand(sshNavigateToMagentoRootCommand('cd wp; cat wp-config.php', config)).then((result: any) => {
                            if (result) {
                                let resultValues = result.stdout.split("\n");

                                resultValues.forEach((entry: any) => {
                                    // Get DB name from config file
                                    if (entry.includes('DB_NAME')) {
                                        config.wordpressConfig.database = wordpressReplaces(entry, `DB_NAME`)
                                    }

                                    // Get DB user from config file
                                    if (entry.includes('DB_USER')) {
                                        config.wordpressConfig.username = wordpressReplaces(entry, `DB_USER`)
                                    }

                                    // Get DB password from config file
                                    if (entry.includes('DB_PASSWORD')) {
                                        config.wordpressConfig.password = wordpressReplaces(entry, `DB_PASSWORD`)
                                    }

                                    // Get DB host from config file
                                    if (entry.includes('DB_HOST')) {
                                        config.wordpressConfig.host = wordpressReplaces(entry, `DB_HOST`)
                                    }

                                    // Get table prefix from config file
                                    if (entry.includes('table_prefix')) {
                                        config.wordpressConfig.prefix = wordpressReplaces(entry, `table_prefix`)
                                    }
                                });
                            }
                        });

                        await ssh.execCommand(sshNavigateToMagentoRootCommand(`mysqldump --user='${config.wordpressConfig.username}' --password='${config.wordpressConfig.password}' -h ${config.wordpressConfig.host} ${config.wordpressConfig.database} > ${config.wordpressConfig.database}.sql; mv ${config.wordpressConfig.database}.sql ~`, config));
                    }
                }
            );

            this.downloadTasks.push(
                {
                    title: 'Downloading Wordpress database to localhost',
                    task: async (): Promise<void> => {
                        let wordpresslocalDatabaseLocation = config.customConfig.localDatabaseFolderLocation + '/' + config.wordpressConfig.database + '.sql';

                        if (config.settings.rsyncInstalled) {
                            await localhostRsyncDownloadCommand(`~/${config.wordpressConfig.database}.sql`, `${config.customConfig.localDatabaseFolderLocation}`, config);
                        } else {
                            await ssh.getFile(wordpresslocalDatabaseLocation, `${config.wordpressConfig.database}.sql`).then(function (Contents: any) {
                            }, function (error: any) {
                                throw new Error(error)
                            });
                        }

                        // Set final message with Wordpress database location
                        config.finalMessages.wordpressDatabaseLocation = wordpresslocalDatabaseLocation;
                    }
                }
            );
        }

        this.downloadTasks.push(
            {
                title: 'Cleaning up and closing SSH connection',
                task: async (): Promise<void> => {
                    // Remove the magento database file on the server
                    await ssh.execCommand('rm ' + config.serverVariables.databaseName + '.sql');

                    // Remove Magerun and close connection to SSH
                    await ssh.execCommand(sshNavigateToMagentoRootCommand('rm ' + config.serverVariables.magerunFile, config));

                    // Remove the wordpress database file on the server
                    if (config.databases.databaseData.wordpress && config.databases.databaseData.wordpress == true) {
                        await ssh.execCommand(`rm ${config.wordpressConfig.database}.sql`);
                    }

                    // Close the SSH connection
                    await ssh.dispose();
                }
            }
        );
    }
}

export default DownloadTask
