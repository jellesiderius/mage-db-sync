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
                    // Drop database
                    yield console_1.localhostMagentoRootExec(`magerun2 db:drop -f -q`, config);
                    // Create database
                    yield console_1.localhostMagentoRootExec(`magerun2 db:create -q`, config);
                    // Import SQL file to database
                    yield console_1.localhostMagentoRootExec(`magerun2 db:import ${config.serverVariables.databaseName}.sql --force --skip-authorization-entry-creation -q`, config);
                    // Add default admin authorization rules (Fix for missing auth roles)
                    yield console_1.localhostMagentoRootExec(`magerun2 db:add-default-authorization-entries -q`, config);
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