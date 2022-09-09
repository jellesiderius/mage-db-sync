import { error } from "console";
import inquirer from 'inquirer'
import DatabasesModel from "../models/databasesModel";

class syncDatabasesQuestions {
    private databasesModel = new DatabasesModel();
    private questionsOne = [];

    configure = async (config: any) => {
        await this.addQuestions(config);

        // Set import configs
        await inquirer
            .prompt(this.questionsOne)
            .then((answers) => {
                config.settings.syncDatabases = answers.syncDatabases;
            })
            .catch((err: { message: any; }) => {
                error(`Something went wrong: ${err.message}`)
            });
    }

    // Add questions
    addQuestions = async (config: any) => {
        this.questionsOne.push(
            {
                type: 'list',
                name: 'syncDatabases',
                default: 'stripped',
                message: 'Synchronize database to staging?',
                choices: ['no', 'yes'],
                validate: (input: string) => {
                    return input !== ''
                }
            }
        );
    }
}

export default syncDatabasesQuestions
