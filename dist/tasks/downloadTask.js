"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const tslib_1 = require("tslib");
const console_1 = require("../utils/console");
// @ts-ignore
const static_settings_json_1 = tslib_1.__importDefault(require("../../config/static-settings.json"));
const settings_json_1 = tslib_1.__importDefault(require("../../config/settings.json"));
class DownloadTask {
    constructor() {
        this.downloadTasks = [];
        this.configure = (list, config, ssh) => tslib_1.__awaiter(this, void 0, void 0, function* () {
            yield this.addTasks(list, config, ssh);
            return list;
        });
        // Add tasks
        this.addTasks = (list, config, ssh) => tslib_1.__awaiter(this, void 0, void 0, function* () {
            list.add({
                title: 'Download database from server ' + '(' + config.databases.databaseData.username + ')',
                task: (ctx, task) => task.newListr(this.downloadTasks)
            });
            this.downloadTasks.push({
                title: 'Connecting to server through SSH',
                task: () => tslib_1.__awaiter(this, void 0, void 0, function* () {
                    // Open connection to SSH server
                    yield ssh.connect({
                        host: config.databases.databaseData.server,
                        password: config.databases.databaseData.password,
                        username: config.databases.databaseData.username,
                        port: config.databases.databaseData.port,
                        privateKey: config.customConfig.sshKeyLocation,
                        passphrase: config.customConfig.sshPassphrase
                    });
                })
            });
            this.downloadTasks.push({
                title: 'Retrieving server settings',
                task: () => tslib_1.__awaiter(this, void 0, void 0, function* () {
                    // Retrieve settings from server to use
                    yield ssh.execCommand(console_1.sshNavigateToMagentoRootCommand('test -e vendor/magento && echo 2 || echo 1; pwd; which php;', config)).then((result) => {
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
                })
            });
            this.downloadTasks.push({
                title: 'Downloading Magerun to server',
                task: () => tslib_1.__awaiter(this, void 0, void 0, function* () {
                    // Download Magerun to the server
                    yield ssh.execCommand(console_1.sshNavigateToMagentoRootCommand('curl -O https://files.magerun.net/' + config.serverVariables.magerunFile, config));
                })
            });
            this.downloadTasks.push({
                title: 'Dumping Magento database and moving it to server root (' + config.settings.strip + ')',
                task: () => tslib_1.__awaiter(this, void 0, void 0, function* () {
                    // Retrieve database name
                    yield ssh.execCommand(console_1.sshMagentoRootFolderMagerunCommand('db:info --format=json', config)).then((result) => {
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
                    let stripCommand = 'db:dump -n --no-tablespaces --strip="' + static_settings_json_1.default.settings.databaseStripDevelopment + '" ' + config.serverVariables.databaseName + '.sql';
                    if (config.settings.strip == 'keep customer data') {
                        stripCommand = 'db:dump --strip="' + static_settings_json_1.default.settings.databaseStripKeepCustomerData + '"' + config.serverVariables.databaseName + '.sql';
                    }
                    else if (config.settings.strip == 'full') {
                        stripCommand = 'db:dump' + config.serverVariables.databaseName + '.sql';
                    }
                    // Dump database and move to user root on server
                    yield ssh.execCommand(console_1.sshMagentoRootFolderMagerunCommand(stripCommand + '; mv ' + config.serverVariables.databaseName + '.sql ~', config)).then(function (Contents) {
                    }, function (error) {
                        throw new Error(error);
                    });
                })
            });
            this.downloadTasks.push({
                title: 'Downloading Magento database to localhost',
                task: () => tslib_1.__awaiter(this, void 0, void 0, function* () {
                    // Download file and place it on localhost
                    let localDatabaseFolderLocation = config.customConfig.localDatabaseFolderLocation;
                    if (config.settings.import == 'no' && config.settings.wordpressImport == 'yes') {
                        localDatabaseFolderLocation = settings_json_1.default.general.databaseLocation;
                    }
                    let localDatabaseLocation = localDatabaseFolderLocation + '/' + config.serverVariables.databaseName + '.sql';
                    if (config.settings.rsyncInstalled) {
                        yield console_1.localhostRsyncDownloadCommand(`~/${config.serverVariables.databaseName}.sql`, `${localDatabaseFolderLocation}`, config);
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
            if (config.databases.databaseData.wordpress && config.databases.databaseData.wordpress == true && config.settings.wordpressDownload && config.settings.wordpressDownload == 'yes') {
                this.downloadTasks.push({
                    title: 'Dumping Wordpress database and moving it to server root',
                    task: () => tslib_1.__awaiter(this, void 0, void 0, function* () {
                        // Download Wordpress database
                        yield ssh.execCommand(console_1.sshNavigateToMagentoRootCommand('cd wp; cat wp-config.php', config)).then((result) => {
                            if (result) {
                                let resultValues = result.stdout.split("\n");
                                resultValues.forEach((entry) => {
                                    // Get DB name from config file
                                    if (entry.includes('DB_NAME')) {
                                        config.wordpressConfig.database = console_1.wordpressReplaces(entry, `DB_NAME`);
                                    }
                                    // Get DB user from config file
                                    if (entry.includes('DB_USER')) {
                                        config.wordpressConfig.username = console_1.wordpressReplaces(entry, `DB_USER`);
                                    }
                                    // Get DB password from config file
                                    if (entry.includes('DB_PASSWORD')) {
                                        config.wordpressConfig.password = console_1.wordpressReplaces(entry, `DB_PASSWORD`);
                                    }
                                    // Get DB host from config file
                                    if (entry.includes('DB_HOST')) {
                                        config.wordpressConfig.host = console_1.wordpressReplaces(entry, `DB_HOST`);
                                    }
                                    // Get table prefix from config file
                                    if (entry.includes('table_prefix')) {
                                        config.wordpressConfig.prefix = console_1.wordpressReplaces(entry, `table_prefix`);
                                    }
                                });
                            }
                        });
                        yield ssh.execCommand(console_1.sshNavigateToMagentoRootCommand(`mysqldump --user='${config.wordpressConfig.username}' --password='${config.wordpressConfig.password}' -h ${config.wordpressConfig.host} ${config.wordpressConfig.database} > ${config.wordpressConfig.database}.sql; mv ${config.wordpressConfig.database}.sql ~`, config));
                    })
                });
                this.downloadTasks.push({
                    title: 'Downloading Wordpress database to localhost',
                    task: () => tslib_1.__awaiter(this, void 0, void 0, function* () {
                        let wordpresslocalDatabaseLocation = config.customConfig.localDatabaseFolderLocation + '/' + config.wordpressConfig.database + '.sql';
                        if (config.settings.rsyncInstalled) {
                            yield console_1.localhostRsyncDownloadCommand(`~/${config.wordpressConfig.database}.sql`, `${config.customConfig.localDatabaseFolderLocation}`, config);
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
                task: () => tslib_1.__awaiter(this, void 0, void 0, function* () {
                    // Remove the magento database file on the server
                    yield ssh.execCommand('rm ' + config.serverVariables.databaseName + '.sql');
                    // Remove Magerun and close connection to SSH
                    yield ssh.execCommand(console_1.sshNavigateToMagentoRootCommand('rm ' + config.serverVariables.magerunFile, config));
                    // Remove the wordpress database file on the server
                    if (config.databases.databaseData.wordpress && config.databases.databaseData.wordpress == true) {
                        yield ssh.execCommand(`rm ${config.wordpressConfig.database}.sql`);
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