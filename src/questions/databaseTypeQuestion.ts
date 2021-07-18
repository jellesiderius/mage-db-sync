import { error } from "console";
import inquirer from 'inquirer'
import DatabasesModel from "../models/databasesModel";

class DatabaseTypeQuestion {
    private databases = new DatabasesModel();
    private questions = [];

    configure = async (config: any) => {
        this.addQuestions();

        // Set database type
        await inquirer
        .prompt(this.questions)
        .then((answers: { databaseType: any; }) => {
            // Set the database type
            config.settings.databaseType = answers.databaseType;
            // Collect databases
            this.databases.collectDatabaseData('', config.settings.databaseType);
            // Set database list
            config.databasesList = this.databases.databasesList;
        })
        .catch((err: { message: any; }) => {
            error(`Something went wrong: ${err.message}`)
        });
    }

    // Add questions
    addQuestions = async () => {
        this.questions.push(
            {
                type: 'list',
                name: 'databaseType',
                message: 'Set database type',
                default: 'staging',
                choices: ['staging', 'production'],
                validate: (input: string) => {
                    return input !== ''
                }
            }
        )
    }
}

export default DatabaseTypeQuestion