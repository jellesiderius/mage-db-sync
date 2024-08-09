"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const tslib_1 = require("tslib");
const console_1 = require("console");
const inquirer_1 = tslib_1.__importDefault(require("inquirer"));
const inquirer_ts_checkbox_plus_prompt_1 = require("inquirer-ts-checkbox-plus-prompt");
class ConfigurationQuestions {
    constructor() {
        this.questionsOne = [];
        this.questionsTwo = [];
        this.questionsThree = [];
        this.configure = (config) => tslib_1.__awaiter(this, void 0, void 0, function* () {
            inquirer_1.default.registerPrompt('checkbox-plus', inquirer_ts_checkbox_plus_prompt_1.CheckboxPlusPrompt);
            yield this.addQuestions(config);
            // Set import configs
            yield inquirer_1.default
                .prompt(this.questionsOne)
                .then((answers) => {
                // Set stripped setting
                config.settings.strip = answers.strip;
                // Set import setting for Magento
                config.settings.import = answers.import;
                if (config.settings.rsyncInstalled) {
                    // Set image import setting for Shopware
                    config.settings.syncImages = answers.syncImages;
                }
                if (answers.runCommands && answers.runCommands == 'yes') {
                    config.settings.runCommands = 'yes';
                }
                // Set wordpress download value
                config.settings.wordpressDownload = answers.wordpressDownload;
                // Change location of database download depending on answer
                if (config.settings.import == 'yes') {
                    config.customConfig.localDatabaseFolderLocation = config.settings.currentFolder;
                }
            })
                .catch((err) => {
                (0, console_1.error)(`Something went wrong: ${err.message}`);
            });
            if (config.settings.wordpressDownload && config.settings.wordpressDownload == 'yes') {
                // Set import configs
                yield inquirer_1.default
                    .prompt(this.questionsTwo)
                    .then((answers) => {
                    // Set import setting for Wordpress
                    config.settings.wordpressImport = answers.wordpressImport;
                    // Change location of database download depending on answer
                    if (config.settings.wordpressImport == 'yes') {
                        config.customConfig.localDatabaseFolderLocation = config.settings.currentFolder;
                    }
                })
                    .catch((err) => {
                    (0, console_1.error)(`Something went wrong: ${err.message}`);
                });
            }
            if (config.settings.syncImages == 'yes') {
                // Set import configs
                yield inquirer_1.default
                    .prompt(this.questionsThree)
                    .then((answers) => {
                    config.settings.syncImageTypes = answers.syncImageTypes;
                })
                    .catch((err) => {
                    (0, console_1.error)(`Something went wrong: ${err.message}`);
                });
            }
        });
        // Add questions
        this.addQuestions = (config) => tslib_1.__awaiter(this, void 0, void 0, function* () {
            if (config.settings.syncTypes.includes('Magento database') && config.settings.syncDatabases != 'yes') {
                this.questionsOne.push({
                    type: 'list',
                    name: 'strip',
                    default: 'stripped',
                    message: 'Does the Magento database need to be stripped, keep customer data or have a full database?',
                    choices: ['stripped', 'keep customer data', 'full', 'full and human readable'],
                    validate: (input) => {
                        return input !== '';
                    }
                });
            }
            // Only push questions if Magento project is found
            if (config.settings.currentFolderIsMagento && config.settings.syncDatabases != 'yes' && config.settings.syncTypes.includes('Magento database')) {
                this.questionsOne.push({
                    type: 'list',
                    name: 'import',
                    default: 'yes',
                    message: 'Import Magento database?',
                    choices: ['yes', 'no'],
                    validate: (input) => {
                        return false;
                    },
                });
            }
            if (config.settings.currentFolderIsMagento && config.settings.syncTypes.includes('Images') || config.settings.syncDatabases == 'yes') {
                if (config.settings.rsyncInstalled) {
                    this.questionsOne.push({
                        type: 'list',
                        name: 'syncImages',
                        default: 'no',
                        message: 'Synchronize Magento media images?',
                        choices: ['yes', 'no'],
                        validate: (input) => {
                            return false;
                        },
                    });
                }
            }
            if (config.settings.magerun2Command && config.settings.magerun2Command.length > 0 || config.settings.databaseCommand && config.settings.databaseCommand.length > 0) {
                this.questionsOne.push({
                    type: 'list',
                    name: 'runCommands',
                    default: 'yes',
                    message: 'Run project commands?',
                    choices: ['yes', 'no'],
                    validate: (input) => {
                        return false;
                    },
                });
            }
            if (config.databases.databaseData.wordpress && config.settings.syncDatabases != 'yes' && config.settings.syncTypes.includes('Wordpress database')) {
                this.questionsOne.push({
                    type: 'list',
                    name: 'wordpressDownload',
                    default: 'no',
                    message: 'Download wordpress database?',
                    choices: ['yes', 'no'],
                    validate: (input) => {
                        return input !== '';
                    }
                });
                if (config.settings.currentFolderhasWordpress) {
                    this.questionsTwo.push({
                        type: 'list',
                        name: 'wordpressImport',
                        default: 'no',
                        message: '[EXPERIMENTAL]: Import and configure WordPress database?',
                        choices: ['yes', 'no'],
                        validate: (input) => {
                            return false;
                        },
                    });
                }
            }
            if (config.settings.syncTypes.includes('Images')) {
                this.questionsThree.push({
                    type: 'checkbox',
                    name: 'syncImageTypes',
                    message: 'Synchronize Magento media image folders',
                    choices: ['Category images', 'Product images', 'WYSIWYG images', 'Everything else'],
                    default: ['Category images', 'Product images', 'WYSIWYG images']
                });
            }
        });
    }
}
exports.default = ConfigurationQuestions;
//# sourceMappingURL=configurationQuestions.js.map