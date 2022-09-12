"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const tslib_1 = require("tslib");
const console_1 = require("../utils/console");
class SyncImportTask {
    constructor() {
        this.importTasks = [];
        this.configure = (list, config, ssh) => tslib_1.__awaiter(this, void 0, void 0, function* () {
            yield this.addTasks(list, config, ssh);
            return list;
        });
        // Add tasks
        this.addTasks = (list, config, ssh) => tslib_1.__awaiter(this, void 0, void 0, function* () {
            list.add({
                title: `Import Magento database to (${config.databases.databaseDataSecond.username}@${config.databases.databaseDataSecond.server}:${config.databases.databaseDataSecond.port} | ${config.databases.databaseDataSecond.domainFolder})`,
                task: (ctx, task) => task.newListr(this.importTasks)
            });
            this.importTasks.push({
                title: 'Connecting to server through SSH',
                task: () => tslib_1.__awaiter(this, void 0, void 0, function* () {
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
                task: () => tslib_1.__awaiter(this, void 0, void 0, function* () {
                    // Retrieve settings from server to use
                    yield ssh.execCommand(console_1.sshNavigateToMagentoRootCommand('test -e vendor/magento && echo 2 || echo 1; pwd; which php;', config, true)).then((result) => {
                        if (result) {
                            console.log(result);
                            let serverValues = result.stdout.split("\n");
                            // Check if Magento 1 or Magento 2
                            config.serverVariables.magentoVersion = parseInt(serverValues[0]);
                            // Get Magento root
                            config.serverVariables.magentoRoot = serverValues[1];
                            // Get PHP path
                            config.serverVariables.externalPhpPath = serverValues[2];
                        }
                    });
                    // Use custom PHP path instead if given
                    if (config.databases.databaseDataSecond.externalPhpPath && config.databases.databaseDataSecond.externalPhpPath.length > 0) {
                        config.serverVariables.externalPhpPath = config.databases.databaseDataSecond.externalPhpPath;
                    }
                    // Determine Magerun version based on magento version
                    config.serverVariables.magerunFile = `n98-magerun2-${config.requirements.magerun2Version}.phar`;
                    if (config.serverVariables.magentoVersion == 1) {
                        config.serverVariables.magerunFile = 'n98-magerun-1.98.0.phar';
                    }
                })
            });
            this.importTasks.push({
                title: 'Downloading Magerun to server',
                task: () => tslib_1.__awaiter(this, void 0, void 0, function* () {
                    // Download Magerun to the server
                    yield ssh.execCommand(console_1.sshNavigateToMagentoRootCommand('curl -O https://files.magerun.net/' + config.serverVariables.magerunFile, config, true));
                })
            });
            this.importTasks.push({
                title: 'Uploading database file to server',
                task: () => tslib_1.__awaiter(this, void 0, void 0, function* () {
                    // Download Magerun to the server
                    yield console_1.localhostMagentoRootExec(`rsync -avz -e "ssh -p ${config.databases.databaseData.port}" ${config.finalMessages.magentoDatabaseLocation} ${config.databases.databaseData.username}@${config.databases.databaseData.server}:${config.serverVariables.magentoRoot}`, config, true);
                })
            });
            this.importTasks.push({
                title: 'Cleaning up',
                task: () => tslib_1.__awaiter(this, void 0, void 0, function* () {
                })
            });
        });
    }
}
exports.default = SyncImportTask;
//# sourceMappingURL=syncImportTask.js.map