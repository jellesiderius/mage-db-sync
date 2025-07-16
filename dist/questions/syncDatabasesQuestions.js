"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const tslib_1 = require("tslib");
const console_1 = require("console");
const inquirer_1 = (0, tslib_1.__importDefault)(require("inquirer"));
const databasesModel_1 = (0, tslib_1.__importDefault)(require("../models/databasesModel"));
class syncDatabasesQuestions {
    constructor() {
        this.databasesModel = new databasesModel_1.default();
        this.questionsOne = [];
        this.configure = (config) => (0, tslib_1.__awaiter)(this, void 0, void 0, function* () {
            yield this.addQuestions(config);
            // Set import configs
            yield inquirer_1.default
                .prompt(this.questionsOne)
                .then((answers) => {
                config.settings.syncDatabases = answers.syncDatabases;
            })
                .catch((err) => {
                (0, console_1.error)(`Something went wrong: ${err.message}`);
            });
        });
        // Add questions
        this.addQuestions = (config) => (0, tslib_1.__awaiter)(this, void 0, void 0, function* () {
            this.questionsOne.push({
                type: 'list',
                name: 'syncDatabases',
                default: 'no',
                message: `[EXPERIMENTAL]: Synchronize production database (${config.databases.databaseData.username}@${config.databases.databaseData.server}:${config.databases.databaseData.port} | ${config.databases.databaseData.domainFolder}) to staging (${config.databases.databaseDataSecond.username}@${config.databases.databaseDataSecond.server}:${config.databases.databaseDataSecond.port} | ${config.databases.databaseDataSecond.domainFolder})`,
                choices: ['no', 'yes'],
                validate: (input) => { }
            });
        });
    }
}
exports.default = syncDatabasesQuestions;
//# sourceMappingURL=syncDatabasesQuestions.js.map