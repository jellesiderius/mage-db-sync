import { error } from "console";
import inquirer from 'inquirer'
import DatabasesModel from "../models/DatabasesModel";
import { NonInteractiveOptions } from "../types";

class DatabaseTypeQuestion {
    private databasesModel = new DatabasesModel();
    private questions: any[] = [];

    configure = async (config: any, opts?: NonInteractiveOptions) => {
        // Inline mode: source/target were already applied by StartController.applyInlineParams
        if (opts?.inlineMode) {
            return;
        }

        // Non-interactive: use provided database type directly
        if (opts?.databaseType) {
            config.databases.databaseType = opts.databaseType;
            await this.databasesModel.collectDatabaseData('', opts.databaseType, false, config);
            config.databases.databasesList = this.databasesModel.databasesList;
            return;
        }

        await this.addQuestions(config);

        // Set database type
        await inquirer
        .prompt(this.questions)
        .then((answers: { databaseType: any; }) => {
            // Set the database type
            config.databases.databaseType = answers.databaseType;

            // Collect databases
            this.databasesModel.collectDatabaseData('', answers.databaseType, false, config);

            // Set database list
            config.databases.databasesList = this.databasesModel.databasesList;
        })
        .catch((err: { message: any; }) => {
            error(`Something went wrong: ${err.message}`)
        });
    }

    // Add questions
    addQuestions = async (_config: any) => {
        this.questions.push(
            {
                type: 'list',
                name: 'databaseType',
                message: 'Set database type',
                default: 'staging',
                choices: ['staging', 'production']
            }
        )
    }
}

export default DatabaseTypeQuestion
