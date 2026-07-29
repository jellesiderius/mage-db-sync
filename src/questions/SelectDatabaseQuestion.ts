import search from '@inquirer/search';
import DatabasesModel from "../models/DatabasesModel";
import * as path from 'path';
import * as fs from 'fs';
import CommandExists from "command-exists";

class SelectDatabaseQuestion {
    private databasesModel = new DatabasesModel();

    configure = async (config: any) => {
        try {
            const choices = config.databases.databasesList.map((database: string) => ({
                name: database,
                value: database
            }));
            const selectedDatabase = await search<string>({
                message: 'Select or search database',
                source: async (term) => {
                    const normalizedTerm = term?.trim().toLowerCase();
                    if (!normalizedTerm) {
                        return choices;
                    }

                    return choices.filter(({ name }: { name: string }) =>
                        name.toLowerCase().includes(normalizedTerm)
                    );
                }
            });

            // Get database key to get database settings
            const keyRegex = /\((.*)\)/i;
            const databaseKey = selectedDatabase.match(keyRegex)?.[1];
            if (!databaseKey) {
                throw new Error(`Invalid database selection: ${selectedDatabase}`);
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
        } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            console.error(`Something went wrong: ${message}`);
            throw err;
        }
    }
}

export default SelectDatabaseQuestion
