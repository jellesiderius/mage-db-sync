"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const tslib_1 = require("tslib");
// @ts-ignore
const staging_json_1 = tslib_1.__importDefault(require("../../config/databases/staging.json"));
// @ts-ignore
const production_json_1 = tslib_1.__importDefault(require("../../config/databases/production.json"));
const path_1 = tslib_1.__importDefault(require("path"));
const fs_1 = tslib_1.__importDefault(require("fs"));
const os_1 = tslib_1.__importDefault(require("os"));
class DatabasesModel {
    constructor() {
        this.databasesList = [];
        this.databaseData = {
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
        this.databaseDataSecond = {
            'username': '',
            'password': '',
            'server': '',
            'domainFolder': '',
            'port': 22,
            'stagingUsername': '',
            'localProjectFolder': '',
            'externalProjectFolder': '',
            'wordpress': false,
            'externalPhpPath': '',
            'localProjectUrl': '',
            'commandsFolder': '',
            'externalElasticsearchPort': ''
        };
        // Collect databases | collect single database
        this.collectDatabaseData = (databaseKey, databaseType, collectStaging, config) => tslib_1.__awaiter(this, void 0, void 0, function* () {
            // @ts-ignore
            var databases = staging_json_1.default.databases;
            // @ts-ignore
            var databaseDataType = this.databaseData;
            if (collectStaging) {
                databaseDataType = this.databaseDataSecond;
            }
            if (databaseType == 'production') {
                // @ts-ignore
                databases = production_json_1.default.databases;
            }
            for (let [key, database] of Object.entries(databases)) {
                if (databaseKey == key) {
                    // Collect single database info
                    databaseDataType.username = database.username;
                    // @ts-ignore
                    databaseDataType.password = database.password;
                    databaseDataType.server = database.server;
                    databaseDataType.domainFolder = database.domainFolder;
                    // @ts-ignore
                    databaseDataType.port = database.port;
                    databaseDataType.localProjectFolder = database.localProjectFolder;
                    databaseDataType.externalProjectFolder = database.externalProjectFolder;
                    // @ts-ignore
                    databaseDataType.wordpress = database.wordpress;
                    // @ts-ignore
                    databaseDataType.externalPhpPath = database.externalPhpPath;
                    // @ts-ignore
                    databaseDataType.localProjectUrl = database.localProjectUrl;
                    // @ts-ignore
                    if (database.externalElasticsearchPort) {
                        // @ts-ignore
                        databaseDataType.externalElasticsearchPort = database.externalElasticsearchPort;
                    }
                    // @ts-ignore
                    if (database.sshKeyName) {
                        // @ts-ignore
                        config.customConfig.sshKeyLocation = os_1.default.userInfo().homedir + '/.ssh/' + database.sshKeyName;
                    }
                    // @ts-ignore
                    if (database.commandsFolder) {
                        // @ts-ignore
                        databaseDataType.commandsFolder = database.commandsFolder;
                        let projectDatabasesRoot = path_1.default.join(__dirname, '../../config/databases');
                        let commandsPath = path_1.default.join(projectDatabasesRoot, databaseDataType.commandsFolder);
                        if (fs_1.default.existsSync(commandsPath)) {
                            // @ts-ignore
                            let filesArray = fs_1.default.readdirSync(commandsPath).filter(file => fs_1.default.lstatSync(commandsPath + '/' + file).isFile());
                            if (filesArray.length > 0) {
                                for (const file of filesArray) {
                                    let filePath = commandsPath + '/' + file;
                                    if (file == 'database.txt') {
                                        let data = fs_1.default.readFileSync(filePath, 'utf8');
                                        let dataString = data.toString().split('\n').join('');
                                        config.settings.databaseCommand = dataString;
                                    }
                                    if (file == 'magerun2.txt') {
                                        let data = fs_1.default.readFileSync(filePath, 'utf8');
                                        let dataString = data.toString().split('\n').join('');
                                        config.settings.magerun2Command = dataString;
                                    }
                                }
                            }
                        }
                    }
                    // @ts-ignore
                    if (database.stagingUsername) {
                        // @ts-ignore
                        databaseDataType.stagingUsername = database.stagingUsername;
                        yield this.collectDatabaseData(databaseDataType.stagingUsername, 'staging', true, config);
                    }
                }
                else {
                    // Collect all database
                    this.databasesList.push(`${database.domainFolder} / ${database.username} (${key})`);
                }
            }
        });
    }
}
exports.default = DatabasesModel;
//# sourceMappingURL=databasesModel.js.map