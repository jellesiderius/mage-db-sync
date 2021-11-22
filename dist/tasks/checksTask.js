"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const tslib_1 = require("tslib");
const fs = tslib_1.__importStar(require("fs"));
const console_1 = require("../utils/console");
const settings_json_1 = tslib_1.__importDefault(require("../../config/settings.json"));
class ChecksTask {
    constructor() {
        this.checkTasks = [];
        this.configure = (list, config, ssh) => tslib_1.__awaiter(this, void 0, void 0, function* () {
            yield this.addTasks(list, config, ssh);
            return list;
        });
        // Add tasks
        this.addTasks = (list, config, ssh) => tslib_1.__awaiter(this, void 0, void 0, function* () {
            list.add({
                title: 'Running some checks',
                task: (ctx, task) => task.newListr(this.checkTasks)
            });
            if (config.settings.import && config.settings.import == 'yes' || config.settings.wordpressImport && config.settings.wordpressImport == "yes" && config.settings.currentFolderhasWordpress) {
                // Check if all settings are filled in, if we import
                this.checkTasks.push({
                    title: 'Checking if config/settings.json is correctly filled',
                    task: () => tslib_1.__awaiter(this, void 0, void 0, function* () {
                        // Lets make sure everything is filled in
                        if (!settings_json_1.default.magentoBackend.adminUsername || settings_json_1.default.magentoBackend.adminUsername && settings_json_1.default.magentoBackend.adminUsername.length == 0) {
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
                // Check Magerun 2 version
                this.checkTasks.push({
                    title: 'Checking Magerun2 version',
                    task: (ctx, task) => tslib_1.__awaiter(this, void 0, void 0, function* () {
                        // Check the local installed Magerun2 version before we continue and import the database
                        let installedMagerun2Version = yield console_1.consoleCommand('magerun2 -V', false);
                        // @ts-ignore
                        installedMagerun2Version = installedMagerun2Version.split(' ')[1];
                        // @ts-ignore
                        if (installedMagerun2Version < config.requirements.magerun2Version) {
                            throw new Error(`Your current Magerun2 version is too low. Magerun version ${config.requirements.magerun2Version} is required`);
                        }
                        return true;
                    })
                });
                if (config.settings.import && config.settings.import == 'yes') {
                    // Check if target folder exists before downloading
                    this.checkTasks.push({
                        title: 'Checking if env.php file exists',
                        task: () => tslib_1.__awaiter(this, void 0, void 0, function* () {
                            let envFileLocation = config.settings.currentFolder + '/app/etc/env.php';
                            if (fs.existsSync(envFileLocation)) {
                                return true;
                            }
                            throw new Error(`env.php is missing, make sure ${envFileLocation} exists.`);
                        })
                    });
                }
            }
            // Check if target folder exists before downloading
            this.checkTasks.push({
                title: 'Checking if download folder exists',
                task: () => tslib_1.__awaiter(this, void 0, void 0, function* () {
                    if (fs.existsSync(config.customConfig.localDatabaseFolderLocation)) {
                        return true;
                    }
                    throw new Error(`Download folder ${config.customConfig.localDatabaseFolderLocation} does not exist. This can be configured in config/settings.json`);
                })
            });
            // Check if SSH key exists
            this.checkTasks.push({
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