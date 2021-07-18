import { error } from "console";
import inquirer from 'inquirer'
import DatabasesModel from "../models/databasesModel";

class DatabaseTypeQuestion {
    public databases = new DatabasesModel();
    
    private databaseSelectQuestions = [
        {
            type: 'search-list',
            name: 'database',
            message: 'Select or search database',
            choices: this.databases.databasesList,
            validate: (input: string) => {
                return input !== ''
            }
        }
    ]

    configure = async (config: any) => {
        // Set database type
        await inquirer
            .prompt(this.databaseSelectQuestions)
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
}

export default SelectDatabaseQuestion