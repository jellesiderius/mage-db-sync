"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const tslib_1 = require("tslib");
const console_1 = require("../utils/console");
const settings_json_1 = tslib_1.__importDefault(require("../../config/settings.json"));
class ImportTask {
    constructor() {
        this.importTasks = [];
        this.configure = (list, config) => tslib_1.__awaiter(this, void 0, void 0, function* () {
            yield this.addTasks(list, config);
            return list;
        });
        // Add tasks
        this.addTasks = (list, config) => tslib_1.__awaiter(this, void 0, void 0, function* () {
            list.add({
                title: 'Import Magento database to localhost',
                task: (ctx, task) => task.newListr(this.importTasks)
            });
            this.importTasks.push({
                title: 'Checking if config/settings.json is correctly filled',
                task: () => tslib_1.__awaiter(this, void 0, void 0, function* () {
                    // Lets make sure everything is filled in
                    if (!settings_json_1.default.magentoBackend || settings_json_1.default.magentoBackend && settings_json_1.default.magentoBackend.adminUsername.length == 0) {
                        throw new Error('Admin username is missing config/settings.json');
                    }
                    if (!settings_json_1.default.magentoBackend.adminPassword || settings_json_1.default.magentoBackend.adminPassword && settings_json_1.default.magentoBackend.adminPassword.length == 0) {
                        throw new Error('Admin password is missing in config/settings.json');
                    }
                    if (!settings_json_1.default.magentoBackend.adminEmailAddress || settings_json_1.default.magentoBackend.adminEmailAddress && settings_json_1.default.magentoBackend.adminEmailAddress.length == 0) {
                        throw new Error('Admin email address is missing in config/settings.json');
                    }
                    if (!settings_json_1.default.general.localDomainExtension || settings_json_1.default.general.localDomainExtension && settings_json_1.default.general.localDomainExtension.length == 0) {
                        throw new Error('Local domain extension is missing in config/settings.json');
                    }
                    if (!settings_json_1.default.general.elasticsearchPort || settings_json_1.default.general.elasticsearchPort && settings_json_1.default.general.elasticsearchPort.length == 0) {
                        throw new Error('ElasticSearch port is missing in config/settings.json');
                    }
                })
            });
            this.importTasks.push({
                title: 'Importing database',
                task: () => tslib_1.__awaiter(this, void 0, void 0, function* () {
                    // Import SQL file to database
                    yield console_1.localhostMagentoRootExec(`magerun2 db:import ${config.serverVariables.databaseName}.sql --drop`, config);
                    // Add default admin authorization rules (Fix for missing auth roles)
                    yield console_1.localhostMagentoRootExec(`magerun2 db:add-default-authorization-entries`, config);
                })
            });
            this.importTasks.push({
                title: 'Cleaning up',
                task: () => tslib_1.__awaiter(this, void 0, void 0, function* () {
                    // Remove local SQL file
                    yield console_1.localhostMagentoRootExec('rm ' + config.serverVariables.databaseName + '.sql', config);
                })
            });
        });
    }
}
exports.default = ImportTask;
//# sourceMappingURL=importTask.js.map