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
            'localProjectUrl': ''
        };
        // Collect databases | collect single database
        this.collectDatabaseData = (databaseKey, databaseType) => tslib_1.__awaiter(this, void 0, void 0, function* () {
            // @ts-ignore
            var databases = staging_json_1.default.databases;
            if (databaseType == 'production') {
                // @ts-ignore
                databases = production_json_1.default.databases;
            }
            for (let [key, database] of Object.entries(databases)) {
                if (databaseKey == key) {
                    // Collect single database info
                    this.databaseData.username = database.username;
                    // @ts-ignore
                    this.databaseData.password = database.password;
                    this.databaseData.server = database.server;
                    this.databaseData.domainFolder = database.domainFolder;
                    // @ts-ignore
                    this.databaseData.port = database.port;
                    this.databaseData.localProjectFolder = database.localProjectFolder;
                    this.databaseData.externalProjectFolder = database.externalProjectFolder;
                    // @ts-ignore
                    this.databaseData.wordpress = database.wordpress;
                    // @ts-ignore
                    this.databaseData.externalPhpPath = database.externalPhpPath;
                    // @ts-ignore
                    this.databaseData.localProjectUrl = database.localProjectUrl;
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