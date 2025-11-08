import { error } from "console";
import inquirer from 'inquirer'
import { CheckboxPlusPrompt } from 'inquirer-ts-checkbox-plus-prompt';

class DownloadTypesQuestion {
    private questionsOne: any[] = [];

    configure = async (config: any) => {
        inquirer.registerPrompt('checkbox-plus', CheckboxPlusPrompt);
        await this.addQuestions(config);

        // Set import configs
        await inquirer
            .prompt(this.questionsOne)
            .then((answers) => {
                config.settings.syncTypes = answers.syncTypes;
            })
            .catch((err: { message: any; }) => {
                error(`Something went wrong: ${err.message}`)
            });
    }

    // Add questions
    addQuestions = async (config: any) => {
        let choices = ['Magento database'];
        let defaultChoices = ['Magento database'];

        if (config.databases.databaseData.wordpress) {
            choices.push('Wordpress database')
        }

        choices.push('Images')

        this.questionsOne.push(
            {
                type: 'checkbox',
                name: 'syncTypes',
                message: 'What do you want to download?',
                choices: choices,
                default: defaultChoices
            }
        );
    }
}

export default DownloadTypesQuestion
