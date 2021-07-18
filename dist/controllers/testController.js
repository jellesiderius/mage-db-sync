"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const tslib_1 = require("tslib");
const console_1 = require("../utils/console");
const mainController_1 = tslib_1.__importDefault(require("./mainController"));
const databaseTypeQuestion_1 = tslib_1.__importDefault(require("../questions/databaseTypeQuestion"));
const selectDatabaseQuestion_1 = tslib_1.__importDefault(require("../questions/selectDatabaseQuestion"));
const configurationQuestions_1 = tslib_1.__importDefault(require("../questions/configurationQuestions"));
const checksTask_1 = tslib_1.__importDefault(require("../tasks/checksTask"));
const downloadTask_1 = tslib_1.__importDefault(require("../tasks/downloadTask"));
class TestController extends mainController_1.default {
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
                process.exit();
            }
            catch (e) {
                console.error(e);
            }
        });
        // Ask questions to user
        this.askQuestions = () => tslib_1.__awaiter(this, void 0, void 0, function* () {
            // Clear the console
            console_1.clearConsole();
            // Ask question about database type
            let databaseTypeQuestion = yield new databaseTypeQuestion_1.default();
            yield databaseTypeQuestion.configure(this.config);
            // Make user choose a database from the list
            let selectDatabaseQuestion = yield new selectDatabaseQuestion_1.default();
            yield selectDatabaseQuestion.configure(this.config);
            // Adds multiple configuration questions
            let configurationQuestions = yield new configurationQuestions_1.default();
            yield configurationQuestions.configure(this.config);
            // Clear the console
            console_1.clearConsole();
        });
        // Configure task list
        this.prepareTasks = () => tslib_1.__awaiter(this, void 0, void 0, function* () {
            // Build up check list
            let checkTask = yield new checksTask_1.default();
            yield checkTask.configure(this.list, this.config);
            // Build up download list
            let downloadTask = yield new downloadTask_1.default();
            yield downloadTask.configure(this.list, this.config, this.ssh);
        });
    }
}
exports.default = TestController;
//# sourceMappingURL=testController.js.map