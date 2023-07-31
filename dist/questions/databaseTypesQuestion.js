"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const tslib_1 = require("tslib");
const console_1 = require("console");
const inquirer_1 = tslib_1.__importDefault(require("inquirer"));
const inquirer_ts_checkbox_plus_prompt_1 = require("inquirer-ts-checkbox-plus-prompt");
class DatbaseTypesQuestion {
    constructor() {
        this.questionsOne = [];
        this.configure = (config) => tslib_1.__awaiter(this, void 0, void 0, function* () {
            inquirer_1.default.registerPrompt('checkbox-plus', inquirer_ts_checkbox_plus_prompt_1.CheckboxPlusPrompt);
            yield this.addQuestions(config);
            // Set import configs
            yield inquirer_1.default
                .prompt(this.questionsOne)
                .then((answers) => {
            })
                .catch((err) => {
                (0, console_1.error)(`Something went wrong: ${err.message}`);
            });
        });
        // Add questions
        this.addQuestions = (config) => tslib_1.__awaiter(this, void 0, void 0, function* () {
            let choices = ['Magento database'];
            let defaultChoices = choices;
            this.questionsOne.push({
                type: 'checkbox',
                name: 'syncImageTypes',
                message: 'TEST',
                choices: choices,
                default: defaultChoices
            });
        });
    }
}
exports.default = DatbaseTypesQuestion;
//# sourceMappingURL=databaseTypesQuestion.js.map