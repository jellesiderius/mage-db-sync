"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const tslib_1 = require("tslib");
const console_1 = require("../utils/console");
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
                title: 'Importing database',
                task: () => tslib_1.__awaiter(this, void 0, void 0, function* () {
                    // Create database
                    yield console_1.localhostMagentoRootExec(`magerun2 db:create -q`, config);
                    // Import SQL file to database
                    yield console_1.localhostMagentoRootExec(`magerun2 db:import ${config.serverVariables.databaseName}.sql --force --skip-authorization-entry-creation -q --drop`, config);
                    // Add default admin authorization rules (Fix for missing auth roles)
                    yield console_1.localhostMagentoRootExec(`magerun2 db:add-default-authorization-entries -q`, config);
                })
            });
            if (config.settings.syncImages == 'yes') {
                this.importTasks.push({
                    title: 'Synchronizing media images',
                    task: () => tslib_1.__awaiter(this, void 0, void 0, function* () {
                        // Sync media
                        yield console_1.localhostMagentoRootExec(`rsync -avz -e "ssh -p ${config.databases.databaseData.port}" ${config.databases.databaseData.username}@${config.databases.databaseData.server}:${config.serverVariables.magentoRoot}/pub/media/* pub/media/ --exclude 'cache' --exclude 'catalog/product/cache' --exclude 'catalog/category/cache' --exclude 'custom_options' --exclude 'tmp' --exclude 'analytics'`, config, true);
                    })
                });
            }
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