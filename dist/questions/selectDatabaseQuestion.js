"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const tslib_1 = require("tslib");
const console_1 = require("console");
const inquirer_1 = tslib_1.__importDefault(require("inquirer"));
const databasesModel_1 = tslib_1.__importDefault(require("../models/databasesModel"));
class DatabaseTypeQuestion {
    constructor() {
        this.databases = new databasesModel_1.default();
        this.databaseSelectQuestions = [
            {
                type: 'search-list',
                name: 'database',
                message: 'Select or search database',
                choices: this.databases.databasesList,
                validate: (input) => {
                    return input !== '';
                }
            }
        ];
        this.configure = (config) => tslib_1.__awaiter(this, void 0, void 0, function* () {
            // Set database type
            yield inquirer_1.default
                .prompt(this.databaseSelectQuestions)
                .then((answers) => {
                // Set the database type
                config.settings.databaseType = answers.databaseType;
                // Collect databases
                this.databases.collectDatabaseData('', config.settings.databaseType);
                // Set database list
                config.databasesList = this.databases.databasesList;
            })
                .catch((err) => {
                console_1.error(`Something went wrong: ${err.message}`);
            });
        });
    }
}
exports.default = SelectDatabaseQuestion;
//# sourceMappingURL=selectDatabaseQuestion.js.map