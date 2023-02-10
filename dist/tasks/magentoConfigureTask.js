"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const tslib_1 = require("tslib");
const console_1 = require("../utils/console");
const settings_json_1 = tslib_1.__importDefault(require("../../config/settings.json"));
class MagentoConfigureTask {
    constructor() {
        this.configureTasks = [];
        this.configure = (list, config) => tslib_1.__awaiter(this, void 0, void 0, function* () {
            yield this.addTasks(list, config);
            return list;
        });
        // Add tasks
        this.addTasks = (list, config) => tslib_1.__awaiter(this, void 0, void 0, function* () {
            list.add({
                title: 'Configuring Magento for development usage',
                task: (ctx, task) => task.newListr(this.configureTasks)
            });
            this.configureTasks.push({
                title: "Replacing URL's and doing some preperation for development",
                task: () => tslib_1.__awaiter(this, void 0, void 0, function* () {
                    var dbQuery = '';
                    // Delete queries
                    var dbQueryRemove = "DELETE FROM core_config_data WHERE path LIKE 'web/cookie/cookie_domain';", dbQueryRemove = dbQueryRemove + "DELETE FROM core_config_data WHERE path LIKE 'dev/static/sign';", dbQueryRemove = dbQueryRemove + "DELETE FROM core_config_data WHERE path LIKE '%smtp%';", dbQueryRemove = dbQueryRemove + "DELETE FROM core_config_data WHERE path LIKE 'admin/url/use_custom';", dbQueryRemove = dbQueryRemove + "DELETE FROM core_config_data WHERE path LIKE 'admin/url/use_custom_path';", dbQueryRemove = dbQueryRemove + "DELETE FROM core_config_data WHERE path LIKE 'web/unsecure/base_static_url';", dbQueryRemove = dbQueryRemove + "DELETE FROM core_config_data WHERE path LIKE 'web/unsecure/base_media_url';", dbQueryRemove = dbQueryRemove + "DELETE FROM core_config_data WHERE path LIKE 'web/unsecure/base_link_url';", dbQueryRemove = dbQueryRemove + "DELETE FROM core_config_data WHERE path LIKE 'web/unsecure/base_url';", dbQueryRemove = dbQueryRemove + "DELETE FROM core_config_data WHERE path LIKE 'web/secure/base_static_url';";
                    dbQueryRemove = dbQueryRemove + "DELETE FROM core_config_data WHERE path LIKE 'web/secure/base_media_url';",
                        dbQueryRemove = dbQueryRemove + "DELETE FROM core_config_data WHERE path LIKE 'web/secure/base_link_url';",
                        dbQueryRemove = dbQueryRemove + "DELETE FROM core_config_data WHERE path LIKE 'web/secure/base_url';",
                        dbQueryRemove = dbQueryRemove + "DELETE FROM core_config_data WHERE path LIKE '%ceyenne%';";
                    // Update queries
                    var dbQueryUpdate = "UPDATE core_config_data SET value = '0' WHERE path = 'web/secure/use_in_frontend';", dbQueryUpdate = dbQueryRemove + "UPDATE core_config_data SET value = '0' WHERE path = 'web/secure/use_in_adminhtml';";
                    let baseUrl = 'http://' + config.settings.magentoLocalhostDomainName + '/';
                    // Insert queries
                    var dbQueryInsert = "INSERT INTO core_config_data (scope, scope_id, path, value) VALUES ('default', '0', 'web/unsecure/base_static_url', '{{unsecure_base_url}}static/');", dbQueryInsert = dbQueryInsert + "INSERT INTO core_config_data (scope, scope_id, path, value) VALUES ('default', '0', 'web/unsecure/base_media_url', '{{unsecure_base_url}}media/');", dbQueryInsert = dbQueryInsert + "INSERT INTO core_config_data (scope, scope_id, path, value) VALUES ('default', '0', 'web/unsecure/base_link_url', '{{unsecure_base_url}}');", dbQueryInsert = dbQueryInsert + "INSERT INTO core_config_data (scope, scope_id, path, value) VALUES ('default', '0', 'web/secure/base_static_url', '{{secure_base_url}}static/');", dbQueryInsert = dbQueryInsert + "INSERT INTO core_config_data (scope, scope_id, path, value) VALUES ('default', '0', 'web/secure/base_media_url', '{{secure_base_url}}media/');", dbQueryInsert = dbQueryInsert + "INSERT INTO core_config_data (scope, scope_id, path, value) VALUES ('default', '0', 'web/secure/base_link_url', '{{secure_base_url}}');", dbQueryInsert = dbQueryInsert + "INSERT INTO core_config_data (scope, scope_id, path, value) VALUES ('default', '0', 'web/unsecure/base_url', '" + baseUrl + "');", dbQueryInsert = dbQueryInsert + "INSERT INTO core_config_data (scope, scope_id, path, value) VALUES ('default', '0', 'web/secure/base_url', '" + baseUrl + "');", dbQueryInsert = dbQueryInsert + "INSERT INTO core_config_data (scope, scope_id, path, value) VALUES ('default', '0', 'dev/static/sign', '0');";
                    // Build up query
                    dbQuery = dbQuery + dbQueryRemove + dbQueryUpdate + dbQueryInsert;
                    // Set import domain for final message on completing all tasks
                    config.finalMessages.importDomain = baseUrl;
                    yield (0, console_1.localhostMagentoRootExec)(`${config.settings.magerun2CommandLocal} db:query "${dbQuery}"`, config);
                })
            });
            this.configureTasks.push({
                title: "Configuring ElasticSearch 7/MySQL",
                task: () => tslib_1.__awaiter(this, void 0, void 0, function* () {
                    let dbQuery = '';
                    let dbQueryUpdate = '';
                    let jsonEngineCheck = ''; // Types supported: 'elasticsearch7', 'amasty_elastic';
                    let engineCheck = yield (0, console_1.localhostMagentoRootExec)(`${config.settings.magerun2CommandLocal} config:store:get "catalog/search/engine" --format=json`, config);
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
                        dbQueryUpdate = `UPDATE core_config_data SET value = 'localhost' WHERE path LIKE '%_server_hostname%';`,
                            dbQueryUpdate = dbQueryUpdate + `UPDATE core_config_data SET value = '${settings_json_1.default.general.elasticsearchPort}' WHERE path LIKE '%_server_port%';`,
                            dbQueryUpdate = dbQueryUpdate + `UPDATE core_config_data SET value = '0' WHERE path LIKE '%_enable_auth%';`;
                        // Amasty elasticsearch check
                        if (jsonEngineCheck.indexOf("amasty_elastic") !== -1) {
                            dbQueryUpdate = dbQueryUpdate + `UPDATE core_config_data SET value = '${config.settings.currentFolderName}_development_' WHERE path LIKE '%_index_prefix%';`,
                                dbQueryUpdate = dbQueryUpdate + `UPDATE core_config_data SET value = '${config.settings.currentFolderName}_development_' WHERE path LIKE '%elastic_prefix%';`,
                                dbQueryUpdate = dbQueryUpdate + `UPDATE core_config_data SET value = 'amasty_elastic' WHERE path = 'catalog/search/engine';`,
                                dbQueryUpdate = dbQueryUpdate + `UPDATE core_config_data SET value = 'amasty_elastic' WHERE path = 'amasty_elastic/connection/engine';`;
                        }
                        else {
                            // Standard elasticsearch7 settings
                            dbQueryUpdate = dbQueryUpdate + `UPDATE core_config_data SET value = '${config.settings.currentFolderName}_development' WHERE path LIKE '%_index_prefix%';`,
                                dbQueryUpdate = dbQueryUpdate + `UPDATE core_config_data SET value = '${config.settings.currentFolderName}_development_' WHERE path LIKE '%elastic_prefix%';`,
                                dbQueryUpdate = dbQueryUpdate + `UPDATE core_config_data SET value = 'elasticsearch7' WHERE path = 'catalog/search/engine';`;
                        }
                        // Build up query
                        dbQuery = dbQueryUpdate;
                        if (config.settings.isDdevActive) {
                            dbQuery = dbQuery + "DELETE FROM core_config_data WHERE path LIKE 'catalog/search/elasticsearch7_server_hostname';" + "INSERT INTO core_config_data (scope, scope_id, path, value) VALUES ('default', '0', 'catalog/search/elasticsearch7_server_hostname', 'elasticsearch');";
                            dbQuery = dbQuery + `UPDATE core_config_data SET value = 'elasticsearch' WHERE path = 'amasty_elastic/connection/server_hostname';`;
                        }
                        yield (0, console_1.localhostMagentoRootExec)(`${config.settings.magerun2CommandLocal} db:query "${dbQuery}"`, config);
                        config.settings.elasticSearchUsed = true;
                    }
                })
            });
            this.configureTasks.push({
                title: 'Creating an admin user',
                task: () => tslib_1.__awaiter(this, void 0, void 0, function* () {
                    // Remove all current admin users
                    var dbQuery = `DELETE FROM admin_user; ALTER TABLE admin_user AUTO_INCREMENT = 1;`;
                    yield (0, console_1.localhostMagentoRootExec)(`${config.settings.magerun2CommandLocal} db:query "${dbQuery}"`, config);
                    // Fix admin auth
                    yield (0, console_1.localhostMagentoRootExec)(`${config.settings.magerun2CommandLocal} db:add-default-authorization-entries`, config);
                    // Create a new admin user
                    yield (0, console_1.localhostMagentoRootExec)(`${config.settings.magerun2CommandLocal} admin:user:create --admin-user=${settings_json_1.default.magentoBackend.adminUsername} --admin-password=${settings_json_1.default.magentoBackend.adminPassword} --admin-email=${settings_json_1.default.magentoBackend.adminEmailAddress} --admin-firstname=Firstname --admin-lastname=Lastname`, config);
                })
            });
            this.configureTasks.push({
                title: 'Disable reCAPTCHA',
                task: () => tslib_1.__awaiter(this, void 0, void 0, function* () {
                    yield (0, console_1.localhostMagentoRootExec)(`${config.settings.magerun2CommandLocal} config:store:set msp_securitysuite_recaptcha/frontend/enabled 0`, config);
                    yield (0, console_1.localhostMagentoRootExec)(`${config.settings.magerun2CommandLocal} config:store:set msp_securitysuite_recaptcha/backend/enabled 0`, config);
                    yield (0, console_1.localhostMagentoRootExec)(`${config.settings.magerun2CommandLocal} config:store:set admin/captcha/enable 0`, config);
                    yield (0, console_1.localhostMagentoRootExec)(`${config.settings.magerun2CommandLocal} config:store:set customer/captcha/enable 0`, config);
                    yield (0, console_1.localhostMagentoRootExec)(`${config.settings.magerun2CommandLocal} config:store:set recaptcha/general/enabled 0`, config);
                    yield (0, console_1.localhostMagentoRootExec)(`${config.settings.magerun2CommandLocal} config:store:set msp_securitysuite_recaptcha/frontend/enabled 0`, config);
                    yield (0, console_1.localhostMagentoRootExec)(`${config.settings.magerun2CommandLocal} config:store:set msp_securitysuite_recaptcha/frontend/enabled 0`, config);
                })
            });
            this.configureTasks.push({
                title: 'Configuring cache',
                task: () => tslib_1.__awaiter(this, void 0, void 0, function* () {
                    yield (0, console_1.localhostMagentoRootExec)(`${config.settings.magerun2CommandLocal} config:store:set system/full_page_cache/caching_application 1`, config);
                })
            });
            this.configureTasks.push({
                title: 'Creating a dummy customer on every website',
                task: () => tslib_1.__awaiter(this, void 0, void 0, function* () {
                    // Create new dummy customers for all websites
                    // Get all websites
                    let allWebsites = yield (0, console_1.localhostMagentoRootExec)(`${config.settings.magerun2CommandLocal} sys:website:list --format=json`, config);
                    allWebsites = JSON.parse(allWebsites);
                    // @ts-ignore
                    for (const [key, value] of Object.entries(allWebsites)) {
                        // @ts-ignore
                        let code = value.code;
                        yield (0, console_1.localhostMagentoRootExec)(`${config.settings.magerun2CommandLocal} customer:create ${settings_json_1.default.magentoBackend.adminEmailAddress} ${settings_json_1.default.magentoBackend.adminPassword} Firstname Lastname ${code}`, config, true);
                    }
                })
            });
            this.configureTasks.push({
                title: "Configuring Wordpress settings within Magento",
                task: () => tslib_1.__awaiter(this, void 0, void 0, function* () {
                    // If wordpress is imported, we do nothing
                    if (config.settings.wordpressImport && config.settings.wordpressImport == 'yes') {
                        return;
                    }
                    else {
                        let dbQuery = '';
                        // Remove queries
                        let dbQueryRemove = "DELETE FROM core_config_data WHERE path LIKE 'wordpress/setup/enabled';";
                        // Insert commands
                        let dbQueryInsert = "INSERT INTO core_config_data (scope, scope_id, path, value) VALUES ('default', '0', 'wordpress/setup/enabled', '0');";
                        // Build up query
                        dbQuery = dbQuery + dbQueryRemove + dbQueryInsert;
                        yield (0, console_1.localhostMagentoRootExec)(`${config.settings.magerun2CommandLocal} db:query "${dbQuery}"`, config);
                    }
                })
            });
            this.configureTasks.push({
                title: 'Synchronizing module versions on localhost',
                task: () => tslib_1.__awaiter(this, void 0, void 0, function* () {
                    // Downgrade module data in database
                    yield (0, console_1.localhostMagentoRootExec)(`${config.settings.magerun2CommandLocal} sys:setup:downgrade-versions; ${config.settings.magerun2CommandLocal} setup:upgrade`, config);
                })
            });
            if (config.settings.runCommands && config.settings.runCommands == 'yes') {
                this.configureTasks.push({
                    title: 'Running project commands',
                    task: () => tslib_1.__awaiter(this, void 0, void 0, function* () {
                        // Magerun2 commands
                        if (config.settings.magerun2Command && config.settings.magerun2Command.length > 0) {
                            yield (0, console_1.localhostMagentoRootExec)(config.settings.magerun2Command, config, false, true);
                        }
                        // Database queries
                        if (config.settings.databaseCommand && config.settings.databaseCommand.length > 0) {
                            let dbQuery = config.settings.databaseCommand.replace(/'/g, '"');
                            yield (0, console_1.localhostMagentoRootExec)(`${config.settings.magerun2CommandLocal} db:query '` + dbQuery + `'`, config, false, true);
                        }
                    })
                });
            }
            this.configureTasks.push({
                title: 'Removing generated code',
                task: () => tslib_1.__awaiter(this, void 0, void 0, function* () {
                    // Remove generated code
                    yield (0, console_1.localhostMagentoRootExec)("rm -rf generated/code", config);
                })
            });
            this.configureTasks.push({
                title: 'Reindexing Magento',
                task: () => tslib_1.__awaiter(this, void 0, void 0, function* () {
                    // Reindex data, only when elastic is used
                    if (config.settings.elasticSearchUsed) {
                        yield (0, console_1.localhostMagentoRootExec)(`${config.settings.magerun2CommandLocal} index:reindex catalog_category_product catalog_product_category catalog_product_price cataloginventory_stock`, config);
                    }
                })
            });
            this.configureTasks.push({
                title: 'Flushing Magento caches',
                task: () => tslib_1.__awaiter(this, void 0, void 0, function* () {
                    // Flush the magento caches and import config data
                    yield (0, console_1.localhostMagentoRootExec)(`${config.settings.magerun2CommandLocal} cache:enable; ${config.settings.magerun2CommandLocal} cache:flush; ${config.settings.magerun2CommandLocal} app:config:import`, config);
                })
            });
        });
    }
}
exports.default = MagentoConfigureTask;
//# sourceMappingURL=magentoConfigureTask.js.map