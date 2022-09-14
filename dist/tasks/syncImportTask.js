"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const tslib_1 = require("tslib");
const console_1 = require("../utils/console");
class SyncImportTask {
    constructor() {
        this.importTasks = [];
        this.configureTasks = [];
        this.stagingValues = [];
        this.configure = (list, config, ssh) => tslib_1.__awaiter(this, void 0, void 0, function* () {
            yield this.addTasks(list, config, ssh);
            return list;
        });
        this.collectStagingConfigValue = (path, ssh, config) => tslib_1.__awaiter(this, void 0, void 0, function* () {
            let self = this;
            let json = yield ssh.execCommand(console_1.sshMagentoRootFolderMagerunCommand('config:store:get "' + path + '" --format=json', config, true));
            json = json.stdout;
            try {
                // Check if string is JSON
                JSON.parse(json);
            }
            catch (e) {
                return false;
            }
            if (json) {
                const jsonObj = JSON.parse(json);
                if (jsonObj && typeof jsonObj === `object`) {
                    Object.keys(jsonObj).forEach(function (item) {
                        var objectItem = jsonObj[item];
                        var objectItemValue = objectItem['Value'];
                        var objectItemScopeId = parseInt(objectItem['Scope-ID']);
                        var objectItemScope = objectItem['Scope'];
                        self.stagingValues.push({
                            // @ts-ignore
                            'path': path,
                            // @ts-ignore
                            'scope': objectItemScope,
                            // @ts-ignore
                            'scope_id': objectItemScopeId,
                            // @ts-ignore
                            'value': objectItemValue
                        });
                    });
                }
            }
        });
        // Add tasks
        this.addTasks = (list, config, ssh) => tslib_1.__awaiter(this, void 0, void 0, function* () {
            list.add({
                title: `Import Magento database to: ${config.databases.databaseDataSecond.username}@${config.databases.databaseDataSecond.server}:${config.databases.databaseDataSecond.port} | ${config.databases.databaseDataSecond.domainFolder}`,
                task: (ctx, task) => task.newListr(this.importTasks)
            });
            list.add({
                title: `Configuring Magento on staging environment`,
                task: (ctx, task) => task.newListr(this.configureTasks)
            });
            this.importTasks.push({
                title: 'Connecting to server through SSH',
                task: () => tslib_1.__awaiter(this, void 0, void 0, function* () {
                    // Open connection to SSH server
                    yield ssh.connect({
                        host: config.databases.databaseDataSecond.server,
                        password: config.databases.databaseDataSecond.password,
                        username: config.databases.databaseDataSecond.username,
                        port: config.databases.databaseDataSecond.port,
                        privateKey: config.customConfig.sshKeyLocation,
                        passphrase: config.customConfig.sshPassphrase
                    });
                })
            });
            this.importTasks.push({
                title: 'Retrieving server settings',
                task: () => tslib_1.__awaiter(this, void 0, void 0, function* () {
                    // Retrieve settings from server to use
                    yield ssh.execCommand(console_1.sshNavigateToMagentoRootCommand('test -e vendor/magento && test -e app/etc/env.php && echo 2 || echo 1; pwd; which php;', config, true)).then((result) => {
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
                    if (config.serverVariables.magentoVersion != 2) {
                        console_1.error('Magento 2 not completely found staging server, are app/etc/env.php & vendor/magento present?');
                        process.exit();
                    }
                    // Use custom PHP path instead if given
                    if (config.databases.databaseDataSecond.externalPhpPath && config.databases.databaseDataSecond.externalPhpPath.length > 0) {
                        config.serverVariables.externalPhpPath = config.databases.databaseDataSecond.externalPhpPath;
                    }
                    // Determine Magerun version based on magento version
                    config.serverVariables.magerunFile = `n98-magerun2-${config.requirements.magerun2Version}.phar`;
                })
            });
            this.importTasks.push({
                title: 'Downloading Magerun to server',
                task: () => tslib_1.__awaiter(this, void 0, void 0, function* () {
                    // Download Magerun to the server
                    yield ssh.execCommand(console_1.sshNavigateToMagentoRootCommand('curl -O https://files.magerun.net/' + config.serverVariables.magerunFile, config, true));
                })
            });
            this.importTasks.push({
                title: 'Retrieving current staging needed settings',
                task: () => tslib_1.__awaiter(this, void 0, void 0, function* () {
                    yield this.collectStagingConfigValue('web/unsecure/base_url', ssh, config);
                    yield this.collectStagingConfigValue('web/secure/base_url', ssh, config);
                    yield this.collectStagingConfigValue('catalog/search/elasticsearch7_server_port', ssh, config);
                    yield this.collectStagingConfigValue('catalog/search/elasticsearch7_server_hostname', ssh, config);
                    yield this.collectStagingConfigValue('catalog/search/elasticsearch7_server_hostname', ssh, config);
                    yield this.collectStagingConfigValue('search/engine/elastic_port', ssh, config);
                    yield this.collectStagingConfigValue('search/engine/elastic_host', ssh, config);
                })
            });
            this.importTasks.push({
                title: 'Uploading database file to server',
                task: () => tslib_1.__awaiter(this, void 0, void 0, function* () {
                    // Push file to server through rSync\
                    yield console_1.localhostMagentoRootExec(`rsync -avz -e "ssh -p ${config.databases.databaseDataSecond.port}" ${config.finalMessages.magentoDatabaseLocation} ${config.databases.databaseDataSecond.username}@${config.databases.databaseDataSecond.server}:${config.serverVariables.magentoRoot}`, config, true);
                })
            });
            this.importTasks.push({
                title: 'Importing Magento database',
                task: () => tslib_1.__awaiter(this, void 0, void 0, function* () {
                    // Create database
                    // TODO: Keep admin users
                    yield ssh.execCommand(console_1.sshMagentoRootFolderMagerunCommand(`db:import ${config.serverVariables.databaseName}.sql --force --skip-authorization-entry-creation -q --drop`, config, true));
                })
            });
            this.configureTasks.push({
                title: "Replacing URL's and doing some preparation",
                task: () => tslib_1.__awaiter(this, void 0, void 0, function* () {
                    let self = this;
                    var dbQuery = '';
                    // Delete queries
                    var dbQueryRemove = "DELETE FROM core_config_data WHERE path LIKE 'web/cookie/cookie_domain';", dbQueryRemove = dbQueryRemove + "DELETE FROM core_config_data WHERE path LIKE 'dev/static/sign';", dbQueryRemove = dbQueryRemove + "DELETE FROM core_config_data WHERE path LIKE '%smtp%';", dbQueryRemove = dbQueryRemove + "DELETE FROM core_config_data WHERE path LIKE 'admin/url/use_custom';", dbQueryRemove = dbQueryRemove + "DELETE FROM core_config_data WHERE path LIKE 'admin/url/use_custom_path';", dbQueryRemove = dbQueryRemove + "DELETE FROM core_config_data WHERE path LIKE 'web/unsecure/base_static_url';", dbQueryRemove = dbQueryRemove + "DELETE FROM core_config_data WHERE path LIKE 'web/unsecure/base_media_url';", dbQueryRemove = dbQueryRemove + "DELETE FROM core_config_data WHERE path LIKE 'web/unsecure/base_link_url';", dbQueryRemove = dbQueryRemove + "DELETE FROM core_config_data WHERE path LIKE 'web/unsecure/base_url';", dbQueryRemove = dbQueryRemove + "DELETE FROM core_config_data WHERE path LIKE 'web/secure/base_static_url';";
                    dbQueryRemove = dbQueryRemove + "DELETE FROM core_config_data WHERE path LIKE 'web/secure/base_media_url';",
                        dbQueryRemove = dbQueryRemove + "DELETE FROM core_config_data WHERE path LIKE 'web/secure/base_link_url';",
                        dbQueryRemove = dbQueryRemove + "DELETE FROM core_config_data WHERE path LIKE 'web/secure/base_url';",
                        dbQueryRemove = dbQueryRemove + "DELETE FROM core_config_data WHERE path LIKE 'design/search_engine_robots/default_robots';",
                        dbQueryRemove = dbQueryRemove + "DELETE FROM core_config_data WHERE path LIKE '%ceyenne%';";
                    // Update queries
                    var dbQueryUpdate = "UPDATE core_config_data SET value = '1' WHERE path = 'web/secure/use_in_frontend';", dbQueryUpdate = dbQueryUpdate + "UPDATE core_config_data SET value = '1' WHERE path = 'web/secure/use_in_adminhtml';";
                    // Insert queries
                    var dbQueryInsert = "INSERT INTO core_config_data (scope, scope_id, path, value) VALUES ('default', '0', 'dev/static/sign', '1');", dbQueryInsert = dbQueryInsert + "INSERT INTO core_config_data (scope, scope_id, path, value) VALUES ('default', '0', 'web/unsecure/base_static_url', '{{unsecure_base_url}}static/');", dbQueryInsert = dbQueryInsert + "INSERT INTO core_config_data (scope, scope_id, path, value) VALUES ('default', '0', 'web/unsecure/base_media_url', '{{unsecure_base_url}}media/');", dbQueryInsert = dbQueryInsert + "INSERT INTO core_config_data (scope, scope_id, path, value) VALUES ('default', '0', 'web/unsecure/base_link_url', '{{unsecure_base_url}}');", dbQueryInsert = dbQueryInsert + "INSERT INTO core_config_data (scope, scope_id, path, value) VALUES ('default', '0', 'web/secure/base_static_url', '{{secure_base_url}}static/');", dbQueryInsert = dbQueryInsert + "INSERT INTO core_config_data (scope, scope_id, path, value) VALUES ('default', '0', 'web/secure/base_media_url', '{{secure_base_url}}media/');", dbQueryInsert = dbQueryInsert + "INSERT INTO core_config_data (scope, scope_id, path, value) VALUES ('default', '0', 'web/secure/base_link_url', '{{secure_base_url}}');", dbQueryInsert = dbQueryInsert + "INSERT INTO core_config_data (scope, scope_id, path, value) VALUES ('default', '0', 'design/search_engine_robots/default_robots', 'NOINDEX,NOFOLLOW');";
                    Object.keys(this.stagingValues).forEach(function (itemKey) {
                        // @ts-ignore
                        dbQueryInsert = dbQueryInsert + `INSERT INTO core_config_data (scope, scope_id, path, value) VALUES ('${self.stagingValues[itemKey].scope}', '${self.stagingValues[itemKey].scope_id}', '${self.stagingValues[itemKey].path}', '${self.stagingValues[itemKey].value}');`;
                    });
                    // Build up query
                    dbQuery = dbQuery + dbQueryRemove + dbQueryUpdate + dbQueryInsert;
                    // Set import domain for final message on completing all tasks
                    config.finalMessages.importDomain = this.stagingValues[0].value;
                    yield ssh.execCommand(console_1.sshMagentoRootFolderMagerunCommand('db:query "' + dbQuery + '"', config, true));
                })
            });
            this.configureTasks.push({
                title: "Configuring ElasticSearch 7/MySQL",
                task: () => tslib_1.__awaiter(this, void 0, void 0, function* () {
                    // TODO: Keep Elastic settings
                    let dbQuery = '';
                    let dbQueryUpdate = '';
                    let jsonEngineCheck = ''; // Types supported: 'elasticsearch7', 'amasty_elastic';
                    let engineCheck = yield ssh.execCommand(console_1.sshMagentoRootFolderMagerunCommand('config:store:get "catalog/search/engine" --format=json', config, true));
                    // @ts-ignore
                    if (engineCheck.length > 0) {
                        try {
                            const obj = JSON.parse(engineCheck);
                            if (obj && typeof obj === `object`) {
                                jsonEngineCheck = JSON.parse(engineCheck)[0].Value;
                            }
                        }
                        catch (err) { }
                    }
                    // Configure Elastic to use version 7 if engine is not mysql
                    if (jsonEngineCheck.indexOf("mysql") == -1) {
                        // Update queries
                        dbQueryUpdate = `UPDATE core_config_data SET value = '0' WHERE path LIKE '%_enable_auth%';`;
                        // Amasty elasticsearch check
                        if (jsonEngineCheck.indexOf("amasty_elastic") !== -1) {
                            dbQueryUpdate = dbQueryUpdate + `UPDATE core_config_data SET value = '${config.databases.databaseDataSecond.username}_staging_' WHERE path LIKE '%_index_prefix%';`,
                                dbQueryUpdate = dbQueryUpdate + `UPDATE core_config_data SET value = '${config.databases.databaseDataSecond.username}_staging_' WHERE path LIKE '%elastic_prefix%';`,
                                dbQueryUpdate = dbQueryUpdate + `UPDATE core_config_data SET value = 'amasty_elastic' WHERE path = 'catalog/search/engine';`,
                                dbQueryUpdate = dbQueryUpdate + `UPDATE core_config_data SET value = 'amasty_elastic' WHERE path = 'amasty_elastic/connection/engine';`;
                        }
                        else {
                            // Standard elasticsearch7 settings
                            dbQueryUpdate = dbQueryUpdate + `UPDATE core_config_data SET value = '${config.databases.databaseDataSecond.username}_staging' WHERE path LIKE '%_index_prefix%';`,
                                dbQueryUpdate = dbQueryUpdate + `UPDATE core_config_data SET value = '${config.databases.databaseDataSecond.username}_staging_' WHERE path LIKE '%elastic_prefix%';`,
                                dbQueryUpdate = dbQueryUpdate + `UPDATE core_config_data SET value = 'elasticsearch7' WHERE path = 'catalog/search/engine';`;
                        }
                        // Build up query
                        dbQuery = dbQueryUpdate;
                        yield ssh.execCommand(console_1.sshMagentoRootFolderMagerunCommand('db:query "' + dbQuery + '"', config, true));
                        config.settings.elasticSearchUsed = true;
                    }
                })
            });
            if (config.settings.runCommands && config.settings.runCommands == 'yes') {
                this.configureTasks.push({
                    title: 'Running project commands',
                    task: () => tslib_1.__awaiter(this, void 0, void 0, function* () {
                        // Magerun2 commands
                        if (config.settings.magerun2Command && config.settings.magerun2Command.length > 0) {
                            let commands = config.settings.magerun2Command.replace('magerun2 ', '');
                            yield ssh.execCommand(console_1.sshMagentoRootFolderMagerunCommand(commands, config, true));
                        }
                        // Database queries
                        if (config.settings.databaseCommand && config.settings.databaseCommand.length > 0) {
                            let dbQuery = config.settings.databaseCommand.replace(/'/g, '"');
                            yield ssh.execCommand(console_1.sshMagentoRootFolderMagerunCommand(`db:query '` + dbQuery + `'`, config, true));
                        }
                    })
                });
            }
            this.configureTasks.push({
                title: "Synchronizing module versions on staging",
                task: () => tslib_1.__awaiter(this, void 0, void 0, function* () {
                    yield ssh.execCommand(console_1.sshMagentoRootFolderMagerunCommand('sys:setup:downgrade-versions ', config, true));
                    yield ssh.execCommand(console_1.sshNavigateToMagentoRootCommand('bin/magento setup:upgrade --keep-generated', config, true));
                })
            });
            this.configureTasks.push({
                title: 'Reindexing Magento',
                task: () => tslib_1.__awaiter(this, void 0, void 0, function* () {
                    // Reindex data, only when elastic is used
                    if (config.settings.elasticSearchUsed) {
                        yield ssh.execCommand(console_1.sshMagentoRootFolderMagerunCommand('index:reindex catalog_category_product catalog_product_category catalog_product_price cataloginventory_stock', config, true));
                    }
                })
            });
            this.configureTasks.push({
                title: "Flushing Magento caches",
                task: () => tslib_1.__awaiter(this, void 0, void 0, function* () {
                    yield ssh.execCommand(console_1.sshMagentoRootFolderMagerunCommand('cache:enable', config, true));
                    yield ssh.execCommand(console_1.sshMagentoRootFolderMagerunCommand('cache:flush', config, true));
                    yield ssh.execCommand(console_1.sshMagentoRootFolderMagerunCommand('app:config:import', config, true));
                })
            });
            this.configureTasks.push({
                title: 'Cleaning up',
                task: () => tslib_1.__awaiter(this, void 0, void 0, function* () {
                    // Remove SQL file
                    yield ssh.execCommand(console_1.sshNavigateToMagentoRootCommand(`rm  ${config.serverVariables.databaseName}.sql`, config, true));
                    // Remove Magerun2 file
                    yield ssh.execCommand(console_1.sshNavigateToMagentoRootCommand(`rm ${config.serverVariables.magerunFile}`, config, true));
                })
            });
        });
    }
}
exports.default = SyncImportTask;
//# sourceMappingURL=syncImportTask.js.map