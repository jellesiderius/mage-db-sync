"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const tslib_1 = require("tslib");
const fs = tslib_1.__importStar(require("fs"));
const console_1 = require("../utils/console");
class ChecksTask {
    constructor() {
        this.configure = (list, config) => tslib_1.__awaiter(this, void 0, void 0, function* () {
            yield this.addTasks(list, config);
            return list;
        });
        // Add tasks
        this.addTasks = (list, config) => tslib_1.__awaiter(this, void 0, void 0, function* () {
            if (config.settings.import && config.settings.import == 'yes') {
                // Check Magerun 2 version
                list.add({
                    title: 'Checking Magerun2 version',
                    task: (ctx, task) => tslib_1.__awaiter(this, void 0, void 0, function* () {
                        // Check the local installed Magerun2 version before we continue and import the database
                        let installedMagerun2Version = yield console_1.consoleCommand('magerun2 -V');
                        // @ts-ignore
                        installedMagerun2Version = installedMagerun2Version.split(' ')[1];
                        // @ts-ignore
                        if (installedMagerun2Version < config.requirements.magerun2Version) {
                            throw new Error(`Your current Magerun2 version is too low. Magerun version ${config.requirements.magerun2Version} is required`);
                        }
                        return true;
                    })
                });
            }
            // Check if target folder exists before downloading
            list.add({
                title: 'Checking if download folder exists',
                task: () => tslib_1.__awaiter(this, void 0, void 0, function* () {
                    // Check if download folder exists
                    if (fs.existsSync(config.customConfig.localDatabaseFolderLocation)) {
                        return true;
                    }
                    throw new Error(`Download folder ${config.customConfig.localDatabaseFolderLocation} does not exist. This can be configured in config/settings.json`);
                })
            });
            // Check if SSH key exists
            list.add({
                title: 'Checking if SSH key exists',
                task: () => tslib_1.__awaiter(this, void 0, void 0, function* () {
                    if (fs.existsSync(config.customConfig.sshKeyLocation)) {
                        return true;
                    }
                    throw new Error(`SSH key ${config.customConfig.sshKeyLocation} does not exist. This can be configured in config/settings.json`);
                })
            });
        });
    }
}
exports.default = ChecksTask;
//# sourceMappingURL=checksTask.js.map