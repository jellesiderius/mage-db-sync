"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const tslib_1 = require("tslib");
const console_1 = require("console");
const inquirer_1 = tslib_1.__importDefault(require("inquirer"));
const databasesModel_1 = tslib_1.__importDefault(require("../models/databasesModel"));
const path = tslib_1.__importStar(require("path"));
const fs = tslib_1.__importStar(require("fs"));
class SelectDatabaseQuestion {
    constructor() {
        this.databasesModel = new databasesModel_1.default();
        this.questions = [];
        this.configure = (config) => tslib_1.__awaiter(this, void 0, void 0, function* () {
            yield this.addQuestions(config);
            yield inquirer_1.default
                .prompt(this.questions)
                .then((answers) => {
                // Get database key to get database settings
                let keyRegex = /\((.*)\)/i;
                let selectedDatabase = answers.database;
                let databaseKey = selectedDatabase.match(keyRegex)[1];
                // Collects database data based on key
                this.databasesModel.collectDatabaseData(databaseKey, config.databases.databaseType);
                // Set database data in config
                config.databases.databaseData = this.databasesModel.databaseData;
                // If local folder is set for project, use that as currentFolder
                config.settings.currentFolder = process.cwd();
                if (config.databases.databaseData.localProjectFolder && config.databases.databaseData.localProjectFolder.length > 0) {
                    config.settings.currentFolder = config.databases.databaseData.localProjectFolder;
                }
                // Set current folder name based on current folder
                config.settings.currentFolderName = path.basename(path.resolve(config.settings.currentFolder));
                // Overwrite project domain name if it's configured within database json file
                config.settings.magentoLocalhostDomainName = config.settings.currentFolderName + config.customConfig.localDomainExtension;
                if (config.databases.databaseData.localProjectUrl) {
                    config.settings.magentoLocalhostDomainName = config.databases.databaseData.localProjectUrl;
                }
                // Check if current is magento. This will be used to determine if we can import Magento
                if (fs.existsSync(config.settings.currentFolder + '/vendor/magento') || fs.existsSync(config.settings.currentFolder + '/app/Mage.php')) {
                    config.settings.currentFolderIsMagento = true;
                }
                // Check if current folder has Wordpress. This will be used to determine if we can import Wordpress
                if (fs.existsSync(config.settings.currentFolder + '/wp/wp-config.php')
                    || fs.existsSync(config.settings.currentFolder + '/blog/wp-config.php')
                    || fs.existsSync(config.settings.currentFolder + '/wordpress/wp-config.php')) {
                    config.settings.currentFolderhasWordpress = true;
                }
            })
                .catch((err) => {
                console_1.error(`Something went wrong: ${err.message}`);
            });
        });
        // Add questions
        this.addQuestions = (config) => tslib_1.__awaiter(this, void 0, void 0, function* () {
            this.questions.push({
                type: 'search-list',
                name: 'database',
                message: 'Select or search database',
                choices: config.databases.databasesList,
                validate: (input) => {
                    return input !== '';
                }
            });
        });
    }
}
exports.default = SelectDatabaseQuestion;
//# sourceMappingURL=selectDatabaseQuestion.js.map