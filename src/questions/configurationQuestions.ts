import { error } from "console";
import inquirer from 'inquirer'

class ConfigurationQuestions {
    private questions = [];

    configure = async (config: any) => {
        this.addQuestions(config);

        // Set import configs
        await inquirer
        .prompt(this.questions)
        .then((answers) => {
            // Set stripped setting
            config.settings.strip = answers.strip;

            // Set import setting for Magento
            config.settings.import = answers.import

            // Set import setting for Wordpress
            config.settings.wordpressImport = answers.wordpressImport

            if (config.settings.import == 'yes') {
                config.customConfig.localDatabaseFolderLocation = config.settings.currentFolder;
            }
        })
        .catch((err: { message: any; }) => {
            error(`Something went wrong: ${err.message}`)
        });
    }

    // Add questions
    addQuestions = async (config: any) => {
        this.questions.push(
            {
                type: 'list',
                name: 'strip',
                default: 'stripped',
                message: 'Does the database need to be stripped for development?',
                choices: ['stripped', 'keep customer data', 'full'],
                validate: (input: string) => {
                    return input !== ''
                }
            }
        );

        // Only push questions if Magento project is found
        if (config.settings.currentFolderIsMagento) {
            this.questions.push(
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
        
            if (config.databases.databaseData.wordpress) {
                this.questions.push(
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