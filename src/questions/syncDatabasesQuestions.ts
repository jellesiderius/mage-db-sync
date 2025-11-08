import { error } from "console";
import inquirer from 'inquirer'
import DatabasesModel from "../models/DatabasesModel";

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
                default: 'no',
                message: `[EXPERIMENTAL]: Synchronize production database (${config.databases.databaseData.username}@${config.databases.databaseData.server}:${config.databases.databaseData.port} | ${config.databases.databaseData.domainFolder}) to staging (${config.databases.databaseDataSecond.username}@${config.databases.databaseDataSecond.server}:${config.databases.databaseDataSecond.port} | ${config.databases.databaseDataSecond.domainFolder})`,
                choices: ['no', 'yes'],
                validate: (input: string) => {}
            }
        );
    }
}

export default syncDatabasesQuestions
