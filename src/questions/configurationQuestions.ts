import { error } from "console";
import inquirer from 'inquirer'

class ConfigurationQuestions {
    private questionsOne = [];
    private questionsTwo = [];

    configure = async (config: any) => {
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
    }

    // Add questions
    addQuestions = async (config: any) => {
        this.questionsOne.push(
            {
                type: 'list',
                name: 'strip',
                default: 'stripped',
                message: 'Does the Magento database need to be stripped, keep customer data or have a full database?',
                choices: ['stripped', 'keep customer data', 'full'],
                validate: (input: string) => {
                    return input !== ''
                }
            }
        );

        // Only push questions if Magento project is found
        if (config.settings.currentFolderIsMagento && config.settings.syncDatabases != 'yes') {
            this.questionsOne.push(
                {
                    type: 'list',
                    name: 'import',
                    default: 'yes',
                    message: 'Import Magento database?',
                    choices: ['yes', 'no'],
                    validate: (input: string) => {
                        return false;
                    },
                }
            );
        }

        if (config.settings.currentFolderIsMagento || config.settings.syncDatabases == 'yes') {
            if (config.settings.rsyncInstalled) {
                this.questionsOne.push(
                    {
                        type: 'list',
                        name: 'syncImages',
                        default: 'no',
                        message: 'Synchronize Magento media images?',
                        choices: ['yes', 'no'],
                        validate: (input: string) => {
                            return false;
                        },
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
                    choices: ['yes', 'no'],
                    validate: (input: string) => {
                        return false;
                    },
                }
            );
        }

        if (config.databases.databaseData.wordpress) {
            this.questionsOne.push(
                {
                    type: 'list',
                    name: 'wordpressDownload',
                    default: 'yes',
                    message: 'Download wordpress database?',
                    choices: ['yes', 'no'],
                    validate: (input: string) => {
                        return input !== ''
                    }
                }
            );

            if (config.settings.currentFolderhasWordpress) {
                this.questionsTwo.push(
                    {
                        type: 'list',
                        name: 'wordpressImport',
                        default: 'yes',
                        message: 'Import Wordpress database? [EXPERIMENTAL]',
                        choices: ['yes', 'no'],
                        validate: (input: string) => {
                            return false;
                        },
                    }
                );
            }
        }
    }
}

export default ConfigurationQuestions
