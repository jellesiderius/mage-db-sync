import {
    localhostMagentoRootExec,
    localhostRsyncDownloadCommand,
    sshMagentoRootFolderMagerunCommand, sshMagentoRootFolderPhpCommand,
    sshNavigateToMagentoRootCommand,
    wordpressReplaces,
    stripOutputString
} from '../utils/console';
import { Listr } from 'listr2';
// @ts-ignore
import staticConfigFile from '../../config/static-settings.json'
import configFile from "../../config/settings.json";
import fs from "fs";

class DownloadTask {
    private downloadTasks = [];

    configure = async (list: any, config: any, ssh: any, sshSecondDatabase: any) => {
        await this.addTasks(list, config, ssh, sshSecondDatabase);
        return list;
    }

    // Add tasks
    addTasks = async (list: any, config: any, ssh: any, sshSecondDatabase: any) => {
        list.add(
            {
                title: `Downloading from server (${config.databases.databaseData.username} | ${config.databases.databaseType})`,
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

                    if (config.settings.syncDatabases == 'yes') {
                        await sshSecondDatabase.connect({
                            host: config.databases.databaseDataSecond.server,
                            password: config.databases.databaseDataSecond.password,
                            username: config.databases.databaseDataSecond.username,
                            port: config.databases.databaseDataSecond.port,
                            privateKey: config.customConfig.sshKeyLocation,
                            passphrase: config.customConfig.sshPassphrase
                        });
                    }
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
                            let string = stripOutputString(result.stdout);
                            let serverValues = string.split("\n");
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

                    if (config.settings.syncDatabases == 'yes') {
                        // Use custom PHP path instead if given
                        if (config.databases.databaseDataSecond.externalPhpPath && config.databases.databaseDataSecond.externalPhpPath.length > 0) {
                            config.serverVariables.secondDatabaseExternalPhpPath = config.databases.databaseDataSecond.externalPhpPath;
                        }
                    }

                    if (config.serverVariables.magentoVersion == 1) {
                        config.serverVariables.magerunFile = 'n98-magerun-1.98.0.phar';
                    }
                }
            }
        );

