"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const tslib_1 = require("tslib");
const console_1 = require("../utils/console");
// @ts-ignore
const static_settings_json_1 = (0, tslib_1.__importDefault)(require("../../config/static-settings.json"));
const settings_json_1 = (0, tslib_1.__importDefault)(require("../../config/settings.json"));
const fs_1 = (0, tslib_1.__importDefault)(require("fs"));
class DownloadTask {
    constructor() {
        this.downloadTasks = [];
        this.configure = (list, config, ssh, sshSecondDatabase) => (0, tslib_1.__awaiter)(this, void 0, void 0, function* () {
            yield this.addTasks(list, config, ssh, sshSecondDatabase);
            return list;
        });
        // Add tasks
        this.addTasks = (list, config, ssh, sshSecondDatabase) => (0, tslib_1.__awaiter)(this, void 0, void 0, function* () {
            list.add({
                title: `Downloading from server (${config.databases.databaseData.username} | ${config.databases.databaseType})`,
                task: (ctx, task) => task.newListr(this.downloadTasks)
            });
            this.downloadTasks.push({
                title: 'Connecting to server through SSH',
                task: () => (0, tslib_1.__awaiter)(this, void 0, void 0, function* () {
                    // Open connection to SSH server
                    yield ssh.connect({
                        host: config.databases.databaseData.server,
                        password: config.databases.databaseData.password,
                        username: config.databases.databaseData.username,
                        port: config.databases.databaseData.port,
                        privateKey: config.customConfig.sshKeyLocation,
                        passphrase: config.customConfig.sshPassphrase
                    });
                    if (config.settings.syncDatabases == 'yes') {
                        yield sshSecondDatabase.connect({
                            host: config.databases.databaseDataSecond.server,
                            password: config.databases.databaseDataSecond.password,
                            username: config.databases.databaseDataSecond.username,
                            port: config.databases.databaseDataSecond.port,
                            privateKey: config.customConfig.sshKeyLocation,
                            passphrase: config.customConfig.sshPassphrase
                        });
                    }
                })
            });
            this.downloadTasks.push({
                title: 'Retrieving server settings',
                task: () => (0, tslib_1.__awaiter)(this, void 0, void 0, function* () {
                    // Retrieve settings from server to use
                    yield ssh.execCommand((0, console_1.sshNavigateToMagentoRootCommand)('test -e vendor/magento && echo 2 || echo 1; pwd; which php;', config)).then((result) => {
                        if (result) {
                            let string = (0, console_1.stripOutputString)(result.stdout);
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
                })
            });
            if (config.settings.syncTypes.includes('Magento database')) {
                this.downloadTasks.push({
                    title: 'Downloading Magerun to server',
                    task: () => (0, tslib_1.__awaiter)(this, void 0, void 0, function* () {
                        // Download Magerun to the server
                        yield ssh.execCommand((0, console_1.sshNavigateToMagentoRootCommand)('curl -O https://raw.githubusercontent.com/jellesiderius/mage-db-sync/master/files/' + config.serverVariables.magerunFile, config));
                        if (config.settings.syncDatabases == 'yes') {
                            // Download Magerun to the staging server
                            yield sshSecondDatabase.execCommand((0, console_1.sshNavigateToMagentoRootCommand)('curl -O https://raw.githubusercontent.com/jellesiderius/mage-db-sync/master/files/' + config.serverVariables.magerunFile, config, true));
                        }
                    })
                });
                this.downloadTasks.push({
                    title: 'Dumping Magento database and moving it to server root (' + config.settings.strip + ')',
                    task: () => (0, tslib_1.__awaiter)(this, void 0, void 0, function* () {
                        // Retrieve database name
                        yield ssh.execCommand((0, console_1.sshMagentoRootFolderMagerunCommand)('db:info --format=json', config)).then((result) => {
                            if (result) {
                                // Get json format string and extract database names from values
                                let jsonResult = JSON.parse((0, console_1.stripOutputString)(result.stdout));
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
                        var developmentStripCommand = static_settings_json_1.default.settings.databaseStripDevelopment;
                        var fullStripCommand = null;
                        if (fs_1.default.existsSync(config.settings.currentFolder + '/.mage-db-sync-config.json')) {
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
                            stripCommand = 'db:dump -n --no-tablespaces --strip="' + static_settings_json_1.default.settings.databaseStripKeepCustomerData + '"' + config.serverVariables.databaseName + '.sql';
                        }
                        else if (config.settings.strip == 'full and human readable') {
                            if (fullStripCommand) {
                                stripCommand = 'db:dump -n --no-tablespaces --human-readable --strip="' + fullStripCommand + '" ' + config.serverVariables.databaseName + '.sql';
                            }
                            else {
                                stripCommand = 'db:dump -n --no-tablespaces --human-readable ' + config.serverVariables.databaseName + '.sql';
                            }
                        }
                        else if (config.settings.strip == 'full') {
                            if (fullStripCommand) {
                                stripCommand = 'db:dump -n --no-tablespaces --strip="' + fullStripCommand + '" ' + config.serverVariables.databaseName + '.sql';
                            }
                            else {
                                stripCommand = 'db:dump -n --no-tablespaces ' + config.serverVariables.databaseName + '.sql';
                            }
                        }
                        // Download stripped database for staging envs without customer data etc.
                        if (config.settings.syncDatabases == 'yes') {
                            stripCommand = 'db:dump -n --no-tablespaces --strip="' + static_settings_json_1.default.settings.databaseStripStaging + '" ' + config.serverVariables.databaseName + '.sql';
                            let includeCommand = 'db:dump -n --no-tablespaces --include="' + static_settings_json_1.default.settings.databaseIncludeStaging + '" ' + config.serverVariables.databaseName + '-include.sql';
                            // Dump tables to include from database and move to user root on server
                            yield sshSecondDatabase.execCommand((0, console_1.sshMagentoRootFolderMagerunCommand)(includeCommand + '; mv ' + config.serverVariables.databaseName + '-include.sql ~', config, true)).then(function (Contents) {
                            }, function (error) {
                                throw new Error(error);
                            });
                        }
                        // Dump database and move to user root on server
                        yield ssh.execCommand((0, console_1.sshMagentoRootFolderMagerunCommand)(stripCommand + '; mv ' + config.serverVariables.databaseName + '.sql ~', config)).then(function (Contents) {
                        }, function (error) {
                            throw new Error(error);
                        });
                    })
                });
                this.downloadTasks.push({
                    title: 'Downloading Magento database to localhost',
                    task: () => (0, tslib_1.__awaiter)(this, void 0, void 0, function* () {
                        // Download file and place it on localhost
                        let localDatabaseFolderLocation = config.customConfig.localDatabaseFolderLocation;
                        if (config.settings.import == 'no' && config.settings.wordpressImport == 'yes') {
                            localDatabaseFolderLocation = settings_json_1.default.general.databaseLocation;
                        }
                        let localDatabaseLocation = localDatabaseFolderLocation + '/' + config.serverVariables.databaseName + '.sql';
                        if (config.settings.rsyncInstalled) {
                            // Get magento database from production
                            yield (0, console_1.localhostRsyncDownloadCommand)(`~/${config.serverVariables.databaseName}.sql`, `${localDatabaseFolderLocation}`, config);
                            if (config.settings.syncDatabases == 'yes') {
                                // Get tables to keep from staging
                                yield (0, console_1.localhostRsyncDownloadCommand)(`~/${config.serverVariables.databaseName}-include.sql`, `${localDatabaseFolderLocation}`, config, true);
                                let localDatabaseIncludeLocation = localDatabaseFolderLocation + '/' + config.serverVariables.databaseName + '-include.sql';
                                config.finalMessages.magentoDatabaseIncludeLocation = localDatabaseIncludeLocation;
                            }
                        }
                        else {
                            yield ssh.getFile(localDatabaseLocation, config.serverVariables.databaseName + '.sql').then(function (Contents) {
                            }, function (error) {
                                throw new Error(error);
                            });
                        }
                        // Set final message with Magento DB location
                        config.finalMessages.magentoDatabaseLocation = localDatabaseLocation;
                    })
                });
            }
            if (config.settings.syncImages == 'yes' && config.settings.syncTypes.includes('Images')) {
                this.downloadTasks.push({
                    title: 'Downloading media images & files',
                    task: () => (0, tslib_1.__awaiter)(this, void 0, void 0, function* () {
                        // Sync media to project folder
                        if (config.settings.currentFolderIsMagento && config.settings.syncDatabases != 'yes') {
                            yield (0, console_1.localhostMagentoRootExec)(`mkdir pub/media/catalog && mkdir pub/media/wysiwyg`, config, true);
                            yield (0, console_1.localhostMagentoRootExec)(`mkdir pub/media/catalog/category && mkdir pub/media/catalog/product`, config, true);
                            yield (0, console_1.localhostMagentoRootExec)(`mkdir pub/media/logo`, config, true);
                            yield (0, console_1.localhostMagentoRootExec)(`rsync -avz -e "ssh -p ${config.databases.databaseData.port}" ${config.databases.databaseData.username}@${config.databases.databaseData.server}:${config.serverVariables.magentoRoot}/pub/media/logo/* pub/media/logo --exclude 'cache' --exclude 'catalog/product/cache' --exclude 'catalog/category/cache' --exclude 'custom_options' --exclude 'tmp' --exclude 'analytics' --exclude 'amfile'`, config, true);
                            if (config.settings.syncImageTypes.includes('Product images')) {
                                yield (0, console_1.localhostMagentoRootExec)(`rsync -avz -e "ssh -p ${config.databases.databaseData.port}" ${config.databases.databaseData.username}@${config.databases.databaseData.server}:${config.serverVariables.magentoRoot}/pub/media/catalog/product/* pub/media/catalog/product --exclude 'cache' --exclude 'catalog/product/cache' --exclude 'catalog/category/cache' --exclude 'custom_options' --exclude 'tmp' --exclude 'analytics' --exclude 'amfile'`, config, true);
                            }
                            if (config.settings.syncImageTypes.includes('Category images')) {
                                yield (0, console_1.localhostMagentoRootExec)(`rsync -avz -e "ssh -p ${config.databases.databaseData.port}" ${config.databases.databaseData.username}@${config.databases.databaseData.server}:${config.serverVariables.magentoRoot}/pub/media/catalog/category/* pub/media/catalog/category --exclude 'cache' --exclude 'catalog/product/cache' --exclude 'catalog/category/cache' --exclude 'custom_options' --exclude 'tmp' --exclude 'analytics' --exclude 'amfile'`, config, true);
                            }
                            if (config.settings.syncImageTypes.includes('WYSIWYG images')) {
                                yield (0, console_1.localhostMagentoRootExec)(`rsync -avz -e "ssh -p ${config.databases.databaseData.port}" ${config.databases.databaseData.username}@${config.databases.databaseData.server}:${config.serverVariables.magentoRoot}/pub/media/wysiwyg/* pub/media/wysiwyg --exclude 'cache' --exclude 'catalog/product/cache' --exclude 'catalog/category/cache' --exclude 'custom_options' --exclude 'tmp' --exclude 'analytics' --exclude 'amfile'`, config, true);
                            }
                            if (config.settings.syncImageTypes.includes('Everything else')) {
                                yield (0, console_1.localhostMagentoRootExec)(`rsync -avz -e "ssh -p ${config.databases.databaseData.port}" ${config.databases.databaseData.username}@${config.databases.databaseData.server}:${config.serverVariables.magentoRoot}/pub/media/* pub/media/ --exclude 'cache' --exclude 'catalog/product/cache' --exclude 'catalog/category/cache' --exclude 'custom_options' --exclude 'tmp' --exclude 'analytics' --exclude 'amfile'`, config, true);
                            }
                        }
                        else {
                            // Sync to tmp folder
                            var tmpLocalMediaPath = `${config.customConfig.localDatabaseFolderLocation}/tmpMediaImages`;
                            yield (0, console_1.localhostMagentoRootExec)(`rsync -avz -e "ssh -p ${config.databases.databaseData.port}" ${config.databases.databaseData.username}@${config.databases.databaseData.server}:${config.serverVariables.magentoRoot}/pub/media/* ${tmpLocalMediaPath}/ --exclude 'cache' --exclude 'catalog/product/cache' --exclude 'catalog/category/cache' --exclude 'custom_options' --exclude 'tmp' --exclude 'analytics' --exclude 'amfile'`, config, true);
                        }
                    })
                });
            }
            if (config.databases.databaseData.wordpress && config.databases.databaseData.wordpress == true && config.settings.wordpressDownload && config.settings.wordpressDownload == 'yes') {
                this.downloadTasks.push({
                    title: 'Dumping Wordpress database and moving it to server root',
                    task: () => (0, tslib_1.__awaiter)(this, void 0, void 0, function* () {
                        // Download Wordpress database
                        yield ssh.execCommand((0, console_1.sshNavigateToMagentoRootCommand)('cd wp; cat wp-config.php', config)).then((result) => {
                            if (result) {
                                let string = (0, console_1.stripOutputString)(result.stdout);
                                let resultValues = string.split("\n");
                                resultValues.forEach((entry) => {
                                    // Get DB name from config file
                                    if (entry.includes('DB_NAME')) {
                                        config.wordpressConfig.database = (0, console_1.wordpressReplaces)(entry, `DB_NAME`);
                                    }
                                    // Get DB user from config file
                                    if (entry.includes('DB_USER')) {
                                        config.wordpressConfig.username = (0, console_1.wordpressReplaces)(entry, `DB_USER`);
                                    }
                                    // Get DB password from config file
                                    if (entry.includes('DB_PASSWORD')) {
                                        config.wordpressConfig.password = (0, console_1.wordpressReplaces)(entry, `DB_PASSWORD`);
                                    }
                                    // Get DB host from config file
                                    if (entry.includes('DB_HOST')) {
                                        config.wordpressConfig.host = (0, console_1.wordpressReplaces)(entry, `DB_HOST`);
                                    }
                                    // Get table prefix from config file
                                    if (entry.includes('table_prefix')) {
                                        config.wordpressConfig.prefix = (0, console_1.wordpressReplaces)(entry, `table_prefix`);
                                    }
                                });
                            }
                        });
                        yield ssh.execCommand((0, console_1.sshNavigateToMagentoRootCommand)(`mysqldump --user='${config.wordpressConfig.username}' --password='${config.wordpressConfig.password}' -h ${config.wordpressConfig.host} ${config.wordpressConfig.database} > ${config.wordpressConfig.database}.sql; mv ${config.wordpressConfig.database}.sql ~`, config));
                    })
                });
                this.downloadTasks.push({
                    title: 'Downloading Wordpress database to localhost',
                    task: () => (0, tslib_1.__awaiter)(this, void 0, void 0, function* () {
                        let wordpresslocalDatabaseLocation = config.customConfig.localDatabaseFolderLocation + '/' + config.wordpressConfig.database + '.sql';
                        if (config.settings.rsyncInstalled) {
                            yield (0, console_1.localhostRsyncDownloadCommand)(`~/${config.wordpressConfig.database}.sql`, `${config.customConfig.localDatabaseFolderLocation}`, config);
                        }
                        else {
                            yield ssh.getFile(wordpresslocalDatabaseLocation, `${config.wordpressConfig.database}.sql`).then(function (Contents) {
                            }, function (error) {
                                throw new Error(error);
                            });
                        }
                        // Set final message with Wordpress database location
                        config.finalMessages.wordpressDatabaseLocation = wordpresslocalDatabaseLocation;
                    })
                });
            }
            this.downloadTasks.push({
                title: 'Cleaning up and closing SSH connection',
                task: () => (0, tslib_1.__awaiter)(this, void 0, void 0, function* () {
                    // Remove the magento database file on the server
                    yield ssh.execCommand('rm ' + config.serverVariables.databaseName + '.sql');
                    // Remove Magerun and close connection to SSH
                    yield ssh.execCommand((0, console_1.sshNavigateToMagentoRootCommand)('rm ' + config.serverVariables.magerunFile, config));
                    // Remove the wordpress database file on the server
                    if (config.databases.databaseData.wordpress && config.databases.databaseData.wordpress == true) {
                        yield ssh.execCommand(`rm ${config.wordpressConfig.database}.sql`);
                    }
                    if (config.settings.syncDatabases == 'yes') {
                        // Remove the magento database file on the server
                        yield sshSecondDatabase.execCommand('rm ' + config.serverVariables.databaseName + '-include.sql');
                        // Remove Magerun and close connection to SSH
                        yield sshSecondDatabase.execCommand((0, console_1.sshNavigateToMagentoRootCommand)('rm ' + config.serverVariables.magerunFile, config, true));
                        yield sshSecondDatabase.dispose();
                    }
                    // Close the SSH connection
                    yield ssh.dispose();
                })
            });
        });
    }
}
exports.default = DownloadTask;
//# sourceMappingURL=downloadTask.js.map