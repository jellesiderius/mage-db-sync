"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const tslib_1 = require("tslib");
const console_1 = require("console");
const inquirer_1 = tslib_1.__importDefault(require("inquirer"));
class ImportQuestions {
    constructor() {
        this.questions = [];
        this.configure = (config) => tslib_1.__awaiter(this, void 0, void 0, function* () {
            if (!config.settings.currentFolderIsMagento) {
                return;
            }
            this.addQuestions();
            // Set import configs
            yield inquirer_1.default
                .prompt(this.questions)
                .then((answers) => {
            })
                .catch((err) => {
                console_1.error(`Something went wrong: ${err.message}`);
            });
        });
        // Add questions
        this.addQuestions = () => tslib_1.__awaiter(this, void 0, void 0, function* () {
            this.questions.push({
                type: 'list',
                name: 'import',
                default: 'yes',
                message: 'Import Magento database?',
                choices: ['yes', 'no'],
                validate: (input) => {
                    return false;
                },
            });
            this.questions.push({
                type: 'list',
                name: 'wordpressImport',
                default: 'yes',
                message: 'Import Wordpress database? [EXPERIMENTAL]',
                choices: ['yes', 'no'],
                validate: (input) => {
                    return false;
                },
            });
        });
    }
}
exports.default = ImportQuestions;
//# sourceMappingURL=importQuestions.js.map