        if (config.settings.syncTypes.includes('Magento database')) {
            this.downloadTasks.push(
                {
                    title: 'Downloading Magerun to server',
                    task: async (): Promise<void> => {
                        // Download Magerun to the server
                        await ssh.execCommand(sshNavigateToMagentoRootCommand('curl -O https://raw.githubusercontent.com/jellesiderius/mage-db-sync/master/files/' + config.serverVariables.magerunFile, config));

                        if (config.settings.syncDatabases == 'yes') {
                            // Download Magerun to the staging server
                            await sshSecondDatabase.execCommand(sshNavigateToMagentoRootCommand('curl -O https://raw.githubusercontent.com/jellesiderius/mage-db-sync/master/files/' + config.serverVariables.magerunFile, config, true));
                        }
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
                                let jsonResult = JSON.parse(stripOutputString(result.stdout));
                                // Retrieve dbname
                                for (const key in jsonResult) {
                                    if (jsonResult[key].Name.toLowerCase() === 'dbname') {
                                        config.serverVariables.databaseName = jsonResult[key].Value;
                                        break;
                                    }
                                }

                                if (config.serverVariables.magentoVersion == 1) {
                                    config.serverVariables.databaseName = jsonResult[3].Value;
                                }
                            }
                        });

                        var developmentStripCommand = staticConfigFile.settings.databaseStripDevelopment;
                        var fullStripCommand = null;

                        if (fs.existsSync(config.settings.currentFolder + '/.mage-db-sync-config.json')) {
                            let jsonData = require(config.settings.currentFolder + '/.mage-db-sync-config.json');
                            let databaseStripDevelopment = jsonData.databaseStripDevelopment;


                            if (databaseStripDevelopment) {
                                developmentStripCommand = `${developmentStripCommand} ${databaseStripDevelopment}`;
                            }

                            let databaseStripFull = jsonData.databaseStripFull;
                            if (databaseStripFull) {
                                fullStripCommand = databaseStripFull;
                            }
                        }

                        // Dump database and move database to root of server
                        let stripCommand = 'db:dump -n --no-tablespaces --strip="' + developmentStripCommand + '" ' + config.serverVariables.databaseName + '.sql';

                        if (config.settings.strip == 'keep customer data') {
                            stripCommand = 'db:dump -n --no-tablespaces --strip="' + staticConfigFile.settings.databaseStripKeepCustomerData + '"' + config.serverVariables.databaseName + '.sql';
                        } else if (config.settings.strip == 'full and human readable') {
                            if (fullStripCommand) {
                                stripCommand = 'db:dump -n --no-tablespaces --human-readable --strip="' + fullStripCommand + '" ' + config.serverVariables.databaseName + '.sql';
                            } else {
                                stripCommand = 'db:dump -n --no-tablespaces --human-readable ' + config.serverVariables.databaseName + '.sql';
                            }
                        } else if (config.settings.strip == 'full') {
                            if (fullStripCommand) {
                                stripCommand = 'db:dump -n --no-tablespaces --strip="' + fullStripCommand + '" ' + config.serverVariables.databaseName + '.sql';
                            } else {
                                stripCommand = 'db:dump -n --no-tablespaces ' + config.serverVariables.databaseName + '.sql';
                            }
                        }

                        // Download stripped database for staging envs without customer data etc.
                        if (config.settings.syncDatabases == 'yes') {
                            stripCommand = 'db:dump -n --no-tablespaces --strip="' + staticConfigFile.settings.databaseStripStaging + '" ' + config.serverVariables.databaseName + '.sql';

                            let includeCommand = 'db:dump -n --no-tablespaces --include="' + staticConfigFile.settings.databaseIncludeStaging + '" ' + config.serverVariables.databaseName + '-include.sql';

                            // Dump tables to include from database and move to user root on server
                            await sshSecondDatabase.execCommand(sshMagentoRootFolderMagerunCommand(includeCommand + '; mv ' + config.serverVariables.databaseName + '-include.sql ~', config, true)).then(function (Contents: any) {
                            }, function (error: any) {
                                throw new Error(error)
                            });
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
                            // Get magento database from production
                            await localhostRsyncDownloadCommand(`~/${config.serverVariables.databaseName}.sql`, `${localDatabaseFolderLocation}`, config);

                            if (config.settings.syncDatabases == 'yes') {
                                // Get tables to keep from staging
                                await localhostRsyncDownloadCommand(`~/${config.serverVariables.databaseName}-include.sql`, `${localDatabaseFolderLocation}`, config, true);

                                let localDatabaseIncludeLocation = localDatabaseFolderLocation + '/' + config.serverVariables.databaseName + '-include.sql';
                                config.finalMessages.magentoDatabaseIncludeLocation = localDatabaseIncludeLocation;
                            }
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
        }

        if (config.settings.syncImages == 'yes' && config.settings.syncTypes.includes('Images')) {
            this.downloadTasks.push(
                {
                    title: 'Downloading media images & files',
                    task: async (): Promise<void> => {
                        // Sync media to project folder
                        if (config.settings.currentFolderIsMagento && config.settings.syncDatabases != 'yes') {
                            await localhostMagentoRootExec(`mkdir pub/media/catalog && mkdir pub/media/wysiwyg`, config, true);
                            await localhostMagentoRootExec(`mkdir pub/media/catalog/category && mkdir pub/media/catalog/product`, config, true);
                            await localhostMagentoRootExec(`mkdir pub/media/logo`, config, true);

                            await localhostMagentoRootExec(`rsync -avz -e "ssh -p ${config.databases.databaseData.port}" ${config.databases.databaseData.username}@${config.databases.databaseData.server}:${config.serverVariables.magentoRoot}/pub/media/logo/* pub/media/logo --exclude 'cache' --exclude 'catalog/product/cache' --exclude 'catalog/category/cache' --exclude 'custom_options' --exclude 'tmp' --exclude 'analytics' --exclude 'amfile'`, config, true);

                            if (config.settings.syncImageTypes.includes('Product images')) {
                                await localhostMagentoRootExec(`rsync -avz -e "ssh -p ${config.databases.databaseData.port}" ${config.databases.databaseData.username}@${config.databases.databaseData.server}:${config.serverVariables.magentoRoot}/pub/media/catalog/product/* pub/media/catalog/product --exclude 'cache' --exclude 'catalog/product/cache' --exclude 'catalog/category/cache' --exclude 'custom_options' --exclude 'tmp' --exclude 'analytics' --exclude 'amfile'`, config, true);
                            }

                            if (config.settings.syncImageTypes.includes('Category images')) {
                                await localhostMagentoRootExec(`rsync -avz -e "ssh -p ${config.databases.databaseData.port}" ${config.databases.databaseData.username}@${config.databases.databaseData.server}:${config.serverVariables.magentoRoot}/pub/media/catalog/category/* pub/media/catalog/category --exclude 'cache' --exclude 'catalog/product/cache' --exclude 'catalog/category/cache' --exclude 'custom_options' --exclude 'tmp' --exclude 'analytics' --exclude 'amfile'`, config, true);
                            }

                            if (config.settings.syncImageTypes.includes('WYSIWYG images')) {
                                await localhostMagentoRootExec(`rsync -avz -e "ssh -p ${config.databases.databaseData.port}" ${config.databases.databaseData.username}@${config.databases.databaseData.server}:${config.serverVariables.magentoRoot}/pub/media/wysiwyg/* pub/media/wysiwyg --exclude 'cache' --exclude 'catalog/product/cache' --exclude 'catalog/category/cache' --exclude 'custom_options' --exclude 'tmp' --exclude 'analytics' --exclude 'amfile'`, config, true);
                            }

                            if (config.settings.syncImageTypes.includes('Everything else')) {
                                await localhostMagentoRootExec(`rsync -avz -e "ssh -p ${config.databases.databaseData.port}" ${config.databases.databaseData.username}@${config.databases.databaseData.server}:${config.serverVariables.magentoRoot}/pub/media/* pub/media/ --exclude 'cache' --exclude 'catalog/product/cache' --exclude 'catalog/category/cache' --exclude 'custom_options' --exclude 'tmp' --exclude 'analytics' --exclude 'amfile'`, config, true);
                            }
                        } else {
                            // Sync to tmp folder
                            var tmpLocalMediaPath = `${config.customConfig.localDatabaseFolderLocation}/tmpMediaImages`
                            await localhostMagentoRootExec(`rsync -avz -e "ssh -p ${config.databases.databaseData.port}" ${config.databases.databaseData.username}@${config.databases.databaseData.server}:${config.serverVariables.magentoRoot}/pub/media/* ${tmpLocalMediaPath}/ --exclude 'cache' --exclude 'catalog/product/cache' --exclude 'catalog/category/cache' --exclude 'custom_options' --exclude 'tmp' --exclude 'analytics' --exclude 'amfile'`, config, true);
                        }
                    }
                }
            );
        }

        if (config.databases.databaseData.wordpress && config.databases.databaseData.wordpress == true && config.settings.wordpressDownload && config.settings.wordpressDownload == 'yes') {
            this.downloadTasks.push(
                {
                    title: 'Dumping Wordpress database and moving it to server root',
                    task: async (): Promise<void> => {
                        // Download Wordpress database
                        await ssh.execCommand(sshNavigateToMagentoRootCommand('cd wp; cat wp-config.php', config)).then((result: any) => {
                            if (result) {
                                let string = stripOutputString(result.stdout);
                                let resultValues = string.split("\n");

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

                    if (config.settings.syncDatabases == 'yes') {
                        // Remove the magento database file on the server
                        await sshSecondDatabase.execCommand('rm ' + config.serverVariables.databaseName + '-include.sql');

                        // Remove Magerun and close connection to SSH
                        await sshSecondDatabase.execCommand(sshNavigateToMagentoRootCommand('rm ' + config.serverVariables.magerunFile, config, true));

                        await sshSecondDatabase.dispose();
                    }

                    // Close the SSH connection
                    await ssh.dispose();
                }
            }
        );
    }
}

export default DownloadTask
