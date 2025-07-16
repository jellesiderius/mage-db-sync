"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const tslib_1 = require("tslib");
const console_1 = require("../utils/console");
class SyncImportTask {
    constructor() {
        this.importTasks = [];
        this.configureTasks = [];
        this.stagingValues = {};
        this.configure = (list, config, ssh) => (0, tslib_1.__awaiter)(this, void 0, void 0, function* () {
            yield this.addTasks(list, config, ssh);
            return list;
        });
        this.collectStagingConfigValue = (path, ssh, config) => (0, tslib_1.__awaiter)(this, void 0, void 0, function* () {
            let self = this;
            let json = yield ssh.execCommand((0, console_1.sshMagentoRootFolderMagerunCommand)('config:store:get "' + path + '" --format=json', config, true));
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
                    // @ts-ignore
                    self.stagingValues[path] = [];
                    Object.keys(jsonObj).forEach(function (item) {
                        var objectItem = jsonObj[item];
                        var objectItemPath = objectItem['Path'];
                        var objectItemValue = String(objectItem['Value']);
                        var objectItemScopeId = parseInt(objectItem['Scope-ID']);
                        var objectItemScope = objectItem['Scope'];
                        if (objectItemValue == '' || objectItemValue == 'NULL' || objectItemValue == 'null') {
                            return;
                        }
                        // @ts-ignore
                        self.stagingValues[path].push({
                            // @ts-ignore
                            'path': objectItemPath,
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
        this.addTasks = (list, config, ssh) => (0, tslib_1.__awaiter)(this, void 0, void 0, function* () {
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
                task: () => (0, tslib_1.__awaiter)(this, void 0, void 0, function* () {
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
                task: () => (0, tslib_1.__awaiter)(this, void 0, void 0, function* () {
                    // Retrieve settings from server to use
                    yield ssh.execCommand((0, console_1.sshNavigateToMagentoRootCommand)('test -e vendor/magento && test -e app/etc/env.php && echo 2 || echo 1; pwd; which php;', config, true)).then((result) => {
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
                    if (config.serverVariables.magentoVersion != 2) {
                        (0, console_1.error)('Magento 2 not completely found staging server, are app/etc/env.php & vendor/magento present?');
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
                task: () => (0, tslib_1.__awaiter)(this, void 0, void 0, function* () {
                    // Download Magerun to the server
                    yield ssh.execCommand((0, console_1.sshNavigateToMagentoRootCommand)('curl -O https://raw.githubusercontent.com/jellesiderius/mage-db-sync/master/files/' + config.serverVariables.magerunFile, config, true));
                })
            });
            this.importTasks.push({
                title: 'Retrieving current staging core_config_data needed values',
                task: () => (0, tslib_1.__awaiter)(this, void 0, void 0, function* () {
                    // General
                    yield this.collectStagingConfigValue('web/*', ssh, config);
                    yield this.collectStagingConfigValue('admin/*', ssh, config);
                    yield this.collectStagingConfigValue('checkout/*', ssh, config);
                    yield this.collectStagingConfigValue('magmodules_richsnippets/*', ssh, config);
                    yield this.collectStagingConfigValue('sherpaan_*', ssh, config);
                    yield this.collectStagingConfigValue('sherpaconnect2/*', ssh, config);
                    // Email
                    yield this.collectStagingConfigValue('email/*', ssh, config);
                    yield this.collectStagingConfigValue('trans_email/*', ssh, config);
                    yield this.collectStagingConfigValue('sales_email/*', ssh, config);
                    yield this.collectStagingConfigValue('smtp/*', ssh, config);
                    yield this.collectStagingConfigValue('mailchimp/*', ssh, config);
                    yield this.collectStagingConfigValue('smtppro/*', ssh, config);
                    yield this.collectStagingConfigValue('cart2quote_email/*', ssh, config);
                    // Search
                    yield this.collectStagingConfigValue('search/*', ssh, config);
                    yield this.collectStagingConfigValue('catalog/search/*', ssh, config);
                    yield this.collectStagingConfigValue('elasticsearch/*', ssh, config);
                    yield this.collectStagingConfigValue('klevu_search/*', ssh, config);
                    // Shipping
                    yield this.collectStagingConfigValue('shipping/*', ssh, config);
                    yield this.collectStagingConfigValue('carriers/*', ssh, config);
                    yield this.collectStagingConfigValue('tig_postnl/*', ssh, config);
                    yield this.collectStagingConfigValue('postcodenl/*', ssh, config);
                    yield this.collectStagingConfigValue('euvat/*', ssh, config);
                    // Payment
                    yield this.collectStagingConfigValue('payment/*', ssh, config);
                    yield this.collectStagingConfigValue('buckaroo_magento2/*', ssh, config);
                    yield this.collectStagingConfigValue('tig_buckaroo/*', ssh, config);
                    yield this.collectStagingConfigValue('msp/*', ssh, config);
                    yield this.collectStagingConfigValue('msp_gateways/*', ssh, config);
                    yield this.collectStagingConfigValue('gateways/*', ssh, config);
                    // Recaptcha
                    yield this.collectStagingConfigValue('recaptcha_frontend/*', ssh, config);
                    yield this.collectStagingConfigValue('recaptcha_backend/*', ssh, config);
                })
            });
            this.importTasks.push({
                title: 'Uploading database file to server',
                task: () => (0, tslib_1.__awaiter)(this, void 0, void 0, function* () {
                    // Push file to server through rSync
                    yield (0, console_1.localhostMagentoRootExec)(`rsync -avz -e "ssh -p ${config.databases.databaseDataSecond.port}" ${config.finalMessages.magentoDatabaseLocation} ${config.databases.databaseDataSecond.username}@${config.databases.databaseDataSecond.server}:${config.serverVariables.magentoRoot}`, config, true);
                    // Add include tables file
                    yield (0, console_1.localhostMagentoRootExec)(`rsync -avz -e "ssh -p ${config.databases.databaseDataSecond.port}" ${config.finalMessages.magentoDatabaseIncludeLocation} ${config.databases.databaseDataSecond.username}@${config.databases.databaseDataSecond.server}:${config.serverVariables.magentoRoot}`, config, true);
                })
            });
            this.importTasks.push({
                title: 'Importing Magento database',
                task: () => (0, tslib_1.__awaiter)(this, void 0, void 0, function* () {
                    // Create database
                    yield ssh.execCommand((0, console_1.sshMagentoRootFolderMagerunCommand)(`db:import ${config.serverVariables.databaseName}.sql --force --skip-authorization-entry-creation -q --drop`, config, true));
                })
            });
            this.importTasks.push({
                title: 'Importing tables to keep into database',
                task: () => (0, tslib_1.__awaiter)(this, void 0, void 0, function* () {
                    // Create database
                    yield ssh.execCommand((0, console_1.sshMagentoRootFolderMagerunCommand)(`db:import ${config.serverVariables.databaseName}-include.sql --force --skip-authorization-entry-creation -q`, config, true));
                })
            });
            if (config.settings.syncImages == 'yes') {
                this.importTasks.push({
                    title: 'Synchronizing media images & files',
                    task: () => (0, tslib_1.__awaiter)(this, void 0, void 0, function* () {
                        // Push media files to server
                        var tmpLocalMediaPath = `${config.customConfig.localDatabaseFolderLocation}/tmpMediaImages`;
                        yield (0, console_1.localhostMagentoRootExec)(`rsync -avz -e "ssh -p ${config.databases.databaseDataSecond.port}" ${tmpLocalMediaPath}/* ${config.databases.databaseDataSecond.username}@${config.databases.databaseDataSecond.server}:${config.serverVariables.magentoRoot}/pub/media/`, config, true);
                        // Remove files from local machine
                        yield (0, console_1.consoleCommand)(`rm -rf ${tmpLocalMediaPath}`, true);
                    })
                });
            }
            this.configureTasks.push({
                title: "Preparing the core_config_data table",
                task: () => (0, tslib_1.__awaiter)(this, void 0, void 0, function* () {
                    let self = this;
                    // Delete queries
                    var dbQueryRemove = "DELETE FROM core_config_data WHERE path LIKE 'dev/static/sign';", dbQueryRemove = dbQueryRemove + "DELETE FROM core_config_data WHERE path LIKE 'dev/css/merge_css_files';", dbQueryRemove = dbQueryRemove + "DELETE FROM core_config_data WHERE path LIKE 'dev/js/minify_files';", dbQueryRemove = dbQueryRemove + "DELETE FROM core_config_data WHERE path LIKE 'dev/css/minify_files';", dbQueryRemove = dbQueryRemove + "DELETE FROM core_config_data WHERE path LIKE 'dev/js/enable_js_bundling';", dbQueryRemove = dbQueryRemove + "DELETE FROM core_config_data WHERE path LIKE 'design/search_engine_robots/default_robots';";
                    // Insert queries
                    var dbQueryInsert = "INSERT INTO core_config_data (scope, scope_id, path, value) VALUES ('default', '0', 'dev/static/sign', '1');", dbQueryInsert = dbQueryInsert + "INSERT INTO core_config_data (scope, scope_id, path, value) VALUES ('default', '0', 'dev/css/merge_css_files', '0');", dbQueryInsert = dbQueryInsert + "INSERT INTO core_config_data (scope, scope_id, path, value) VALUES ('default', '0', 'dev/js/minify_files', '0');", dbQueryInsert = dbQueryInsert + "INSERT INTO core_config_data (scope, scope_id, path, value) VALUES ('default', '0', 'dev/css/minify_files', '0');", dbQueryInsert = dbQueryInsert + "INSERT INTO core_config_data (scope, scope_id, path, value) VALUES ('default', '0', 'dev/js/enable_js_bundling', '0');", dbQueryInsert = dbQueryInsert + "INSERT INTO core_config_data (scope, scope_id, path, value) VALUES ('default', '0', 'design/search_engine_robots/default_robots', 'NOINDEX,NOFOLLOW');";
                    // INITIAL DELETE QUERY
                    yield ssh.execCommand((0, console_1.sshMagentoRootFolderMagerunCommand)('db:query "' + dbQueryRemove + '"', config, true));
                    // INITIAL IMPORT QUERY
                    yield ssh.execCommand((0, console_1.sshMagentoRootFolderMagerunCommand)('db:query "' + dbQueryInsert + '"', config, true));
                    for (const itemKey of Object.keys(this.stagingValues)) {
                        var itemDeleteQuery = '';
                        var itemInsertQuery = '';
                        // @ts-ignore
                        for (const itemKeyChild of Object.keys(this.stagingValues[itemKey])) {
                            // @ts-ignore
                            var item = this.stagingValues[itemKey][itemKeyChild];
                            itemDeleteQuery = itemDeleteQuery + `DELETE FROM core_config_data WHERE path LIKE '${item.path}';`;
                            itemInsertQuery = itemInsertQuery + `INSERT INTO core_config_data (scope, scope_id, path, value) VALUES ('${item.scope}', '${item.scope_id}', '${item.path}', '${item.value}');`;
                        }
                        // DELETE QUERY
                        yield ssh.execCommand((0, console_1.sshMagentoRootFolderMagerunCommand)('db:query "' + itemDeleteQuery + '"', config, true));
                        // IMPORT QUERY
                        yield ssh.execCommand((0, console_1.sshMagentoRootFolderMagerunCommand)('db:query "' + itemInsertQuery + '"', config, true));
                    }
                })
            });
            this.configureTasks.push({
                title: "Configuring ElasticSearch 7/MySQL",
                task: () => (0, tslib_1.__awaiter)(this, void 0, void 0, function* () {
                    let dbQuery = '';
                    let dbQueryUpdate = '';
                    let jsonEngineCheck = ''; // Types supported: 'elasticsearch7', 'amasty_elastic';
                    let engineCheck = yield ssh.execCommand((0, console_1.sshMagentoRootFolderMagerunCommand)('config:store:get "catalog/search/engine" --format=json', config, true));
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
                        yield ssh.execCommand((0, console_1.sshMagentoRootFolderMagerunCommand)('db:query "' + dbQuery + '"', config, true));
                        config.settings.elasticSearchUsed = true;
                    }
                })
            });
            if (config.settings.runCommands && config.settings.runCommands == 'yes') {
                this.configureTasks.push({
                    title: 'Running project commands',
                    task: () => (0, tslib_1.__awaiter)(this, void 0, void 0, function* () {
                        // Magerun2 commands
                        if (config.settings.magerun2Command && config.settings.magerun2Command.length > 0) {
                            let commands = config.settings.magerun2Command.replace('magerun2 ', '');
                            yield ssh.execCommand((0, console_1.sshMagentoRootFolderMagerunCommand)(commands, config, true));
                        }
                        // Database queries
                        if (config.settings.databaseCommand && config.settings.databaseCommand.length > 0) {
                            let dbQuery = config.settings.databaseCommand.replace(/'/g, '"');
                            yield ssh.execCommand((0, console_1.sshMagentoRootFolderMagerunCommand)(`db:query '` + dbQuery + `'`, config, true));
                        }
                    })
                });
            }
            this.configureTasks.push({
                title: "Synchronizing module versions on staging",
                task: () => (0, tslib_1.__awaiter)(this, void 0, void 0, function* () {
                    yield ssh.execCommand((0, console_1.sshMagentoRootFolderMagerunCommand)('sys:setup:downgrade-versions ', config, true));
                    yield ssh.execCommand((0, console_1.sshNavigateToMagentoRootCommand)('bin/magento setup:upgrade --keep-generated', config, true));
                })
            });
            this.configureTasks.push({
                title: 'Reindexing Magento',
                task: () => (0, tslib_1.__awaiter)(this, void 0, void 0, function* () {
                    // Reindex data, only when elastic is used
                    if (config.settings.elasticSearchUsed) {
                        yield ssh.execCommand((0, console_1.sshMagentoRootFolderMagerunCommand)('index:reindex catalog_category_product catalog_product_category catalog_product_price cataloginventory_stock', config, true));
                    }
                })
            });
            this.configureTasks.push({
                title: "Flushing Magento caches",
                task: () => (0, tslib_1.__awaiter)(this, void 0, void 0, function* () {
                    yield ssh.execCommand((0, console_1.sshMagentoRootFolderMagerunCommand)('cache:enable', config, true));
                    yield ssh.execCommand((0, console_1.sshMagentoRootFolderMagerunCommand)('cache:flush', config, true));
                    yield ssh.execCommand((0, console_1.sshMagentoRootFolderMagerunCommand)('app:config:import', config, true));
                })
            });
            this.configureTasks.push({
                title: 'Cleaning up',
                task: () => (0, tslib_1.__awaiter)(this, void 0, void 0, function* () {
                    // Remove SQL file
                    yield ssh.execCommand((0, console_1.sshNavigateToMagentoRootCommand)(`rm  ${config.serverVariables.databaseName}.sql`, config, true));
                    // Remove Magerun2 file
                    yield ssh.execCommand((0, console_1.sshNavigateToMagentoRootCommand)(`rm ${config.serverVariables.magerunFile}`, config, true));
                })
            });
        });
    }
}
exports.default = SyncImportTask;
//# sourceMappingURL=syncImportTask.js.map