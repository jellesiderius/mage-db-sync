"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const tslib_1 = require("tslib");
const console_1 = require("../utils/console");
class ImportTask {
    constructor() {
        this.importTasks = [];
        this.configure = (list, config) => (0, tslib_1.__awaiter)(this, void 0, void 0, function* () {
            yield this.addTasks(list, config);
            return list;
        });
        // Add tasks
        this.addTasks = (list, config) => (0, tslib_1.__awaiter)(this, void 0, void 0, function* () {
            list.add({
                title: 'Import Magento database to localhost',
                task: (ctx, task) => task.newListr(this.importTasks)
            });
            let importTitle = "Importing database";
            if (config.settings.isDdevActive) {
                importTitle = "Importing database (DDEV)";
            }
            this.importTasks.push({
                title: importTitle,
                task: () => (0, tslib_1.__awaiter)(this, void 0, void 0, function* () {
                    if (config.settings.isDdevActive) {
                        let mysqlCommand1 = `ddev mysql -uroot -proot -hdb -e "CREATE DATABASE IF NOT EXISTS ${config.serverVariables.databaseName};"""`;
                        let mysqlCommand2 = `ddev mysql -uroot -proot -hdb -e "GRANT ALL PRIVILEGES ON *.* TO 'db'@'localhost';"""`;
                        let mysqlCommand3 = `ddev mysql -uroot -proot -hdb -e "GRANT ALL PRIVILEGES ON *.* TO 'db'@'%';"""`;
                        yield (0, console_1.localhostMagentoRootExec)(mysqlCommand1, config, true);
                        yield (0, console_1.localhostMagentoRootExec)(mysqlCommand2, config, true);
                        yield (0, console_1.localhostMagentoRootExec)(mysqlCommand3, config, true);
                        yield (0, console_1.localhostMagentoRootExec)(`ddev exec /usr/bin/php8.1 /usr/local/bin/magerun2 self-update 7.5.0 > /dev/null 2>&1`, config, true);
                        yield (0, console_1.localhostMagentoRootExec)(`ddev import-db --src=${config.serverVariables.databaseName}.sql`, config);
                    }
                    else {
                        // Create database
                        yield (0, console_1.localhostMagentoRootExec)(`${config.settings.magerun2CommandLocal} db:create -q`, config);
                        // Import SQL file to database
                        yield (0, console_1.localhostMagentoRootExec)(`${config.settings.magerun2CommandLocal} db:import ${config.serverVariables.databaseName}.sql --force --skip-authorization-entry-creation -q --drop`, config);
                        // Add default admin authorization rules (Fix for missing auth roles)
                        yield (0, console_1.localhostMagentoRootExec)(`${config.settings.magerun2CommandLocal} db:add-default-authorization-entries -q`, config);
                    }
                })
            });
            this.importTasks.push({
                title: 'Cleaning up',
                task: () => (0, tslib_1.__awaiter)(this, void 0, void 0, function* () {
                    // Remove local SQL file
                    yield (0, console_1.localhostMagentoRootExec)('rm ' + config.serverVariables.databaseName + '.sql', config);
                })
            });
        });
    }
}
exports.default = ImportTask;
//# sourceMappingURL=importTask.js.map