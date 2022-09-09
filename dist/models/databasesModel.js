"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const tslib_1 = require("tslib");
// @ts-ignore
const staging_json_1 = tslib_1.__importDefault(require("../../config/databases/staging.json"));
// @ts-ignore
const production_json_1 = tslib_1.__importDefault(require("../../config/databases/production.json"));
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
            'stagingUsername': ''
        };
        this.databaseDataSecond = {
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
            'stagingUsername': ''
        };
        // Collect databases | collect single database
        this.collectDatabaseData = (databaseKey, databaseType, collectStaging) => tslib_1.__awaiter(this, void 0, void 0, function* () {
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
                    if (database.commandsFolder) {
                        databaseDataType.commandsFolder = database.commandsFolder;
                    }
                    if (database.stagingUsername) {
                        databaseDataType.stagingUsername = database.stagingUsername;
                        yield this.collectDatabaseData(databaseDataType.stagingUsername, 'staging', true);
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