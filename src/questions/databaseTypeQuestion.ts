import { error } from "console";
import inquirer from 'inquirer'
import DatabasesModel from "../models/databasesModel";

class DatabaseTypeQuestion {
    private databasesModel = new DatabasesModel();
    private questions = [];

    configure = async (config: any) => {
        await this.addQuestions(config);

        // Set database type
        await inquirer
        .prompt(this.questions)
        .then((answers: { databaseType: any; }) => {
            // Set the database type
            config.databases.databaseType = answers.databaseType;

            // Collect databases
            this.databasesModel.collectDatabaseData('', answers.databaseType);
            
            // Set database list
            config.databases.databasesList = this.databasesModel.databasesList;
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