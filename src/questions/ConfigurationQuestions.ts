import { error } from "console";
import inquirer from 'inquirer'
import { CheckboxPlusPrompt } from 'inquirer-ts-checkbox-plus-prompt';

class ConfigurationQuestions {
    private questionsOne: any[] = [];
    private questionsTwo: any[] = [];
    private questionsThree: any[] = [];

    configure = async (config: any) => {
        inquirer.registerPrompt('checkbox-plus', CheckboxPlusPrompt);
        await this.addQuestions(config);

        // Set import configs
        await inquirer
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
                config.settings.wordpressDownload = answers.wordpressDownload

                // Change location of database download depending on answer
                if (config.settings.import == 'yes') {
                    config.customConfig.localDatabaseFolderLocation = config.settings.currentFolder;
                }
            })
            .catch((err: { message: any; }) => {
                error(`Something went wrong: ${err.message}`)
            });

        if (config.settings.wordpressDownload && config.settings.wordpressDownload == 'yes') {
            // Set import configs
            await inquirer
                .prompt(this.questionsTwo)
                .then((answers) => {
                    // Set import setting for Wordpress
                    config.settings.wordpressImport = answers.wordpressImport

                    // Change location of database download depending on answer
                    if (config.settings.wordpressImport == 'yes') {
                        config.customConfig.localDatabaseFolderLocation = config.settings.currentFolder;
                    }
                })
                .catch((err: { message: any; }) => {
                    error(`Something went wrong: ${err.message}`)
                });
        }


        if (config.settings.syncImages == 'yes') {
            // Set import configs
            await inquirer
                .prompt(this.questionsThree)
                .then((answers) => {
                    config.settings.syncImageTypes = answers.syncImageTypes;
                })
                .catch((err: { message: any; }) => {
                    error(`Something went wrong: ${err.message}`)
                });
        }
    }

    // Add questions
    addQuestions = async (config: any) => {
        if (config.settings.syncTypes.includes('Magento database')) {
            this.questionsOne.push(
                {
                    type: 'list',
                    name: 'strip',
                    default: 'stripped',
                    message: 'Does the Magento database need to be stripped, keep customer data or have a full database?',
                    choices: ['stripped', 'keep customer data', 'full', 'full and human readable']
                }
            );
        }

        // Only push questions if Magento project is found
        if (config.settings.currentFolderIsMagento && config.settings.syncTypes.includes('Magento database')) {
            this.questionsOne.push(
                {
                    type: 'list',
                    name: 'import',
                    default: 'yes',
                    message: 'Import Magento database?',
                    choices: ['yes', 'no']
                }
            );
        }

        if (config.settings.currentFolderIsMagento && config.settings.syncTypes.includes('Images')) {
            if (config.settings.rsyncInstalled) {
                this.questionsOne.push(
                    {
                        type: 'list',
                        name: 'syncImages',
                        default: 'no',
                        message: 'Synchronize Magento media images?',
                        choices: ['yes', 'no']
                    }
                );
            }
        }

        if (config.settings.magerun2Command && config.settings.magerun2Command.length > 0 || config.settings.databaseCommand && config.settings.databaseCommand.length > 0) {
            this.questionsOne.push(
                {
                    type: 'list',
                    name: 'runCommands',
                    default: 'yes',
                    message: 'Run project commands?',
                    choices: ['yes', 'no']
                }
            );
        }

        if (config.databases.databaseData.wordpress && config.settings.syncTypes.includes('Wordpress database')) {
            this.questionsOne.push(
                {
                    type: 'list',
                    name: 'wordpressDownload',
                    default: 'yes',
                    message: 'Download wordpress database?',
                    choices: ['yes', 'no']
                }
            );

            if (config.settings.currentFolderhasWordpress) {
                this.questionsTwo.push(
                    {
                        type: 'list',
                        name: 'wordpressImport',
                        default: 'yes',
                        message: 'Import and configure WordPress database?',
                        choices: ['yes', 'no']
                    }
                );
            }
        }

        if (config.settings.syncTypes.includes('Images')) {
            this.questionsThree.push(
                {
                    type: 'checkbox',
                    name: 'syncImageTypes',
                    message: 'Synchronize Magento media image folders',
                    choices: ['Category images', 'Product images', 'WYSIWYG images', 'Everything else'],
                    default: ['Category images', 'Product images', 'WYSIWYG images']
                }
            );
        }
    }
}

export default ConfigurationQuestions
