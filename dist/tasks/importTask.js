"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const tslib_1 = require("tslib");
const console_1 = require("../utils/console");
const shelljs = tslib_1.__importStar(require("shelljs"));
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
                title: 'Preparing database file',
                task: () => tslib_1.__awaiter(this, void 0, void 0, function* () {
                    let localDatabaseCheck = yield console_1.localhostMagentoRootExec('magerun2 db:info --format=json', config);
                    // @ts-ignore
                    if (localDatabaseCheck && localDatabaseCheck.length > 0) {
                        try {
                            const obj = JSON.parse(localDatabaseCheck);
                            if (obj && typeof obj === `object`) {
                                let localDatabaseName = JSON.parse(localDatabaseCheck)[1].Value;
                                let from = 'ALTER DATABASE `' + config.serverVariables.databaseName + '`';
                                let to = 'ALTER DATABASE `' + localDatabaseName + '`';
                                // @ts-ignore
                                yield shelljs.sed('-i', from, to, `${config.settings.currentFolder}/${config.serverVariables.databaseName}.sql`).a;
                            }
                        }
                        catch (err) { }
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