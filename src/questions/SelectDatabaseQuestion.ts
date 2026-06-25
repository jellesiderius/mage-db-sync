import inquirer from 'inquirer'
import DatabasesModel from "../models/DatabasesModel";
import * as path from 'path';
import * as fs from 'fs';
import CommandExists from "command-exists";
import { NonInteractiveOptions } from "../types";

const searchList = require('inquirer-search-list');
inquirer.registerPrompt('search-list', searchList);

class SelectDatabaseQuestion {
    private databasesModel = new DatabasesModel();
    private questions: any[] = [];

    configure = async (config: any, opts?: NonInteractiveOptions) => {
        // Inline mode: source/target were already applied by StartController.applyInlineParams
        if (opts?.inlineMode) {
            return;
        }

        if (opts?.database) {
            await this.applySelection(config, opts.database);
            return;
        }

        await this.addQuestions(config);

        await inquirer
        .prompt(this.questions)
        .then(async (answers) => {
            // Get database key to get database settings
            const keyRegex = /\((.*)\)/i;
            const selectedDatabase = answers.database;
            const databaseKey = selectedDatabase.match(keyRegex)[1];

            await this.applySelection(config, databaseKey);
        })
        .catch((err: { message: any; }) => {
            console.error(`Something went wrong: ${err.message}`)
        });
    }

    private applySelection = async (config: any, databaseKey: string) => {
        // Validate that the key exists in the databases list
        const keyRegex = /\((.*)\)/i;
        const keyExists = (config.databases.databasesList as string[]).some((entry: string) => {
            const match = entry.match(keyRegex);
            return match && match[1] === databaseKey;
        });

        if (!keyExists) {
            throw new Error(`Database key "${databaseKey}" not found in the ${config.databases.databaseType} databases list.`);
        }

        // Collects database data based on key
        this.databasesModel.collectDatabaseData(databaseKey, config.databases.databaseType, false, config);

        // Set database key and data in config
        config.databases.databaseKey = databaseKey;
        config.databases.databaseData = this.databasesModel.databaseData;

        // If local folder is set for project, use that as currentFolder
        config.settings.currentFolder = process.cwd();
        if (config.databases.databaseData.localProjectFolder && config.databases.databaseData.localProjectFolder.length > 0) {
            config.settings.currentFolder = config.databases.databaseData.localProjectFolder;
        }

        // Set current folder name based on current folder
        config.settings.currentFolderName = path.basename(path.resolve(config.settings.currentFolder));

        // Overwrite project domain name if it's configured within database json file
        config.settings.magentoLocalhostDomainName = config.settings.currentFolderName + config.customConfig.localDomainExtension;
        if (config.databases.databaseData.localProjectUrl) {
            config.settings.magentoLocalhostDomainName = config.databases.databaseData.localProjectUrl;
        }

        // Check if current is magento. This will be used to determine if we can import Magento
        if (fs.existsSync(config.settings.currentFolder + '/vendor/magento') || fs.existsSync(config.settings.currentFolder + '/app/Mage.php')) {
            config.settings.currentFolderIsMagento = true;
        }

        if (config.settings.currentFolderIsMagento) {
            if (fs.existsSync(config.settings.currentFolder + '/.ddev/config.yaml')) {
                // Check if ddev is installed locally
                await CommandExists('ddev').then(() => {
                    config.settings.isDdevActive = true;
                    config.settings.magerun2CommandLocal = "ddev exec magerun2";
                }).catch(function () {});
            }
        }

        // Check if current folder has Wordpress. This will be used to determine if we can import Wordpress
        if (fs.existsSync(config.settings.currentFolder + '/wp/wp-config.php')
            || fs.existsSync(config.settings.currentFolder + '/blog/wp-config.php')
            || fs.existsSync(config.settings.currentFolder + '/wordpress/wp-config.php')
        ) {
            config.settings.currentFolderhasWordpress = true;
        }
    }

    // Add questions
    addQuestions = async (config: any) => {
        this.questions.push(
            {
                type: 'search-list',
                name: 'database',
                message: 'Select or search database',
                choices: config.databases.databasesList
            }
        )
    }
}

export default SelectDatabaseQuestion
