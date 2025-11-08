import stagingDatabases from "../../config/databases/staging.json";
import productionDatabases from "../../config/databases/production.json";
import path from "path";
import fs from "fs";
import os from "os";

class DatabasesModel {
    public databasesList: { [k: string]: any } = [];
    public databaseData = {
        'username': '',
        'password': '',
        'server': '',
        'domainFolder': '',
        'port': 22,
        'localProjectFolder': '',
        'externalProjectFolder': '',
        'wordpress': false,
        'externalPhpPath': '',
        'localProjectUrl': '',
        'commandsFolder': '',
        'stagingUsername': '',
        'externalElasticsearchPort': '',
        'sshKeyLocation': ''
    };

    // Collect databases | collect single database
    collectDatabaseData = async (databaseKey: string | void, databaseType: string | void, collectStaging: boolean | void, config: any | void) => {
        let databases: Record<string, any> = stagingDatabases.databases;
        let databaseDataType = this.databaseData;

        if (databaseType == 'production') {
            databases = productionDatabases.databases as Record<string, any>;
        }

        for (let [key, db] of Object.entries(databases)) {
            const database = db as any; // Database entries have dynamic structure

            if (databaseKey == key) {
                // Collect single database info
                databaseDataType.username = database.username;
                databaseDataType.password = database.password;
                databaseDataType.server = database.server;
                databaseDataType.domainFolder = database.domainFolder;
                databaseDataType.port = database.port;
                databaseDataType.localProjectFolder = database.localProjectFolder || '';
                databaseDataType.externalProjectFolder = database.externalProjectFolder;
                databaseDataType.wordpress = database.wordpress || false;
                databaseDataType.externalPhpPath = database.externalPhpPath || '';
                databaseDataType.localProjectUrl = database.localProjectUrl || '';
                if (database.externalElasticsearchPort) {
                    databaseDataType.externalElasticsearchPort = database.externalElasticsearchPort;
                }
                if (database.sshKeyName) {
                    config.customConfig.sshKeyLocation = os.userInfo().homedir + '/.ssh/' + database.sshKeyName;
                }

                if (database.commandsFolder) {
                    databaseDataType.commandsFolder = database.commandsFolder;

                    let projectDatabasesRoot = path.join(__dirname, '../../config/databases');
                    let commandsPath = path.join(projectDatabasesRoot, databaseDataType.commandsFolder);

                    if (fs.existsSync(commandsPath)) {
                        let filesArray = fs.readdirSync(commandsPath).filter(file => fs.lstatSync(commandsPath + '/' + file).isFile());
                        if (filesArray.length > 0) {
                            for (const file of filesArray) {
                                let filePath = commandsPath + '/' + file;

                                if (file == 'database.txt') {
                                    let data = fs.readFileSync(filePath, 'utf8');
                                    let dataString = data.toString().split('\n').join('');

                                    config.settings.databaseCommand = dataString;
                                }

                                if (file == 'magerun2.txt') {
                                    let data = fs.readFileSync(filePath, 'utf8');
                                    let dataString = data.toString().split('\n').join('');

                                    config.settings.magerun2Command = dataString;
                                }
                            }
                        }
                    }
                }

                if (database.stagingUsername) {
                    databaseDataType.stagingUsername = database.stagingUsername;
                }
            } else {
                // Collect all database
                this.databasesList.push(`${database.domainFolder} / ${database.username} (${key})`);
            }
        }
    }
}

export default DatabasesModel;
