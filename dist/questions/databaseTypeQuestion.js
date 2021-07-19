"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const tslib_1 = require("tslib");
const console_1 = require("console");
const inquirer_1 = tslib_1.__importDefault(require("inquirer"));
const databasesModel_1 = tslib_1.__importDefault(require("../models/databasesModel"));
class DatabaseTypeQuestion {
    constructor() {
        this.databasesModel = new databasesModel_1.default();
        this.questions = [];
        this.configure = (config) => tslib_1.__awaiter(this, void 0, void 0, function* () {
            yield this.addQuestions(config);
            // Set database type
            yield inquirer_1.default
                .prompt(this.questions)
                .then((answers) => {
                // Set the database type
                config.databases.databaseType = answers.databaseType;
                // Collect databases
                this.databasesModel.collectDatabaseData('', answers.databaseType);
                // Set database list
                config.databases.databasesList = this.databasesModel.databasesList;
            })
                .catch((err) => {
                console_1.error(`Something went wrong: ${err.message}`);
            });
        });
        // Add questions
        this.addQuestions = (config) => tslib_1.__awaiter(this, void 0, void 0, function* () {
            this.questions.push({
                type: 'list',
                name: 'databaseType',
                message: 'Set database type',
                default: 'staging',
                choices: ['staging', 'production'],
                validate: (input) => {
                    return input !== '';
                }
            });
        });
    }
}
exports.default = DatabaseTypeQuestion;
//# sourceMappingURL=databaseTypeQuestion.js.map