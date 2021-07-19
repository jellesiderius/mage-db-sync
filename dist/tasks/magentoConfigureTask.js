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
                    var dbQueryRemove = "DELETE FROM core_config_data WHERE path LIKE 'web/cookie/cookie_domain';", dbQueryRemove = dbQueryRemove + "DELETE FROM core_config_data WHERE path LIKE 'dev/static/sign';", dbQueryRemove = dbQueryRemove + "DELETE FROM core_config_data WHERE path LIKE '%smtp%';", dbQueryRemove = dbQueryRemove + "DELETE FROM core_config_data WHERE path LIKE 'admin/url/use_custom';", dbQueryRemove = dbQueryRemove + "DELETE FROM core_config_data WHERE path LIKE 'admin/url/use_custom_path';", dbQueryRemove = dbQueryRemove + "DELETE FROM core_config_data WHERE path LIKE 'web/unsecure/base_static_url';", dbQueryRemove = dbQueryRemove + "DELETE FROM core_config_data WHERE path LIKE 'web/unsecure/base_media_url';", dbQueryRemove = dbQueryRemove + "DELETE FROM core_config_data WHERE path LIKE 'web/unsecure/base_link_url';", dbQueryRemove = dbQueryRemove + "DELETE FROM core_config_data WHERE path LIKE 'web/unsecure/base_url';", dbQueryRemove = dbQueryRemove + "DELETE FROM core_config_data WHERE path LIKE 'web/secure/base_static_url';", dbQueryRemove = dbQueryRemove + "DELETE FROM core_config_data WHERE path LIKE 'web/secure/base_media_url';", dbQueryRemove = dbQueryRemove + "DELETE FROM core_config_data WHERE path LIKE 'web/secure/base_link_url';", dbQueryRemove = dbQueryRemove + "DELETE FROM core_config_data WHERE path LIKE 'web/secure/base_url';";
                    // Update queries
                    var dbQueryUpdate = "UPDATE core_config_data SET value = '0' WHERE path = 'web/secure/use_in_frontend';", dbQueryUpdate = dbQueryRemove + "UPDATE core_config_data SET value = '0' WHERE path = 'web/secure/use_in_adminhtml';";
                    let baseUrl = 'http://' + config.settings.magentoLocalhostDomainName + '/';
                    // Insert queries
                    var dbQueryInsert = "INSERT INTO core_config_data (scope, scope_id, path, value) VALUES ('default', '0', 'web/unsecure/base_static_url', '{{unsecure_base_url}}static/');", dbQueryInsert = dbQueryInsert + "INSERT INTO core_config_data (scope, scope_id, path, value) VALUES ('default', '0', 'web/unsecure/base_media_url', '{{unsecure_base_url}}media/');", dbQueryInsert = dbQueryInsert + "INSERT INTO core_config_data (scope, scope_id, path, value) VALUES ('default', '0', 'web/unsecure/base_link_url', '{{unsecure_base_url}}');", dbQueryInsert = dbQueryInsert + "INSERT INTO core_config_data (scope, scope_id, path, value) VALUES ('default', '0', 'web/secure/base_static_url', '{{secure_base_url}}static/');", dbQueryInsert = dbQueryInsert + "INSERT INTO core_config_data (scope, scope_id, path, value) VALUES ('default', '0', 'web/secure/base_media_url', '{{secure_base_url}}media/');", dbQueryInsert = dbQueryInsert + "INSERT INTO core_config_data (scope, scope_id, path, value) VALUES ('default', '0', 'web/secure/base_link_url', '{{secure_base_url}}');", dbQueryInsert = dbQueryInsert + "INSERT INTO core_config_data (scope, scope_id, path, value) VALUES ('default', '0', 'web/unsecure/base_url', '" + baseUrl + "');", dbQueryInsert = dbQueryInsert + "INSERT INTO core_config_data (scope, scope_id, path, value) VALUES ('default', '0', 'web/secure/base_url', '" + baseUrl + "');", dbQueryInsert = dbQueryInsert + "INSERT INTO core_config_data (scope, scope_id, path, value) VALUES ('default', '0', 'dev/static/sign', '0');";
                    // Build up query
                    dbQuery = dbQuery + dbQueryRemove + dbQueryUpdate + dbQueryInsert;
                    // Set import domain for final message on completing all tasks
                    config.finalMessages.importDomain = baseUrl;
                    yield console_1.localhostMagentoRootExec('magerun2 db:query "' + dbQuery + '"', config);
                })
            });
            this.configureTasks.push({
                title: "Configuring ElasticSearch 7/MySQL",
                task: () => tslib_1.__awaiter(this, void 0, void 0, function* () {
                    let dbQuery = '';
                    let dbQueryUpdate = '';
                    let jsonEngineCheck = '';
                    let engineCheck = yield console_1.localhostMagentoRootExec('magerun2 config:store:get "catalog/search/engine" --format=json', config);
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
                    // Configure Elastic to use version 7
                    if (jsonEngineCheck && jsonEngineCheck != 'mysql') {
                        // Update queries
                        dbQueryUpdate = `UPDATE core_config_data SET value = 'localhost' WHERE path LIKE '%_server_hostname%';`,
                            dbQueryUpdate = dbQueryUpdate + `UPDATE core_config_data SET value = '${settings_json_1.default.general.elasticsearchPort}' WHERE path LIKE '%_server_port%';`,
                            dbQueryUpdate = dbQueryUpdate + `UPDATE core_config_data SET value = '${config.settings.currentFolderName}_development' WHERE path LIKE '%_index_prefix%';`,
                            dbQueryUpdate = dbQueryUpdate + `UPDATE core_config_data SET value = '${config.settings.currentFolderName}_development_' WHERE path LIKE '%elastic_prefix%';`,
                            dbQueryUpdate = dbQueryUpdate + `UPDATE core_config_data SET value = '0' WHERE path LIKE '%_enable_auth%';`,
                            dbQueryUpdate = dbQueryUpdate + `UPDATE core_config_data SET value = 'elasticsearch7' WHERE path = 'catalog/search/engine';`;
                        // Build up query
                        dbQuery = dbQueryUpdate;
                        yield console_1.localhostMagentoRootExec('magerun2 db:query "' + dbQuery + '"', config);
                        config.settings.elasticSearchUsed = true;
                    }
                })
            });
            this.configureTasks.push({
                title: 'Creating a admin user',
                task: () => tslib_1.__awaiter(this, void 0, void 0, function* () {
                    // Create a new admin user
                    yield console_1.localhostMagentoRootExec(`magerun2 admin:user:create --admin-user=${settings_json_1.default.magentoBackend.adminUsername} --admin-password=${settings_json_1.default.magentoBackend.adminPassword} --admin-email=${settings_json_1.default.magentoBackend.adminEmailAddress} --admin-firstname=Firstname --admin-lastname=Lastname`, config);
                })
            });
            this.configureTasks.push({
                title: 'Creating a dummy customer on every website',
                task: () => tslib_1.__awaiter(this, void 0, void 0, function* () {
                    // Create new dummy customers for all websites
                    // Get all websites
                    let allWebsites = yield console_1.localhostMagentoRootExec(`magerun2 sys:website:list --format=json`, config);
                    allWebsites = JSON.parse(allWebsites);
                    // @ts-ignore
                    for (const [key, value] of Object.entries(allWebsites)) {
                        // @ts-ignore
                        let code = value.code;
                        yield console_1.localhostMagentoRootExec(`magerun2 customer:create ${settings_json_1.default.magentoBackend.adminEmailAddress} ${settings_json_1.default.magentoBackend.adminPassword} Firstname Lastname ${code}`, config);
                    }
                })
            });
            this.configureTasks.push({
                title: "Configuring Fishpig's Wordpress module",
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
                        yield console_1.localhostMagentoRootExec('magerun2 db:query "' + dbQuery + '"', config);
                    }
                })
            });
            this.configureTasks.push({
                title: 'Synchronizing module versions on localhost',
                task: () => tslib_1.__awaiter(this, void 0, void 0, function* () {
                    // Downgrade module data in database
                    yield console_1.localhostMagentoRootExec("magerun2 sys:setup:downgrade-versions", config);
                })
            });
            this.configureTasks.push({
                title: 'Removing generated code',
                task: () => tslib_1.__awaiter(this, void 0, void 0, function* () {
                    // Remove generated code
                    yield console_1.localhostMagentoRootExec("rm -rf generated/code", config);
                })
            });
            this.configureTasks.push({
                title: 'Reindexing Magento',
                task: () => tslib_1.__awaiter(this, void 0, void 0, function* () {
                    // Reindex data, only when elastic is used
                    if (config.settings.elasticSearchUsed) {
                        yield console_1.localhostMagentoRootExec(`magerun2 index:reindex`, config);
                    }
                })
            });
            this.configureTasks.push({
                title: 'Flushing Magento caches',
                task: () => tslib_1.__awaiter(this, void 0, void 0, function* () {
                    // Flush the magento caches and import config data
                    yield console_1.localhostMagentoRootExec(`magerun2 cache:enable; magerun2 cache:flush; magerun2 app:config:import`, config);
                })
            });
        });
    }
}
exports.default = MagentoConfigureTask;
//# sourceMappingURL=magentoConfigureTask.js.map