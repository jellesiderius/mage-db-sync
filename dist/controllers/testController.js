"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const tslib_1 = require("tslib");
const databaseTypeQuestion_1 = tslib_1.__importDefault(require("../questions/databaseTypeQuestion"));
const checksTask_1 = tslib_1.__importDefault(require("../tasks/checksTask"));
const console_1 = require("../utils/console");
const mainController_1 = tslib_1.__importDefault(require("./mainController"));
class TestController extends mainController_1.default {
    constructor() {
        super(...arguments);
        this.executeStart = () => tslib_1.__awaiter(this, void 0, void 0, function* () {
            yield this.askQuestions();
            yield this.configureList();
            yield this.list.run();
        });
        // Ask questions to user
        this.askQuestions = () => tslib_1.__awaiter(this, void 0, void 0, function* () {
            console_1.clearConsole();
            // Ask question about database type
            let databaseTypeQuestion = yield new databaseTypeQuestion_1.default();
            yield databaseTypeQuestion.configure(this.config);
            console_1.clearConsole();
        });
        // Configure task list
        this.configureList = () => tslib_1.__awaiter(this, void 0, void 0, function* () {
            // Build up check list
            let checkTask = yield new checksTask_1.default();
            yield checkTask.configure(this.list, this.config);
        });
    }
}
exports.default = TestController;
//# sourceMappingURL=testController.js.map