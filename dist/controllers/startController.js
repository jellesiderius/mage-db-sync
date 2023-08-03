"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const tslib_1 = require("tslib");
const console_1 = require("../utils/console");
// @ts-ignore
const settings_json_1 = tslib_1.__importDefault(require("../../config/settings.json"));
const mainController_1 = tslib_1.__importDefault(require("./mainController"));
const databaseTypeQuestion_1 = tslib_1.__importDefault(require("../questions/databaseTypeQuestion"));
const selectDatabaseQuestion_1 = tslib_1.__importDefault(require("../questions/selectDatabaseQuestion"));
const configurationQuestions_1 = tslib_1.__importDefault(require("../questions/configurationQuestions"));
const checksTask_1 = tslib_1.__importDefault(require("../tasks/checksTask"));
const downloadTask_1 = tslib_1.__importDefault(require("../tasks/downloadTask"));
const importTask_1 = tslib_1.__importDefault(require("../tasks/importTask"));
const magentoConfigureTask_1 = tslib_1.__importDefault(require("../tasks/magentoConfigureTask"));
const wordpressConfigureTask_1 = tslib_1.__importDefault(require("../tasks/wordpressConfigureTask"));
const syncDatabasesQuestions_1 = tslib_1.__importDefault(require("../questions/syncDatabasesQuestions"));
const syncImportTask_1 = tslib_1.__importDefault(require("../tasks/syncImportTask"));
const downloadTypesQuestion_1 = tslib_1.__importDefault(require("../questions/downloadTypesQuestion"));
class StartController extends mainController_1.default {
    constructor() {
        super(...arguments);
        this.executeStart = () => tslib_1.__awaiter(this, void 0, void 0, function* () {
            // Ask all the questions to the user
            yield this.askQuestions();
            // Configure task list
            yield this.prepareTasks();
            // Run all tasks
            try {
                yield this.list.run();
                console.log('\n');
                // Show final message when done with all tasks
                if (this.config.finalMessages.importDomain.length > 0) {
                    (0, console_1.success)(`Magento is successfully imported to localhost. ${this.config.finalMessages.importDomain} is now available.`);
                    (0, console_1.info)(`You can log in to the Magento backend with username: ${settings_json_1.default.magentoBackend.adminUsername} and password: ${settings_json_1.default.magentoBackend.adminPassword}`);
                    (0, console_1.info)(`For each website there is a dummy customer account available. Email: ${settings_json_1.default.magentoBackend.adminEmailAddress}, Password: ${settings_json_1.default.magentoBackend.adminPassword}`);
                }
                else if (this.config.finalMessages.magentoDatabaseLocation.length > 0) {
                    (0, console_1.success)(`Downloaded Magento database to: ${this.config.finalMessages.magentoDatabaseLocation}`);
                    // Show wordpress download message if downloaded
                    if (this.config.finalMessages.wordpressDatabaseLocation.length > 0 && this.config.settings.wordpressDownload && this.config.settings.wordpressDownload == 'yes' && this.config.settings.wordpressImport != 'yes') {
                        (0, console_1.success)(`Downloaded Wordpress database to: ${this.config.finalMessages.wordpressDatabaseLocation}`);
                    }
                }
                // Show wordpress import message if imported
                if (this.config.settings.wordpressImport && this.config.settings.wordpressImport == 'yes') {
                    (0, console_1.success)(`Wordpress is successfully imported to localhost.`);
                    (0, console_1.info)(`You can log in to the Wordpress backend with username: ${settings_json_1.default.magentoBackend.adminEmailAddress} and password: ${settings_json_1.default.magentoBackend.adminPassword}`);
                }
                process.exit();
            }
            catch (e) {
                console.error(e);
            }
        });
        // Ask questions to user
        this.askQuestions = () => tslib_1.__awaiter(this, void 0, void 0, function* () {
            // Clear the console
            (0, console_1.clearConsole)();
            // Ask question about database type
            let databaseTypeQuestion = yield new databaseTypeQuestion_1.default();
            yield databaseTypeQuestion.configure(this.config);
            // Make user choose a database from the list
            let selectDatabaseQuestion = yield new selectDatabaseQuestion_1.default();
            yield selectDatabaseQuestion.configure(this.config);
            // @ts-ignore
            if (this.config.databases.databaseData.stagingUsername && this.config.databases.databaseDataSecond.username && this.config.settings.rsyncInstalled) {
                let syncDatabaseQuestion = yield new syncDatabasesQuestions_1.default();
                yield syncDatabaseQuestion.configure(this.config);
            }
            let downloadTypesQuestion = yield new downloadTypesQuestion_1.default();
            yield downloadTypesQuestion.configure(this.config);
            // Check if database needs to be synced
            if (this.config.settings.syncDatabases == 'yes') {
                // Adds multiple configuration questions
                let configurationQuestions = yield new configurationQuestions_1.default();
                yield configurationQuestions.configure(this.config);
            }
            else {
                // Adds multiple configuration questions
                let configurationQuestions = yield new configurationQuestions_1.default();
                yield configurationQuestions.configure(this.config);
            }
            // Clear the console
            (0, console_1.clearConsole)();
        });
        // Configure task list
        this.prepareTasks = () => tslib_1.__awaiter(this, void 0, void 0, function* () {
            (0, console_1.info)('Running all download & configuration tasks, this can take a couple of minutes, get yourself some coffee, tea or a bear! ✨\n');
            if (this.config.settings.syncDatabases == 'yes') {
                // Sync databases tasks
                // Build up check list
                let checkTask = yield new checksTask_1.default();
                yield checkTask.configure(this.list, this.config, this.ssh);
                // Build up download list
                let downloadTask = yield new downloadTask_1.default();
                yield downloadTask.configure(this.list, this.config, this.ssh, this.sshSecondDatabase);
                // Build import list
                let syncImportTask = yield new syncImportTask_1.default();
                yield syncImportTask.configure(this.list, this.config, this.ssh);
            }
            else {
                // Build up check list
                let checkTask = yield new checksTask_1.default();
                yield checkTask.configure(this.list, this.config, this.ssh);
                // Build up download list
                let downloadTask = yield new downloadTask_1.default();
                yield downloadTask.configure(this.list, this.config, this.ssh, this.sshSecondDatabase);
                // Import Magento if possible
                if (this.config.settings.import && this.config.settings.import == "yes") {
                    // Build import list
                    let importTask = yield new importTask_1.default();
                    yield importTask.configure(this.list, this.config);
                    // Build Magento configure list
                    let magentoConfigureTask = yield new magentoConfigureTask_1.default();
                    yield magentoConfigureTask.configure(this.list, this.config);
                }
                // Import wordpress if possible
                if (this.config.settings.wordpressImport && this.config.settings.wordpressImport == "yes" && this.config.settings.currentFolderhasWordpress) {
                    // Build Wordpress configure list
                    let wordpressConfigureTask = yield new wordpressConfigureTask_1.default();
                    yield wordpressConfigureTask.configure(this.list, this.config);
                }
            }
        });
    }
}
exports.default = StartController;
//# sourceMappingURL=startController.js.map